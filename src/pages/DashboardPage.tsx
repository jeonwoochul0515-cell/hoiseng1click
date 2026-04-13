import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuthStore } from '@/store/authStore';
import { getClients } from '@/api/firestore';
import {
  Users, UserPlus, CheckCircle, FileText, Send, ShieldCheck,
  Clock, AlertTriangle, Inbox, Loader2, LayoutGrid, List,
} from 'lucide-react';
import type { Client, ClientStatus } from '@/types/client';
import type { IntakeSubmission } from '@/api/intake';
import { formatKRW, formatDate } from '@/utils/formatter';
import { STATUS_LABELS, STATUS_COLORS } from '@/constants/status';
import DonutChart from '@/components/ui/DonutChart';
import KanbanBoard from '@/components/client/KanbanBoard';
import { useCoachMark } from '@/hooks/useCoachMark';
import CoachMark from '@/components/ui/CoachMark';

/** Tailwind dot class -> hex color for SVG rendering */
const STATUS_HEX: Record<string, string> = {
  new: '#3B82F6',
  contacted: '#8B5CF6',
  collecting: '#F59E0B',
  drafting: '#8B5CF6',
  submitted: '#F97316',
  approved: '#10B981',
};

// ----- Component -----

export default function DashboardPage() {
  const navigate = useNavigate();
  const office = useAuthStore((s) => s.office);
  const [clients, setClients] = useState<Client[]>([]);
  const [pendingIntakes, setPendingIntakes] = useState<(IntakeSubmission & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [loadKey, setLoadKey] = useState(0);
  const [viewMode, setViewMode] = useState<'kanban' | 'bar'>('kanban');

  const handleStatusChange = async (clientId: string, newStatus: ClientStatus) => {
    const officeId = office?.id;
    if (!officeId) return;
    try {
      await updateDoc(doc(db, 'offices', officeId, 'clients', clientId), { status: newStatus });
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, status: newStatus } : c));
    } catch (err) {
      console.error('상태 변경 실패:', err);
    }
  };

  // Fetch clients and pending intakes
  useEffect(() => {
    if (!office) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch clients and intakes in parallel
        const [clientList, intakeSnap] = await Promise.all([
          getClients(office.id),
          getDocs(
            query(
              collection(db, 'intakeSubmissions'),
              where('officeId', '==', office.id),
              orderBy('submittedAt', 'desc')
            )
          ),
        ]);

        if (cancelled) return;

        setClients(clientList);

        const pending = intakeSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as IntakeSubmission & { id: string }))
          .filter(s => !s.convertedClientId);
        setPendingIntakes(pending);
      } catch (err) {
        console.error('대시보드 데이터 로드 실패:', err);
        if (!cancelled) setError('데이터를 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [office, loadKey]);

  // ----- Derived data -----

  const statusCounts = useMemo(() => {
    const counts: Record<ClientStatus, number> = {
      new: 0, contacted: 0, collecting: 0, drafting: 0, submitted: 0, approved: 0,
    };
    for (const c of clients) {
      if (c.status in counts) counts[c.status]++;
    }
    return counts;
  }, [clients]);

  const totalClients = clients.length;

  const totalDebt = useMemo(() => {
    return clients.reduce((sum, c) => {
      const clientDebt = (c.debts || []).reduce((s, d) => s + (d.amount || 0), 0);
      return sum + clientDebt;
    }, 0);
  }, [clients]);

  const docCountThisMonth = office?.docCountThisMonth ?? 0;

  const kpiData = useMemo(() => [
    { label: '전체 의뢰인', value: totalClients, icon: Users, color: '#3B82F6' },
    { label: '신규', value: statusCounts.new, icon: UserPlus, color: '#8B5CF6' },
    { label: '수집 완료', value: clients.filter(c => c.collectionDone).length, icon: CheckCircle, color: '#C9A84C' },
    { label: '서류 생성', value: docCountThisMonth, icon: FileText, color: '#8B5CF6' },
    { label: '법원 제출', value: statusCounts.submitted, icon: Send, color: '#F59E0B' },
    { label: '인가 완료', value: statusCounts.approved, icon: ShieldCheck, color: '#10B981' },
  ], [totalClients, statusCounts, docCountThisMonth]);

  const pipelineStages: { label: string; status: ClientStatus; count: number; color: string }[] = useMemo(() => [
    { label: '신규', status: 'new', count: statusCounts.new, color: '#3B82F6' },
    { label: '상담', status: 'contacted', count: statusCounts.contacted, color: '#8B5CF6' },
    { label: '수집중', status: 'collecting', count: statusCounts.collecting, color: '#C9A84C' },
    { label: '서류작성', status: 'drafting', count: statusCounts.drafting, color: '#8B5CF6' },
    { label: '제출', status: 'submitted', count: statusCounts.submitted, color: '#F59E0B' },
    { label: '인가', status: 'approved', count: statusCounts.approved, color: '#10B981' },
  ], [statusCounts]);

  // Recent 5 clients sorted by updatedAt desc
  const recentClients = useMemo(() => {
    return [...clients]
      .sort((a, b) => {
        const dateA = a.updatedAt instanceof Date ? a.updatedAt : (a.updatedAt as any).toDate?.() ?? new Date(0);
        const dateB = b.updatedAt instanceof Date ? b.updatedAt : (b.updatedAt as any).toDate?.() ?? new Date(0);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 5)
      .map(c => ({
        id: c.id,
        name: c.name,
        totalDebt: (c.debts || []).reduce((s, d) => s + (d.amount || 0), 0),
        status: c.status,
        updatedAt: c.updatedAt instanceof Date ? c.updatedAt : (c.updatedAt as any).toDate?.() ?? new Date(),
      }));
  }, [clients]);

  // CODEF collection waiting: clients with status 'new' or 'contacted' that haven't been collected yet
  const codefWaiting = useMemo(() => {
    return clients
      .filter(c => !c.collectionDone && (c.status === 'new' || c.status === 'contacted'))
      .slice(0, 5)
      .map(c => ({ id: c.id, name: c.name }));
  }, [clients]);

  // Clients in 'drafting' status with less than 5 document types generated
  // Simplified: clients in drafting status (docs not yet fully generated)
  const docMissing = useMemo(() => {
    return clients
      .filter(c => c.status === 'drafting')
      .slice(0, 5)
      .map(c => ({ id: c.id, name: c.name }));
  }, [clients]);

  const statusDistribution = useMemo(() => {
    return (Object.entries(statusCounts) as [ClientStatus, number][])
      .filter(([_, count]) => count > 0)
      .map(([status, count]) => ({
        label: STATUS_LABELS[status],
        value: count,
        color: STATUS_HEX[status] ?? '#6B7280',
      }));
  }, [statusCounts]);

  const maxPipeline = Math.max(...pipelineStages.map((s) => s.count), 1);

  // ----- Coach mark -----
  const coachMark = useCoachMark(totalClients);

  // ----- Onboarding banner -----
  const [showBanner, setShowBanner] = useState(() => {
    return !localStorage.getItem('onboarding_seen');
  });

  const handleDismissBanner = () => {
    localStorage.setItem('onboarding_seen', 'true');
    setShowBanner(false);
  };

  const planExpiryDate = useMemo(() => {
    if (!office?.planExpiry) return null;
    const d = office.planExpiry instanceof Date
      ? office.planExpiry
      : (office.planExpiry as any).toDate?.() ?? null;
    return d;
  }, [office?.planExpiry]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <AlertTriangle className="h-10 w-10 text-red-400" />
        <p className="text-sm text-gray-600">{error}</p>
        <button
          onClick={() => setLoadKey((k) => k + 1)}
          className="rounded-lg bg-brand-gold px-5 py-2 text-sm font-semibold text-black hover:bg-[#b8973e] transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Onboarding Welcome Banner */}
      {showBanner && (
        <div className="relative rounded-xl bg-brand-gold p-4 text-black">
          <button
            onClick={handleDismissBanner}
            className="absolute top-3 right-3 text-black/60 hover:text-black text-lg font-bold leading-none"
            aria-label="닫기"
          >
            &times;
          </button>
          <p className="text-base font-bold">14일 PRO 무료체험이 시작되었습니다!</p>
          {planExpiryDate && (
            <p className="mt-1 text-sm text-black/80">
              만료일: {planExpiryDate.getFullYear()}년 {planExpiryDate.getMonth() + 1}월 {planExpiryDate.getDate()}일
            </p>
          )}
        </div>
      )}

      <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {kpiData.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="flex items-center gap-4 rounded-xl bg-white p-5"
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: kpi.color + '20' }}
              >
                <Icon size={22} style={{ color: kpi.color }} />
              </div>
              <div>
                <p className="text-sm text-gray-600">{kpi.label}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-gray-900">{kpi.value}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pipeline */}
      <div className="rounded-xl bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">파이프라인</h2>
          <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-0.5">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="칸반 보기"
            >
              <LayoutGrid size={14} />
              <span className="hidden sm:inline">칸반</span>
            </button>
            <button
              onClick={() => setViewMode('bar')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'bar'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="바 차트 보기"
            >
              <List size={14} />
              <span className="hidden sm:inline">차트</span>
            </button>
          </div>
        </div>

        {viewMode === 'kanban' ? (
          <KanbanBoard clients={clients} onStatusChange={handleStatusChange} />
        ) : (
          <div className="space-y-3">
            {pipelineStages.map((stage) => (
              <div key={stage.status} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-right text-sm text-gray-600">{stage.label}</span>
                <div className="flex-1">
                  <div
                    className="h-7 rounded-md flex items-center px-3 text-xs font-semibold text-gray-900 transition-all"
                    style={{
                      width: `${Math.max((stage.count / maxPipeline) * 100, 8)}%`,
                      backgroundColor: stage.color,
                    }}
                  >
                    {stage.count}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <div className="lg:col-span-2 rounded-xl bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">최근 활동</h2>
          {recentClients.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <Users className="h-10 w-10 text-gray-300" />
              <p className="text-sm text-gray-400">아직 등록된 의뢰인이 없습니다</p>
              <button
                onClick={() => navigate('/clients')}
                className="rounded-lg bg-brand-gold px-5 py-2 text-sm font-semibold text-black hover:bg-[#b8973e] transition-colors"
              >
                의뢰인 등록하기
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600">
                    <th className="pb-3 font-medium">의뢰인</th>
                    <th className="pb-3 font-medium text-right">총 채무액</th>
                    <th className="pb-3 font-medium text-center">상태</th>
                    <th className="pb-3 font-medium text-right">최근 업데이트</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentClients.map((c) => (
                    <tr key={c.id} className="text-gray-700 cursor-pointer hover:bg-gray-50" onClick={() => navigate(`/clients/${c.id}`)}>
                      <td className="py-3 font-medium text-gray-900">{c.name}</td>
                      <td className="py-3 text-right">{formatKRW(c.totalDebt)}</td>
                      <td className="py-3 text-center">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[c.status].bg} ${STATUS_COLORS[c.status].text}`}>
                          {STATUS_LABELS[c.status]}
                        </span>
                      </td>
                      <td className="py-3 text-right text-gray-600">{formatDate(c.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right column: Chart + Quick Actions */}
        <div className="space-y-4">
          {/* 사건 현황 도넛 차트 */}
          <div className="rounded-xl bg-white border border-gray-200 p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">사건 현황</h2>
            <DonutChart
              data={statusDistribution}
              centerText={String(totalClients)}
              centerSubText="명"
              size={180}
            />
          </div>

          {/* Pending Intakes */}
          {pendingIntakes.length > 0 && (
            <div className="rounded-xl bg-white p-5">
              <div className="mb-3 flex items-center gap-2 text-blue-500">
                <Inbox size={18} />
                <h3 className="text-sm font-semibold">미처리 접수</h3>
                <span className="ml-auto rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-bold">{pendingIntakes.length}</span>
              </div>
              <ul className="space-y-2">
                {pendingIntakes.slice(0, 5).map((s) => (
                  <li key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{s.name}</span>
                    <button onClick={() => navigate('/settings?tab=intake')} className="text-xs text-blue-500 hover:underline">확인</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* CODEF waiting */}
          {codefWaiting.length > 0 && (
            <div className="rounded-xl bg-white p-5">
              <div className="mb-3 flex items-center gap-2 text-brand-gold">
                <Clock size={18} />
                <h3 className="text-sm font-semibold">CODEF 수집 대기</h3>
                <span className="ml-auto rounded-full bg-brand-gold/20 px-2 py-0.5 text-xs font-bold">{codefWaiting.length}</span>
              </div>
              <ul className="space-y-2">
                {codefWaiting.map((c) => (
                  <li key={c.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{c.name}</span>
                    <button onClick={() => navigate(`/clients/${c.id}`)} className="text-xs text-brand-gold hover:underline">수집 시작</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Doc missing */}
          {docMissing.length > 0 && (
            <div className="rounded-xl bg-white p-5">
              <div className="mb-3 flex items-center gap-2 text-amber-400">
                <AlertTriangle size={18} />
                <h3 className="text-sm font-semibold">서류 미생성</h3>
                <span className="ml-auto rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold">{docMissing.length}</span>
              </div>
              <ul className="space-y-2">
                {docMissing.map((c) => (
                  <li key={c.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{c.name}</span>
                    <button onClick={() => navigate(`/documents?clientId=${c.id}`)} className="text-xs text-amber-400 hover:underline">서류 생성</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Coach Mark */}
      {coachMark.isActive && coachMark.step && (
        <CoachMark
          targetId={coachMark.step.targetId}
          message={coachMark.step.message}
          step={coachMark.step.stepNumber}
          totalSteps={coachMark.step.totalSteps}
          onNext={coachMark.next}
          onSkip={coachMark.skip}
        />
      )}
    </div>
  );
}
