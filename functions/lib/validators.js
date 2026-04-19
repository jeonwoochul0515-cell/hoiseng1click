"use strict";
// 입력 검증 유틸 — CODEF 프록시 및 인테이크 엔드포인트에서 공용 사용
// 허용된 은행/증권사/보험사 목록은 codefProxy.ts의 ORG_MAP에서 동적으로 검증
// (순환 참조 방지 위해 이 파일은 단순 원시 검증만 담당)
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError = void 0;
exports.isValidSSN = isValidSSN;
exports.isValidPhone = isValidPhone;
exports.isValidName = isValidName;
exports.isValidLoginId = isValidLoginId;
exports.isValidPassword = isValidPassword;
exports.isValidBankName = isValidBankName;
exports.isValidLoginType = isValidLoginType;
exports.validateCredentials = validateCredentials;
exports.validateBanks = validateBanks;
exports.validateTokenId = validateTokenId;
exports.validateConnectedId = validateConnectedId;
class ValidationError extends Error {
    statusCode = 400;
    constructor(message) {
        super(message);
        this.name = "ValidationError";
    }
}
exports.ValidationError = ValidationError;
// 주민등록번호 형식 + 체크섬 검증
// 포맷: 6자리-7자리 또는 13자리 연속
function isValidSSN(raw) {
    if (typeof raw !== "string")
        return false;
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 13)
        return false;
    // 월/일 유효성
    const month = parseInt(digits.substring(2, 4), 10);
    const day = parseInt(digits.substring(4, 6), 10);
    if (month < 1 || month > 12)
        return false;
    if (day < 1 || day > 31)
        return false;
    // 성별코드
    const g = parseInt(digits[6], 10);
    if (g < 0 || g > 9)
        return false;
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
function isValidPhone(raw) {
    if (typeof raw !== "string")
        return false;
    const digits = raw.replace(/\D/g, "");
    // 휴대폰: 010/011/016/017/018/019 + 8자리
    if (/^01[016789]\d{7,8}$/.test(digits))
        return true;
    // 서울 02 + 7~8자리
    if (/^02\d{7,8}$/.test(digits))
        return true;
    // 기타 지역번호 0XX + 7~8자리
    if (/^0[3-6]\d\d{7,8}$/.test(digits))
        return true;
    return false;
}
// 이름 — 한글/영문/공백 2~40자
function isValidName(raw) {
    if (typeof raw !== "string")
        return false;
    const trimmed = raw.trim();
    if (trimmed.length < 2 || trimmed.length > 40)
        return false;
    return /^[가-힣a-zA-Z\s]+$/.test(trimmed);
}
// CODEF 로그인 ID — 20자 이하 영숫자/일부 특수문자
function isValidLoginId(raw) {
    if (typeof raw !== "string")
        return false;
    if (raw.length < 1 || raw.length > 50)
        return false;
    // 제어문자 금지
    return !/[\x00-\x1f\x7f]/.test(raw);
}
// CODEF 비밀번호 — 길이만 검증 (내용은 RSA 암호화 대상)
function isValidPassword(raw) {
    if (typeof raw !== "string")
        return false;
    return raw.length >= 1 && raw.length <= 200;
}
// 은행/기관명 — 한글/영문/괄호/공백 2~30자
function isValidBankName(raw) {
    if (typeof raw !== "string")
        return false;
    const trimmed = raw.trim();
    if (trimmed.length < 2 || trimmed.length > 30)
        return false;
    return /^[가-힣a-zA-Z0-9()\s·]+$/.test(trimmed);
}
// loginType — 화이트리스트
const ALLOWED_LOGIN_TYPES = new Set([
    "SIMPLE", "CERT", "ID", "simple", "cert", "id",
    "KAKAO", "NAVER", "PASS", "PAYCO", "SAMSUNG", "KB", "SHINHAN", "TOSS",
]);
function isValidLoginType(raw) {
    return typeof raw === "string" && ALLOWED_LOGIN_TYPES.has(raw);
}
// CODEF credentials 종합 검증
function validateCredentials(credentials) {
    if (!credentials || typeof credentials !== "object") {
        throw new ValidationError("credentials 객체가 필요합니다");
    }
    const c = credentials;
    if (!isValidLoginType(String(c.loginType ?? ""))) {
        throw new ValidationError("허용되지 않은 loginType 입니다");
    }
    if (!isValidLoginId(String(c.id ?? ""))) {
        throw new ValidationError("유효하지 않은 로그인 ID 형식입니다");
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
}
function validateBanks(banks) {
    if (banks === undefined)
        return;
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
function validateTokenId(tokenId) {
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
function validateConnectedId(connectedId) {
    if (typeof connectedId !== "string" || connectedId.length < 10 || connectedId.length > 200) {
        throw new ValidationError("유효하지 않은 connectedId 입니다");
    }
}
//# sourceMappingURL=validators.js.map