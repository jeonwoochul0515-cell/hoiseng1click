import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Scale, ChevronRight, ChevronLeft, Plus, Trash2,
  CheckCircle, AlertCircle, Send, Shield, Lock, Download,
  CheckSquare, Square, Clock, Loader2, CheckCircle2, XCircle,
} from 'lucide-react';
import { verifyIntakePin, submitIntake, getIntakeToken, type IntakeToken } from '@/api/intake';
import { openAddressSearch } from '@/utils/address';
import { getCourtByAddress } from '@/utils/courtMap';
import { findCreditor } from '@/utils/creditorDirectory';
import CreditPdfUpload from '@/components/collection/CreditPdfUpload';

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Step = 'pin' | 'consent' | 'auth' | 'collect' | 'review' | 'submit';

const FORM_STEPS: { id: Exclude<Step, 'pin'>; label: string }[] = [
  { id: 'consent', label: '동의' },
  { id: 'auth', label: '인증' },
  { id: 'collect', label: '수집' },
  { id: 'review', label: '확인' },
  { id: 'submit', label: '전송' },
];

type JobType = 'employed' | 'self' | 'freelance' | 'daily' | 'unemployed';
const JOB_LABELS: Record<JobType, string> = {
  employed: '급여소득자', self: '자영업', freelance: '프리랜서', daily: '일용직', unemployed: '무직',
};

type DebtType = '무담보' | '담보' | '사채';
type AssetType = '부동산' | '차량' | '예금' | '보험' | '증권' | '기타';

interface DebtRow {
  _key: number;
  creditor: string;
  type: DebtType;
  amount: number;
  rate: number;
  monthly: number;
  source: 'codef' | 'manual';
  originalDate?: string;
  originalAmount?: number;
  creditorAddress?: string;
  creditorPhone?: string;
  creditorFax?: string;
}
interface AssetRow {
  _key: number;
  name: string;
  type: AssetType;
  rawValue: number;
  memo: string;
  source: 'codef' | 'manual';
  meta?: {
    plate?: string;
    year?: number;
    address?: string;
    bankName?: string;
    accountLast4?: string;
    insurerName?: string;
  };
}

const CONSENT_LABELS = [
  '서비스 이용약관 동의',
  '개인정보 수집·이용 동의',
  '개인신용정보 전송요구권 행사 동의',
  'CODEF 중계기관을 통한 금융데이터 수집 동의',
  '크레딧포유 개인신용정보 조회 동의',
];

// CODEF 간편인증(사설인증서) 앱 목록 — ID 코드는 CODEF API simpleAuth 파라미터 값
const SIMPLE_AUTH_APPS: { key: string; code: string; label: string; icon: string; color: string }[] = [
  // 메이저 3사
  { key: 'kakao',   code: '1',  label: '카카오톡',  icon: '💬', color: '#FEE500' },
  { key: 'naver',   code: '6',  label: '네이버',    icon: '🟢', color: '#03C75A' },
  { key: 'toss',    code: '8',  label: '토스',      icon: '💙', color: '#0064FF' },
  // 통신/기타
  { key: 'pass',    code: '5',  label: 'PASS',     icon: '📱', color: '#E52228' },
  { key: 'payco',   code: '2',  label: 'PAYCO',    icon: '🔴', color: '#E21818' },
  { key: 'samsung', code: '3',  label: '삼성패스',  icon: '🔵', color: '#1428A0' },
  // 금융권
  { key: 'kb',      code: '4',  label: 'KB인증서',  icon: '⭐', color: '#FFBC00' },
  { key: 'shinhan', code: '7',  label: '신한인증서', icon: '🏦', color: '#0046FF' },
  { key: 'hana',    code: '9',  label: '하나인증서', icon: '🟠', color: '#009B8D' },
  { key: 'nh',      code: '10', label: 'NH인증서',  icon: '🌾', color: '#01A651' },
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
const BANKS = BANK_CATEGORIES.flatMap(c => c.items);

// Firebase Functions URL
function getApiBase(): string {
  if (import.meta.env.DEV) {
    return import.meta.env.VITE_WORKER_BASE_URL || 'http://127.0.0.1:5001/hoiseng1click/asia-northeast3/api';
  }
  return 'https://api-m5vtpzqugq-du.a.run.app';
}
const API_BASE = getApiBase();

type BankStatus = 'waiting' | 'collecting' | 'done' | 'error';

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function IntakePage() {
  const { token } = useParams<{ token: string }>();
  const [tokenData, setTokenData] = useState<IntakeToken | null>(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('pin');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // PIN state
  const [pinDigits, setPinDigits] = useState<string[]>(['', '', '', '']);
  const [pinError, setPinError] = useState('');
  const [pinVerifying, setPinVerifying] = useState(false);
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  // Consent state
  const [consents, setConsents] = useState<boolean[]>([false, false, false, false, false]);

  // Auth state
  const [authApp, setAuthApp] = useState('kakao');
  const [authMode, setAuthMode] = useState<'simple' | 'cert'>('simple');
  const [certId, setCertId] = useState('');
  const [certPw, setCertPw] = useState('');
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [authStatus, setAuthStatus] = useState<'idle' | 'requesting' | 'pending' | 'done' | 'error'>('idle');
  const [authError, setAuthError] = useState('');
  const [twoWayInfo, setTwoWayInfo] = useState<any>(null);
  const authPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Collect state
  const [collectProgress, setCollectProgress] = useState(0);
  const [bankStatuses, setBankStatuses] = useState<Record<string, BankStatus>>({});
  const [connectedId, setConnectedId] = useState('');
  const collectStarted = useRef(false);

  // Form state
  const [name, setName] = useState('');
  const [ssn, setSsn] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [zonecode, setZonecode] = useState('');
  const [court, setCourt] = useState('');
  const [job, setJob] = useState('');
  const [jobType, setJobType] = useState<JobType>('employed');
  const [family, setFamily] = useState(1);
  const [income, setIncome] = useState(0);
  const [income2, setIncome2] = useState(0);
  const [rent, setRent] = useState(0);
  const [education, setEducation] = useState(0);
  const [medical, setMedical] = useState(0);
  const [food, setFood] = useState(0);
  const [transport, setTransport] = useState(0);
  const [telecom, setTelecom] = useState(0);
  const [familyMembers, setFamilyMembers] = useState<{relation:string; name:string; age:number; hasIncome:boolean}[]>([]);
  const [showFamilyDetail, setShowFamilyDetail] = useState(false);
  const [memo, setMemo] = useState('');

  const nextId = useRef(0);
  const [debts, setDebts] = useState<DebtRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);

  const isDemo = import.meta.env.DEV && token === 'demo';
  const [tokenLoading, setTokenLoading] = useState(!isDemo);
  const [tokenInvalid, setTokenInvalid] = useState('');

  // 페이지 로드 시 토큰 유효성 사전 검증
  useEffect(() => {
    if (isDemo || !token) return;
    (async () => {
      try {
        const t = await getIntakeToken(token);
        if (!t) { setTokenInvalid('유효하지 않은 링크입니다.'); }
        else if (t.used) { setTokenInvalid('이미 사용된 링크입니다.'); }
        else if (t.expiresAt.toDate().getTime() < Date.now()) { setTokenInvalid('만료된 링크입니다. 사무소에 새 링크를 요청하세요.'); }
      } catch { setTokenInvalid('링크 확인 중 오류가 발생했습니다.'); }
      finally { setTokenLoading(false); }
    })();
  }, [token, isDemo]);

  // ---------------------------------------------------------------------------
  // PWA install prompt
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    await deferredPrompt.current.userChoice;
    deferredPrompt.current = null;
    setShowInstallBanner(false);
  };

  // ---------------------------------------------------------------------------
  // PIN input
  // ---------------------------------------------------------------------------
  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...pinDigits];
    newDigits[index] = value.slice(-1);
    setPinDigits(newDigits);
    setPinError('');
    if (value && index < 3) {
      pinRefs.current[index + 1]?.focus();
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      pinRefs.current[index - 1]?.focus();
    }
  };

  const handlePinSubmit = async () => {
    const pin = pinDigits.join('');
    if (pin.length !== 4 || !token) return;
    setPinVerifying(true);
    setPinError('');

    if (isDemo) {
      if (pin === '1234') {
        setTokenData({
          id: 'demo',
          officeId: 'demo',
          officeName: '법무사 데모 사무소',
          pinHash: 'demo',
          clientName: '홍길동',
          clientPhone: '010-1234-5678',
          createdAt: { toDate: () => new Date() } as any,
          expiresAt: { toDate: () => new Date(Date.now() + 86400000) } as any,
          used: false,
        });
        setName('홍길동');
        setPhone('010-1234-5678');
        setStep('consent');
      } else {
        setPinError('데모 비밀번호: 1234');
        setPinDigits(['', '', '', '']);
        pinRefs.current[0]?.focus();
      }
      setPinVerifying(false);
      return;
    }

    try {
      const result = await verifyIntakePin(token, pin);
      if (result.ok) {
        setTokenData(result.token);
        if (result.token.clientName) setName(result.token.clientName);
        if (result.token.clientPhone) setPhone(result.token.clientPhone);
        setStep('consent');
      } else {
        const msgs: Record<string, string> = {
          not_found: '유효하지 않은 링크입니다. 사무소에 문의하세요.',
          used: '이미 사용된 링크입니다. 새 링크를 요청하세요.',
          expired: '만료된 링크입니다. 사무소에 새 링크를 요청하세요.',
          wrong_pin: '비밀번호가 올바르지 않습니다.',
        };
        setPinError(msgs[result.reason]);
        setPinDigits(['', '', '', '']);
        pinRefs.current[0]?.focus();
      }
    } catch {
      setPinError('확인 중 오류가 발생했습니다');
    } finally {
      setPinVerifying(false);
    }
  };

  useEffect(() => {
    if (pinDigits.every(d => d !== '') && step === 'pin' && !pinVerifying) {
      handlePinSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinDigits]);

  // ---------------------------------------------------------------------------
  // Consent helpers
  // ---------------------------------------------------------------------------
  const allConsented = consents.every(Boolean);

  const toggleConsent = (i: number) => {
    setConsents(prev => prev.map((v, idx) => idx === i ? !v : v));
  };

  const toggleAllConsents = () => {
    const next = !allConsented;
    setConsents(consents.map(() => next));
  };

  // ---------------------------------------------------------------------------
  // Auth / bank helpers
  // ---------------------------------------------------------------------------
  const allBanksSelected = BANKS.every(b => selectedBanks.includes(b));

  const toggleBank = (bank: string) => {
    setSelectedBanks(prev =>
      prev.includes(bank) ? prev.filter(b => b !== bank) : [...prev, bank]
    );
  };

  const toggleAllBanks = () => {
    if (allBanksSelected) {
      setSelectedBanks([]);
    } else {
      setSelectedBanks([...BANKS]);
    }
  };

  // 간편인증 요청 (IntakePage용 — 공개 엔드포인트 사용)
  const API_BASE = import.meta.env.VITE_WORKER_BASE_URL ?? '';

  const handleStartAuth = async () => {
    if (selectedBanks.length === 0) {
      setAuthError('금융기관을 먼저 선택해주세요.');
      return;
    }
    if (authMode === 'cert' && (!certId.trim() || !certPw.trim())) {
      setAuthError('인증서 ID와 비밀번호를 입력해주세요.');
      return;
    }
    if (authMode === 'simple' && !name.trim()) {
      setAuthError('이름을 입력해주세요.');
      return;
    }
    setAuthError('');
    setAuthStatus('requesting');

    // 샌드박스/데모 모드에서는 바로 완료 처리
    if (isDemo || !API_BASE) {
      await new Promise(r => setTimeout(r, 1000));
      setConnectedId(`demo-${Date.now()}`);
      setAuthStatus('done');
      return;
    }

    try {
      const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };

      const credentials = authMode === 'cert'
        ? { loginType: 'cert', id: certId.trim(), password: certPw.trim() }
        : {
            loginType: 'simpleAuth',
            simpleAuthCode: SIMPLE_AUTH_APPS.find(a => a.key === authApp)?.code ?? '1',
            userName: name.trim(),
            phoneNo: phone.replace(/-/g, '').trim(),
            birthDate: ssn.replace(/-/g, '').slice(0, 8),
          };

      const res = await fetch(`${API_BASE}/intake/codef-collect`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          tokenId: token,
          mode: authMode === 'cert' ? 'cert-auth' : 'auth-only',
          credentials,
          banks: selectedBanks,
        }),
      });
      const data = await res.json();

      if (data.connectedId) {
        setConnectedId(data.connectedId);
        setAuthStatus('done');
      } else if (data.twoWayInfo) {
        setTwoWayInfo(data.twoWayInfo);
        setAuthStatus('pending');
        // 자동 폴링 시작
        startAuthPolling(data.twoWayInfo);
      } else {
        // 서버가 샌드박스 모드로 데모 데이터를 반환한 경우
        if (data.debts || data.assets) {
          setConnectedId(`sandbox-${Date.now()}`);
          setAuthStatus('done');
        } else {
          setAuthError(data.error || data.message || '인증 요청에 실패했습니다.');
          setAuthStatus('error');
        }
      }
    } catch (err: any) {
      setAuthError(err.message ?? '인증 요청 중 오류가 발생했습니다.');
      setAuthStatus('error');
    }
  };

  const startAuthPolling = (twInfo: any) => {
    if (authPollRef.current) clearInterval(authPollRef.current);
    authPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/intake/codef-collect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tokenId: token,
            mode: 'auth-complete',
            twoWayInfo: twInfo,
            credentials: {
              loginType: 'simpleAuth',
              simpleAuthCode: SIMPLE_AUTH_APPS.find(a => a.key === authApp)?.code ?? '1',
              userName: name.trim(),
              phoneNo: phone.replace(/-/g, '').trim(),
              birthDate: ssn.replace(/-/g, '').slice(0, 8),
            },
            banks: selectedBanks,
          }),
        });
        const data = await res.json();
        if (data.connectedId) {
          if (authPollRef.current) clearInterval(authPollRef.current);
          setConnectedId(data.connectedId);
          setAuthStatus('done');
          setAuthError('');
        }
      } catch { /* 네트워크 에러 무시 */ }
    }, 3000);
  };

  // 클린업
  useEffect(() => {
    return () => { if (authPollRef.current) clearInterval(authPollRef.current); };
  }, []);

  const canStartCollect = selectedBanks.length > 0 && authStatus === 'done' && !!connectedId;

  // ---------------------------------------------------------------------------
  // CODEF collection
  // ---------------------------------------------------------------------------
  const setBankStatus = (bank: string, status: BankStatus) => {
    setBankStatuses(prev => ({ ...prev, [bank]: status }));
  };

  useEffect(() => {
    if (step !== 'collect' || collectStarted.current) return;
    collectStarted.current = true;

    // Initialize statuses
    selectedBanks.forEach(b => setBankStatus(b, 'waiting'));

    if (isDemo) {
      runSimulation();
    } else {
      runRealCollection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function runRealCollection() {
    const simHandle = simulateProgress();
    try {
      const res = await fetch(`${API_BASE}/intake/codef-collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenId: token,
          credentials: {
            loginType: 'simpleAuth',
            simpleAuthCode: SIMPLE_AUTH_APPS.find(a => a.key === authApp)?.code ?? '1',
          },
          banks: selectedBanks,
        }),
      });

      clearInterval(simHandle);

      if (!res.ok) throw new Error('API error');

      const data = await res.json() as {
        connectedId: string;
        debts: Array<{ creditor: string; type: DebtType; amount: number; rate: number; monthly: number }>;
        assets: Array<{ name: string; type: AssetType; rawValue: number }>;
        summary: { totalDebt: number; totalDebtCount: number; totalAsset: number; totalAssetCount: number };
      };

      // Finalize
      setCollectProgress(100);
      selectedBanks.forEach(b => setBankStatus(b, 'done'));
      setConnectedId(data.connectedId || '');

      // Map CODEF debts/assets into local state
      setDebts(data.debts.map((d) => ({
        _key: nextId.current++,
        creditor: d.creditor,
        type: d.type,
        amount: d.amount,
        rate: d.rate,
        monthly: d.monthly,
        source: 'codef' as const,
      })));
      setAssets(data.assets.map((a) => ({
        _key: nextId.current++,
        name: a.name,
        type: a.type,
        rawValue: a.rawValue,
        memo: '',
        source: 'codef' as const,
      })));

      setTimeout(() => setStep('review'), 800);
    } catch {
      clearInterval(simHandle);
      setCollectProgress(0);
      selectedBanks.forEach(b => setBankStatus(b, 'error'));
      setError('금융데이터 수집에 실패했습니다. 인증 정보를 확인 후 다시 시도해 주세요.');
      setTimeout(() => {
        collectStarted.current = false;
        setStep('auth');
      }, 2000);
    }
  }

  function simulateProgress(): ReturnType<typeof setInterval> {
    let p = 0;
    const total = selectedBanks.length;
    let completed = 0;

    return setInterval(() => {
      if (completed < total) {
        setBankStatus(selectedBanks[completed], 'collecting');
      }
      p = Math.min(p + Math.random() * 8, 95);
      setCollectProgress(Math.round(p));

      if (p > (completed + 1) * (90 / total) && completed < total) {
        setBankStatus(selectedBanks[completed], 'done');
        completed++;
        if (completed < total) {
          setBankStatus(selectedBanks[completed], 'collecting');
        }
      }
    }, 400);
  }

  async function runSimulation() {
    const total = selectedBanks.length;

    for (let i = 0; i < total; i++) {
      const bank = selectedBanks[i];
      setBankStatus(bank, 'collecting');
      await new Promise(r => setTimeout(r, 600 + Math.random() * 800));

      if (Math.random() < 0.05) {
        setBankStatus(bank, 'error');
      } else {
        setBankStatus(bank, 'done');
      }
      setCollectProgress(Math.round(((i + 1) / total) * 100));
    }

    // Build demo data
    const demoDebts: DebtRow[] = selectedBanks.slice(0, 3).map((bank) => ({
      _key: nextId.current++,
      creditor: bank,
      type: '무담보' as DebtType,
      amount: Math.round((5000000 + Math.random() * 30000000) / 10000) * 10000,
      rate: Math.round((3 + Math.random() * 12) * 10) / 10,
      monthly: Math.round((100000 + Math.random() * 500000) / 1000) * 1000,
      source: 'codef' as const,
    }));

    const demoAssets: AssetRow[] = [
      {
        _key: nextId.current++,
        name: '보통예금',
        type: '예금' as AssetType,
        rawValue: Math.round(Math.random() * 3000000),
        memo: '',
        source: 'codef' as const,
      },
    ];

    setDebts(demoDebts);
    setAssets(demoAssets);
    // WARNING: Development only — fake connectedId for simulation fallback.
    // Must not be used in production; real connectedId comes from CODEF API.
    setConnectedId('demo-connected-id');

    setTimeout(() => setStep('review'), 800);
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------
  const formStepIndex = FORM_STEPS.findIndex(s => s.id === step);

  const goNext = () => {
    if (formStepIndex >= 0 && formStepIndex < FORM_STEPS.length - 1) {
      const nextStep = FORM_STEPS[formStepIndex + 1].id;
      if (nextStep === 'collect') {
        collectStarted.current = false; // allow collection to start
      }
      setStep(nextStep);
    }
  };

  const goPrev = () => {
    if (formStepIndex > 0) {
      const prevStep = FORM_STEPS[formStepIndex - 1].id;
      // Don't allow going back to collect step
      if (prevStep === 'collect') return;
      setStep(prevStep);
    }
  };

  const canNext = (): boolean => {
    if (step === 'consent') return allConsented;
    if (step === 'auth') return canStartCollect;
    if (step === 'review') return name.trim() !== '' && phone.trim() !== '';
    return true;
  };

  // ---------------------------------------------------------------------------
  // Debt / asset helpers
  // ---------------------------------------------------------------------------
  const addDebt = () => setDebts([...debts, {
    _key: nextId.current++, creditor: '', type: '무담보', amount: 0, rate: 0, monthly: 0, source: 'manual',
  }]);
  const removeDebt = (i: number) => setDebts(debts.filter((_, idx) => idx !== i));
  const updateDebt = (i: number, field: keyof DebtRow, value: string | number) => {
    setDebts(debts.map((d, idx) => {
      if (idx !== i) return d;
      const updated = { ...d, [field]: value };
      // 채권자명 변경 시 주소·전화 자동 채우기
      if (field === 'creditor' && typeof value === 'string') {
        const ci = findCreditor(value);
        if (ci) {
          if (!d.creditorAddress) updated.creditorAddress = ci.address;
          if (!d.creditorPhone) updated.creditorPhone = ci.phone;
          if (!d.creditorFax && ci.fax) updated.creditorFax = ci.fax;
        }
      }
      return updated;
    }));
  };

  const addAsset = () => setAssets([...assets, {
    _key: nextId.current++, name: '', type: '예금', rawValue: 0, memo: '', source: 'manual',
  }]);
  const removeAsset = (i: number) => setAssets(assets.filter((_, idx) => idx !== i));
  const updateAsset = (i: number, field: keyof AssetRow, value: string | number) =>
    setAssets(assets.map((a, idx) => idx === i ? { ...a, [field]: value } : a));

  const formatNum = (n: number) => new Intl.NumberFormat('ko-KR').format(n);

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
  const handleSubmit = async () => {
    setError('');
    if (!tokenData || !token) return;
    setSubmitting(true);

    if (isDemo) {
      await new Promise(r => setTimeout(r, 1000));
      setSubmitted(true);
      setSubmitting(false);
      return;
    }

    try {
      const cleanDebts = debts.map(({ _key, source, originalDate, originalAmount, ...rest }) => {
        const d: Record<string, any> = { ...rest };
        if (originalDate) d.originalDate = originalDate;
        if (originalAmount) d.originalAmount = originalAmount;
        return d;
      });
      const cleanAssets = assets.map(({ _key, source, meta, ...rest }) => {
        const a: Record<string, any> = { ...rest };
        if (meta && Object.keys(meta).length > 0) a.meta = meta;
        return a;
      });
      const payload: Record<string, any> = {
        tokenId: token,
        officeId: tokenData.officeId,
        name, ssn, phone, address, zonecode, court, job, jobType, family,
        income, income2, rent, education, medical,
        food, transport, telecom,
        debts: cleanDebts, assets: cleanAssets, memo,
      };
      if (familyMembers.length > 0) payload.familyMembers = familyMembers;
      if (connectedId) payload.connectedId = connectedId;
      await submitIntake(payload as any, pinDigits.join(''));
      setSubmitted(true);
    } catch (err) {
      console.error('IntakePage submit error:', err);
      setError(err instanceof Error ? err.message : '전송 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Collect step status icons
  // ---------------------------------------------------------------------------
  const statusIcon = (status: BankStatus) => {
    switch (status) {
      case 'waiting': return <Clock className="h-4 w-4 text-gray-400" />;
      case 'collecting': return <Loader2 className="h-4 w-4 text-[#C9A84C] animate-spin" />;
      case 'done': return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-400" />;
    }
  };

  const statusLabel = (status: BankStatus) => {
    switch (status) {
      case 'waiting': return '대기';
      case 'collecting': return '수집 중';
      case 'done': return '완료';
      case 'error': return '오류';
    }
  };

  // Totals for summary
  const totalDebt = debts.reduce((s, d) => s + d.amount, 0);
  const totalAsset = assets.reduce((s, a) => s + a.rawValue, 0);
  const codefDebts = debts.filter(d => d.source === 'codef');
  const manualDebts = debts.filter(d => d.source === 'manual');
  const codefAssets = assets.filter(a => a.source === 'codef');
  const manualAssets = assets.filter(a => a.source === 'manual');

  // =========================================================================
  // RENDER
  // =========================================================================

  // Loading state (PIN verification)
  if (pinVerifying) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0D1B2A]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#C9A84C] border-t-transparent" />
      </div>
    );
  }

  // Submitted state
  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0D1B2A] px-6 text-center">
        <CheckCircle className="h-20 w-20 text-emerald-400 mb-6" />
        <h1 className="text-2xl font-bold text-white mb-3">접수 완료!</h1>
        <p className="text-gray-300 mb-2">
          <span className="text-[#C9A84C] font-semibold">{tokenData?.officeName}</span>에
        </p>
        <p className="text-gray-300 mb-6">정보가 안전하게 전송되었습니다.</p>

        {/* 신용회복교육 안내 */}
        <div className="w-full max-w-sm rounded-2xl bg-white/10 backdrop-blur border border-white/10 p-5 mb-6 text-left">
          <div className="flex items-center gap-2 mb-3">
            <CheckSquare size={18} className="text-[#C9A84C]" />
            <h2 className="text-sm font-bold text-white">신용교육 수료 안내</h2>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed mb-4">
            개인회생 신청 시 <span className="text-[#C9A84C] font-medium">신용회복위원회 신용교육 이수증</span>을
            법원에 제출해야 합니다. 아래 버튼을 눌러 온라인으로 수료하세요.
          </p>
          <ul className="text-xs text-gray-400 space-y-1.5 mb-4">
            <li className="flex items-start gap-1.5">
              <span className="text-[#C9A84C] mt-0.5">1.</span>
              아래 링크 접속 → 회원가입/로그인
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-[#C9A84C] mt-0.5">2.</span>
              온라인교육 → 개인회생·파산 과정 선택
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-[#C9A84C] mt-0.5">3.</span>
              동영상 강의 6개 수강 (총 약 98분)
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-[#C9A84C] mt-0.5">4.</span>
              수료 후 이수증 발급 → 사무소에 전달
            </li>
          </ul>
          <a
            href="https://www.educredit.or.kr"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-[#C9A84C] py-3 text-sm font-bold text-black hover:bg-[#b8973e] transition-colors"
          >
            <CheckCircle2 size={16} />
            신용교육원 접속하기
          </a>
          <p className="text-[10px] text-gray-500 mt-2 text-center">educredit.or.kr · 문의 02-750-1293</p>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Shield size={14} />
          <span>전송된 데이터는 암호화되어 보관됩니다</span>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // PIN Screen
  // ---------------------------------------------------------------------------
  if (step === 'pin') {
    // 토큰 로딩 중
    if (tokenLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#0D1B2A]">
          <Loader2 className="h-8 w-8 animate-spin text-[#C9A84C]" />
        </div>
      );
    }
    // 토큰 유효하지 않음
    if (tokenInvalid) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#0D1B2A] px-6 text-center">
          <AlertCircle className="h-16 w-16 text-red-400 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">접속할 수 없습니다</h2>
          <p className="text-gray-400 text-sm">{tokenInvalid}</p>
          <p className="text-gray-500 text-xs mt-4">담당 법무사/변호사 사무소에 문의하여 새 링크를 받으세요.</p>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen flex-col bg-[#0D1B2A]">
        {/* PWA Install Banner */}
        {showInstallBanner && (
          <div className="bg-[#C9A84C] px-4 py-3">
            <div className="mx-auto max-w-lg flex items-center justify-between">
              <div className="flex items-center gap-2 text-black">
                <Download size={16} />
                <span className="text-sm font-medium">앱으로 설치하면 더 편리합니다</span>
              </div>
              <button
                onClick={handleInstall}
                className="rounded-lg bg-black px-3 py-1 text-xs font-bold text-[#C9A84C]"
              >
                설치
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-1 flex-col items-center justify-center px-6">
          {/* Logo */}
          <div className="mb-8 flex flex-col items-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#C9A84C]/20">
              <Scale size={32} className="text-[#C9A84C]" />
            </div>
            <h1 className="text-2xl font-bold text-white">회생원클릭</h1>
            <p className="mt-2 text-sm text-gray-400">사무소에서 안내받은 비밀번호를 입력하세요</p>
          </div>

          {/* PIN Input */}
          <div className="w-full max-w-xs">
            <div className="mb-4 flex items-center justify-center gap-2">
              <Lock size={16} className="text-gray-400" />
              <span className="text-sm text-gray-400">비밀번호 4자리</span>
            </div>

            <div className="flex justify-center gap-3 mb-6">
              {pinDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { pinRefs.current[i] = el; }}
                  type="tel"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handlePinChange(i, e.target.value)}
                  onKeyDown={e => handlePinKeyDown(i, e)}
                  autoFocus={i === 0}
                  className={`h-16 w-14 rounded-xl border-2 bg-white/10 text-center text-2xl font-bold text-white outline-none transition-colors ${
                    pinError
                      ? 'border-red-500 animate-shake'
                      : digit
                        ? 'border-[#C9A84C]'
                        : 'border-gray-600 focus:border-[#C9A84C]'
                  }`}
                />
              ))}
            </div>

            {pinError && (
              <div className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-red-500/20 px-3 py-2">
                <AlertCircle size={14} className="text-red-400" />
                <span className="text-sm text-red-400">{pinError}</span>
              </div>
            )}

            {!token && (
              <div className="flex items-center justify-center gap-2 rounded-lg bg-red-500/20 px-3 py-2">
                <AlertCircle size={14} className="text-red-400" />
                <span className="text-sm text-red-400">잘못된 링크입니다</span>
              </div>
            )}
          </div>

          {/* Footer info */}
          <div className="mt-12 flex items-center gap-2 text-xs text-gray-600">
            <Shield size={12} />
            <span>입력하신 정보는 암호화되어 안전하게 전송됩니다</span>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Token error
  // ---------------------------------------------------------------------------
  if (!tokenData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0D1B2A] px-6 text-center">
        <AlertCircle className="h-16 w-16 text-red-400 mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">접수 링크 오류</h1>
        <p className="text-gray-400">인증에 실패했습니다. 사무소에 문의하세요.</p>
      </div>
    );
  }

  // =========================================================================
  // MAIN FORM (steps: consent -> auth -> collect -> review -> submit)
  // =========================================================================
  return (
    <div className="min-h-screen bg-gray-50">
      {/* PWA Install Banner */}
      {showInstallBanner && (
        <div className="bg-[#C9A84C] px-4 py-2.5">
          <div className="mx-auto max-w-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-black">
              <Download size={14} />
              <span className="text-xs font-medium">앱 설치</span>
            </div>
            <button onClick={handleInstall} className="rounded bg-black px-2.5 py-1 text-xs font-bold text-[#C9A84C]">설치</button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0D1B2A] px-4 py-3 shadow-lg">
        <div className="mx-auto max-w-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale size={20} className="text-[#C9A84C]" />
            <span className="text-base font-bold text-[#C9A84C]">회생원클릭</span>
          </div>
          <span className="text-xs text-gray-400">{tokenData.officeName}</span>
        </div>
      </header>

      {/* Step indicator */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="mx-auto max-w-lg">
          <div className="flex items-center justify-between mb-2">
            {FORM_STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    i < formStepIndex
                      ? 'bg-emerald-500 text-white'
                      : i === formStepIndex
                        ? 'bg-[#C9A84C] text-black'
                        : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {i < formStepIndex ? '\u2713' : i + 1}
                </div>
                {i < FORM_STEPS.length - 1 && (
                  <div className={`mx-1 h-0.5 w-4 sm:w-8 ${i < formStepIndex ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
          <p className="text-center text-sm font-medium text-gray-700">
            {FORM_STEPS[formStepIndex]?.label}
          </p>
        </div>
      </div>

      {/* Form content */}
      <div className="mx-auto max-w-lg px-4 py-6">
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        {/* ================================================================= */}
        {/* Step 1: 동의 (Consent) */}
        {/* ================================================================= */}
        {step === 'consent' && (
          <div className="space-y-4">
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">금융데이터 수집 동의</h2>
              <p className="text-sm text-gray-600 leading-relaxed mb-5">
                <span className="text-[#C9A84C] font-medium">{name || '의뢰인'}</span>님의
                개인회생 신청을 위한 금융데이터를 CODEF를 통해 자동 수집합니다.
                아래 동의 항목을 모두 확인해 주세요.
              </p>

              {/* Select All */}
              <button
                type="button"
                onClick={toggleAllConsents}
                className="flex items-center gap-3 w-full text-left pb-4 border-b border-gray-200 mb-4"
              >
                {allConsented ? (
                  <CheckSquare className="h-5 w-5 text-[#C9A84C] shrink-0" />
                ) : (
                  <Square className="h-5 w-5 text-gray-400 shrink-0" />
                )}
                <span className="text-gray-900 font-semibold">전체 동의</span>
              </button>

              {/* Individual */}
              <div className="space-y-3">
                {CONSENT_LABELS.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleConsent(i)}
                    className="flex items-start gap-3 w-full text-left py-1"
                  >
                    {consents[i] ? (
                      <CheckSquare className="h-5 w-5 text-[#C9A84C] shrink-0 mt-0.5" />
                    ) : (
                      <Square className="h-5 w-5 text-gray-400 shrink-0 mt-0.5" />
                    )}
                    <span className={`text-sm ${consents[i] ? 'text-gray-700' : 'text-gray-500'}`}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* CreditPdfUpload — 동의 완료 후 표시 */}
            {allConsented && (
              <CreditPdfUpload
                clientId={token ?? ''}
                officeId={tokenData?.officeId ?? ''}
                onParsed={(debts) => {
                  const parsed = debts.map((d, i) => ({
                    _key: nextId.current++,
                    creditor: d.creditor,
                    type: (d.type === '담보' ? '담보' : d.type === '사채' ? '사채' : '무담보') as DebtType,
                    amount: d.amount,
                    rate: 0,
                    monthly: 0,
                    source: 'manual' as const,
                  }));
                  setDebts(prev => [...prev, ...parsed]);
                }}
                onSkip={() => setStep('auth')}
              />
            )}

            {/* Next */}
            <button
              onClick={goNext}
              disabled={!allConsented}
              className="w-full flex items-center justify-center gap-1 rounded-xl bg-[#0D1B2A] py-3.5 text-sm font-medium text-white disabled:opacity-40"
            >
              다음 <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ================================================================= */}
        {/* Step 2: 인증 (Auth) */}
        {/* ================================================================= */}
        {step === 'auth' && (
          <div className="space-y-4">
            {/* 인증 방법 선택 토글 */}
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex gap-2">
                <button
                  onClick={() => setAuthMode('cert')}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-all ${
                    authMode === 'cert'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  🔐 공동인증서
                </button>
                <button
                  onClick={() => setAuthMode('simple')}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-all ${
                    authMode === 'simple'
                      ? 'bg-[#0D1B2A] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  📱 간편인증
                </button>
              </div>
            </div>

            {/* 공동인증서 입력 */}
            {authMode === 'cert' && (
              <div className="rounded-xl bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-start gap-3 rounded-lg bg-blue-50 border border-blue-100 p-3">
                  <Lock size={16} className="text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    PC에 설치된 공동인증서(구 공인인증서)로 인증합니다. 인증서 정보는 서버에 저장되지 않습니다.
                  </p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">인증서 ID</label>
                    <input type="text" value={certId} onChange={e => setCertId(e.target.value)}
                      placeholder="인증서에 등록된 ID"
                      className="w-full rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">인증서 비밀번호</label>
                    <input type="password" value={certPw} onChange={e => setCertPw(e.target.value)}
                      placeholder="인증서 비밀번호"
                      className="w-full rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 focus:outline-none" />
                  </div>
                </div>
              </div>
            )}

            {/* 간편인증 안내 + 앱 선택 */}
            {authMode === 'simple' && (
              <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-100 p-4">
                <Shield size={18} className="text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-800">간편인증으로 안전하게</p>
                  <p className="text-xs text-blue-600 mt-1 leading-relaxed">
                    평소 사용하시는 인증 앱으로 본인확인 후 금융데이터를 수집합니다.
                  </p>
                </div>
              </div>
            )}

            {/* Simple auth app selection (간편인증 선택 시에만) */}
            {authMode === 'simple' && (
            <div className="rounded-xl bg-white p-5 shadow-sm space-y-4">
              <h3 className="text-gray-900 font-semibold">인증 앱 선택</h3>
              <p className="text-xs text-gray-500 -mt-2">
                평소 사용하는 앱을 선택하세요. 해당 앱에서 인증 요청이 도착합니다.
              </p>
              <div className="grid grid-cols-5 gap-1.5">
                {SIMPLE_AUTH_APPS.map(app => (
                  <button
                    key={app.key}
                    onClick={() => setAuthApp(app.key)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl px-1 py-3.5 text-[11px] font-medium transition-all ${
                      authApp === app.key
                        ? 'bg-gray-900 text-white shadow-lg scale-[1.03]'
                        : 'bg-gray-50 text-gray-600 border border-gray-100 active:scale-95'
                    }`}
                  >
                    <span className="text-xl">{app.icon}</span>
                    {app.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2.5">
                <span className="text-lg">{SIMPLE_AUTH_APPS.find(a => a.key === authApp)?.icon}</span>
                <span className="text-sm text-gray-700">
                  <strong>{SIMPLE_AUTH_APPS.find(a => a.key === authApp)?.label}</strong>으로 인증합니다
                </span>
              </div>
            </div>
            )}

            {/* Bank selection by category */}
            <div className="rounded-xl bg-white p-5 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-gray-900 font-semibold">채무가 있는 금융기관 선택</h3>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  selectedBanks.length > 0
                    ? 'bg-[#C9A84C]/20 text-[#C9A84C]'
                    : 'bg-gray-100 text-gray-500'
                }`}>{selectedBanks.length}개</span>
              </div>
              <p className="text-xs text-gray-500 -mt-3">
                빚이 있는 곳을 모두 선택해 주세요. 잘 모르면 전체 선택하셔도 됩니다.
              </p>

              {/* Select All */}
              <button
                type="button"
                onClick={toggleAllBanks}
                className="flex items-center gap-2.5 w-full rounded-xl bg-gray-50 px-4 py-3 border-2 border-dashed border-gray-300 transition-colors hover:border-[#C9A84C] hover:bg-[#C9A84C]/5"
              >
                {allBanksSelected ? (
                  <CheckSquare className="h-5 w-5 text-[#C9A84C]" />
                ) : (
                  <Square className="h-5 w-5 text-gray-400" />
                )}
                <span className="text-sm font-medium text-gray-700">전체 선택 (잘 모르겠으면 이걸 누르세요)</span>
              </button>

              {/* Categories */}
              {BANK_CATEGORIES.map(cat => {
                const catSelected = cat.items.filter(b => selectedBanks.includes(b)).length;
                const catAllSelected = catSelected === cat.items.length;
                return (
                  <div key={cat.label}>
                    <button
                      type="button"
                      onClick={() => {
                        if (catAllSelected) {
                          cat.items.forEach(b => { if (selectedBanks.includes(b)) toggleBank(b); });
                        } else {
                          cat.items.forEach(b => { if (!selectedBanks.includes(b)) toggleBank(b); });
                        }
                      }}
                      className="flex items-center gap-2 mb-2"
                    >
                      {catAllSelected ? (
                        <CheckSquare className="h-4 w-4 text-[#C9A84C]" />
                      ) : (
                        <Square className="h-4 w-4 text-gray-400" />
                      )}
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{cat.label}</span>
                      {catSelected > 0 && (
                        <span className="text-[10px] text-[#C9A84C] font-medium">{catSelected}개</span>
                      )}
                    </button>
                    <div className="grid grid-cols-3 gap-1.5">
                      {cat.items.map(bank => {
                        const selected = selectedBanks.includes(bank);
                        return (
                          <button
                            key={bank}
                            type="button"
                            onClick={() => toggleBank(bank)}
                            className={`rounded-lg px-2 py-2.5 text-xs font-medium transition-all text-center ${
                              selected
                                ? 'bg-[#C9A84C]/15 border-2 border-[#C9A84C] text-[#C9A84C]'
                                : 'bg-gray-50 border-2 border-gray-100 text-gray-500 active:border-gray-300'
                            }`}
                          >
                            {bank.replace('은행', '').replace('카드', '').replace('생명', '').replace('화재', '').replace('손해보험', '').replace('저축은행', '')}
                            <span className="block text-[10px] text-gray-400 font-normal mt-0.5">
                              {bank.includes('은행') ? '은행' : bank.includes('카드') ? '카드' : bank.includes('생명') || bank.includes('화재') || bank.includes('손해보험') ? '보험' : '저축'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 인증 상태 표시 */}
            {authStatus === 'requesting' && (
              <div className="flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4">
                <Loader2 size={20} className="text-amber-600 animate-spin" />
                <p className="text-sm text-amber-800 font-medium">인증 요청 중...</p>
              </div>
            )}

            {authStatus === 'pending' && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <Loader2 size={20} className="text-amber-600 animate-spin" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">폰에서 인증을 완료해주세요</p>
                    <p className="text-xs text-amber-600">{SIMPLE_AUTH_APPS.find(a => a.key === authApp)?.label} 앱을 확인해주세요. (자동 확인 중)</p>
                  </div>
                </div>
              </div>
            )}

            {authStatus === 'done' && connectedId && (
              <div className="flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 p-4">
                <CheckCircle size={20} className="text-green-600" />
                <div>
                  <p className="text-sm font-semibold text-green-800">인증 완료</p>
                  <p className="text-xs text-green-600">금융데이터 수집을 시작할 수 있습니다.</p>
                </div>
              </div>
            )}

            {authError && (
              <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 p-4">
                <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{authError}</p>
              </div>
            )}

            {/* Nav buttons */}
            <div className="flex gap-3">
              <button
                onClick={goPrev}
                className="flex items-center justify-center gap-1 rounded-xl border-2 border-gray-300 px-6 py-3.5 text-sm font-medium text-gray-700"
              >
                <ChevronLeft size={16} /> 이전
              </button>

              {authStatus !== 'done' ? (
                <button
                  onClick={handleStartAuth}
                  disabled={selectedBanks.length === 0 || authStatus === 'requesting' || authStatus === 'pending'}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-all disabled:opacity-40 disabled:bg-gray-200 disabled:text-gray-500 enabled:bg-[#0D1B2A] enabled:text-white enabled:active:scale-[0.98]"
                >
                  {authMode === 'cert' ? <Lock size={14} /> : <Shield size={14} />}
                  {selectedBanks.length === 0
                    ? '금융기관을 선택하세요'
                    : authStatus === 'requesting' || authStatus === 'pending'
                      ? '인증 진행 중...'
                      : authMode === 'cert'
                        ? `🔐 공동인증서로 ${selectedBanks.length}개 기관 인증`
                        : `${SIMPLE_AUTH_APPS.find(a => a.key === authApp)?.label} 인증 요청`}
                </button>
              ) : (
                <button
                  onClick={goNext}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold bg-[#0D1B2A] text-white active:scale-[0.98] transition-all"
                >
                  <Lock size={14} />
                  {`${selectedBanks.length}개 기관 수집 시작`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* Step 3: 수집 (Collect) */}
        {/* ================================================================= */}
        {step === 'collect' && (
          <div className="space-y-4">
            {/* Progress bar */}
            <div className="rounded-xl bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">금융데이터 수집 중</h2>
                <span className="text-sm font-mono text-[#C9A84C]">{collectProgress}%</span>
              </div>
              <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#C9A84C] transition-all duration-300"
                  style={{ width: `${collectProgress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">
                CODEF를 통해 선택된 금융기관에서 채무·자산 정보를 수집하고 있습니다.
              </p>
            </div>

            {/* Per-bank status */}
            <div className="rounded-xl bg-white p-5 shadow-sm space-y-3">
              <h3 className="text-gray-900 font-semibold mb-2">기관별 수집 현황</h3>
              <div className="space-y-2">
                {selectedBanks.map(bank => {
                  const status = bankStatuses[bank] ?? 'waiting';
                  return (
                    <div
                      key={bank}
                      className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        {statusIcon(status)}
                        <span className="text-sm text-gray-700">{bank}</span>
                      </div>
                      <span className={`text-xs font-medium ${
                        status === 'done' ? 'text-emerald-500' :
                        status === 'error' ? 'text-red-400' :
                        status === 'collecting' ? 'text-[#C9A84C]' :
                        'text-gray-400'
                      }`}>
                        {statusLabel(status)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Back button – allows retrying auth if collection fails */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  // Reset collection state so it can be retried
                  collectStarted.current = false;
                  setCollectProgress(0);
                  setBankStatuses({});
                  setConnectedId('');
                  setStep('auth');
                }}
                className="flex-1 flex items-center justify-center gap-1 rounded-xl border-2 border-gray-300 py-3 text-sm font-medium text-gray-700"
              >
                <ChevronLeft size={16} /> 이전
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* Step 4: 확인 (Review) */}
        {/* ================================================================= */}
        {step === 'review' && (
          <div className="space-y-4">
            {/* CODEF summary */}
            <div className="rounded-xl bg-[#0D1B2A] p-5 shadow-sm">
              <h2 className="text-base font-semibold text-[#C9A84C] mb-3">수집 결과 요약</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-white/10 p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">총 채무</p>
                  <p className="text-lg font-bold text-white">{formatNum(totalDebt)}<span className="text-xs text-gray-400 ml-0.5">원</span></p>
                  <p className="text-xs text-gray-500">{debts.length}건</p>
                </div>
                <div className="rounded-lg bg-white/10 p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">총 자산</p>
                  <p className="text-lg font-bold text-white">{formatNum(totalAsset)}<span className="text-xs text-gray-400 ml-0.5">원</span></p>
                  <p className="text-xs text-gray-500">{assets.length}건</p>
                </div>
              </div>
            </div>

            {/* Basic info */}
            <div className="rounded-xl bg-white p-5 shadow-sm space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">기본 정보</h2>

              <Field label="이름 *" value={name} onChange={setName} placeholder="홍길동" />
              <Field label="주민등록번호" value={ssn} onChange={setSsn} placeholder="000000-0000000" />
              <p className="-mt-2 text-xs text-gray-400">예: 900101-1234567</p>
              <Field label="연락처 *" value={phone} onChange={setPhone} placeholder="010-0000-0000" type="tel" />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">주소</label>
                <div className="flex gap-2">
                  <input value={address} readOnly className="flex-1 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-base cursor-pointer" placeholder="주소 검색을 터치하세요"
                    onClick={async () => {
                      const r = await openAddressSearch();
                      if (r) {
                        setAddress(r.address);
                        setZonecode(r.zonecode);
                        const autoCourt = getCourtByAddress(r.sido, r.sigungu);
                        if (autoCourt) setCourt(autoCourt);
                      }
                    }} />
                  <button type="button" onClick={async () => {
                      const r = await openAddressSearch();
                      if (r) {
                        setAddress(r.address);
                        setZonecode(r.zonecode);
                        const autoCourt = getCourtByAddress(r.sido, r.sigungu);
                        if (autoCourt) setCourt(autoCourt);
                      }
                    }}
                    className="shrink-0 rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white">검색</button>
                </div>
              </div>
              <Field label="직장/직업" value={job} onChange={setJob} placeholder="(주)회사명 / 무직" />

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">소득 유형</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(JOB_LABELS) as [JobType, string][]).map(([k, v]) => (
                    <button
                      key={k}
                      onClick={() => setJobType(k)}
                      className={`rounded-lg border-2 px-2 py-2 text-xs font-medium transition-colors ${
                        jobType === k
                          ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]'
                          : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">가족 수 (본인 포함)</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setFamily(Math.max(1, family - 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-gray-200 text-lg font-bold text-gray-600"
                  >-</button>
                  <span className="text-lg font-semibold text-gray-900 w-8 text-center">{family}</span>
                  <button
                    onClick={() => setFamily(Math.min(10, family + 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-gray-200 text-lg font-bold text-gray-600"
                  >+</button>
                  <span className="text-sm text-gray-500">명</span>
                </div>
              </div>

              {family > 1 && (
                <div className="mt-3">
                  <button onClick={() => setShowFamilyDetail(!showFamilyDetail)} className="text-xs text-[#C9A84C] underline">
                    {showFamilyDetail ? '가족 정보 접기' : '가족 구성원 상세 입력 (선택)'}
                  </button>
                  {showFamilyDetail && (
                    <div className="mt-2 space-y-2">
                      {familyMembers.map((fm, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <select
                            value={fm.relation}
                            onChange={e => setFamilyMembers(prev => prev.map((m, idx) => idx === i ? { ...m, relation: e.target.value } : m))}
                            className="rounded-lg border border-gray-300 px-2 py-2 text-xs"
                          >
                            <option value="배우자">배우자</option>
                            <option value="자녀">자녀</option>
                            <option value="부모">부모</option>
                            <option value="형제">형제</option>
                            <option value="기타">기타</option>
                          </select>
                          <input
                            placeholder="이름"
                            value={fm.name}
                            onChange={e => setFamilyMembers(prev => prev.map((m, idx) => idx === i ? { ...m, name: e.target.value } : m))}
                            className="w-16 rounded-lg border border-gray-300 px-2 py-2 text-xs"
                          />
                          <input
                            type="number"
                            placeholder="나이"
                            value={fm.age || ''}
                            onChange={e => setFamilyMembers(prev => prev.map((m, idx) => idx === i ? { ...m, age: Number(e.target.value) || 0 } : m))}
                            className="w-14 rounded-lg border border-gray-300 px-2 py-2 text-xs"
                          />
                          <label className="flex items-center gap-1 text-xs text-gray-600">
                            <input
                              type="checkbox"
                              checked={fm.hasIncome}
                              onChange={e => setFamilyMembers(prev => prev.map((m, idx) => idx === i ? { ...m, hasIncome: e.target.checked } : m))}
                            />
                            소득
                          </label>
                          <button
                            onClick={() => setFamilyMembers(prev => prev.filter((_, idx) => idx !== i))}
                            className="p-1 text-gray-400 hover:text-red-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => setFamilyMembers(prev => [...prev, { relation: '배우자', name: '', age: 0, hasIncome: false }])}
                        className="text-xs text-[#C9A84C]"
                      >
                        + 가족 추가
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Income fields */}
            <div className="rounded-xl bg-white p-5 shadow-sm space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">소득 및 생계비</h2>

              <NumberField label="월 소득 (원)" value={income} onChange={setIncome} />
              <NumberField label="기타 소득 (원)" value={income2} onChange={setIncome2} />

              <hr className="border-gray-200" />
              <h3 className="text-sm font-semibold text-gray-700">월 고정 지출</h3>

              <NumberField label="주거비 / 월세 (원)" value={rent} onChange={setRent} />
              <NumberField label="교육비 (원)" value={education} onChange={setEducation} />
              <NumberField label="의료비 (원)" value={medical} onChange={setMedical} />

              <div className="space-y-3 border-t border-gray-200 pt-3 mt-3">
                <p className="text-xs text-gray-400">추가 생계비 (선택)</p>
                <NumberField label="식비 (원)" value={food} onChange={setFood} />
                <NumberField label="교통비 (원)" value={transport} onChange={setTransport} />
                <NumberField label="통신비 (원)" value={telecom} onChange={setTelecom} />
              </div>
            </div>

            {/* Collected debts (read-only CODEF) */}
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">채무 내역</h2>
                <button
                  onClick={addDebt}
                  className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white"
                >
                  <Plus size={14} /> 수동 추가
                </button>
              </div>

              {codefDebts.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-[#C9A84C] mb-2">CODEF 자동 수집 ({codefDebts.length}건)</p>
                  <div className="space-y-2">
                    {codefDebts.map(d => (
                      <div key={d._key} className="rounded-lg bg-[#C9A84C]/5 border border-[#C9A84C]/20 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-800">{d.creditor}</span>
                          <span className="text-xs text-gray-500">{d.type}</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          원금 {formatNum(d.amount)}원 / 이율 {d.rate}% / 월 {formatNum(d.monthly)}원
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {manualDebts.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-blue-600 mb-2">수동 입력 ({manualDebts.length}건)</p>
                  <div className="space-y-4">
                    {manualDebts.map((d, _mi) => {
                      const i = debts.indexOf(d);
                      return (
                        <div key={d._key} className="relative rounded-lg border border-gray-200 p-4 space-y-3">
                          <button
                            onClick={() => removeDebt(i)}
                            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500"
                          >
                            <Trash2 size={16} />
                          </button>
                          <Field label="채권자(은행/카드사)" value={d.creditor} onChange={v => updateDebt(i, 'creditor', v)} placeholder="OO은행" />
                          <div>
                            <label className="mb-1 block text-xs text-gray-600">채무 유형</label>
                            <select
                              value={d.type}
                              onChange={e => updateDebt(i, 'type', e.target.value)}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                            >
                              <option value="무담보">무담보</option>
                              <option value="담보">담보</option>
                              <option value="사채">사채</option>
                            </select>
                          </div>
                          <NumberField label="채무 원금 (원)" value={d.amount} onChange={v => updateDebt(i, 'amount', v)} />
                          <NumberField label="이자율 (%)" value={d.rate} onChange={v => updateDebt(i, 'rate', v)} step={0.1} />
                          <NumberField label="월 납입액 (원)" value={d.monthly} onChange={v => updateDebt(i, 'monthly', v)} />
                          <div>
                            <label className="mb-1 block text-xs text-gray-600">최초 차용일 (선택)</label>
                            <input
                              type="month"
                              value={d.originalDate || ''}
                              onChange={e => updateDebt(i, 'originalDate', e.target.value)}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C] outline-none"
                            />
                          </div>
                          <NumberField label="최초 차용금액 (원, 선택)" value={d.originalAmount || 0} onChange={v => updateDebt(i, 'originalAmount', v)} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {debts.length === 0 && (
                <p className="py-6 text-center text-sm text-gray-400">
                  수집된 채무 정보가 없습니다. '수동 추가' 버튼으로 입력해주세요.
                </p>
              )}
            </div>

            {/* Collected assets (read-only CODEF) */}
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">재산 내역</h2>
                <button
                  onClick={addAsset}
                  className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white"
                >
                  <Plus size={14} /> 수동 추가
                </button>
              </div>

              {codefAssets.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-[#C9A84C] mb-2">CODEF 자동 수집 ({codefAssets.length}건)</p>
                  <div className="space-y-2">
                    {codefAssets.map(a => (
                      <div key={a._key} className="rounded-lg bg-[#C9A84C]/5 border border-[#C9A84C]/20 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-800">{a.name}</span>
                          <span className="text-xs text-gray-500">{a.type}</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{formatNum(a.rawValue)}원</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {manualAssets.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-blue-600 mb-2">수동 입력 ({manualAssets.length}건)</p>
                  <div className="space-y-4">
                    {manualAssets.map((a, _mi) => {
                      const i = assets.indexOf(a);
                      return (
                        <div key={a._key} className="relative rounded-lg border border-gray-200 p-4 space-y-3">
                          <button
                            onClick={() => removeAsset(i)}
                            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500"
                          >
                            <Trash2 size={16} />
                          </button>
                          <Field label="재산명" value={a.name} onChange={v => updateAsset(i, 'name', v)} placeholder="아파트, 자동차 등" />
                          <div>
                            <label className="mb-1 block text-xs text-gray-600">유형</label>
                            <select
                              value={a.type}
                              onChange={e => updateAsset(i, 'type', e.target.value)}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm"
                            >
                              {(['부동산', '차량', '예금', '보험', '증권', '기타'] as AssetType[]).map(t => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                          </div>
                          <NumberField label="예상 가액 (원)" value={a.rawValue} onChange={v => updateAsset(i, 'rawValue', v)} />

                          {a.type === '부동산' && (
                            <div>
                              <label className="mb-1 block text-xs text-gray-600">소재지 (선택)</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={a.meta?.address || ''}
                                  readOnly
                                  placeholder="주소 검색을 터치하세요"
                                  className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm cursor-pointer"
                                  onClick={async () => { const r = await openAddressSearch(); if (r) setAssets(prev => prev.map((aa, idx) => idx === i ? { ...aa, meta: { ...aa.meta, address: r.address } } : aa)); }}
                                />
                                <button type="button" onClick={async () => { const r = await openAddressSearch(); if (r) setAssets(prev => prev.map((aa, idx) => idx === i ? { ...aa, meta: { ...aa.meta, address: r.address } } : aa)); }}
                                  className="shrink-0 rounded-lg bg-blue-600 px-3 py-2.5 text-xs font-medium text-white">검색</button>
                              </div>
                            </div>
                          )}

                          {a.type === '차량' && (
                            <div className="space-y-3">
                              <div>
                                <label className="mb-1 block text-xs text-gray-600">차량번호 (선택)</label>
                                <input
                                  type="text"
                                  value={a.meta?.plate || ''}
                                  onChange={e => setAssets(prev => prev.map((aa, idx) => idx === i ? { ...aa, meta: { ...aa.meta, plate: e.target.value } } : aa))}
                                  placeholder="12가3456"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C] outline-none"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs text-gray-600">연식 (선택)</label>
                                <input
                                  type="number"
                                  value={a.meta?.year || ''}
                                  onChange={e => setAssets(prev => prev.map((aa, idx) => idx === i ? { ...aa, meta: { ...aa.meta, year: Number(e.target.value) || 0 } } : aa))}
                                  placeholder="2020"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C] outline-none"
                                />
                              </div>
                            </div>
                          )}

                          {a.type === '예금' && (
                            <div className="space-y-3">
                              <div>
                                <label className="mb-1 block text-xs text-gray-600">은행명 (선택)</label>
                                <input
                                  type="text"
                                  value={a.meta?.bankName || ''}
                                  onChange={e => setAssets(prev => prev.map((aa, idx) => idx === i ? { ...aa, meta: { ...aa.meta, bankName: e.target.value } } : aa))}
                                  placeholder="OO은행"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C] outline-none"
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs text-gray-600">계좌번호 끝 4자리 (선택)</label>
                                <input
                                  type="text"
                                  value={a.meta?.accountLast4 || ''}
                                  onChange={e => setAssets(prev => prev.map((aa, idx) => idx === i ? { ...aa, meta: { ...aa.meta, accountLast4: e.target.value } } : aa))}
                                  maxLength={4}
                                  placeholder="1234"
                                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C] outline-none"
                                />
                              </div>
                            </div>
                          )}

                          {a.type === '보험' && (
                            <div>
                              <label className="mb-1 block text-xs text-gray-600">보험사명 (선택)</label>
                              <input
                                type="text"
                                value={a.meta?.insurerName || ''}
                                onChange={e => setAssets(prev => prev.map((aa, idx) => idx === i ? { ...aa, meta: { ...aa.meta, insurerName: e.target.value } } : aa))}
                                placeholder="OO생명/화재"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C] outline-none"
                              />
                            </div>
                          )}

                          <Field label="비고" value={a.memo} onChange={v => updateAsset(i, 'memo', v)} placeholder="상세 정보 (선택)" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {assets.length === 0 && (
                <p className="py-6 text-center text-sm text-gray-400">
                  수집된 재산 정보가 없습니다. '수동 추가' 버튼으로 입력해주세요.
                </p>
              )}
            </div>

            {/* Memo */}
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">메모 / 특이사항</label>
              <textarea
                value={memo}
                onChange={e => setMemo(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C] outline-none"
                placeholder="사무소에 전달할 내용이 있으면 입력해주세요"
              />
            </div>

            {/* Nav buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep('auth')}
                className="flex-1 flex items-center justify-center gap-1 rounded-xl border-2 border-gray-300 py-3 text-sm font-medium text-gray-700"
              >
                <ChevronLeft size={16} /> 이전
              </button>
              <button
                onClick={goNext}
                disabled={!canNext()}
                className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-[#0D1B2A] py-3 text-sm font-medium text-white disabled:opacity-40"
              >
                다음 <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* Step 5: 전송 (Submit) */}
        {/* ================================================================= */}
        {step === 'submit' && (
          <div className="space-y-4">
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">입력 내용 확인</h2>

              <Section title="기본정보">
                <Row label="이름" value={name} />
                <Row label="연락처" value={phone} />
                <Row label="주소" value={address || '-'} />
                <Row label="직업" value={job || '-'} />
                <Row label="소득 유형" value={JOB_LABELS[jobType]} />
                <Row label="가족 수" value={`${family}명`} />
              </Section>

              <Section title={`채무 내역 (${debts.length}건 / 총 ${formatNum(totalDebt)}원)`}>
                {debts.length === 0 ? (
                  <p className="text-sm text-gray-400">없음</p>
                ) : debts.map(d => (
                  <div key={d._key} className="border-b border-gray-100 py-2 last:border-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-800">{d.creditor} ({d.type})</p>
                      {d.source === 'codef' && (
                        <span className="text-[10px] font-semibold text-[#C9A84C] bg-[#C9A84C]/10 px-1.5 py-0.5 rounded">CODEF</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{formatNum(d.amount)}원 / 이율 {d.rate}% / 월 {formatNum(d.monthly)}원</p>
                  </div>
                ))}
              </Section>

              <Section title={`재산 내역 (${assets.length}건 / 총 ${formatNum(totalAsset)}원)`}>
                {assets.length === 0 ? (
                  <p className="text-sm text-gray-400">없음</p>
                ) : assets.map(a => (
                  <div key={a._key} className="border-b border-gray-100 py-2 last:border-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-800">{a.name} ({a.type})</p>
                      {a.source === 'codef' && (
                        <span className="text-[10px] font-semibold text-[#C9A84C] bg-[#C9A84C]/10 px-1.5 py-0.5 rounded">CODEF</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{formatNum(a.rawValue)}원{a.memo ? ` - ${a.memo}` : ''}</p>
                  </div>
                ))}
              </Section>

              <Section title="소득/생계비">
                <Row label="월 소득" value={`${formatNum(income)}원`} />
                <Row label="기타 소득" value={`${formatNum(income2)}원`} />
                <Row label="주거비" value={`${formatNum(rent)}원`} />
                <Row label="교육비" value={`${formatNum(education)}원`} />
                <Row label="의료비" value={`${formatNum(medical)}원`} />
                {food > 0 && <Row label="식비" value={`${formatNum(food)}원`} />}
                {transport > 0 && <Row label="교통비" value={`${formatNum(transport)}원`} />}
                {telecom > 0 && <Row label="통신비" value={`${formatNum(telecom)}원`} />}
              </Section>

              {memo && (
                <Section title="메모">
                  <p className="text-sm text-gray-700">{memo}</p>
                </Section>
              )}
            </div>

            <div className="rounded-xl bg-blue-50 p-4">
              <div className="flex items-start gap-2">
                <Shield size={16} className="mt-0.5 text-blue-600 shrink-0" />
                <p className="text-xs text-blue-800">
                  입력하신 정보는 <strong>{tokenData.officeName}</strong>에만 전송되며,
                  개인정보보호법에 따라 안전하게 처리됩니다.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={goPrev}
                className="flex items-center justify-center gap-1 rounded-xl border-2 border-gray-300 px-6 py-3.5 text-sm font-medium text-gray-700"
              >
                <ChevronLeft size={16} /> 이전
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || submitted}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#C9A84C] py-4 text-base font-bold text-black hover:bg-[#b8973e] transition-colors disabled:opacity-50"
              >
                {submitting ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-black border-t-transparent" />
                ) : (
                  <>
                    <Send size={18} />
                    정보 전송하기
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C] outline-none"
      />
    </div>
  );
}

function NumberField({ label, value, onChange, step = 1 }: {
  label: string; value: number; onChange: (v: number) => void; step?: number;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
      <input
        type="number"
        value={value || ''}
        onChange={e => onChange(Number(e.target.value) || 0)}
        step={step}
        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C] outline-none"
        placeholder="0"
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <h3 className="mb-2 text-sm font-semibold text-gray-500 uppercase">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}
