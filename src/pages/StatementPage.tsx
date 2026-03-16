import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Loader2, Plus, Trash2, ChevronLeft, Download, Save, Sparkles } from 'lucide-react';
import { workerApi } from '@/api/worker';
import { useAuthStore } from '@/store/authStore';
import { getClient, updateClient } from '@/api/firestore';
import { generateNarrative } from '@/utils/aiWriter';
import type { Client } from '@/types/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface NewDebt { creditor: string; type: string; amount: number; date: string; memo: string }
interface LargeTransfer { account: string; date: string; amount: number; recipient: string; relation: string; reason: string }
interface CashWithdrawal { account: string; date: string; amount: number; usage: string }
interface CardUsage { cardNo: string; date: string; amount: number; merchant: string; memo: string }
interface CancelledInsurance { company: string; name: string; monthlyPremium: number; refundAmount: number; status: string }
interface InvestmentLoss { item: string; period: string; investAmount: number; lossAmount: number }

const fmt = (n: number) => n.toLocaleString('ko-KR');

type AiField = 'debtHistory' | 'propertyChanges' | 'repayWillingness' | 'jobChange' | 'priorApplication';

// ---------------------------------------------------------------------------
// 서브 컴포넌트 (렌더링 밖 정의 → 포커스 유지)
// ---------------------------------------------------------------------------
function YesNo({ value, onChange }: { value: string; onChange: (v: 'yes' | 'no') => void }) {
  return (
    <div className="flex gap-3">
      {(['yes', 'no'] as const).map(v => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
            value === v ? 'bg-[var(--color-brand-gold)] text-[var(--color-brand-navy)] border-[var(--color-brand-gold)]'
                       : 'bg-gray-100 text-gray-600 border-gray-200 hover:border-gray-300'
          }`}>
          {v === 'yes' ? '예' : '아니오'}
        </button>
      ))}
    </div>
  );
}

function Section({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white border border-gray-200 p-6 space-y-4">
      <h3 className="text-gray-900 font-semibold flex items-center gap-2">
        <span className="bg-[var(--color-brand-navy)] text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center">{num}</span>
        {title}
      </h3>
      {children}
    </div>
  );
}

function AiTextarea({ value, onChange, keywords, onKeywordsChange, field, placeholder, rows = 4, aiLoadingField, onAiWrite }: {
  value: string;
  onChange: (v: string) => void;
  keywords: string;
  onKeywordsChange: (v: string) => void;
  field: AiField;
  placeholder?: string;
  rows?: number;
  aiLoadingField: string | null;
  onAiWrite: (field: AiField, keywords: string, setter: (v: string) => void) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={keywords}
          onChange={e => onKeywordsChange(e.target.value)}
          placeholder="키워드/메모 입력 (예: 사업실패, 보증, 생활비 부족...)"
          className="flex-1 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 text-sm placeholder:text-amber-400"
        />
        <button
          onClick={() => onAiWrite(field, keywords, onChange)}
          disabled={!keywords.trim() || aiLoadingField === field}
          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg text-sm font-semibold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {aiLoadingField === field ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          AI 작성
        </button>
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full rounded-lg bg-gray-50 border border-gray-200 px-4 py-2.5 text-sm leading-relaxed"
      />
      {value && <p className="text-xs text-gray-400 text-right">{value.length}자</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function StatementPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const office = useAuthStore(s => s.office);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connectedId, setConnectedId] = useState('');
  const [clientData, setClientData] = useState<Client | null>(null);

  // Q1: 채무 발생 경위
  const [debtHistory, setDebtHistory] = useState('');
  const [debtHistoryKeywords, setDebtHistoryKeywords] = useState('');
  const [aiLoadingField, setAiLoadingField] = useState<string | null>(null);

  // 변제 의지
  const [repayWillingness, setRepayWillingness] = useState('');
  const [repayKeywords, setRepayKeywords] = useState('');

  // Q2: 1년 내 신규 채무
  const [newDebts, setNewDebts] = useState<NewDebt[]>([]);
  // Q3: 2년 내 재산 처분
  const [q3, setQ3] = useState<'yes' | 'no' | ''>('');
  const [q3Detail, setQ3Detail] = useState('');
  // Q4: 200만원 이상 이체
  const [transfers, setTransfers] = useState<LargeTransfer[]>([]);
  // Q5: 100만원 이상 현금인출
  const [cashList, setCashList] = useState<CashWithdrawal[]>([]);
  // Q6: 100만원 이상 카드사용
  const [cardList, setCardList] = useState<CardUsage[]>([]);
  // Q7: 해약 보험
  const [insuranceList, setInsuranceList] = useState<CancelledInsurance[]>([]);
  // Q8: 주식/가상화폐/과소비 손실
  const [investments, setInvestments] = useState<InvestmentLoss[]>([]);
  const [gambling, setGambling] = useState<InvestmentLoss[]>([]);
  // Q9-Q13: 예/아니오 + 텍스트
  const [q9, setQ9] = useState<'yes' | 'no' | ''>('');
  const [q10, setQ10] = useState<'yes' | 'no' | ''>('');
  const [q11, setQ11] = useState<'yes' | 'no' | ''>('');
  const [q11Detail, setQ11Detail] = useState('');
  const [q12, setQ12] = useState<'yes' | 'no' | ''>('');
  const [q13Dependents, setQ13Dependents] = useState(0);
  const [q16, setQ16] = useState<'yes' | 'no' | ''>('');
  const [q16Detail, setQ16Detail] = useState('');
  const [q17, setQ17] = useState<'yes' | 'no' | ''>('');

  // Load existing statement data from Firestore
  useEffect(() => {
    if (!office?.id || !clientId) return;
    (async () => {
      const client = await getClient(office.id, clientId);
      if (!client) return;
      setClientData(client);
      if (client.connectedId) setConnectedId(client.connectedId);
      if (!client.statement) return;
      const s = client.statement;
      if (s.debtHistory) setDebtHistory(s.debtHistory);
      if (s.repayWillingness) setRepayWillingness(s.repayWillingness);
      if (s.newDebts1yr?.length) setNewDebts(s.newDebts1yr.map(d => ({
        creditor: d.creditor, type: d.type, amount: d.amount, date: d.date, memo: d.memo ?? '',
      })));
      if (s.propertyChanges2yr) { setQ3('yes'); setQ3Detail(s.propertyChanges2yr); }
      if (s.largeTransfers?.length) setTransfers(s.largeTransfers.map(t => ({
        account: t.account ?? '', date: t.date, amount: t.amount,
        recipient: t.recipient ?? '', relation: t.relation ?? '', reason: t.reason ?? '',
      })));
      if (s.cashWithdrawals?.length) setCashList(s.cashWithdrawals.map(c => ({
        account: c.account ?? '', date: c.date, amount: c.amount, usage: c.usage ?? '',
      })));
      if (s.largeCardUsage?.length) setCardList(s.largeCardUsage.map(c => ({
        cardNo: c.cardNo ?? '', date: c.date, amount: c.amount, merchant: c.merchant ?? '', memo: c.memo ?? '',
      })));
      if (s.cancelledInsurance?.length) setInsuranceList(s.cancelledInsurance.map(ins => ({
        company: ins.company, name: ins.name ?? '', monthlyPremium: ins.monthlyPremium ?? 0,
        refundAmount: ins.refundAmount ?? 0, status: ins.status ?? '',
      })));
      if (s.investmentLosses?.length) setInvestments(s.investmentLosses.map(inv => ({
        item: inv.item, period: inv.period, investAmount: inv.investAmount, lossAmount: inv.lossAmount,
      })));
      if (s.gamblingLosses?.length) setGambling(s.gamblingLosses.map(g => ({
        item: g.item, period: g.period ?? '', investAmount: g.investAmount, lossAmount: g.lossAmount,
      })));
      if (s.divorced2yr) setQ9('yes');
      if (s.jobChange1yr) { setQ11('yes'); setQ11Detail(s.jobChangeDetail ?? ''); }
      if (s.garnishment) setQ12('yes');
      if (s.priorApplication) { setQ16('yes'); setQ16Detail(s.priorApplicationDetail ?? ''); }
      if (s.creditEducation !== undefined) setQ17(s.creditEducation ? 'yes' : 'no');
    })();
  }, [office?.id, clientId]);

  // Save statement data to Firestore
  async function handleSave() {
    if (!office?.id || !clientId) return;
    setSaving(true);
    try {
      const statement: Record<string, unknown> = {
        debtHistory: debtHistory || '',
        repayWillingness: repayWillingness || '',
        newDebts1yr: newDebts.filter(d => d.creditor || d.amount).map(d => ({
          creditor: d.creditor, type: d.type, amount: d.amount, date: d.date, memo: d.memo,
        })),
        propertyChanges2yr: q3 === 'yes' ? q3Detail : '',
        largeTransfers: transfers.filter(t => t.recipient || t.amount).map(t => ({
          account: t.account, date: t.date, amount: t.amount, recipient: t.recipient,
          relation: t.relation, reason: t.reason,
        })),
        cashWithdrawals: cashList.filter(c => c.amount).map(c => ({
          account: c.account, date: c.date, amount: c.amount, usage: c.usage,
        })),
        largeCardUsage: cardList.filter(c => c.amount).map(c => ({
          cardNo: c.cardNo, date: c.date, amount: c.amount, merchant: c.merchant, memo: c.memo,
        })),
        cancelledInsurance: insuranceList.filter(ins => ins.company).map(ins => ({
          company: ins.company, name: ins.name, monthlyPremium: ins.monthlyPremium,
          refundAmount: ins.refundAmount, status: ins.status,
        })),
        investmentLosses: investments.filter(inv => inv.item || inv.investAmount).map(inv => ({
          item: inv.item, period: inv.period, investAmount: inv.investAmount, lossAmount: inv.lossAmount,
        })),
        gamblingLosses: gambling.filter(g => g.item || g.investAmount).map(g => ({
          item: g.item, period: g.period, investAmount: g.investAmount, lossAmount: g.lossAmount,
        })),
        divorced2yr: q9 === 'yes',
        jobChange1yr: q11 === 'yes',
        jobChangeDetail: q11 === 'yes' ? q11Detail : '',
        garnishment: q12 === 'yes',
        priorApplication: q16 === 'yes',
        priorApplicationDetail: q16 === 'yes' ? q16Detail : '',
        creditEducation: q17 === 'yes',
      };
      await updateClient(office.id, clientId, { statement });
    } catch (err) {
      console.error('진술서 저장 실패:', err);
    } finally {
      setSaving(false);
    }
  }

  // CODEF 자동 데이터 로드
  async function loadStatementData() {
    setLoading(true);
    try {
      const data = connectedId
        ? await workerApi.getStatementDataV2(connectedId)
        : {
            // 더미 데이터 (테스트용)
            newDebts: [
              { date: '20250815', creditor: '카카오뱅크', type: '신용대출', amount: 10000000, rate: 7.5 },
              { date: '20251102', creditor: '신한카드', type: '카드론', amount: 5000000, rate: 12.3 },
              { date: '20260110', creditor: 'KB국민은행', type: '마이너스통장', amount: 8000000, rate: 5.9 },
            ],
            largeTransfers: [
              { date: '20260110', account: '110-xxx-1234', amount: 5000000, recipient: '홍길동', memo: '가족 송금', category: '송금' },
              { date: '20260205', account: '110-xxx-1234', amount: 3000000, recipient: '부동산중개', memo: '보증금 반환', category: '이체' },
              { date: '20251215', account: '333-xxx-5678', amount: 2500000, recipient: '김철수', memo: '개인 차용금 상환', category: '송금' },
            ],
            cashWithdrawals: [
              { date: '20260115', account: '110-xxx-1234', amount: 2000000, memo: '생활비', method: 'ATM' },
              { date: '20251220', account: '333-xxx-5678', amount: 1500000, memo: '경조사비', method: '창구' },
            ],
            largeCardUsage: [
              { date: '20260205', cardNo: '1234-xxxx-5678', amount: 2500000, merchant: '○○인테리어', category: '생활서비스' },
              { date: '20260118', cardNo: '9876-xxxx-4321', amount: 1500000, merchant: '○○가전', category: '가전/전자' },
              { date: '20251130', cardNo: '1234-xxxx-5678', amount: 1200000, merchant: '○○병원', category: '의료' },
            ],
            cancelledInsurance: [
              { company: '삼성생명', productName: '종신보험', cancelDate: '20260101', monthlyPremium: 150000, refundAmount: 3200000 },
              { company: '한화생명', productName: '연금저축보험', cancelDate: '20251015', monthlyPremium: 200000, refundAmount: 4800000 },
            ],
            stockLosses: [
              { broker: '키움증권', stockName: '○○바이오', buyAmount: 5000000, sellAmount: 2800000, loss: 2200000, tradeDate: '20250930' },
              { broker: '삼성증권', stockName: '△△테크', buyAmount: 3000000, sellAmount: 1500000, loss: 1500000, tradeDate: '20251105' },
            ],
          };
      let filled = 0;
      if (data.newDebts?.length) {
        setNewDebts(data.newDebts.map((d: any) => ({
          creditor: d.creditor, type: d.type ?? '', amount: d.amount, date: d.date, memo: '',
        })));
        filled++;
      }
      if (data.largeTransfers?.length) {
        setTransfers(data.largeTransfers.map((t: any) => ({
          account: t.account ?? '', date: t.date, amount: t.amount,
          recipient: t.recipient, relation: '', reason: t.memo ?? '',
        })));
        filled++;
      }
      if (data.cashWithdrawals?.length) {
        setCashList(data.cashWithdrawals.map((c: any) => ({
          account: c.account ?? '', date: c.date, amount: c.amount, usage: c.memo ?? '',
        })));
        filled++;
      }
      if (data.largeCardUsage?.length) {
        setCardList(data.largeCardUsage.map((c: any) => ({
          cardNo: c.cardNo ?? '', date: c.date, amount: c.amount, merchant: c.merchant ?? '', memo: '',
        })));
        filled++;
      }
      if (data.cancelledInsurance?.length) {
        setInsuranceList(data.cancelledInsurance.map((ins: any) => ({
          company: ins.company, name: ins.productName ?? '',
          monthlyPremium: ins.monthlyPremium ?? 0, refundAmount: ins.refundAmount ?? 0, status: '',
        })));
        filled++;
      }
      if (data.stockLosses?.length) {
        setInvestments(data.stockLosses.map((s: any) => ({
          item: `${s.broker} - ${s.stockName}`, period: s.tradeDate,
          investAmount: s.buyAmount, lossAmount: s.loss,
        })));
        filled++;
      }
      alert(filled > 0 ? `${filled}개 항목이 자동 채워졌습니다.` : '자동 채움 가능한 데이터가 없습니다.');
    } catch (err: any) {
      console.error('진술서 데이터 로드 실패:', err);
      alert('CODEF 자동채움 실패: ' + (err.message || '서버 오류'));
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // AI 서술형 작성 도우미
  // ---------------------------------------------------------------------------
  const aiContext = clientData ? {
    name: clientData.name,
    totalDebt: clientData.debts?.reduce((s, d) => s + d.amount, 0),
    debtCount: clientData.debts?.length,
    job: clientData.job,
    income: clientData.income,
    family: clientData.family,
  } : undefined;

  async function handleAiWrite(
    field: 'debtHistory' | 'propertyChanges' | 'repayWillingness' | 'jobChange' | 'priorApplication',
    keywords: string,
    setter: (v: string) => void,
  ) {
    if (!keywords.trim()) return;
    setAiLoadingField(field);
    try {
      const result = await generateNarrative({ field, keywords, context: aiContext });
      setter(result);
    } catch (err: any) {
      console.error('AI 작성 실패:', err);
      alert(err.message || 'AI 작성에 실패했습니다');
    } finally {
      setAiLoadingField(null);
    }
  }

  // AiTextarea에 전달할 핸들러 (useCallback 불필요 — 함수가 밖으로 나갔으므로 포커스 유지됨)
  const onAiWrite = handleAiWrite;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1 hover:bg-gray-100 rounded-lg">
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <FileText className="h-5 w-5 text-[var(--color-brand-gold)]" />
            <h1 className="text-lg font-bold text-gray-900">개인회생 진술서</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadStatementData} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--color-brand-gold)] text-[var(--color-brand-navy)] rounded-lg text-sm font-semibold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              CODEF 자동채움
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              저장
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Q1: 채무 발생 경위 */}
        <Section num={1} title="채무 발생 경위를 기재해 주세요">
          <p className="text-xs text-gray-500 mb-2">키워드만 입력하면 AI가 법원 제출용 문체로 작성해 드립니다. 생성 후 수정도 가능합니다.</p>
          <AiTextarea
            value={debtHistory}
            onChange={setDebtHistory}
            keywords={debtHistoryKeywords}
            onKeywordsChange={setDebtHistoryKeywords}
            field="debtHistory"
            placeholder="채무 발생 경위를 기재해 주세요 (예: 2020년 사업 시작, 코로나로 매출 감소, 신용카드로 운영비 충당...)"
            rows={6}
            aiLoadingField={aiLoadingField}
            onAiWrite={onAiWrite}
          />
        </Section>

        {/* Q2: 신규 채무 */}
        <Section num={2} title="신청일로부터 1년 이내에 새로 채무를 부담한 사실이 있나요">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-600">
              <th className="px-3 py-2 text-left">번호</th>
              <th className="px-3 py-2 text-left">채무(사용처)</th>
              <th className="px-3 py-2 text-right">사용금액</th>
              <th className="px-3 py-2 text-left">사용일시</th>
              <th className="px-3 py-2 text-left">비고</th>
              <th className="px-3 py-2 w-10"></th>
            </tr></thead>
            <tbody>
              {newDebts.map((d, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                  <td className="px-3 py-2"><input className="w-full bg-gray-50 rounded px-2 py-1 text-sm" value={d.creditor} onChange={e => { const n = [...newDebts]; n[i] = { ...d, creditor: e.target.value }; setNewDebts(n); }} /></td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(d.amount)}</td>
                  <td className="px-3 py-2 text-gray-600">{d.date}</td>
                  <td className="px-3 py-2"><input className="w-full bg-gray-50 rounded px-2 py-1 text-sm" value={d.memo} onChange={e => { const n = [...newDebts]; n[i] = { ...d, memo: e.target.value }; setNewDebts(n); }} /></td>
                  <td className="px-3 py-2"><button onClick={() => setNewDebts(newDebts.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-red-400" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => setNewDebts([...newDebts, { creditor: '', type: '', amount: 0, date: '', memo: '' }])}
            className="flex items-center gap-1 text-sm text-[var(--color-brand-gold)] hover:underline"><Plus className="h-4 w-4" /> 추가</button>
        </Section>

        {/* Q3: 재산 처분 */}
        <Section num={3} title="신청일로부터 2년 이내에 부동산 또는 1,000만 원 이상 재산을 처분한 사실이 있나요">
          <YesNo value={q3} onChange={setQ3} />
          {q3 === 'yes' && (
            <AiTextarea
              value={q3Detail}
              onChange={setQ3Detail}
              keywords={q3Detail}
              onKeywordsChange={setQ3Detail}
              field="propertyChanges"
              placeholder="처분 내용 상세 기재 (예: 아파트 매각, 차량 매도...)"
              rows={3}
              aiLoadingField={aiLoadingField}
              onAiWrite={onAiWrite}
            />
          )}
        </Section>

        {/* Q4: 200만원 이상 이체 */}
        <Section num={4} title="신청일 전 1년간 200만 원 이상의 이체거래가 있나요">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-600">
              <th className="px-2 py-2 text-left">성명(법인명)</th>
              <th className="px-2 py-2 text-left">계좌</th>
              <th className="px-2 py-2 text-left">거래일시</th>
              <th className="px-2 py-2 text-right">송금액</th>
              <th className="px-2 py-2 text-left">관계</th>
              <th className="px-2 py-2 text-left">사유</th>
              <th className="px-2 py-2 w-10"></th>
            </tr></thead>
            <tbody>
              {transfers.map((t, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-2 py-2"><input className="w-full bg-gray-50 rounded px-2 py-1 text-sm" value={t.recipient} onChange={e => { const n = [...transfers]; n[i] = { ...t, recipient: e.target.value }; setTransfers(n); }} /></td>
                  <td className="px-2 py-2 text-gray-600 text-xs">{t.account}</td>
                  <td className="px-2 py-2 text-gray-600">{t.date}</td>
                  <td className="px-2 py-2 text-right font-mono">{fmt(t.amount)}</td>
                  <td className="px-2 py-2"><input className="w-20 bg-gray-50 rounded px-2 py-1 text-sm" value={t.relation} onChange={e => { const n = [...transfers]; n[i] = { ...t, relation: e.target.value }; setTransfers(n); }} /></td>
                  <td className="px-2 py-2"><input className="w-full bg-gray-50 rounded px-2 py-1 text-sm" value={t.reason} onChange={e => { const n = [...transfers]; n[i] = { ...t, reason: e.target.value }; setTransfers(n); }} /></td>
                  <td className="px-2 py-2"><button onClick={() => setTransfers(transfers.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-red-400" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => setTransfers([...transfers, { account: '', date: '', amount: 0, recipient: '', relation: '', reason: '' }])}
            className="flex items-center gap-1 text-sm text-[var(--color-brand-gold)] hover:underline"><Plus className="h-4 w-4" /> 추가</button>
        </Section>

        {/* Q5: 100만원 이상 현금인출 */}
        <Section num={5} title="신청일 전 1년간 1회 100만 원 이상 현금(수표) 인출내역이 있나요">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-600">
              <th className="px-3 py-2 text-left">계좌</th>
              <th className="px-3 py-2 text-left">거래일시</th>
              <th className="px-3 py-2 text-right">인출금액</th>
              <th className="px-3 py-2 text-left">사용처</th>
              <th className="px-3 py-2 w-10"></th>
            </tr></thead>
            <tbody>
              {cashList.map((c, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-600 text-xs">{c.account}</td>
                  <td className="px-3 py-2 text-gray-600">{c.date}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(c.amount)}</td>
                  <td className="px-3 py-2"><input className="w-full bg-gray-50 rounded px-2 py-1 text-sm" value={c.usage} onChange={e => { const n = [...cashList]; n[i] = { ...c, usage: e.target.value }; setCashList(n); }} /></td>
                  <td className="px-3 py-2"><button onClick={() => setCashList(cashList.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-red-400" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => setCashList([...cashList, { account: '', date: '', amount: 0, usage: '' }])}
            className="flex items-center gap-1 text-sm text-[var(--color-brand-gold)] hover:underline"><Plus className="h-4 w-4" /> 추가</button>
        </Section>

        {/* Q6: 100만원 이상 카드사용 */}
        <Section num={6} title="신청일 전 1년간 거래대금 100만 원 이상인 신용카드 사용내역이 있나요">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-600">
              <th className="px-3 py-2 text-left">카드</th>
              <th className="px-3 py-2 text-left">거래일시</th>
              <th className="px-3 py-2 text-right">사용금액</th>
              <th className="px-3 py-2 text-left">사용처</th>
              <th className="px-3 py-2 text-left">비고</th>
              <th className="px-3 py-2 w-10"></th>
            </tr></thead>
            <tbody>
              {cardList.map((c, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-600 text-xs">{c.cardNo}</td>
                  <td className="px-3 py-2 text-gray-600">{c.date}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(c.amount)}</td>
                  <td className="px-3 py-2">{c.merchant}</td>
                  <td className="px-3 py-2"><input className="w-full bg-gray-50 rounded px-2 py-1 text-sm" value={c.memo} onChange={e => { const n = [...cardList]; n[i] = { ...c, memo: e.target.value }; setCardList(n); }} /></td>
                  <td className="px-3 py-2"><button onClick={() => setCardList(cardList.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-red-400" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => setCardList([...cardList, { cardNo: '', date: '', amount: 0, merchant: '', memo: '' }])}
            className="flex items-center gap-1 text-sm text-[var(--color-brand-gold)] hover:underline"><Plus className="h-4 w-4" /> 추가</button>
        </Section>

        {/* Q7: 해약 보험 */}
        <Section num={7} title="신청일로부터 1년 이내에 소멸(해약)된 보험이 있나요">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-600">
              <th className="px-3 py-2 text-left">보험회사</th>
              <th className="px-3 py-2 text-left">보험명</th>
              <th className="px-3 py-2 text-right">월 납입 보험료</th>
              <th className="px-3 py-2 text-right">해지 환급금</th>
              <th className="px-3 py-2 text-left">현상태</th>
              <th className="px-3 py-2 w-10"></th>
            </tr></thead>
            <tbody>
              {insuranceList.map((ins, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-3 py-2">{ins.company}</td>
                  <td className="px-3 py-2">{ins.name}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(ins.monthlyPremium)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(ins.refundAmount)}</td>
                  <td className="px-3 py-2 text-gray-600">{ins.status}</td>
                  <td className="px-3 py-2"><button onClick={() => setInsuranceList(insuranceList.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-red-400" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => setInsuranceList([...insuranceList, { company: '', name: '', monthlyPremium: 0, refundAmount: 0, status: '' }])}
            className="flex items-center gap-1 text-sm text-[var(--color-brand-gold)] hover:underline"><Plus className="h-4 w-4" /> 추가</button>
        </Section>

        {/* Q8: 주식/가상화폐/과소비 */}
        <Section num={8} title="신청일로부터 2년 내에 주식, 가상화폐, 과소비, 도박 등으로 금전적 손실이 있나요">
          <p className="text-xs text-gray-500 font-medium">(1) 주식, 가상화폐 등 고위험자산 투자</p>
          <table className="w-full text-sm mb-4">
            <thead><tr className="bg-gray-50 text-gray-600">
              <th className="px-3 py-2 text-left">내역</th>
              <th className="px-3 py-2 text-left">거래기간</th>
              <th className="px-3 py-2 text-right">투자금액</th>
              <th className="px-3 py-2 text-right">손실액</th>
              <th className="px-3 py-2 w-10"></th>
            </tr></thead>
            <tbody>
              {investments.map((inv, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-3 py-2"><input className="w-full bg-gray-50 rounded px-2 py-1 text-sm" value={inv.item} onChange={e => { const n = [...investments]; n[i] = { ...inv, item: e.target.value }; setInvestments(n); }} /></td>
                  <td className="px-3 py-2"><input className="w-full bg-gray-50 rounded px-2 py-1 text-sm" value={inv.period} onChange={e => { const n = [...investments]; n[i] = { ...inv, period: e.target.value }; setInvestments(n); }} /></td>
                  <td className="px-3 py-2"><input type="number" className="w-28 bg-gray-50 rounded px-2 py-1 text-sm text-right" value={inv.investAmount || ''} onChange={e => { const n = [...investments]; n[i] = { ...inv, investAmount: Number(e.target.value) }; setInvestments(n); }} /></td>
                  <td className="px-3 py-2"><input type="number" className="w-28 bg-gray-50 rounded px-2 py-1 text-sm text-right" value={inv.lossAmount || ''} onChange={e => { const n = [...investments]; n[i] = { ...inv, lossAmount: Number(e.target.value) }; setInvestments(n); }} /></td>
                  <td className="px-3 py-2"><button onClick={() => setInvestments(investments.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-red-400" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => setInvestments([...investments, { item: '', period: '', investAmount: 0, lossAmount: 0 }])}
            className="flex items-center gap-1 text-sm text-[var(--color-brand-gold)] hover:underline mb-4"><Plus className="h-4 w-4" /> 추가</button>

          <p className="text-xs text-gray-500 font-medium">(2) 과소비, 도박(스포츠토토 등)</p>
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-gray-600">
              <th className="px-3 py-2 text-left">내역</th>
              <th className="px-3 py-2 text-right">사용금액</th>
              <th className="px-3 py-2 text-right">손실액</th>
              <th className="px-3 py-2 w-10"></th>
            </tr></thead>
            <tbody>
              {gambling.map((g, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-3 py-2"><input className="w-full bg-gray-50 rounded px-2 py-1 text-sm" value={g.item} onChange={e => { const n = [...gambling]; n[i] = { ...g, item: e.target.value }; setGambling(n); }} /></td>
                  <td className="px-3 py-2"><input type="number" className="w-28 bg-gray-50 rounded px-2 py-1 text-sm text-right" value={g.investAmount || ''} onChange={e => { const n = [...gambling]; n[i] = { ...g, investAmount: Number(e.target.value) }; setGambling(n); }} /></td>
                  <td className="px-3 py-2"><input type="number" className="w-28 bg-gray-50 rounded px-2 py-1 text-sm text-right" value={g.lossAmount || ''} onChange={e => { const n = [...gambling]; n[i] = { ...g, lossAmount: Number(e.target.value) }; setGambling(n); }} /></td>
                  <td className="px-3 py-2"><button onClick={() => setGambling(gambling.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-red-400" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => setGambling([...gambling, { item: '', period: '', investAmount: 0, lossAmount: 0 }])}
            className="flex items-center gap-1 text-sm text-[var(--color-brand-gold)] hover:underline"><Plus className="h-4 w-4" /> 추가</button>
        </Section>

        {/* Q9: 이혼 */}
        <Section num={9} title="신청일로부터 2년 이내에 이혼한 사실이 있나요">
          <YesNo value={q9} onChange={setQ9} />
          {q9 === 'yes' && <p className="text-xs text-gray-500">판결서, 조정조서 등본, 재산분할내역, 전 배우자 과세증명서, 지적전산자료를 제출해주세요.</p>}
        </Section>

        {/* Q10: 미성년자녀 이혼 */}
        <Section num={10} title="미성년자녀가 있는 상태에서 이혼한 적이 있고, 현재 자녀가 미성년자인가요">
          <YesNo value={q10} onChange={setQ10} />
          {q10 === 'yes' && <p className="text-xs text-gray-500">양육비부담조서, 판결서, 조정조서 등 양육비 관련 자료를 제출해주세요.</p>}
        </Section>

        {/* Q11: 직장 변동 */}
        <Section num={11} title="신청일로부터 1년 이내에 직장에 변동이 있었나요 (이직, 퇴직, 재취업 등)">
          <YesNo value={q11} onChange={setQ11} />
          {q11 === 'yes' && (
            <AiTextarea
              value={q11Detail}
              onChange={setQ11Detail}
              keywords={q11Detail}
              onKeywordsChange={setQ11Detail}
              field="jobChange"
              placeholder="전·후 근무기간 및 급여액 기재 (예: 2025.3 A회사 퇴직 월200만, 2025.6 B회사 재취업 월180만)"
              rows={2}
              aiLoadingField={aiLoadingField}
              onAiWrite={onAiWrite}
            />
          )}
        </Section>

        {/* Q12: 압류적립금 */}
        <Section num={12} title="급여 등에 관한 압류적립금이 있나요">
          <YesNo value={q12} onChange={setQ12} />
          {q12 === 'yes' && <p className="text-xs text-gray-500">압류적립금은 전부 변제재원으로 사용해야 하며, 변제계획안에 반영해야 합니다.</p>}
        </Section>

        {/* Q13: 부양가족 */}
        <Section num={13} title="부양가족에 미성년자녀 등을 포함하여 생계비를 책정하였나요">
          <div>
            <label className="text-sm text-gray-600">피부양자 수</label>
            <input type="number" min={0} value={q13Dependents} onChange={e => setQ13Dependents(Number(e.target.value))}
              className="ml-3 w-20 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm" />
            <span className="ml-2 text-sm text-gray-500">명</span>
          </div>
          <div className="text-xs text-gray-400 space-y-1">
            <p>배우자 수입이 채무자의 70~130% → 미성년자녀 수의 1/2</p>
            <p>배우자 수입이 채무자의 70% 미만 → 미성년자녀 전부</p>
            <p>배우자 수입이 채무자의 130% 초과 → 0명</p>
          </div>
        </Section>

        {/* Q16: 기각/폐지 */}
        <Section num={16} title="신청일로부터 2년 이내에 회생·파산·개인회생을 신청하였다가 기각·폐지된 사실이 있나요">
          <YesNo value={q16} onChange={setQ16} />
          {q16 === 'yes' && (
            <AiTextarea
              value={q16Detail}
              onChange={setQ16Detail}
              keywords={q16Detail}
              onKeywordsChange={setQ16Detail}
              field="priorApplication"
              placeholder="기각/폐지 사유 기재 (예: 적립금 미납, 보정명령 미이행 등)"
              rows={3}
              aiLoadingField={aiLoadingField}
              onAiWrite={onAiWrite}
            />
          )}
        </Section>

        {/* Q17: 신용교육 */}
        <Section num={17} title="신용회복위원회가 제공하는 신용교육을 수료하고 이수증을 제출하였나요">
          <YesNo value={q17} onChange={setQ17} />
          {q17 === 'no' && (
            <div className="text-xs text-gray-500 space-y-1 bg-gray-50 rounded-lg p-3">
              <p className="font-medium">신용교육 수료 절차:</p>
              <p>1. 신용회복위원회 신용교육원 (educredit.or.kr) 접속</p>
              <p>2. 온라인 교육 → 개인회생·파산 파트 → 동영상 6개 강의 (총 98분) 수료</p>
              <p>3. 이수증 발급 → 법원에 제출</p>
              <p className="text-gray-400">문의: 02-750-1293</p>
            </div>
          )}
        </Section>

        {/* 변제 의지 */}
        <Section num={18} title="변제 의지 및 향후 생활 계획">
          <p className="text-xs text-gray-500 mb-2">향후 변제 계획과 생활 개선 의지를 기재해 주세요. 키워드만 입력해도 AI가 작성해 드립니다.</p>
          <AiTextarea
            value={repayWillingness}
            onChange={setRepayWillingness}
            keywords={repayKeywords}
            onKeywordsChange={setRepayKeywords}
            field="repayWillingness"
            placeholder="변제 의지 및 향후 계획 (예: 절약 생활, 부업 계획, 가족 도움...)"
            rows={5}
            aiLoadingField={aiLoadingField}
            onAiWrite={onAiWrite}
          />
        </Section>
      </div>
    </div>
  );
}
