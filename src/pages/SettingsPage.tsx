import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Save, Wifi, WifiOff, CreditCard, LinkIcon, Copy, Check, Inbox, ChevronDown, ChevronUp, UserPlus, CheckCircle, MessageCircle, Shield } from 'lucide-react';
import { sendKakaoLink } from '@/utils/kakao';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { PLAN_CONFIGS } from '@/types/subscription';
import PlanBadge from '@/components/subscription/PlanBadge';
import UpgradeModal from '@/components/subscription/UpgradeModal';
import { formatKRW, formatDate } from '@/utils/formatter';
import { createIntakeToken, convertSubmissionToClient, type IntakeSubmission } from '@/api/intake';
import { migrateSSN } from '@/utils/ssnCrypto';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/firebase';

type TabId = 'office' | 'api' | 'intake' | 'subscription';

const TABS: { id: TabId; label: string }[] = [
  { id: 'office', label: '사무소 정보' },
  { id: 'api', label: 'API 연동' },
  { id: 'intake', label: '의뢰인 접수' },
  { id: 'subscription', label: '구독 관리' },
];

export default function SettingsPage() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>((searchParams.get('tab') as TabId) || 'office');

  // URL 파라미터 변경 시 탭 동기화
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') as TabId | null;
    if (tabFromUrl && tabFromUrl !== activeTab) setActiveTab(tabFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const office = useAuthStore((s) => s.office);
  const updateOffice = useAuthStore((s) => s.updateOffice);
  const openUpgradeModal = useUiStore((s) => s.openUpgradeModal);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Office form state
  const [officeName, setOfficeName] = useState(office?.name ?? '');
  const [repName, setRepName] = useState(office?.rep ?? '');
  const [phone, setPhone] = useState(office?.phone ?? '');
  const [officeEmail, setOfficeEmail] = useState(office?.email ?? '');
  const [bizNumber, setBizNumber] = useState(office?.bizNumber ?? '');
  const [officeAddress, setOfficeAddress] = useState(office?.address ?? '');
  const [bizType, setBizType] = useState(office?.bizType ?? '');
  const [bizItem, setBizItem] = useState(office?.bizItem ?? '');
  const [officeType, setOfficeType] = useState<'lawyer' | 'scrivener'>(office?.type ?? 'lawyer');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveOffice = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updateOffice({
        name: officeName,
        rep: repName,
        phone,
        email: officeEmail,
        bizNumber,
        address: officeAddress,
        bizType,
        bizItem,
        type: officeType,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // API state
  const [publicApiKey, setPublicApiKey] = useState('');
  const codefConnected = office?.codefConnected ?? false;

  // Intake state
  const [intakeLink, setIntakeLink] = useState('');
  const [intakePin, setIntakePin] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [msgCopied, setMsgCopied] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [submissions, setSubmissions] = useState<(IntakeSubmission & { id: string })[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [expandedSub, setExpandedSub] = useState<number | null>(null);
  const [converting, setConverting] = useState<string | null>(null);

  const handleGenIntakeLink = async () => {
    if (!office) return;
    setLinkLoading(true);
    try {
      const { tokenId, pin } = await createIntakeToken(office.id, office.name);
      setIntakeLink(`${window.location.origin}/intake/${tokenId}`);
      setIntakePin(pin);
    } catch { alert('링크 생성에 실패했습니다.'); }
    setLinkLoading(false);
  };

  const handleCopyIntakeLink = async () => {
    try {
      await navigator.clipboard.writeText(intakeLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      alert('클립보드 복사에 실패했습니다.');
    }
  };

  const getIntakeMessage = () =>
    `[${office?.name}] 개인회생 접수 안내\n\n안녕하세요. 아래 링크를 눌러 정보를 입력해 주세요.\n\n접수 링크: ${intakeLink}\n비밀번호: ${intakePin}\n\n* 비밀번호 4자리를 입력하면 접수가 시작됩니다.\n* 링크는 7일간 유효합니다.`;

  const handleCopyIntakeMessage = async () => {
    try {
      await navigator.clipboard.writeText(getIntakeMessage());
      setMsgCopied(true);
      setTimeout(() => setMsgCopied(false), 2000);
    } catch {
      alert('클립보드 복사에 실패했습니다.');
    }
  };

  const handleIntakeKakao = async () => {
    if (!office) return;
    await sendKakaoLink({
      officeName: office.name,
      clientName: '의뢰인',
      intakeLink,
      pin: intakePin,
    });
  };

  // 접수 탭 진입 시 자동 로드
  useEffect(() => {
    if (activeTab === 'intake') loadSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, office]);

  const loadSubmissions = async () => {
    if (!office) return;
    setSubsLoading(true);
    try {
      const q = query(collection(db, 'intakeSubmissions'), where('officeId', '==', office.id), orderBy('submittedAt', 'desc'));
      const snap = await getDocs(q);
      const subs = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as IntakeSubmission & { id: string }));
      setSubmissions(subs);
    } catch (err) { console.error('접수 목록 조회 실패:', err); alert('접수 목록을 불러오지 못했습니다.'); }
    setSubsLoading(false);
  };

  const handleConvert = async (sub: IntakeSubmission & { id: string }) => {
    if (!office) return;
    if (!confirm(`"${sub.name}" 님을 의뢰인으로 등록하시겠습니까?`)) return;
    setConverting(sub.id);
    try {
      const clientId = await convertSubmissionToClient(office.id, sub.id, sub);
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      await loadSubmissions(); // refresh list
      if (confirm('의뢰인 등록 완료! 상세 페이지로 이동하시겠습니까?')) {
        navigate(`/clients/${clientId}`);
      }
    } catch (err) { console.error('의뢰인 변환 실패:', err); alert('의뢰인 등록에 실패했습니다: ' + (err instanceof Error ? err.message : String(err))); }
    setConverting(null);
  };

  const plan = office?.plan ?? 'starter';
  const planConfig = PLAN_CONFIGS[plan];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">설정</h1>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-white p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-[#C9A84C] text-black'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="rounded-xl bg-white p-6">
        {/* Tab 1: 사무소 정보 */}
        {activeTab === 'office' && (
          <div className="space-y-5 max-w-lg">
            <h2 className="text-lg font-semibold text-gray-900">사무소 정보</h2>

            <div>
              <label className="mb-1 block text-sm text-gray-600">사무소명</label>
              <input type="text" value={officeName} onChange={(e) => setOfficeName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-[#C9A84C]" />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-600">대표자명</label>
              <input type="text" value={repName} onChange={(e) => setRepName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-[#C9A84C]" />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-600">사업자등록번호</label>
              <input type="text" value={bizNumber} onChange={(e) => setBizNumber(e.target.value)} placeholder="000-00-00000"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-[#C9A84C]" />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-600">사업장 주소</label>
              <input type="text" value={officeAddress} onChange={(e) => setOfficeAddress(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-[#C9A84C]" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-gray-600">업태</label>
                <input type="text" value={bizType} onChange={(e) => setBizType(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-[#C9A84C]" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">종목</label>
                <input type="text" value={bizItem} onChange={(e) => setBizItem(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-[#C9A84C]" />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-600">연락처</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="02-0000-0000"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-[#C9A84C]" />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-600">이메일</label>
              <input type="email" value={officeEmail} onChange={(e) => setOfficeEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-1 focus:ring-[#C9A84C]" />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-600">사무소 유형</label>
              <div className="flex gap-3">
                <button onClick={() => setOfficeType('lawyer')}
                  className={`flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-colors ${officeType === 'lawyer' ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]' : 'border-gray-200 text-gray-600 hover:border-gray-500'}`}>
                  변호사
                </button>
                <button onClick={() => setOfficeType('scrivener')}
                  className={`flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-colors ${officeType === 'scrivener' ? 'border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]' : 'border-gray-200 text-gray-600 hover:border-gray-500'}`}>
                  법무사
                </button>
              </div>
            </div>

            <button
              onClick={handleSaveOffice}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-[#C9A84C] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#b8973e] transition-colors disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? '저장 중...' : saved ? '저장 완료!' : '저장'}
            </button>
          </div>
        )}

        {/* Tab 2: API 연동 */}
        {activeTab === 'api' && (
          <div className="space-y-6 max-w-lg">
            <h2 className="text-lg font-semibold text-gray-900">API 연동</h2>

            {/* CODEF */}
            <div className="rounded-lg border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {codefConnected ? (
                    <Wifi size={18} className="text-green-400" />
                  ) : (
                    <WifiOff size={18} className="text-red-400" />
                  )}
                  <span className="font-medium text-gray-900">CODEF API</span>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  codefConnected
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {codefConnected ? '연결됨' : '미연결'}
                </span>
              </div>
              <p className="mb-4 text-sm text-gray-600">
                CODEF API를 연결하면 의뢰인의 금융 데이터를 자동으로 수집할 수 있습니다.
              </p>
              <button className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                codefConnected
                  ? 'border border-gray-300 text-gray-600 hover:bg-gray-100'
                  : 'bg-[#C9A84C] text-black hover:bg-[#b8973e]'
              }`}>
                {codefConnected ? '연결 해제' : 'CODEF 연결하기'}
              </button>
            </div>

            {/* 보안: SSN 암호화 마이그레이션 */}
            <div className="rounded-lg border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Shield size={18} className="text-blue-500" />
                <h3 className="font-medium text-gray-900">개인정보 암호화</h3>
              </div>
              <p className="mb-3 text-sm text-gray-600">
                기존에 평문으로 저장된 주민등록번호를 AES-256-GCM으로 일괄 암호화합니다.
                이 작업은 한 번만 실행하면 됩니다.
              </p>
              <button
                onClick={async () => {
                  if (!office) return;
                  if (!confirm('기존 의뢰인의 주민등록번호를 모두 암호화합니다. 진행하시겠습니까?')) return;
                  try {
                    const result = await migrateSSN(office.id);
                    alert(`암호화 완료: ${result.migrated}건 처리됨`);
                  } catch (err) {
                    alert('마이그레이션 실패: ' + (err instanceof Error ? err.message : String(err)));
                  }
                }}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <Shield size={14} />
                SSN 일괄 암호화 실행
              </button>
            </div>

            {/* 공공데이터 */}
            <div className="rounded-lg border border-gray-200 p-5">
              <h3 className="mb-3 font-medium text-gray-900">공공데이터 API</h3>
              <p className="mb-3 text-sm text-gray-600">
                부동산 공시가격, 차량 기준가액 조회에 사용됩니다.
              </p>
              <label className="mb-1 block text-xs text-gray-600">API 인증키</label>
              <input
                type="text"
                value={publicApiKey}
                onChange={(e) => setPublicApiKey(e.target.value)}
                placeholder="공공데이터포털에서 발급받은 인증키 입력"
                className="w-full rounded-lg bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-500 outline-none focus:ring-1 focus:ring-[#C9A84C]"
              />
              <button className="mt-3 flex items-center gap-2 rounded-lg bg-[#C9A84C] px-4 py-2 text-sm font-medium text-black hover:bg-[#b8973e] transition-colors">
                <Save size={14} />
                저장
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: 의뢰인 접수 */}
        {activeTab === 'intake' && (
          <div className="space-y-6 max-w-lg">
            <h2 className="text-lg font-semibold text-gray-900">의뢰인 접수 링크</h2>

            <div className="rounded-lg border border-gray-200 p-5">
              <p className="mb-4 text-sm text-gray-600">
                링크를 생성하여 의뢰인에게 공유하면, 의뢰인이 직접 정보를 입력하여 전송할 수 있습니다.
                링크는 7일간 유효합니다.
              </p>
              <button
                onClick={handleGenIntakeLink}
                disabled={linkLoading}
                className="flex items-center gap-2 rounded-lg bg-[#C9A84C] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#b8973e] transition-colors disabled:opacity-50"
              >
                <LinkIcon size={16} />
                {linkLoading ? '생성 중...' : '접수 링크 생성'}
              </button>

              {intakeLink && (
                <div className="mt-4 space-y-3 rounded-lg bg-gray-50 px-4 py-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">접수 링크</p>
                    <div className="flex items-center gap-2">
                      <p className="flex-1 text-xs text-gray-800 font-mono truncate">{intakeLink}</p>
                      <button
                        onClick={handleCopyIntakeLink}
                        className="flex items-center gap-1 rounded bg-[#0D1B2A] px-2.5 py-1 text-xs font-semibold text-white shrink-0"
                      >
                        {linkCopied ? <><Check size={12} /> 복사됨</> : <><Copy size={12} /> 복사</>}
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">비밀번호</p>
                    <div className="flex gap-1.5">
                      {intakePin.split('').map((d, i) => (
                        <span key={i} className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C9A84C]/20 text-lg font-bold text-[#C9A84C]">{d}</span>
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">의뢰인에게 전송</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleIntakeKakao}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#FEE500] py-2 text-xs font-bold text-[#191919] hover:bg-[#F0D800] transition-colors"
                    >
                      <MessageCircle size={14} />
                      카카오톡 전송
                    </button>
                  </div>
                  <button
                    onClick={handleCopyIntakeMessage}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#C9A84C] py-2 text-xs font-bold text-black hover:bg-[#b8973e] transition-colors"
                  >
                    {msgCopied ? <><Check size={14} /> 복사 완료!</> : <><Copy size={14} /> 메시지 전체 복사</>}
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <Inbox size={18} />
                  접수된 정보
                </h3>
                <button
                  onClick={loadSubmissions}
                  disabled={subsLoading}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  {subsLoading ? '로딩...' : '새로고침'}
                </button>
              </div>

              {submissions.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">
                  {subsLoading ? '불러오는 중...' : '접수된 정보가 없습니다. 새로고침 버튼을 눌러 확인하세요.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {submissions.map((sub, i) => (
                    <div key={sub.id} className="rounded-lg border border-gray-100 bg-gray-50">
                      <button
                        onClick={() => setExpandedSub(expandedSub === i ? null : i)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left"
                      >
                        <div>
                          <span className="text-sm font-medium text-gray-900">{sub.name}</span>
                          <span className="ml-2 text-xs text-gray-500">{sub.phone}</span>
                          {sub.convertedClientId && <span className="ml-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">등록됨</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">
                            {sub.submittedAt?.toDate ? formatDate(sub.submittedAt.toDate()) : ''}
                          </span>
                          {expandedSub === i ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </button>
                      {expandedSub === i && (
                        <div className="border-t border-gray-200 px-4 py-3 space-y-2 text-sm">
                          <p><span className="text-gray-500">주소:</span> {sub.address || '-'}</p>
                          <p><span className="text-gray-500">직업:</span> {sub.job || '-'} ({sub.jobType})</p>
                          <p><span className="text-gray-500">가족수:</span> {sub.family}명</p>
                          <p><span className="text-gray-500">월소득:</span> {formatKRW(sub.income || 0)}</p>
                          <p><span className="text-gray-500">채무:</span> {sub.debts?.length || 0}건</p>
                          <p><span className="text-gray-500">재산:</span> {sub.assets?.length || 0}건</p>
                          {sub.memo && <p><span className="text-gray-500">메모:</span> {sub.memo}</p>}
                          {sub.convertedClientId ? (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                <CheckCircle size={12} /> 의뢰인 등록됨
                              </span>
                              <button onClick={() => navigate(`/clients/${sub.convertedClientId}`)} className="ml-2 text-xs text-blue-600 hover:underline">상세보기</button>
                            </div>
                          ) : (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <button
                                onClick={() => handleConvert(sub)}
                                disabled={converting === sub.id}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                              >
                                <UserPlus size={14} />
                                {converting === sub.id ? '등록 중...' : '의뢰인으로 등록'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: 구독 관리 */}
        {activeTab === 'subscription' && (
          <div className="space-y-6 max-w-lg">
            <h2 className="text-lg font-semibold text-gray-900">구독 관리</h2>

            {/* Current plan */}
            <div className="rounded-lg border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-4">
                <CreditCard size={20} className="text-[#C9A84C]" />
                <span className="font-medium text-gray-900">현재 플랜</span>
                <PlanBadge plan={plan} />
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">월 요금</span>
                  <span className="text-gray-900 font-medium">{formatKRW(planConfig.price)}/월</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">만료일</span>
                  <span className="text-gray-900 font-medium">
                    {office?.planExpiry ? formatDate(office.planExpiry) : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">이달 서류 생성</span>
                  <span className="text-gray-900 font-medium">
                    {office?.docCountThisMonth ?? 0}건
                    {planConfig.maxDocsPerMonth < Infinity && ` / ${planConfig.maxDocsPerMonth}건`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">의뢰인 수</span>
                  <span className="text-gray-900 font-medium">
                    {office?.clientCount ?? 0}명
                    {planConfig.maxClients < Infinity && ` / ${planConfig.maxClients}명`}
                  </span>
                </div>
              </div>

              <div className="mt-5 border-t border-gray-200 pt-5">
                <h4 className="mb-2 text-xs font-semibold text-gray-600 uppercase">포함 기능</h4>
                <ul className="space-y-1">
                  {planConfig.features.map((f) => (
                    <li key={f} className="text-sm text-gray-700">- {f}</li>
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
