// B2C — 개인회생 부가신청서 3종 생성 페이지
// /my/additional-applications
//
// 개시신청서 접수 후 부여된 사건번호로 다음 3종을 생성·다운로드:
//   1. 금지명령 신청서 (채권자 강제집행 예방)
//   2. 중지명령 신청서 (이미 진행 중인 강제집행 중지)
//   3. 면제재산결정 신청서 (추가 면제재산 신청)
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Ban, AlertTriangle, Shield, Save, Download, FileText, CheckCircle,
  AlertCircle, Edit2,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { getIndividualCase, updateIndividualCase } from '@/api/firestore';
import { CaseNumberModal } from '@/components/client/CaseNumberModal';
import { parseCaseNumber, getRehabilitationCourt } from '@/utils/legalConstants';
import { toast } from '@/utils/toast';

type AppKind = 'prohibition_order' | 'suspension_order' | 'exemption_decision';

interface AppTemplate {
  kind: AppKind;
  label: string;
  description: string;
  whenToFile: string;
  law: string;
  icon: typeof Ban;
  color: string;
  bgColor: string;
  borderColor: string;
}

const APPLICATIONS: AppTemplate[] = [
  {
    kind: 'prohibition_order',
    label: '금지명령 신청서',
    description: '개시결정 전까지 채권자의 강제집행·가압류·가처분을 금지',
    whenToFile: '개시신청과 동시 제출 권장 (선제 방어)',
    law: '채무자회생법 제593조',
    icon: Ban,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
  {
    kind: 'suspension_order',
    label: '중지명령 신청서',
    description: '이미 진행 중인 강제집행·압류·경매 절차를 중지',
    whenToFile: '급여·통장·부동산 압류가 이미 진행 중인 경우',
    law: '채무자회생법 제593조 제1항 제2호',
    icon: AlertTriangle,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  {
    kind: 'exemption_decision',
    label: '면제재산결정 신청서',
    description: '민사집행법 기본 압류금지재산 외 추가 면제재산 신청',
    whenToFile: '생계 필수 가전·의료기기 등 추가 면제 필요 시',
    law: '채무자회생법 제580조 제3항 + 민사집행법 제195조',
    icon: Shield,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
  },
];

export default function MyAdditionalApplicationsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [caseData, setCaseData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [generating, setGenerating] = useState<AppKind | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    getIndividualCase(user.uid, 'default')
      .then((c) => setCaseData(c))
      .catch((err) => toast.error(err?.message ?? '케이스 로드 실패'))
      .finally(() => setLoading(false));
  }, [user?.uid]);

  const hasCaseNumber = useMemo(() => {
    const parsed = parseCaseNumber(caseData?.caseNumber ?? '');
    return parsed.valid;
  }, [caseData?.caseNumber]);

  const rehabCourt = useMemo(() => {
    if (!caseData?.court) return '';
    return getRehabilitationCourt(caseData.court, caseData.filingDate);
  }, [caseData?.court, caseData?.filingDate]);

  const courtChanged = rehabCourt && rehabCourt !== caseData?.court;

  const onCaseConfirm = async (data: {
    court: string;
    fullCaseNumber: string;
    rehabilitationCourt: string;
    filingDate: string;
  }) => {
    if (!user?.uid) return;
    try {
      await updateIndividualCase(user.uid, 'default', {
        court: data.court,
        caseNumber: data.fullCaseNumber,
        filingDate: data.filingDate,
      } as any);
      const updated = await getIndividualCase(user.uid, 'default');
      setCaseData(updated);
      setShowModal(false);
      toast.success('사건번호가 저장되었습니다');
    } catch (err: any) {
      toast.error(err?.message ?? '저장 실패');
    }
  };

  const generateDoc = async (kind: AppKind) => {
    if (!hasCaseNumber) {
      toast.warning('사건번호를 먼저 등록해주세요');
      setShowModal(true);
      return;
    }
    if (!user?.uid) return;
    setGenerating(kind);
    try {
      const token = await (await import('@/firebase')).auth.currentUser?.getIdToken();
      const workerBase = import.meta.env.VITE_WORKER_BASE_URL as string | undefined;
      if (!workerBase) throw new Error('Worker base URL이 설정되지 않았습니다');

      const res = await fetch(`${workerBase}/doc/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          clientId: 'default',
          docType: kind,
          format: 'docx',
          source: 'individual',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `생성 실패 (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const label = APPLICATIONS.find((ap) => ap.kind === kind)?.label ?? 'document';
      a.href = url;
      a.download = `${label}_${caseData?.name ?? 'unknown'}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`${label} 다운로드 완료`);
    } catch (err: any) {
      toast.error(err?.message ?? '생성 실패');
    } finally {
      setGenerating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-gold border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      <header>
        <button
          onClick={() => navigate('/my')}
          className="mb-2 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={14} /> 대시보드로
        </button>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="text-indigo-600" size={22} />
          부가신청서 생성
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          개시신청서 접수 후 사건번호를 기준으로 추가 신청서 3종을 자동 생성합니다
        </p>
      </header>

      {/* 사건 정보 카드 */}
      <section className="rounded-xl border-2 border-gray-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-bold text-gray-900">사건 정보</h2>
              {hasCaseNumber ? (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                  <CheckCircle size={10} /> 확인 완료
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                  <AlertCircle size={10} /> 사건번호 필요
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-[11px] text-gray-500 mb-0.5">법원</div>
                <div className="text-gray-900">{caseData?.court ?? '미설정'}</div>
                {courtChanged && (
                  <div className="mt-1 text-[10px] text-amber-700 flex items-start gap-1">
                    <AlertCircle size={10} className="mt-0.5 shrink-0" />
                    <span>부가신청서는 <strong>{rehabCourt}</strong>로 자동 변환</span>
                  </div>
                )}
              </div>
              <div>
                <div className="text-[11px] text-gray-500 mb-0.5">사건번호</div>
                <div className="text-gray-900 font-mono">
                  {caseData?.caseNumber || <span className="text-gray-400">미입력</span>}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-gray-500 mb-0.5">접수일</div>
                <div className="text-gray-900">{caseData?.filingDate || '미입력'}</div>
              </div>
              <div>
                <div className="text-[11px] text-gray-500 mb-0.5">신청인</div>
                <div className="text-gray-900">{caseData?.name || '미입력'}</div>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            {hasCaseNumber ? <><Edit2 size={14} /> 수정</> : <><Save size={14} /> 사건번호 등록</>}
          </button>
        </div>
      </section>

      {!hasCaseNumber && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
          <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-amber-900">
            <strong>사건번호 등록이 필요합니다.</strong>
            <p className="text-xs mt-1 leading-relaxed">
              부가신청서 3종은 개시신청서가 전자소송에 접수되어 사건번호가 부여된 뒤에 제출합니다.
              전자소송 포털 → 나의전자소송에서 사건번호를 확인 후 아래 "사건번호 등록" 버튼을 눌러주세요.
            </p>
          </div>
        </div>
      )}

      {/* 3종 신청서 카드 */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-gray-900">신청서 3종</h2>
        {APPLICATIONS.map((app) => {
          const Icon = app.icon;
          const isGenerating = generating === app.kind;
          return (
            <div
              key={app.kind}
              className={`rounded-xl border-2 ${app.borderColor} ${app.bgColor} p-5`}
            >
              <div className="flex items-start gap-4 flex-wrap">
                <div className={`flex items-center justify-center w-12 h-12 rounded-lg bg-white ${app.color} shrink-0`}>
                  <Icon size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900">{app.label}</h3>
                  <p className="text-xs text-gray-700 mt-0.5">{app.description}</p>
                  <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px]">
                    <span className="inline-flex items-center rounded bg-white/80 px-2 py-0.5 text-gray-700">
                      📆 {app.whenToFile}
                    </span>
                    <span className="inline-flex items-center rounded bg-white/80 px-2 py-0.5 text-gray-500">
                      ⚖️ {app.law}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => generateDoc(app.kind)}
                  disabled={!hasCaseNumber || isGenerating}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold rounded-lg shrink-0 ${
                    !hasCaseNumber || isGenerating
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : `${app.color.replace('text-', 'bg-')} text-white hover:opacity-90`
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <div className="animate-spin h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent" />
                      생성 중...
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      생성 & 다운로드
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {/* 사건번호 입력 모달 */}
      <CaseNumberModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        docLabel="부가신청서"
        initialCourt={caseData?.court}
        initialFilingDate={caseData?.filingDate}
        onConfirm={onCaseConfirm}
      />
    </div>
  );
}
