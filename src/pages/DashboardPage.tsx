import {
  Users, UserPlus, CheckCircle, FileText, Send, ShieldCheck,
  Clock, AlertTriangle,
} from 'lucide-react';
import type { ClientStatus } from '@/types/client';
import { formatKRW, formatDate } from '@/utils/formatter';

// ----- Mock Data -----

const kpiData = [
  { label: '전체 의뢰인', value: 42, change: '+3', icon: Users, color: '#3B82F6' },
  { label: '이달 신규', value: 8, change: '+2', icon: UserPlus, color: '#8B5CF6' },
  { label: '수집 완료', value: 28, change: '+5', icon: CheckCircle, color: '#C9A84C' },
  { label: '서류 생성', value: 23, change: '+4', icon: FileText, color: '#8B5CF6' },
  { label: '법원 제출', value: 15, change: '+1', icon: Send, color: '#F59E0B' },
  { label: '인가 완료', value: 12, change: '+2', icon: ShieldCheck, color: '#10B981' },
];

const pipelineStages: { label: string; status: ClientStatus; count: number; color: string }[] = [
  { label: '신규', status: 'new', count: 8, color: '#3B82F6' },
  { label: '상담', status: 'contacted', count: 6, color: '#8B5CF6' },
  { label: '수집중', status: 'collecting', count: 5, color: '#C9A84C' },
  { label: '서류작성', status: 'drafting', count: 8, color: '#8B5CF6' },
  { label: '제출', status: 'submitted', count: 3, color: '#F59E0B' },
  { label: '인가', status: 'approved', count: 12, color: '#10B981' },
];

const recentClients = [
  { id: '1', name: '김영수', totalDebt: 127000000, status: 'collecting' as ClientStatus, updatedAt: new Date('2026-03-09') },
  { id: '2', name: '이미영', totalDebt: 85000000, status: 'drafting' as ClientStatus, updatedAt: new Date('2026-03-08') },
  { id: '3', name: '박준혁', totalDebt: 210000000, status: 'new' as ClientStatus, updatedAt: new Date('2026-03-08') },
  { id: '4', name: '최수진', totalDebt: 54000000, status: 'submitted' as ClientStatus, updatedAt: new Date('2026-03-07') },
  { id: '5', name: '정태원', totalDebt: 92000000, status: 'approved' as ClientStatus, updatedAt: new Date('2026-03-06') },
];

const codefWaiting = [
  { id: '3', name: '박준혁' },
  { id: '6', name: '한지민' },
  { id: '7', name: '오세훈' },
];

const docMissing = [
  { id: '2', name: '이미영', missing: 2 },
  { id: '8', name: '윤서연', missing: 5 },
];

// ----- Status helpers -----

const STATUS_LABELS: Record<ClientStatus, string> = {
  new: '신규',
  contacted: '상담',
  collecting: '수집중',
  drafting: '서류작성',
  submitted: '제출',
  approved: '인가',
};

const STATUS_COLORS: Record<ClientStatus, string> = {
  new: 'bg-blue-500/20 text-blue-400',
  contacted: 'bg-purple-500/20 text-purple-400',
  collecting: 'bg-yellow-600/20 text-[#C9A84C]',
  drafting: 'bg-purple-500/20 text-purple-400',
  submitted: 'bg-amber-500/20 text-amber-400',
  approved: 'bg-green-500/20 text-green-400',
};

// ----- Component -----

export default function DashboardPage() {
  const maxPipeline = Math.max(...pipelineStages.map((s) => s.count), 1);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">대시보드</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {kpiData.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="flex items-center gap-4 rounded-xl bg-[#111827] p-5"
            >
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: kpi.color + '20' }}
              >
                <Icon size={22} style={{ color: kpi.color }} />
              </div>
              <div>
                <p className="text-sm text-gray-400">{kpi.label}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white">{kpi.value}</span>
                  <span className="text-xs text-green-400">{kpi.change}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pipeline */}
      <div className="rounded-xl bg-[#111827] p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">파이프라인</h2>
        <div className="space-y-3">
          {pipelineStages.map((stage) => (
            <div key={stage.status} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-right text-sm text-gray-400">{stage.label}</span>
              <div className="flex-1">
                <div
                  className="h-7 rounded-md flex items-center px-3 text-xs font-semibold text-white transition-all"
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
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <div className="lg:col-span-2 rounded-xl bg-[#111827] p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">최근 활동</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400">
                  <th className="pb-3 font-medium">의뢰인</th>
                  <th className="pb-3 font-medium text-right">총 채무액</th>
                  <th className="pb-3 font-medium text-center">상태</th>
                  <th className="pb-3 font-medium text-right">최근 업데이트</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {recentClients.map((c) => (
                  <tr key={c.id} className="text-gray-300">
                    <td className="py-3 font-medium text-white">{c.name}</td>
                    <td className="py-3 text-right">{formatKRW(c.totalDebt)}</td>
                    <td className="py-3 text-center">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[c.status]}`}>
                        {STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td className="py-3 text-right text-gray-400">{formatDate(c.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          {/* CODEF waiting */}
          <div className="rounded-xl bg-[#111827] p-5">
            <div className="mb-3 flex items-center gap-2 text-[#C9A84C]">
              <Clock size={18} />
              <h3 className="text-sm font-semibold">CODEF 수집 대기</h3>
              <span className="ml-auto rounded-full bg-[#C9A84C]/20 px-2 py-0.5 text-xs font-bold">{codefWaiting.length}</span>
            </div>
            <ul className="space-y-2">
              {codefWaiting.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">{c.name}</span>
                  <button className="text-xs text-[#C9A84C] hover:underline">수집 시작</button>
                </li>
              ))}
            </ul>
          </div>

          {/* Doc missing */}
          <div className="rounded-xl bg-[#111827] p-5">
            <div className="mb-3 flex items-center gap-2 text-amber-400">
              <AlertTriangle size={18} />
              <h3 className="text-sm font-semibold">서류 미생성</h3>
              <span className="ml-auto rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold">{docMissing.length}</span>
            </div>
            <ul className="space-y-2">
              {docMissing.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">{c.name}</span>
                  <span className="text-xs text-gray-500">{c.missing}종 미생성</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
