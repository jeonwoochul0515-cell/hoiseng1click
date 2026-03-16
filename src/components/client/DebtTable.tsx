import { formatKRW } from '@/utils/formatter';
import type { Debt } from '@/types/client';

interface DebtTableProps {
  debts: Debt[];
}

export function DebtTable({ debts }: DebtTableProps) {
  const totalAmount = debts.reduce((s, d) => s + d.amount, 0);
  const totalMonthly = debts.reduce((s, d) => s + d.monthly, 0);

  if (debts.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-gray-200 py-12">
        <p className="text-sm text-gray-600">등록된 채무가 없습니다</p>
      </div>
    );
  }

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
            <th className="px-4 py-3 text-center">출처</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {debts.map((debt, i) => (
            <tr key={debt.id} className="hover:bg-gray-50/50">
              <td className="px-4 py-3 text-center text-gray-600">{i + 1}</td>
              <td className="px-4 py-3 font-medium text-gray-900">{debt.name}</td>
              <td className="px-4 py-3 text-gray-600">{debt.creditor}</td>
              <td className="px-4 py-3">
                <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                  {debt.type}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-mono text-gray-700">{formatKRW(debt.amount)}</td>
              <td className="px-4 py-3 text-right text-gray-600">{debt.rate}%</td>
              <td className="px-4 py-3 text-right font-mono text-gray-700">{formatKRW(debt.monthly)}</td>
              <td className="px-4 py-3 text-center">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  debt.source === 'codef' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {debt.source === 'codef' ? 'CODEF' : '수동'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
            <td className="px-4 py-3" colSpan={4}>합계</td>
            <td className="px-4 py-3 text-right font-mono text-blue-700">{formatKRW(totalAmount)}</td>
            <td className="px-4 py-3" />
            <td className="px-4 py-3 text-right font-mono text-blue-700">{formatKRW(totalMonthly)}</td>
            <td className="px-4 py-3" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
