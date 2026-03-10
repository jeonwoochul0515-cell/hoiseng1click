import { useCollectionStore } from '@/store/collectionStore';
import { CheckSquare, Square } from 'lucide-react';

const AUTH_METHODS: { key: 'cert' | 'kakao' | 'pass' | 'finCert'; label: string }[] = [
  { key: 'cert', label: '공동인증서' },
  { key: 'kakao', label: '간편인증(카카오/PASS)' },
  { key: 'finCert', label: '금융인증서' },
];

const BANKS = [
  '국민은행', '신한은행', '우리은행', '하나은행', '농협', '카카오뱅크', '토스뱅크',
  '삼성카드', '현대카드', '롯데카드', 'OK저축은행', 'SBI저축은행', '삼성생명', '한화생명',
];

export default function AuthStep() {
  const {
    authMethod, setAuthMethod,
    credentials, setCredentials,
    selectedBanks, toggleBank,
    setStep,
  } = useCollectionStore();

  const allBanksSelected = BANKS.every((b) => selectedBanks.includes(b));

  function handleToggleAllBanks() {
    if (allBanksSelected) {
      BANKS.forEach((b) => {
        if (selectedBanks.includes(b)) toggleBank(b);
      });
    } else {
      BANKS.forEach((b) => {
        if (!selectedBanks.includes(b)) toggleBank(b);
      });
    }
  }

  const canProceed = credentials.id.trim() !== '' && credentials.password.trim() !== '' && selectedBanks.length > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Auth Method Tabs */}
      <div className="rounded-xl bg-[var(--color-bg-card)] border border-gray-700 p-6 space-y-4">
        <h3 className="text-white font-semibold">인증 방식 선택</h3>
        <div className="flex gap-2">
          {AUTH_METHODS.map((m) => (
            <button
              key={m.key}
              onClick={() => {
                setAuthMethod(m.key);
                setCredentials({ ...credentials, loginType: m.key });
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                authMethod === m.key
                  ? 'bg-[var(--color-brand-gold)] text-[var(--color-brand-navy)]'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Credentials */}
      <div className="rounded-xl bg-[var(--color-bg-card)] border border-gray-700 p-6 space-y-4">
        <h3 className="text-white font-semibold">인증 정보 입력</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">아이디</label>
            <input
              type="text"
              value={credentials.id}
              onChange={(e) => setCredentials({ ...credentials, id: e.target.value })}
              placeholder="CODEF 연동 ID"
              className="w-full rounded-lg bg-gray-800 border border-gray-600 px-4 py-2.5 text-sm text-white
                placeholder-gray-500 focus:border-[var(--color-brand-gold)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">비밀번호</label>
            <input
              type="password"
              value={credentials.password}
              onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
              placeholder="비밀번호"
              className="w-full rounded-lg bg-gray-800 border border-gray-600 px-4 py-2.5 text-sm text-white
                placeholder-gray-500 focus:border-[var(--color-brand-gold)] focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Bank Selection */}
      <div className="rounded-xl bg-[var(--color-bg-card)] border border-gray-700 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold">수집 대상 금융기관</h3>
          <span className="text-xs text-gray-500">{selectedBanks.length}개 선택됨</span>
        </div>

        {/* Select All */}
        <button
          type="button"
          onClick={handleToggleAllBanks}
          className="flex items-center gap-2 pb-3 border-b border-gray-700"
        >
          {allBanksSelected ? (
            <CheckSquare className="h-4 w-4 text-[var(--color-brand-gold)]" />
          ) : (
            <Square className="h-4 w-4 text-gray-500" />
          )}
          <span className="text-sm text-gray-300">전체 선택</span>
        </button>

        {/* Bank Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {BANKS.map((bank) => {
            const selected = selectedBanks.includes(bank);
            return (
              <button
                key={bank}
                type="button"
                onClick={() => toggleBank(bank)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  selected
                    ? 'bg-[var(--color-brand-gold)]/10 border border-[var(--color-brand-gold)]/40 text-[var(--color-brand-gold)]'
                    : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                {selected ? (
                  <CheckSquare className="h-4 w-4 shrink-0" />
                ) : (
                  <Square className="h-4 w-4 shrink-0" />
                )}
                {bank}
              </button>
            );
          })}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex justify-between">
        <button
          onClick={() => setStep(1)}
          className="rounded-lg px-6 py-3 text-sm font-medium text-gray-400 bg-gray-800 hover:bg-gray-700 transition-colors"
        >
          이전
        </button>
        <button
          disabled={!canProceed}
          onClick={() => setStep(3)}
          className="rounded-lg px-8 py-3 font-semibold text-sm transition-colors
            enabled:bg-[var(--color-brand-gold)] enabled:text-[var(--color-brand-navy)]
            enabled:hover:brightness-110
            disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
        >
          수집 시작
        </button>
      </div>
    </div>
  );
}
