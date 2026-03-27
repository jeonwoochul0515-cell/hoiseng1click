import { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Search, ScanLine } from 'lucide-react';
import { useCreateClient, useUpdateClient } from '@/hooks/useClients';
import { calcMonthlyPayment, calcRepayTotal, calcLivingCost } from '@/utils/calculator';
import { formatKRW } from '@/utils/formatter';
import { openAddressSearch } from '@/utils/address';
import { getCourtByAddress } from '@/utils/courtMap';
import type { Client, Debt, Asset, JobType, DebtType, AssetType } from '@/types/client';
import { findCreditor } from '@/utils/creditorDirectory';
import { getClientDecryptedSSN } from '@/api/firestore';
import { useAuthStore } from '@/store/authStore';
import { OcrScanner, type OcrDocType } from './OcrScanner';
import type { IdCardData, BankbookData } from '@/utils/ocr';

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

const TAB_NAMES = ['기본정보', '채무내역', '재산내역', '소득/생계비', '수임료'] as const;

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
  const office = useAuthStore(s => s.office);

  const [tab, setTab] = useState(0);

  // Tab 1: 기본정보
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [ssn, setSsn] = useState('');
  const [address, setAddress] = useState('');
  const [zonecode, setZonecode] = useState('');
  const [jobType, setJobType] = useState<JobType>('employed');
  const [family, setFamily] = useState(1);
  const [court, setCourt] = useState('');
  const [memo, setMemo] = useState('');

  // Tab 2: 채무내역
  const [debts, setDebts] = useState<Debt[]>([emptyDebt()]);

  // Tab 3: 재산내역
  const [assets, setAssets] = useState<Asset[]>([emptyAsset()]);

  // Tab 1 추가
  const [job, setJob] = useState('');

  // Tab 4: 소득/생계비
  const [income, setIncome] = useState(0);
  const [income2, setIncome2] = useState(0);
  const [rent, setRent] = useState(0);
  const [education, setEducation] = useState(0);
  const [medical, setMedical] = useState(0);
  const [familyCost, setFamilyCost] = useState(0);
  const [food, setFood] = useState(0);
  const [transport, setTransport] = useState(0);
  const [telecom, setTelecom] = useState(0);

  // 개시신청서
  const [debtReason, setDebtReason] = useState('');
  const [repayPeriodMonths, setRepayPeriodMonths] = useState(36);

  // Tab 5: 수임료
  const [fee, setFee] = useState(0);
  const [feeInstallment, setFeeInstallment] = useState(false);
  const [feeInstallmentMonths, setFeeInstallmentMonths] = useState(1);
  const [feePaidAmount, setFeePaidAmount] = useState(0);

  // OCR Scanner
  const [ocrOpen, setOcrOpen] = useState(false);
  const [ocrDocType, setOcrDocType] = useState<OcrDocType>('idCard');
  const [ocrTargetAssetIndex, setOcrTargetAssetIndex] = useState<number | null>(null);

  const openOcrScanner = (docType: OcrDocType, assetIndex?: number) => {
    setOcrDocType(docType);
    setOcrTargetAssetIndex(assetIndex ?? null);
    setOcrOpen(true);
  };

  const handleOcrResult = (data: IdCardData | BankbookData) => {
    if (ocrDocType === 'idCard') {
      const d = data as IdCardData;
      if (d.name) setName(d.name);
      if (d.ssn) setSsn(d.ssn);
      if (d.address) setAddress(d.address);
    } else if (ocrDocType === 'bankbook' && ocrTargetAssetIndex !== null) {
      const d = data as BankbookData;
      setAssets(prev => prev.map((a, idx) => {
        if (idx !== ocrTargetAssetIndex) return a;
        return {
          ...a,
          name: d.bankName ? `${d.bankName} 예금` : a.name,
          meta: {
            ...a.meta,
            bankName: d.bankName || a.meta?.bankName || '',
            accountLast4: d.accountNumber ? d.accountNumber.replace(/[^0-9]/g, '').slice(-4) : (a.meta?.accountLast4 || ''),
            accountNumber: d.accountNumber || '',
          },
        };
      }));
    }
  };

  // 편집 시 복호화된 SSN 로드
  useEffect(() => {
    if (client && office?.id) {
      getClientDecryptedSSN(office.id, client.id)
        .then(decrypted => { if (decrypted) setSsn(decrypted); })
        .catch(() => setSsn(client.ssn)); // 실패 시 마스킹값 사용
    }
  }, [client?.id, office?.id]);

  useEffect(() => {
    if (client) {
      setName(client.name);
      setPhone(client.phone);
      setSsn(client.ssn); // 초기값은 마스킹된 값, 위 effect에서 복호화값으로 교체됨
      setAddress(client.address);
      setZonecode(client.zonecode ?? '');
      setJob(client.job ?? '');
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
      setFood(client.food ?? 0);
      setTransport(client.transport ?? 0);
      setTelecom(client.telecom ?? 0);
      setDebtReason(client.debtReason ?? '');
      setRepayPeriodMonths(client.repayPeriodMonths ?? 36);
      setFee(client.fee ?? 0);
      setFeeInstallment(client.feeInstallment ?? false);
      setFeeInstallmentMonths(client.feeInstallmentMonths ?? 1);
      setFeePaidAmount(client.feePaidAmount ?? 0);
    } else {
      setName(''); setPhone(''); setSsn(''); setAddress(''); setZonecode('');
      setJob(''); setJobType('employed'); setFamily(1); setCourt(''); setMemo('');
      setDebts([emptyDebt()]); setAssets([emptyAsset()]);
      setIncome(0); setIncome2(0); setRent(0); setEducation(0); setMedical(0); setFamilyCost(0);
      setFood(0); setTransport(0); setTelecom(0);
      setDebtReason(''); setRepayPeriodMonths(36);
      setFee(0); setFeeInstallment(false); setFeeInstallmentMonths(1); setFeePaidAmount(0);
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
  const repayTotal = useMemo(() => calcRepayTotal(monthlyPayment, repayPeriodMonths), [monthlyPayment, repayPeriodMonths]);

  const updateDebt = (index: number, field: keyof Debt, value: string | number) => {
    setDebts(prev => prev.map((d, i) => i === index ? { ...d, [field]: value } : d));
  };

  /** 채권자명 입력 후 포커스 벗어나면 주소·전화 자동 채우기 */
  const autoFillCreditor = (index: number) => {
    setDebts(prev => prev.map((d, i) => {
      if (i !== index || !d.creditor) return d;
      const ci = findCreditor(d.creditor);
      if (!ci) return d;
      return {
        ...d,
        creditorAddress: d.creditorAddress || ci.address,
        creditorPhone: d.creditorPhone || ci.phone,
        creditorFax: d.creditorFax || ci.fax || '',
      };
    }));
  };

  const updateAsset = (index: number, field: keyof Asset, value: string | number) => {
    setAssets(prev => prev.map((a, i) => i === index ? { ...a, [field]: value } : a));
  };

  const handleSave = async () => {
    const payload = {
      name, phone, ssn, address, zonecode, job, jobType, family, court, memo,
      income, income2, rent, education, medical,
      food, transport, telecom,
      debtReason, repayPeriodMonths,
      fee, feeInstallment, feeInstallmentMonths, feePaidAmount,
      status: client?.status ?? 'new' as const,
      collectionDone: client?.collectionDone ?? false,
      debts: debts.filter(d => d.name || d.creditor || d.amount),
      assets: assets.filter(a => a.name || a.rawValue).map(a => ({
        ...a,
        value: Math.max(0, (a.rawValue ?? 0) * (a.liquidationRate ?? 1) - (a.mortgage ?? 0)),
      })),
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
          <button onClick={onClose} className="rounded-lg p-1 text-gray-600 hover:bg-gray-100 hover:text-gray-600">
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
              {/* 주민등록증 스캔 버튼 */}
              <button
                type="button"
                onClick={() => openOcrScanner('idCard')}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#C9A84C] bg-[#C9A84C]/5 px-4 py-3 text-sm font-medium text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-colors"
              >
                <ScanLine className="h-4 w-4" /> 주민등록증 스캔 (이름 / 주민번호 / 주소 자동입력)
              </button>

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
                <div className="flex gap-2">
                  <input value={address} readOnly className="input flex-1 bg-gray-50 cursor-pointer" placeholder="주소 검색을 클릭하세요"
                    onClick={async () => {
                      const r = await openAddressSearch();
                      if (r) {
                        setAddress(r.address);
                        setZonecode(r.zonecode);
                        const autoCourt = getCourtByAddress(r.sido, r.sigungu);
                        if (autoCourt) setCourt(autoCourt);
                      }
                    }} />
                  <button type="button" onClick={async () => {
                      const r = await openAddressSearch();
                      if (r) {
                        setAddress(r.address);
                        setZonecode(r.zonecode);
                        const autoCourt = getCourtByAddress(r.sido, r.sigungu);
                        if (autoCourt) setCourt(autoCourt);
                      }
                    }}
                    className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 flex items-center gap-1">
                    <Search className="h-4 w-4" /> 검색
                  </button>
                </div>
              </Field>
              <Field label="직업">
                <input value={job} onChange={e => setJob(e.target.value)} className="input" placeholder="예: OO회사 사무직" />
              </Field>
              <Field label="직업유형">
                <select value={jobType} onChange={e => setJobType(e.target.value as JobType)} className="input">
                  {JOB_TYPES.map(j => <option key={j.value} value={j.value}>{j.label}</option>)}
                </select>
              </Field>
              <Field label="가구원 수">
                <input type="number" min={1} max={6} value={family} onChange={e => setFamily(Number(e.target.value))} className="input" />
              </Field>
              <Field label="관할법원 (주소 입력 시 자동)">
                <input value={court} onChange={e => setCourt(e.target.value)} className="input" placeholder="주소를 입력하면 자동 설정됩니다" />
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
                    className="absolute right-2 top-2 rounded p-1 text-gray-600 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div className="mb-1 text-xs font-medium text-gray-600">#{i + 1}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="채무명" compact>
                      <input value={debt.name} onChange={e => updateDebt(i, 'name', e.target.value)} className="input-sm" />
                    </Field>
                    <Field label="채권자" compact>
                      <input value={debt.creditor} onChange={e => updateDebt(i, 'creditor', e.target.value)} onBlur={() => autoFillCreditor(i)} className="input-sm" placeholder="입력 시 주소·전화 자동" />
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
                    <Field label="최초 차용일" compact>
                      <input type="month" value={debt.originalDate ?? ''} onChange={e => updateDebt(i, 'originalDate', e.target.value)} className="input-sm" />
                    </Field>
                    <Field label="최초 차용금액" compact>
                      <input type="number" value={debt.originalAmount ?? 0} onChange={e => updateDebt(i, 'originalAmount', Number(e.target.value))} className="input-sm" />
                    </Field>
                    <Field label="연체이자" compact>
                      <input type="number" value={debt.overdueInterest ?? 0} onChange={e => updateDebt(i, 'overdueInterest', Number(e.target.value))} className="input-sm" />
                    </Field>
                    <Field label="기한이익상실일" compact>
                      <input type="date" value={debt.accelerationDate ?? ''} onChange={e => updateDebt(i, 'accelerationDate', e.target.value)} className="input-sm" />
                    </Field>
                    {debt.type === '담보' && (
                      <Field label="담보물 정보" compact>
                        <input value={debt.collateral ?? ''} onChange={e => updateDebt(i, 'collateral', e.target.value)} className="input-sm" placeholder="근저당 설정 등" />
                      </Field>
                    )}
                  </div>
                  {/* 채권자 주소·전화 (자동입력 또는 수동) */}
                  <div className="mt-2 grid grid-cols-3 gap-3">
                    <Field label="채권자 주소" compact>
                      <input value={debt.creditorAddress ?? ''} onChange={e => updateDebt(i, 'creditorAddress', e.target.value)} className="input-sm" placeholder="자동입력됨" />
                    </Field>
                    <Field label="채권자 전화" compact>
                      <input value={debt.creditorPhone ?? ''} onChange={e => updateDebt(i, 'creditorPhone', e.target.value)} className="input-sm" placeholder="자동입력됨" />
                    </Field>
                    <Field label="채권자 팩스" compact>
                      <input value={debt.creditorFax ?? ''} onChange={e => updateDebt(i, 'creditorFax', e.target.value)} className="input-sm" placeholder="선택" />
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
                    className="absolute right-2 top-2 rounded p-1 text-gray-600 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div className="mb-1 text-xs font-medium text-gray-600">#{i + 1}</div>
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
                    <Field label="환가율 (%)" compact>
                      <input type="number" step="0.01" value={asset.liquidationRate} onChange={e => updateAsset(i, 'liquidationRate', Number(e.target.value))} className="input-sm" />
                    </Field>
                    <Field label="근저당/전세" compact>
                      <input type="number" value={asset.mortgage} onChange={e => updateAsset(i, 'mortgage', Number(e.target.value))} className="input-sm" />
                    </Field>
                  </div>
                  {/* 타입별 상세 필드 */}
                  {asset.type === '부동산' && (
                    <div className="mt-2 grid grid-cols-2 gap-3 border-t border-gray-200 pt-2">
                      <Field label="소재지" compact>
                        <div className="flex gap-1">
                          <input value={asset.meta?.address ?? ''} readOnly className="input-sm flex-1 bg-gray-50 cursor-pointer" placeholder="검색"
                            onClick={async () => { const r = await openAddressSearch(); if (r) setAssets(prev => prev.map((a, idx) => idx === i ? { ...a, meta: { ...a.meta, address: r.address } } : a)); }} />
                          <button type="button" onClick={async () => { const r = await openAddressSearch(); if (r) setAssets(prev => prev.map((a, idx) => idx === i ? { ...a, meta: { ...a.meta, address: r.address } } : a)); }}
                            className="shrink-0 rounded bg-blue-600 px-2 py-1 text-xs text-white"><Search className="h-3 w-3" /></button>
                        </div>
                      </Field>
                      <Field label="면적 (m2)" compact>
                        <input type="number" value={asset.meta?.area ?? 0} onChange={e => setAssets(prev => prev.map((a, idx) => idx === i ? { ...a, meta: { ...a.meta, area: Number(e.target.value) } } : a))} className="input-sm" />
                      </Field>
                    </div>
                  )}
                  {asset.type === '차량' && (
                    <div className="mt-2 grid grid-cols-3 gap-3 border-t border-gray-200 pt-2">
                      <Field label="차종" compact>
                        <input value={asset.meta?.model ?? ''} onChange={e => setAssets(prev => prev.map((a, idx) => idx === i ? { ...a, meta: { ...a.meta, model: e.target.value } } : a))} className="input-sm" />
                      </Field>
                      <Field label="연식" compact>
                        <input type="number" value={asset.meta?.year ?? 0} onChange={e => setAssets(prev => prev.map((a, idx) => idx === i ? { ...a, meta: { ...a.meta, year: Number(e.target.value) } } : a))} className="input-sm" />
                      </Field>
                      <Field label="주행거리 (km)" compact>
                        <input type="number" value={asset.meta?.mileage ?? 0} onChange={e => setAssets(prev => prev.map((a, idx) => idx === i ? { ...a, meta: { ...a.meta, mileage: Number(e.target.value) } } : a))} className="input-sm" />
                      </Field>
                    </div>
                  )}
                  {asset.type === '예금' && (
                    <div className="mt-2 space-y-2 border-t border-gray-200 pt-2">
                      <button
                        type="button"
                        onClick={() => openOcrScanner('bankbook', i)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-[#C9A84C] bg-[#C9A84C]/5 px-3 py-1.5 text-xs font-medium text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-colors"
                      >
                        <ScanLine className="h-3.5 w-3.5" /> 통장 스캔
                      </button>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="은행명" compact>
                          <input value={asset.meta?.bankName ?? ''} onChange={e => setAssets(prev => prev.map((a, idx) => idx === i ? { ...a, meta: { ...a.meta, bankName: e.target.value } } : a))} className="input-sm" />
                        </Field>
                        <Field label="계좌 끝4자리" compact>
                          <input value={asset.meta?.accountLast4 ?? ''} onChange={e => setAssets(prev => prev.map((a, idx) => idx === i ? { ...a, meta: { ...a.meta, accountLast4: e.target.value } } : a))} className="input-sm" maxLength={4} />
                        </Field>
                      </div>
                    </div>
                  )}
                  {asset.type === '보험' && (
                    <div className="mt-2 grid grid-cols-2 gap-3 border-t border-gray-200 pt-2">
                      <Field label="보험회사" compact>
                        <input value={asset.meta?.insurerName ?? ''} onChange={e => setAssets(prev => prev.map((a, idx) => idx === i ? { ...a, meta: { ...a.meta, insurerName: e.target.value } } : a))} className="input-sm" />
                      </Field>
                      <Field label="보험종류" compact>
                        <input value={asset.meta?.insuranceType ?? ''} onChange={e => setAssets(prev => prev.map((a, idx) => idx === i ? { ...a, meta: { ...a.meta, insuranceType: e.target.value } } : a))} className="input-sm" />
                      </Field>
                    </div>
                  )}
                  {asset.type === '증권' && (
                    <div className="mt-2 grid grid-cols-2 gap-3 border-t border-gray-200 pt-2">
                      <Field label="증권회사" compact>
                        <input value={asset.meta?.brokerName ?? ''} onChange={e => setAssets(prev => prev.map((a, idx) => idx === i ? { ...a, meta: { ...a.meta, brokerName: e.target.value } } : a))} className="input-sm" />
                      </Field>
                      <Field label="종목명" compact>
                        <input value={asset.meta?.stockName ?? ''} onChange={e => setAssets(prev => prev.map((a, idx) => idx === i ? { ...a, meta: { ...a.meta, stockName: e.target.value } } : a))} className="input-sm" />
                      </Field>
                    </div>
                  )}
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

              <div className="border-t border-gray-200 pt-4 mt-4">
                <p className="mb-3 text-xs font-medium text-gray-500">추가 생계비</p>
                <div className="space-y-4">
                  <Field label="식비">
                    <input type="number" value={food} onChange={e => setFood(Number(e.target.value))} className="input" />
                  </Field>
                  <Field label="교통비">
                    <input type="number" value={transport} onChange={e => setTransport(Number(e.target.value))} className="input" />
                  </Field>
                  <Field label="통신비">
                    <input type="number" value={telecom} onChange={e => setTelecom(Number(e.target.value))} className="input" />
                  </Field>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4 mt-4">
                <p className="mb-3 text-xs font-medium text-gray-500">변제 계획</p>
                <div className="space-y-4">
                  <Field label="채무 원인">
                    <textarea value={debtReason} onChange={e => setDebtReason(e.target.value)} rows={3} className="input resize-none" placeholder="채무 발생 경위..." />
                  </Field>
                  <Field label="변제기간 (개월)">
                    <select value={repayPeriodMonths} onChange={e => setRepayPeriodMonths(Number(e.target.value))} className="input">
                      <option value={36}>36개월 (3년)</option>
                      <option value={60}>60개월 (5년)</option>
                    </select>
                  </Field>
                </div>
              </div>

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
                  <Row label={`${repayPeriodMonths}개월 총 변제`} value={formatKRW(repayTotal)} />
                </div>
              </div>
            </div>
          )}

          {/* Tab 5: 수임료 */}
          {tab === 4 && (
            <div className="space-y-4">
              <Field label="수임료 총액 (원)">
                <input type="number" value={fee} onChange={e => setFee(Number(e.target.value))} className="input" placeholder="0" />
              </Field>

              <Field label="분할 납부">
                <label className="mt-1 flex cursor-pointer items-center gap-3">
                  <div
                    onClick={() => setFeeInstallment(!feeInstallment)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      feeInstallment ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        feeInstallment ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </div>
                  <span className="text-sm text-gray-700">{feeInstallment ? '분할 납부' : '일시 납부'}</span>
                </label>
              </Field>

              {feeInstallment && (
                <Field label="분할 개월수">
                  <input
                    type="number"
                    min={2}
                    max={36}
                    value={feeInstallmentMonths}
                    onChange={e => setFeeInstallmentMonths(Math.max(1, Number(e.target.value)))}
                    className="input"
                  />
                </Field>
              )}

              <Field label="납부 완료 금액 (원)">
                <input type="number" value={feePaidAmount} onChange={e => setFeePaidAmount(Number(e.target.value))} className="input" placeholder="0" />
              </Field>

              {/* 수임료 요약 */}
              {fee > 0 && (
                <div className="mt-6 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-5">
                  <h3 className="mb-3 text-sm font-bold text-emerald-800">수임료 요약</h3>
                  <div className="space-y-2 text-sm">
                    <Row label="수임료 총액" value={formatKRW(fee)} />
                    <Row label="납부 방식" value={feeInstallment ? `${feeInstallmentMonths}개월 분할` : '일시 납부'} />
                    {feeInstallment && (
                      <Row label="월 납부금" value={formatKRW(Math.ceil(fee / feeInstallmentMonths))} />
                    )}
                    <div className="my-2 border-t border-emerald-200" />
                    <Row label="납부 완료" value={formatKRW(feePaidAmount)} />
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-900">잔여 금액</span>
                      <span className={`text-xl font-bold ${fee - feePaidAmount > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                        {formatKRW(Math.max(0, fee - feePaidAmount))}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2">
                      <div className="h-2.5 overflow-hidden rounded-full bg-emerald-100">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${Math.min(100, (feePaidAmount / fee) * 100)}%` }}
                        />
                      </div>
                      <div className="mt-1 text-right text-xs text-gray-500">
                        {Math.min(100, Math.round((feePaidAmount / fee) * 100))}% 납부 완료
                      </div>
                    </div>
                  </div>
                </div>
              )}
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

      {/* OCR Scanner Modal */}
      <OcrScanner
        docType={ocrDocType}
        isOpen={ocrOpen}
        onClose={() => setOcrOpen(false)}
        onResult={handleOcrResult}
      />

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
