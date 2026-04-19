/**
 * 전자소송(ecfs.scourt.go.kr) 개인회생 채권자목록 / 재산목록 CSV 생성 유틸리티
 *
 * - BOM(\uFEFF) 추가로 한글 깨짐 방지
 * - 금액은 콤마 없이 숫자만
 * - 날짜는 YYYY-MM-DD
 * - 쉼표 포함 필드는 큰따옴표로 감싸기
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

// ─── 채권자목록 CSV ─────────────────────────────

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
