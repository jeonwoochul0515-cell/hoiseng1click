import { useState, useMemo } from 'react';
import { Search, CheckCircle, AlertTriangle, Printer } from 'lucide-react';
import type { Client } from '@/types/client';
import { formatKRW } from '@/utils/formatter';
import { calcMonthlyPayment } from '@/utils/calculator';

// ----- Mock clients -----
const mockClients: Client[] = [
  {
    id: '1', name: '김영수', ssn: '900101-1234567', phone: '01012345678',
    address: '서울특별시 강남구 테헤란로 123', job: '회사원', jobType: 'employed',
    family: 3, court: '서울회생법원', income: 3200000, income2: 0,
    rent: 500000, education: 200000, medical: 100000,
    status: 'drafting', collectionDone: true,
    debts: [
      { id: '1', creditor: '국민은행', name: '신용대출', type: '무담보', amount: 35000000, rate: 5.5, monthly: 580000, source: 'codef' },
      { id: '2', creditor: '신한카드', name: '카드론', type: '무담보', amount: 12000000, rate: 12.0, monthly: 320000, source: 'codef' },
      { id: '3', creditor: '하나은행', name: '주택담보대출', type: '담보', amount: 80000000, rate: 3.8, monthly: 450000, source: 'codef' },
    ],
    assets: [
      { id: '1', name: '서울 강남구 아파트', type: '부동산', rawValue: 350000000, liquidationRate: 0.7, mortgage: 200000000, value: 45000000, source: 'api', meta: { address: '서울 강남구 테헤란로 123', area: 84.5 } },
      { id: '2', name: '현대 아반떼 CN7', type: '차량', rawValue: 15000000, liquidationRate: 0.6, mortgage: 0, value: 9000000, source: 'api', meta: { plate: '12가3456', year: 2022 } },
      { id: '3', name: '국민은행 예금', type: '예금', rawValue: 2500000, liquidationRate: 1.0, mortgage: 0, value: 2500000, source: 'codef' },
      { id: '4', name: '삼성생명 보험', type: '보험', rawValue: 5000000, liquidationRate: 0.8, mortgage: 0, value: 4000000, source: 'codef' },
    ],
    memo: '', createdAt: new Date('2026-01-15'), updatedAt: new Date('2026-03-09'),
  },
  {
    id: '2', name: '이미영', ssn: '850312-2345678', phone: '01098765432',
    address: '서울특별시 서초구 반포대로 45', job: '자영업', jobType: 'self',
    family: 4, court: '서울회생법원', income: 2800000, income2: 500000,
    rent: 600000, education: 300000, medical: 150000,
    status: 'collecting', collectionDone: false,
    debts: [
      { id: '4', creditor: '우리은행', name: '사업자대출', type: '무담보', amount: 50000000, rate: 6.2, monthly: 700000, source: 'codef' },
    ],
    assets: [
      { id: '5', name: '기아 K5 DL3', type: '차량', rawValue: 20000000, liquidationRate: 0.6, mortgage: 0, value: 12000000, source: 'api', meta: { plate: '34나5678', year: 2023 } },
      { id: '6', name: '하나은행 예금', type: '예금', rawValue: 3200000, liquidationRate: 1.0, mortgage: 0, value: 3200000, source: 'codef' },
    ],
    memo: '', createdAt: new Date('2026-02-03'), updatedAt: new Date('2026-03-08'),
  },
];

export default function LiquidationPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [taxDelinquent, setTaxDelinquent] = useState(0);
  const [wageClaim, setWageClaim] = useState(0);
  const [smallDeposit, setSmallDeposit] = useState(0);

  const filteredClients = useMemo(
    () => mockClients.filter((c) => c.name.includes(searchQuery) || c.phone.includes(searchQuery)),
    [searchQuery],
  );

  const client = mockClients.find((c) => c.id === selectedClientId) ?? null;

  // Asset breakdown
  const realEstate = client?.assets.filter((a) => a.type === '부동산') ?? [];
  const vehicles = client?.assets.filter((a) => a.type === '차량') ?? [];
  const financial = client?.assets.filter((a) => a.type === '예금' || a.type === '보험' || a.type === '증권') ?? [];

  const realEstateTotal = realEstate.reduce((s, a) => s + a.value, 0);
  const vehicleTotal = vehicles.reduce((s, a) => s + a.value, 0);
  const financialTotal = financial.reduce((s, a) => s + a.value, 0);

  const priorityClaims = taxDelinquent + wageClaim + smallDeposit;
  const grossLiquidation = realEstateTotal + vehicleTotal + financialTotal;
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
  const repayTotal = monthlyPayment * 36;
  const isSufficient = repayTotal >= netLiquidation;
  const deficit = netLiquidation - repayTotal;

  return (
    <div className="flex h-full gap-4">
      {/* Left Panel - Client List */}
      <div className="flex w-[300px] shrink-0 flex-col rounded-xl bg-[#111827]">
        <div className="border-b border-gray-800 p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">의뢰인 선택</h2>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="이름 또는 연락처 검색"
              className="w-full rounded-lg bg-[#0D1B2A] py-2 pl-9 pr-3 text-sm text-gray-200 placeholder-gray-500 outline-none focus:ring-1 focus:ring-[#C9A84C]"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filteredClients.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedClientId(c.id)}
              className={`mb-1 w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                selectedClientId === c.id
                  ? 'bg-[#C9A84C]/15 text-[#C9A84C]'
                  : 'text-gray-300 hover:bg-white/5'
              }`}
            >
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-gray-500">{c.phone}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Right Panel - Report */}
      <div className="flex-1 overflow-y-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">청산가치 리포트</h1>
          {client && (
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-lg bg-[#C9A84C] px-4 py-2 text-sm font-medium text-black hover:bg-[#b8973e] transition-colors"
            >
              <Printer size={16} />
              PDF 출력
            </button>
          )}
        </div>

        {!client ? (
          <div className="flex h-64 items-center justify-center rounded-xl bg-[#111827] text-gray-500">
            의뢰인을 선택해주세요
          </div>
        ) : (
          <>
            {/* 1. 부동산 */}
            <section className="rounded-xl bg-[#111827] p-6">
              <h2 className="mb-4 text-lg font-semibold text-white">1. 부동산 자산</h2>
              {realEstate.length === 0 ? (
                <p className="text-sm text-gray-500">부동산 자산 없음</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-700">
                      <th className="pb-2 font-medium">재산명</th>
                      <th className="pb-2 font-medium">주소/면적</th>
                      <th className="pb-2 font-medium text-right">공시가격</th>
                      <th className="pb-2 font-medium text-right">근저당</th>
                      <th className="pb-2 font-medium text-right">순청산가치</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {realEstate.map((a) => (
                      <tr key={a.id} className="text-gray-300">
                        <td className="py-2 text-white">{a.name}</td>
                        <td className="py-2 text-xs text-gray-400">{a.meta?.address ?? '-'} / {a.meta?.area ?? '-'}m2</td>
                        <td className="py-2 text-right">{formatKRW(a.rawValue)}</td>
                        <td className="py-2 text-right">{formatKRW(a.mortgage)}</td>
                        <td className="py-2 text-right font-semibold text-white">{formatKRW(a.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-700 font-bold text-white">
                      <td colSpan={4} className="pt-2 text-right">소계</td>
                      <td className="pt-2 text-right">{formatKRW(realEstateTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </section>

            {/* 2. 차량 */}
            <section className="rounded-xl bg-[#111827] p-6">
              <h2 className="mb-4 text-lg font-semibold text-white">2. 차량 자산</h2>
              {vehicles.length === 0 ? (
                <p className="text-sm text-gray-500">차량 자산 없음</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-700">
                      <th className="pb-2 font-medium">차량명</th>
                      <th className="pb-2 font-medium">번호판</th>
                      <th className="pb-2 font-medium text-center">연식</th>
                      <th className="pb-2 font-medium text-right">시가</th>
                      <th className="pb-2 font-medium text-right">순청산가치</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {vehicles.map((a) => (
                      <tr key={a.id} className="text-gray-300">
                        <td className="py-2 text-white">{a.name}</td>
                        <td className="py-2">{a.meta?.plate ?? '-'}</td>
                        <td className="py-2 text-center">{a.meta?.year ?? '-'}</td>
                        <td className="py-2 text-right">{formatKRW(a.rawValue)}</td>
                        <td className="py-2 text-right font-semibold text-white">{formatKRW(a.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-700 font-bold text-white">
                      <td colSpan={4} className="pt-2 text-right">소계</td>
                      <td className="pt-2 text-right">{formatKRW(vehicleTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </section>

            {/* 3. 금융 재산 */}
            <section className="rounded-xl bg-[#111827] p-6">
              <h2 className="mb-4 text-lg font-semibold text-white">3. 금융 재산</h2>
              {financial.length === 0 ? (
                <p className="text-sm text-gray-500">금융 재산 없음</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-700">
                      <th className="pb-2 font-medium">재산명</th>
                      <th className="pb-2 font-medium">종류</th>
                      <th className="pb-2 font-medium text-right">금액</th>
                      <th className="pb-2 font-medium text-right">청산가치</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {financial.map((a) => (
                      <tr key={a.id} className="text-gray-300">
                        <td className="py-2 text-white">{a.name}</td>
                        <td className="py-2">{a.type}</td>
                        <td className="py-2 text-right">{formatKRW(a.rawValue)}</td>
                        <td className="py-2 text-right font-semibold text-white">{formatKRW(a.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-700 font-bold text-white">
                      <td colSpan={3} className="pt-2 text-right">소계</td>
                      <td className="pt-2 text-right">{formatKRW(financialTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </section>

            {/* 4. 우선채권 공제 */}
            <section className="rounded-xl bg-[#111827] p-6">
              <h2 className="mb-4 text-lg font-semibold text-white">4. 우선채권 공제</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-400">체납세금</label>
                  <input
                    type="number"
                    value={taxDelinquent}
                    onChange={(e) => setTaxDelinquent(Number(e.target.value))}
                    className="w-full rounded-lg bg-[#0D1B2A] px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[#C9A84C]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-400">임금채권</label>
                  <input
                    type="number"
                    value={wageClaim}
                    onChange={(e) => setWageClaim(Number(e.target.value))}
                    className="w-full rounded-lg bg-[#0D1B2A] px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[#C9A84C]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-400">소액보증금</label>
                  <input
                    type="number"
                    value={smallDeposit}
                    onChange={(e) => setSmallDeposit(Number(e.target.value))}
                    className="w-full rounded-lg bg-[#0D1B2A] px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[#C9A84C]"
                  />
                </div>
              </div>
              <p className="mt-3 text-sm text-gray-400">
                우선채권 합계: <span className="font-semibold text-white">{formatKRW(priorityClaims)}</span>
              </p>
            </section>

            {/* 5. 청산가치 최종 */}
            <section className="rounded-xl bg-[#111827] p-6">
              <h2 className="mb-4 text-lg font-semibold text-white">5. 청산가치 최종 산정</h2>
              <table className="w-full text-sm mb-6">
                <tbody className="divide-y divide-gray-800">
                  <tr className="text-gray-300">
                    <td className="py-2">부동산 청산가치</td>
                    <td className="py-2 text-right">{formatKRW(realEstateTotal)}</td>
                  </tr>
                  <tr className="text-gray-300">
                    <td className="py-2">차량 청산가치</td>
                    <td className="py-2 text-right">{formatKRW(vehicleTotal)}</td>
                  </tr>
                  <tr className="text-gray-300">
                    <td className="py-2">금융 재산</td>
                    <td className="py-2 text-right">{formatKRW(financialTotal)}</td>
                  </tr>
                  <tr className="text-gray-300">
                    <td className="py-2">(-) 우선채권 공제</td>
                    <td className="py-2 text-right text-red-400">-{formatKRW(priorityClaims)}</td>
                  </tr>
                  <tr className="border-t border-gray-600 font-bold text-white">
                    <td className="pt-3 text-base">순 청산가치 합계</td>
                    <td className="pt-3 text-right text-base">{formatKRW(netLiquidation)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Comparison */}
              <div className="rounded-lg bg-[#0D1B2A] p-5">
                <h3 className="mb-3 text-sm font-semibold text-gray-400">36개월 변제총액 비교</h3>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-300">월 변제금 x 36개월</span>
                  <span className="text-lg font-bold text-white">{formatKRW(repayTotal)}</span>
                </div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-300">순 청산가치</span>
                  <span className="text-lg font-bold text-white">{formatKRW(netLiquidation)}</span>
                </div>
                <div className={`flex items-center gap-3 rounded-lg p-4 ${
                  isSufficient ? 'bg-green-500/10' : 'bg-red-500/10'
                }`}>
                  {isSufficient ? (
                    <>
                      <CheckCircle size={24} className="text-green-400" />
                      <div>
                        <p className="font-semibold text-green-400">청산가치 충족</p>
                        <p className="text-sm text-gray-400">
                          변제총액({formatKRW(repayTotal)})이 청산가치({formatKRW(netLiquidation)})를 충족합니다.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={24} className="text-red-400" />
                      <div>
                        <p className="font-semibold text-red-400">청산가치 미충족</p>
                        <p className="text-sm text-gray-400">
                          부족액: <span className="font-bold text-red-400">{formatKRW(deficit)}</span> — 변제총액을 늘리거나 자산 재평가가 필요합니다.
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
