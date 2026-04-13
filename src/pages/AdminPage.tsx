import { useState, useEffect, useCallback } from 'react';
import {
  collection, getDocs, doc, updateDoc, Timestamp,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { useAuthStore, type Office } from '@/store/authStore';
import {
  Building2, Users, FileText, Crown,
  ChevronDown, Calendar, Check, X,
} from 'lucide-react';
import dayjs from 'dayjs';
import { toast } from '@/utils/toast';

// --- 플랜 설정 ---
const PLAN_META: Record<string, { label: string; price: string; color: string; bgColor: string }> = {
  starter:    { label: 'STARTER',    price: '49,000원/월',  color: 'text-gray-400',   bgColor: 'bg-gray-500/20' },
  pro:        { label: 'PRO',        price: '99,000원/월',  color: 'text-brand-gold',  bgColor: 'bg-brand-gold/20' },
  enterprise: { label: 'ENTERPRISE', price: '199,000원/월', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
};

const PLANS = ['starter', 'pro', 'enterprise'] as const;

// --- 만료일 연장 옵션 ---
const EXTEND_OPTIONS = [
  { label: '14일', days: 14 },
  { label: '1개월', days: 30 },
  { label: '3개월', days: 90 },
  { label: '6개월', days: 180 },
  { label: '1년', days: 365 },
];

export default function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [extendingId, setExtendingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadOffices = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'offices'));
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Office));
      list.sort((a, b) => {
        const ta = a.createdAt?.toDate?.()?.getTime() ?? 0;
        const tb = b.createdAt?.toDate?.()?.getTime() ?? 0;
        return tb - ta;
      });
      setOffices(list);
    } catch (err) {
      console.error('사무소 목록 조회 실패:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOffices(); }, [loadOffices]);

  // --- 플랜 변경 ---
  const handlePlanChange = async (officeId: string, newPlan: string) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'offices', officeId), { plan: newPlan });
      setOffices((prev) =>
        prev.map((o) => (o.id === officeId ? { ...o, plan: newPlan as Office['plan'] } : o)),
      );
      setEditingPlan(null);
    } catch (err) {
      console.error('플랜 변경 실패:', err);
      toast.error('플랜 변경에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // --- 만료일 연장 ---
  const handleExtend = async (officeId: string, days: number) => {
    setSaving(true);
    try {
      const office = offices.find((o) => o.id === officeId);
      const base = office?.planExpiry?.toDate?.() ?? new Date();
      const start = base.getTime() > Date.now() ? base : new Date();
      const newExpiry = new Date(start.getTime() + days * 86400000);
      const ts = Timestamp.fromDate(newExpiry);

      await updateDoc(doc(db, 'offices', officeId), { planExpiry: ts });
      setOffices((prev) =>
        prev.map((o) => (o.id === officeId ? { ...o, planExpiry: ts } : o)),
      );
      setExtendingId(null);
    } catch (err) {
      console.error('만료일 연장 실패:', err);
      toast.error('만료일 연장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // --- 통계 ---
  const totalOffices = offices.length;
  const planCounts = PLANS.reduce((acc, p) => {
    acc[p] = offices.filter((o) => o.plan === p).length;
    return acc;
  }, {} as Record<string, number>);
  const totalClients = offices.reduce((sum, o) => sum + (o.clientCount ?? 0), 0);
  const totalDocs = offices.reduce((sum, o) => sum + (o.docCountThisMonth ?? 0), 0);

  const stats = [
    { label: '전체 사무소', value: totalOffices, icon: Building2, color: '#3B82F6' },
    { label: 'STARTER', value: planCounts.starter, icon: Crown, color: '#6B7280' },
    { label: 'PRO', value: planCounts.pro, icon: Crown, color: '#C9A84C' },
    { label: 'ENTERPRISE', value: planCounts.enterprise, icon: Crown, color: '#8B5CF6' },
    { label: '총 의뢰인', value: totalClients, icon: Users, color: '#10B981' },
    { label: '이달 서류 생성', value: totalDocs, icon: FileText, color: '#F59E0B' },
  ];

  // --- 권한 확인 ---
  const ADMIN_EMAILS = ['admin@lawdocs.kr'];
  const isAdmin = user && ADMIN_EMAILS.includes(user.email ?? '');

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500 text-lg">관리자 권한이 필요합니다.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-gold border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">관리자 대시보드</h1>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex items-center gap-4 rounded-xl bg-white p-5">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: s.color + '20' }}
              >
                <Icon size={22} style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-sm text-gray-600">{s.label}</p>
                <span className="text-2xl font-bold text-gray-900">{s.value}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 사무소 목록 테이블 */}
      <div className="rounded-xl bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">사무소 목록</h2>
          <span className="text-sm text-gray-500">총 {totalOffices}개</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600 border-b border-gray-200">
                <th className="pb-3 font-medium">사무소명</th>
                <th className="pb-3 font-medium">대표</th>
                <th className="pb-3 font-medium text-center">유형</th>
                <th className="pb-3 font-medium text-center">플랜</th>
                <th className="pb-3 font-medium text-center">만료일</th>
                <th className="pb-3 font-medium text-right">의뢰인</th>
                <th className="pb-3 font-medium text-right">이달 서류</th>
                <th className="pb-3 font-medium text-center">가입일</th>
                <th className="pb-3 font-medium text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {offices.map((office) => {
                const planMeta = PLAN_META[office.plan] ?? PLAN_META.starter;
                const expiry = office.planExpiry?.toDate?.();
                const expired = expiry ? expiry.getTime() < Date.now() : false;
                const createdAt = office.createdAt?.toDate?.();

                return (
                  <tr key={office.id} className="text-gray-700 hover:bg-gray-50 transition-colors">
                    {/* 사무소명 */}
                    <td className="py-3">
                      <div>
                        <p className="font-medium text-gray-900">{office.name}</p>
                        <p className="text-xs text-gray-400">{office.email || office.id.slice(0, 8)}</p>
                      </div>
                    </td>

                    {/* 대표 */}
                    <td className="py-3 text-gray-700">{office.rep || '-'}</td>

                    {/* 유형 */}
                    <td className="py-3 text-center">
                      <span className="text-xs text-gray-500">
                        {office.type === 'lawyer' ? '변호사' : '법무사'}
                      </span>
                    </td>

                    {/* 플랜 */}
                    <td className="py-3 text-center relative">
                      {editingPlan === office.id ? (
                        <div className="flex items-center justify-center gap-1">
                          {PLANS.map((p) => (
                            <button
                              key={p}
                              disabled={saving}
                              onClick={() => handlePlanChange(office.id, p)}
                              className={`rounded px-2 py-1 text-xs font-semibold transition-colors ${
                                p === office.plan
                                  ? 'bg-brand-gold text-black'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {PLAN_META[p].label}
                            </button>
                          ))}
                          <button
                            onClick={() => setEditingPlan(null)}
                            className="ml-1 text-gray-400 hover:text-gray-600"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingPlan(office.id)}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${planMeta.bgColor} ${planMeta.color}`}
                        >
                          {planMeta.label}
                          <ChevronDown size={12} />
                        </button>
                      )}
                    </td>

                    {/* 만료일 */}
                    <td className="py-3 text-center relative">
                      {extendingId === office.id ? (
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1 flex-wrap justify-center">
                            {EXTEND_OPTIONS.map((opt) => (
                              <button
                                key={opt.days}
                                disabled={saving}
                                onClick={() => handleExtend(office.id, opt.days)}
                                className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-600 hover:bg-blue-100 transition-colors"
                              >
                                +{opt.label}
                              </button>
                            ))}
                            <button
                              onClick={() => setExtendingId(null)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setExtendingId(office.id)}
                          className={`inline-flex items-center gap-1 text-xs ${
                            expired ? 'text-red-500 font-semibold' : 'text-gray-600'
                          }`}
                        >
                          <Calendar size={12} />
                          {expiry ? dayjs(expiry).format('YYYY.MM.DD') : '-'}
                          {expired && <span className="text-red-400">(만료)</span>}
                        </button>
                      )}
                    </td>

                    {/* 의뢰인 수 */}
                    <td className="py-3 text-right font-medium text-gray-900">
                      {office.clientCount ?? 0}
                    </td>

                    {/* 이달 서류 */}
                    <td className="py-3 text-right text-gray-700">
                      {office.docCountThisMonth ?? 0}
                    </td>

                    {/* 가입일 */}
                    <td className="py-3 text-center text-xs text-gray-500">
                      {createdAt ? dayjs(createdAt).format('YYYY.MM.DD') : '-'}
                    </td>

                    {/* 관리 버튼 */}
                    <td className="py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setEditingPlan(office.id)}
                          className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 transition-colors"
                          title="플랜 변경"
                        >
                          플랜
                        </button>
                        <button
                          onClick={() => setExtendingId(office.id)}
                          className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 transition-colors"
                          title="만료일 연장"
                        >
                          연장
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {offices.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-400">
                    등록된 사무소가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
