import { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useCreateClient, useUpdateClient } from '@/hooks/useClients';
import { calcMonthlyPayment, calcRepayTotal, calcLivingCost } from '@/utils/calculator';
import { formatKRW } from '@/utils/formatter';
import type { Client, Debt, Asset, JobType, DebtType, AssetType } from '@/types/client';

interface ClientFormProps {
  isOpen: boolean;
  onClose: () => void;
  client?: Client;
  onSave?: () => void;
}

const JOB_TYPES: { value: JobType; label: string }[] = [
  { value: 'employed', label: '직장인' },
  { value: 'self', label: '자영업' },
  { value: 'freelance', label: '프리랜서' },
  { value: 'daily', label: '일용직' },
  { value: 'unemployed', label: '무직' },
];

const DEBT_TYPES: DebtType[] = ['무담보', '담보', '사채'];
const ASSET_TYPES: AssetType[] = ['부동산', '차량', '예금', '보험', '증권', '기타'];

const TAB_NAMES = ['기본정보', '채무내역', '재산내역', '소득/생계비'] as const;

function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

function emptyDebt(): Debt {
  return { id: generateId(), name: '', creditor: '', type: '무담보', amount: 0, rate: 0, monthly: 0, source: 'manual' };
}

function emptyAsset(): Asset {
  return { id: generateId(), name: '', type: '기타', rawValue: 0, liquidationRate: 0, mortgage: 0, value: 0, source: 'manual' };
}

export function ClientForm({ isOpen, onClose, client, onSave }: ClientFormProps) {
  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();
  const isEdit = !!client;

  const [tab, setTab] = useState(0);

  // Tab 1: 기본정보
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [ssn, setSsn] = useState('');
  const [address, setAddress] = useState('');
  const [jobType, setJobType] = useState<JobType>('employed');
  const [family, setFamily] = useState(1);
  const [court, setCourt] = useState('');
  const [memo, setMemo] = useState('');

  // Tab 2: 채무내역
  const [debts, setDebts] = useState<Debt[]>([emptyDebt()]);

  // Tab 3: 재산내역
  const [assets, setAssets] = useState<Asset[]>([emptyAsset()]);

  // Tab 4: 소득/생계비
  const [income, setIncome] = useState(0);
  const [income2, setIncome2] = useState(0);
  const [rent, setRent] = useState(0);
  const [education, setEducation] = useState(0);
  const [medical, setMedical] = useState(0);
  const [familyCost, setFamilyCost] = useState(0);

  useEffect(() => {
    if (client) {
      setName(client.name);
      setPhone(client.phone);
      setSsn(client.ssn);
      setAddress(client.address);
      setJobType(client.jobType);
      setFamily(client.family);
      setCourt(client.court);
      setMemo(client.memo);
      setDebts(client.debts.length > 0 ? client.debts : [emptyDebt()]);
      setAssets(client.assets.length > 0 ? client.assets : [emptyAsset()]);
      setIncome(client.income);
      setIncome2(client.income2);
      setRent(client.rent);
      setEducation(client.education);
      setMedical(client.medical);
    } else {
      setName(''); setPhone(''); setSsn(''); setAddress('');
      setJobType('employed'); setFamily(1); setCourt(''); setMemo('');
      setDebts([emptyDebt()]); setAssets([emptyAsset()]);
      setIncome(0); setIncome2(0); setRent(0); setEducation(0); setMedical(0); setFamilyCost(0);
    }
    setTab(0);
  }, [client, isOpen]);

  const debtTotal = useMemo(() => debts.reduce((s, d) => s + d.amount, 0), [debts]);
  const assetTotal = useMemo(() => assets.reduce((s, a) => s + a.rawValue, 0), [assets]);

  const livingCost = useMemo(() => calcLivingCost(family), [family]);
  const monthlyPayment = useMemo(
    () => calcMonthlyPayment({ income, income2, family, rent, education, medical }),
    [income, income2, family, rent, education, medical]
  );
  const repayTotal = useMemo(() => calcRepayTotal(monthlyPayment, 36), [monthlyPayment]);

  const updateDebt = (index: number, field: keyof Debt, value: string | number) => {
    setDebts(prev => prev.map((d, i) => i === index ? { ...d, [field]: value } : d));
  };

  const updateAsset = (index: number, field: keyof Asset, value: string | number) => {
    setAssets(prev => prev.map((a, i) => i === index ? { ...a, [field]: value } : a));
  };

  const handleSave = async () => {
    const payload = {
      name, phone, ssn, address, job: '', jobType, family, court, memo,
      income, income2, rent, education, medical,
      status: client?.status ?? 'new' as const,
      collectionDone: client?.collectionDone ?? false,
      debts: debts.filter(d => d.name || d.creditor || d.amount),
      assets: assets.filter(a => a.name || a.rawValue),
    };

    if (isEdit && client) {
      await updateMutation.mutateAsync({ clientId: client.id, data: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    onSave?.();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? '의뢰인 수정' : '의뢰인 등록'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {TAB_NAMES.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                tab === i
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Tab 1: 기본정보 */}
          {tab === 0 && (
            <div className="space-y-4">
              <Field label="이름 *">
                <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder="홍길동" />
              </Field>
              <Field label="연락처 *">
                <input value={phone} onChange={e => setPhone(e.target.value)} className="input" placeholder="010-0000-0000" />
              </Field>
              <Field label="주민등록번호">
                <input value={ssn} onChange={e => setSsn(e.target.value)} className="input" placeholder="000000-0000000" />
              </Field>
              <Field label="주소 *">
                <input value={address} onChange={e => setAddress(e.target.value)} className="input" placeholder="서울특별시 ..." />
              </Field>
              <Field label="직업유형">
                <select value={jobType} onChange={e => setJobType(e.target.value as JobType)} className="input">
                  {JOB_TYPES.map(j => <option key={j.value} value={j.value}>{j.label}</option>)}
                </select>
              </Field>
              <Field label="가구원 수">
                <input type="number" min={1} max={6} value={family} onChange={e => setFamily(Number(e.target.value))} className="input" />
              </Field>
              <Field label="관할법원">
                <input value={court} onChange={e => setCourt(e.target.value)} className="input" placeholder="서울회생법원" />
              </Field>
              <Field label="메모">
                <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={3} className="input resize-none" placeholder="특이사항..." />
              </Field>
            </div>
          )}

          {/* Tab 2: 채무내역 */}
          {tab === 1 && (
            <div className="space-y-4">
              {debts.map((debt, i) => (
                <div key={debt.id} className="relative rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <button
                    onClick={() => setDebts(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev)}
                    className="absolute right-2 top-2 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div className="mb-1 text-xs font-medium text-gray-400">#{i + 1}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="채무명" compact>
                      <input value={debt.name} onChange={e => updateDebt(i, 'name', e.target.value)} className="input-sm" />
                    </Field>
                    <Field label="채권자" compact>
                      <input value={debt.creditor} onChange={e => updateDebt(i, 'creditor', e.target.value)} className="input-sm" />
                    </Field>
                    <Field label="유형" compact>
                      <select value={debt.type} onChange={e => updateDebt(i, 'type', e.target.value)} className="input-sm">
                        {DEBT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </Field>
                    <Field label="원금" compact>
                      <input type="number" value={debt.amount} onChange={e => updateDebt(i, 'amount', Number(e.target.value))} className="input-sm" />
                    </Field>
                    <Field label="금리 (%)" compact>
                      <input type="number" step="0.1" value={debt.rate} onChange={e => updateDebt(i, 'rate', Number(e.target.value))} className="input-sm" />
                    </Field>
                    <Field label="월상환액" compact>
                      <input type="number" value={debt.monthly} onChange={e => updateDebt(i, 'monthly', Number(e.target.value))} className="input-sm" />
                    </Field>
                  </div>
                </div>
              ))}

              <button
                onClick={() => setDebts(prev => [...prev, emptyDebt()])}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-300 py-3 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600"
              >
                <Plus className="h-4 w-4" /> 채무 추가
              </button>

              <div className="rounded-lg bg-blue-50 px-4 py-3 text-right">
                <span className="text-sm text-gray-600">채무 합계: </span>
                <span className="text-lg font-bold text-blue-700">{formatKRW(debtTotal)}</span>
              </div>
            </div>
          )}

          {/* Tab 3: 재산내역 */}
          {tab === 2 && (
            <div className="space-y-4">
              {assets.map((asset, i) => (
                <div key={asset.id} className="relative rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <button
                    onClick={() => setAssets(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev)}
                    className="absolute right-2 top-2 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div className="mb-1 text-xs font-medium text-gray-400">#{i + 1}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="재산명" compact>
                      <input value={asset.name} onChange={e => updateAsset(i, 'name', e.target.value)} className="input-sm" />
                    </Field>
                    <Field label="종류" compact>
                      <select value={asset.type} onChange={e => updateAsset(i, 'type', e.target.value)} className="input-sm">
                        {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </Field>
                    <Field label="평가액" compact>
                      <input type="number" value={asset.rawValue} onChange={e => updateAsset(i, 'rawValue', Number(e.target.value))} className="input-sm" />
                    </Field>
                  </div>
                </div>
              ))}

              <button
                onClick={() => setAssets(prev => [...prev, emptyAsset()])}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-gray-300 py-3 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600"
              >
                <Plus className="h-4 w-4" /> 재산 추가
              </button>

              <div className="rounded-lg bg-green-50 px-4 py-3 text-right">
                <span className="text-sm text-gray-600">재산 합계: </span>
                <span className="text-lg font-bold text-green-700">{formatKRW(assetTotal)}</span>
              </div>
            </div>
          )}

          {/* Tab 4: 소득/생계비 */}
          {tab === 3 && (
            <div className="space-y-4">
              <Field label="소득 (본인)">
                <input type="number" value={income} onChange={e => setIncome(Number(e.target.value))} className="input" />
              </Field>
              <Field label="소득 (배우자 등)">
                <input type="number" value={income2} onChange={e => setIncome2(Number(e.target.value))} className="input" />
              </Field>
              <Field label="주거비">
                <input type="number" value={rent} onChange={e => setRent(Number(e.target.value))} className="input" />
              </Field>
              <Field label="교육비">
                <input type="number" value={education} onChange={e => setEducation(Number(e.target.value))} className="input" />
              </Field>
              <Field label="의료비">
                <input type="number" value={medical} onChange={e => setMedical(Number(e.target.value))} className="input" />
              </Field>
              <Field label="부양비">
                <input type="number" value={familyCost} onChange={e => setFamilyCost(Number(e.target.value))} className="input" />
              </Field>

              {/* Calculation Box */}
              <div className="mt-6 rounded-xl border-2 border-amber-200 bg-amber-50 p-5">
                <h3 className="mb-3 text-sm font-bold text-amber-800">변제금 산출</h3>
                <div className="space-y-2 text-sm">
                  <Row label="기준중위소득 60%" value={formatKRW(livingCost)} />
                  <Row label="추가생계비 (주거+교육+의료)" value={formatKRW(rent + education + medical)} />
                  <div className="my-2 border-t border-amber-200" />
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-900">월 변제금</span>
                    <span className="text-xl font-bold text-amber-600">{formatKRW(monthlyPayment)}</span>
                  </div>
                  <Row label="36개월 총 변제" value={formatKRW(repayTotal)} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4">
          <button
            onClick={handleSave}
            disabled={createMutation.isPending || updateMutation.isPending}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {createMutation.isPending || updateMutation.isPending ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      <style>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #d1d5db;
          background: white;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
        .input:focus {
          border-color: #3b82f6;
          outline: none;
          box-shadow: 0 0 0 1px #3b82f6;
        }
        .input-sm {
          width: 100%;
          border-radius: 0.375rem;
          border: 1px solid #d1d5db;
          background: white;
          padding: 0.375rem 0.5rem;
          font-size: 0.8125rem;
        }
        .input-sm:focus {
          border-color: #3b82f6;
          outline: none;
          box-shadow: 0 0 0 1px #3b82f6;
        }
      `}</style>
    </>
  );
}

function Field({ label, children, compact }: { label: string; children: React.ReactNode; compact?: boolean }) {
  return (
    <label className={compact ? 'block' : 'block'}>
      <span className={`mb-1 block font-medium text-gray-700 ${compact ? 'text-xs' : 'text-sm'}`}>{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-gray-700">
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
