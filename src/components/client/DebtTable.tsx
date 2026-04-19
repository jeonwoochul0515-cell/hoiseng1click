import { formatKRW } from '@/utils/formatter';
import { calcSeparateSecurityAmount, calcDeficiencyAmount, checkStatuteOfLimitations } from '@/utils/calculator';
import type { Debt } from '@/types/client';

interface DebtTableProps {
  debts: Debt[];
}

export function DebtTable({ debts }: DebtTableProps) {
  const totalAmount = debts.reduce((s, d) => s + d.amount, 0);
  const totalMonthly = debts.reduce((s, d) => s + d.monthly, 0);
  const hasSecured = debts.some((d) => d.type === '담보');

  // 담보채권 별제권/부족액 계산 헬퍼
  function getSecuredAmounts(debt: Debt) {
    if (debt.type !== '담보' || !debt.collateralValue) {
      return { separateSecurity: 0, deficiency: debt.amount };
    }
    const separateSecurity = debt.separateSecurityAmount
      ?? calcSeparateSecurityAmount(debt.amount, debt.collateralValue, debt.seniorLien ?? 0);
    const deficiency = debt.deficiencyAmount
      ?? calcDeficiencyAmount(debt.amount, separateSecurity);
    return { separateSecurity, deficiency };
  }

  // 소멸시효 확인 헬퍼
  function getStatuteStatus(debt: Debt) {
    const debtCategory = debt.debtCategory ?? (
      debt.type === '사채' ? '사채' :
      debt.type === '담보' ? '일반채권' :
      '상사채권'
    );
    const lastPayment = debt.lastPaymentDate ? new Date(debt.lastPaymentDate) : null;
    const acceleration = debt.accelerationDate ? new Date(debt.accelerationDate) : null;
    return checkStatuteOfLimitations(debtCategory, lastPayment, acceleration);
  }

  if (debts.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-gray-200 py-12">
        <p className="text-sm text-gray-600">등록된 채무가 없습니다</p>
      </div>
    );
  }

  // 별제권 합계
  const totalSeparateSecurity = debts
    .filter((d) => d.type === '담보')
    .reduce((s, d) => s + getSecuredAmounts(d).separateSecurity, 0);
  const totalDeficiency = debts
    .filter((d) => d.type === '담보')
    .reduce((s, d) => s + getSecuredAmounts(d).deficiency, 0);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
            <th className="px-4 py-3 text-center">No</th>
            <th className="px-4 py-3">채무명</th>
            <th className="px-4 py-3">채권자</th>
            <th className="px-4 py-3">유형</th>
            <th className="px-4 py-3 text-right">원금</th>
            <th className="px-4 py-3 text-right">금리</th>
            <th className="px-4 py-3 text-right">월상환</th>
            {hasSecured && (
              <>
                <th className="px-4 py-3 text-right">별제권액</th>
                <th className="px-4 py-3 text-right">부족액(일반채권)</th>
              </>
            )}
            <th className="px-4 py-3 text-center">출처</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {debts.map((debt, i) => {
            const secured = getSecuredAmounts(debt);
            const statute = getStatuteStatus(debt);
            return (
              <>
                <tr key={debt.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-center text-gray-600">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {debt.name}
                    {debt.isNonDischargeable && (
                      <span className="ml-1.5 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        비면책
                      </span>
                    )}
                    {debt.isGuarantee && (
                      <span className="ml-1.5 inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
                        {debt.guaranteeType ?? '보증'}
                      </span>
                    )}
                    {!!debt.transferredFrom && (
                      <span className="ml-1.5 inline-flex rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-700">
                        양도
                      </span>
                    )}
                    {debt.hasSubrogation && (
                      <span className="ml-1.5 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        대위변제
                      </span>
                    )}
                    {debt.isSubrogationClaim && (
                      <span className="ml-1.5 inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                        구상채권
                      </span>
                    )}
                    {statute.expired && (
                      <span className="ml-1.5 inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800">
                        {'\u26A0\uFE0F'} 소멸시효 완성 가능
                      </span>
                    )}
                    {!statute.expired && statute.remainingDays !== Infinity && statute.remainingDays <= 180 && (
                      <span className="ml-1.5 inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
                        시효 {statute.remainingDays}일 남음
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{debt.creditor}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      debt.type === '담보' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {debt.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{formatKRW(debt.amount)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{debt.rate}%</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{formatKRW(debt.monthly)}</td>
                  {hasSecured && (
                    <>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">
                        {debt.type === '담보' ? formatKRW(secured.separateSecurity) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">
                        {debt.type === '담보' ? formatKRW(secured.deficiency) : '-'}
                      </td>
                    </>
                  )}
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      debt.source === 'codef' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {debt.source === 'codef' ? 'CODEF' : '수동'}
                    </span>
                  </td>
                </tr>
                {/* 담보 상세 정보 행 */}
                {debt.type === '담보' && debt.collateralValue != null && (
                  <tr key={`${debt.id}-detail`} className="bg-amber-50/50">
                    <td className="px-4 py-2" />
                    <td className="px-4 py-2 text-xs text-gray-500" colSpan={hasSecured ? 9 : 7}>
                      <span className="mr-4">담보물: {debt.collateralType ?? '기타'}</span>
                      {debt.collateralDesc && <span className="mr-4">({debt.collateralDesc})</span>}
                      <span className="mr-4">시가: {formatKRW(debt.collateralValue)}</span>
                      {(debt.seniorLien ?? 0) > 0 && <span>선순위: {formatKRW(debt.seniorLien!)}</span>}
                    </td>
                  </tr>
                )}
                {/* 대위변제 상세 정보 행 */}
                {debt.hasSubrogation && (debt.subrogationAmount ?? 0) > 0 && (
                  <tr key={`${debt.id}-subrogation`} className="bg-emerald-50/50">
                    <td className="px-4 py-2" />
                    <td className="px-4 py-2 text-xs text-emerald-700" colSpan={hasSecured ? 9 : 7}>
                      <span className="mr-4">대위변제: {formatKRW(debt.subrogationAmount!)}</span>
                      {debt.subrogationCreditor && <span className="mr-4">(대위변제자: {debt.subrogationCreditor})</span>}
                      {debt.subrogationDate && <span className="mr-4">{debt.subrogationDate}</span>}
                      <span className="font-medium">잔여 원채권: {formatKRW(Math.max(0, debt.amount - (debt.subrogationAmount ?? 0)))}</span>
                    </td>
                  </tr>
                )}
                {/* 구상채권 상세 정보 행 */}
                {debt.isSubrogationClaim && (
                  <tr key={`${debt.id}-claim`} className="bg-orange-50/50">
                    <td className="px-4 py-2" />
                    <td className="px-4 py-2 text-xs text-orange-700" colSpan={hasSecured ? 9 : 7}>
                      <span className="mr-4">구상채권</span>
                      {debt.originalCreditor && <span className="mr-4">(원채권자: {debt.originalCreditor})</span>}
                      {(debt.originalDebtAmount ?? 0) > 0 && <span>원 채무 금액: {formatKRW(debt.originalDebtAmount!)}</span>}
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
            <td className="px-4 py-3" colSpan={4}>합계</td>
            <td className="px-4 py-3 text-right font-mono text-blue-700">{formatKRW(totalAmount)}</td>
            <td className="px-4 py-3" />
            <td className="px-4 py-3 text-right font-mono text-blue-700">{formatKRW(totalMonthly)}</td>
            {hasSecured && (
              <>
                <td className="px-4 py-3 text-right font-mono text-amber-700">{formatKRW(totalSeparateSecurity)}</td>
                <td className="px-4 py-3 text-right font-mono text-red-700">{formatKRW(totalDeficiency)}</td>
              </>
            )}
            <td className="px-4 py-3" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
