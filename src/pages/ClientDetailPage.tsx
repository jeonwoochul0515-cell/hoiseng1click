import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Database, FileText, Send, MessageCircle, Copy, Check, LinkIcon, Download, Loader2 } from 'lucide-react';
import DocCollectPanel from '@/components/client/DocCollectPanel';
import { sendKakaoLink } from '@/utils/kakao';
import { getClient } from '@/api/firestore';
import { useUpdateClient } from '@/hooks/useClients';
import { useAuthStore } from '@/store/authStore';
import { createIntakeToken } from '@/api/intake';
import { DebtTable } from '@/components/client/DebtTable';
import { AssetPanel } from '@/components/client/AssetPanel';
import { formatKRW, formatPhone, formatDate, maskSSN } from '@/utils/formatter';
import { calcMonthlyPayment, calcRepayTotal, calcLivingCost } from '@/utils/calculator';
import type { Client, ClientStatus } from '@/types/client';
import { toast } from '@/utils/toast';

const STATUS_OPTIONS: { value: ClientStatus; label: string; color: string }[] = [
  { value: 'new', label: '신규', color: '#3B82F6' },
  { value: 'contacted', label: '상담완료', color: '#8B5CF6' },
  { value: 'collecting', label: '수집중', color: '#C9A84C' },
  { value: 'drafting', label: '작성중', color: '#8B5CF6' },
  { value: 'submitted', label: '접수완료', color: '#F59E0B' },
  { value: 'approved', label: '인가', color: '#10B981' },
];

const TABS = ['기본정보', '채무내역', '재산내역', '소득·변제금', '수임료', '서류생성', '서류수집', '메모'] as const;

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const officeId = useAuthStore(s => s.office?.id ?? '');
  const updateMutation = useUpdateClient();

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);

  // Intake link state
  const [intakeLink, setIntakeLink] = useState('');
  const [intakePin, setIntakePin] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [msgCopied, setMsgCopied] = useState(false);

  useEffect(() => {
    if (!officeId || !id) return;
    let cancelled = false;
    setLoading(true);
    getClient(officeId, id)
      .then(c => { if (!cancelled) setClient(c); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [officeId, id]);

  const handleStatusChange = async (newStatus: ClientStatus) => {
    if (!client) return;
    await updateMutation.mutateAsync({ clientId: client.id, data: { status: newStatus } });
    setClient(prev => prev ? { ...prev, status: newStatus } : prev);
  };

  const office = useAuthStore(s => s.office);

  const handleGenerateIntakeLink = async () => {
    if (!office || !client) return;
    setLinkLoading(true);
    try {
      const { tokenId, pin } = await createIntakeToken(office.id, office.name, client.name, client.phone);
      setIntakeLink(`${window.location.origin}/intake/${tokenId}`);
      setIntakePin(pin);
    } catch {
      toast.error('링크 생성에 실패했습니다.');
    } finally {
      setLinkLoading(false);
    }
  };

  const getMessageTemplate = () =>
    `[${office?.name}] 개인회생 접수 안내\n\n${client?.name}님 안녕하세요.\n아래 링크를 눌러 정보를 입력해 주세요.\n\n접수 링크: ${intakeLink}\n비밀번호: ${intakePin}\n\n* 비밀번호 6자리를 입력하면 접수가 시작됩니다.\n* 링크는 7일간 유효합니다.`;

  const handleSendKakao = async () => {
    if (!office || !client) return;
    await sendKakaoLink({
      officeName: office.name,
      clientName: client.name,
      intakeLink,
      pin: intakePin,
    });
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(getMessageTemplate());
      setMsgCopied(true);
      setTimeout(() => setMsgCopied(false), 2000);
    } catch {
      toast.error('클립보드 복사에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-gold border-t-transparent" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
        <p className="text-lg text-gray-500">의뢰인을 찾을 수 없습니다</p>
        <button onClick={() => navigate('/clients')} className="mt-4 text-blue-600 hover:underline">
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  const currentStatusOption = STATUS_OPTIONS.find(s => s.value === client.status)!;
  const livingCost = calcLivingCost(client.family);
  const monthlyPayment = calcMonthlyPayment({
    income: client.income, income2: client.income2, family: client.family,
    rent: client.rent, education: client.education, medical: client.medical,
  });
  const repayTotal = calcRepayTotal(monthlyPayment, 36);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/clients')} className="rounded-lg p-1 text-gray-600 hover:bg-gray-100 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{client.name}</h1>
            <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
              <span>{formatPhone(client.phone)}</span>
              <span className="text-gray-700">|</span>
              <span>등록: {formatDate(client.createdAt)}</span>
            </div>
          </div>

          {/* Status Dropdown */}
          <div className="flex items-center gap-3">
            <select
              value={client.status}
              onChange={e => handleStatusChange(e.target.value as ClientStatus)}
              style={{ borderColor: currentStatusOption.color }}
              className="rounded-lg border-2 bg-white px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-1"
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>

            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white ${
              client.collectionDone ? 'bg-emerald-500' : 'bg-gray-400'
            }`}>
              {client.collectionDone ? '수집완료' : '미수집'}
            </span>

            <button
              onClick={handleGenerateIntakeLink}
              disabled={linkLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-3 py-2 text-sm font-medium text-black hover:bg-[#b8973e] disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {linkLoading ? '생성중...' : '접수링크 전송'}
            </button>

            <button
              onClick={() => navigate(`/collection/${client.id}`)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-3 py-2 text-sm font-medium text-black hover:bg-[#b8973e]"
            >
              <Database className="h-4 w-4" />
              CODEF 수집
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-1">
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === i
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Intake Link Banner */}
      {intakeLink && (
        <div className="mx-auto max-w-5xl px-6 pt-4">
          <div className="rounded-xl bg-[#0D1B2A] px-5 py-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <LinkIcon size={16} className="text-brand-gold" />
                <span className="text-sm font-semibold text-white">{client.name}님 접수링크</span>
              </div>
              <button
                onClick={() => { setIntakeLink(''); setIntakePin(''); }}
                className="text-gray-500 hover:text-gray-300 text-lg leading-none"
              >&times;</button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">비밀번호</p>
                <div className="flex gap-1.5">
                  {intakePin.split('').map((d, i) => (
                    <span key={i} className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-gold/20 text-base font-bold text-brand-gold">{d}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSendKakao}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#FEE500] py-2 text-xs font-bold text-[#191919] hover:bg-[#F0D800] transition-colors"
              >
                <MessageCircle size={14} />
                카카오톡 전송
              </button>
              <button
                onClick={handleCopyMessage}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-white/10 py-2 text-xs font-medium text-white hover:bg-white/20 transition-colors"
              >
                {msgCopied ? <><Check size={14} /> 복사됨</> : <><Copy size={14} /> 복사</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="mx-auto max-w-5xl p-6">
        {/* 기본정보 */}
        {tab === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-bold text-gray-900">기본정보</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <InfoRow label="이름" value={client.name} />
              <InfoRow label="연락처" value={formatPhone(client.phone)} />
              <InfoRow label="주민등록번호" value={client.ssn ? maskSSN(client.ssn) : '-'} />
              <InfoRow label="주소" value={client.address || '-'} />
              <InfoRow label="직업유형" value={client.jobType} />
              <InfoRow label="가구원 수" value={`${client.family}명`} />
              <InfoRow label="관할법원" value={client.court || '-'} />
              <InfoRow label="등록일" value={formatDate(client.createdAt)} />
            </div>
          </div>
        )}

        {/* 채무내역 */}
        {tab === 1 && (
          <div>
            <h2 className="mb-4 text-lg font-bold text-gray-900">채무내역</h2>
            <DebtTable debts={client.debts} />
          </div>
        )}

        {/* 재산내역 */}
        {tab === 2 && (
          <div>
            <h2 className="mb-4 text-lg font-bold text-gray-900">재산내역</h2>
            <AssetPanel assets={client.assets} />
          </div>
        )}

        {/* 소득·변제금 */}
        {tab === 3 && (
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-bold text-gray-900">소득 정보</h2>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <InfoRow label="소득 (본인)" value={formatKRW(client.income)} />
                <InfoRow label="소득 (배우자 등)" value={formatKRW(client.income2)} />
                <InfoRow label="주거비" value={formatKRW(client.rent)} />
                <InfoRow label="교육비" value={formatKRW(client.education)} />
                <InfoRow label="의료비" value={formatKRW(client.medical)} />
                <InfoRow label="가구원 수" value={`${client.family}명`} />
              </div>
            </div>

            <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-6">
              <h2 className="mb-4 text-lg font-bold text-amber-800">변제금 산출</h2>
              <div className="space-y-3 text-sm">
                <CalcRow label="총 소득" value={formatKRW(client.income + client.income2)} />
                <CalcRow label="기준중위소득 60%" value={formatKRW(livingCost)} />
                <CalcRow label="추가생계비 (주거+교육+의료)" value={formatKRW(client.rent + client.education + client.medical)} />
                <div className="my-3 border-t border-amber-200" />
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-amber-900">월 변제금</span>
                  <span className="text-2xl font-bold text-amber-600">{formatKRW(monthlyPayment)}</span>
                </div>
                <CalcRow label="36개월 총 변제" value={formatKRW(repayTotal)} />
              </div>
            </div>
          </div>
        )}

        {/* 수임료 */}
        {tab === 4 && (
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-bold text-gray-900">수임료 정보</h2>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <InfoRow label="수임료 총액" value={formatKRW(client.fee ?? 0)} />
                <InfoRow label="분할 납부" value={(client.feeInstallment ?? false) ? '예' : '아니오'} />
                {(client.feeInstallment ?? false) && (
                  <>
                    <InfoRow label="분할 개월수" value={`${client.feeInstallmentMonths ?? 0}개월`} />
                    <InfoRow label="월 납부금" value={formatKRW(client.feeInstallmentMonths ? Math.ceil((client.fee ?? 0) / client.feeInstallmentMonths) : 0)} />
                  </>
                )}
                <InfoRow label="납부 완료 금액" value={formatKRW(client.feePaidAmount ?? 0)} />
                <InfoRow label="잔여 금액" value={formatKRW(Math.max(0, (client.fee ?? 0) - (client.feePaidAmount ?? 0)))} />
              </div>
            </div>

            {/* 납부 진행률 */}
            {(client.fee ?? 0) > 0 && (
              <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-6">
                <h3 className="mb-3 text-sm font-bold text-emerald-800">납부 현황</h3>
                <div className="mb-2 flex items-center justify-between text-sm text-gray-700">
                  <span>진행률</span>
                  <span className="font-bold text-emerald-700">
                    {Math.min(100, Math.round(((client.feePaidAmount ?? 0) / (client.fee ?? 1)) * 100))}%
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-emerald-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.min(100, ((client.feePaidAmount ?? 0) / (client.fee ?? 1)) * 100)}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                  <span>{formatKRW(client.feePaidAmount ?? 0)} 납부</span>
                  <span>{formatKRW(client.fee ?? 0)} 총액</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 서류생성 */}
        {tab === 5 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-bold text-gray-900">서류생성</h2>
            <p className="mb-4 text-sm text-gray-500">이 의뢰인의 데이터를 기반으로 법원 제출 서류를 생성합니다.</p>
            <Link
              to={`/documents?clientId=${client.id}`}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-4 py-2.5 text-sm font-medium text-black hover:bg-[#b8973e]"
            >
              <FileText className="h-4 w-4" />
              서류 생성 페이지로 이동
            </Link>
          </div>
        )}

        {/* 서류수집 */}
        {tab === 6 && (
          <DocCollectPanel officeId={officeId} client={client} />
        )}

        {/* 메모 */}
        {tab === 7 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-bold text-gray-900">메모</h2>
            {client.memo ? (
              <p className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">{client.memo}</p>
            ) : (
              <p className="text-sm text-gray-600">작성된 메모가 없습니다</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-gray-900">{value}</dd>
    </div>
  );
}

function CalcRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-gray-700">
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

/** 의뢰인이 업로드한 제출서류 탭 */
function UploadedDocsTab({ officeId, client }: { officeId: string; client: Client }) {
  const [docs, setDocs] = useState<Array<{
    institution: string; certType: string; fileName: string;
    downloadUrl: string; storagePath: string; uploadedAt: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [docSubmitLink, setDocSubmitLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    loadDocs();
  }, [client.id]);

  async function loadDocs() {
    setLoading(true);
    try {
      const { getDocs, query, collection, where } = await import('firebase/firestore');

      // intakeSubmissions에서 이 클라이언트의 업로드 서류 조회
      if (client.intakeSubmissionId) {
        const { getDoc, doc } = await import('firebase/firestore');
        const snap = await getDoc(doc(db, 'intakeSubmissions', client.intakeSubmissionId));
        if (snap.exists()) {
          const data = snap.data();
          setDocs(data.uploadedDocs ?? []);

          // 서류 제출 링크 생성 (기존 tokenId 사용)
          if (data.tokenId) {
            setDocSubmitLink(`${window.location.origin}/docs/${data.tokenId}`);
          }
        }
      }
    } catch (err) {
      console.error('제출서류 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleCopyLink = async () => {
    if (!docSubmitLink) return;
    try {
      await navigator.clipboard.writeText(docSubmitLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast.error('클립보드 복사에 실패했습니다.');
    }
  };

  // 서류 제출 링크가 없으면 새로 생성
  const handleCreateDocLink = async () => {
    try {
      const { createIntakeToken: createToken } = await import('@/api/intake');
      const office = useAuthStore.getState().office;
      if (!office) return;
      const { tokenId } = await createToken(office.id, office.name, client.name, client.phone);
      setDocSubmitLink(`${window.location.origin}/docs/${tokenId}`);
    } catch {
      toast.error('링크 생성에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 서류 제출 링크 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-3 text-lg font-bold text-gray-900">서류 제출 링크</h2>
        <p className="mb-3 text-sm text-gray-500">의뢰인에게 이 링크를 보내면 부채증명서 등을 직접 업로드할 수 있습니다.</p>
        {docSubmitLink ? (
          <div className="flex items-center gap-2">
            <input readOnly value={docSubmitLink} className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-mono text-gray-600" />
            <button onClick={handleCopyLink}
              className="shrink-0 flex items-center gap-1 rounded-lg bg-[#0D1B2A] px-3 py-2 text-xs font-semibold text-white">
              {linkCopied ? <><Check size={12} /> 복사됨</> : <><Copy size={12} /> 복사</>}
            </button>
          </div>
        ) : (
          <button onClick={handleCreateDocLink}
            className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-600">
            <LinkIcon size={14} /> 서류 제출 링크 생성
          </button>
        )}
      </div>

      {/* 업로드된 서류 목록 */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">업로드된 서류</h2>
          <button onClick={loadDocs} className="text-xs text-blue-600 hover:text-blue-800 font-medium">새로고침</button>
        </div>

        {docs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">아직 업로드된 서류가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {docs.map((d, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                <FileText size={18} className="text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{d.institution} — {d.certType}</p>
                  <p className="text-xs text-gray-500">{d.fileName} · {d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString('ko-KR') : ''}</p>
                </div>
                <a href={d.downloadUrl} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-1 rounded-lg bg-brand-gold px-3 py-1.5 text-xs font-medium text-black hover:bg-[#b8973e]">
                  <Download size={12} /> 다운로드
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
