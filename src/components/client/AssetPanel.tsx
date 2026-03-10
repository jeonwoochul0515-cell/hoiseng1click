import { formatKRW } from '@/utils/formatter';
import type { Asset } from '@/types/client';

interface AssetPanelProps {
  assets: Asset[];
}

export function AssetPanel({ assets }: AssetPanelProps) {
  const totalRaw = assets.reduce((s, a) => s + a.rawValue, 0);
  const totalMortgage = assets.reduce((s, a) => s + a.mortgage, 0);
  const totalNet = assets.reduce((s, a) => s + a.value, 0);

  if (assets.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-gray-200 py-12">
        <p className="text-sm text-gray-400">등록된 재산이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
            <th className="px-4 py-3 text-center">No</th>
            <th className="px-4 py-3">재산명</th>
            <th className="px-4 py-3">종류</th>
            <th className="px-4 py-3 text-right">평가액</th>
            <th className="px-4 py-3 text-right">환가율</th>
            <th className="px-4 py-3 text-right">근저당</th>
            <th className="px-4 py-3 text-right">순청산가치</th>
            <th className="px-4 py-3 text-center">출처</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {assets.map((asset, i) => (
            <tr key={asset.id} className="hover:bg-gray-50/50">
              <td className="px-4 py-3 text-center text-gray-400">{i + 1}</td>
              <td className="px-4 py-3 font-medium text-gray-900">{asset.name}</td>
              <td className="px-4 py-3">
                <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                  {asset.type}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-mono text-gray-700">{formatKRW(asset.rawValue)}</td>
              <td className="px-4 py-3 text-right text-gray-600">{(asset.liquidationRate * 100).toFixed(0)}%</td>
              <td className="px-4 py-3 text-right font-mono text-gray-700">{formatKRW(asset.mortgage)}</td>
              <td className="px-4 py-3 text-right font-mono text-gray-700">{formatKRW(asset.value)}</td>
              <td className="px-4 py-3 text-center">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  asset.source === 'codef' ? 'bg-blue-50 text-blue-700'
                    : asset.source === 'api' ? 'bg-purple-50 text-purple-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {asset.source === 'codef' ? 'CODEF' : asset.source === 'api' ? 'API' : '수동'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
            <td className="px-4 py-3" colSpan={3}>합계</td>
            <td className="px-4 py-3 text-right font-mono text-green-700">{formatKRW(totalRaw)}</td>
            <td className="px-4 py-3" />
            <td className="px-4 py-3 text-right font-mono text-green-700">{formatKRW(totalMortgage)}</td>
            <td className="px-4 py-3 text-right font-mono text-green-700">{formatKRW(totalNet)}</td>
            <td className="px-4 py-3" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
