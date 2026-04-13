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
  meta?: { plate?: string; year?: number; address?: string; area?: number; valuationBasis?: string };
}

interface VehicleLookupProps {
  onAdd: (asset: Asset) => void;
}

const VEHICLE_MODELS: { group: string; models: string[] }[] = [
  { group: '현대', models: ['소나타', '아반떼', '그랜저', '캐스퍼', '베뉴', '코나', '투싼', '싼타페', '팰리세이드', '아이오닉5', '아이오닉6', '스타리아', '포터'] },
  { group: '기아', models: ['모닝', '레이', 'K3', 'K5', 'K8', 'K9', '셀토스', '스포티지', '쏘렌토', '카니발', 'EV6', 'EV9', '니로', '봉고'] },
  { group: '제네시스', models: ['G70', 'G80', 'G90', 'GV60', 'GV70', 'GV80'] },
  { group: '쌍용/KG', models: ['티볼리', '코란도', '렉스턴', '토레스'] },
  { group: '르노', models: ['SM6', 'XM3', 'QM6'] },
  { group: '쉐보레', models: ['스파크', '트레일블레이저', '트랙스', '이쿼녹스'] },
  { group: '수입', models: ['3시리즈', '5시리즈', 'X3', 'X5', 'C클래스', 'E클래스', 'GLC', 'A4', 'A6', 'Q5', '모델3', '모델Y', '캠리', 'RAV4'] },
];

type LookupMode = 'plate' | 'manual';

interface VehicleResult {
  model: string;
  year: number;
  basePrice: number;
  liquidation70: number;
  mortgage?: number;
  seizure?: number;
  displacement?: number;
  fuelType?: string;
  source: string;
}

export default function VehicleLookup({ onAdd }: VehicleLookupProps) {
  const [mode, setMode] = useState<LookupMode>('plate');
  const [plate, setPlate] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerBirth, setOwnerBirth] = useState('');
  const [model, setModel] = useState('소나타');
  const [year, setYear] = useState(new Date().getFullYear() - 3);
  const [km, setKm] = useState(50000);
  const [lien, setLien] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<VehicleResult | null>(null);

  const handleLookup = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      if (mode === 'plate' && plate.trim()) {
        // CODEF 차량등록원부 조회
        const data = await workerApi.getVehicleInfo(
          plate.trim(),
          ownerName || undefined,
          ownerBirth || undefined,
        );
        setResult({
          model: data.model || plate,
          year: data.year,
          basePrice: data.basePrice,
          liquidation70: data.liquidation70,
          mortgage: data.mortgage,
          seizure: data.seizure,
          displacement: data.displacement,
          fuelType: data.fuelType,
          source: data.source,
        });
        // 저당/압류를 자동 반영
        setLien((data.mortgage ?? 0) + (data.seizure ?? 0));
      } else {
        // 수동 입력 → 내부 DB 조회
        const data = await workerApi.getVehicleValue({
          plate: plate || undefined,
          model,
          year,
          km,
        });
        setResult({
          model: data.model,
          year: data.year,
          basePrice: data.basePrice,
          liquidation70: data.liquidation70,
          source: 'internal_db',
        });
        setLien(0);
      }
    } catch (err: any) {
      setError(err.message ?? '조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const netValue = result ? Math.max(0, result.liquidation70 - lien) : 0;

  const handleAdd = () => {
    if (!result) return;
    onAdd({
      id: crypto.randomUUID(),
      name: `${result.model} (${result.year}년식)`,
      type: '차량',
      rawValue: result.basePrice,
      liquidationRate: 0.70,
      mortgage: lien,
      value: netValue,
      source: result.source,
      meta: { plate: plate || undefined, year: result.year, valuationBasis: result.source === 'codef' ? 'CODEF 등록원부' : '보험개발원 기준가액' },
    });
  };

  const formatKRW = (v: number) =>
    new Intl.NumberFormat('ko-KR').format(v) + '원';

  const currentYear = new Date().getFullYear();
  const yearOptions: number[] = [];
  for (let y = currentYear; y >= currentYear - 15; y--) {
    yearOptions.push(y);
  }

  const sourceLabel = (src: string) => {
    switch (src) {
      case 'codef': return 'CODEF 등록원부';
      case 'sandbox': return 'CODEF (데모)';
      case 'internal_db': return '내부 시세 DB';
      default: return src;
    }
  };

  return (
    <div className="rounded-xl bg-white p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">차량 가치 조회</h3>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
          <button
            onClick={() => setMode('plate')}
            className={`px-3 py-1.5 transition ${mode === 'plate' ? 'bg-brand-gold text-black' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
          >
            차량번호
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`px-3 py-1.5 transition ${mode === 'manual' ? 'bg-brand-gold text-black' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
          >
            수동 입력
          </button>
        </div>
      </div>

      {/* Input fields */}
      <div className="space-y-3">
        {mode === 'plate' ? (
          <>
            <div>
              <label className="block text-sm text-gray-600 mb-1">차량번호</label>
              <input
                type="text"
                value={plate}
                onChange={e => setPlate(e.target.value)}
                placeholder="예: 12가 3456"
                className="w-full rounded-lg border border-gray-200 bg-gray-100 px-4 py-2.5 text-gray-900 placeholder-gray-500 focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">소유자명 (선택)</label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={e => setOwnerName(e.target.value)}
                  placeholder="홍길동"
                  className="w-full rounded-lg border border-gray-200 bg-gray-100 px-4 py-2.5 text-gray-900 placeholder-gray-500 focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">생년월일 (선택)</label>
                <input
                  type="text"
                  value={ownerBirth}
                  onChange={e => setOwnerBirth(e.target.value)}
                  placeholder="19850101"
                  maxLength={8}
                  className="w-full rounded-lg border border-gray-200 bg-gray-100 px-4 py-2.5 text-gray-900 placeholder-gray-500 focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              차량번호로 등록원부를 조회하여 제원·시세·저당/압류를 자동으로 가져옵니다.
            </p>
          </>
        ) : (
          <>
            <div>
              <label className="block text-sm text-gray-600 mb-1">차량번호 (선택)</label>
              <input
                type="text"
                value={plate}
                onChange={e => setPlate(e.target.value)}
                placeholder="예: 12가 3456"
                className="w-full rounded-lg border border-gray-200 bg-gray-100 px-4 py-2.5 text-gray-900 placeholder-gray-500 focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">차종</label>
                <select
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-100 px-4 py-2.5 text-gray-900 focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                >
                  {VEHICLE_MODELS.map(g => (
                    <optgroup key={g.group} label={g.group}>
                      {g.models.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">연식</label>
                <select
                  value={year}
                  onChange={e => setYear(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-200 bg-gray-100 px-4 py-2.5 text-gray-900 focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                >
                  {yearOptions.map(y => (
                    <option key={y} value={y}>{y}년</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">주행거리 (km)</label>
                <input
                  type="number"
                  value={km}
                  onChange={e => setKm(Number(e.target.value))}
                  min={0}
                  step={1000}
                  className="w-full rounded-lg border border-gray-200 bg-gray-100 px-4 py-2.5 text-gray-900 focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Lookup button */}
      <button
        onClick={handleLookup}
        disabled={loading}
        className="w-full rounded-lg bg-brand-gold py-2.5 text-sm font-medium text-black transition hover:bg-[#b8973e] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            조회 중...
          </span>
        ) : mode === 'plate' ? (
          '등록원부 조회'
        ) : (
          '시세 조회'
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Result card */}
      {result && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-y-3 text-sm">
            <span className="text-gray-600">차종 / 연식</span>
            <span className="text-right text-gray-900 font-medium">
              {result.model} / {result.year}년
            </span>

            {result.displacement ? (
              <>
                <span className="text-gray-600">배기량 / 연료</span>
                <span className="text-right text-gray-500">
                  {result.displacement.toLocaleString()}cc / {result.fuelType}
                </span>
              </>
            ) : null}

            <span className="text-gray-600">보험개발원 기준가액</span>
            <span className="text-right text-gray-900 font-medium">
              {formatKRW(result.basePrice)}
            </span>

            <span className="text-gray-600">환가율 70%</span>
            <span className="text-right text-gray-900 font-medium">
              {formatKRW(result.liquidation70)}
            </span>

            {/* 저당/압류 자동 표시 */}
            {(result.mortgage ?? 0) > 0 && (
              <>
                <span className="text-gray-600">저당 (등록원부)</span>
                <span className="text-right text-red-600 font-medium">
                  -{formatKRW(result.mortgage!)}
                </span>
              </>
            )}
            {(result.seizure ?? 0) > 0 && (
              <>
                <span className="text-gray-600">압류 (등록원부)</span>
                <span className="text-right text-red-600 font-medium">
                  -{formatKRW(result.seizure!)}
                </span>
              </>
            )}

            <span className="text-gray-600">저당 / 압류 합계</span>
            <div className="flex justify-end">
              <input
                type="number"
                value={lien}
                onChange={e => setLien(Number(e.target.value))}
                min={0}
                className="w-40 rounded border border-gray-300 bg-gray-200 px-3 py-1 text-right text-sm text-gray-900 focus:border-brand-gold focus:outline-none"
              />
            </div>

            <span className="text-gray-600">순 청산가치</span>
            <span className={`text-right text-lg font-bold ${netValue > 0 ? 'text-green-600' : 'text-gray-400'}`}>
              {formatKRW(netValue)}
            </span>
          </div>

          {/* 데이터 출처 */}
          <div className="text-xs text-gray-500">
            출처: {sourceLabel(result.source)}
          </div>

          <button
            onClick={handleAdd}
            className="w-full rounded-lg border border-green-600 bg-green-600/10 py-2.5 text-sm font-medium text-green-700 transition hover:bg-green-600/20"
          >
            재산 목록에 추가
          </button>
        </div>
      )}
    </div>
  );
}
