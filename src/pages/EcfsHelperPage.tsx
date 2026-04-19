import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  Copy, Check, ChevronDown, ChevronUp, ExternalLink,
  FileText, Download, AlertCircle, CheckCircle, Circle,
  ArrowRight, Clock, CreditCard, Shield, Building2,
  ClipboardCheck, Banknote, Send, RefreshCw, Bell,
  HelpCircle, ChevronRight, Info, Zap,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useClients } from '@/hooks/useClients';
import { getIndividualCase } from '@/api/firestore';
import { formatKRW, formatPhone, maskSSN } from '@/utils/formatter';
import type { Client } from '@/types/client';
import {
  APPLICANT_FIELDS,
  CREDITOR_FIELDS,
  ASSET_FIELDS,
  INCOME_FIELDS,
  EXPENSE_FIELDS,
  ECFS_GUIDE_STEPS,
  ECFS_CHECKLIST,
  ECFS_ATTACHMENTS,
  CORRECTION_ORDER_TYPES,
  calcTotalFilingCost,
  generateCourtFileName,
  type EcfsField,
  type ChecklistItem,
  type EcfsGuideStep,
} from '@/utils/ecfsFieldMap';
import { generateCreditorCsv, generateAssetCsv, generateCreditorBasicInfoCsv, downloadCsv } from '@/utils/ecfsCsv';
import { toast } from '@/utils/toast';

// ─────────────────────────────────────────────────
// 복사 버튼 컴포넌트
// ─────────────────────────────────────────────────
function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 폴백: textarea 방식
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [value]);

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
        copied
          ? 'bg-green-100 text-green-700 border border-green-200'
          : 'bg-gray-100 text-gray-600 hover:bg-brand-gold/10 hover:text-brand-gold border border-gray-200 hover:border-brand-gold/30'
      }`}
      title={`"${value}" 복사`}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? '복사됨' : (label || '복사')}
    </button>
  );
}

// ─────────────────────────────────────────────────
// 데이터 테이블 행 (복사 기능 포함)
// ─────────────────────────────────────────────────
function DataRow({
  label,
  value,
  displayValue,
  hint,
  ecfsLocation,
}: {
  label: string;
  value: string;
  displayValue?: string;
  hint?: string;
  ecfsLocation?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-white px-4 py-3 hover:border-brand-gold/20 hover:bg-brand-gold/5 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500">{label}</span>
          {ecfsLocation && (
            <span className="text-[10px] text-gray-400 hidden sm:inline">
              {ecfsLocation}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm font-medium text-gray-900 truncate">
          {displayValue || value || '-'}
        </p>
        {hint && (
          <p className="mt-0.5 text-[10px] text-amber-600">{hint}</p>
        )}
      </div>
      <CopyButton value={value} />
    </div>
  );
}

// ─────────────────────────────────────────────────
// 전체 복사 버튼
// ─────────────────────────────────────────────────
function CopyAllButton({ items }: { items: { label: string; value: string }[] }) {
  const [copied, setCopied] = useState(false);

  const handleCopyAll = useCallback(async () => {
    const text = items.map(i => `${i.label}: ${i.value}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  }, [items]);

  return (
    <button
      onClick={handleCopyAll}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
        copied
          ? 'bg-green-100 text-green-700'
          : 'bg-brand-gold/10 text-brand-gold hover:bg-brand-gold/20'
      }`}
    >
      {copied ? <Check size={14} /> : <Zap size={14} />}
      {copied ? '전체 복사됨' : '전체 복사'}
    </button>
  );
}

// ─────────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────────
type TabId = 'guide' | 'copy' | 'files' | 'checklist' | 'correction';

export default function EcfsHelperPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>('guide');
  const [expandedStep, setExpandedStep] = useState<number | null>(0);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [expandedCreditor, setExpandedCreditor] = useState<number>(0);

  // B2B vs B2C 판별
  const isIndividualPage = location.pathname.startsWith('/my');
  const individual = useAuthStore((s) => s.individual);
  const userType = useAuthStore((s) => s.userType);

  // B2B: 의뢰인 목록에서 선택
  const { data: clients = [] } = useClients();
  const clientIdFromUrl = searchParams.get('clientId');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(clientIdFromUrl);
  const selectedOfficeClient = clients.find((c) => c.id === selectedClientId) ?? null;

  // B2C: 개인 케이스 로드
  const [individualCase, setIndividualCase] = useState<Client | null>(null);
  useEffect(() => {
    if (isIndividualPage && individual?.id) {
      getIndividualCase(individual.id).then(setIndividualCase).catch(() => {});
    }
  }, [isIndividualPage, individual?.id]);

  // URL 파라미터 동기화
  useEffect(() => {
    if (clientIdFromUrl && clientIdFromUrl !== selectedClientId) {
      setSelectedClientId(clientIdFromUrl);
    }
  }, [clientIdFromUrl]);

  // 통합 클라이언트 데이터
  const sourceClient = isIndividualPage ? individualCase : selectedOfficeClient;
  const clientData = useMemo(() => ({
    name: sourceClient?.name || individual?.name || '(이름 미입력)',
    ssn: (sourceClient as any)?.ssnMasked || (sourceClient as any)?.ssn || '000000-0000000',
    address: sourceClient?.address || '(주소 미입력)',
    phone: sourceClient?.phone || individual?.phone || '(전화번호 미입력)',
    job: sourceClient?.job || '(직업 미입력)',
    court: sourceClient?.court || '(법원 미선택)',
    income: sourceClient?.income || 0,
    income2: sourceClient?.income2 || 0,
    family: sourceClient?.family || 1,
    rent: sourceClient?.rent || 0,
    education: sourceClient?.education || 0,
    medical: sourceClient?.medical || 0,
    debts: sourceClient?.debts || [],
    assets: sourceClient?.assets || [],
  }), [sourceClient, individual]);

  const creditorCount = clientData.debts.length;
  const filingCost = useMemo(() => calcTotalFilingCost(creditorCount), [creditorCount]);

  const toggleChecklist = (id: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const tabs: { id: TabId; label: string; icon: typeof FileText }[] = [
    { id: 'guide', label: '단계별 가이드', icon: ClipboardCheck },
    { id: 'copy', label: '복사 도우미', icon: Copy },
    { id: 'files', label: '파일 준비', icon: Download },
    { id: 'checklist', label: '체크리스트', icon: CheckCircle },
    { id: 'correction', label: '보정 대응', icon: RefreshCw },
  ];

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">전자소송 제출 도우미</h1>
          <p className="mt-1 text-sm text-gray-500">
            생성된 서류를 전자소송(ecfs.scourt.go.kr)에 제출하는 과정을 안내합니다
          </p>
        </div>
        <a
          href="https://ecfs.scourt.go.kr"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D1B2A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1a2d42] transition-colors"
        >
          <ExternalLink size={14} />
          전자소송 바로가기
        </a>
      </div>

      {/* B2B: 의뢰인 선택 */}
      {!isIndividualPage && (
        <div className="rounded-xl bg-white border border-gray-200 p-4">
          <label className="block text-sm font-semibold text-gray-700 mb-2">의뢰인 선택</label>
          {clients.length === 0 ? (
            <p className="text-sm text-gray-500">등록된 의뢰인이 없습니다. 먼저 의뢰인을 등록해주세요.</p>
          ) : (
            <select
              value={selectedClientId ?? ''}
              onChange={(e) => setSelectedClientId(e.target.value || null)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-gold focus:ring-1 focus:ring-brand-gold outline-none"
            >
              <option value="">의뢰인을 선택하세요</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          )}
          {selectedOfficeClient && (
            <div className="mt-3 flex items-center gap-4 text-sm text-gray-600">
              <span>채무: {formatKRW(selectedOfficeClient.debts?.reduce((s, d) => s + d.amount, 0) ?? 0)}</span>
              <span>재산: {formatKRW(selectedOfficeClient.assets?.reduce((s, a) => s + a.value, 0) ?? 0)}</span>
              <span>채권자: {selectedOfficeClient.debts?.length ?? 0}명</span>
            </div>
          )}
        </div>
      )}

      {/* 비용 요약 카드 */}
      <div className="rounded-xl bg-gradient-to-r from-brand-gold/10 to-amber-50 border border-brand-gold/20 p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-semibold text-brand-gold">예상 제출 비용</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {formatKRW(filingCost.total)}
            </p>
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <span className="text-gray-500">인지대</span>
              <p className="font-semibold text-gray-900">{formatKRW(filingCost.stampFee)}</p>
              <p className="text-[10px] text-green-600">전자소송 10% 할인 적용</p>
            </div>
            <div>
              <span className="text-gray-500">송달료</span>
              <p className="font-semibold text-gray-900">{formatKRW(filingCost.serviceFee)}</p>
              <p className="text-[10px] text-gray-400">채권자 {creditorCount}명 x 5,200원 x 15회</p>
            </div>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─── 탭 1: 단계별 가이드 ─── */}
      {activeTab === 'guide' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
            <div className="flex gap-2">
              <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800">
                  전자소송으로 제출하면 인지대가 10% 할인됩니다
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  법원 방문 없이 온라인으로 24시간 접수 가능하며, 사건 진행 상황도 실시간 확인할 수 있습니다.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-0">
            {ECFS_GUIDE_STEPS.map((step, i) => (
              <div key={step.step} className="relative flex gap-4">
                {/* 세로 연결선 */}
                {i < ECFS_GUIDE_STEPS.length - 1 && (
                  <div className="absolute left-[23px] top-[48px] h-[calc(100%-24px)] w-0.5 bg-gray-200" />
                )}
                {/* 아이콘 */}
                <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-gold text-white font-bold">
                  {step.step}
                </div>
                {/* 내용 */}
                <div className={`flex-1 ${i < ECFS_GUIDE_STEPS.length - 1 ? 'pb-6' : 'pb-0'}`}>
                  <button
                    onClick={() => setExpandedStep(expandedStep === i ? null : i)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{step.title}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{step.description}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Clock size={10} /> ~{step.estimatedMinutes}분
                        </span>
                        {expandedStep === i
                          ? <ChevronUp size={14} className="text-gray-400" />
                          : <ChevronDown size={14} className="text-gray-400" />}
                      </div>
                    </div>
                  </button>

                  {expandedStep === i && (
                    <div className="mt-3 space-y-2 rounded-lg bg-gray-50 p-4 border border-gray-100">
                      <p className="text-[10px] font-semibold text-brand-gold">{step.ecfsPath}</p>
                      <ul className="space-y-1.5">
                        {step.details.map((d, j) => (
                          <li key={j} className="flex items-start gap-2 text-xs text-gray-600">
                            <ArrowRight size={10} className="mt-0.5 shrink-0 text-brand-gold" />
                            <span>{d}</span>
                          </li>
                        ))}
                      </ul>
                      {step.fieldGroup === 'applicant' && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs font-semibold text-gray-700 mb-2">
                            이 단계에서 필요한 데이터:
                          </p>
                          <div className="space-y-1.5">
                            <DataRow label="성명" value={clientData.name} />
                            <DataRow label="주소" value={clientData.address} />
                            <DataRow label="관할법원" value={clientData.court} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="text-center pt-4">
            <p className="text-xs text-gray-400">
              총 예상 소요 시간: 약 {ECFS_GUIDE_STEPS.reduce((s, step) => s + step.estimatedMinutes, 0)}분
            </p>
          </div>
        </div>
      )}

      {/* ─── 탭 2: 복사 도우미 ─── */}
      {activeTab === 'copy' && (
        <div className="space-y-6">
          {/* 신청인 정보 */}
          <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Building2 size={18} className="text-brand-gold" />
                <h3 className="text-sm font-bold text-gray-900">신청인 정보</h3>
              </div>
              <CopyAllButton items={[
                { label: '성명', value: clientData.name },
                { label: '주민등록번호', value: clientData.ssn },
                { label: '주소', value: clientData.address },
                { label: '전화번호', value: clientData.phone },
                { label: '직업', value: clientData.job },
                { label: '관할법원', value: clientData.court },
              ]} />
            </div>
            <div className="p-4 space-y-2">
              <DataRow
                label="성명"
                value={clientData.name}
                ecfsLocation="신청인 정보 > 성명"
              />
              <DataRow
                label="주민등록번호"
                value={clientData.ssn}
                displayValue={maskSSN(clientData.ssn)}
                ecfsLocation="신청인 정보 > 주민등록번호"
                hint="전자소송에는 전체 번호를 입력하세요"
              />
              <DataRow
                label="주소"
                value={clientData.address}
                ecfsLocation="신청인 정보 > 주소"
                hint="주민등록등본상 주소와 동일해야 합니다"
              />
              <DataRow
                label="전화번호"
                value={formatPhone(clientData.phone)}
                ecfsLocation="신청인 정보 > 전화번호"
              />
              <DataRow
                label="직업"
                value={clientData.job}
                ecfsLocation="신청인 정보 > 직업"
              />
              <DataRow
                label="관할법원"
                value={clientData.court}
                ecfsLocation="사건 정보 > 관할법원"
              />
            </div>
          </div>

          {/* 수입/지출 정보 */}
          <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Banknote size={18} className="text-brand-gold" />
                <h3 className="text-sm font-bold text-gray-900">수입/지출 정보</h3>
              </div>
              <CopyAllButton items={[
                { label: '월 급여소득', value: String(clientData.income) },
                { label: '기타소득', value: String(clientData.income2) },
                { label: '주거비', value: String(clientData.rent) },
                { label: '교육비', value: String(clientData.education) },
                { label: '의료비', value: String(clientData.medical) },
              ]} />
            </div>
            <div className="p-4 space-y-2">
              <DataRow
                label="월 급여소득"
                value={String(clientData.income)}
                displayValue={formatKRW(clientData.income)}
                ecfsLocation="수입지출 목록 > 근로소득"
                hint="숫자만 붙여넣기"
              />
              <DataRow
                label="기타소득"
                value={String(clientData.income2)}
                displayValue={formatKRW(clientData.income2)}
                ecfsLocation="수입지출 목록 > 기타소득"
              />
              <DataRow
                label="가구원 수"
                value={String(clientData.family)}
                ecfsLocation="수입지출 목록 > 세대원 수"
              />
              <DataRow
                label="주거비(임차료)"
                value={String(clientData.rent)}
                displayValue={formatKRW(clientData.rent)}
                ecfsLocation="수입지출 목록 > 주거비"
              />
              <DataRow
                label="교육비"
                value={String(clientData.education)}
                displayValue={formatKRW(clientData.education)}
                ecfsLocation="수입지출 목록 > 교육비"
              />
              <DataRow
                label="의료비"
                value={String(clientData.medical)}
                displayValue={formatKRW(clientData.medical)}
                ecfsLocation="수입지출 목록 > 의료비"
              />
            </div>
          </div>

          {/* 채권자 정보 (탭 형식) */}
          {clientData.debts.length > 0 && (
            <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <CreditCard size={18} className="text-brand-gold" />
                  <h3 className="text-sm font-bold text-gray-900">
                    채권자 정보 ({clientData.debts.length}건)
                  </h3>
                </div>
              </div>

              {/* 채권자 선택 탭 */}
              <div className="flex overflow-x-auto border-b border-gray-100 px-4 pt-3">
                {clientData.debts.map((debt: any, i: number) => (
                  <button
                    key={i}
                    onClick={() => setExpandedCreditor(i)}
                    className={`whitespace-nowrap rounded-t-lg px-3 py-2 text-xs font-medium transition-colors ${
                      expandedCreditor === i
                        ? 'bg-brand-gold/10 text-brand-gold border-b-2 border-brand-gold'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {debt.creditor || `채권자 ${i + 1}`}
                  </button>
                ))}
              </div>

              {/* 선택된 채권자 데이터 */}
              {clientData.debts[expandedCreditor] && (() => {
                const debt = clientData.debts[expandedCreditor] as any;
                return (
                  <div className="p-4 space-y-2">
                    <div className="flex justify-end mb-1">
                      <CopyAllButton items={[
                        { label: '채권자명', value: debt.creditor || '' },
                        { label: '채무유형', value: debt.type || '' },
                        { label: '채권금액', value: String(debt.amount || 0) },
                        { label: '이자율', value: `${debt.rate || 0}%` },
                      ]} />
                    </div>
                    <DataRow
                      label="채권자명(상호)"
                      value={debt.creditor || ''}
                      ecfsLocation="채권자 목록 > 채권자 상호"
                    />
                    <DataRow
                      label="채무 유형"
                      value={debt.type || '무담보'}
                      ecfsLocation="채권자 목록 > 채무 유형"
                    />
                    <DataRow
                      label="채권 금액"
                      value={String(debt.amount || 0)}
                      displayValue={formatKRW(debt.amount || 0)}
                      ecfsLocation="채권자 목록 > 원금"
                      hint="숫자만 입력"
                    />
                    <DataRow
                      label="이자율"
                      value={`${(debt.rate || 0).toFixed(1)}%`}
                      ecfsLocation="채권자 목록 > 이자율"
                    />
                    <DataRow
                      label="월 상환액"
                      value={String(debt.monthly || 0)}
                      displayValue={formatKRW(debt.monthly || 0)}
                      ecfsLocation="채권자 목록 > 월 변제액"
                    />
                  </div>
                );
              })()}
            </div>
          )}

          {/* 재산 정보 */}
          {clientData.assets.length > 0 && (
            <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Shield size={18} className="text-brand-gold" />
                  <h3 className="text-sm font-bold text-gray-900">
                    재산 정보 ({clientData.assets.length}건)
                  </h3>
                </div>
              </div>
              <div className="p-4 space-y-4">
                {clientData.assets.map((asset: any, i: number) => (
                  <div key={i} className="space-y-2">
                    {i > 0 && <hr className="border-gray-100" />}
                    <p className="text-xs font-semibold text-gray-500">
                      재산 {i + 1}: {asset.name || asset.type}
                    </p>
                    <DataRow
                      label="재산 명칭"
                      value={asset.name || ''}
                      ecfsLocation="재산 목록 > 재산명"
                    />
                    <DataRow
                      label="재산 유형"
                      value={asset.type || ''}
                      ecfsLocation="재산 목록 > 종류"
                    />
                    <DataRow
                      label="평가액(시가)"
                      value={String(asset.rawValue || 0)}
                      displayValue={formatKRW(asset.rawValue || 0)}
                      ecfsLocation="재산 목록 > 시가"
                    />
                    <DataRow
                      label="청산가치"
                      value={String(asset.value || 0)}
                      displayValue={formatKRW(asset.value || 0)}
                      ecfsLocation="재산 목록 > 청산가치"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── 탭 3: 파일 준비 ─── */}
      {activeTab === 'files' && (
        <div className="space-y-6">
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
            <div className="flex gap-2">
              <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800">
                  전자소송에는 PDF 형식이 권장됩니다
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  DOCX/HWPX 파일은 자동으로 PDF로 변환됩니다.
                  파일명은 법원 권장 형식으로 자동 설정됩니다.
                  파일당 최대 크기: 50MB
                </p>
              </div>
            </div>
          </div>

          {/* 자동 생성 서류 5종 + 진술서 */}
          <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">자동 생성 서류 (6종)</h3>
              <p className="text-xs text-gray-500 mt-1">
                회생클릭에서 자동 생성된 서류입니다. PDF로 다운로드하여 전자소송에 첨부하세요.
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {ECFS_ATTACHMENTS.filter(a => a.category === '신청서류').map((att, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <FileText size={18} className="text-brand-gold" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{att.ecfsLabel}</p>
                      <p className="text-[10px] text-gray-400">
                        {generateCourtFileName(att.docType, clientData.name)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                      onClick={() => {
                        // TODO: DOCX/HWPX 다운로드 트리거
                        // navigate(`/my/documents?download=${att.docType}&format=docx`);
                      }}
                    >
                      <Download size={12} /> DOCX
                    </button>
                    <button
                      className="inline-flex items-center gap-1 rounded-lg bg-brand-gold text-white px-3 py-2 text-xs font-semibold hover:bg-brand-gold/90 transition-colors"
                      onClick={() => {
                        // TODO: PDF 변환 + 다운로드
                        // 실제 구현: Worker에서 DOCX→PDF 변환 후 다운로드
                      }}
                    >
                      <Download size={12} /> PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 전자소송 정식 양식 CSV 일괄등록 */}
          <div className="rounded-xl bg-white border-2 border-green-500 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-green-100 bg-gradient-to-r from-green-50 to-emerald-50">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center rounded-full bg-green-600 text-white px-2 py-0.5 text-[10px] font-bold">공식 양식</span>
                <h3 className="text-sm font-bold text-gray-900">전자소송 채권자기본정보 CSV (일괄등록)</h3>
              </div>
              <p className="text-xs text-gray-600">
                대법원 전자소송 포털 <strong>공식 견본파일</strong>(13컬럼) 그대로 생성합니다.
                개인회생 채권자기본정보 일괄등록에 바로 사용 가능합니다.
              </p>
            </div>

            {/* 채권자기본정보 CSV (정식) */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <FileText size={20} className="text-green-600" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">채권자기본정보 CSV (13컬럼 정식)</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    체크 · 구분 · 채권자목록번호 · 구분번호 · 채권자명 · 인격구분 · 주소1/2 · 우편번호 · 휴대전화/전화/팩스/이메일
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    채권자 {clientData.debts.length}건 · 보증인 자동 추가 · 최대 5,000명
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (clientData.debts.length === 0) {
                    toast.warning('채권자 정보가 없습니다');
                    return;
                  }
                  const { csv, warnings } = generateCreditorBasicInfoCsv(clientData.debts);
                  if (warnings.length > 0) {
                    const preview = warnings.slice(0, 3).join('\n');
                    const more = warnings.length > 3 ? `\n...외 ${warnings.length - 3}건` : '';
                    toast.warning(`검증 경고 ${warnings.length}건\n${preview}${more}`);
                  }
                  downloadCsv(csv, `채권자기본정보_${clientData.name}.csv`);
                }}
                disabled={clientData.debts.length === 0}
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-bold transition-colors ${
                  clientData.debts.length === 0
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                <Download size={14} /> 공식 CSV 다운로드
              </button>
            </div>

            {/* 업로드 안내 (공식 양식) */}
            <div className="px-5 py-4 bg-green-50">
              <p className="text-xs font-semibold text-green-800 mb-2">전자소송 일괄등록 방법</p>
              <ol className="space-y-1.5 text-xs text-green-700">
                <li className="flex items-start gap-2">
                  <span className="shrink-0 font-bold">1.</span>
                  <span>전자소송 포털 → 개인회생 신청 → <strong>채권자기본정보 일괄등록</strong> 메뉴 이동</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 font-bold">2.</span>
                  <span>위에서 받은 공식 CSV 파일 업로드</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="shrink-0 font-bold">3.</span>
                  <span>자동 입력된 내용 확인 후 저장 — 체크 항목 기본값 "F" 유지</span>
                </li>
              </ol>
              <div className="mt-3 pt-3 border-t border-green-200 text-[11px] text-green-600 leading-relaxed">
                💡 <strong>인격구분 자동 추정</strong>: 채권자명에서 "은행/카드/보험/주식회사/(주)" 등 키워드를 감지해 법인/자연인/비법인을 자동 판별합니다. 필요 시 전자소송에서 수정 가능.
              </div>
            </div>
          </div>

          {/* 기존 내부용 CSV (회계 상세) */}
          <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-700">내부 검토용 CSV (참고)</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                회계 상세(원금/이자/지연손해금/별제권/부족액 등) 포함 — 사무소 내부 검토·백업용
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              <div className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <FileText size={16} className="text-gray-500" />
                  <div>
                    <p className="text-xs font-medium text-gray-700">채권자 상세 CSV (회계)</p>
                    <p className="text-[10px] text-gray-400">채권자 {clientData.debts.length}건</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (clientData.debts.length === 0) return;
                    const csv = generateCreditorCsv(clientData.debts);
                    downloadCsv(csv, `채권자상세_${clientData.name}.csv`);
                  }}
                  disabled={clientData.debts.length === 0}
                  className={`inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-[11px] font-medium ${
                    clientData.debts.length === 0
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-700 text-white hover:bg-gray-800'
                  }`}
                >
                  <Download size={11} /> 다운로드
                </button>
              </div>
              <div className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <FileText size={16} className="text-gray-500" />
                  <div>
                    <p className="text-xs font-medium text-gray-700">재산목록 CSV</p>
                    <p className="text-[10px] text-gray-400">재산 {clientData.assets.length}건</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (clientData.assets.length === 0) return;
                    const csv = generateAssetCsv(clientData.assets);
                    downloadCsv(csv, `재산목록_${clientData.name}.csv`);
                  }}
                  disabled={clientData.assets.length === 0}
                  className={`inline-flex items-center gap-1 rounded px-2.5 py-1.5 text-[11px] font-medium ${
                    clientData.assets.length === 0
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-700 text-white hover:bg-gray-800'
                  }`}
                >
                  <Download size={11} /> 다운로드
                </button>
              </div>
            </div>
          </div>

          {/* 증빙 서류 */}
          <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">첨부 증빙서류</h3>
              <p className="text-xs text-gray-500 mt-1">
                이미 수집/업로드한 증빙서류를 전자소송에 첨부합니다.
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {ECFS_ATTACHMENTS.filter(a => a.category === '첨부서류').map((att, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <FileText size={18} className={att.required ? 'text-blue-500' : 'text-gray-400'} />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">{att.ecfsLabel}</p>
                        {att.required && (
                          <span className="text-[10px] font-semibold text-red-500 bg-red-50 rounded px-1.5 py-0.5">필수</span>
                        )}
                      </div>
                      {att.hint && (
                        <p className="text-[10px] text-gray-400">{att.hint}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{att.recommendedFileName}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 파일 최적화 안내 */}
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-5">
            <h4 className="text-sm font-bold text-gray-900 mb-3">파일 최적화 자동 처리 사항</h4>
            <div className="space-y-2">
              {[
                { label: 'PDF 자동 변환', desc: 'DOCX/HWPX 파일을 전자소송 호환 PDF로 자동 변환' },
                { label: '법원 권장 파일명', desc: '"서류명_신청인성명.pdf" 형식으로 자동 설정' },
                { label: '파일 크기 최적화', desc: '50MB 이하로 자동 압축, 이미지 해상도 최적화' },
                { label: 'A4 규격 자동 조정', desc: '용지 크기, 여백을 법원 제출 기준에 맞게 조정' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-medium text-gray-700">{item.label}</span>
                    <span className="text-xs text-gray-500 ml-1">- {item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── 탭 4: 체크리스트 ─── */}
      {activeTab === 'checklist' && (
        <div className="space-y-4">
          {/* 진행률 */}
          <div className="rounded-xl bg-white border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-900">제출 진행률</p>
              <span className="text-sm font-bold text-brand-gold">
                {checkedItems.size}/{ECFS_CHECKLIST.length}
              </span>
            </div>
            <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-gold transition-all"
                style={{ width: `${(checkedItems.size / ECFS_CHECKLIST.length) * 100}%` }}
              />
            </div>
          </div>

          {/* 카테고리별 체크리스트 */}
          {(['preparation', 'documents', 'attachments', 'payment', 'submission'] as const).map(cat => {
            const catLabels: Record<string, string> = {
              preparation: '사전 준비',
              documents: '신청서 입력',
              attachments: '서류 첨부',
              payment: '비용 납부',
              submission: '최종 제출',
            };
            const catIcons: Record<string, typeof FileText> = {
              preparation: Building2,
              documents: FileText,
              attachments: ClipboardCheck,
              payment: Banknote,
              submission: Send,
            };
            const Icon = catIcons[cat];
            const items = ECFS_CHECKLIST.filter(item => item.category === cat);
            const catDone = items.filter(item => checkedItems.has(item.id)).length;

            return (
              <div key={cat} className="rounded-xl bg-white border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Icon size={18} className="text-brand-gold" />
                    <h3 className="text-sm font-bold text-gray-900">{catLabels[cat]}</h3>
                  </div>
                  <span className="text-xs text-gray-400">{catDone}/{items.length}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {items.map(item => (
                    <label
                      key={item.id}
                      className="flex items-start gap-3 px-5 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={checkedItems.has(item.id)}
                        onChange={() => toggleChecklist(item.id)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-gold focus:ring-brand-gold"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium ${
                            checkedItems.has(item.id) ? 'text-gray-400 line-through' : 'text-gray-900'
                          }`}>
                            {item.label}
                          </p>
                          {item.estimatedMinutes && (
                            <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                              <Clock size={10} /> ~{item.estimatedMinutes}분
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                      </div>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-gray-400 hover:text-blue-500"
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                      {item.autoCheckable && (
                        <span className="shrink-0 text-[10px] text-green-500 bg-green-50 rounded px-1.5 py-0.5">
                          자동
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}

          {/* 전체 소요 시간 */}
          <div className="text-center pt-2">
            <p className="text-xs text-gray-400">
              예상 총 소요 시간: 약 {ECFS_CHECKLIST.reduce((s, item) => s + (item.estimatedMinutes || 0), 0)}분
            </p>
          </div>
        </div>
      )}

      {/* ─── 탭 5: 보정명령 대응 ─── */}
      {activeTab === 'correction' && (
        <div className="space-y-6">
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
            <div className="flex gap-2">
              <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  보정명령은 대부분의 사건에서 1~2회 발생하며 정상적인 절차입니다
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  보정명령을 받으면 지정 기간(보통 14일) 내에 보정서를 제출해야 합니다.
                  전자소송에서 보정명령을 확인하고 아래 절차에 따라 대응하세요.
                </p>
              </div>
            </div>
          </div>

          {/* 보정명령 대응 플로우 */}
          <div className="rounded-xl bg-white border border-gray-200 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-4">보정명령 대응 절차</h3>
            <div className="space-y-0">
              {[
                {
                  step: 1,
                  icon: Bell,
                  title: '보정명령 알림 확인',
                  desc: '전자소송 사이트에서 보정명령 수령 (SMS/이메일 알림)',
                  detail: '전자소송 로그인 > [나의 사건] > [송달문서함]에서 보정명령 확인',
                },
                {
                  step: 2,
                  icon: FileText,
                  title: '보정 내용 파악',
                  desc: '법원이 요구하는 보정 사항을 정확히 파악',
                  detail: '보정명령서의 "보정할 사항" 항목을 꼼꼼히 읽고, 아래 유형별 대응 방법 참고',
                },
                {
                  step: 3,
                  icon: RefreshCw,
                  title: '보정 서류 생성/수정',
                  desc: '회생클릭에서 수정된 서류를 재생성하거나 추가 서류 준비',
                  detail: '데이터 수정 후 [서류 재생성]으로 보정된 서류를 다시 만듭니다',
                },
                {
                  step: 4,
                  icon: Send,
                  title: '보정서 전자 제출',
                  desc: '전자소송에서 보정서와 수정 서류를 첨부하여 제출',
                  detail: '전자소송 > [서류제출] > [보정서] 선택 > 사건번호 입력 > 파일 첨부 > 제출',
                },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={item.step} className="relative flex gap-4">
                    {i < 3 && (
                      <div className="absolute left-[19px] top-[40px] h-[calc(100%-16px)] w-0.5 bg-gray-200" />
                    )}
                    <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                      <Icon size={18} />
                    </div>
                    <div className={`flex-1 ${i < 3 ? 'pb-5' : 'pb-0'}`}>
                      <p className="text-sm font-bold text-gray-900">
                        Step {item.step}. {item.title}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-600">{item.desc}</p>
                      <p className="mt-1 text-xs text-gray-400 bg-gray-50 rounded px-3 py-2 border border-gray-100">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 보정 유형별 대응 */}
          <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">보정 유형별 대응 방법</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {CORRECTION_ORDER_TYPES.map(type => (
                <div key={type.id} className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{type.label}</p>
                      {type.autoResolvable && (
                        <span className="text-[10px] font-semibold text-green-600 bg-green-50 rounded px-1.5 py-0.5">
                          자동 대응 가능
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">기한: {type.deadlineDays}일</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{type.description}</p>
                  {type.requiredDocs.length > 0 && (
                    <div className="mt-2 flex gap-1.5 flex-wrap">
                      {type.requiredDocs.map(doc => (
                        <span key={doc} className="text-[10px] bg-gray-100 text-gray-600 rounded px-2 py-0.5">
                          {doc}
                        </span>
                      ))}
                    </div>
                  )}
                  {type.autoResolvable && (
                    <button className="mt-2 inline-flex items-center gap-1 text-xs text-brand-gold font-medium hover:underline">
                      <RefreshCw size={12} /> 자동 보정 서류 생성
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 보정 기한 경고 */}
          <div className="rounded-xl bg-red-50 border border-red-200 p-4">
            <div className="flex gap-2">
              <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-800">
                  보정 기한을 반드시 지켜주세요
                </p>
                <p className="text-xs text-red-600 mt-1">
                  보정명령에 지정된 기한 내에 보정하지 않으면 신청이 각하(기각)될 수 있습니다.
                  기한 연장이 필요한 경우 법원에 기한연장 신청서를 제출하세요.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
