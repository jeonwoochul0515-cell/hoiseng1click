import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, ArrowUpDown, Trash2, Pencil, Users, LinkIcon, Copy, Check, MessageCircle, Inbox, Download, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { useClients, useDeleteClient, useCreateClient } from '@/hooks/useClients';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { formatKRW, formatPhone, formatDate } from '@/utils/formatter';
import { ClientForm } from '@/components/client/ClientForm';
import type { Client, ClientStatus } from '@/types/client';
import { PLAN_CONFIGS } from '@/types/subscription';
import { createIntakeToken, convertSubmissionToClient, type IntakeSubmission } from '@/api/intake';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/firebase';
import { sendKakaoLink } from '@/utils/kakao';
import { toast } from '@/utils/toast';
import { STATUS_LABELS, STATUS_COLORS } from '@/constants/status';

type SortMode = 'latest' | 'debt';

export default function ClientsPage() {
  const navigate = useNavigate();
  const { data: clients, isLoading } = useClients();
  const deleteMutation = useDeleteClient();
  const createMutation = useCreateClient();
  const { office } = useAuthStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ClientStatus | 'all'>('all');
  const [sortMode, setSortMode] = useState<SortMode>('latest');
  const [formOpen, setFormOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | undefined>(undefined);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [intakeLink, setIntakeLink] = useState('');
  const [intakePin, setIntakePin] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [msgCopied, setMsgCopied] = useState(false);
  const queryClient = useQueryClient();

  // Quick add (이름+전화번호만)
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [qaName, setQaName] = useState('');
  const [qaPhone, setQaPhone] = useState('');
  const [qaLoading, setQaLoading] = useState(false);
  const [qaClientName, setQaClientName] = useState('');

  // 미처리 접수
  const [pendingIntakes, setPendingIntakes] = useState<(IntakeSubmission & { id: string })[]>([]);
  const [intakesLoading, setIntakesLoading] = useState(false);
  const [expandedIntake, setExpandedIntake] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const planConfig = office ? PLAN_CONFIGS[office.plan] : null;

  // 미처리 접수 자동 로드
  useEffect(() => {
    if (!office) return;
    loadPendingIntakes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [office]);

  const loadPendingIntakes = async () => {
    if (!office) return;
    setIntakesLoading(true);
    try {
      const q = query(
        collection(db, 'intakeSubmissions'),
        where('officeId', '==', office.id),
        orderBy('submittedAt', 'desc')
      );
      const snap = await getDocs(q);
      const pending = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as IntakeSubmission & { id: string }))
        .filter(s => !s.convertedClientId);
      setPendingIntakes(pending);
    } catch (err) {
      console.error('접수 목록 조회 실패:', err);
    }
    setIntakesLoading(false);
  };

  const handleConvertIntake = async (sub: IntakeSubmission & { id: string }) => {
    if (!office) return;
    setConvertingId(sub.id);
    try {
      const clientId = await convertSubmissionToClient(office.id, sub.id, sub);
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      await loadPendingIntakes();
      navigate(`/clients/${clientId}`);
    } catch (err) {
      toast.error('등록 실패: ' + (err instanceof Error ? err.message : String(err)));
    }
    setConvertingId(null);
  };

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

  const handleQuickAdd = async () => {
    if (!qaName.trim() || !qaPhone.trim()) {
      toast.warning('이름과 전화번호를 입력해주세요.');
      return;
    }
    if (!office?.id) {
      toast.error('사무소 정보가 없습니다. 설정 페이지에서 사무소를 등록해주세요.');
      return;
    }
    setQaLoading(true);
    try {
      // 1. 이름+전화번호만으로 의뢰인 생성
      await createMutation.mutateAsync({
        name: qaName.trim(), phone: qaPhone.trim(),
        ssn: '', address: '', job: '', jobType: 'employed' as const,
        family: 1, court: '', memo: '',
        income: 0, income2: 0, rent: 0, education: 0, medical: 0,
        fee: 0, feeInstallment: false, feeInstallmentMonths: 1, feePaidAmount: 0,
        status: 'new' as const, collectionDone: false, debts: [], assets: [],
      });
      // 2. 바로 접수링크 생성
      const { tokenId, pin } = await createIntakeToken(office.id, office.name, qaName.trim(), qaPhone.trim());
      setIntakeLink(`${window.location.origin}/intake/${tokenId}`);
      setIntakePin(pin);
      setQaClientName(qaName.trim());

      setQuickAddOpen(false);
      setQaName(''); setQaPhone('');
    } catch (err) {
      console.error('의뢰인 등록 실패:', err);
      toast.error('등록 실패: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setQaLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(intakeLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast.error('클립보드 복사에 실패했습니다.');
    }
  };

  const getMessageTemplate = () => {
    const nameStr = qaClientName ? `${qaClientName}님 안녕하세요.` : '안녕하세요.';
    return `[${office?.name}] 개인회생 접수 안내\n\n${nameStr}\n아래 링크를 눌러 정보를 입력해 주세요.\n\n접수 링크: ${intakeLink}\n비밀번호: ${intakePin}\n\n* 비밀번호 6자리를 입력하면 접수가 시작됩니다.\n* 링크는 7일간 유효합니다.`;
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

  const handleSendKakao = async () => {
    if (!office) return;
    await sendKakaoLink({
      officeName: office.name,
      clientName: qaClientName || '의뢰인',
      intakeLink,
      pin: intakePin,
    });
  };

  const handleAdd = () => {
    if (!office) {
      toast.warning('사무소 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    // 플랜 한도 체크 (실제 클라이언트 수 기반)
    const actualCount = clients?.length ?? 0;
    const config = PLAN_CONFIGS[office.plan];
    if (actualCount >= config.maxClientsPerMonth) {
      setShowUpgradeModal(true);
      return;
    }
    setQaName(''); setQaPhone('');
    setQuickAddOpen(true);
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
              의뢰인 {clients?.length ?? 0}/{planConfig.maxClientsPerMonth === Infinity ? '무제한' : `${planConfig.maxClientsPerMonth}명`} ({planConfig.name} 한도)
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-4 py-2.5 text-sm font-medium text-black shadow-sm hover:bg-[#b8973e] transition-colors"
          >
            <Plus className="h-4 w-4" />
            의뢰인 등록
          </button>
        </div>
      </div>

      {/* Intake Link Banner */}
      {intakeLink && (
        <div className="mb-4 rounded-xl bg-[#0D1B2A] px-5 py-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <LinkIcon size={18} className="text-brand-gold" />
              <span className="text-sm font-semibold text-white">{qaClientName ? `${qaClientName}님 접수 링크` : '접수 링크 생성 완료'}</span>
            </div>
            <button
              onClick={() => { setIntakeLink(''); setIntakePin(''); }}
              className="text-gray-500 hover:text-gray-300 text-lg leading-none"
            >&times;</button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">접수 링크</p>
              <p className="text-xs text-gray-300 truncate font-mono">{intakeLink}</p>
            </div>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1 rounded bg-white/10 px-2.5 py-1.5 text-xs text-white shrink-0 hover:bg-white/20"
            >
              {linkCopied ? <><Check size={12} /> 복사됨</> : <><Copy size={12} /> 링크복사</>}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">비밀번호</p>
              <div className="flex gap-1.5">
                {intakePin.split('').map((d, i) => (
                  <span key={i} className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gold/20 text-lg font-bold text-brand-gold">{d}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">의뢰인에게 전송</p>
            <div className="flex gap-2">
              <button
                onClick={handleSendKakao}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#FEE500] py-2.5 text-xs font-bold text-[#191919] hover:bg-[#F0D800] transition-colors"
              >
                <MessageCircle size={14} />
                카카오톡 전송
              </button>
              <button
                onClick={handleCopyMessage}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-brand-gold py-2.5 text-xs font-bold text-black hover:bg-[#b8973e] transition-colors"
              >
                {msgCopied ? <><Check size={14} /> 복사 완료!</> : <><Copy size={14} /> 메시지 복사</>}
              </button>
            </div>
          </div>
          <p className="text-[10px] text-gray-500">* 의뢰인에게 링크와 비밀번호를 함께 전달해 주세요. 7일간 유효합니다.</p>
        </div>
      )}

      {/* 미처리 접수 배너 */}
      {pendingIntakes.length > 0 && (
        <div className="mb-4 rounded-xl border-2 border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Inbox size={18} className="text-blue-600" />
              <span className="text-sm font-bold text-blue-900">새 접수 {pendingIntakes.length}건</span>
            </div>
            <button
              onClick={loadPendingIntakes}
              disabled={intakesLoading}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              {intakesLoading ? '로딩...' : '새로고침'}
            </button>
          </div>
          <div className="space-y-2">
            {pendingIntakes.map((sub) => (
              <div key={sub.id} className="rounded-lg bg-white border border-blue-100 overflow-hidden">
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedIntake(expandedIntake === sub.id ? null : sub.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900">{sub.name}</span>
                    <span className="text-xs text-gray-500">{sub.phone}</span>
                    <span className="text-xs text-gray-400">
                      채무 {sub.debts?.length || 0}건 · 재산 {sub.assets?.length || 0}건
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleConvertIntake(sub); }}
                      disabled={convertingId === sub.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-3 py-1.5 text-xs font-bold text-black hover:bg-[#b8973e] disabled:opacity-50 transition-colors"
                    >
                      <Download size={13} />
                      {convertingId === sub.id ? '등록중...' : '정보 가져오기'}
                    </button>
                    {expandedIntake === sub.id ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                  </div>
                </div>
                {expandedIntake === sub.id && (
                  <div className="border-t border-gray-100 px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm bg-gray-50">
                    <p><span className="text-gray-500">주소:</span> <span className="text-gray-800">{sub.address || '-'}</span></p>
                    <p><span className="text-gray-500">직업:</span> <span className="text-gray-800">{sub.job || '-'} ({sub.jobType})</span></p>
                    <p><span className="text-gray-500">가족수:</span> <span className="text-gray-800">{sub.family}명</span></p>
                    <p><span className="text-gray-500">월소득:</span> <span className="text-gray-800">{formatKRW(sub.income || 0)}</span></p>
                    <p><span className="text-gray-500">총채무:</span> <span className="text-gray-800 font-medium">{formatKRW(sub.debts?.reduce((s, d) => s + d.amount, 0) || 0)}</span></p>
                    <p><span className="text-gray-500">총재산:</span> <span className="text-gray-800">{formatKRW(sub.assets?.reduce((s, a) => s + a.rawValue, 0) || 0)}</span></p>
                    {sub.memo && <p className="col-span-2"><span className="text-gray-500">메모:</span> <span className="text-gray-800">{sub.memo}</span></p>}
                    <p className="col-span-2 text-xs text-gray-400 mt-1">
                      접수일: {sub.submittedAt?.toDate ? formatDate(sub.submittedAt.toDate()) : '-'}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
          <input
            type="text"
            placeholder="이름 또는 연락처 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as ClientStatus | 'all')}
          className="rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-8 text-sm focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
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
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-gold border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white py-20">
          <Users className="mb-4 h-12 w-12 text-gray-700" />
          <p className="text-lg font-medium text-gray-500">등록된 의뢰인이 없습니다</p>
          <p className="mt-1 text-sm text-gray-600">위의 '의뢰인 등록' 버튼으로 새 의뢰인을 추가하세요</p>
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
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {client.name}
                    {client.intakeSubmissionId && (
                      <span className="ml-1.5 inline-flex rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">접수</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatPhone(client.phone)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{formatKRW(totalDebt(client))}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white ${STATUS_COLORS[client.status].dot}`}>
                      {STATUS_LABELS[client.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {client.collectionDone ? (
                      <span className="text-emerald-500">&#10003;</span>
                    ) : (
                      <span className="text-gray-700">&mdash;</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(client.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/clients/${client.id}/additional-applications`);
                        }}
                        className="rounded p-1 text-gray-600 hover:bg-gray-100 hover:text-indigo-600"
                        title={client.caseNumber ? '부가신청서 생성' : '사건번호 등록 필요'}
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                      <button
                        onClick={e => handleEdit(e, client)}
                        className="rounded p-1 text-gray-600 hover:bg-gray-100 hover:text-blue-600"
                        title="수정"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={e => handleDelete(e, client.id)}
                        className="rounded p-1 text-gray-600 hover:bg-gray-100 hover:text-red-600"
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

      {/* Quick Add Modal (이름+전화번호 → 즉시 접수링크) */}
      {quickAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900 mb-1">의뢰인 등록</h2>
            <p className="text-sm text-gray-500 mb-5">이름과 전화번호만 입력하면 바로 접수링크가 생성됩니다.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
                <input
                  value={qaName} onChange={e => setQaName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-gold focus:ring-1 focus:ring-brand-gold outline-none"
                  placeholder="홍길동"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">전화번호 *</label>
                <input
                  value={qaPhone} onChange={e => setQaPhone(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-brand-gold focus:ring-1 focus:ring-brand-gold outline-none"
                  placeholder="010-0000-0000"
                  type="tel"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setQuickAddOpen(false)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleQuickAdd}
                disabled={qaLoading || !qaName.trim() || !qaPhone.trim()}
                className="flex-1 rounded-lg bg-brand-gold px-4 py-2.5 text-sm font-bold text-black hover:bg-[#b8973e] disabled:opacity-50 transition-colors"
              >
                {qaLoading ? '처리 중...' : '등록 + 링크 전송'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client Form Slide-over (수정용) */}
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
                onClick={() => { setShowUpgradeModal(false); navigate('/settings'); }}
                className="flex-1 rounded-lg bg-brand-gold px-4 py-2 text-sm font-medium text-black hover:bg-[#b8973e]"
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
