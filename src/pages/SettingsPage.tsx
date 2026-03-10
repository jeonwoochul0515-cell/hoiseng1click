import { useState } from 'react';
import { Save, Wifi, WifiOff, CreditCard } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { PLAN_CONFIGS } from '@/types/subscription';
import PlanBadge from '@/components/subscription/PlanBadge';
import UpgradeModal from '@/components/subscription/UpgradeModal';
import { formatKRW, formatDate } from '@/utils/formatter';

type TabId = 'office' | 'api' | 'subscription';

const TABS: { id: TabId; label: string }[] = [
  { id: 'office', label: '사무소 정보' },
  { id: 'api', label: 'API 연동' },
  { id: 'subscription', label: '구독 관리' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('office');
  const office = useAuthStore((s) => s.office);
  const openUpgradeModal = useUiStore((s) => s.openUpgradeModal);

  // Office form state
  const [officeName, setOfficeName] = useState(office?.name ?? '');
  const [repName, setRepName] = useState(office?.rep ?? '');
  const [phone, setPhone] = useState(office?.phone ?? '');
  const [officeType, setOfficeType] = useState<'lawyer' | 'scrivener'>(office?.type ?? 'lawyer');

  // API state
  const [publicApiKey, setPublicApiKey] = useState('');
  const codefConnected = office?.codefConnected ?? false;

  const plan = office?.plan ?? 'starter';
  const planConfig = PLAN_CONFIGS[plan];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">설정</h1>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-[#111827] p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-[#C9A84C] text-black'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="rounded-xl bg-[#111827] p-6">
        {/* Tab 1: 사무소 정보 */}
        {activeTab === 'office' && (
          <div className="space-y-5 max-w-lg">
            <h2 className="text-lg font-semibold text-white">사무소 정보</h2>

            <div>
              <label className="mb-1 block text-sm text-gray-400">사무소명</label>
              <input
                type="text"
                value={officeName}
                onChange={(e) => setOfficeName(e.target.value)}
                className="w-full rounded-lg bg-[#0D1B2A] px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-[#C9A84C]"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-400">대표자명</label>
              <input
                type="text"
                value={repName}
                onChange={(e) => setRepName(e.target.value)}
                className="w-full rounded-lg bg-[#0D1B2A] px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-[#C9A84C]"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-400">연락처</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg bg-[#0D1B2A] px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-[#C9A84C]"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-400">사무소 유형</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setOfficeType('lawyer')}
                  className={`flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                    officeType === 'lawyer'
                      ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]'
                      : 'border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  변호사
                </button>
                <button
                  onClick={() => setOfficeType('scrivener')}
                  className={`flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                    officeType === 'scrivener'
                      ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]'
                      : 'border-gray-700 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  법무사
                </button>
              </div>
            </div>

            <button className="flex items-center gap-2 rounded-lg bg-[#C9A84C] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#b8973e] transition-colors">
              <Save size={16} />
              저장
            </button>
          </div>
        )}

        {/* Tab 2: API 연동 */}
        {activeTab === 'api' && (
          <div className="space-y-6 max-w-lg">
            <h2 className="text-lg font-semibold text-white">API 연동</h2>

            {/* CODEF */}
            <div className="rounded-lg border border-gray-700 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {codefConnected ? (
                    <Wifi size={18} className="text-green-400" />
                  ) : (
                    <WifiOff size={18} className="text-red-400" />
                  )}
                  <span className="font-medium text-white">CODEF API</span>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  codefConnected
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {codefConnected ? '연결됨' : '미연결'}
                </span>
              </div>
              <p className="mb-4 text-sm text-gray-400">
                CODEF API를 연결하면 의뢰인의 금융 데이터를 자동으로 수집할 수 있습니다.
              </p>
              <button className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                codefConnected
                  ? 'border border-gray-600 text-gray-400 hover:bg-white/5'
                  : 'bg-[#C9A84C] text-black hover:bg-[#b8973e]'
              }`}>
                {codefConnected ? '연결 해제' : 'CODEF 연결하기'}
              </button>
            </div>

            {/* 공공데이터 */}
            <div className="rounded-lg border border-gray-700 p-5">
              <h3 className="mb-3 font-medium text-white">공공데이터 API</h3>
              <p className="mb-3 text-sm text-gray-400">
                부동산 공시가격, 차량 기준가액 조회에 사용됩니다.
              </p>
              <label className="mb-1 block text-xs text-gray-400">API 인증키</label>
              <input
                type="text"
                value={publicApiKey}
                onChange={(e) => setPublicApiKey(e.target.value)}
                placeholder="공공데이터포털에서 발급받은 인증키 입력"
                className="w-full rounded-lg bg-[#0D1B2A] px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-[#C9A84C]"
              />
              <button className="mt-3 flex items-center gap-2 rounded-lg bg-[#C9A84C] px-4 py-2 text-sm font-medium text-black hover:bg-[#b8973e] transition-colors">
                <Save size={14} />
                저장
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: 구독 관리 */}
        {activeTab === 'subscription' && (
          <div className="space-y-6 max-w-lg">
            <h2 className="text-lg font-semibold text-white">구독 관리</h2>

            {/* Current plan */}
            <div className="rounded-lg border border-gray-700 p-5">
              <div className="flex items-center gap-3 mb-4">
                <CreditCard size={20} className="text-[#C9A84C]" />
                <span className="font-medium text-white">현재 플랜</span>
                <PlanBadge plan={plan} />
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">월 요금</span>
                  <span className="text-white font-medium">{formatKRW(planConfig.price)}/월</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">만료일</span>
                  <span className="text-white font-medium">
                    {office?.planExpiry ? formatDate(office.planExpiry) : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">이달 서류 생성</span>
                  <span className="text-white font-medium">
                    {office?.docCountThisMonth ?? 0}건
                    {planConfig.maxDocsPerMonth < Infinity && ` / ${planConfig.maxDocsPerMonth}건`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">의뢰인 수</span>
                  <span className="text-white font-medium">
                    {office?.clientCount ?? 0}명
                    {planConfig.maxClients < Infinity && ` / ${planConfig.maxClients}명`}
                  </span>
                </div>
              </div>

              <div className="mt-5 border-t border-gray-700 pt-5">
                <h4 className="mb-2 text-xs font-semibold text-gray-400 uppercase">포함 기능</h4>
                <ul className="space-y-1">
                  {planConfig.features.map((f) => (
                    <li key={f} className="text-sm text-gray-300">- {f}</li>
                  ))}
                </ul>
              </div>
            </div>

            <button
              onClick={openUpgradeModal}
              className="w-full rounded-lg bg-[#C9A84C] py-3 text-sm font-semibold text-black hover:bg-[#b8973e] transition-colors"
            >
              플랜 변경
            </button>
          </div>
        )}
      </div>

      <UpgradeModal />
    </div>
  );
}
