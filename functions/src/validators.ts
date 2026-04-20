// 입력 검증 유틸 — CODEF 프록시 및 인테이크 엔드포인트에서 공용 사용
// 허용된 은행/증권사/보험사 목록은 codefProxy.ts의 ORG_MAP에서 동적으로 검증
// (순환 참조 방지 위해 이 파일은 단순 원시 검증만 담당)

export class ValidationError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// 주민등록번호 형식 + 체크섬 검증
// 포맷: 6자리-7자리 또는 13자리 연속
export function isValidSSN(raw: string): boolean {
  if (typeof raw !== "string") return false;
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 13) return false;
  // 월/일 유효성
  const month = parseInt(digits.substring(2, 4), 10);
  const day = parseInt(digits.substring(4, 6), 10);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  // 성별코드
  const g = parseInt(digits[6], 10);
  if (g < 0 || g > 9) return false;
  // 체크섬 (내국인/외국인 주민번호 공통 가중치)
  const weights = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i], 10) * weights[i];
  }
  const check = (11 - (sum % 11)) % 10;
  return check === parseInt(digits[12], 10);
}

// 전화번호 — 한국 휴대폰/유선 모두 허용
export function isValidPhone(raw: string): boolean {
  if (typeof raw !== "string") return false;
  const digits = raw.replace(/\D/g, "");
  // 휴대폰: 010/011/016/017/018/019 + 8자리
  if (/^01[016789]\d{7,8}$/.test(digits)) return true;
  // 서울 02 + 7~8자리
  if (/^02\d{7,8}$/.test(digits)) return true;
  // 기타 지역번호 0XX + 7~8자리
  if (/^0[3-6]\d\d{7,8}$/.test(digits)) return true;
  return false;
}

// 이름 — 한글/영문/공백 2~40자
export function isValidName(raw: string): boolean {
  if (typeof raw !== "string") return false;
  const trimmed = raw.trim();
  if (trimmed.length < 2 || trimmed.length > 40) return false;
  return /^[가-힣a-zA-Z\s]+$/.test(trimmed);
}

// CODEF 로그인 ID — 50자 이하, 제어문자 금지
// 공동인증서(PFX/cert) 방식은 ID가 빈 문자열이어도 정상 (인증서가 식별자)
// 간편인증/ID PW 방식은 실제 ID 필요
export function isValidLoginId(raw: string): boolean {
  if (typeof raw !== "string") return false;
  if (raw.length > 50) return false;
  // 제어문자 금지
  return !/[\x00-\x1f\x7f]/.test(raw);
}

// CODEF 비밀번호 — 길이만 검증 (내용은 RSA 암호화 대상)
export function isValidPassword(raw: string): boolean {
  if (typeof raw !== "string") return false;
  return raw.length >= 1 && raw.length <= 200;
}

// 은행/기관명 — 한글/영문/괄호/공백 2~30자
export function isValidBankName(raw: string): boolean {
  if (typeof raw !== "string") return false;
  const trimmed = raw.trim();
  if (trimmed.length < 2 || trimmed.length > 30) return false;
  return /^[가-힣a-zA-Z0-9()\s·]+$/.test(trimmed);
}

// loginType — CODEF 스펙상 허용 값 (codefProxy LOGIN_TYPE_MAP과 일치)
// - cert / finCert: 공동인증서/금융인증서 (PFX, certFile 사용, id 선택)
// - kakao / pass / naver / payco / samsung / kb / shinhan / toss: 간편인증
// - id: ID/PW 방식 (id+password 필수)
// 대소문자 모두 허용
const ALLOWED_LOGIN_TYPES = new Set([
  "cert", "finCert", "kakao", "pass", "naver", "payco",
  "samsung", "kb", "shinhan", "toss",
  "id", "CERT", "FINCERT", "KAKAO", "PASS", "NAVER", "PAYCO",
  "SAMSUNG", "KB", "SHINHAN", "TOSS", "ID",
  "SIMPLE", "simple",
]);
export function isValidLoginType(raw: string): boolean {
  return typeof raw === "string" && ALLOWED_LOGIN_TYPES.has(raw);
}

// CODEF credentials 종합 검증
// 인증 방식별 필수 필드가 다름:
// - cert/finCert: password(인증서암호) + pfxFile(PFX 파일) — id 선택
// - kakao/pass 등 간편인증: 사용자 입력 id + password
// - id: id + password 필수
export function validateCredentials(
  credentials: unknown,
): asserts credentials is { loginType: string; id: string; password: string; pfxFile?: string } {
  if (!credentials || typeof credentials !== "object") {
    throw new ValidationError("credentials 객체가 필요합니다");
  }
  const c = credentials as Record<string, unknown>;
  const loginType = String(c.loginType ?? "");
  if (!isValidLoginType(loginType)) {
    throw new ValidationError(`허용되지 않은 loginType 입니다: "${loginType}"`);
  }
  if (!isValidLoginId(String(c.id ?? ""))) {
    throw new ValidationError("유효하지 않은 로그인 ID 형식입니다 (제어문자 포함 또는 50자 초과)");
  }
  if (!isValidPassword(String(c.password ?? ""))) {
    throw new ValidationError("유효하지 않은 비밀번호 형식입니다");
  }
  if (c.pfxFile !== undefined && typeof c.pfxFile !== "string") {
    throw new ValidationError("pfxFile은 문자열이어야 합니다");
  }
  // pfxFile base64 크기 상한 (~1MB)
  if (typeof c.pfxFile === "string" && c.pfxFile.length > 1_500_000) {
    throw new ValidationError("pfxFile 크기가 너무 큽니다");
  }
  // 공동인증서 방식(cert/finCert)은 pfxFile 필수
  const isCertAuth = loginType === "cert" || loginType === "finCert" || loginType === "CERT" || loginType === "FINCERT";
  if (isCertAuth && !c.pfxFile) {
    throw new ValidationError("공동인증서 방식은 pfxFile이 필요합니다");
  }
  // ID/PW 방식은 id 필수
  if ((loginType === "id" || loginType === "ID") && !String(c.id ?? "").trim()) {
    throw new ValidationError("ID/PW 방식은 로그인 ID가 필요합니다");
  }
}

export function validateBanks(banks: unknown): asserts banks is string[] | undefined {
  if (banks === undefined) return;
  if (!Array.isArray(banks)) {
    throw new ValidationError("banks는 배열이어야 합니다");
  }
  if (banks.length > 30) {
    throw new ValidationError("선택 가능한 기관 수를 초과했습니다 (최대 30)");
  }
  for (const b of banks) {
    if (!isValidBankName(String(b))) {
      throw new ValidationError(`유효하지 않은 기관명: ${String(b).slice(0, 20)}`);
    }
  }
}

export function validateTokenId(tokenId: unknown): asserts tokenId is string {
  if (typeof tokenId !== "string") {
    throw new ValidationError("tokenId가 필요합니다");
  }
  if (tokenId.length < 10 || tokenId.length > 100) {
    throw new ValidationError("유효하지 않은 tokenId 형식입니다");
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(tokenId)) {
    throw new ValidationError("tokenId에 허용되지 않은 문자가 포함되어 있습니다");
  }
}

export function validateConnectedId(connectedId: unknown): asserts connectedId is string {
  if (typeof connectedId !== "string" || connectedId.length < 10 || connectedId.length > 200) {
    throw new ValidationError("유효하지 않은 connectedId 입니다");
  }
}
