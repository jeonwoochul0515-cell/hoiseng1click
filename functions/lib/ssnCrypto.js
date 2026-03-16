"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptSSN = encryptSSN;
exports.decryptSSN = decryptSSN;
exports.isPlainSSN = isPlainSSN;
exports.maskSSN = maskSSN;
/**
 * SSN (주민등록번호) 암호화/복호화 모듈
 * AES-256-GCM 방식 사용 — 개인정보보호법(PIPA) 준수
 *
 * 암호화 키는 Cloud Functions 환경변수 SSN_ENCRYPTION_KEY에 설정.
 * 저장 형식: base64( iv(12B) + authTag(16B) + ciphertext )
 */
const crypto = __importStar(require("crypto"));
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
function getKey() {
    const raw = process.env.SSN_ENCRYPTION_KEY;
    if (!raw) {
        throw new Error("SSN_ENCRYPTION_KEY 환경변수가 설정되지 않았습니다.");
    }
    // SHA-256 해시하여 항상 32바이트 키 생성
    return crypto.createHash("sha256").update(raw).digest();
}
/** 평문 주민등록번호 → 암호화 문자열 (base64) */
function encryptSSN(plaintext) {
    if (!plaintext)
        return "";
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    // iv + tag + ciphertext → base64
    return Buffer.concat([iv, tag, encrypted]).toString("base64");
}
/** 암호화 문자열 (base64) → 복호화된 주민등록번호 */
function decryptSSN(ciphertext) {
    if (!ciphertext)
        return "";
    const key = getKey();
    const data = Buffer.from(ciphertext, "base64");
    if (data.length < IV_LENGTH + TAG_LENGTH) {
        // 암호화되지 않은 레거시 데이터 (평문) — 그대로 반환
        return ciphertext;
    }
    try {
        const iv = data.subarray(0, IV_LENGTH);
        const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
        const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(tag);
        return decipher.update(encrypted, undefined, "utf8") + decipher.final("utf8");
    }
    catch {
        // 복호화 실패 시 레거시 평문으로 간주
        return ciphertext;
    }
}
/** 주민등록번호인지 간단 검증 (암호화 전 형식 체크) */
function isPlainSSN(value) {
    const cleaned = value.replace(/\D/g, "");
    return /^\d{13}$/.test(cleaned);
}
/** 마스킹: 900101-1234567 → 900101-******* */
function maskSSN(ssn) {
    const cleaned = ssn.replace(/\D/g, "");
    if (cleaned.length >= 7) {
        return `${cleaned.slice(0, 6)}-*******`;
    }
    return ssn;
}
//# sourceMappingURL=ssnCrypto.js.map