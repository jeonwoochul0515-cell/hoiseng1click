import { useState, useEffect, useRef, useCallback } from 'react';
import { useCollectionStore } from '@/store/collectionStore';
import { CheckSquare, Square, Smartphone, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import { workerApi } from '@/api/worker';

const PROVIDERS = [
  { value: '1', label: '카카오톡' },
  { value: '5', label: 'PASS (통신사)' },
  { value: '6', label: '네이버' },
  { value: '8', label: '토스' },
  { value: '4', label: 'KB모바일' },
  { value: '2', label: '페이코' },
];

const BANK_CATEGORIES: { label: string; items: string[] }[] = [
  {
    label: '은행',
    items: ['국민은행', '신한은행', '우리은행', '하나은행', '농협', 'IBK기업은행', 'SC제일은행', '카카오뱅크', '토스뱅크', '케이뱅크', '수협은행'],
  },
  {
    label: '카드',
    items: ['삼성카드', '현대카드', '롯데카드', 'BC카드', 'KB국민카드', '신한카드', '우리카드', '하나카드', 'NH카드'],
  },
  {
    label: '보험',
    items: ['삼성생명', '한화생명', '교보생명', '삼성화재', '현대해상', 'DB손해보험'],
  },
  {
    label: '저축은행',
    items: ['OK저축은행', 'SBI저축은행'],
  },
];

const AUTH_TIMEOUT_MS = 10 * 60 * 1000; // 10분
const POLL_INTERVAL_MS = 3000; // 3초

export default function AuthStep() {
  const {
    userName, setUserName,
    birthDate, setBirthDate,
    phoneNo, setPhoneNo,
    provider, setProvider,
    selectedBanks, toggleBank,
    authStatus, setAuthStatus,
    twoWayInfo, setTwoWayInfo,
    connectedId, setConnectedId,
    authExpiry, setAuthExpiry,
    setStep,
  } = useCollectionStore();

  const [authError, setAuthError] = useState('');
  const [remainingSec, setRemainingSec] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const allItems = BANK_CATEGORIES.flatMap((c) => c.items);
  const allSelected = allItems.every((b) => selectedBanks.includes(b));

  // 폴링/타이머 정리
  const clearPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => () => clearPolling(), [clearPolling]);

  // 인증 만료 타이머
  useEffect(() => {
    if (!authExpiry || authStatus !== 'pending') {
      setRemainingSec(0);
      return;
    }

    function tick() {
      const remaining = Math.max(0, Math.ceil((authExpiry! - Date.now()) / 1000));
      setRemainingSec(remaining);
      if (remaining <= 0) {
        // 인증 만료
        clearPolling();
        setAuthStatus('error');
        setAuthError('인증 시간이 만료되었습니다. 다시 인증해주세요.');
        setTwoWayInfo(null);
        setAuthExpiry(null);
      }
    }

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [authExpiry, authStatus, clearPolling, setAuthStatus, setAuthExpiry, setTwoWayInfo]);

  // 자동 폴링 (pending 상태에서 3초마다 인증 완료 확인)
  useEffect(() => {
    if (authStatus !== 'pending' || !twoWayInfo) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }

    async function pollOnce() {
      try {
        const result = await workerApi.simpleAuthComplete({
          twoWayInfo: twoWayInfo!,
          banks: selectedBanks,
          phoneNo: phoneNo.replace(/-/g, '').trim(),
          birthDate: birthDate.trim(),
          userName: userName.trim(),
          provider: provider || '1',
        });

        if (result.status === 'done' && result.connectedId) {
          clearPolling();
          setConnectedId(result.connectedId);
          setAuthStatus('done');
          setAuthError('');
        }
        // pending이면 계속 폴링
      } catch {
        // 네트워크 에러 등은 무시하고 계속 폴링
      }
    }

    pollRef.current = setInterval(pollOnce, POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [authStatus, twoWayInfo, selectedBanks, phoneNo, birthDate, userName, provider, clearPolling, setConnectedId, setAuthStatus]);

  function handleToggleAll() {
    if (allSelected) {
      allItems.forEach((b) => { if (selectedBanks.includes(b)) toggleBank(b); });
    } else {
      allItems.forEach((b) => { if (!selectedBanks.includes(b)) toggleBank(b); });
    }
  }

  function handleToggleCategory(items: string[]) {
    const allCatSelected = items.every((b) => selectedBanks.includes(b));
    if (allCatSelected) {
      items.forEach((b) => { if (selectedBanks.includes(b)) toggleBank(b); });
    } else {
      items.forEach((b) => { if (!selectedBanks.includes(b)) toggleBank(b); });
    }
  }

  const canRequest = userName.trim() && birthDate.trim().length === 8 && phoneNo.trim().length >= 10 && selectedBanks.length > 0;

  // 간편인증 요청
  async function handleAuthRequest() {
    setAuthError('');
    setAuthStatus('requesting');
    clearPolling();

    try {
      const result = await workerApi.simpleAuthStart({
        userName: userName.trim(),
        birthDate: birthDate.trim(),
        phoneNo: phoneNo.replace(/-/g, '').trim(),
        provider: provider || '1',
        banks: selectedBanks,
      });

      if (result.status === 'done' && result.connectedId) {
        setConnectedId(result.connectedId);
        setAuthStatus('done');
      } else if (result.status === 'pending' && result.twoWayInfo) {
        setTwoWayInfo(result.twoWayInfo);
        setAuthStatus('pending');
        setAuthExpiry(Date.now() + AUTH_TIMEOUT_MS);
      } else {
        setAuthError(result.message || '인증 요청에 실패했습니다.');
        setAuthStatus('error');
      }
    } catch (err: any) {
      setAuthError(err.message ?? '인증 요청 중 오류가 발생했습니다.');
      setAuthStatus('error');
    }
  }

  // 수동 인증 확인 (버튼 클릭 시)
  async function handleAuthComplete() {
    if (!twoWayInfo) return;
    setAuthError('');
    try {
      const result = await workerApi.simpleAuthComplete({
        twoWayInfo,
        banks: selectedBanks,
        phoneNo: phoneNo.replace(/-/g, '').trim(),
        birthDate: birthDate.trim(),
        userName: userName.trim(),
        provider: provider || '1',
      });

      if (result.status === 'done' && result.connectedId) {
        clearPolling();
        setConnectedId(result.connectedId);
        setAuthStatus('done');
      } else if (result.status === 'pending') {
        setAuthError('아직 인증이 완료되지 않았습니다. 폰에서 인증을 완료해주세요.');
      } else {
        setAuthError(result.message || '인증 확인에 실패했습니다.');
        setAuthStatus('error');
      }
    } catch (err: any) {
      setAuthError(err.message ?? '인증 확인 중 오류가 발생했습니다.');
      setAuthStatus('error');
    }
  }

  // 인증 리셋 (다시 인증)
  function handleResetAuth() {
    clearPolling();
    setAuthStatus('idle');
    setTwoWayInfo(null);
    setConnectedId(null);
    setAuthExpiry(null);
    setAuthError('');
  }

  // 다음 단계 (수집)
  function handleProceed() {
    if (!connectedId) return;
    useCollectionStore.getState().setCredentials({
      loginType: 'simple',
      id: phoneNo,
      password: birthDate,
    });
    setStep(3);
  }

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isLocked = authStatus === 'pending' || authStatus === 'done';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* 이전 인증 재사용 안내 */}
      {connectedId && authStatus === 'idle' && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="text-blue-600" />
            <div className="flex-1">
              <p className="font-medium text-blue-800">이전 인증 정보가 있습니다</p>
              <p className="text-sm text-blue-600">이전에 인증한 정보로 바로 수집할 수 있습니다.</p>
            </div>
            <button
              onClick={handleProceed}
              className="rounded-lg px-4 py-2 text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              바로 수집
            </button>
          </div>
        </div>
      )}

      {/* 간편인증 정보 입력 */}
      <div className="rounded-xl bg-[var(--color-bg-card)] border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Smartphone size={20} className="text-[var(--color-brand-gold)]" />
          <h3 className="text-gray-900 font-semibold">간편인증</h3>
        </div>
        <p className="text-xs text-gray-500">
          본인 명의 스마트폰으로 인증합니다. 인증 요청 후 선택한 앱에서 인증을 완료해주세요.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">이름</label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="홍길동"
              disabled={isLocked}
              className="w-full rounded-lg bg-gray-100 border border-gray-300 px-4 py-2.5 text-sm text-gray-900
                placeholder-gray-500 focus:border-[var(--color-brand-gold)] focus:outline-none disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">생년월일 (8자리)</label>
            <input
              type="text"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="19900101"
              maxLength={8}
              disabled={isLocked}
              className="w-full rounded-lg bg-gray-100 border border-gray-300 px-4 py-2.5 text-sm text-gray-900
                placeholder-gray-500 focus:border-[var(--color-brand-gold)] focus:outline-none disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">전화번호</label>
            <input
              type="text"
              value={phoneNo}
              onChange={(e) => setPhoneNo(e.target.value.replace(/[^\d-]/g, '').slice(0, 13))}
              placeholder="01012345678"
              disabled={isLocked}
              className="w-full rounded-lg bg-gray-100 border border-gray-300 px-4 py-2.5 text-sm text-gray-900
                placeholder-gray-500 focus:border-[var(--color-brand-gold)] focus:outline-none disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">인증 앱</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              disabled={isLocked}
              className="w-full rounded-lg bg-gray-100 border border-gray-300 px-4 py-2.5 text-sm text-gray-900
                focus:border-[var(--color-brand-gold)] focus:outline-none disabled:opacity-50"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 금융기관 선택 */}
      <div className="rounded-xl bg-[var(--color-bg-card)] border border-gray-200 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-gray-900 font-semibold">수집 대상 금융기관</h3>
          <span className="text-xs text-gray-500">{selectedBanks.length}개 선택됨</span>
        </div>

        <button
          type="button"
          onClick={handleToggleAll}
          disabled={isLocked}
          className="flex items-center gap-2 pb-3 border-b border-gray-200 disabled:opacity-50"
        >
          {allSelected ? (
            <CheckSquare className="h-4 w-4 text-[var(--color-brand-gold)]" />
          ) : (
            <Square className="h-4 w-4 text-gray-500" />
          )}
          <span className="text-sm text-gray-700 font-medium">전체 선택</span>
        </button>

        {BANK_CATEGORIES.map((cat) => {
          const catAllSelected = cat.items.every((b) => selectedBanks.includes(b));
          return (
            <div key={cat.label} className="space-y-2">
              <button
                type="button"
                onClick={() => handleToggleCategory(cat.items)}
                disabled={isLocked}
                className="flex items-center gap-2 disabled:opacity-50"
              >
                {catAllSelected ? (
                  <CheckSquare className="h-3.5 w-3.5 text-[var(--color-brand-gold)]" />
                ) : (
                  <Square className="h-3.5 w-3.5 text-gray-400" />
                )}
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{cat.label}</span>
              </button>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {cat.items.map((bank) => {
                  const selected = selectedBanks.includes(bank);
                  return (
                    <button
                      key={bank}
                      type="button"
                      onClick={() => toggleBank(bank)}
                      disabled={isLocked}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors disabled:opacity-50 ${
                        selected
                          ? 'bg-[var(--color-brand-gold)]/10 border border-[var(--color-brand-gold)]/40 text-[var(--color-brand-gold)]'
                          : 'bg-gray-100 border border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {selected ? <CheckSquare className="h-4 w-4 shrink-0" /> : <Square className="h-4 w-4 shrink-0" />}
                      {bank}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 인증 대기 상태 (자동 폴링 + 타이머) */}
      {authStatus === 'pending' && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-6 space-y-3">
          <div className="flex items-center gap-3">
            <Loader2 size={24} className="text-amber-600 animate-spin" />
            <div className="flex-1">
              <p className="font-semibold text-amber-800">폰에서 인증을 완료해주세요</p>
              <p className="text-sm text-amber-700">
                {PROVIDERS.find(p => p.value === provider)?.label ?? '인증'} 앱에서 인증 요청을 확인해주세요.
              </p>
            </div>
            {remainingSec > 0 && (
              <span className="text-sm font-mono text-amber-600 font-bold">
                {formatTime(remainingSec)}
              </span>
            )}
          </div>
          <p className="text-xs text-amber-600">
            인증 완료를 자동으로 확인하고 있습니다. (3초마다 확인)
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleAuthComplete}
              className="flex-1 rounded-lg bg-amber-600 py-3 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
            >
              수동 확인
            </button>
            <button
              onClick={handleResetAuth}
              className="rounded-lg px-4 py-3 text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw size={14} /> 다시 인증
            </button>
          </div>
        </div>
      )}

      {/* 인증 완료 */}
      {authStatus === 'done' && connectedId && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={24} className="text-green-600" />
            <div className="flex-1">
              <p className="font-semibold text-green-800">간편인증 완료</p>
              <p className="text-sm text-green-700">금융데이터 수집을 시작할 수 있습니다.</p>
            </div>
            <button
              onClick={handleResetAuth}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              다시 인증
            </button>
          </div>
        </div>
      )}

      {/* 에러 */}
      {authError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {authError}
        </div>
      )}

      {/* 버튼 */}
      <div className="flex justify-between">
        <button
          onClick={() => setStep(1)}
          className="rounded-lg px-6 py-3 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          이전
        </button>

        {authStatus === 'idle' || authStatus === 'error' || authStatus === 'requesting' ? (
          <button
            disabled={!canRequest || authStatus === 'requesting'}
            onClick={handleAuthRequest}
            className="rounded-lg px-8 py-3 font-semibold text-sm transition-colors
              enabled:bg-[var(--color-brand-gold)] enabled:text-[var(--color-brand-navy)]
              enabled:hover:brightness-110
              disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed"
          >
            {authStatus === 'requesting' ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" /> 요청 중...
              </span>
            ) : (
              '간편인증 요청'
            )}
          </button>
        ) : authStatus === 'done' ? (
          <button
            onClick={handleProceed}
            className="rounded-lg px-8 py-3 font-semibold text-sm bg-[var(--color-brand-gold)] text-[var(--color-brand-navy)] hover:brightness-110 transition-colors"
          >
            수집 시작
          </button>
        ) : null}
      </div>
    </div>
  );
}
