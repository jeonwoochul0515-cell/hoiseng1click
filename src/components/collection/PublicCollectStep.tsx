import { useState, useCallback, useEffect, useRef } from 'react';
import { doc, getDoc, updateDoc, setDoc, Timestamp } from 'firebase/firestore';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Play,
} from 'lucide-react';
import { auth, db } from '@/firebase';
import { useAuthStore } from '@/store/authStore';
import { useCollectionStore } from '@/store/collectionStore';
import { workerApi } from '@/api/worker';
import { toast } from '@/utils/toast';
import type {
  Client,
  Debt,
  Asset,
  FamilyMember,
  CourtCase,
  TaxInvoiceEntry,
} from '@/types/client';

// ── Props ──

interface PublicCollectStepProps {
  clientId?: string;
  onNext: () => void;
  onBack: () => void;
}

// ── Task id ──

type TaskId =
  | 'familyRelation'
  | 'vehicleRegistration'
  | 'incomeProof'
  | 'taxPaymentCert'
  | 'caseSearch'
  | 'taxInvoice';

type TaskStatus = 'idle' | 'loading' | 'success' | 'error' | 'skipped';

interface TaskState {
  status: TaskStatus;
  message?: string;
  summary?: string;
}

interface TaskMeta {
  id: TaskId;
  label: string;
  description: string;
  /** 자영업자 전용 여부 */
  selfEmployedOnly?: boolean;
}

const TASKS: TaskMeta[] = [
  { id: 'familyRelation', label: '가족관계등록부', description: '부양가족 자동 확인' },
  { id: 'vehicleRegistration', label: '자동차등록원부', description: '소유 차량 자동 등록' },
  { id: 'incomeProof', label: '소득금액증명', description: '최근 2년간 소득 내역' },
  { id: 'taxPaymentCert', label: '납세증명서', description: '국세·지방세 체납 확인' },
  { id: 'caseSearch', label: '대법원 나의사건검색', description: '회생·파산 진행 이력 확인' },
  { id: 'taxInvoice', label: '전자세금계산서', description: '사업자 매출·매입 내역', selfEmployedOnly: true },
];

// ── Firestore helpers ──

const WORKER_BASE = import.meta.env.VITE_WORKER_BASE_URL ?? 'http://localhost:8787';

async function getAuthHeader(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function callPublicApi<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const headers = await getAuthHeader();
  const res = await fetch(`${WORKER_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: res.statusText })) as { error?: string; code?: string };
    throw new Error(errBody.error ?? `API 에러 ${res.status}${errBody.code ? ` [${errBody.code}]` : ''}`);
  }
  return res.json() as Promise<T>;
}

function genId() {
  return `pub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── 컴포넌트 ──

export default function PublicCollectStep({ clientId, onNext, onBack }: PublicCollectStepProps) {
  const office = useAuthStore((s) => s.office);
  const individual = useAuthStore((s) => s.individual);
  const { connectedId, userName, birthDate } = useCollectionStore();

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Record<TaskId, TaskState>>({
    familyRelation: { status: 'idle' },
    vehicleRegistration: { status: 'idle' },
    incomeProof: { status: 'idle' },
    taxPaymentCert: { status: 'idle' },
    caseSearch: { status: 'idle' },
    taxInvoice: { status: 'idle' },
  });
  const [warningCases, setWarningCases] = useState<CourtCase[]>([]);
  const [running, setRunning] = useState(false);

  const startedRef = useRef(false);

  const isIndividualPage = !!individual;

  // Load client
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (isIndividualPage && individual) {
          const snap = await getDoc(doc(db, 'individuals', individual.id, 'cases', clientId ?? 'default'));
          if (!cancelled && snap.exists()) setClient(snap.data() as Client);
        } else if (office && clientId) {
          const snap = await getDoc(doc(db, 'offices', office.id, 'clients', clientId));
          if (!cancelled && snap.exists()) setClient(snap.data() as Client);
        }
      } catch (err) {
        console.error('의뢰인 로드 실패:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [office, individual, clientId, isIndividualPage]);

  // Firestore merge helper
  const mergeClient = useCallback(async (patch: Partial<Client>) => {
    try {
      const payload: Record<string, unknown> = { ...patch, updatedAt: Timestamp.now() };
      if (isIndividualPage && individual) {
        const caseRef = doc(db, 'individuals', individual.id, 'cases', clientId ?? 'default');
        const existing = await getDoc(caseRef);
        if (existing.exists()) await updateDoc(caseRef, payload);
        else await setDoc(caseRef, { ...payload, createdAt: Timestamp.now() });
      } else if (office && clientId) {
        await updateDoc(doc(db, 'offices', office.id, 'clients', clientId), payload);
      }
      setClient((prev) => (prev ? ({ ...prev, ...patch } as Client) : prev));
    } catch (err) {
      console.error('Firestore merge 실패:', err);
    }
  }, [office, individual, clientId, isIndividualPage]);

  function setTaskState(id: TaskId, state: TaskState) {
    setTasks((prev) => ({ ...prev, [id]: state }));
  }

  // ── 개별 Task 실행 함수 ──

  const runFamilyRelation = useCallback(async (): Promise<void> => {
    setTaskState('familyRelation', { status: 'loading' });
    try {
      const data = await callPublicApi<{ success?: boolean; familyMembers?: FamilyMember[]; data?: { familyMembers?: FamilyMember[] } }>(
        '/public/family-relation',
        { connectedId, userName },
      );
      const members: FamilyMember[] = data.familyMembers ?? data.data?.familyMembers ?? [];
      if (members.length > 0) {
        await mergeClient({ familyMembers: members, family: members.filter((m) => m.isDependent).length });
      }
      setTaskState('familyRelation', {
        status: 'success',
        summary: `부양가족 ${members.filter((m) => m.isDependent).length}명`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 에러';
      setTaskState('familyRelation', { status: 'error', message: msg });
    }
  }, [connectedId, userName, mergeClient]);

  const runVehicleRegistration = useCallback(async (): Promise<void> => {
    setTaskState('vehicleRegistration', { status: 'loading' });
    try {
      const data = await callPublicApi<{ success?: boolean; vehicles?: Array<{ carNumber: string; model: string; year: number; basePrice?: number }>; data?: { vehicles?: any[] } }>(
        '/public/vehicle-registration',
        { connectedId, userName },
      );
      const vehicles = data.vehicles ?? data.data?.vehicles ?? [];
      if (vehicles.length > 0) {
        const newAssets: Asset[] = vehicles.map((v: any) => {
          const raw = Number(v.basePrice ?? 0) || 0;
          return {
            id: genId(),
            name: v.model || v.carNumber,
            type: '차량',
            rawValue: raw,
            liquidationRate: 70,
            mortgage: 0,
            value: Math.floor(raw * 0.7),
            source: 'api',
            meta: {
              plate: v.carNumber,
              year: v.year,
              model: v.model,
            },
          };
        });
        const existingAssets = (client?.assets ?? []).filter((a) => a.type !== '차량' || a.source === 'manual');
        await mergeClient({ assets: [...existingAssets, ...newAssets] });
      }
      setTaskState('vehicleRegistration', {
        status: 'success',
        summary: `차량 ${vehicles.length}대`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 에러';
      setTaskState('vehicleRegistration', { status: 'error', message: msg });
    }
  }, [connectedId, userName, client?.assets, mergeClient]);

  const runIncomeProof = useCallback(async (): Promise<void> => {
    setTaskState('incomeProof', { status: 'loading' });
    try {
      if (!connectedId) throw new Error('CODEF connectedId 가 없습니다.');
      const data = await workerApi.getIncomeProof(connectedId);
      // annualIncome 을 찾아서 월평균으로 환산 (존재 시)
      const raw: any = data?.data ?? {};
      const annualIncome = Number(raw.annualIncome ?? raw.totalIncome ?? raw.yearlyIncome ?? 0) || 0;
      const patch: Partial<Client> = {};
      if (annualIncome > 0) {
        patch.income = Math.floor(annualIncome / 12);
      }
      if (Object.keys(patch).length > 0) {
        await mergeClient(patch);
      }
      setTaskState('incomeProof', {
        status: 'success',
        summary: annualIncome > 0 ? `연 ${(annualIncome / 10000).toFixed(0)}만원` : '조회 완료',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 에러';
      setTaskState('incomeProof', { status: 'error', message: msg });
    }
  }, [connectedId, mergeClient]);

  const runTaxPaymentCert = useCallback(async (): Promise<void> => {
    setTaskState('taxPaymentCert', { status: 'loading' });
    try {
      const data = await callPublicApi<{
        success?: boolean;
        totalNational?: number;
        totalLocal?: number;
        delinquentItems?: Array<{ creditor: string; amount: number; type?: string }>;
        data?: { totalNational?: number; totalLocal?: number; delinquentItems?: any[] };
      }>('/public/tax-payment-cert', { connectedId, userName });

      const totalNational = Number(data.totalNational ?? data.data?.totalNational ?? 0) || 0;
      const totalLocal = Number(data.totalLocal ?? data.data?.totalLocal ?? 0) || 0;
      const delinquentItems = data.delinquentItems ?? data.data?.delinquentItems ?? [];

      const patch: Partial<Client> = {
        taxDelinquency: {
          totalNational,
          totalLocal,
          lastFetchedAt: new Date().toISOString(),
        },
      };

      // 체납 건이 있을 경우 debts[] 에 비면책채권으로 저장
      if (delinquentItems.length > 0) {
        const existingDebts = (client?.debts ?? []).filter(
          (d) => !(d.isNonDischargeable && d.nonDischargeReason === '조세'),
        );
        const taxDebts: Debt[] = delinquentItems.map((item: any) => ({
          id: genId(),
          name: item.creditor || '조세체납',
          creditor: item.creditor || '국세청',
          type: '무담보',
          amount: Number(item.amount) || 0,
          rate: 0,
          monthly: 0,
          source: 'codef',
          isNonDischargeable: true,
          nonDischargeReason: '조세',
          debtCategory: '세금',
        }));
        patch.debts = [...existingDebts, ...taxDebts];
      }

      await mergeClient(patch);
      setTaskState('taxPaymentCert', {
        status: 'success',
        summary: totalNational + totalLocal > 0
          ? `체납 ${(((totalNational + totalLocal) / 10000).toFixed(0))}만원`
          : '체납 없음',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 에러';
      setTaskState('taxPaymentCert', { status: 'error', message: msg });
    }
  }, [connectedId, userName, client?.debts, mergeClient]);

  const runCaseSearch = useCallback(async (): Promise<void> => {
    setTaskState('caseSearch', { status: 'loading' });
    try {
      if (!connectedId) throw new Error('CODEF connectedId 가 없습니다.');
      const data = await workerApi.searchMyCases(connectedId, undefined, userName);
      const cases: CourtCase[] = (data?.data?.cases ?? []).map((c) => ({
        caseNumber: c.caseNumber,
        court: c.court,
        caseType: c.caseType,
        status: c.status,
        filingDate: c.filingDate,
        lastAction: c.lastAction,
      }));
      await mergeClient({ activeCourtCases: cases });

      const warning = cases.filter((c) => c.caseType === '회생' || c.caseType === '파산');
      setWarningCases(warning);

      setTaskState('caseSearch', {
        status: 'success',
        summary: cases.length > 0 ? `${cases.length}건 발견` : '진행중 사건 없음',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 에러';
      setTaskState('caseSearch', { status: 'error', message: msg });
    }
  }, [connectedId, userName, mergeClient]);

  const runTaxInvoice = useCallback(async (): Promise<void> => {
    // 자영업자만 실행
    if (client?.jobType !== 'self') {
      setTaskState('taxInvoice', { status: 'skipped', message: '자영업자만 해당' });
      return;
    }
    setTaskState('taxInvoice', { status: 'loading' });
    try {
      if (!connectedId) throw new Error('CODEF connectedId 가 없습니다.');
      const bizNum = (client as any)?.businessNumber ?? '';
      if (!bizNum) throw new Error('사업자번호가 없습니다.');

      const today = new Date();
      const endDate = today.toISOString().slice(0, 10).replace(/-/g, '');
      const startDate = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())
        .toISOString().slice(0, 10).replace(/-/g, '');

      const [sales, purchase] = await Promise.allSettled([
        workerApi.getTaxInvoices(connectedId, undefined, userName, bizNum, startDate, endDate, 'sales'),
        workerApi.getTaxInvoices(connectedId, undefined, userName, bizNum, startDate, endDate, 'purchase'),
      ]);

      const invoices: TaxInvoiceEntry[] = [];
      if (sales.status === 'fulfilled') {
        invoices.push(...(sales.value?.data?.invoices ?? []));
      }
      if (purchase.status === 'fulfilled') {
        invoices.push(...(purchase.value?.data?.invoices ?? []));
      }

      await mergeClient({ taxInvoices: invoices });
      setTaskState('taxInvoice', {
        status: 'success',
        summary: `매출·매입 ${invoices.length}건`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 에러';
      setTaskState('taxInvoice', { status: 'error', message: msg });
    }
  }, [client, connectedId, userName, mergeClient]);

  const taskRunners: Record<TaskId, () => Promise<void>> = {
    familyRelation: runFamilyRelation,
    vehicleRegistration: runVehicleRegistration,
    incomeProof: runIncomeProof,
    taxPaymentCert: runTaxPaymentCert,
    caseSearch: runCaseSearch,
    taxInvoice: runTaxInvoice,
  };

  // 전체 일괄 실행 (Promise.allSettled)
  const runAll = useCallback(async () => {
    if (running) return;
    setRunning(true);
    try {
      // 자영업자 아닌 경우 taxInvoice skipped 처리
      if (client?.jobType !== 'self') {
        setTaskState('taxInvoice', { status: 'skipped', message: '자영업자만 해당' });
      }
      // 일괄 병렬 실행 — 개별 실패 무시
      await Promise.allSettled([
        runFamilyRelation(),
        runVehicleRegistration(),
        runIncomeProof(),
        runTaxPaymentCert(),
        runCaseSearch(),
        client?.jobType === 'self' ? runTaxInvoice() : Promise.resolve(),
      ]);
      toast.info('공공기관 자료 수집이 완료됐습니다.');
    } finally {
      setRunning(false);
    }
  }, [running, client?.jobType, runFamilyRelation, runVehicleRegistration, runIncomeProof, runTaxPaymentCert, runCaseSearch, runTaxInvoice]);

  // 로드 후 자동 1회 실행 (Q4: 일괄 자동 호출)
  useEffect(() => {
    if (loading) return;
    if (startedRef.current) return;
    startedRef.current = true;
    // 약간의 지연 후 시작
    const handle = setTimeout(() => { runAll(); }, 300);
    return () => clearTimeout(handle);
  }, [loading, runAll]);

  // Retry 단일 태스크
  const retryTask = useCallback(async (id: TaskId) => {
    const fn = taskRunners[id];
    if (fn) await fn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskRunners]);

  // 렌더 헬퍼
  function renderStatusIcon(status: TaskStatus) {
    switch (status) {
      case 'loading':
        return <Loader2 size={18} className="animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle2 size={18} className="text-emerald-500" />;
      case 'error':
        return <XCircle size={18} className="text-red-500" />;
      case 'skipped':
        return <Clock size={18} className="text-gray-300" />;
      case 'idle':
      default:
        return <Clock size={18} className="text-gray-400" />;
    }
  }

  function renderStatusLabel(state: TaskState) {
    switch (state.status) {
      case 'loading':
        return <span className="text-sm text-blue-600">수집 중...</span>;
      case 'success':
        return <span className="text-sm text-emerald-600">완료 {state.summary ? `· ${state.summary}` : ''}</span>;
      case 'error':
        return (
          <span className="text-sm text-red-600" title={state.message}>
            실패 {state.message ? `· ${state.message.length > 20 ? state.message.slice(0, 20) + '...' : state.message}` : ''}
          </span>
        );
      case 'skipped':
        return <span className="text-sm text-gray-400">{state.message ?? '대기'}</span>;
      case 'idle':
      default:
        return <span className="text-sm text-gray-500">대기</span>;
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-gray-400" size={24} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* 헤더 */}
      <div className="rounded-xl bg-[var(--color-bg-card)] border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">공공기관 자료 자동 수집</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          인증 1회로 가족관계등록부·자동차등록원부·소득금액증명·납세증명서·대법원 사건검색·전자세금계산서를 자동 수집합니다.
          {!connectedId && (
            <span className="block mt-2 text-xs text-amber-600">
              ⚠️ CODEF 인증이 완료되지 않은 상태에서는 일부 항목이 실패할 수 있습니다.
            </span>
          )}
        </p>
      </div>

      {/* 경고 배너 (회생·파산 이력) */}
      {warningCases.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-900 mb-1">
              과거 회생·파산 사건 이력이 발견됐습니다
            </p>
            <p className="text-amber-800 leading-relaxed">
              면책 후 5년 이내라면 재신청이 제한될 수 있으니 <strong>변호사와 상담</strong>하세요.
              신청은 계속 진행 가능합니다.
            </p>
            <ul className="mt-2 space-y-0.5 text-xs text-amber-900">
              {warningCases.map((c, idx) => (
                <li key={idx}>
                  · {c.court} {c.caseNumber} ({c.caseType}, {c.status})
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Task 리스트 */}
      <div className="rounded-xl bg-[var(--color-bg-card)] border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">수집 항목 (6종)</h3>
          <button
            type="button"
            onClick={runAll}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-brand-gold)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-brand-gold)] hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {running ? '진행 중' : '전체 시작'}
          </button>
        </div>
        <ul className="divide-y divide-gray-100">
          {TASKS.map((task) => {
            const state = tasks[task.id];
            const isSkipped = task.selfEmployedOnly && client?.jobType !== 'self';
            return (
              <li key={task.id} className="flex items-center gap-3 px-5 py-3">
                <div className="shrink-0">
                  {renderStatusIcon(isSkipped ? 'skipped' : state.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-gray-900">{task.label}</span>
                    {task.selfEmployedOnly && (
                      <span className="text-xs text-gray-400">(자영업자만)</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{task.description}</p>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {renderStatusLabel(isSkipped ? { status: 'skipped', message: '자영업자만 해당' } : state)}
                  {!isSkipped && state.status === 'error' && (
                    <button
                      type="button"
                      onClick={() => retryTask(task.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <RefreshCw size={12} />
                      재시도
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* 하단 버튼 */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          onClick={onBack}
          className="w-full sm:w-auto rounded-xl border border-gray-300 bg-white px-6 py-3.5 text-base font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          이전 단계
        </button>
        <button
          onClick={onNext}
          className="w-full sm:flex-1 rounded-xl bg-emerald-600 px-6 py-3.5 text-base font-semibold text-white hover:bg-emerald-700 transition-colors"
        >
          다음 단계
        </button>
      </div>
      <div className="text-center">
        <button
          onClick={onNext}
          className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2"
        >
          건너뛰기
        </button>
      </div>
      {/* birthDate는 미래 확장용 유지 */}
      <input type="hidden" value={birthDate} readOnly />
    </div>
  );
}
