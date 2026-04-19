import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, CheckCircle, Clock, ChevronRight,
  Sparkles, ExternalLink, AlertCircle, ArrowUpRight, PenLine,
  AlertTriangle, ShieldCheck,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import dayjs from 'dayjs';

// 개인 사용자 플랜 타입
type IndividualPlan = 'self' | 'self_plus' | 'full';

const PLAN_LABELS: Record<IndividualPlan, string> = {
  self: 'SELF',
  self_plus: 'SELF+',
  full: 'FULL',
};

const PLAN_COLORS: Record<IndividualPlan, string> = {
  self: 'bg-gray-500/20 text-gray-600',
  self_plus: 'bg-brand-gold/20 text-brand-gold',
  full: 'bg-purple-500/20 text-purple-400',
};

// 케이스 상태
type CaseStatus =
  | 'collecting'      // 수집 중
  | 'generating'      // 서류 생성 중
  | 'ready'           // 서류 준비 완료
  | 'submitted'       // 접수 완료
  | 'prohibition'     // 금지명령 발령
  | 'correction'      // 보정 대응 중
  | 'commenced'       // 개시결정
  | 'creditorMeeting' // 채권자 집회
  | 'approved'        // 인가결정
  | 'repaying'        // 변제금 납부 중
  | 'discharged';     // 면책 완료

const CASE_STATUS_CONFIG: Record<CaseStatus, { label: string; shortLabel: string; color: string; bgColor: string; icon: typeof CheckCircle }> = {
  collecting:      { label: '수집 중',        shortLabel: '수집',   color: 'text-blue-500',    bgColor: 'bg-blue-500/10',    icon: Clock },
  generating:      { label: '서류 생성중',    shortLabel: '생성',   color: 'text-amber-500',   bgColor: 'bg-amber-500/10',   icon: Clock },
  ready:           { label: '서류 준비 완료', shortLabel: '준비',   color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', icon: CheckCircle },
  submitted:       { label: '접수 완료',      shortLabel: '접수',   color: 'text-purple-500',  bgColor: 'bg-purple-500/10',  icon: CheckCircle },
  prohibition:     { label: '금지명령 발령',  shortLabel: '금지',   color: 'text-indigo-500',  bgColor: 'bg-indigo-500/10',  icon: ShieldCheck },
  correction:      { label: '보정 대응 중',   shortLabel: '보정',   color: 'text-orange-500',  bgColor: 'bg-orange-500/10',  icon: AlertCircle },
  commenced:       { label: '개시결정',       shortLabel: '개시',   color: 'text-cyan-600',    bgColor: 'bg-cyan-600/10',    icon: CheckCircle },
  creditorMeeting: { label: '채권자 집회',    shortLabel: '집회',   color: 'text-pink-500',    bgColor: 'bg-pink-500/10',    icon: AlertTriangle },
  approved:        { label: '인가결정',       shortLabel: '인가',   color: 'text-emerald-600', bgColor: 'bg-emerald-600/10', icon: CheckCircle },
  repaying:        { label: '변제금 납부 중', shortLabel: '납부',   color: 'text-blue-600',    bgColor: 'bg-blue-600/10',    icon: Clock },
  discharged:      { label: '면책 완료',      shortLabel: '면책',   color: 'text-emerald-700', bgColor: 'bg-emerald-700/10', icon: Sparkles },
};

// 서류 5종
const DOCUMENT_TYPES = [
  { id: 'debt_list', label: '채권자 목록', description: '모든 채권자와 채무액 정리' },
  { id: 'asset_list', label: '재산 목록', description: '보유 재산 현황표' },
  { id: 'income_list', label: '수입지출 목록', description: '월 수입/지출 내역' },
  { id: 'application', label: '개인회생 신청서', description: '법원 제출용 신청서' },
  { id: 'repay_plan', label: '변제계획안', description: '월 변제금 계획서' },
];

// 신청 전 체크리스트
const PRE_CHECKLIST = [
  { id: 'work3m', label: '최소 3개월 이상 근로한 사실이 있나요?', tip: '개시결정을 위해 최소 3개월간 계속적 소득이 소명되어야 합니다' },
  { id: 'deposit', label: '예금을 모두 인출했나요?', tip: '신청 후 예금이 압류될 수 있습니다' },
  { id: 'card', label: '신용카드 사용을 중단했나요?', tip: '회생 기간 중 신용카드(후불교통카드 포함) 사용 불가. 체크카드는 가능합니다' },
  { id: 'loan', label: '마지막 대출 후 3개월이 지났나요?', tip: '대출 직후 신청 시 사기 의심을 받을 수 있습니다' },
  { id: 'partial', label: '특정 채권자에게만 먼저 갚지 않았나요?', tip: '편파변제는 부인권 행사 대상입니다' },
  { id: 'transfer', label: '재산을 가족 명의로 이전하지 않았나요?', tip: '재산 은닉은 형사처벌 대상입니다' },
  { id: 'debt', label: '모든 채무를 빠짐없이 정리했나요?', tip: '누락된 채무는 면책되지 않습니다' },
  { id: 'noloan', label: '회생 기간 중 신규 대출이 불가함을 이해했나요?', tip: '회생 기간 중 신용대출, 전세보증보험 발급이 안 됩니다' },
  { id: 'living', label: '3~5년간 최저생계비 수준 생활이 가능한가요?', tip: '변제금 납부 후 남는 금액(기준중위소득 60%)으로 생활해야 합니다' },
];

// 첨부서류 체크리스트
const ATTACHMENT_CHECKLIST = [
  { id: 'resident', label: '주민등록등본', where: '정부24 (gov.kr)', url: 'https://www.gov.kr', required: true },
  { id: 'family', label: '가족관계증명서', where: '대법원 전자가족관계등록시스템', url: 'https://efamily.scourt.go.kr', required: true },
  { id: 'income_cert', label: '소득금액증명원', where: '홈택스 (hometax.go.kr)', url: 'https://www.hometax.go.kr', required: true },
  { id: 'employment', label: '재직증명서 또는 근로계약서', where: '직장에서 발급', url: '', required: true },
  { id: 'bank_stmt', label: '통장 거래내역 (최근 1년)', where: '각 은행 인터넷뱅킹', url: '', required: true },
  { id: 'property_cert', label: '부동산등기사항전부증명서', where: '인터넷등기소 (iros.go.kr)', url: 'https://www.iros.go.kr', required: false },
  { id: 'vehicle_cert', label: '자동차등록원부', where: '정부24 (gov.kr)', url: 'https://www.gov.kr', required: false },
  { id: 'tax_cert', label: '납세증명서', where: '홈택스 (hometax.go.kr)', url: 'https://www.hometax.go.kr', required: false },
];

export default function IndividualDashboardPage() {
  const navigate = useNavigate();
  const individual = useAuthStore((s) => s.individual);

  const individualPlan: IndividualPlan | null = useMemo(() => {
    if (!individual?.plan) return null;
    return individual.plan as IndividualPlan;
  }, [individual]);

  const planExpiry = useMemo(() => {
    if (!individual?.planExpiresAt) return null;
    const d = individual.planExpiresAt instanceof Date
      ? individual.planExpiresAt
      : (individual.planExpiresAt as any).toDate?.() ?? null;
    return d ? dayjs(d).format('YYYY.MM.DD') : null;
  }, [individual?.planExpiresAt]);

  // 케이스 상태 (데모/초기값 - 실제 구현 시 Firestore에서 로드)
  const [caseStatus] = useState<CaseStatus>('collecting');
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [preCheckedItems, setPreCheckedItems] = useState<Set<string>>(new Set());

  const togglePreCheck = (id: string) => {
    setPreCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allPreChecked = preCheckedItems.size === PRE_CHECKLIST.length;

  const toggleCheck = (id: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const statusConfig = CASE_STATUS_CONFIG[caseStatus];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-6">
      {/* 상단: 플랜 배지 + 만료일 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">내 회생 현황</h1>
          <p className="mt-1 text-sm text-gray-500">개인회생 진행 상태를 확인하세요</p>
        </div>
        <div className="flex items-center gap-3">
          {individualPlan ? (
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${PLAN_COLORS[individualPlan]}`}>
              {PLAN_LABELS[individualPlan]}
            </span>
          ) : (
            <button
              onClick={() => navigate('/my/upgrade')}
              className="inline-flex items-center rounded-full bg-brand-gold/20 px-3 py-1 text-xs font-bold text-brand-gold hover:bg-brand-gold/30 transition-colors"
            >
              플랜 선택하기
            </button>
          )}
          {planExpiry && (
            <span className="text-xs text-gray-400">만료: {planExpiry}</span>
          )}
        </div>
      </div>

      {/* 케이스 상태 카드 */}
      <div className={`rounded-xl p-6 ${statusConfig.bgColor}`}>
        <div className="flex items-center gap-4">
          <div className={`flex h-14 w-14 items-center justify-center rounded-full bg-white`}>
            <StatusIcon size={28} className={statusConfig.color} />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-600">현재 진행 상태</p>
            <p className={`text-xl font-bold ${statusConfig.color}`}>{statusConfig.label}</p>
          </div>
          <div className="hidden sm:block">
            {/* 진행률 표시 */}
            <div className="flex items-center gap-1">
              {Object.keys(CASE_STATUS_CONFIG).map((s, i) => {
                const keys = Object.keys(CASE_STATUS_CONFIG);
                const currentIdx = keys.indexOf(caseStatus);
                const cfg = CASE_STATUS_CONFIG[s as CaseStatus];
                return (
                  <div key={s} className="flex items-center gap-0.5" title={cfg.label}>
                    <div className={`h-2.5 w-2.5 rounded-full ${i <= currentIdx ? 'bg-brand-gold' : 'bg-gray-300'}`} />
                    {i < keys.length - 1 && (
                      <div className={`h-0.5 w-3 ${i < currentIdx ? 'bg-brand-gold' : 'bg-gray-300'}`} />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-[10px] text-gray-400">수집</span>
              <span className="text-[10px] text-gray-400">면책</span>
            </div>
          </div>
        </div>
      </div>

      {/* 신청 전 꼭 확인하세요 */}
      <div className={`rounded-xl p-6 transition-colors ${allPreChecked ? 'bg-emerald-50 border-2 border-emerald-200' : 'bg-[#FEF3C7] border-2 border-amber-200'}`}>
        <div className="mb-4 flex items-center gap-3">
          {allPreChecked ? (
            <ShieldCheck size={24} className="text-emerald-600" />
          ) : (
            <AlertTriangle size={24} className="text-amber-600" />
          )}
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {allPreChecked ? '준비 완료!' : '신청 전 꼭 확인하세요'}
            </h2>
            {allPreChecked ? (
              <p className="text-sm text-emerald-600 font-medium">모든 항목을 확인했습니다. 안심하고 진행하세요.</p>
            ) : (
              <p className="text-sm text-gray-600">아래 항목을 모두 확인한 후 신청을 진행하세요</p>
            )}
          </div>
          <span className="ml-auto text-xs font-medium text-gray-500">
            {preCheckedItems.size}/{PRE_CHECKLIST.length}
          </span>
        </div>
        <div className="space-y-2">
          {PRE_CHECKLIST.map((item) => {
            const checked = preCheckedItems.has(item.id);
            return (
              <div
                key={item.id}
                onClick={() => togglePreCheck(item.id)}
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  checked
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-amber-200 bg-white hover:border-amber-300'
                }`}
              >
                <div
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                    checked
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-gray-300'
                  }`}
                >
                  {checked && <CheckCircle size={12} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${checked ? 'text-emerald-700' : 'text-gray-900'}`}>
                    {item.label}
                  </p>
                  <p className={`text-xs mt-0.5 ${checked ? 'text-emerald-500' : 'text-amber-600'}`}>
                    {item.tip}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CODEF 금융데이터 수집 */}
      <div className="rounded-xl border-2 border-[#48B5A0]/30 bg-[#48B5A0]/5 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#48B5A0]/20">
              <Sparkles size={24} className="text-[#48B5A0]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">금융데이터 수집</h2>
              <p className="text-sm text-gray-500">CODEF 인증 1회로 은행·카드·보험 정보를 자동 수집합니다</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/my/collection')}
            className="shrink-0 rounded-xl bg-[#48B5A0] px-6 py-3 text-sm font-bold text-white hover:bg-[#2B8C8C] transition-colors"
          >
            수집 시작하기
          </button>
        </div>
      </div>

      {/* 진술서 작성 + 면책 가능성 확인 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => navigate('/my/statement')}
          className="rounded-xl border-2 border-purple-200 bg-purple-50 p-6 text-left transition-all hover:border-purple-300 hover:shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
              <PenLine size={24} className="text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="text-base font-semibold text-gray-900">진술서 작성</p>
              <p className="text-sm text-gray-500">회생에 이르게 된 경위, 재산 변동 사항 등을 작성합니다</p>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </div>
        </button>
        <button
          onClick={() => navigate('/my/discharge-check')}
          className="rounded-xl border-2 border-teal-200 bg-teal-50 p-6 text-left transition-all hover:border-teal-300 hover:shadow-sm"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-100">
              <ShieldCheck size={24} className="text-teal-600" />
            </div>
            <div className="flex-1">
              <p className="text-base font-semibold text-gray-900">면책 가능성 확인</p>
              <p className="text-sm text-gray-500">면책불허가 사유에 해당하는지 자가확인합니다</p>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </div>
        </button>
      </div>

      {/* 서류 생성 버튼 (5종) */}
      <div className="rounded-xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">서류 생성</h2>
          <span className="text-xs text-gray-400">법원 제출 서류 5종</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DOCUMENT_TYPES.map((docType) => (
            <button
              key={docType.id}
              onClick={() => navigate('/my/documents')}
              className="group flex items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition-all hover:border-brand-gold hover:bg-brand-gold/5"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-gold/10">
                <FileText size={20} className="text-brand-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{docType.label}</p>
                <p className="truncate text-xs text-gray-500">{docType.description}</p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-gray-300 group-hover:text-brand-gold transition-colors" />
            </button>
          ))}
        </div>
      </div>

      {/* 첨부서류 체크리스트 */}
      <div className="rounded-xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">첨부서류 체크리스트</h2>
          <span className="text-xs text-gray-500">
            {checkedItems.size}/{ATTACHMENT_CHECKLIST.length} 완료
          </span>
        </div>
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-blue-50 p-3">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-blue-500" />
          <p className="text-xs text-blue-700">
            아래 서류들은 직접 발급받아 법원에 함께 제출해야 합니다. 발급처 링크를 클릭하면 해당 사이트로 이동합니다.
          </p>
        </div>
        <div className="space-y-2">
          {ATTACHMENT_CHECKLIST.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                checkedItems.has(item.id)
                  ? 'border-emerald-200 bg-emerald-50/50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <button
                onClick={() => toggleCheck(item.id)}
                aria-label={`${item.label} 체크`}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                  checkedItems.has(item.id)
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-gray-300 hover:border-brand-gold'
                }`}
              >
                {checkedItems.has(item.id) && <CheckCircle size={12} />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${checkedItems.has(item.id) ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    {item.label}
                  </span>
                  {item.required && (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">필수</span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-xs text-gray-500">{item.where}</span>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-xs text-blue-500 hover:text-blue-700"
                      onClick={(e) => e.stopPropagation()}
                    >
                      바로가기 <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 법원 접수 안내 */}
      <button
        onClick={() => navigate('/my/court-guide')}
        className="w-full rounded-xl border border-gray-200 bg-white p-5 text-left transition-all hover:border-brand-gold hover:shadow-sm"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-gold/10">
            <FileText size={24} className="text-brand-gold" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">법원 접수 가이드</p>
            <p className="text-xs text-gray-500">관할 법원 찾기, 준비물, 접수 절차를 확인하세요</p>
          </div>
          <ChevronRight size={18} className="text-gray-400" />
        </div>
      </button>

      {/* 부가신청서 (금지/중지/면제재산) */}
      <button
        onClick={() => navigate('/my/additional-applications')}
        className="w-full rounded-xl border border-gray-200 bg-white p-5 text-left transition-all hover:border-indigo-400 hover:shadow-sm"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-500/10">
            <ShieldCheck size={24} className="text-indigo-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">부가신청서 생성</p>
            <p className="text-xs text-gray-500">
              금지명령·중지명령·면제재산결정 신청서 3종을 사건번호 기반 자동 생성
            </p>
          </div>
          <ChevronRight size={18} className="text-gray-400" />
        </div>
      </button>

      {/* 하단: 업그레이드 배너 */}
      {(!individualPlan || individualPlan === 'self') && (
        <div className="rounded-xl bg-gradient-to-r from-[#0D1B2A] to-[#1a3050] p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Sparkles size={18} className="text-brand-gold" />
                <span className="text-sm font-bold text-brand-gold">SELF+ 업그레이드</span>
              </div>
              <p className="text-sm text-gray-300">
                전문가 서류 검토 + 보정명령 대응까지 한 번에
              </p>
              <ul className="mt-3 space-y-1 text-xs text-gray-400">
                <li className="flex items-center gap-1.5">
                  <CheckCircle size={12} className="text-brand-gold" />
                  전문가 서류 검토 1회 포함
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle size={12} className="text-brand-gold" />
                  보정명령 대응 가이드
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle size={12} className="text-brand-gold" />
                  카카오톡 1:1 상담
                </li>
              </ul>
            </div>
            <button
              onClick={() => navigate('/my/upgrade')}
              className="shrink-0 rounded-lg bg-brand-gold px-5 py-2.5 text-sm font-bold text-black hover:bg-[#b8973e] transition-colors flex items-center gap-1"
            >
              업그레이드 <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
