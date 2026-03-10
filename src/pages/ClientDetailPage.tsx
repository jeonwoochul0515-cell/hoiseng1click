import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Database, FileText } from 'lucide-react';
import { getClient } from '@/api/firestore';
import { useUpdateClient } from '@/hooks/useClients';
import { useAuthStore } from '@/store/authStore';
import { DebtTable } from '@/components/client/DebtTable';
import { AssetPanel } from '@/components/client/AssetPanel';
import { formatKRW, formatPhone, formatDate } from '@/utils/formatter';
import { calcMonthlyPayment, calcRepayTotal, calcLivingCost } from '@/utils/calculator';
import type { Client, ClientStatus } from '@/types/client';

const STATUS_OPTIONS: { value: ClientStatus; label: string; color: string }[] = [
  { value: 'new', label: '신규', color: '#3B82F6' },
  { value: 'contacted', label: '상담완료', color: '#8B5CF6' },
  { value: 'collecting', label: '수집중', color: '#C9A84C' },
  { value: 'drafting', label: '작성중', color: '#8B5CF6' },
  { value: 'submitted', label: '접수완료', color: '#F59E0B' },
  { value: 'approved', label: '인가', color: '#10B981' },
];

const TABS = ['기본정보', '채무내역', '재산내역', '소득·변제금', '서류생성', '메모'] as const;

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const officeId = useAuthStore(s => s.office?.id ?? '');
  const updateMutation = useUpdateClient();

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    if (!officeId || !id) return;
    setLoading(true);
    getClient(officeId, id)
      .then(c => setClient(c))
      .finally(() => setLoading(false));
  }, [officeId, id]);

  const handleStatusChange = async (newStatus: ClientStatus) => {
    if (!client) return;
    await updateMutation.mutateAsync({ clientId: client.id, data: { status: newStatus } });
    setClient(prev => prev ? { ...prev, status: newStatus } : prev);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
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
          <button onClick={() => navigate('/clients')} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{client.name}</h1>
            <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
              <span>{formatPhone(client.phone)}</span>
              <span className="text-gray-300">|</span>
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
              onClick={() => navigate(`/collection/${client.id}`)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
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

      {/* Content */}
      <div className="mx-auto max-w-5xl p-6">
        {/* 기본정보 */}
        {tab === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-bold text-gray-900">기본정보</h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              <InfoRow label="이름" value={client.name} />
              <InfoRow label="연락처" value={formatPhone(client.phone)} />
              <InfoRow label="주민등록번호" value={client.ssn ? `${client.ssn.slice(0, 6)}-*******` : '-'} />
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

        {/* 서류생성 */}
        {tab === 4 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-bold text-gray-900">서류생성</h2>
            <p className="mb-4 text-sm text-gray-500">이 의뢰인의 데이터를 기반으로 법원 제출 서류를 생성합니다.</p>
            <Link
              to={`/documents?clientId=${client.id}`}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              <FileText className="h-4 w-4" />
              서류 생성 페이지로 이동
            </Link>
          </div>
        )}

        {/* 메모 */}
        {tab === 5 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-bold text-gray-900">메모</h2>
            {client.memo ? (
              <p className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">{client.memo}</p>
            ) : (
              <p className="text-sm text-gray-400">작성된 메모가 없습니다</p>
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
