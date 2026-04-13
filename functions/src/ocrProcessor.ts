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

  credit_report: `당신은 한국 개인신용정보 조회서(크레딧포유/올크레딧 발급) PDF를 분석하는 전문가입니다.

이 PDF에서 다음 정보를 JSON으로 추출해주세요:

{ "debts": [
  {
    "creditor": "금융기관명 (정확한 전체 명칭)",
    "type": "대출종류 (신용대출/담보대출/카드론/현금서비스/보증채무/할부금융 등)",
    "originalAmount": 당초대출금액(숫자),
    "currentBalance": 현재잔액(숫자),
    "startDate": "개설일 (YYYY-MM-DD)",
    "endDate": "만기일 (YYYY-MM-DD 또는 null)",
    "isOverdue": 연체여부(boolean),
    "overdueAmount": 연체금액(숫자 또는 0),
    "accountNumber": "계좌/관리번호 (있으면)"
  }
],
"cards": [
  {
    "creditor": "카드사명",
    "cardNumber": "카드번호",
    "creditLimit": 한도(숫자),
    "currentBalance": 이용잔액(숫자),
    "cashAdvanceBalance": 현금서비스잔액(숫자 또는 0)
  }
],
"overdues": [
  {
    "creditor": "기관명",
    "amount": 연체금액(숫자),
    "startDate": "연체발생일",
    "reason": "등록사유"
  }
],
"guarantees": [
  {
    "creditor": "기관명",
    "amount": 보증금액(숫자),
    "type": "보증종류"
  }
],
"summary": {
  "totalDebtCount": 총대출건수,
  "totalDebtAmount": 총대출잔액,
  "totalOverdueCount": 총연체건수,
  "totalOverdueAmount": 총연체금액
}
}

규칙:
- 금액은 순수 숫자만 (쉼표, "원", "천원" 제거)
- 날짜는 YYYY-MM-DD 형식
- 없는 항목은 null 또는 빈 배열
- PDF에 있는 모든 채무를 빠짐없이 추출
- JSON만 반환`,
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

/**
 * Gemini Vision OCR 프록시
 * 클라이언트에서 base64 이미지 + 프롬프트를 보내면 서버에서 Gemini API 호출
 * → API 키가 클라이언트 번들에 노출되지 않음
 */
export async function handleGeminiOcr(req: Request, res: Response) {
  try {
    const { image, mimeType, prompt } = req.body as {
      image: string;   // base64
      mimeType: string;
      prompt: string;
    };

    if (!image || !prompt) {
      res.status(400).json({ error: "image, prompt 필드 필요" });
      return;
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;

    const body = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType || "image/jpeg", data: image } },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
    };

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error(`Gemini API 오류 (${geminiRes.status}): ${errText}`);
    }

    const data = await geminiRes.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    res.json({ text });
  } catch (err: any) {
    console.error("[GeminiOCR] 오류:", err);
    res.status(500).json({ error: err.message ?? "Gemini OCR 처리 실패" });
  }
}

/** 크레딧포유 신용조회서 PDF 파싱 */
export async function handleCreditReportParse(req: Request, res: Response) {
  try {
    const { storagePath, clientId, officeId, fileType } = req.body as {
      storagePath: string;
      clientId: string;
      officeId: string;
      fileType?: string; // 'pdf' | 'image'
    };

    if (!storagePath || !clientId || !officeId) {
      res.status(400).json({ error: "필수 파라미터 누락 (storagePath, clientId, officeId)" });
      return;
    }

    // Firebase Storage에서 파일 다운로드
    const bucket = admin.storage().bucket();
    const gcsFile = bucket.file(storagePath);
    const [buffer] = await gcsFile.download();
    const base64 = buffer.toString("base64");

    // 파일 타입 감지 (확장자 또는 프론트에서 전달)
    const ext = storagePath.split(".").pop()?.toLowerCase() ?? "";
    const isImage = fileType === "image" || ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(ext);

    // Claude API 호출
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.");

    const client = new Anthropic({ apiKey });
    const prompt = DOC_TYPE_PROMPTS.credit_report;

    // PDF → document type, 이미지 → image type (OCR)
    const mediaMap: Record<string, string> = {
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
      webp: "image/webp", heic: "image/jpeg", heif: "image/jpeg",
    };
    const contentBlock: any = isImage
      ? { type: "image", source: { type: "base64", media_type: mediaMap[ext] ?? "image/jpeg", data: base64 } }
      : { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } };

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: [contentBlock, { type: "text", text: prompt }],
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    // JSON 파싱
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Claude 응답에서 JSON을 찾을 수 없습니다.");

    const parsed = JSON.parse(jsonMatch[0]) as {
      debts?: any[];
      cards?: any[];
      overdues?: any[];
      guarantees?: any[];
      summary?: any;
    };

    // debts를 Debt[] 형태로 변환 (기존 Client.Debt 인터페이스에 맞춤)
    const debts = (parsed.debts || []).map((d: any, idx: number) => ({
      id: `cr_${Date.now()}_${idx}`,
      name: `${d.creditor} ${d.type || ""}`.trim(),
      creditor: d.creditor || "",
      type: (d.type?.includes("담보") ? "담보" : "무담보") as "무담보" | "담보" | "사채",
      amount: d.currentBalance || d.originalAmount || 0,
      rate: 0,
      monthly: 0,
      source: "manual" as const,
      // 신용조회서 원본 데이터 보존
      _creditReport: {
        originalAmount: d.originalAmount || null,
        currentBalance: d.currentBalance || null,
        startDate: d.startDate || null,
        endDate: d.endDate || null,
        isOverdue: d.isOverdue || false,
        overdueAmount: d.overdueAmount || 0,
        accountNumber: d.accountNumber || null,
      },
    }));

    // Firestore clients/{id}에 저장
    const clientRef = admin.firestore()
      .collection("offices").doc(officeId)
      .collection("clients").doc(clientId);

    await clientRef.update({
      debts: debts,
      creditReport: {
        cards: parsed.cards || [],
        overdues: parsed.overdues || [],
        guarantees: parsed.guarantees || [],
        summary: parsed.summary || {},
        parsedAt: admin.firestore.FieldValue.serverTimestamp(),
        storagePath,
      },
    });

    res.json({
      debts,
      cards: parsed.cards || [],
      overdues: parsed.overdues || [],
      guarantees: parsed.guarantees || [],
      summary: parsed.summary || {},
    });
  } catch (err: any) {
    console.error("[CreditReport] 파싱 오류:", err);
    res.status(500).json({ error: err.message ?? "신용조회서 파싱 실패" });
  }
}
