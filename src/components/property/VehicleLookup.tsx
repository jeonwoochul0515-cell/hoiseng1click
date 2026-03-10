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

interface VehicleLookupProps {
  onAdd: (asset: Asset) => void;
}

const VEHICLE_MODELS = [
  '소나타', '아반떼', '그랜저',
  'K5', 'K8', 'K3',
  '셀토스', '투싼', '싼타페',
  '쏘렌토', '카니발', '모닝',
  '스파크', '레이', '스타리아',
];

export default function VehicleLookup({ onAdd }: VehicleLookupProps) {
  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('소나타');
  const [year, setYear] = useState(new Date().getFullYear() - 3);
  const [km, setKm] = useState(50000);
  const [lien, setLien] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    model: string;
    year: number;
    basePrice: number;
    liquidation70: number;
  } | null>(null);

  const handleLookup = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await workerApi.getVehicleValue({
        plate: plate || undefined,
        model,
        year,
        km,
      });
      setResult(data);
      setLien(0);
    } catch (err: any) {
      setError(err.message ?? '조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const netValue = result ? result.liquidation70 - lien : 0;

  const handleAdd = () => {
    if (!result) return;
    onAdd({
      id: crypto.randomUUID(),
      name: `${result.model} (${result.year}년식)`,
      type: 'vehicle',
      rawValue: result.basePrice,
      liquidationRate: 0.70,
      mortgage: lien,
      value: netValue,
      source: 'internal_db',
      meta: { plate: plate || undefined, year: result.year },
    });
  };

  const formatKRW = (v: number) =>
    new Intl.NumberFormat('ko-KR').format(v) + '원';

  const currentYear = new Date().getFullYear();
  const yearOptions: number[] = [];
  for (let y = currentYear; y >= currentYear - 15; y--) {
    yearOptions.push(y);
  }

  return (
    <div className="rounded-xl bg-[#111827] p-6 space-y-5">
      <h3 className="text-lg font-semibold text-white">차량 가치 조회</h3>

      {/* Input fields */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-gray-400 mb-1">차량번호 (선택)</label>
          <input
            type="text"
            value={plate}
            onChange={e => setPlate(e.target.value)}
            placeholder="예: 12가 3456"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">차종</label>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {VEHICLE_MODELS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">연식</label>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">주행거리 (km)</label>
            <input
              type="number"
              value={km}
              onChange={e => setKm(Number(e.target.value))}
              min={0}
              step={1000}
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
          '조회'
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
            <span className="text-gray-400">차종 / 연식</span>
            <span className="text-right text-white font-medium">
              {result.model} / {result.year}년
            </span>

            <span className="text-gray-400">보험개발원 기준가액</span>
            <span className="text-right text-white font-medium">
              {formatKRW(result.basePrice)}
            </span>

            <span className="text-gray-400">환가율 70%</span>
            <span className="text-right text-white font-medium">
              {formatKRW(result.liquidation70)}
            </span>

            <span className="text-gray-400">저당 / 압류</span>
            <div className="flex justify-end">
              <input
                type="number"
                value={lien}
                onChange={e => setLien(Number(e.target.value))}
                min={0}
                className="w-40 rounded border border-gray-600 bg-gray-700 px-3 py-1 text-right text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <span className="text-gray-400">순 청산가치</span>
            <span className="text-right text-lg font-bold text-green-400">
              {formatKRW(netValue)}
            </span>
          </div>

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
