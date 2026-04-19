/**
 * 전자소송(ecfs.scourt.go.kr) 개인회생 채권자기본정보 / 재산목록 CSV 생성 유틸리티
 *
 * - BOM(\uFEFF) 추가로 한글 깨짐 방지
 * - 금액은 콤마 없이 숫자만
 * - 날짜는 YYYY-MM-DD
 * - 쉼표 포함 필드는 큰따옴표로 감싸기
 *
 * [정식 스펙] 전자소송_채권자기본정보_개인회생_견본파일.xls 기준 (13컬럼):
 *   체크(F) · 구분 · 채권자목록번호 · 구분번호 · 채권자명 · 인격구분 ·
 *   도로명주소1 · 도로명주소2 · 우편번호 · 휴대전화번호 · 전화번호 · 팩스번호 · 이메일
 */
import type { Debt, Asset } from '@/types/client';
import { findCreditor } from '@/utils/creditorDirectory';
import { calcSeparateSecurityAmount, calcDeficiencyAmount } from '@/utils/calculator';

// ─── 내부 헬퍼 ──────────────────────────────────

/** CSV 셀 값을 이스케이프 (쉼표, 큰따옴표, 줄바꿈 포함 시 큰따옴표로 감싸기) */
function escapeCell(value: string | number | undefined | null): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** 행 배열을 CSV 행 문자열로 변환 */
function toCsvRow(cells: (string | number | undefined | null)[]): string {
  return cells.map(escapeCell).join(',');
}

// ───────────────────────────────────────────────────────────────
// 전자소송 정식 "채권자기본정보" CSV (공식 양식 13컬럼 · 일괄등록용)
// 견본파일: 전자소송_채권자기본정보_개인회생_견본파일.xls
// ───────────────────────────────────────────────────────────────

export const CREDITOR_BASIC_INFO_HEADER = [
  '체크(기본값 F)',
  '구분',
  '채권자목록번호',
  '구분번호',
  '채권자명',
  '인격구분',
  '도로명주소1(도로명 건물번호까지)',
  '도로명주소2(상세주소)',
  '우편번호',
  '휴대전화번호',
  '전화번호',
  '팩스번호',
  '이메일',
] as const;

export type PersonalityType =
  | '자연인'
  | '법인'
  | '권리능력없는법인(비법인)'
  | '국가'
  | '지방자치단체';

export interface CreditorBasicInfoRow {
  check: 'F';
  kind: '채권자' | '보증인(대위변제자)';
  listNumber: number;           // 채권자목록번호 (숫자)
  subNumber?: number | '';      // 구분번호 (보증인 추가 시에만)
  creditorName: string;
  personalityType: PersonalityType;
  roadAddress1: string;
  roadAddress2: string;
  zipCode: string;              // 5자리
  mobile?: string;
  phone?: string;
  fax?: string;
  email?: string;
}

/** 채권자명에서 인격구분 자동 추정 */
export function inferPersonalityType(name: string): PersonalityType {
  if (!name) return '자연인';
  const t = name.trim();
  // 국가기관
  if (/대한민국|국세청|법무부|관세청|고용노동부|보건복지부/.test(t)) return '국가';
  // 지자체
  if (/특별시|광역시|(\S+)시청|(\S+)구청|(\S+)군청/.test(t)) return '지방자치단체';
  // 법인 키워드
  if (/주식회사|\(주\)|㈜|유한회사|\(유\)|협회|재단|조합|공사|공단|은행|카드|보험|증권|캐피탈|저축|사협|신협|농협|수협/.test(t)) return '법인';
  // 비법인 (교회, 학교, 사설단체 등)
  if (/교회|사찰|학교|법인이 아닌|비법인/.test(t)) return '권리능력없는법인(비법인)';
  return '자연인';
}

/** 도로명주소 문자열을 기본주소+상세주소로 분리 추정 */
export function splitRoadAddress(address: string): { addr1: string; addr2: string } {
  if (!address) return { addr1: '', addr2: '' };
  // 괄호(...) 앞까지를 기본주소, 괄호 및 이후를 상세주소로 분리
  const match = address.match(/^(.+?)\s*[(（]?(\d+동\s*\d+호|.+층|.+호)?\s*[(（](.+)$/);
  if (match) {
    const base = match[1].trim();
    const detail = `${match[2] ?? ''}${match[3] ? `(${match[3]}` : ''}`.trim();
    if (base && detail) return { addr1: base, addr2: detail };
  }
  // 간단 분리: 건물번호까지 + 나머지
  const parts = address.split(/\s+/);
  if (parts.length > 3) {
    const addr1 = parts.slice(0, 3).join(' ');
    const addr2 = parts.slice(3).join(' ');
    return { addr1, addr2 };
  }
  return { addr1: address, addr2: '' };
}

/** 우편번호 형식 정규화 (5자리) */
export function normalizeZipCode(zip: string | undefined): string {
  if (!zip) return '';
  const digits = String(zip).replace(/\D/g, '');
  return digits.length === 5 ? digits : '';
}

/**
 * 전화번호 정규화 (전자소송 양식 호환)
 *
 * 전자소송은 휴대전화(01X-XXXX-XXXX) 또는 지역번호(0XX-XXX(X)-XXXX)만 허용.
 * 전국대표번호(1588/1577/1566/1599/1661 등 8자리)와 특수번호(126 등)는 거부됨.
 *
 * @returns 허용 포맷이면 하이픈 정규화 문자열, 거부 포맷이면 빈 문자열
 */
export function normalizePhone(phone: string | undefined): string {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';

  // 전자소송 거부: 전국대표번호 (15XX-XXXX / 16XX-XXXX / 18XX-XXXX, 8자리)
  if (/^1[5-8]\d{2}\d{4}$/.test(digits)) return '';
  // 전자소송 거부: 특수번호 (110, 126, 131 등 짧은 번호)
  if (digits.length < 9) return '';

  // 휴대전화 (010/011/016/017/018/019 + 7~8자리)
  if (/^01[016789]\d{7,8}$/.test(digits)) {
    return digits.length === 11
      ? `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
      : `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  // 서울 지역번호 02 (9~10자리)
  if (/^02\d{7,8}$/.test(digits)) {
    return digits.length === 10
      ? `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`
      : `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
  }
  // 기타 지역번호 0XX (10~11자리)
  if (/^0[3-6]\d\d{7,8}$/.test(digits)) {
    return digits.length === 11
      ? `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
      : `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  // 070 인터넷전화
  if (/^070\d{7,8}$/.test(digits)) {
    return digits.length === 11
      ? `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
      : `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // 기타(외국 번호 등) → 전자소송 비호환으로 판단하여 제거
  return '';
}

/** Debt 리스트를 전자소송 채권자기본정보 행으로 변환 */
export function buildCreditorBasicInfoRows(debts: Debt[]): CreditorBasicInfoRow[] {
  const rows: CreditorBasicInfoRow[] = [];
  debts.forEach((debt, idx) => {
    if (!debt.creditor) return;
    const info = findCreditor(debt.creditor) as (ReturnType<typeof findCreditor> & { zipCode?: string; email?: string }) | null;
    const listNumber = idx + 1;

    // 주소 분리
    const rawAddr = debt.creditorAddress || info?.address || '';
    const { addr1, addr2 } = splitRoadAddress(rawAddr);

    // 메인 채권자 행
    rows.push({
      check: 'F',
      kind: '채권자',
      listNumber,
      subNumber: '',
      creditorName: debt.creditor,
      personalityType: inferPersonalityType(debt.creditor),
      roadAddress1: addr1,
      roadAddress2: addr2,
      zipCode: normalizeZipCode(info?.zipCode),
      mobile: '',
      phone: normalizePhone(debt.creditorPhone || info?.phone),
      fax: normalizePhone(debt.creditorFax || info?.fax),
      email: info?.email ?? '',
    });

    // 보증인/대위변제자 행 추가
    // 보증채무: 주채무자가 보증인 역할 → 주채무자를 보증인(대위변제자)로 추가
    // 대위변제: subrogationCreditor가 대위변제한 채권자 → 보증인(대위변제자)로 추가
    let subNumber = 1;
    if (debt.isGuarantee && debt.primaryDebtor) {
      rows.push({
        check: 'F',
        kind: '보증인(대위변제자)',
        listNumber,
        subNumber: subNumber++,
        creditorName: debt.primaryDebtor,
        personalityType: '자연인',
        roadAddress1: '',
        roadAddress2: '',
        zipCode: '',
        mobile: '',
        phone: '',
        fax: '',
        email: '',
      });
    }
    if (debt.hasSubrogation && debt.subrogationCreditor) {
      rows.push({
        check: 'F',
        kind: '보증인(대위변제자)',
        listNumber,
        subNumber: subNumber++,
        creditorName: debt.subrogationCreditor,
        personalityType: inferPersonalityType(debt.subrogationCreditor),
        roadAddress1: '',
        roadAddress2: '',
        zipCode: '',
        mobile: '',
        phone: '',
        fax: '',
        email: '',
      });
    }
  });
  return rows;
}

/** 전자소송 정식 양식 채권자기본정보 CSV 생성 (일괄등록용) */
export function generateCreditorBasicInfoCsv(debts: Debt[]): { csv: string; warnings: string[] } {
  const warnings: string[] = [];
  const rows = buildCreditorBasicInfoRows(debts);

  if (rows.length > 5000) {
    warnings.push(`채권자 수가 ${rows.length}명으로 5,000명 상한을 초과했습니다.`);
  }

  // 필수 필드 검증
  rows.forEach((r, i) => {
    const missing: string[] = [];
    if (!r.creditorName) missing.push('채권자명');
    if (!r.personalityType) missing.push('인격구분');
    if (!r.roadAddress1) missing.push('도로명주소1');
    if (!r.zipCode) missing.push('우편번호');
    // 채권자명에 주민번호 포함 여부
    if (/\d{6}-?\d{7}/.test(r.creditorName)) {
      warnings.push(`#${i + 1} "${r.creditorName}" 채권자명에 주민번호 형식이 포함되어 있습니다.`);
    }
    // 전화번호가 원본에는 있었으나 정규화 후 빈값이면(=전국대표번호/특수번호) 안내
    // 단, 이미 normalizePhone에서 걸러진 후라 여기서는 최종 필드만 검증
    if (missing.length > 0) {
      warnings.push(`#${i + 1} "${r.creditorName || '(이름 없음)'}" — 누락: ${missing.join(', ')}`);
    }
  });

  const csvRows: string[] = [toCsvRow([...CREDITOR_BASIC_INFO_HEADER])];
  rows.forEach((r) => {
    csvRows.push(toCsvRow([
      r.check,
      r.kind,
      r.listNumber,
      r.subNumber ?? '',
      r.creditorName,
      r.personalityType,
      r.roadAddress1,
      r.roadAddress2,
      r.zipCode,
      r.mobile ?? '',
      r.phone ?? '',
      r.fax ?? '',
      r.email ?? '',
    ]));
  });

  return { csv: csvRows.join('\r\n'), warnings };
}

// ─── 채권자목록 CSV (기존 내부용 — 회계 상세) ─────────────────────

const CREDITOR_HEADER = [
  '번호',
  '채권자명',
  '대표자',
  '주소',
  '우편번호',
  '전화번호',
  '팩스번호',
  '채권원인',
  '채권발생일',
  '원금',
  '이자',
  '지연손해금',
  '합계',
  '담보유무',
  '담보목적물',
  '별제권행사예상액',
  '부족액',
  '비고',
];

/**
 * 채권자목록 CSV 문자열을 생성한다.
 * 전자소송 "회생 채권자 목록 일괄입력" 양식에 대응하는 형식.
 */
export function generateCreditorCsv(debts: Debt[]): string {
  const rows: string[] = [toCsvRow(CREDITOR_HEADER)];

  debts.forEach((debt, idx) => {
    const info = findCreditor(debt.creditor);
    const interest = debt.overdueInterest ?? 0;
    const originalAmount = debt.originalAmount ?? debt.amount;
    // 이자 추정: (원금 × 이자율 / 100) — 별도 필드가 없으면 연이자 기준 산출
    const estimatedInterest = interest > 0
      ? interest
      : Math.round(originalAmount * (debt.rate / 100));
    const total = originalAmount + estimatedInterest;

    const debtCause = debt.type === '담보'
      ? `담보대출(${debt.name})`
      : debt.type === '사채'
        ? `사채(${debt.name})`
        : debt.name || '대출';

    // 별제권 계산
    let separateSecurity = 0;
    let deficiency = 0;
    if (debt.type === '담보' && debt.collateralValue) {
      separateSecurity = debt.separateSecurityAmount
        ?? calcSeparateSecurityAmount(debt.amount, debt.collateralValue, debt.seniorLien ?? 0);
      deficiency = debt.deficiencyAmount
        ?? calcDeficiencyAmount(debt.amount, separateSecurity);
    }

    // 담보목적물 설명 구성
    const collateralInfo = debt.type === '담보'
      ? (debt.collateralDesc || debt.collateral || (debt.collateralType ? `${debt.collateralType}` : ''))
      : '';

    rows.push(toCsvRow([
      idx + 1,                                        // 번호
      debt.creditor,                                   // 채권자명
      '',                                              // 대표자
      debt.creditorAddress || info?.address || '',      // 주소
      '',                                              // 우편번호
      debt.creditorPhone || info?.phone || '',          // 전화번호
      debt.creditorFax || info?.fax || '',              // 팩스번호
      debtCause,                                       // 채권원인
      debt.originalDate || '',                         // 채권발생일
      originalAmount,                                  // 원금
      estimatedInterest,                               // 이자
      0,                                               // 지연손해금
      total,                                           // 합계
      debt.type === '담보' ? '유' : '무',              // 담보유무
      collateralInfo,                                  // 담보목적물
      debt.type === '담보' ? separateSecurity : '',    // 별제권행사예상액
      debt.type === '담보' ? deficiency : '',          // 부족액
      debt.transferredFrom                             // 비고
        ? `양도: ${debt.transferredFrom}${debt.transferDate ? ` (${debt.transferDate})` : ''}`
        : '',
    ]));
  });

  return rows.join('\r\n');
}

// ─── 재산목록 CSV ───────────────────────────────

const ASSET_HEADER = [
  '번호',
  '재산유형',
  '재산명칭',
  '상세정보',
  '평가액(시가)',
  '청산비율(%)',
  '담보권액',
  '청산가치',
  '비고',
];

/**
 * 재산목록 CSV 문자열을 생성한다.
 */
export function generateAssetCsv(assets: Asset[]): string {
  const rows: string[] = [toCsvRow(ASSET_HEADER)];

  assets.forEach((asset, idx) => {
    // 상세정보: 메타 데이터에서 관련 정보 추출
    const details: string[] = [];
    if (asset.meta?.address) details.push(asset.meta.address);
    if (asset.meta?.plate) details.push(`차량번호: ${asset.meta.plate}`);
    if (asset.meta?.model) details.push(asset.meta.model);
    if (asset.meta?.year) details.push(`${asset.meta.year}년식`);
    if (asset.meta?.bankName) details.push(asset.meta.bankName);
    if (asset.meta?.accountLast4) details.push(`끝 ${asset.meta.accountLast4}`);
    if (asset.meta?.insurerName) details.push(asset.meta.insurerName);
    if (asset.meta?.stockName) details.push(asset.meta.stockName);

    rows.push(toCsvRow([
      idx + 1,                                         // 번호
      asset.type,                                      // 재산유형
      asset.name,                                      // 재산명칭
      details.join(' / ') || '',                       // 상세정보
      asset.rawValue,                                  // 평가액(시가)
      Math.round(asset.liquidationRate * 100),         // 청산비율(%)
      asset.mortgage,                                  // 담보권액
      asset.value,                                     // 청산가치
      asset.meta?.valuationBasis || '',                // 비고
    ]));
  });

  return rows.join('\r\n');
}

// ─── CSV 다운로드 헬퍼 ──────────────────────────

/**
 * CSV 문자열을 브라우저에서 파일로 다운로드한다.
 * BOM을 앞에 추가하여 Excel에서 한글이 깨지지 않도록 한다.
 */
export function downloadCsv(content: string, filename: string): void {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
