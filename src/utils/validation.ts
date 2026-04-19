/** 폼 입력값 검증 유틸리티 */

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/** 주민등록번호 체크섬 검증 */
export function isValidSSNChecksum(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 13) return false;
  const month = parseInt(digits.substring(2, 4), 10);
  const day = parseInt(digits.substring(4, 6), 10);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const weights = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i], 10) * weights[i];
  const check = (11 - (sum % 11)) % 10;
  return check === parseInt(digits[12], 10);
}

/** 전화번호 — 010/011/016/017/018/019 또는 지역번호 */
export function isValidKoreanPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  if (/^01[016789]\d{7,8}$/.test(digits)) return true;
  if (/^02\d{7,8}$/.test(digits)) return true;
  if (/^0[3-6]\d\d{6,8}$/.test(digits)) return true;
  return false;
}

export function validateClient(data: {
  name?: string;
  phone?: string;
  ssn?: string;
  family?: number;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.name?.trim()) errors.name = '이름을 입력해주세요.';
  if (!data.phone?.trim()) {
    errors.phone = '연락처를 입력해주세요.';
  } else if (!isValidKoreanPhone(data.phone)) {
    errors.phone = '올바른 전화번호를 입력해주세요. (예: 010-1234-5678)';
  }
  if (data.ssn) {
    const normalized = data.ssn.replace(/\s/g, '');
    if (!/^\d{6}-?\d{7}$/.test(normalized)) {
      errors.ssn = '주민등록번호 형식이 올바르지 않습니다. (000000-0000000)';
    } else if (!isValidSSNChecksum(normalized)) {
      errors.ssn = '주민등록번호 체크섬이 맞지 않습니다. 다시 확인해주세요.';
    }
  }
  if (data.family != null && data.family < 1) {
    errors.family = '가구원 수는 1명 이상이어야 합니다.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateDebt(debt: {
  creditor?: string;
  amount?: number;
}): ValidationResult {
  const errors: Record<string, string> = {};
  if (!debt.creditor?.trim()) errors.creditor = '채권자명을 입력해주세요.';
  if (debt.amount != null && debt.amount < 0) errors.amount = '금액은 0 이상이어야 합니다.';
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateAsset(asset: {
  name?: string;
  rawValue?: number;
}): ValidationResult {
  const errors: Record<string, string> = {};
  if (!asset.name?.trim()) errors.name = '재산명을 입력해주세요.';
  if (asset.rawValue != null && asset.rawValue < 0) errors.rawValue = '평가액은 0 이상이어야 합니다.';
  return { valid: Object.keys(errors).length === 0, errors };
}
