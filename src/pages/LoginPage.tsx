import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Scale, Upload, Camera, CheckCircle, Loader2, ArrowLeft, ArrowRight, Building2, User, Heart } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { auth } from '@/firebase';
import { ocrBusinessRegistration, type BizRegData } from '@/utils/ocr';

type Mode = 'login' | 'signup';
type SignupStep = 0 | 1 | 2 | 3;
type SignupMode = 'office' | 'individual';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, userType, loading: authLoading, login, loginWithGoogle, signup, signupIndividual } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);

  // URL 파라미터 또는 서브도메인으로 개인 모드 감지
  const isIndividualMode = searchParams.get('mode') === 'individual' || window.location.hostname.startsWith('self.');

  // 이미 로그인된 사용자는 적절한 대시보드로 리다이렉트
  // 단, 개인 모드 접근 시에는 리다이렉트하지 않음 (사무소 계정으로 로그인 상태에서 개인 가입 가능)
  useEffect(() => {
    if (!authLoading && user && !isIndividualMode) {
      if (userType === 'individual') {
        navigate('/my', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
    if (!authLoading && user && isIndividualMode && userType === 'individual') {
      navigate('/my', { replace: true });
    }
  }, [user, userType, authLoading, navigate, isIndividualMode]);

  const [mode, setMode] = useState<Mode>(isIndividualMode ? 'signup' : 'login');
  const [signupStep, setSignupStep] = useState<SignupStep>(isIndividualMode ? 1 : 0);
  const [signupMode, setSignupMode] = useState<SignupMode>(isIndividualMode ? 'individual' : 'office');

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

  // Individual fields
  const [individualName, setIndividualName] = useState('');

  // Additional fields
  const [phone, setPhone] = useState('');

  // --- Handlers ---

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      // 로그인 후 userType에 따라 분기 (authStore.loadProfile이 userType을 설정)
      const currentUserType = useAuthStore.getState().userType;
      navigate(currentUserType === 'individual' ? '/my' : '/dashboard');
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
      setError('');
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
    if (signupMode === 'office' && !officeName.trim()) { setError('사무소 이름을 입력해 주세요.'); return; }
    if (signupMode === 'individual' && !individualName.trim()) { setError('이름을 입력해 주세요.'); return; }
    setError('');
    setLoading(true);
    try {
      if (signupMode === 'individual') {
        await signupIndividual(email, password, {
          name: individualName.trim(),
          phone,
          email,
        });
      } else {
        await signup(email, password, {
          officeName: officeName.trim(),
          rep, phone, email,
          bizNumber, address, bizType, bizItem, officeType,
        });
      }
      navigate(signupMode === 'individual' ? '/my' : '/dashboard');
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
    // 개인 모드면 사업자등록증 단계(Step 2) 스킵 -> 바로 Step 3
    if (signupMode === 'individual') {
      setSignupStep(3);
    } else {
      setSignupStep(2);
    }
  };

  const goStep3 = () => {
    setError('');
    setSignupStep(3);
  };

  // --- Render ---

  return (
    <div className="flex min-h-screen">
      {/* Left – Brand (desktop) */}
      {isIndividualMode ? (
        <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-gradient-to-b from-[#E8F5F0] to-[#d4ede5] px-12">
          <Heart className="h-16 w-16 text-[#48B5A0] mb-6" />
          <h1 className="text-4xl font-bold text-[#2D3436] mb-3">회생클릭</h1>
          <p className="text-lg text-[#636E72] mb-10">나홀로 개인회생, AI가 도와드립니다</p>
          <ul className="space-y-4 text-[#636E72] text-sm max-w-xs">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[#48B5A0]">&#10003;</span>
              <span>변호사 비용 200만원 → 9.9만원으로</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[#48B5A0]">&#10003;</span>
              <span>CODEF 1회 인증으로 서류 5종 자동 생성</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-[#48B5A0]">&#10003;</span>
              <span>변호사가 직접 만든 서비스, 든든합니다</span>
            </li>
          </ul>
        </div>
      ) : (
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
      )}

      {/* Right – Form */}
      <div className={`flex w-full lg:w-1/2 items-center justify-center px-6 py-12 ${isIndividualMode ? 'bg-[#FAFAF7]' : 'bg-white'}`}>
        <div className="w-full max-w-md space-y-6">
          {/* Mobile brand */}
          <div className="flex items-center gap-2 lg:hidden mb-4">
            {isIndividualMode ? (
              <>
                <Heart className="h-7 w-7 text-[#48B5A0]" />
                <span className="text-2xl font-bold text-[#2D3436]">회생클릭</span>
              </>
            ) : (
              <>
                <Scale className="h-7 w-7 text-brand-gold" />
                <span className="text-2xl font-bold text-[#0D1B2A]">회생원클릭</span>
              </>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
          )}

          {/* ====== 개인 모드: 구글 로그인 ====== */}
          {isIndividualMode && (mode === 'login' || mode === 'signup') && signupStep <= 1 && (
            <>
              <div>
                <h2 className="text-2xl font-semibold text-[#2D3436]">시작하기</h2>
                <p className="mt-2 leading-relaxed text-[#636E72]">
                  구글 계정으로 간편하게 시작하세요.
                  <br />
                  별도 회원가입이 필요 없습니다.
                </p>
              </div>

              <button
                onClick={async () => {
                  setError('');
                  setLoading(true);
                  try {
                    await loginWithGoogle();
                    navigate('/my');
                  } catch (err: unknown) {
                    setError(err instanceof Error ? err.message : '구글 로그인에 실패했습니다.');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-gray-200 bg-white px-6 py-4 text-base font-semibold text-[#2D3436] shadow-sm hover:shadow-md hover:border-gray-300 transition-all disabled:opacity-50"
              >
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {loading ? '로그인 중...' : 'Google로 시작하기'}
              </button>

              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-sm text-[#636E72]">
                  <CheckCircle size={14} className="text-[#48B5A0]" />
                  <span>개인정보는 암호화되어 안전하게 보호됩니다</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#636E72]">
                  <CheckCircle size={14} className="text-[#48B5A0]" />
                  <span>변호사가 직접 운영하는 서비스입니다</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#636E72]">
                  <CheckCircle size={14} className="text-[#48B5A0]" />
                  <span>서류 생성 전 100% 환불 가능</span>
                </div>
              </div>
            </>
          )}

          {/* ====== LOGIN (사무소용) ====== */}
          {!isIndividualMode && mode === 'login' && (
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
                  onClick={() => { setMode('signup'); setSignupStep(0); setError(''); }}
                  className="w-full rounded-lg border-2 border-brand-gold px-4 py-2.5 text-sm font-semibold text-brand-gold hover:bg-brand-gold hover:text-white transition-colors"
                >
                  회원가입
                </button>
              </div>
            </>
          )}

          {/* ====== SIGNUP STEP 0: 사무소 가입 시작 ====== */}
          {!isIndividualMode && mode === 'signup' && signupStep === 0 && (
            <>
              <div className="flex items-center gap-3">
                <button onClick={() => setMode('login')} className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></button>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">회원가입</h2>
                  <p className="mt-1 text-sm text-gray-500">법무사/변호사 사무소 전용 서비스입니다.</p>
                </div>
              </div>

              <div className="space-y-4 mt-2">
                <button
                  onClick={() => { setSignupMode('office'); setSignupStep(1); setError(''); }}
                  className="w-full flex items-start gap-4 rounded-xl border-2 border-brand-gold bg-brand-gold/5 p-5 text-left transition-colors"
                >
                  <Building2 className="h-8 w-8 text-brand-gold flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-base font-semibold text-gray-900">사무소 가입 시작</p>
                    <p className="text-sm text-gray-500 mt-1">의뢰인 관리 및 서류 자동 생성</p>
                    <p className="text-xs text-brand-gold mt-2">14일 PRO 무료체험 포함 · 카드 등록 불필요</p>
                  </div>
                </button>
              </div>
            </>
          )}

          {/* ====== SIGNUP STEP 1: 계정 정보 ====== */}
          {mode === 'signup' && signupStep === 1 && (
            <>
              <div className="flex items-center gap-3">
                <button onClick={() => setSignupStep(0)} className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></button>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">
                    {signupMode === 'individual' ? '개인 셀프신청' : '무료체험 시작'}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {signupMode === 'individual' ? 'Step 1/2 — 계정 정보' : 'Step 1/3 — 계정 정보'}
                  </p>
                </div>
              </div>
              <StepBar current={1} total={signupMode === 'individual' ? 2 : 3} />
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
              <StepBar current={2} total={3} />

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
                    <img src={previewUrl} alt="사업자등록증" loading="lazy" className="w-full max-h-48 object-contain bg-gray-100" />
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

              <div className="flex flex-col gap-3">
                <button onClick={goStep3} disabled={loading} className="w-full rounded-lg bg-brand-gold px-4 py-3 text-sm font-semibold text-black hover:bg-[#b8973e] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {ocrDone ? '다음' : '사업자등록증 없이 직접 입력'} <ArrowRight size={16} />
                </button>
                {!ocrDone && (
                  <p className="text-center text-xs text-gray-400">사업자등록증이 없어도 다음 단계에서 직접 입력할 수 있습니다</p>
                )}
              </div>
            </>
          )}

          {/* ====== SIGNUP STEP 3: 연락처 + 완료 ====== */}
          {mode === 'signup' && signupStep === 3 && (
            <>
              <div className="flex items-center gap-3">
                <button onClick={() => setSignupStep(signupMode === 'individual' ? 1 : 2)} className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></button>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">
                    {signupMode === 'individual' ? '기본 정보' : '연락처 정보'}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {signupMode === 'individual' ? 'Step 2/2 — 이름 · 연락처' : 'Step 3/3 — 전화번호 · 이메일'}
                  </p>
                </div>
              </div>
              <StepBar current={signupMode === 'individual' ? 2 : 3} total={signupMode === 'individual' ? 2 : 3} />

              <div className="space-y-4">
                {signupMode === 'individual' ? (
                  <>
                    <InputField label="이름 *" value={individualName} onChange={setIndividualName} placeholder="홍길동" />
                    <InputField label="전화번호" type="tel" value={phone} onChange={setPhone} placeholder="010-0000-0000" />
                    <p className="text-xs text-gray-400">연락용 이메일: {email}</p>
                  </>
                ) : (
                  <>
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
                  </>
                )}

                <button
                  onClick={handleSignup}
                  disabled={loading}
                  className="w-full rounded-lg bg-brand-gold px-4 py-3 text-sm font-bold text-black hover:bg-[#b8973e] transition-colors disabled:opacity-50"
                >
                  {loading ? '가입 처리 중...' : signupMode === 'individual' ? '시작하기' : '무료체험 시작하기'}
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

function StepBar({ current, total = 3 }: { current: number; total?: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => i + 1).map((s) => (
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
