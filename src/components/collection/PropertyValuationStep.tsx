import { useState, useCallback, useEffect } from 'react';
import { doc, getDoc, updateDoc, setDoc, Timestamp } from 'firebase/firestore';
import {
  Plus,
  Trash2,
  Home,
  Loader2,
  CheckCircle2,
  XCircle,
  Search,
  Building2,
} from 'lucide-react';
import { db } from '@/firebase';
import { useAuthStore } from '@/store/authStore';
import { workerApi } from '@/api/worker';
import { toast } from '@/utils/toast';
import type { Client, Asset } from '@/types/client';

// ── Props ──

interface PropertyValuationStepProps {
  clientId?: string;
  onNext: () => void;
  onBack: () => void;
}

// ── 내부 State ──

type PropertyType = 'apt' | 'house' | 'land';

interface PropertyCard {
  localId: string;
  address: string;
  pnu: string;
  pnuConfirmed: boolean;
  pnuManual: boolean; // 수동 입력 모드 여부
  pnuLoading: boolean;
  pnuError: string | null;
  type: PropertyType;
  area?: number;
  priceLoading: boolean;
  priceError: string | null;
  priceResult: {
    rawPrice: number;
    liquidation75: number;
    standardDate: string;
    stdrYear: string;
    buildingName?: string;
    unitPrice?: number;
  } | null;
  added: boolean;
}

function genLocalId() {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function genAssetId() {
  return `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function newCard(): PropertyCard {
  return {
    localId: genLocalId(),
    address: '',
    pnu: '',
    pnuConfirmed: false,
    pnuManual: false,
    pnuLoading: false,
    pnuError: null,
    type: 'apt',
    area: undefined,
    priceLoading: false,
    priceError: null,
    priceResult: null,
    added: false,
  };
}

function formatWon(v: number) {
  return `${v.toLocaleString()}원`;
}

function isValidPnu(pnu: string) {
  return /^\d{19}$/.test(pnu);
}

// ── 컴포넌트 ──

export default function PropertyValuationStep({ clientId, onNext, onBack }: PropertyValuationStepProps) {
  const office = useAuthStore((s) => s.office);
  const individual = useAuthStore((s) => s.individual);

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<PropertyCard[]>([newCard()]);

  const isIndividualPage = !!individual;

  // Load client
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (isIndividualPage && individual) {
          const snap = await getDoc(doc(db, 'individuals', individual.id, 'cases', clientId ?? 'default'));
          if (!cancelled && snap.exists()) {
            const data = snap.data() as Client;
            setClient(data);
            // 의뢰인 주소가 있으면 첫 번째 카드에 미리 채움
            if (data.address) {
              setCards([{ ...newCard(), address: data.address }]);
            }
          }
        } else if (office && clientId) {
          const snap = await getDoc(doc(db, 'offices', office.id, 'clients', clientId));
          if (!cancelled && snap.exists()) {
            const data = snap.data() as Client;
            setClient(data);
            if (data.address) {
              setCards([{ ...newCard(), address: data.address }]);
            }
          }
        }
      } catch (err) {
        console.error('의뢰인 로드 실패:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [office, individual, clientId, isIndividualPage]);

  const updateCard = useCallback((localId: string, patch: Partial<PropertyCard>) => {
    setCards((prev) => prev.map((c) => (c.localId === localId ? { ...c, ...patch } : c)));
  }, []);

  const mergeClient = useCallback(async (patch: Partial<Client>) => {
    try {
      const payload: Record<string, unknown> = { ...patch, updatedAt: Timestamp.now() };
      if (isIndividualPage && individual) {
        const caseRef = doc(db, 'individuals', individual.id, 'cases', clientId ?? 'default');
        const existing = await getDoc(caseRef);
        if (existing.exists()) await updateDoc(caseRef, payload);
        else await setDoc(caseRef, { ...payload, createdAt: Timestamp.now() });
      } else if (office && clientId) {
        await updateDoc(doc(db, 'offices', office.id, 'clients', clientId), payload);
      }
      setClient((prev) => (prev ? ({ ...prev, ...patch } as Client) : prev));
    } catch (err) {
      console.error('Firestore merge 실패:', err);
    }
  }, [office, individual, clientId, isIndividualPage]);

  // 주소 → PNU 변환
  const resolvePnu = useCallback(async (localId: string, address: string) => {
    if (!address.trim()) return;
    updateCard(localId, { pnuLoading: true, pnuError: null, pnuConfirmed: false });
    try {
      const res = await workerApi.addressToPnu(address.trim());
      if (res.success && res.pnu) {
        updateCard(localId, {
          pnu: res.pnu,
          pnuConfirmed: true,
          pnuLoading: false,
          pnuManual: false,
        });
      } else {
        updateCard(localId, {
          pnuLoading: false,
          pnuError: res.message ?? 'PNU 변환에 실패했습니다. 수동 입력을 이용하세요.',
          pnuManual: true,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'PNU 변환 실패';
      updateCard(localId, { pnuLoading: false, pnuError: msg, pnuManual: true });
    }
  }, [updateCard]);

  // 공시가격 조회
  const fetchPrice = useCallback(async (localId: string) => {
    const card = cards.find((c) => c.localId === localId);
    if (!card) return;
    if (!card.pnu || !isValidPnu(card.pnu)) {
      toast.error('PNU 19자리 숫자를 확인해주세요.');
      return;
    }
    updateCard(localId, { priceLoading: true, priceError: null });
    try {
      if (card.type === 'apt') {
        const res = await workerApi.getAptPrice({ pnu: card.pnu });
        if (res.source === 'vworld' && res.rawPrice > 0) {
          updateCard(localId, {
            priceLoading: false,
            priceResult: {
              rawPrice: res.rawPrice,
              liquidation75: res.liquidation75,
              standardDate: res.standardDate,
              stdrYear: res.stdrYear,
            },
          });
        } else {
          updateCard(localId, { priceLoading: false, priceError: res.message ?? '공시가격을 조회할 수 없습니다.' });
        }
      } else if (card.type === 'house') {
        const res = await workerApi.getHousePrice({ pnu: card.pnu });
        if (res.source === 'vworld' && res.rawPrice > 0) {
          updateCard(localId, {
            priceLoading: false,
            priceResult: {
              rawPrice: res.rawPrice,
              liquidation75: res.liquidation75,
              standardDate: res.standardDate,
              stdrYear: res.stdrYear,
            },
          });
        } else {
          updateCard(localId, { priceLoading: false, priceError: res.message ?? '공시가격을 조회할 수 없습니다.' });
        }
      } else {
        // land
        const res = await workerApi.getLandPrice({ pnu: card.pnu, area: card.area });
        if (res.source === 'vworld' && res.rawPrice > 0) {
          updateCard(localId, {
            priceLoading: false,
            priceResult: {
              rawPrice: res.rawPrice,
              liquidation75: res.liquidation75,
              standardDate: res.standardDate,
              stdrYear: res.stdrYear,
              unitPrice: res.unitPrice,
            },
          });
        } else {
          updateCard(localId, { priceLoading: false, priceError: res.message ?? '공시지가를 조회할 수 없습니다.' });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '조회 실패';
      updateCard(localId, { priceLoading: false, priceError: msg });
    }
  }, [cards, updateCard]);

  // 재산목록에 추가
  const addToAssets = useCallback(async (localId: string) => {
    const card = cards.find((c) => c.localId === localId);
    if (!card || !card.priceResult) return;
    const asset: Asset = {
      id: genAssetId(),
      name: card.priceResult.buildingName || card.address || '부동산',
      type: '부동산',
      rawValue: card.priceResult.rawPrice,
      liquidationRate: 75,
      mortgage: 0,
      value: Math.floor(card.priceResult.rawPrice * 0.75),
      source: 'api',
      meta: {
        pnu: card.pnu,
        address: card.address,
        stdrYear: card.priceResult.stdrYear,
        standardDate: card.priceResult.standardDate,
        buildingName: card.priceResult.buildingName,
        priceSource: 'vworld',
        area: card.area,
      },
    };
    const existingAssets = (client?.assets ?? []);
    await mergeClient({ assets: [...existingAssets, asset] });
    updateCard(localId, { added: true });
    toast.success('재산목록에 추가됐습니다.');
  }, [cards, client?.assets, mergeClient, updateCard]);

  const removeCard = useCallback((localId: string) => {
    setCards((prev) => prev.filter((c) => c.localId !== localId));
  }, []);

  const addCard = useCallback(() => {
    setCards((prev) => [...prev, newCard()]);
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-gray-400" size={24} />
        </div>
      </div>
    );
  }

  const addedProperties = (client?.assets ?? []).filter((a) => a.type === '부동산' && a.source === 'api' && a.meta?.pnu);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* 헤더 */}
      <div className="rounded-xl bg-[var(--color-bg-card)] border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">소유 부동산 자동 발견 및 공시가격 조회</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          주소(지번)를 입력하면 공시가격을 자동으로 조회합니다. 확인 후 재산목록에 추가하세요.
          아파트는 공동주택 공시가격, 단독주택은 개별주택 공시가격, 토지는 개별공시지가를 사용합니다.
        </p>
      </div>

      {/* 카드 리스트 */}
      <div className="space-y-4">
        {cards.map((card, idx) => (
          <section
            key={card.localId}
            className="rounded-xl bg-[var(--color-bg-card)] border border-gray-200 overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2">
                <Home size={16} className="text-gray-500" />
                <span className="text-sm font-semibold text-gray-900">부동산 {idx + 1}</span>
              </div>
              {cards.length > 1 && (
                <button
                  onClick={() => removeCard(card.localId)}
                  className="text-red-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors"
                  aria-label="제거"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* 주소 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  주소 (지번)
                </label>
                <input
                  type="text"
                  value={card.address}
                  onChange={(e) => updateCard(card.localId, { address: e.target.value, pnuConfirmed: false, pnu: '', priceResult: null })}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (val && !card.pnuConfirmed) resolvePnu(card.localId, val);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val && !card.pnuConfirmed) resolvePnu(card.localId, val);
                    }
                  }}
                  placeholder="예: 서울 강남구 역삼동 737"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)] outline-none"
                />
              </div>

              {/* PNU */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    PNU (19자리)
                  </label>
                  <button
                    type="button"
                    onClick={() => updateCard(card.localId, { pnuManual: !card.pnuManual, pnuError: null })}
                    className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2"
                  >
                    {card.pnuManual ? '자동 변환 사용' : 'PNU 직접 입력'}
                  </button>
                </div>
                {card.pnuManual ? (
                  <input
                    type="text"
                    value={card.pnu}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 19);
                      updateCard(card.localId, { pnu: val, pnuConfirmed: isValidPnu(val) });
                    }}
                    placeholder="19자리 숫자"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)] outline-none"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-700">
                      {card.pnuLoading ? (
                        <span className="inline-flex items-center gap-1.5 text-gray-500">
                          <Loader2 size={14} className="animate-spin" /> PNU 조회 중...
                        </span>
                      ) : card.pnuConfirmed && card.pnu ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700">
                          <CheckCircle2 size={14} /> {card.pnu}
                        </span>
                      ) : card.pnuError ? (
                        <span className="inline-flex items-center gap-1.5 text-red-600 text-xs">
                          <XCircle size={14} /> {card.pnuError}
                        </span>
                      ) : (
                        <span className="text-gray-400">주소를 입력하면 자동 변환됩니다</span>
                      )}
                    </div>
                    {card.address && !card.pnuConfirmed && !card.pnuLoading && (
                      <button
                        type="button"
                        onClick={() => resolvePnu(card.localId, card.address)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Search size={14} /> 변환
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 유형 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">유형</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  {([
                    { value: 'apt' as PropertyType, label: '아파트 (공동주택)' },
                    { value: 'house' as PropertyType, label: '단독주택' },
                    { value: 'land' as PropertyType, label: '토지' },
                  ]).map((opt) => (
                    <label
                      key={opt.value}
                      className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm cursor-pointer transition-colors ${
                        card.type === opt.value
                          ? 'border-[var(--color-brand-gold)] bg-amber-50 text-amber-800'
                          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`type-${card.localId}`}
                        checked={card.type === opt.value}
                        onChange={() => updateCard(card.localId, { type: opt.value, priceResult: null, priceError: null })}
                        className="sr-only"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* 토지인 경우 면적 입력 */}
              {card.type === 'land' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    면적 (㎡) <span className="text-xs text-gray-400">선택 — 입력 시 총액 계산</span>
                  </label>
                  <input
                    type="number"
                    value={card.area ?? ''}
                    onChange={(e) => updateCard(card.localId, { area: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="예: 200"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:ring-1 focus:ring-[var(--color-brand-gold)] outline-none"
                  />
                </div>
              )}

              {/* 공시가격 조회 버튼 */}
              <div>
                <button
                  type="button"
                  onClick={() => fetchPrice(card.localId)}
                  disabled={!card.pnuConfirmed || !isValidPnu(card.pnu) || card.priceLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-brand-gold)] px-4 py-2 text-sm font-semibold text-[var(--color-brand-navy)] hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {card.priceLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  공시가격 조회
                </button>
              </div>

              {/* 결과 */}
              {card.priceError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {card.priceError}
                </div>
              )}
              {card.priceResult && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-2 text-sm">
                  <div className="flex items-baseline justify-between">
                    <span className="text-gray-600">공시가격</span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatWon(card.priceResult.rawPrice)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between text-xs text-gray-500">
                    <span>공시기준일</span>
                    <span>{card.priceResult.standardDate || card.priceResult.stdrYear}</span>
                  </div>
                  <div className="flex items-baseline justify-between border-t border-emerald-200 pt-2">
                    <span className="text-gray-600">청산가치 (75%)</span>
                    <span className="text-base font-semibold text-emerald-700">
                      {formatWon(card.priceResult.liquidation75)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => addToAssets(card.localId)}
                    disabled={card.added}
                    className="w-full mt-2 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {card.added ? <CheckCircle2 size={14} /> : <Plus size={14} />}
                    {card.added ? '추가 완료' : '재산목록에 추가'}
                  </button>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      {/* 부동산 추가 버튼 */}
      <div>
        <button
          type="button"
          onClick={addCard}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors"
        >
          <Plus size={16} />
          부동산 추가
        </button>
      </div>

      {/* 추가된 부동산 목록 */}
      {addedProperties.length > 0 && (
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">재산목록에 추가된 부동산</h3>
          <ul className="space-y-2">
            {addedProperties.map((a) => (
              <li key={a.id} className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-2 text-gray-700">
                  <Building2 size={14} className="text-gray-500" />
                  <span className="font-medium">{a.name}</span>
                  {a.meta?.area && <span className="text-xs text-gray-500">({a.meta.area}㎡)</span>}
                </span>
                <span className="font-semibold text-gray-900">{formatWon(a.rawValue)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 하단 버튼 */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          onClick={onBack}
          className="w-full sm:w-auto rounded-xl border border-gray-300 bg-white px-6 py-3.5 text-base font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          이전 단계
        </button>
        <button
          onClick={onNext}
          className="w-full sm:flex-1 rounded-xl bg-emerald-600 px-6 py-3.5 text-base font-semibold text-white hover:bg-emerald-700 transition-colors"
        >
          다음 단계
        </button>
      </div>
      <div className="text-center">
        <button
          onClick={onNext}
          className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2"
        >
          건너뛰기
        </button>
      </div>
    </div>
  );
}
