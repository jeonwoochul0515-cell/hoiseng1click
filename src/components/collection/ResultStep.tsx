import { useCollectionStore } from '@/store/collectionStore';
import { formatKRW } from '@/utils/formatter';
import { useNavigate } from 'react-router-dom';
import { FileText, PlusCircle } from 'lucide-react';

interface ResultStepProps {
  clientId: string;
}

export default function ResultStep({ clientId }: ResultStepProps) {
  const { result } = useCollectionStore();
  const navigate = useNavigate();

  if (!result) {
    return (
      <div className="mx-auto max-w-2xl text-center py-12 text-gray-500">
        수집 결과가 없습니다.
      </div>
    );
  }

  const { debts, assets, summary } = result;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-[var(--color-bg-card)] border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">총 채무</p>
          <p className="text-2xl font-bold text-red-400">{formatKRW(summary.totalDebt)}</p>
          <p className="text-xs text-gray-500 mt-1">{summary.totalDebtCount}건</p>
        </div>
        <div className="rounded-xl bg-[var(--color-bg-card)] border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">총 재산</p>
          <p className="text-2xl font-bold text-emerald-400">{formatKRW(summary.totalAsset)}</p>
          <p className="text-xs text-gray-500 mt-1">{summary.totalAssetCount}건</p>
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
          onClick={() => navigate(`/documents?clientId=${clientId}`)}
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
