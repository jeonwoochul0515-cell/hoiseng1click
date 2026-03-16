const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// ---------------------------------------------------------------------------
// 공통: 이미지 → base64
// ---------------------------------------------------------------------------
async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return { base64: btoa(binary), mimeType: file.type || 'image/jpeg' };
}

// ---------------------------------------------------------------------------
// 공통: Gemini Vision 호출
// ---------------------------------------------------------------------------
async function callGeminiVision(file: File, prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('Gemini API 키가 설정되지 않았습니다.');

  const { base64, mimeType } = await fileToBase64(file);

  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: base64 } },
      ],
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,
    },
  };

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API 오류 (${res.status}): ${err}`);
  }

  const data = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ---------------------------------------------------------------------------
// 사업자등록증 OCR
// ---------------------------------------------------------------------------
export interface BizRegData {
  bizNumber: string;
  officeName: string;
  rep: string;
  address: string;
  bizType: string;
  bizItem: string;
  openDate: string;
  officeType: 'lawyer' | 'scrivener';
}

export async function ocrBusinessRegistration(
  imageFile: File,
  onProgress?: (p: number) => void,
): Promise<BizRegData> {
  onProgress?.(10);

  const prompt = `이 이미지는 한국 사업자등록증입니다. 아래 필드를 JSON으로 추출하세요. 값이 없으면 빈 문자열로 채우세요.

{
  "bizNumber": "사업자등록번호 (XXX-XX-XXXXX 형식)",
  "officeName": "상호(법인명)",
  "rep": "대표자 성명",
  "address": "사업장 소재지",
  "bizType": "업태",
  "bizItem": "종목",
  "openDate": "개업연월일"
}

JSON만 출력하세요. 다른 텍스트는 포함하지 마세요.`;

  onProgress?.(30);
  const raw = await callGeminiVision(imageFile, prompt);
  onProgress?.(80);

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Gemini 응답에서 JSON을 추출할 수 없습니다.');

  const parsed = JSON.parse(jsonMatch[0]) as Omit<BizRegData, 'officeType'>;

  const officeType = inferOfficeType(parsed.officeName, parsed.bizType, parsed.bizItem);
  onProgress?.(100);

  return { ...parsed, officeType };
}

function inferOfficeType(
  name: string, bizType: string, bizItem: string,
): 'lawyer' | 'scrivener' {
  const combined = `${name} ${bizType} ${bizItem}`;
  if (/법무사/.test(combined)) return 'scrivener';
  return 'lawyer';
}

// ---------------------------------------------------------------------------
// 주민등록증 OCR
// ---------------------------------------------------------------------------
export interface IdCardData {
  name: string;
  ssn: string;
  address: string;
}

export async function ocrIdCard(
  imageFile: File,
  onProgress?: (p: number) => void,
): Promise<IdCardData> {
  onProgress?.(10);

  const prompt = `이 이미지는 한국 주민등록증입니다. 아래 필드를 JSON으로 추출하세요. 값이 없으면 빈 문자열로 채우세요.

{
  "name": "이름 (한글 2~4자)",
  "ssn": "주민등록번호 (NNNNNN-NNNNNNN 형식, 13자리 숫자+하이픈)",
  "address": "주소 (도/시/군/구 등 전체 주소)"
}

주민등록번호는 반드시 NNNNNN-NNNNNNN 형식으로 출력하세요 (앞6자리-뒤7자리).
JSON만 출력하세요. 다른 텍스트는 포함하지 마세요.`;

  onProgress?.(30);
  const raw = await callGeminiVision(imageFile, prompt);
  onProgress?.(80);

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Gemini 응답에서 JSON을 추출할 수 없습니다.');

  const parsed = JSON.parse(jsonMatch[0]) as IdCardData;

  // 주민등록번호 형식 정리: 숫자만 추출 후 하이픈 삽입
  const ssnDigits = (parsed.ssn || '').replace(/[^0-9]/g, '');
  if (ssnDigits.length === 13) {
    parsed.ssn = `${ssnDigits.slice(0, 6)}-${ssnDigits.slice(6)}`;
  }

  onProgress?.(100);
  return parsed;
}

// ---------------------------------------------------------------------------
// 통장 사본 OCR
// ---------------------------------------------------------------------------
export interface BankbookData {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

const KNOWN_BANKS = [
  '국민', 'KB국민', '신한', '하나', '우리', '농협', 'NH농협',
  '기업', 'IBK기업', 'SC제일', 'SC', '카카오', '카카오뱅크',
  '토스', '토스뱅크', '케이뱅크', '수협', '대구', '부산',
  '광주', '전북', '경남', '제주', '산업', 'KDB산업',
  '새마을금고', '신협', '우체국', '씨티',
];

export async function ocrBankbook(
  imageFile: File,
  onProgress?: (p: number) => void,
): Promise<BankbookData> {
  onProgress?.(10);

  const prompt = `이 이미지는 한국 은행 통장 사본(또는 통장 표지)입니다. 아래 필드를 JSON으로 추출하세요. 값이 없으면 빈 문자열로 채우세요.

{
  "bankName": "은행명 (예: 국민은행, 신한은행, 하나은행 등)",
  "accountNumber": "계좌번호 (숫자와 하이픈 포함)",
  "accountHolder": "예금주명"
}

JSON만 출력하세요. 다른 텍스트는 포함하지 마세요.`;

  onProgress?.(30);
  const raw = await callGeminiVision(imageFile, prompt);
  onProgress?.(80);

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Gemini 응답에서 JSON을 추출할 수 없습니다.');

  const parsed = JSON.parse(jsonMatch[0]) as BankbookData;

  // 은행명 정규화: 알려진 은행명과 매칭
  if (parsed.bankName) {
    const matched = KNOWN_BANKS.find(b => parsed.bankName.includes(b));
    if (matched) {
      // "은행" 접미사 통일
      parsed.bankName = matched.endsWith('은행') || matched.endsWith('금고') || matched.endsWith('협') || matched.endsWith('국')
        ? matched
        : matched + '은행';
    }
  }

  onProgress?.(100);
  return parsed;
}

// ---------------------------------------------------------------------------
// 범용 문서 OCR (임대차계약서, 거래내역 등)
// ---------------------------------------------------------------------------
export interface OcrDocResult {
  text: string;
  structured: Record<string, unknown>;
}

export async function ocrDocument(
  imageFile: File,
  documentType: 'lease' | 'bankStatement' | 'insurance' | 'general',
  onProgress?: (p: number) => void,
): Promise<OcrDocResult> {
  onProgress?.(10);

  const prompts: Record<string, string> = {
    lease: `이 이미지는 한국 임대차계약서입니다. 아래 필드를 JSON으로 추출하세요:
{
  "address": "임대 부동산 주소",
  "deposit": 보증금(숫자),
  "monthlyRent": 월세(숫자),
  "contractStart": "계약 시작일 (YYYY-MM-DD)",
  "contractEnd": "계약 종료일 (YYYY-MM-DD)",
  "landlordName": "임대인 성명",
  "tenantName": "임차인 성명"
}
JSON만 출력하세요.`,

    bankStatement: `이 이미지는 한국 은행 거래내역서입니다. 거래 내역을 JSON 배열로 추출하세요:
[{ "date": "YYYY-MM-DD", "description": "적요", "deposit": 입금액(숫자), "withdrawal": 출금액(숫자), "balance": 잔액(숫자) }]
JSON만 출력하세요.`,

    insurance: `이 이미지는 한국 보험증권입니다. 아래 필드를 JSON으로 추출하세요:
{
  "company": "보험회사",
  "productName": "보험상품명",
  "insuredName": "피보험자",
  "premium": 보험료(숫자),
  "surrenderValue": 해약환급금(숫자, 있으면),
  "contractDate": "계약일",
  "expiryDate": "만기일"
}
JSON만 출력하세요.`,

    general: `이 이미지에서 모든 텍스트를 추출하세요. 표가 있으면 구조를 유지하세요. 추출된 텍스트만 출력하세요.`,
  };

  const prompt = prompts[documentType] ?? prompts.general;
  onProgress?.(30);

  const raw = await callGeminiVision(imageFile, prompt);
  onProgress?.(80);

  let structured: Record<string, unknown> = {};
  const jsonMatch = raw.match(/[\[{][\s\S]*[\]}]/);
  if (jsonMatch) {
    try { structured = JSON.parse(jsonMatch[0]); } catch { /* plain text */ }
  }

  onProgress?.(100);
  return { text: raw, structured };
}
