/** 폼 입력값 검증 유틸리티 */

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
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
  } else if (data.phone.replace(/\D/g, '').length < 10) {
    errors.phone = '올바른 전화번호를 입력해주세요.';
  }
  if (data.ssn && !/^\d{6}-?\d{7}$/.test(data.ssn.replace(/\s/g, ''))) {
    errors.ssn = '주민등록번호 형식이 올바르지 않습니다. (000000-0000000)';
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
