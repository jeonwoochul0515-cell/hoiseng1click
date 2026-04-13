import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scale, Upload, Camera, CheckCircle, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { ocrBusinessRegistration, type BizRegData } from '@/utils/ocr';

type Mode = 'login' | 'signup';
type SignupStep = 1 | 2 | 3;

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, login, signup } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);

  // 이미 로그인된 사용자는 대시보드로 리다이렉트
  useEffect(() => {
    if (!authLoading && user) navigate('/dashboard', { replace: true });
  }, [user, authLoading, navigate]);

  const [mode, setMode] = useState<Mode>('login');
  const [signupStep, setSignupStep] = useState<SignupStep>(1);

  // Common
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // OCR
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrDone, setOcrDone] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  // Object URL 메모리 누수 방지
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // BizReg fields (auto-filled by OCR, editable)
  const [officeName, setOfficeName] = useState('');
  const [rep, setRep] = useState('');
  const [bizNumber, setBizNumber] = useState('');
  const [address, setAddress] = useState('');
  const [bizType, setBizType] = useState('');
  const [bizItem, setBizItem] = useState('');
  const [officeType, setOfficeType] = useState<'lawyer' | 'scrivener'>('lawyer');

  // Additional fields
  const [phone, setPhone] = useState('');

  // --- Handlers ---

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setError('');
    setOcrProgress(0);
    setOcrDone(false);
    setPreviewUrl(URL.createObjectURL(file));
    setLoading(true);

    try {
      const data: BizRegData = await ocrBusinessRegistration(file, setOcrProgress);
      setOfficeName(data.officeName || '');
      setRep(data.rep || '');
      setBizNumber(data.bizNumber || '');
      setAddress(data.address || '');
      setBizType(data.bizType || '');
      setBizItem(data.bizItem || '');
      setOfficeType(data.officeType);
      setOcrDone(true);
    } catch {
      setError('이미지를 인식하지 못했습니다. 직접 입력해 주세요.');
      setOcrDone(true);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleSignup = async () => {
    if (!email || !password) { setError('이메일과 비밀번호를 입력해 주세요.'); return; }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return; }
    if (!officeName.trim()) { setError('사무소 이름을 입력해 주세요.'); return; }
    setError('');
    setLoading(true);
    try {
      await signup(email, password, {
        officeName: officeName.trim(),
        rep, phone, email,
        bizNumber, address, bizType, bizItem, officeType,
      });
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '회원가입에 실패했습니다.';
      setError(msg);
      // 이미 가입된 이메일이면 로그인 탭으로 전환
      if (msg.includes('이미 가입된 이메일')) {
        setMode('login');
      }
    } finally {
      setLoading(false);
    }
  };

  const goStep2 = () => {
    if (!email || !password) { setError('이메일과 비밀번호를 입력해 주세요.'); return; }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return; }
    if (password !== passwordConfirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
    setError('');
    setSignupStep(2);
  };

  const goStep3 = () => {
    setError('');
    setSignupStep(3);
  };

  // --- Render ---

  return (
    <div className="flex min-h-screen">
      {/* Left – Brand (desktop) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-[#0D1B2A] text-white px-12">
        <Scale className="h-16 w-16 text-brand-gold mb-6" />
        <h1 className="text-4xl font-bold text-brand-gold mb-3">회생원클릭</h1>
        <p className="text-lg text-gray-300 mb-10">1회 인증으로 법원 서류 완성</p>
        <ul className="space-y-4 text-gray-400 text-sm max-w-xs">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-brand-gold">&#10003;</span>
            <span>사업자등록증 촬영으로 30초 가입</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-brand-gold">&#10003;</span>
            <span>코드에프 1회 인증으로 서류 자동 생성</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-brand-gold">&#10003;</span>
            <span>14일 PRO 무료체험 — 카드 등록 없이 시작</span>
          </li>
        </ul>
      </div>

      {/* Right – Form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile brand */}
          <div className="flex items-center gap-2 lg:hidden mb-4">
            <Scale className="h-7 w-7 text-brand-gold" />
            <span className="text-2xl font-bold text-[#0D1B2A]">회생원클릭</span>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
          )}

          {/* ====== LOGIN ====== */}
          {mode === 'login' && (
            <>
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">로그인</h2>
                <p className="mt-1 text-sm text-gray-500">이메일과 비밀번호를 입력하세요.</p>
              </div>
              <form onSubmit={handleLogin} className="space-y-5">
                <InputField label="이메일" type="email" value={email} onChange={setEmail} placeholder="name@office.com" required />
                <InputField label="비밀번호" type="password" value={password} onChange={setPassword} placeholder="••••••••" required />
                <button type="submit" disabled={loading} className="w-full rounded-lg bg-brand-gold px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#b8973e] transition-colors disabled:opacity-50">
                  {loading ? '처리 중...' : '로그인'}
                </button>
              </form>
              <Divider />
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-3">아직 계정이 없으신가요?</p>
                <button
                  onClick={() => { setMode('signup'); setSignupStep(1); setError(''); }}
                  className="w-full rounded-lg border-2 border-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-gold hover:bg-brand-gold hover:text-white transition-colors"
                >
                  무료체험 시작 (14일 PRO)
                </button>
              </div>
            </>
          )}

          {/* ====== SIGNUP STEP 1: 계정 정보 ====== */}
          {mode === 'signup' && signupStep === 1 && (
            <>
              <div className="flex items-center gap-3">
                <button onClick={() => setMode('login')} className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></button>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">무료체험 시작</h2>
                  <p className="mt-1 text-sm text-gray-500">Step 1/3 — 계정 정보</p>
                </div>
              </div>
              <StepBar current={1} />
              <div className="space-y-4">
                <InputField label="이메일 *" type="email" value={email} onChange={setEmail} placeholder="name@office.com" />
                <InputField label="비밀번호 * (6자 이상)" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
                <InputField label="비밀번호 확인 *" type="password" value={passwordConfirm} onChange={setPasswordConfirm} placeholder="••••••••" />
                <button onClick={goStep2} disabled={loading} className="w-full rounded-lg bg-brand-gold px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#b8973e] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  다음 <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}

          {/* ====== SIGNUP STEP 2: 사업자등록증 OCR ====== */}
          {mode === 'signup' && signupStep === 2 && (
            <>
              <div className="flex items-center gap-3">
                <button onClick={() => setSignupStep(1)} className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></button>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">사업자등록증</h2>
                  <p className="mt-1 text-sm text-gray-500">Step 2/3 — 사진 촬영 또는 파일 업로드</p>
                </div>
              </div>
              <StepBar current={2} />

              {/* Upload area */}
              {!previewUrl ? (
                <div
                  onClick={() => fileRef.current?.click()}
                  className="cursor-pointer rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center hover:border-brand-gold hover:bg-brand-gold/5 transition-colors"
                >
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                  <p className="text-sm font-medium text-gray-700">사업자등록증 이미지를 업로드하세요</p>
                  <p className="mt-1 text-xs text-gray-500">JPG, PNG, PDF / 최대 10MB</p>
                  <div className="mt-4 flex justify-center gap-3">
                    <span className="inline-flex items-center gap-1 rounded-lg bg-brand-gold px-4 py-2 text-sm font-medium text-black">
                      <Upload size={14} /> 파일 선택
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">
                      <Camera size={14} /> 카메라
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden border border-gray-200">
                    <img src={previewUrl} alt="사업자등록증" className="w-full max-h-48 object-contain bg-gray-100" />
                    {loading && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
                        <Loader2 className="h-8 w-8 text-brand-gold animate-spin mb-2" />
                        <p className="text-sm text-white">문서 인식 중... {ocrProgress}%</p>
                        <div className="mt-2 h-1.5 w-48 rounded-full bg-gray-700">
                          <div className="h-full rounded-full bg-brand-gold transition-all" style={{ width: `${ocrProgress}%` }} />
                        </div>
                      </div>
                    )}
                    {ocrDone && !loading && (
                      <div className="absolute top-2 right-2">
                        <CheckCircle className="h-6 w-6 text-emerald-500" />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => { setPreviewUrl(''); setOcrDone(false); }}
                    className="text-xs text-gray-500 hover:text-gray-800"
                  >
                    다른 이미지 업로드
                  </button>
                </div>
              )}

              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

              {/* OCR result: editable fields */}
              {ocrDone && (
                <div className="space-y-3 rounded-xl bg-gray-50 p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase">인식 결과 (수정 가능)</p>
                  <InputField label="사업자등록번호" value={bizNumber} onChange={setBizNumber} placeholder="000-00-00000" />
                  <InputField label="상호(사무소명) *" value={officeName} onChange={setOfficeName} placeholder="OO법률사무소" />
                  <InputField label="대표자" value={rep} onChange={setRep} placeholder="홍길동" />
                  <InputField label="사업장 소재지" value={address} onChange={setAddress} placeholder="서울시 강남구..." />
                  <div className="grid grid-cols-2 gap-3">
                    <InputField label="업태" value={bizType} onChange={setBizType} placeholder="서비스업" />
                    <InputField label="종목" value={bizItem} onChange={setBizItem} placeholder="법률서비스" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">사무소 유형</label>
                    <div className="flex gap-2">
                      {(['lawyer', 'scrivener'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setOfficeType(t)}
                          className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${
                            officeType === t
                              ? 'border-brand-gold bg-brand-gold/10 text-brand-gold'
                              : 'border-gray-200 text-gray-600'
                          }`}
                        >
                          {t === 'lawyer' ? '변호사' : '법무사'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => { setOcrDone(true); }} className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  건너뛰기 (직접입력)
                </button>
                <button onClick={goStep3} disabled={loading} className="flex-1 rounded-lg bg-brand-gold px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#b8973e] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  다음 <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}

          {/* ====== SIGNUP STEP 3: 연락처 + 완료 ====== */}
          {mode === 'signup' && signupStep === 3 && (
            <>
              <div className="flex items-center gap-3">
                <button onClick={() => setSignupStep(2)} className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></button>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">연락처 정보</h2>
                  <p className="mt-1 text-sm text-gray-500">Step 3/3 — 전화번호 · 이메일</p>
                </div>
              </div>
              <StepBar current={3} />

              <div className="space-y-4">
                <InputField label="상호(사무소명) *" value={officeName} onChange={setOfficeName} placeholder="OO법률사무소" />
                <InputField label="대표자" value={rep} onChange={setRep} placeholder="홍길동" />
                <InputField label="사업자등록번호" value={bizNumber} onChange={setBizNumber} placeholder="000-00-00000" />
                <InputField label="사업장 소재지" value={address} onChange={setAddress} placeholder="서울시 강남구..." />
                <div className="grid grid-cols-2 gap-3">
                  <InputField label="업태" value={bizType} onChange={setBizType} placeholder="서비스업" />
                  <InputField label="종목" value={bizItem} onChange={setBizItem} placeholder="법률서비스" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">사무소 유형</label>
                  <div className="flex gap-2">
                    {(['lawyer', 'scrivener'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setOfficeType(t)}
                        className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${
                          officeType === t
                            ? 'border-brand-gold bg-brand-gold/10 text-brand-gold'
                            : 'border-gray-200 text-gray-600'
                        }`}
                      >
                        {t === 'lawyer' ? '변호사' : '법무사'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border-t border-gray-200 pt-4" />
                <InputField label="사무소 전화번호" type="tel" value={phone} onChange={setPhone} placeholder="02-0000-0000" />
                <p className="text-xs text-gray-400">연락용 이메일: {email}</p>

                <button
                  onClick={handleSignup}
                  disabled={loading}
                  className="w-full rounded-lg bg-brand-gold px-4 py-3 text-sm font-bold text-black hover:bg-[#b8973e] transition-colors disabled:opacity-50"
                >
                  {loading ? '가입 처리 중...' : '무료체험 시작하기'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Helper Components ---

function InputField({ label, value, onChange, placeholder, type = 'text', required }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-gold focus:ring-1 focus:ring-brand-gold outline-none"
      />
    </div>
  );
}

function StepBar({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3].map((s) => (
        <div key={s} className="flex items-center gap-2 flex-1">
          <div className={`h-1.5 w-full rounded-full transition-colors ${s <= current ? 'bg-brand-gold' : 'bg-gray-200'}`} />
        </div>
      ))}
    </div>
  );
}

function Divider() {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
      <div className="relative flex justify-center text-sm"><span className="bg-white px-3 text-gray-400">또는</span></div>
    </div>
  );
}
