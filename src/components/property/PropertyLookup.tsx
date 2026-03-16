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

interface PropertyLookupProps {
  onAdd: (asset: Asset) => void;
}

const PROPERTY_TYPES = [
  { value: 'apt', label: '아파트' },
  { value: 'land', label: '토지' },
  { value: 'house', label: '단독' },
  { value: 'multi', label: '연립' },
];

interface PropertyResult {
  rawPrice: number;
  address: string;
  area?: number;
  liquidation75: number;
  source: string;
  buildingName?: string;
  dongHo?: string;
  standardDate?: string;
  marketPrice?: number;
}

export default function PropertyLookup({ onAdd }: PropertyLookupProps) {
  const [address, setAddress] = useState('');
  const [type, setType] = useState('apt');
  const [area, setArea] = useState(84);
  const [dong, setDong] = useState('');
  const [ho, setHo] = useState('');
  const [mortgage, setMortgage] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<PropertyResult | null>(null);

  const handleLookup = async () => {
    if (!address.trim()) {
      setError('주소를 입력해주세요.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      // 1) CODEF 공시가격 API 우선 시도
      try {
        const codefData = await workerApi.getPropertyPrice2(address, type, dong || undefined, ho || undefined);
        if (codefData.rawPrice > 0) {
          setResult({
            rawPrice: codefData.rawPrice,
            address: codefData.address,
            area: codefData.area || area,
            liquidation75: codefData.liquidation75,
            source: codefData.source,
            buildingName: codefData.buildingName,
            dongHo: codefData.dongHo,
            standardDate: codefData.standardDate,
          });
          setMortgage(0);
          return;
        }
      } catch {
        // CODEF 실패 시 공공데이터 API 폴백
      }

      // 2) 공공데이터 API (data.go.kr) 폴백
      const data = await workerApi.getPropertyPrice(address, type, area);
      setResult({
        rawPrice: data.rawPrice,
        address: data.address,
        liquidation75: data.liquidation75,
        source: data.source,
      });
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
    const name = result.buildingName
      ? `${result.buildingName} ${result.dongHo ?? ''}`.trim()
      : `${typeLabel} - ${address}`;
    onAdd({
      id: crypto.randomUUID(),
      name,
      type: '부동산',
      rawValue: result.rawPrice,
      liquidationRate: 0.75,
      mortgage,
      value: netValue,
      source: result.source,
      meta: { address, area: result.area ?? area, valuationBasis: result.source === 'codef' ? '국토부 공시가격' : result.source === 'api' ? '공공데이터 공시가격' : result.source === 'api_trade' ? '실거래가 기반 추정' : '시뮬레이션 추정' },
    });
  };

  const formatKRW = (v: number) =>
    new Intl.NumberFormat('ko-KR').format(v) + '원';

  const sourceLabel = (src: string) => {
    switch (src) {
      case 'codef': return 'CODEF 공시가격';
      case 'sandbox': return 'CODEF (데모)';
      case 'api': return '공공데이터 API';
      case 'api_trade': return '실거래가 기반 추정';
      case 'simulation': return '시뮬레이션';
      case 'codef_no_data': return '공시가격 미확인';
      default: return src;
    }
  };

  return (
    <div className="rounded-xl bg-white p-6 space-y-5">
      <h3 className="text-lg font-semibold text-gray-900">부동산 공시가격 조회</h3>

      {/* Input fields */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm text-gray-600 mb-1">주소</label>
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="예: 서울특별시 강남구 역삼동 123-45"
            className="w-full rounded-lg border border-gray-200 bg-gray-100 px-4 py-2.5 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">부동산 유형</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-100 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {PROPERTY_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">면적 (m²)</label>
            <input
              type="number"
              value={area}
              onChange={e => setArea(Number(e.target.value))}
              min={1}
              className="w-full rounded-lg border border-gray-200 bg-gray-100 px-4 py-2.5 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* 아파트일 때 동/호 입력 */}
        {type === 'apt' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">동 (선택)</label>
              <input
                type="text"
                value={dong}
                onChange={e => setDong(e.target.value)}
                placeholder="예: 101"
                className="w-full rounded-lg border border-gray-200 bg-gray-100 px-4 py-2.5 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">호 (선택)</label>
              <input
                type="text"
                value={ho}
                onChange={e => setHo(e.target.value)}
                placeholder="예: 1502"
                className="w-full rounded-lg border border-gray-200 bg-gray-100 px-4 py-2.5 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
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
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Result card */}
      {result && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 space-y-4">
          {/* 건물 정보 */}
          {result.buildingName && (
            <div className="text-sm font-medium text-gray-900">
              {result.buildingName} {result.dongHo && <span className="text-gray-500">{result.dongHo}</span>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-y-3 text-sm">
            <span className="text-gray-600">공시가격</span>
            <span className="text-right text-gray-900 font-medium">
              {formatKRW(result.rawPrice)}
            </span>

            {result.marketPrice && (
              <>
                <span className="text-gray-600">실거래가 (참고)</span>
                <span className="text-right text-gray-500">
                  {formatKRW(result.marketPrice)}
                </span>
              </>
            )}

            <span className="text-gray-600">환가율 75%</span>
            <span className="text-right text-gray-900 font-medium">
              {formatKRW(result.liquidation75)}
            </span>

            <span className="text-gray-600">근저당 설정액</span>
            <div className="flex justify-end">
              <input
                type="number"
                value={mortgage}
                onChange={e => setMortgage(Number(e.target.value))}
                min={0}
                className="w-40 rounded border border-gray-300 bg-gray-200 px-3 py-1 text-right text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <span className="text-gray-600">순 청산가치</span>
            <span className={`text-right text-lg font-bold ${netValue > 0 ? 'text-green-600' : 'text-gray-400'}`}>
              {formatKRW(Math.max(0, netValue))}
            </span>
          </div>

          {/* 데이터 출처 */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>출처: {sourceLabel(result.source)}</span>
            {result.standardDate && <span>기준일: {result.standardDate}</span>}
          </div>

          {result.source === 'simulation' && (
            <p className="text-xs text-yellow-600">
              * 시뮬레이션 데이터 기반 추정값입니다. 실제 공시가격과 다를 수 있습니다.
            </p>
          )}

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
