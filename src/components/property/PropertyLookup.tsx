import { useState } from 'react';
import { workerApi } from '@/api/worker';

interface Asset {
  id: string;
  name: string;
  type: string;
  rawValue: number;
  liquidationRate: number;
  mortgage: number;
  value: number;
  source: string;
  meta?: { plate?: string; year?: number; address?: string; area?: number };
}

interface PropertyLookupProps {
  onAdd: (asset: Asset) => void;
}

const PROPERTY_TYPES = [
  { value: 'apt', label: '아파트' },
  { value: 'land', label: '토지' },
  { value: 'house', label: '단독' },
  { value: 'multi', label: '연립' },
];

export default function PropertyLookup({ onAdd }: PropertyLookupProps) {
  const [address, setAddress] = useState('');
  const [type, setType] = useState('apt');
  const [area, setArea] = useState(84);
  const [mortgage, setMortgage] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    rawPrice: number;
    address: string;
    liquidation75: number;
    source: string;
  } | null>(null);

  const handleLookup = async () => {
    if (!address.trim()) {
      setError('주소를 입력해주세요.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await workerApi.getPropertyPrice(address, type, area);
      setResult(data);
      setMortgage(0);
    } catch (err: any) {
      setError(err.message ?? '조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const netValue = result ? result.liquidation75 - mortgage : 0;

  const handleAdd = () => {
    if (!result) return;
    const typeLabel = PROPERTY_TYPES.find(t => t.value === type)?.label ?? '부동산';
    onAdd({
      id: crypto.randomUUID(),
      name: `${typeLabel} - ${address}`,
      type: 'property',
      rawValue: result.rawPrice,
      liquidationRate: 0.75,
      mortgage,
      value: netValue,
      source: result.source,
      meta: { address, area },
    });
  };

  const formatKRW = (v: number) =>
    new Intl.NumberFormat('ko-KR').format(v) + '원';

  return (
    <div className="rounded-xl bg-[#111827] p-6 space-y-5">
      <h3 className="text-lg font-semibold text-white">부동산 공시가격 조회</h3>

      {/* Input fields */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-gray-400 mb-1">주소</label>
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="예: 서울특별시 강남구 역삼동 123-45"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">부동산 유형</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {PROPERTY_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">면적 (m²)</label>
            <input
              type="number"
              value={area}
              onChange={e => setArea(Number(e.target.value))}
              min={1}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Lookup button */}
      <button
        onClick={handleLookup}
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            조회 중...
          </span>
        ) : (
          '공시가격 조회'
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Result card */}
      {result && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-y-3 text-sm">
            <span className="text-gray-400">공시가격</span>
            <span className="text-right text-white font-medium">
              {formatKRW(result.rawPrice)}
            </span>

            <span className="text-gray-400">환가율 75%</span>
            <span className="text-right text-white font-medium">
              {formatKRW(result.liquidation75)}
            </span>

            <span className="text-gray-400">근저당 설정액</span>
            <div className="flex justify-end">
              <input
                type="number"
                value={mortgage}
                onChange={e => setMortgage(Number(e.target.value))}
                min={0}
                className="w-40 rounded border border-gray-600 bg-gray-700 px-3 py-1 text-right text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <span className="text-gray-400">순 청산가치</span>
            <span className="text-right text-lg font-bold text-green-400">
              {formatKRW(netValue)}
            </span>
          </div>

          {result.source === 'simulation' && (
            <p className="text-xs text-yellow-400">
              * 시뮬레이션 데이터 기반 추정값입니다. 실제 공시가격과 다를 수 있습니다.
            </p>
          )}

          <button
            onClick={handleAdd}
            className="w-full rounded-lg border border-green-600 bg-green-600/20 py-2.5 text-sm font-medium text-green-400 transition hover:bg-green-600/30"
          >
            재산 목록에 추가
          </button>
        </div>
      )}
    </div>
  );
}
