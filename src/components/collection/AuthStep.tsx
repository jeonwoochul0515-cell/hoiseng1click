import { useState, useEffect, useRef, useCallback } from 'react';
import { useCollectionStore } from '@/store/collectionStore';
import { CheckSquare, Square, Smartphone, Loader2, CheckCircle2, RefreshCw, AlertCircle, KeyRound, Shield, FileText } from 'lucide-react';
import { workerApi } from '@/api/worker';

/** 인증 방법 */
type AuthMethod = 'simple' | 'cert' | 'manual' | 'skip';

const PROVIDERS = [
  { value: '1', label: '카카오톡', icon: '💬' },
  { value: '5', label: 'PASS (통신사)', icon: '📱' },
  { value: '6', label: '네이버', icon: '🟢' },
  { value: '8', label: '토스', icon: '💙' },
  { value: '4', label: 'KB모바일', icon: '🏦' },
  { value: '2', label: '페이코', icon: '💳' },
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

const AUTH_TIMEOUT_MS = 10 * 60 * 1000;
const POLL_INTERVAL_MS = 3000;

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
  const [authMethod, setAuthMethod] = useState<AuthMethod>('cert');  // 기본: 공동인증서
  const [certPw, setCertPw] = useState('');           // 인증서 비밀번호
  const [derFile, setDerFile] = useState('');         // signCert.der (Base64)
  const [keyFile, setKeyFile] = useState('');         // signPri.key (Base64)
  const [derFileName, setDerFileName] = useState('');
  const [keyFileName, setKeyFileName] = useState('');
  const [remainingSec, setRemainingSec] = useState(0);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const allItems = BANK_CATEGORIES.flatMap((c) => c.items);
  const allSelected = allItems.every((b) => selectedBanks.includes(b));

  const clearPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => () => clearPolling(), [clearPolling]);

  // 인증 만료 타이머
  useEffect(() => {
    if (!authExpiry || authStatus !== 'pending') { setRemainingSec(0); return; }
    function tick() {
      const remaining = Math.max(0, Math.ceil((authExpiry! - Date.now()) / 1000));
      setRemainingSec(remaining);
      if (remaining <= 0) {
        clearPolling();
        setAuthStatus('error');
        setAuthError('인증 시간이 만료되었습니다. 다시 시도해주세요.');
        setTwoWayInfo(null);
        setAuthExpiry(null);
      }
    }
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [authExpiry, authStatus, clearPolling, setAuthStatus, setAuthExpiry, setTwoWayInfo]);

  // 자동 폴링
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
      } catch { /* 네트워크 에러 무시, 계속 폴링 */ }
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

  // 간편인증 요청
  async function handleAuthRequest() {
    if (!userName.trim()) { setAuthError('이름을 입력해주세요.'); return; }
    if (birthDate.trim().length !== 8) { setAuthError('생년월일 8자리를 입력해주세요.'); return; }
    if (phoneNo.replace(/-/g, '').length < 10) { setAuthError('전화번호를 입력해주세요.'); return; }
    if (selectedBanks.length === 0) { setAuthError('금융기관을 1개 이상 선택해주세요.'); return; }

    setAuthError('');
    setLoading(true);
    setAuthStatus('requesting');
    clearPolling();

    try {
      console.log('[AuthStep] 간편인증 요청 시작:', { userName: userName.trim(), birthDate: birthDate.trim(), phoneNo: phoneNo.replace(/-/g, '').trim(), provider, banks: selectedBanks.length });

      const result = await workerApi.simpleAuthStart({
        userName: userName.trim(),
        birthDate: birthDate.trim(),
        phoneNo: phoneNo.replace(/-/g, '').trim(),
        provider: provider || '1',
        banks: selectedBanks,
      });

      console.log('[AuthStep] 간편인증 응답:', result);

      if (result.status === 'done' && result.connectedId) {
        setConnectedId(result.connectedId);
        setAuthStatus('done');
      } else if (result.status === 'pending' && result.twoWayInfo) {
        setTwoWayInfo(result.twoWayInfo);
        setAuthStatus('pending');
        setAuthExpiry(Date.now() + AUTH_TIMEOUT_MS);
      } else {
        setAuthError((result as any).message || (result as any).error || '인증 요청에 실패했습니다. 다시 시도해주세요.');
        setAuthStatus('error');
      }
    } catch (err: any) {
      console.error('[AuthStep] 간편인증 에러:', err);
      setAuthError(err.message ?? '인증 요청 중 오류가 발생했습니다.');
      setAuthStatus('error');
    } finally {
      setLoading(false);
    }
  }

  // 공동인증서 인증 요청
  // 파일을 Base64로 읽기
  function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // data:application/octet-stream;base64,XXXX → XXXX 부분만
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleCertAuth() {
    if (!derFile) { setAuthError('인증서 파일(signCert.der)을 선택해주세요.'); return; }
    if (!keyFile) { setAuthError('개인키 파일(signPri.key)을 선택해주세요.'); return; }
    if (!certPw.trim()) { setAuthError('인증서 비밀번호를 입력해주세요.'); return; }
    if (selectedBanks.length === 0) { setAuthError('금융기관을 1개 이상 선택해주세요.'); return; }

    setAuthError('');
    setLoading(true);
    setAuthStatus('requesting');

    try {
      console.log('[AuthStep] 공동인증서 인증 요청 (파일 업로드 방식)');

      // 서버에서 der+key → PFX 변환 후 CODEF API 호출
      const result = await workerApi.codefCollect({
        clientId: '',
        authMethod: 'cert',
        credentials: {
          loginType: 'cert',
          id: '',
          password: certPw.trim(),
          derFile,
          keyFile,
        },
        banks: selectedBanks,
        certAuth: true,
      } as any);

      console.log('[AuthStep] 공동인증서 응답:', result);

      if (result.connectedId) {
        setConnectedId(result.connectedId);
        useCollectionStore.getState().setCredentials({
          loginType: 'cert',
          id: '',
          password: certPw.trim(),
        });
        setAuthStatus('done');
        if (result.debts || result.assets) {
          useCollectionStore.getState().setResult({
            debts: result.debts || [],
            assets: result.assets || [],
            summary: result.summary || {},
            connectedId: result.connectedId,
          });
        }
      } else {
        setAuthError('인증에 실패했습니다. 인증서 파일과 비밀번호를 확인해주세요.');
        setAuthStatus('error');
      }
    } catch (err: any) {
      console.error('[AuthStep] 공동인증서 에러:', err);
      setAuthError(err.message ?? '공동인증서 인증 중 오류가 발생했습니다.');
      setAuthStatus('error');
    } finally {
      setLoading(false);
    }
  }

  // 수동 인증 확인
  async function handleAuthComplete() {
    if (!twoWayInfo) return;
    setAuthError('');
    setLoading(true);
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
        setAuthError('아직 인증이 완료되지 않았습니다. 앱에서 인증을 완료해주세요.');
      } else {
        setAuthError((result as any).message || '인증 확인에 실패했습니다.');
        setAuthStatus('error');
      }
    } catch (err: any) {
      setAuthError(err.message ?? '인증 확인 중 오류가 발생했습니다.');
      setAuthStatus('error');
    } finally {
      setLoading(false);
    }
  }

  // 수동 입력으로 건너뛰기 (인증 없이 수동 데이터)
  function handleSkipAuth() {
    if (selectedBanks.length === 0) { setAuthError('금융기관을 1개 이상 선택해주세요.'); return; }
    // 가상 connectedId 생성 (수동 모드)
    setConnectedId(`manual-${Date.now()}`);
    useCollectionStore.getState().setCredentials({
      loginType: 'manual',
      id: phoneNo,
      password: birthDate,
    });
    setAuthStatus('done');
    setAuthError('');
  }

  function handleResetAuth() {
    clearPolling();
    setAuthStatus('idle');
    setTwoWayInfo(null);
    setConnectedId(null);
    setAuthExpiry(null);
    setAuthError('');
    setLoading(false);
  }

  function handleProceed() {
    if (!connectedId) {
      setAuthError('인증을 먼저 완료해주세요.');
      return;
    }
    if (selectedBanks.length === 0) {
      setAuthError('금융기관을 1개 이상 선택해주세요.');
      return;
    }
    if (authMethod === 'cert') {
      // 공동인증서는 이미 credentials 설정됨 + 수집 완료일 수 있음
      const store = useCollectionStore.getState();
      if (store.result) {
        // 이미 수집 완료 → Step 4(결과)로 바로 이동
        setStep(4);
        return;
      }
    }
    useCollectionStore.getState().setCredentials({
      loginType: authMethod === 'cert' ? 'cert' : 'simple',
      id: phoneNo,
      password: authMethod === 'cert' ? certPw : birthDate,
    });
    setStep(3);
  }

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isLocked = authStatus === 'pending' || authStatus === 'done';
  const hasBasicInfo = userName.trim().length > 0 && birthDate.trim().length === 8 && phoneNo.replace(/-/g, '').length >= 10;

  return (
    <div className="mx-auto max-w-2xl space-y-6">

      {/* 인증 방법 선택 */}
      <div className="rounded-xl bg-white border border-gray-200 p-6 space-y-4">
        <h3 className="text-gray-900 font-semibold flex items-center gap-2">
          <Shield size={20} className="text-amber-500" />
          인증 방법 선택
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            { id: 'cert' as AuthMethod, icon: <KeyRound size={20} />, label: '공동인증서', desc: 'PC에서 인증서로 인증 (권장)' },
            { id: 'simple' as AuthMethod, icon: <Smartphone size={20} />, label: '간편인증', desc: '앱으로 본인인증' },
            { id: 'manual' as AuthMethod, icon: <Shield size={20} />, label: '수동 입력', desc: '직접 입력 (인증 불필요)' },
            { id: 'skip' as AuthMethod, icon: <Shield size={20} />, label: '데모', desc: '데모 데이터 테스트' },
          ]).map(m => (
            <button
              key={m.id}
              onClick={() => { setAuthMethod(m.id); if (m.id !== 'simple' && m.id !== 'cert') handleResetAuth(); }}
              disabled={isLocked}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all text-center disabled:opacity-50 ${
                authMethod === m.id
                  ? 'border-amber-400 bg-amber-50 text-amber-800'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {m.icon}
              <span className="text-sm font-semibold">{m.label}</span>
              <span className="text-xs text-gray-500">{m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 공동인증서 인증 */}
      {authMethod === 'cert' && (
        <div className="rounded-xl bg-white border border-gray-200 p-6 space-y-4">
          <h3 className="text-gray-900 font-semibold flex items-center gap-2">
            <KeyRound size={18} className="text-blue-500" />
            공동인증서 인증
          </h3>
          <p className="text-xs text-gray-500">
            의뢰인의 공동인증서(구 공인인증서) 파일로 인증합니다. USB 또는 PC에 저장된 인증서 파일을 선택하세요.
          </p>
          <div className="grid grid-cols-1 gap-3">
            {/* DER 파일 */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">인증서 파일 (signCert.der) *</label>
              <label className={`flex items-center gap-2 w-full rounded-lg border-2 border-dashed px-4 py-3 text-sm cursor-pointer transition-colors ${
                derFile ? 'border-green-400 bg-green-50 text-green-700' : 'border-gray-300 text-gray-500 hover:border-blue-400'
              } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <FileText size={16} />
                {derFileName || '파일 선택...'}
                <input type="file" accept=".der,.cer,.crt" className="hidden" disabled={isLocked}
                  onChange={async e => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const b64 = await readFileAsBase64(f);
                      setDerFile(b64);
                      setDerFileName(f.name);
                    }
                  }} />
              </label>
            </div>
            {/* KEY 파일 */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">개인키 파일 (signPri.key) *</label>
              <label className={`flex items-center gap-2 w-full rounded-lg border-2 border-dashed px-4 py-3 text-sm cursor-pointer transition-colors ${
                keyFile ? 'border-green-400 bg-green-50 text-green-700' : 'border-gray-300 text-gray-500 hover:border-blue-400'
              } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <KeyRound size={16} />
                {keyFileName || '파일 선택...'}
                <input type="file" accept=".key,.pri" className="hidden" disabled={isLocked}
                  onChange={async e => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const b64 = await readFileAsBase64(f);
                      setKeyFile(b64);
                      setKeyFileName(f.name);
                    }
                  }} />
              </label>
            </div>
            {/* 비밀번호 */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">인증서 비밀번호 *</label>
              <input type="password" value={certPw} onChange={e => setCertPw(e.target.value)}
                placeholder="공동인증서 비밀번호" disabled={isLocked}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 focus:outline-none disabled:opacity-50 disabled:bg-gray-50" />
            </div>
          </div>

          <div className="rounded-lg bg-blue-50 p-3">
            <p className="text-xs text-blue-700">
              <strong>안내:</strong> 인증서 파일은 서버에 저장되지 않으며 1회 인증에만 사용됩니다.
              인증 완료 후 금융데이터 + 공공서류가 한 번에 수집됩니다.
            </p>
          </div>

          <div className="text-xs text-gray-400">
            인증서 위치: <code>C:\Users\이름\AppData\LocalLow\NPKI\...</code> 또는 USB
          </div>

          {authStatus !== 'done' && (
            <button
              onClick={handleCertAuth}
              disabled={loading || !derFile || !keyFile || !certPw.trim() || selectedBanks.length === 0}
              className="w-full rounded-lg bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> 인증 중...</span>
              ) : selectedBanks.length === 0 ? (
                '금융기관을 먼저 선택해주세요'
              ) : (
                `🔐 공동인증서로 ${selectedBanks.length}개 기관 인증 + 수집`
              )}
            </button>
          )}
        </div>
      )}

      {/* 간편인증 정보 입력 */}
      {authMethod === 'simple' && (
        <div className="rounded-xl bg-white border border-gray-200 p-6 space-y-4">
          <h3 className="text-gray-900 font-semibold">간편인증 정보</h3>
          <p className="text-xs text-gray-500">
            본인 명의 스마트폰으로 인증합니다. 요청 후 선택한 앱에서 인증을 완료해주세요.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">이름 *</label>
              <input type="text" value={userName} onChange={e => setUserName(e.target.value)}
                placeholder="홍길동" disabled={isLocked}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none disabled:opacity-50 disabled:bg-gray-50" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">생년월일 (8자리) *</label>
              <input type="text" value={birthDate} onChange={e => setBirthDate(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="19900101" maxLength={8} disabled={isLocked}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none disabled:opacity-50 disabled:bg-gray-50" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">전화번호 *</label>
              <input type="text" value={phoneNo} onChange={e => setPhoneNo(e.target.value.replace(/[^\d-]/g, '').slice(0, 13))}
                placeholder="01012345678" disabled={isLocked}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none disabled:opacity-50 disabled:bg-gray-50" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">인증 앱</label>
              <select value={provider} onChange={e => setProvider(e.target.value)} disabled={isLocked}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none disabled:opacity-50 disabled:bg-gray-50">
                {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.icon} {p.label}</option>)}
              </select>
            </div>
          </div>

          {/* 간편인증 요청 버튼 */}
          {authStatus !== 'done' && authStatus !== 'pending' && (
            <button
              onClick={handleAuthRequest}
              disabled={loading || !hasBasicInfo}
              className="w-full rounded-lg bg-amber-500 py-3 text-sm font-bold text-white hover:bg-amber-600 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> 요청 중...</span>
              ) : !hasBasicInfo ? (
                '이름, 생년월일, 전화번호를 입력해주세요'
              ) : (
                `📱 ${PROVIDERS.find(p => p.value === provider)?.label ?? '간편인증'} 인증 요청`
              )}
            </button>
          )}
        </div>
      )}

      {/* 금융기관 선택 */}
      <div className="rounded-xl bg-white border border-gray-200 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-gray-900 font-semibold">수집 대상 금융기관</h3>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">{selectedBanks.length}개</span>
        </div>

        <button type="button" onClick={handleToggleAll} disabled={isLocked}
          className="flex items-center gap-2 pb-3 border-b border-gray-200 disabled:opacity-50">
          {allSelected
            ? <CheckSquare className="h-4 w-4 text-amber-500" />
            : <Square className="h-4 w-4 text-gray-400" />}
          <span className="text-sm text-gray-700 font-medium">전체 선택</span>
        </button>

        {BANK_CATEGORIES.map(cat => {
          const catAllSelected = cat.items.every(b => selectedBanks.includes(b));
          return (
            <div key={cat.label} className="space-y-2">
              <button type="button" onClick={() => handleToggleCategory(cat.items)} disabled={isLocked}
                className="flex items-center gap-2 disabled:opacity-50">
                {catAllSelected
                  ? <CheckSquare className="h-3.5 w-3.5 text-amber-500" />
                  : <Square className="h-3.5 w-3.5 text-gray-400" />}
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{cat.label}</span>
              </button>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {cat.items.map(bank => {
                  const selected = selectedBanks.includes(bank);
                  return (
                    <button key={bank} type="button" onClick={() => toggleBank(bank)} disabled={isLocked}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors disabled:opacity-50 ${
                        selected
                          ? 'bg-amber-50 border border-amber-300 text-amber-700 font-medium'
                          : 'bg-gray-50 border border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}>
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

      {/* 인증 대기 상태 */}
      {authStatus === 'pending' && (
        <div className="rounded-xl bg-amber-50 border border-amber-300 p-6 space-y-3">
          <div className="flex items-center gap-3">
            <Loader2 size={24} className="text-amber-600 animate-spin" />
            <div className="flex-1">
              <p className="font-semibold text-amber-800">폰에서 인증을 완료해주세요</p>
              <p className="text-sm text-amber-700">
                {PROVIDERS.find(p => p.value === provider)?.label} 앱을 확인해주세요.
              </p>
            </div>
            {remainingSec > 0 && (
              <span className="text-lg font-mono text-amber-600 font-bold">{formatTime(remainingSec)}</span>
            )}
          </div>
          <p className="text-xs text-amber-600">자동 확인 중 (3초마다)</p>
          <div className="flex gap-3">
            <button onClick={handleAuthComplete} disabled={loading}
              className="flex-1 rounded-lg bg-amber-500 py-3 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors">
              {loading ? '확인 중...' : '수동 확인'}
            </button>
            <button onClick={handleResetAuth}
              className="rounded-lg px-4 py-3 text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-1.5">
              <RefreshCw size={14} /> 다시
            </button>
          </div>
        </div>
      )}

      {/* 인증 완료 */}
      {authStatus === 'done' && connectedId && (
        <div className="rounded-xl bg-green-50 border border-green-300 p-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={24} className="text-green-600" />
            <div className="flex-1">
              <p className="font-semibold text-green-800">
                {authMethod === 'skip' ? '데모 모드 준비 완료' : authMethod === 'manual' ? '수동 입력 모드' : '간편인증 완료'}
              </p>
              <p className="text-sm text-green-700">금융데이터 수집을 시작할 수 있습니다.</p>
            </div>
            <button onClick={handleResetAuth} className="text-xs text-gray-500 hover:text-gray-700 underline">초기화</button>
          </div>
        </div>
      )}

      {/* 에러 */}
      {authError && (
        <div className="rounded-xl bg-red-50 border border-red-300 px-4 py-3 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-600">{authError}</p>
        </div>
      )}

      {/* 하단 버튼 */}
      <div className="flex justify-between">
        <button onClick={() => setStep(1)}
          className="rounded-lg px-6 py-3 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
          이전
        </button>

        {authStatus === 'done' ? (
          <button onClick={handleProceed}
            className="rounded-lg px-8 py-3 font-bold text-sm bg-amber-500 text-white hover:bg-amber-600 transition-colors">
            수집 시작 →
          </button>
        ) : authMethod === 'manual' ? (
          <button onClick={handleSkipAuth} disabled={selectedBanks.length === 0}
            className="rounded-lg px-8 py-3 font-bold text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors">
            수동 입력으로 진행
          </button>
        ) : authMethod === 'skip' ? (
          <button onClick={handleSkipAuth} disabled={selectedBanks.length === 0}
            className="rounded-lg px-8 py-3 font-bold text-sm bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors">
            데모 데이터로 진행
          </button>
        ) : null}
      </div>
    </div>
  );
}
