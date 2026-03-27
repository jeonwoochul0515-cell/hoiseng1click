import { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, CheckCircle, AlertTriangle, Printer, Save, Plus, ChevronUp } from 'lucide-react';
import { useClients, useUpdateClient } from '@/hooks/useClients';
import { formatKRW } from '@/utils/formatter';
import { calcMonthlyPayment, calcRetirementPV, calcDepositPV } from '@/utils/calculator';
import PropertyLookup from '@/components/property/PropertyLookup';
import VehicleLookup from '@/components/property/VehicleLookup';
import type { Asset } from '@/types/client';

export default function LiquidationPage() {
  const { data: clients = [], isLoading } = useClients();
  const updateMutation = useUpdateClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [taxDelinquent, setTaxDelinquent] = useState(0);
  const [wageClaim, setWageClaim] = useState(0);
  const [smallDeposit, setSmallDeposit] = useState(0);

  // 라이프니츠 현재가치 할인
  const [retirementWage, setRetirementWage] = useState(0);
  const [yearsWorked, setYearsWorked] = useState(0);
  const [yearsUntilRetirement, setYearsUntilRetirement] = useState(0);
  const [depositAmount, setDepositAmount] = useState(0);
  const [depositYears, setDepositYears] = useState(0);

  // 재산 조회 토글
  const [showPropertyLookup, setShowPropertyLookup] = useState(false);
  const [showVehicleLookup, setShowVehicleLookup] = useState(false);

  const filteredClients = useMemo(
    () => clients.filter((c) => c.name.includes(searchQuery) || c.phone.includes(searchQuery)),
    [clients, searchQuery],
  );

  const client = clients.find((c) => c.id === selectedClientId) ?? null;

  // 의뢰인 선택 시 저장된 값 복원
  useEffect(() => {
    if (!client) return;
    const lb = client.leibniz ?? {};
    const pc = client.priorityClaims ?? {};
    setRetirementWage(lb.retirementWage ?? 0);
    setYearsWorked(lb.yearsWorked ?? 0);
    setYearsUntilRetirement(lb.yearsUntilRetirement ?? 0);
    setDepositAmount(lb.depositAmount ?? 0);
    setDepositYears(lb.depositYears ?? 0);
    setTaxDelinquent(pc.taxDelinquent ?? 0);
    setWageClaim(pc.wageClaim ?? 0);
    setSmallDeposit(pc.smallDeposit ?? 0);
    setShowPropertyLookup(false);
    setShowVehicleLookup(false);
  }, [selectedClientId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 저장
  const handleSave = useCallback(() => {
    if (!client) return;
    updateMutation.mutate({
      clientId: client.id,
      data: {
        leibniz: { retirementWage, yearsWorked, yearsUntilRetirement, depositAmount, depositYears },
        priorityClaims: { taxDelinquent, wageClaim, smallDeposit },
      },
    });
  }, [client, retirementWage, yearsWorked, yearsUntilRetirement, depositAmount, depositYears, taxDelinquent, wageClaim, smallDeposit, updateMutation]);

  // 재산 추가 콜백
  const handleAddAsset = useCallback((asset: Asset) => {
    if (!client) return;
    updateMutation.mutate({
      clientId: client.id,
      data: { assets: [...(client.assets ?? []), asset] },
    });
  }, [client, updateMutation]);

  // Asset breakdown
  const realEstate = client?.assets?.filter((a) => a.type === '부동산') ?? [];
  const vehicles = client?.assets?.filter((a) => a.type === '차량') ?? [];
  const financial = client?.assets?.filter((a) => a.type === '예금' || a.type === '보험' || a.type === '증권') ?? [];

  const realEstateTotal = realEstate.reduce((s, a) => s + a.value, 0);
  const vehicleTotal = vehicles.reduce((s, a) => s + a.value, 0);
  const financialTotal = financial.reduce((s, a) => s + a.value, 0);

  // 라이프니츠 현재가치 계산
  const retirement = retirementWage > 0 && yearsWorked > 0
    ? calcRetirementPV(retirementWage, yearsWorked, yearsUntilRetirement)
    : null;
  const depositPV = depositAmount > 0 && depositYears > 0
    ? calcDepositPV(depositAmount, depositYears)
    : null;
  const leibnizTotal = (retirement?.presentValue ?? 0) + (depositPV?.presentValue ?? 0);

  const priorityClaims = taxDelinquent + wageClaim + smallDeposit;
  const grossLiquidation = realEstateTotal + vehicleTotal + financialTotal + leibnizTotal;
  const netLiquidation = Math.max(0, grossLiquidation - priorityClaims);

  const monthlyPayment = client
    ? calcMonthlyPayment({
        income: client.income,
        income2: client.income2,
        family: client.family,
        rent: client.rent,
        education: client.education,
        medical: client.medical,
      })
    : 0;
  const repayPeriod = (client as any)?.repayPeriodMonths ?? 36;
  const repayTotal = monthlyPayment * repayPeriod;
  const isSufficient = repayTotal >= netLiquidation;
  const deficit = netLiquidation - repayTotal;

  return (
    <div className="flex h-full gap-4">
      {/* Left Panel - Client List */}
      <div className="flex w-[300px] shrink-0 flex-col rounded-xl bg-white">
        <div className="border-b border-gray-200 p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">의뢰인 선택</h2>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="이름 또는 연락처 검색"
              className="w-full rounded-lg bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-500 outline-none focus:ring-1 focus:ring-[#C9A84C]"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <p className="p-3 text-sm text-gray-500">불러오는 중...</p>
          ) : filteredClients.length === 0 ? (
            <p className="p-3 text-sm text-gray-500">등록된 의뢰인이 없습니다</p>
          ) : (
            filteredClients.map((c) => {
              const assetCount = c.assets?.length ?? 0;
              const totalDebt = c.debts?.reduce((s, d) => s + d.amount, 0) ?? 0;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedClientId(c.id)}
                  className={`mb-1 w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                    selectedClientId === c.id
                      ? 'bg-[#C9A84C]/15 text-[#C9A84C]'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-gray-400">{assetCount}건</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    채무 {formatKRW(totalDebt)}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Panel - Report */}
      <div className="flex-1 overflow-y-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">청산가치 리포트</h1>
          {client && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <Save size={16} />
                {updateMutation.isPending ? '저장 중...' : '저장'}
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-lg bg-[#C9A84C] px-4 py-2 text-sm font-medium text-black hover:bg-[#b8973e] transition-colors"
              >
                <Printer size={16} />
                PDF 출력
              </button>
            </div>
          )}
        </div>

        {!client ? (
          <div className="flex h-64 items-center justify-center rounded-xl bg-white text-gray-500">
            {isLoading ? '의뢰인 목록을 불러오는 중...' : '의뢰인을 선택해주세요'}
          </div>
        ) : (client.assets?.length ?? 0) === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl bg-white text-gray-500 gap-2">
            <p>등록된 재산이 없습니다</p>
            <p className="text-xs">의뢰인 상세 페이지에서 재산을 추가해주세요</p>
          </div>
        ) : (
          <>
            {/* 1. 부동산 */}
            <section className="rounded-xl bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">1. 부동산 자산</h2>
                <button
                  onClick={() => setShowPropertyLookup(!showPropertyLookup)}
                  className="flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition"
                >
                  {showPropertyLookup ? <ChevronUp size={14} /> : <Plus size={14} />}
                  부동산 조회 추가
                </button>
              </div>
              {showPropertyLookup && (
                <div className="mb-4">
                  <PropertyLookup onAdd={(a) => { handleAddAsset(a as Asset); setShowPropertyLookup(false); }} />
                </div>
              )}
              {realEstate.length === 0 ? (
                <p className="text-sm text-gray-500">부동산 자산 없음</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 border-b border-gray-200">
                      <th className="pb-2 font-medium">재산명</th>
                      <th className="pb-2 font-medium">주소/면적</th>
                      <th className="pb-2 font-medium text-right">공시가격</th>
                      <th className="pb-2 font-medium text-center">환가율</th>
                      <th className="pb-2 font-medium text-right">근저당</th>
                      <th className="pb-2 font-medium text-right">순청산가치</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {realEstate.map((a) => (
                      <tr key={a.id} className="text-gray-700">
                        <td className="py-2 text-gray-900">{a.name}</td>
                        <td className="py-2 text-xs text-gray-600">{a.meta?.address ?? '-'} / {a.meta?.area ?? '-'}m²</td>
                        <td className="py-2 text-right">{formatKRW(a.rawValue)}</td>
                        <td className="py-2 text-center">{((a.liquidationRate ?? 0.75) * 100).toFixed(0)}%</td>
                        <td className="py-2 text-right">{formatKRW(a.mortgage)}</td>
                        <td className="py-2 text-right font-semibold text-gray-900">{formatKRW(a.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 font-bold text-gray-900">
                      <td colSpan={5} className="pt-2 text-right">소계</td>
                      <td className="pt-2 text-right">{formatKRW(realEstateTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </section>

            {/* 2. 차량 */}
            <section className="rounded-xl bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">2. 차량 자산</h2>
                <button
                  onClick={() => setShowVehicleLookup(!showVehicleLookup)}
                  className="flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition"
                >
                  {showVehicleLookup ? <ChevronUp size={14} /> : <Plus size={14} />}
                  차량 조회 추가
                </button>
              </div>
              {showVehicleLookup && (
                <div className="mb-4">
                  <VehicleLookup onAdd={(a) => { handleAddAsset(a as Asset); setShowVehicleLookup(false); }} />
                </div>
              )}
              {vehicles.length === 0 ? (
                <p className="text-sm text-gray-500">차량 자산 없음</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 border-b border-gray-200">
                      <th className="pb-2 font-medium">차량명</th>
                      <th className="pb-2 font-medium">번호판</th>
                      <th className="pb-2 font-medium text-center">연식</th>
                      <th className="pb-2 font-medium text-right">기준가액</th>
                      <th className="pb-2 font-medium text-center">환가율</th>
                      <th className="pb-2 font-medium text-right">저당/압류</th>
                      <th className="pb-2 font-medium text-right">순청산가치</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {vehicles.map((a) => (
                      <tr key={a.id} className="text-gray-700">
                        <td className="py-2 text-gray-900">{a.name}</td>
                        <td className="py-2">{a.meta?.plate ?? '-'}</td>
                        <td className="py-2 text-center">{a.meta?.year ?? '-'}</td>
                        <td className="py-2 text-right">{formatKRW(a.rawValue)}</td>
                        <td className="py-2 text-center">{((a.liquidationRate ?? 0.70) * 100).toFixed(0)}%</td>
                        <td className="py-2 text-right">{formatKRW(a.mortgage)}</td>
                        <td className="py-2 text-right font-semibold text-gray-900">{formatKRW(a.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 font-bold text-gray-900">
                      <td colSpan={6} className="pt-2 text-right">소계</td>
                      <td className="pt-2 text-right">{formatKRW(vehicleTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </section>

            {/* 3. 금융 재산 */}
            <section className="rounded-xl bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">3. 금융 재산</h2>
              {financial.length === 0 ? (
                <p className="text-sm text-gray-500">금융 재산 없음</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 border-b border-gray-200">
                      <th className="pb-2 font-medium">재산명</th>
                      <th className="pb-2 font-medium">종류</th>
                      <th className="pb-2 font-medium text-right">금액</th>
                      <th className="pb-2 font-medium text-right">청산가치</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {financial.map((a) => (
                      <tr key={a.id} className="text-gray-700">
                        <td className="py-2 text-gray-900">{a.name}</td>
                        <td className="py-2">{a.type}</td>
                        <td className="py-2 text-right">{formatKRW(a.rawValue)}</td>
                        <td className="py-2 text-right font-semibold text-gray-900">{formatKRW(a.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 font-bold text-gray-900">
                      <td colSpan={3} className="pt-2 text-right">소계</td>
                      <td className="pt-2 text-right">{formatKRW(financialTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </section>

            {/* 4. 라이프니츠 현재가치 할인 */}
            <section className="rounded-xl bg-white p-6">
              <h2 className="mb-2 text-lg font-semibold text-gray-900">4. 라이프니츠 현재가치 할인</h2>
              <p className="mb-4 text-xs text-gray-500">
                장래 수령 예정 자산은 법정이율(연 5%)로 현재가치를 할인하여 청산가치에 산입합니다. (라이프니츠 방식)
              </p>

              {/* 퇴직금 */}
              <div className="mb-5">
                <h3 className="mb-3 text-sm font-semibold text-gray-700">퇴직금</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-600">월 평균 임금</label>
                    <input
                      type="number"
                      value={retirementWage || ''}
                      onChange={(e) => setRetirementWage(Number(e.target.value))}
                      placeholder="0"
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-[#C9A84C]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-600">현재 근속연수</label>
                    <input
                      type="number"
                      value={yearsWorked || ''}
                      onChange={(e) => setYearsWorked(Number(e.target.value))}
                      placeholder="0"
                      min={0}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-[#C9A84C]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-600">퇴직까지 남은 연수</label>
                    <input
                      type="number"
                      value={yearsUntilRetirement || ''}
                      onChange={(e) => setYearsUntilRetirement(Number(e.target.value))}
                      placeholder="0"
                      min={0}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-[#C9A84C]"
                    />
                  </div>
                </div>
                {retirement && (
                  <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="grid grid-cols-2 gap-y-2 text-sm">
                      <span className="text-gray-600">예상 퇴직금 (퇴직시)</span>
                      <span className="text-right text-gray-900">{formatKRW(retirement.estimatedRetirement)}</span>
                      <span className="text-gray-600">라이프니츠 계수 ({yearsUntilRetirement}년)</span>
                      <span className="text-right text-gray-900">{retirement.factor.toFixed(4)}</span>
                      <span className="text-gray-600 font-semibold">현재가치</span>
                      <span className="text-right font-bold text-blue-700">{formatKRW(retirement.presentValue)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 임대차보증금 */}
              <div className="mb-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-700">임대차보증금 반환채무</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-gray-600">보증금 총액</label>
                    <input
                      type="number"
                      value={depositAmount || ''}
                      onChange={(e) => setDepositAmount(Number(e.target.value))}
                      placeholder="0"
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-[#C9A84C]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-600">반환까지 남은 연수</label>
                    <input
                      type="number"
                      value={depositYears || ''}
                      onChange={(e) => setDepositYears(Number(e.target.value))}
                      placeholder="0"
                      min={0}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-[#C9A84C]"
                    />
                  </div>
                </div>
                {depositPV && (
                  <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="grid grid-cols-2 gap-y-2 text-sm">
                      <span className="text-gray-600">보증금 원액</span>
                      <span className="text-right text-gray-900">{formatKRW(depositAmount)}</span>
                      <span className="text-gray-600">라이프니츠 계수 ({depositYears}년)</span>
                      <span className="text-right text-gray-900">{depositPV.factor.toFixed(4)}</span>
                      <span className="text-gray-600 font-semibold">현재가치</span>
                      <span className="text-right font-bold text-blue-700">{formatKRW(depositPV.presentValue)}</span>
                    </div>
                  </div>
                )}
              </div>

              {leibnizTotal > 0 && (
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-gray-700">라이프니츠 현재가치 합계</span>
                    <span className="text-lg font-bold text-blue-700">{formatKRW(leibnizTotal)}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">이 금액이 청산가치 총액에 가산됩니다.</p>
                </div>
              )}
            </section>

            {/* 5. 우선채권 공제 */}
            <section className="rounded-xl bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">5. 우선채권 공제</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-600">체납세금</label>
                  <input
                    type="number"
                    value={taxDelinquent}
                    onChange={(e) => setTaxDelinquent(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-[#C9A84C]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600">임금채권</label>
                  <input
                    type="number"
                    value={wageClaim}
                    onChange={(e) => setWageClaim(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-[#C9A84C]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600">소액보증금</label>
                  <input
                    type="number"
                    value={smallDeposit}
                    onChange={(e) => setSmallDeposit(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-[#C9A84C]"
                  />
                </div>
              </div>
              <p className="mt-3 text-sm text-gray-600">
                우선채권 합계: <span className="font-semibold text-gray-900">{formatKRW(priorityClaims)}</span>
              </p>
            </section>

            {/* 5. 청산가치 최종 */}
            <section className="rounded-xl bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">6. 청산가치 최종 산정</h2>
              <table className="w-full text-sm mb-6">
                <tbody className="divide-y divide-gray-200">
                  <tr className="text-gray-700">
                    <td className="py-2">부동산 청산가치</td>
                    <td className="py-2 text-right">{formatKRW(realEstateTotal)}</td>
                  </tr>
                  <tr className="text-gray-700">
                    <td className="py-2">차량 청산가치</td>
                    <td className="py-2 text-right">{formatKRW(vehicleTotal)}</td>
                  </tr>
                  <tr className="text-gray-700">
                    <td className="py-2">금융 재산</td>
                    <td className="py-2 text-right">{formatKRW(financialTotal)}</td>
                  </tr>
                  {leibnizTotal > 0 && (
                    <tr className="text-gray-700">
                      <td className="py-2">라이프니츠 현재가치 (퇴직금/보증금)</td>
                      <td className="py-2 text-right text-blue-700">{formatKRW(leibnizTotal)}</td>
                    </tr>
                  )}
                  <tr className="text-gray-700">
                    <td className="py-2">(-) 우선채권 공제</td>
                    <td className="py-2 text-right text-red-500">-{formatKRW(priorityClaims)}</td>
                  </tr>
                  <tr className="border-t border-gray-300 font-bold text-gray-900">
                    <td className="pt-3 text-base">순 청산가치 합계</td>
                    <td className="pt-3 text-right text-base">{formatKRW(netLiquidation)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Comparison */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
                <h3 className="mb-3 text-sm font-semibold text-gray-600">36개월 변제총액 비교</h3>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-700">월 변제금 x 36개월</span>
                  <span className="text-lg font-bold text-gray-900">{formatKRW(repayTotal)}</span>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-700">순 청산가치</span>
                  <span className="text-lg font-bold text-gray-900">{formatKRW(netLiquidation)}</span>
                </div>
                <div className={`flex items-center gap-3 rounded-lg p-4 ${
                  isSufficient ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}>
                  {isSufficient ? (
                    <>
                      <CheckCircle size={24} className="text-green-600" />
                      <div>
                        <p className="font-semibold text-green-700">청산가치 충족</p>
                        <p className="text-sm text-gray-600">
                          변제총액({formatKRW(repayTotal)})이 청산가치({formatKRW(netLiquidation)})를 충족합니다.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={24} className="text-red-600" />
                      <div>
                        <p className="font-semibold text-red-700">청산가치 미충족</p>
                        <p className="text-sm text-gray-600">
                          부족액: <span className="font-bold text-red-600">{formatKRW(deficit)}</span> — 변제총액을 늘리거나 자산 재평가가 필요합니다.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
