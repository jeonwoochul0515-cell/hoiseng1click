import { useMemo, useState } from 'react';
import { useCollectionStore } from '@/store/collectionStore';
import { formatKRW } from '@/utils/formatter';
import { calcRepaymentPlan } from '@/utils/calculator';
import { useNavigate } from 'react-router-dom';
import { FileText, PlusCircle, AlertCircle, CheckCircle, XCircle, Info } from 'lucide-react';

interface ResultStepProps {
  clientId: string;
}

export default function ResultStep({ clientId }: ResultStepProps) {
  const { result } = useCollectionStore();
  const navigate = useNavigate();

  const [monthlyIncome, setMonthlyIncome] = useState<number>(0);
  const [familySize, setFamilySize] = useState<number>(1);

  const { debts = [], assets = [], summary } = result ?? {};

  // 변제계획안 자동 계산 (Hook은 조건부 return 앞에 배치)
  const repaymentPlan = useMemo(() => {
    if (!result || monthlyIncome <= 0) return null;
    return calcRepaymentPlan({
      monthlyIncome,
      familySize,
      debts: debts.map((d: any) => ({
        creditor: d.creditor,
        amount: d.amount,
        type: d.type,
      })),
      assets: assets.map((a: any) => ({
        type: a.type,
        rawValue: a.rawValue ?? a.value ?? 0,
        liquidationRate: a.liquidationRate ?? 100,
        mortgage: a.mortgage ?? 0,
      })),
    });
  }, [result, monthlyIncome, familySize, debts, assets]);

  if (!result) {
    return (
      <div className="mx-auto max-w-2xl text-center py-12 text-gray-500">
        수집 결과가 없습니다.
      </div>
    );
  }

  // 수집 현황 (신규 응답 포맷)
  const meta = result as any;
  const successOrgsList: string[] = meta.successOrgsList ?? [];
  const emptyDataOrgsList: string[] = meta.emptyDataOrgsList ?? [];
  const skippedOrgs: Array<{ organization: string; code: string; message: string }> = meta.skippedOrgs ?? [];
  const requestedOrgs = summary.requestedOrgs ?? (successOrgsList.length + skippedOrgs.length);
  const hasCollectionInfo = requestedOrgs > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* 🆕 수집 현황 알림 */}
      {hasCollectionInfo && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <Info size={16} className="text-blue-500" />
            <h3 className="text-sm font-semibold text-gray-900">수집 현황</h3>
          </div>
          <div className="grid grid-cols-4 divide-x divide-gray-100">
            <div className="p-3 text-center">
              <div className="text-xs text-gray-500">요청</div>
              <div className="text-lg font-bold text-gray-900">{requestedOrgs}</div>
            </div>
            <div className="p-3 text-center">
              <div className="text-xs text-gray-500">인증 성공</div>
              <div className="text-lg font-bold text-emerald-600">{successOrgsList.length}</div>
            </div>
            <div className="p-3 text-center">
              <div className="text-xs text-gray-500">데이터 수집</div>
              <div className="text-lg font-bold text-blue-600">{summary.dataOrgs ?? 0}</div>
            </div>
            <div className="p-3 text-center">
              <div className="text-xs text-gray-500">스킵</div>
              <div className="text-lg font-bold text-amber-600">{skippedOrgs.length}</div>
            </div>
          </div>

          {/* 상세 리스트 */}
          {(successOrgsList.length > 0 || emptyDataOrgsList.length > 0 || skippedOrgs.length > 0) && (
            <div className="px-5 py-3 border-t border-gray-100 text-xs space-y-2">
              {emptyDataOrgsList.length > 0 && (
                <div className="flex items-start gap-2">
                  <AlertCircle size={13} className="text-amber-500 mt-0.5 shrink-0" />
                  <div className="text-gray-700">
                    <span className="font-medium">인증 성공 · 데이터 0건</span>{' '}
                    <span className="text-gray-500">({emptyDataOrgsList.join(', ')})</span>
                    <span className="block text-[10px] text-gray-400 mt-0.5">
                      해당 기관에 채무·자산이 실제로 없거나, 공동인증서가 해당 기관에 등록되지 않았을 수 있습니다
                    </span>
                  </div>
                </div>
              )}
              {skippedOrgs.length > 0 && (
                <div className="flex items-start gap-2">
                  <XCircle size={13} className="text-red-500 mt-0.5 shrink-0" />
                  <div className="text-gray-700">
                    <span className="font-medium">스킵된 기관</span>
                    <ul className="mt-1 space-y-0.5">
                      {skippedOrgs.map((o, i) => (
                        <li key={i} className="text-gray-500">
                          <span className="font-medium text-gray-700">{o.organization}</span>
                          <span className="ml-2 text-[10px]">[{o.code}]</span>
                          <span className="ml-2">{o.message}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              {successOrgsList.length > 0 && (summary.dataOrgs ?? 0) > 0 && (
                <div className="flex items-start gap-2">
                  <CheckCircle size={13} className="text-emerald-500 mt-0.5 shrink-0" />
                  <div className="text-gray-500">
                    데이터 수집된 기관: <span className="text-gray-700">{Array.from(new Set([...debts.map((d: any) => d.creditor), ...assets.map((a: any) => a.meta?.bankName ?? a.name)])).filter(Boolean).join(', ')}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-[var(--color-bg-card)] border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">총 채무</p>
          <p className="text-2xl font-bold text-red-400">{formatKRW(summary.totalDebt ?? summary.debtTotal)}</p>
          <p className="text-xs text-gray-500 mt-1">{summary.totalDebtCount ?? summary.debtCount}건</p>
        </div>
        <div className="rounded-xl bg-[var(--color-bg-card)] border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">총 재산</p>
          <p className="text-2xl font-bold text-emerald-400">{formatKRW(summary.totalAsset ?? summary.assetTotal)}</p>
          <p className="text-xs text-gray-500 mt-1">{summary.totalAssetCount ?? summary.assetCount}건</p>
        </div>
      </div>

      {/* Debt Table */}
      <div className="rounded-xl bg-[var(--color-bg-card)] border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-gray-900 font-semibold">채무 내역</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-600 text-xs uppercase border-b border-gray-200/50">
                <th className="text-left px-6 py-3 font-medium">채권자</th>
                <th className="text-left px-6 py-3 font-medium">유형</th>
                <th className="text-right px-6 py-3 font-medium">금액</th>
                <th className="text-right px-6 py-3 font-medium">금리</th>
              </tr>
            </thead>
            <tbody>
              {debts.map((debt: any, idx: number) => (
                <tr key={debt.id ?? idx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-3 text-gray-700">{debt.creditor}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                      debt.type === '담보'
                        ? 'bg-blue-50 text-blue-400'
                        : debt.type === '사채'
                        ? 'bg-red-50 text-red-400'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {debt.type}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right text-gray-700 font-mono">{formatKRW(debt.amount)}</td>
                  <td className="px-6 py-3 text-right text-gray-600 font-mono">{debt.rate}%</td>
                </tr>
              ))}
              {debts.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">수집된 채무가 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Asset Table */}
      <div className="rounded-xl bg-[var(--color-bg-card)] border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-gray-900 font-semibold">재산 내역</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-600 text-xs uppercase border-b border-gray-200/50">
                <th className="text-left px-6 py-3 font-medium">재산명</th>
                <th className="text-left px-6 py-3 font-medium">종류</th>
                <th className="text-right px-6 py-3 font-medium">청산가치</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset: any, idx: number) => (
                <tr key={asset.id ?? idx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-3 text-gray-700">{asset.name}</td>
                  <td className="px-6 py-3">
                    <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
                      {asset.type}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right text-gray-700 font-mono">{formatKRW(asset.value)}</td>
                </tr>
              ))}
              {assets.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-500">수집된 재산이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 변제계획안 미리보기 */}
      <div className="rounded-xl bg-[var(--color-bg-card)] border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-gray-900 font-semibold">변제계획안 미리보기</h3>
        </div>
        <div className="px-6 py-5 space-y-5">
          {/* 입력 필드 */}
          <div className="flex flex-col sm:flex-row gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              월 소득
              <input
                type="number"
                min={0}
                step={10000}
                value={monthlyIncome || ''}
                onChange={(e) => setMonthlyIncome(Number(e.target.value) || 0)}
                placeholder="0"
                className="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono
                  focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-gold)]/40 focus:border-[var(--color-brand-gold)]"
              />
              <span className="text-gray-500">원</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              가구원수
              <input
                type="number"
                min={1}
                max={10}
                value={familySize}
                onChange={(e) => setFamilySize(Math.max(1, Number(e.target.value) || 1))}
                className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono text-center
                  focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-gold)]/40 focus:border-[var(--color-brand-gold)]"
              />
              <span className="text-gray-500">명</span>
            </label>
          </div>

          {/* 계산 결과 */}
          {repaymentPlan ? (
            <div className="space-y-4">
              {/* 요약 카드 */}
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                  <div>
                    <dt className="text-gray-500">가용소득</dt>
                    <dd className="font-semibold text-gray-900 font-mono">월 {formatKRW(repaymentPlan.monthlyDisposable)}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">생계비</dt>
                    <dd className="font-semibold text-gray-900 font-mono">월 {formatKRW(repaymentPlan.livingExpense)} <span className="text-xs text-gray-400 font-sans">({familySize}인)</span></dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">변제기간</dt>
                    <dd className="font-semibold text-gray-900 font-mono">{repaymentPlan.period}개월</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">총변제금</dt>
                    <dd className="font-semibold text-gray-900 font-mono">{formatKRW(repaymentPlan.totalRepayment)}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">변제율</dt>
                    <dd className="font-semibold text-gray-900 font-mono">{repaymentPlan.repaymentRate}%</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">청산가치</dt>
                    <dd className={`font-semibold font-mono ${repaymentPlan.meetsLiquidation ? 'text-emerald-600' : 'text-red-500'}`}>
                      {formatKRW(repaymentPlan.liquidationValue)}{' '}
                      {repaymentPlan.meetsLiquidation ? '보장' : '미보장'}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* 조세채권 절반기간 완납 검증 */}
              {repaymentPlan.taxCheck.taxTotal > 0 && (
                <div className={`rounded-lg p-4 ${repaymentPlan.taxCheck.canPayInHalf ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-start gap-2">
                    <span className={`text-lg ${repaymentPlan.taxCheck.canPayInHalf ? '✅' : '🚨'}`}>
                      {repaymentPlan.taxCheck.canPayInHalf ? '✅' : '🚨'}
                    </span>
                    <div>
                      <p className={`text-sm font-semibold ${repaymentPlan.taxCheck.canPayInHalf ? 'text-emerald-700' : 'text-red-700'}`}>
                        조세채권 {formatKRW(repaymentPlan.taxCheck.taxTotal)}
                        {repaymentPlan.taxCheck.canPayInHalf
                          ? ` — 변제기간 절반(${repaymentPlan.taxCheck.halfPeriod}개월) 내 완납 가능`
                          : ` — 변제기간 절반(${repaymentPlan.taxCheck.halfPeriod}개월) 내 완납 불가`
                        }
                      </p>
                      {!repaymentPlan.taxCheck.canPayInHalf && (
                        <p className="mt-1 text-xs text-red-600">
                          {repaymentPlan.taxCheck.suggestion}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-500">
                        완납 필요 기간: {repaymentPlan.taxCheck.monthsNeeded}개월 / 절반 기간: {repaymentPlan.taxCheck.halfPeriod}개월
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 채권자별 배당 테이블 */}
              {repaymentPlan.creditorShares.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">채권자별 배당</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-600 text-xs uppercase border-b border-gray-200/50">
                          <th className="text-left px-4 py-2 font-medium">채권자</th>
                          <th className="text-right px-4 py-2 font-medium">채무액</th>
                          <th className="text-right px-4 py-2 font-medium">비율</th>
                          <th className="text-right px-4 py-2 font-medium">월 배당</th>
                        </tr>
                      </thead>
                      <tbody>
                        {repaymentPlan.creditorShares.map((cs, idx) => (
                          <tr key={idx} className="border-b border-gray-100 last:border-0">
                            <td className="px-4 py-2 text-gray-700">{cs.creditor}</td>
                            <td className="px-4 py-2 text-right text-gray-700 font-mono">{formatKRW(cs.debtAmount)}</td>
                            <td className="px-4 py-2 text-right text-gray-600 font-mono">{(cs.shareRate * 100).toFixed(1)}%</td>
                            <td className="px-4 py-2 text-right text-gray-700 font-mono">{formatKRW(cs.monthlyShare)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">월 소득을 입력하면 변제계획안이 자동으로 계산됩니다.</p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-end">
        <button
          onClick={() => navigate(`/clients/${clientId}`)}
          className="flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-medium
            bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
        >
          <PlusCircle className="h-4 w-4" />
          재산 추가 입력
        </button>
        <button
          onClick={() => navigate(`/docs-gen?clientId=${clientId}`)}
          className="flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold
            bg-[var(--color-brand-gold)] text-[var(--color-brand-navy)] hover:brightness-110 transition-colors"
        >
          <FileText className="h-4 w-4" />
          서류 생성으로 이동
        </button>
      </div>
    </div>
  );
}
