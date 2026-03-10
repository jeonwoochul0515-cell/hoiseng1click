import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, ArrowUpDown, Trash2, Pencil, Users } from 'lucide-react';
import { useClients, useDeleteClient } from '@/hooks/useClients';
import { useAuthStore } from '@/store/authStore';
import { formatKRW, formatPhone, formatDate } from '@/utils/formatter';
import { ClientForm } from '@/components/client/ClientForm';
import type { Client, ClientStatus } from '@/types/client';
import { PLAN_CONFIGS } from '@/types/subscription';

const STATUS_LABELS: Record<ClientStatus, string> = {
  new: '신규',
  contacted: '상담완료',
  collecting: '수집중',
  drafting: '작성중',
  submitted: '접수완료',
  approved: '인가',
};

const STATUS_COLORS: Record<ClientStatus, string> = {
  new: 'bg-blue-500',
  contacted: 'bg-violet-500',
  collecting: 'bg-yellow-600',
  drafting: 'bg-violet-500',
  submitted: 'bg-amber-500',
  approved: 'bg-emerald-500',
};

type SortMode = 'latest' | 'debt';

export default function ClientsPage() {
  const navigate = useNavigate();
  const { data: clients, isLoading } = useClients();
  const deleteMutation = useDeleteClient();
  const { office, canAddClient } = useAuthStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClientStatus | 'all'>('all');
  const [sortMode, setSortMode] = useState<SortMode>('latest');
  const [formOpen, setFormOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | undefined>(undefined);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const planConfig = office ? PLAN_CONFIGS[office.plan] : null;

  const filtered = useMemo(() => {
    if (!clients) return [];
    let list = clients;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        c => c.name.toLowerCase().includes(q) || c.phone.includes(q)
      );
    }

    if (statusFilter !== 'all') {
      list = list.filter(c => c.status === statusFilter);
    }

    if (sortMode === 'debt') {
      list = [...list].sort((a, b) => {
        const aSum = a.debts.reduce((s, d) => s + d.amount, 0);
        const bSum = b.debts.reduce((s, d) => s + d.amount, 0);
        return bSum - aSum;
      });
    }

    return list;
  }, [clients, search, statusFilter, sortMode]);

  const totalDebt = (c: Client) => c.debts.reduce((s, d) => s + d.amount, 0);

  const handleAdd = () => {
    if (!canAddClient()) {
      setShowUpgradeModal(true);
      return;
    }
    setEditClient(undefined);
    setFormOpen(true);
  };

  const handleEdit = (e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    setEditClient(client);
    setFormOpen(true);
  };

  const handleDelete = (e: React.MouseEvent, clientId: string) => {
    e.stopPropagation();
    if (confirm('정말 삭제하시겠습니까?')) {
      deleteMutation.mutate(clientId);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">의뢰인 관리</h1>
          {planConfig && office && (
            <p className="mt-1 text-sm text-gray-500">
              의뢰인 {office.clientCount}/{planConfig.maxClients === Infinity ? '무제한' : `${planConfig.maxClients}명`} ({planConfig.name} 한도)
            </p>
          )}
        </div>
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          의뢰인 등록
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="이름 또는 연락처 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as ClientStatus | 'all')}
          className="rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">전체 상태</option>
          {(Object.keys(STATUS_LABELS) as ClientStatus[]).map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        <button
          onClick={() => setSortMode(m => m === 'latest' ? 'debt' : 'latest')}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <ArrowUpDown className="h-4 w-4" />
          {sortMode === 'latest' ? '최신순' : '채무순'}
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white py-20">
          <Users className="mb-4 h-12 w-12 text-gray-300" />
          <p className="text-lg font-medium text-gray-500">등록된 의뢰인이 없습니다</p>
          <p className="mt-1 text-sm text-gray-400">위의 '의뢰인 등록' 버튼으로 새 의뢰인을 추가하세요</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">이름</th>
                <th className="px-4 py-3">연락처</th>
                <th className="px-4 py-3 text-right">채무합계</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3 text-center">수집여부</th>
                <th className="px-4 py-3">등록일</th>
                <th className="px-4 py-3 text-center">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(client => (
                <tr
                  key={client.id}
                  onClick={() => navigate(`/clients/${client.id}`)}
                  className="cursor-pointer transition-colors hover:bg-blue-50/50"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{client.name}</td>
                  <td className="px-4 py-3 text-gray-600">{formatPhone(client.phone)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{formatKRW(totalDebt(client))}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white ${STATUS_COLORS[client.status]}`}>
                      {STATUS_LABELS[client.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {client.collectionDone ? (
                      <span className="text-emerald-500">&#10003;</span>
                    ) : (
                      <span className="text-gray-300">&mdash;</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(client.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={e => handleEdit(e, client)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                        title="수정"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={e => handleDelete(e, client.id)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                        title="삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Client Form Slide-over */}
      <ClientForm
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditClient(undefined); }}
        client={editClient}
      />

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
            <h2 className="text-xl font-bold text-gray-900">플랜 업그레이드 필요</h2>
            <p className="mt-3 text-sm text-gray-600">
              현재 플랜의 의뢰인 한도에 도달했습니다. 더 많은 의뢰인을 등록하려면 상위 플랜으로 업그레이드하세요.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                닫기
              </button>
              <button
                onClick={() => { setShowUpgradeModal(false); navigate('/subscription'); }}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                플랜 보기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
