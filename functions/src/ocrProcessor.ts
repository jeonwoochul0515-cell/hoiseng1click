/**
 * 업로드된 PDF/이미지 OCR 처리 + 데이터 추출
 * Anthropic Claude Vision API 사용
 */
import type { Request, Response } from "express";
import * as admin from "firebase-admin";
import Anthropic from "@anthropic-ai/sdk";

interface OcrResult {
  rawText: string;
  structured: Record<string, string>;
  amounts: number[];
  dates: string[];
  accountNumbers: string[];
}

const DOC_TYPE_PROMPTS: Record<string, string> = {
  debt_cert: `이 부채증명서/채무증명서 이미지에서 다음 정보를 추출해주세요:
- 잔액(원금): 숫자만
- 이자율(%): 숫자만
- 대출일: YYYY-MM-DD
- 만기일: YYYY-MM-DD
- 연체이자: 숫자만
- 계좌번호/대출번호
- 채권자명
JSON 형식으로 응답해주세요.`,

  surrender_value: `이 해약환급금증명서 이미지에서 다음 정보를 추출해주세요:
- 해약환급금: 숫자만
- 보험명
- 증권번호
- 납입보험료 합계
- 보험회사명
JSON 형식으로 응답해주세요.`,

  income_cert: `이 소득금액증명원 이미지에서 다음 정보를 추출해주세요:
- 총소득금액: 숫자만
- 근로소득: 숫자만
- 사업소득: 숫자만
- 귀속연도
JSON 형식으로 응답해주세요.`,

  tax_cert: `이 납세증명서 이미지에서 다음 정보를 추출해주세요:
- 납세액: 숫자만
- 미납액: 숫자만
- 발급일: YYYY-MM-DD
- 유효기간
JSON 형식으로 응답해주세요.`,

  general: `이 서류 이미지에서 모든 텍스트를 추출해주세요. 금액(원), 날짜, 계좌번호가 있으면 별도로 표시해주세요. JSON 형식: { "text": "전체텍스트", "amounts": [숫자], "dates": ["날짜"], "accounts": ["계좌번호"] }`,
};

async function runOcr(imageBase64: string, mimeType: string, docType: string): Promise<OcrResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.");

  const client = new Anthropic({ apiKey });
  const prompt = DOC_TYPE_PROMPTS[docType] || DOC_TYPE_PROMPTS.general;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mimeType as any, data: imageBase64 } },
        { type: "text", text: prompt },
      ],
    }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  // JSON 파싱 시도
  let structured: Record<string, string> = {};
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) structured = JSON.parse(jsonMatch[0]);
  } catch { /* 파싱 실패 시 무시 */ }

  // 금액 추출 (숫자 패턴)
  const amounts = (text.match(/[\d,]+원/g) || [])
    .map(s => parseInt(s.replace(/[^0-9]/g, ''), 10))
    .filter(n => n > 0);

  // 날짜 추출
  const dates = text.match(/\d{4}[-./]\d{2}[-./]\d{2}/g) || [];

  // 계좌번호 추출
  const accountNumbers = text.match(/\d{3,4}-\d{2,4}-\d{4,8}/g) || [];

  return { rawText: text, structured, amounts, dates, accountNumbers };
}

/** CODEF vs PDF 데이터 병합 (PDF 우선) */
function mergeAmounts(codefAmount: number | undefined, pdfAmounts: number[]): {
  pdfAmount: number | undefined;
  dataMismatch: boolean;
} {
  const pdfAmount = pdfAmounts.length > 0 ? Math.max(...pdfAmounts) : undefined;
  const dataMismatch = codefAmount != null && pdfAmount != null && Math.abs(pdfAmount - codefAmount) > 100;
  return { pdfAmount, dataMismatch };
}

export async function handleDocOcr(req: Request, res: Response) {
  try {
    const { officeId, clientId, docId, storagePath, docType, codefAmount } = req.body as {
      officeId: string;
      clientId: string;
      docId: string;
      storagePath: string;
      docType: string;
      codefAmount?: number;
    };

    if (!officeId || !clientId || !docId || !storagePath) {
      res.status(400).json({ error: "필수 파라미터 누락" });
      return;
    }

    // Firestore에 처리 중 상태 기록
    const docRef = admin.firestore()
      .collection("offices").doc(officeId)
      .collection("clients").doc(clientId)
      .collection("documents").doc(docId);

    await docRef.update({ ocrStatus: "processing" });

    // Storage에서 파일 다운로드
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    const [buffer] = await file.download();
    const [metadata] = await file.getMetadata();
    const mimeType = metadata.contentType || "image/jpeg";

    // base64 변환
    const base64 = buffer.toString("base64");

    // OCR 실행
    const ocrResult = await runOcr(base64, mimeType, docType);

    // CODEF 대비 금액 비교
    const { pdfAmount, dataMismatch } = mergeAmounts(codefAmount, ocrResult.amounts);

    // Firestore에 결과 저장
    await docRef.update({
      ocrStatus: "done",
      extractedData: {
        rawText: ocrResult.rawText.slice(0, 5000), // 5KB 제한
        amounts: ocrResult.amounts,
        dates: ocrResult.dates,
        accountNumbers: ocrResult.accountNumbers,
        structured: ocrResult.structured,
      },
      pdfAmount: pdfAmount ?? null,
      dataMismatch: dataMismatch,
    });

    res.json({
      ok: true,
      ocrResult: {
        amounts: ocrResult.amounts,
        dates: ocrResult.dates,
        structured: ocrResult.structured,
        pdfAmount,
        dataMismatch,
        codefAmount,
      },
    });
  } catch (err: any) {
    console.error("[OCR] 처리 오류:", err);

    // 실패 상태 기록
    try {
      const { officeId, clientId, docId } = req.body;
      if (officeId && clientId && docId) {
        await admin.firestore()
          .collection("offices").doc(officeId)
          .collection("clients").doc(clientId)
          .collection("documents").doc(docId)
          .update({ ocrStatus: "failed" });
      }
    } catch { /* 무시 */ }

    res.status(500).json({ error: err.message ?? "OCR 처리 실패" });
  }
}
