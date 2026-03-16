/** CODEF 금융기관 코드 매핑 */

export interface OrgInfo {
  code: string;
  name: string;
  businessType: 'BK' | 'CD' | 'IN' | 'SE';
  category: '은행' | '카드' | '보험' | '저축은행' | '증권';
}

export const ORG_MAP: Record<string, OrgInfo> = {
  // 은행
  '국민은행':   { code: '0004', name: '국민은행',   businessType: 'BK', category: '은행' },
  '신한은행':   { code: '0088', name: '신한은행',   businessType: 'BK', category: '은행' },
  '우리은행':   { code: '0020', name: '우리은행',   businessType: 'BK', category: '은행' },
  '하나은행':   { code: '0081', name: '하나은행',   businessType: 'BK', category: '은행' },
  '농협':       { code: '0011', name: '농협은행',   businessType: 'BK', category: '은행' },
  'IBK기업은행': { code: '0003', name: 'IBK기업은행', businessType: 'BK', category: '은행' },
  'SC제일은행': { code: '0023', name: 'SC제일은행', businessType: 'BK', category: '은행' },
  '카카오뱅크': { code: '0090', name: '카카오뱅크', businessType: 'BK', category: '은행' },
  '토스뱅크':   { code: '0092', name: '토스뱅크',   businessType: 'BK', category: '은행' },
  '케이뱅크':   { code: '0089', name: '케이뱅크',   businessType: 'BK', category: '은행' },
  '수협은행':   { code: '0007', name: '수협은행',   businessType: 'BK', category: '은행' },

  // 카드
  '삼성카드':   { code: '0303', name: '삼성카드',   businessType: 'CD', category: '카드' },
  '현대카드':   { code: '0302', name: '현대카드',   businessType: 'CD', category: '카드' },
  '롯데카드':   { code: '0311', name: '롯데카드',   businessType: 'CD', category: '카드' },
  'BC카드':     { code: '0361', name: 'BC카드',     businessType: 'CD', category: '카드' },
  'KB국민카드': { code: '0301', name: 'KB국민카드', businessType: 'CD', category: '카드' },
  '신한카드':   { code: '0306', name: '신한카드',   businessType: 'CD', category: '카드' },
  '우리카드':   { code: '0309', name: '우리카드',   businessType: 'CD', category: '카드' },
  '하나카드':   { code: '0313', name: '하나카드',   businessType: 'CD', category: '카드' },
  'NH카드':     { code: '0304', name: 'NH카드',     businessType: 'CD', category: '카드' },

  // 보험
  '삼성생명':   { code: '0032', name: '삼성생명',   businessType: 'IN', category: '보험' },
  '한화생명':   { code: '0050', name: '한화생명',   businessType: 'IN', category: '보험' },
  '교보생명':   { code: '0033', name: '교보생명',   businessType: 'IN', category: '보험' },
  '삼성화재':   { code: '0058', name: '삼성화재',   businessType: 'IN', category: '보험' },
  '현대해상':   { code: '0059', name: '현대해상',   businessType: 'IN', category: '보험' },
  'DB손해보험': { code: '0060', name: 'DB손해보험', businessType: 'IN', category: '보험' },

  // 저축은행
  'OK저축은행':  { code: '0105', name: 'OK저축은행',  businessType: 'BK', category: '저축은행' },
  'SBI저축은행': { code: '0101', name: 'SBI저축은행', businessType: 'BK', category: '저축은행' },
  '웰컴저축은행': { code: '0102', name: '웰컴저축은행', businessType: 'BK', category: '저축은행' },
};

/** 카테고리별로 그룹핑 */
export function getOrgsByCategory() {
  const grouped: Record<string, OrgInfo[]> = {};
  for (const info of Object.values(ORG_MAP)) {
    if (!grouped[info.category]) grouped[info.category] = [];
    grouped[info.category].push(info);
  }
  return grouped;
}

/** 한글 이름 → CODEF organization 코드 */
export function getOrgCode(name: string): string | undefined {
  return ORG_MAP[name]?.code;
}

/** 한글 이름 → businessType */
export function getBusinessType(name: string): string | undefined {
  return ORG_MAP[name]?.businessType;
}
