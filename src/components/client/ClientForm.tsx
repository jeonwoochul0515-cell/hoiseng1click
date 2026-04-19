import { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Search, ScanLine } from 'lucide-react';
import { useCreateClient, useUpdateClient } from '@/hooks/useClients';
import { calcMonthlyPayment, calcRepayTotal, calcLivingCost, calcSeparateSecurityAmount, calcDeficiencyAmount, calcOverdueInterest, getInterestRate, checkDebtLimits, recalcOnPeriodChange, type PeriodChangeComparison } from '@/utils/calculator';
import { formatKRW } from '@/utils/formatter';
import { openAddressSearch } from '@/utils/address';
import { getCourtByAddress } from '@/utils/courtMap';
import type { Client, Debt, Asset, JobType, DebtType, AssetType, FamilyMember } from '@/types/client';
import { findCreditor } from '@/utils/creditorDirectory';
import { getClientDecryptedSSN } from '@/api/firestore';
import { useAuthStore } from '@/store/authStore';
import { OcrScanner, type OcrDocType } from './OcrScanner';
import type { IdCardData, BankbookData } from '@/utils/ocr';
import { toast } from '@/utils/toast';
import { CaseApplicationSection, type CaseApplicationState } from './CaseApplicationSection';
import { listMyCreditors, addOrBumpMyCreditor, type MyCreditor } from '@/api/myCreditors';
import { inferPersonalityType } from '@/utils/ecfsCsv';

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

const TAB_NAMES = ['기본정보', '채무내역', '재산내역', '소득/생계비', '수임료', '개시신청서'] as const;

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

  // 자영업자 소득
  const [selfRevenue1, setSelfRevenue1] = useState(0);
  const [selfRevenue2, setSelfRevenue2] = useState(0);
  const [selfExpense1, setSelfExpense1] = useState(0);
  const [selfExpense2, setSelfExpense2] = useState(0);
  const [selfTaxReportIncome, setSelfTaxReportIncome] = useState(0);

  // 부양가족 상세
  const [familyMembers, setFamilyMembers] = useState<import('@/types/client').FamilyMember[]>([]);

  // 개시신청서
  const [debtReason, setDebtReason] = useState('');
  const [repayPeriodMonths, setRepayPeriodMonths] = useState(36);

  // Tab 5: 수임료
  const [fee, setFee] = useState(0);
  const [feeInstallment, setFeeInstallment] = useState(false);
  const [feeInstallmentMonths, setFeeInstallmentMonths] = useState(1);
  const [feePaidAmount, setFeePaidAmount] = useState(0);

  // Tab 6: 개시신청서 (전자소송 양식)
  const [caseApp, setCaseApp] = useState<CaseApplicationState>({});

  // "내 채권자" 템플릿
  const [myCreditors, setMyCreditors] = useState<MyCreditor[]>([]);
  const [showMyCreditorPicker, setShowMyCreditorPicker] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen || !office?.id) return;
    listMyCreditors(office.id)
      .then(setMyCreditors)
      .catch(() => setMyCreditors([]));
  }, [isOpen, office?.id]);

  const applyMyCreditor = (index: number, mc: MyCreditor) => {
    setDebts((prev) =>
      prev.map((d, i) =>
        i !== index
          ? d
          : {
              ...d,
              creditor: mc.name,
              creditorZipCode: mc.zipCode ?? d.creditorZipCode,
              creditorAddress: mc.address ?? d.creditorAddress,
              creditorAddressDetail: mc.addressDetail ?? d.creditorAddressDetail,
              creditorPhone: mc.phone ?? d.creditorPhone,
              creditorMobile: mc.mobile ?? d.creditorMobile,
              creditorFax: mc.fax ?? d.creditorFax,
              creditorEmail: mc.email ?? d.creditorEmail,
            },
      ),
    );
    setShowMyCreditorPicker(null);
  };

  const saveAsMyCreditor = async (index: number) => {
    if (!office?.id) return;
    const d = debts[index];
    if (!d.creditor?.trim()) {
      toast.warning('채권자명을 먼저 입력해주세요');
      return;
    }
    try {
      await addOrBumpMyCreditor(office.id, {
        name: d.creditor,
        personalityType: inferPersonalityType(d.creditor),
        zipCode: d.creditorZipCode,
        address: d.creditorAddress,
        addressDetail: d.creditorAddressDetail,
        phone: d.creditorPhone,
        mobile: d.creditorMobile,
        fax: d.creditorFax,
        email: d.creditorEmail,
      });
      // 목록 갱신
      const updated = await listMyCreditors(office.id);
      setMyCreditors(updated);
      toast.success(`"${d.creditor}" 내 채권자에 저장됨`);
    } catch (err: any) {
      toast.error(err?.message ?? '저장 실패');
    }
  };

  // 변제기간 변경 비교
  const [periodComparison, setPeriodComparison] = useState<PeriodChangeComparison | null>(null);

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
      // 자영업자 소득
      const sei = client.selfEmployedIncome;
      setSelfRevenue1(sei?.revenue1 ?? 0);
      setSelfRevenue2(sei?.revenue2 ?? 0);
      setSelfExpense1(sei?.expense1 ?? 0);
      setSelfExpense2(sei?.expense2 ?? 0);
      setSelfTaxReportIncome(sei?.taxReportIncome ?? 0);
      // 부양가족 상세
      setFamilyMembers(client.familyMembers ?? []);
      setFee(client.fee ?? 0);
      setFeeInstallment(client.feeInstallment ?? false);
      setFeeInstallmentMonths(client.feeInstallmentMonths ?? 1);
      setFeePaidAmount(client.feePaidAmount ?? 0);
      // 개시신청서 탭 로드
      setCaseApp({
        incomeType: client.incomeType,
        repayPeriodMonths: client.repayPeriodMonths,
        repayStartDate: client.repayStartDate,
        repayStartAfterAuthorization: client.repayStartAfterAuthorization,
        repayDayOfMonth: client.repayDayOfMonth,
        monthlyPaymentOverride: client.monthlyPaymentOverride,
        refundBank: client.refundBank,
        refundAccount: client.refundAccount,
        refundAccountHolder: client.refundAccountHolder,
        court: client.court,
        nationality: client.nationality ?? '한국',
        nameForeign: client.nameForeign,
        residentAddress: client.residentAddress ?? client.address,
        residentAddressDetail: client.residentAddressDetail,
        residentZonecode: client.residentZonecode ?? client.zonecode,
        actualAddress: client.actualAddress,
        actualAddressDetail: client.actualAddressDetail,
        actualZonecode: client.actualZonecode,
        sameAsResident: client.sameAsResident ?? true,
        deliveryAddress: client.deliveryAddress,
        deliveryAddressDetail: client.deliveryAddressDetail,
        deliveryZonecode: client.deliveryZonecode,
        sameDeliveryAsResident: client.sameDeliveryAsResident ?? true,
        tel: client.tel,
        fax: client.fax,
        email: client.email,
        docVisibility: client.docVisibility ?? {},
        relatedCases: client.relatedCases ?? [],
        applicationPurpose: client.applicationPurpose,
        applicationReason: client.applicationReason,
      });
    } else {
      setName(''); setPhone(''); setSsn(''); setAddress(''); setZonecode('');
      setJob(''); setJobType('employed'); setFamily(1); setCourt(''); setMemo('');
      setDebts([emptyDebt()]); setAssets([emptyAsset()]);
      setIncome(0); setIncome2(0); setRent(0); setEducation(0); setMedical(0); setFamilyCost(0);
      setFood(0); setTransport(0); setTelecom(0);
      setDebtReason(''); setRepayPeriodMonths(36);
      setSelfRevenue1(0); setSelfRevenue2(0); setSelfExpense1(0); setSelfExpense2(0); setSelfTaxReportIncome(0);
      setFamilyMembers([]);
      setFee(0); setFeeInstallment(false); setFeeInstallmentMonths(1); setFeePaidAmount(0);
      setCaseApp({ nationality: '한국', sameAsResident: true, sameDeliveryAsResident: true, relatedCases: [] });
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

  // 채무 한도 검증
  const debtLimitWarning = useMemo(() => checkDebtLimits(debts), [debts]);

  const updateDebt = (index: number, field: keyof Debt, value: string | number | boolean) => {
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
        creditorAddressDetail: d.creditorAddressDetail || ci.addressDetail || '',
        creditorZipCode: d.creditorZipCode || ci.zipCode || '',
        creditorPhone: d.creditorPhone || ci.phone,
        creditorFax: d.creditorFax || ci.fax || '',
        creditorEmail: d.creditorEmail || ci.email || '',
      };
    }));
  };

  const updateAsset = (index: number, field: keyof Asset, value: string | number) => {
    setAssets(prev => prev.map((a, i) => i === index ? { ...a, [field]: value } : a));
  };

  const handleSave = async () => {
    if (createMutation.isPending || updateMutation.isPending) return;

    if (!name.trim()) {
      toast.warning('이름을 입력해주세요.');
      return;
    }

    try {
      const payload = {
        name, phone, ssn, address, zonecode, job, jobType, family,
        court: caseApp.court ?? court,
        memo,
        income, income2, rent, education, medical,
        food, transport, telecom,
        debtReason,
        repayPeriodMonths: caseApp.repayPeriodMonths ?? repayPeriodMonths,
        selfEmployedIncome: jobType === 'self' ? {
          revenue1: selfRevenue1, revenue2: selfRevenue2,
          expense1: selfExpense1, expense2: selfExpense2,
          taxReportIncome: selfTaxReportIncome,
        } : undefined,
        familyMembers: familyMembers.length > 0 ? familyMembers : undefined,
        fee, feeInstallment, feeInstallmentMonths, feePaidAmount,
        status: client?.status ?? 'new' as const,
        collectionDone: client?.collectionDone ?? false,
        debts: debts.filter(d => d.name || d.creditor || d.amount),
        assets: assets.filter(a => a.name || a.rawValue).map(a => ({
          ...a,
          value: Math.max(0, (a.rawValue ?? 0) * (a.liquidationRate ?? 1) - (a.mortgage ?? 0)),
        })),
        // ── 개시신청서 탭 (전자소송 양식) ──
        incomeType: caseApp.incomeType,
        repayStartDate: caseApp.repayStartDate,
        repayStartAfterAuthorization: caseApp.repayStartAfterAuthorization,
        repayDayOfMonth: caseApp.repayDayOfMonth,
        monthlyPaymentOverride: caseApp.monthlyPaymentOverride,
        refundBank: caseApp.refundBank,
        refundAccount: caseApp.refundAccount,
        refundAccountHolder: caseApp.refundAccountHolder,
        nationality: caseApp.nationality,
        nameForeign: caseApp.nameForeign,
        residentAddress: caseApp.residentAddress,
        residentAddressDetail: caseApp.residentAddressDetail,
        residentZonecode: caseApp.residentZonecode,
        actualAddress: caseApp.actualAddress,
        actualAddressDetail: caseApp.actualAddressDetail,
        actualZonecode: caseApp.actualZonecode,
        sameAsResident: caseApp.sameAsResident,
        deliveryAddress: caseApp.deliveryAddress,
        deliveryAddressDetail: caseApp.deliveryAddressDetail,
        deliveryZonecode: caseApp.deliveryZonecode,
        sameDeliveryAsResident: caseApp.sameDeliveryAsResident,
        tel: caseApp.tel,
        fax: caseApp.fax,
        email: caseApp.email,
        docVisibility: caseApp.docVisibility,
        relatedCases: caseApp.relatedCases?.filter((r) => r.relationName || r.caseNumber),
        applicationPurpose: caseApp.applicationPurpose,
        applicationReason: caseApp.applicationReason,
      };

      if (isEdit && client) {
        await updateMutation.mutateAsync({ clientId: client.id, data: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onSave?.();
      onClose();
    } catch (err) {
      console.error('저장 실패:', err);
      toast.error('저장에 실패했습니다. 다시 시도해주세요.');
    }
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
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-brand-gold bg-brand-gold/5 px-4 py-3 text-sm font-medium text-brand-gold hover:bg-brand-gold/10 transition-colors"
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
                    className="shrink-0 rounded-lg bg-brand-gold px-3 py-2 text-sm font-medium text-black hover:bg-[#b8973e] flex items-center gap-1">
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
              <Field label="가구원 수 (본인 포함)">
                <input type="number" min={1} max={10} value={family} onChange={e => setFamily(Number(e.target.value))} className="input" />
              </Field>

              {/* 부양가족 상세 입력 */}
              <div className="border-t border-gray-200 pt-4 mt-2">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-gray-500">부양가족 상세</p>
                  <button
                    type="button"
                    onClick={() => setFamilyMembers(prev => [...prev, { relation: '자녀' as const, name: '', age: 0, hasIncome: false, isDependent: true }])}
                    className="flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200"
                  >
                    <Plus className="h-3 w-3" /> 가족원 추가
                  </button>
                </div>
                {familyMembers.length === 0 && (
                  <p className="text-xs text-gray-400 mb-2">등록된 가족원이 없습니다. 추가 버튼을 눌러 입력하세요.</p>
                )}
                {familyMembers.map((fm, fi) => (
                  <div key={fi} className="relative rounded-lg border border-gray-200 bg-gray-50 p-3 mb-2">
                    <button
                      type="button"
                      onClick={() => setFamilyMembers(prev => prev.filter((_, idx) => idx !== fi))}
                      className="absolute right-1 top-1 rounded p-0.5 text-gray-400 hover:text-red-500"
                      aria-label="가족구성원 삭제"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="관계" compact>
                        <select
                          value={fm.relation}
                          onChange={e => setFamilyMembers(prev => prev.map((m, idx) => idx === fi ? { ...m, relation: e.target.value as FamilyMember['relation'] } : m))}
                          className="input-sm"
                        >
                          <option value="배우자">배우자</option>
                          <option value="자녀">자녀</option>
                          <option value="부모">부모</option>
                          <option value="형제">형제</option>
                          <option value="기타">기타</option>
                        </select>
                      </Field>
                      <Field label="이름" compact>
                        <input
                          value={fm.name}
                          onChange={e => setFamilyMembers(prev => prev.map((m, idx) => idx === fi ? { ...m, name: e.target.value } : m))}
                          className="input-sm"
                        />
                      </Field>
                      <Field label="나이" compact>
                        <input
                          type="number"
                          min={0}
                          value={fm.age}
                          onChange={e => setFamilyMembers(prev => prev.map((m, idx) => idx === fi ? { ...m, age: Number(e.target.value) } : m))}
                          className="input-sm"
                        />
                      </Field>
                      <Field label="소득 여부" compact>
                        <select
                          value={fm.hasIncome ? 'yes' : 'no'}
                          onChange={e => setFamilyMembers(prev => prev.map((m, idx) => idx === fi ? { ...m, hasIncome: e.target.value === 'yes' } : m))}
                          className="input-sm"
                        >
                          <option value="no">무</option>
                          <option value="yes">유</option>
                        </select>
                      </Field>
                      <Field label="부양 여부" compact>
                        <select
                          value={fm.isDependent ? 'yes' : 'no'}
                          onChange={e => setFamilyMembers(prev => prev.map((m, idx) => idx === fi ? { ...m, isDependent: e.target.value === 'yes' } : m))}
                          className="input-sm"
                        >
                          <option value="yes">부양 대상</option>
                          <option value="no">비대상</option>
                        </select>
                      </Field>
                      <Field label="특수 사항" compact>
                        <select
                          value={fm.specialNeeds ?? ''}
                          onChange={e => setFamilyMembers(prev => prev.map((m, idx) => idx === fi ? { ...m, specialNeeds: (e.target.value || undefined) as FamilyMember['specialNeeds'] } : m))}
                          className="input-sm"
                        >
                          <option value="">없음</option>
                          <option value="미성년">미성년</option>
                          <option value="장애">장애</option>
                          <option value="노인">노인 (65세+)</option>
                          <option value="질병">질병</option>
                        </select>
                      </Field>
                    </div>
                    {/* 특수 사항별 추가 공제 안내 */}
                    {fm.specialNeeds && fm.isDependent && (
                      <div className="mt-1.5 rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">
                        {fm.specialNeeds === '미성년' && '미성년 자녀: 교육비 추가 공제 적용'}
                        {fm.specialNeeds === '노인' && '노부모 (65세+): 부양비 추가 공제 적용'}
                        {fm.specialNeeds === '장애' && '장애인: 의료비 추가 공제 적용'}
                        {fm.specialNeeds === '질병' && '질병: 의료비 추가 공제 적용'}
                      </div>
                    )}
                  </div>
                ))}
              </div>

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
                    aria-label="채무 삭제"
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
                    <Field label="마지막 변제일" compact>
                      <input type="date" value={debt.lastPaymentDate ?? ''} onChange={e => updateDebt(i, 'lastPaymentDate', e.target.value)} className="input-sm" />
                    </Field>
                    <Field label="채무 분류 (시효)" compact>
                      <select value={debt.debtCategory ?? ''} onChange={e => updateDebt(i, 'debtCategory', e.target.value)} className="input-sm">
                        <option value="">자동 판단</option>
                        <option value="일반채권">일반채권 (10년)</option>
                        <option value="상사채권">상사채권 (5년)</option>
                        <option value="카드채무">카드채무 (5년)</option>
                        <option value="대출채무">대출채무 (5년)</option>
                        <option value="사채">사채 (10년)</option>
                        <option value="판결채권">판결채권 (10년)</option>
                        <option value="세금">세금 (시효 없음)</option>
                      </select>
                    </Field>
                    <div className="col-span-2 flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={debt.isNonDischargeable ?? false}
                          onChange={e => updateDebt(i, 'isNonDischargeable', e.target.checked ? true : false)}
                          className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                        <span className="font-medium text-red-700">비면책채권</span>
                      </label>
                      {debt.isNonDischargeable && (
                        <select
                          value={debt.nonDischargeReason ?? ''}
                          onChange={e => updateDebt(i, 'nonDischargeReason', e.target.value)}
                          className="input-sm max-w-[160px]"
                        >
                          <option value="">사유 선택</option>
                          <option value="조세">조세</option>
                          <option value="벌금">벌금</option>
                          <option value="양육비">양육비</option>
                          <option value="불법행위">불법행위</option>
                          <option value="근로채권">근로채권</option>
                          <option value="누락채권">누락채권</option>
                        </select>
                      )}
                    </div>
                    {/* 보증채무 */}
                    <div className="col-span-2 flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={debt.isGuarantee ?? false}
                          onChange={e => updateDebt(i, 'isGuarantee', e.target.checked ? true : false)}
                          className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="font-medium text-purple-700">보증채무</span>
                      </label>
                      {debt.isGuarantee && (
                        <select
                          value={debt.guaranteeType ?? ''}
                          onChange={e => updateDebt(i, 'guaranteeType', e.target.value)}
                          className="input-sm max-w-[120px]"
                        >
                          <option value="">유형 선택</option>
                          <option value="연대보증">연대보증</option>
                          <option value="일반보증">일반보증</option>
                          <option value="근보증">근보증</option>
                        </select>
                      )}
                    </div>
                    {debt.isGuarantee && (
                      <>
                        <Field label="주채무자 이름" compact>
                          <input value={debt.primaryDebtor ?? ''} onChange={e => updateDebt(i, 'primaryDebtor', e.target.value)} className="input-sm" placeholder="주채무자 성명" />
                        </Field>
                        <Field label="주채무자 주민번호" compact>
                          <input value={debt.primaryDebtorSSN ?? ''} onChange={e => updateDebt(i, 'primaryDebtorSSN', e.target.value)} className="input-sm" placeholder="000000-0000000" />
                        </Field>
                      </>
                    )}
                    {/* 채권양도 */}
                    <div className="col-span-2 flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={!!debt.transferredFrom}
                          onChange={e => {
                            if (!e.target.checked) {
                              updateDebt(i, 'transferredFrom', '');
                              updateDebt(i, 'transferDate', '');
                            } else {
                              updateDebt(i, 'transferredFrom', ' ');
                            }
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                        />
                        <span className="font-medium text-teal-700">채권양도</span>
                      </label>
                    </div>
                    {!!debt.transferredFrom && (
                      <>
                        <Field label="원 채권자" compact>
                          <input value={debt.transferredFrom.trim()} onChange={e => updateDebt(i, 'transferredFrom', e.target.value)} className="input-sm" placeholder="원래 채권자명" />
                        </Field>
                        <Field label="양도일" compact>
                          <input type="date" value={debt.transferDate ?? ''} onChange={e => updateDebt(i, 'transferDate', e.target.value)} className="input-sm" />
                        </Field>
                      </>
                    )}
                    {/* 대위변제 */}
                    <div className="col-span-2 flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={debt.hasSubrogation ?? false}
                          onChange={e => updateDebt(i, 'hasSubrogation', e.target.checked ? true : false)}
                          className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="font-medium text-emerald-700">대위변제 있음</span>
                      </label>
                    </div>
                    {debt.hasSubrogation && (
                      <>
                        <Field label="대위변제 금액" compact>
                          <input type="number" value={debt.subrogationAmount ?? 0} onChange={e => updateDebt(i, 'subrogationAmount', Number(e.target.value))} className="input-sm" placeholder="0" />
                        </Field>
                        <Field label="대위변제자" compact>
                          <input value={debt.subrogationCreditor ?? ''} onChange={e => updateDebt(i, 'subrogationCreditor', e.target.value)} className="input-sm" placeholder="구상채권자명" />
                        </Field>
                        <Field label="대위변제일" compact>
                          <input type="date" value={debt.subrogationDate ?? ''} onChange={e => updateDebt(i, 'subrogationDate', e.target.value)} className="input-sm" />
                        </Field>
                        {(debt.subrogationAmount ?? 0) > 0 && (
                          <div className="col-span-2 rounded bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                            원채권 차감 후 잔액: <span className="font-bold">{formatKRW(Math.max(0, debt.amount - (debt.subrogationAmount ?? 0)))}</span>
                            {' / '}
                            구상채권 ({debt.subrogationCreditor || '대위변제자'}): <span className="font-bold">{formatKRW(debt.subrogationAmount ?? 0)}</span>
                            <p className="mt-1 text-emerald-600">* 구상채권자가 채권자목록에 별도 행으로 자동 추가됩니다.</p>
                          </div>
                        )}
                      </>
                    )}
                    {/* 구상채권 */}
                    <div className="col-span-2 flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={debt.isSubrogationClaim ?? false}
                          onChange={e => updateDebt(i, 'isSubrogationClaim', e.target.checked ? true : false)}
                          className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                        />
                        <span className="font-medium text-orange-700">구상채권</span>
                      </label>
                    </div>
                    {debt.isSubrogationClaim && (
                      <>
                        <Field label="원 채권자" compact>
                          <input value={debt.originalCreditor ?? ''} onChange={e => updateDebt(i, 'originalCreditor', e.target.value)} className="input-sm" placeholder="원래 채권자명" />
                        </Field>
                        <Field label="원 채무 금액" compact>
                          <input type="number" value={debt.originalDebtAmount ?? 0} onChange={e => updateDebt(i, 'originalDebtAmount', Number(e.target.value))} className="input-sm" placeholder="0" />
                        </Field>
                        <div className="col-span-2 rounded bg-orange-50 px-3 py-2 text-xs text-orange-800">
                          구상채권: 연대보증 등으로 보증인이 대신 갚은 금액에 대한 채권입니다.
                          {debt.originalCreditor && <span> (원채권자: {debt.originalCreditor})</span>}
                        </div>
                      </>
                    )}
                    {/* 이자/지연손해금 자동 계산 */}
                    <Field label="이율 유형" compact>
                      <select value={debt.interestType ?? '약정이율'} onChange={e => updateDebt(i, 'interestType', e.target.value)} className="input-sm">
                        <option value="약정이율">약정이율</option>
                        <option value="법정이율">법정이율 (연 5%)</option>
                        <option value="상사법정이율">상사법정이율 (연 6%)</option>
                      </select>
                    </Field>
                    <Field label="연체 기산일" compact>
                      <input type="date" value={debt.overdueStartDate ?? ''} onChange={e => {
                        updateDebt(i, 'overdueStartDate', e.target.value);
                        if (e.target.value && debt.amount > 0) {
                          const rate = getInterestRate((debt.interestType as any) ?? '약정이율', debt.rate);
                          const calc = calcOverdueInterest(debt.amount, rate, new Date(e.target.value), new Date());
                          updateDebt(i, 'overdueInterest', calc);
                        }
                      }} className="input-sm" />
                    </Field>
                    {debt.overdueStartDate && debt.amount > 0 && (() => {
                      const rate = getInterestRate((debt.interestType as any) ?? '약정이율', debt.rate);
                      const calc = calcOverdueInterest(debt.amount, rate, new Date(debt.overdueStartDate), new Date());
                      const days = Math.max(0, Math.floor((new Date().getTime() - new Date(debt.overdueStartDate).getTime()) / 86400000));
                      return (
                        <div className="col-span-2 rounded bg-blue-50 px-3 py-2 text-xs text-blue-800">
                          적용이율: <span className="font-bold">{rate}%</span>
                          {' / '}
                          연체일수: <span className="font-bold">{days}일</span>
                          {' / '}
                          산출 지연손해금: <span className="font-bold">{formatKRW(calc)}</span>
                        </div>
                      );
                    })()}
                    {debt.type === '담보' && (
                      <>
                        <Field label="담보물 종류" compact>
                          <select value={debt.collateralType ?? '기타'} onChange={e => updateDebt(i, 'collateralType', e.target.value)} className="input-sm">
                            <option value="주택">주택</option>
                            <option value="차량">차량</option>
                            <option value="기타">기타</option>
                          </select>
                        </Field>
                        <Field label="담보물 시가" compact>
                          <input type="number" value={debt.collateralValue ?? 0} onChange={e => updateDebt(i, 'collateralValue', Number(e.target.value))} className="input-sm" placeholder="담보물 시가" />
                        </Field>
                        <Field label="담보물 설명" compact>
                          <input value={debt.collateralDesc ?? debt.collateral ?? ''} onChange={e => updateDebt(i, 'collateralDesc', e.target.value)} className="input-sm" placeholder="주소, 차종 등" />
                        </Field>
                        <Field label="선순위 설정액" compact>
                          <input type="number" value={debt.seniorLien ?? 0} onChange={e => updateDebt(i, 'seniorLien', Number(e.target.value))} className="input-sm" placeholder="0" />
                        </Field>
                        {(debt.collateralValue ?? 0) > 0 && (() => {
                          const sepAmt = calcSeparateSecurityAmount(debt.amount, debt.collateralValue ?? 0, debt.seniorLien ?? 0);
                          const defAmt = calcDeficiencyAmount(debt.amount, sepAmt);
                          return (
                            <div className="col-span-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
                              별제권 행사 예상액: <span className="font-bold">{formatKRW(sepAmt)}</span>
                              {' / '}
                              부족액 (일반채권): <span className="font-bold">{formatKRW(defAmt)}</span>
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                  {/* 채권자 연락처 — 전자소송 채권자기본정보 필수 */}
                  <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                    <div className="mb-2 flex items-center justify-between flex-wrap gap-2">
                      <p className="text-xs font-semibold text-blue-900">📮 전자소송 채권자기본정보용 (우편번호 필수)</p>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setShowMyCreditorPicker(showMyCreditorPicker === i ? null : i)}
                          className="flex items-center gap-1 rounded bg-purple-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-purple-700"
                        >
                          ⭐ 내 채권자 ({myCreditors.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => saveAsMyCreditor(i)}
                          className="flex items-center gap-1 rounded bg-amber-500 px-2 py-1 text-[10px] font-medium text-white hover:bg-amber-600"
                          title="이 채권자를 내 채권자에 저장"
                        >
                          💾 저장
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await openAddressSearch();
                            if (res) {
                              updateDebt(i, 'creditorZipCode', res.zonecode);
                              updateDebt(i, 'creditorAddress', res.address);
                            }
                          }}
                          className="flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-blue-700"
                        >
                          <Search size={10} /> 주소 검색
                        </button>
                      </div>
                    </div>

                    {/* 내 채권자 드롭다운 */}
                    {showMyCreditorPicker === i && (
                      <div className="mb-2 rounded border border-purple-300 bg-white p-2 max-h-48 overflow-y-auto">
                        {myCreditors.length === 0 ? (
                          <p className="text-[11px] text-gray-500 p-2 text-center">
                            저장된 채권자가 없습니다. "💾 저장" 버튼으로 추가하세요.
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {myCreditors.map((mc) => (
                              <button
                                key={mc.id}
                                type="button"
                                onClick={() => applyMyCreditor(i, mc)}
                                className="w-full text-left px-2 py-1.5 rounded hover:bg-purple-50 text-[11px]"
                              >
                                <span className="font-medium text-gray-900">{mc.name}</span>
                                {mc.address && <span className="text-gray-500 ml-2">{mc.address}</span>}
                                {(mc.useCount ?? 0) > 1 && (
                                  <span className="ml-2 text-[10px] text-purple-600">×{mc.useCount}회</span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-6 gap-2">
                      <Field label="우편번호" compact>
                        <input
                          value={debt.creditorZipCode ?? ''}
                          onChange={e => updateDebt(i, 'creditorZipCode', e.target.value.replace(/\D/g, '').slice(0, 5))}
                          className="input-sm"
                          placeholder="5자리"
                          maxLength={5}
                        />
                      </Field>
                      <div className="col-span-5">
                        <Field label="도로명주소" compact>
                          <input
                            value={debt.creditorAddress ?? ''}
                            onChange={e => updateDebt(i, 'creditorAddress', e.target.value)}
                            className="input-sm"
                            placeholder="주소 검색 버튼 사용 권장"
                          />
                        </Field>
                      </div>
                      <div className="col-span-6">
                        <Field label="상세주소 (동·호수 등)" compact>
                          <input
                            value={debt.creditorAddressDetail ?? ''}
                            onChange={e => updateDebt(i, 'creditorAddressDetail', e.target.value)}
                            className="input-sm"
                            placeholder="예: 101동 101호"
                          />
                        </Field>
                      </div>
                      <div className="col-span-2">
                        <Field label="휴대전화" compact>
                          <input
                            value={debt.creditorMobile ?? ''}
                            onChange={e => updateDebt(i, 'creditorMobile', e.target.value)}
                            className="input-sm"
                            placeholder="010-1234-5678"
                          />
                        </Field>
                      </div>
                      <div className="col-span-2">
                        <Field label="전화번호" compact>
                          <input
                            value={debt.creditorPhone ?? ''}
                            onChange={e => updateDebt(i, 'creditorPhone', e.target.value)}
                            className="input-sm"
                            placeholder="지역번호 포함"
                          />
                        </Field>
                      </div>
                      <div className="col-span-2">
                        <Field label="팩스" compact>
                          <input
                            value={debt.creditorFax ?? ''}
                            onChange={e => updateDebt(i, 'creditorFax', e.target.value)}
                            className="input-sm"
                            placeholder="선택"
                          />
                        </Field>
                      </div>
                      <div className="col-span-6">
                        <Field label="이메일" compact>
                          <input
                            type="email"
                            value={debt.creditorEmail ?? ''}
                            onChange={e => updateDebt(i, 'creditorEmail', e.target.value)}
                            className="input-sm"
                            placeholder="선택"
                          />
                        </Field>
                      </div>
                    </div>
                    <p className="mt-2 text-[10px] text-blue-700">
                      💡 전국대표번호(1588/1577/1566 등)는 전자소송에서 거부됩니다 — 지역번호(02-/031- 등) 또는 휴대전화로 입력하세요.
                    </p>
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

              {/* 채무 한도 초과 경고 */}
              {debtLimitWarning.messages.length > 0 && (
                <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3">
                  {debtLimitWarning.messages.map((msg, idx) => (
                    <p key={idx} className="text-sm font-medium text-red-700">{msg}</p>
                  ))}
                </div>
              )}
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
                    aria-label="재산 삭제"
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
                            className="shrink-0 rounded bg-brand-gold px-2 py-1 text-xs text-black"><Search className="h-3 w-3" /></button>
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
                        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-brand-gold bg-brand-gold/5 px-3 py-1.5 text-xs font-medium text-brand-gold hover:bg-brand-gold/10 transition-colors"
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

              {/* 자영업자 소득 산정 */}
              {jobType === 'self' && (
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <p className="mb-3 text-xs font-medium text-gray-500">자영업 소득 산정</p>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="1차년도 연간 매출">
                        <input type="number" value={selfRevenue1} onChange={e => setSelfRevenue1(Number(e.target.value))} className="input" />
                      </Field>
                      <Field label="1차년도 연간 경비">
                        <input type="number" value={selfExpense1} onChange={e => setSelfExpense1(Number(e.target.value))} className="input" />
                      </Field>
                      <Field label="2차년도 연간 매출">
                        <input type="number" value={selfRevenue2} onChange={e => setSelfRevenue2(Number(e.target.value))} className="input" />
                      </Field>
                      <Field label="2차년도 연간 경비">
                        <input type="number" value={selfExpense2} onChange={e => setSelfExpense2(Number(e.target.value))} className="input" />
                      </Field>
                    </div>
                    <Field label="종합소득세 신고 기준 소득 (연)">
                      <input type="number" value={selfTaxReportIncome} onChange={e => setSelfTaxReportIncome(Number(e.target.value))} className="input" />
                    </Field>
                    {/* 자동 계산 요약 */}
                    <div className="rounded-lg bg-purple-50 px-4 py-3">
                      <p className="text-xs font-medium text-purple-700 mb-2">자영업 소득 산출</p>
                      <div className="space-y-1 text-sm text-gray-700">
                        <div className="flex justify-between">
                          <span>1차년도 순이익</span>
                          <span className="font-mono">{formatKRW(selfRevenue1 - selfExpense1)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>2차년도 순이익</span>
                          <span className="font-mono">{formatKRW(selfRevenue2 - selfExpense2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>2년 평균 순이익</span>
                          <span className="font-mono">{formatKRW(Math.floor(((selfRevenue1 - selfExpense1) + (selfRevenue2 - selfExpense2)) / 2))}</span>
                        </div>
                        <div className="border-t border-purple-200 pt-1 flex justify-between font-bold">
                          <span>월평균 소득</span>
                          <span className="font-mono text-purple-700">{formatKRW(Math.floor(((selfRevenue1 - selfExpense1) + (selfRevenue2 - selfExpense2)) / 2 / 12))}</span>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-purple-600">
                        * 이 값을 위 소득(본인) 필드에 반영하세요
                      </p>
                    </div>
                  </div>
                </div>
              )}

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
                    <select value={repayPeriodMonths} onChange={e => {
                      const newPeriod = Number(e.target.value);
                      const oldPeriod = repayPeriodMonths;
                      setRepayPeriodMonths(newPeriod);

                      // 변제기간 변경 시 전체 재계산
                      if (oldPeriod !== newPeriod) {
                        const comparison = recalcOnPeriodChange({
                          monthlyIncome: income + income2,
                          familySize: family,
                          debts: debts.filter(d => d.name || d.creditor || d.amount).map(d => ({
                            creditor: d.creditor,
                            amount: d.amount,
                            type: d.type,
                            deficiencyAmount: d.deficiencyAmount,
                            separateSecurityAmount: d.separateSecurityAmount,
                            isNonDischargeable: d.isNonDischargeable,
                            nonDischargeReason: d.nonDischargeReason,
                          })),
                          assets: assets.filter(a => a.name || a.rawValue).map(a => ({
                            type: a.type,
                            rawValue: a.rawValue,
                            liquidationRate: a.liquidationRate,
                            mortgage: a.mortgage,
                          })),
                          priorityDebts: client?.priorityClaims?.taxDelinquent ?? 0,
                          oldPeriod,
                          newPeriod,
                          rent,
                          education,
                          medical,
                          income2,
                        });
                        setPeriodComparison(comparison);
                        toast.success('변제계획이 재계산되었습니다.');
                      }
                    }} className="input">
                      <option value={36}>36개월 (3년) - 급여소득자 최소</option>
                      <option value={48}>48개월 (4년)</option>
                      <option value={60}>60개월 (5년) - 최대</option>
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

              {/* 변제기간 변경 전/후 비교 */}
              {periodComparison && (
                <div className="mt-4 rounded-xl border-2 border-blue-200 bg-blue-50 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-blue-800">변제기간 변경 비교</h3>
                    <button
                      type="button"
                      onClick={() => setPeriodComparison(null)}
                      className="text-xs text-blue-500 hover:text-blue-700"
                    >
                      닫기
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {/* Before */}
                    <div className="rounded-lg bg-white p-3 border border-blue-200">
                      <p className="text-xs font-medium text-gray-500 mb-2">변경 전 ({periodComparison.before.period}개월)</p>
                      <div className="space-y-1">
                        <Row label="월 변제금" value={formatKRW(periodComparison.before.monthlyPayment)} />
                        <Row label="총 변제액" value={formatKRW(periodComparison.before.totalRepayment)} />
                        <Row label="변제율" value={`${periodComparison.before.repaymentRate}%`} />
                      </div>
                    </div>
                    {/* After */}
                    <div className="rounded-lg bg-white p-3 border border-blue-300">
                      <p className="text-xs font-medium text-blue-700 mb-2">변경 후 ({periodComparison.after.period}개월)</p>
                      <div className="space-y-1">
                        <Row label="월 변제금" value={formatKRW(periodComparison.after.monthlyPayment)} />
                        <Row label="총 변제액" value={formatKRW(periodComparison.after.totalRepayment)} />
                        <Row label="변제율" value={`${periodComparison.after.repaymentRate}%`} />
                      </div>
                    </div>
                  </div>
                  {/* 총 변제액 차이 */}
                  <div className="mt-3 rounded bg-blue-100 px-3 py-2 text-xs text-blue-800">
                    총 변제액 차이: <span className="font-bold">
                      {formatKRW(Math.abs(periodComparison.after.totalRepayment - periodComparison.before.totalRepayment))}
                      {periodComparison.after.totalRepayment > periodComparison.before.totalRepayment ? ' 증가' : ' 감소'}
                    </span>
                    {' / '}
                    변제예정액표 {periodComparison.schedule.months}개월분 자동 재생성 완료
                  </div>
                  {/* 조세채권 검증 */}
                  {periodComparison.taxCheck.taxTotal > 0 && !periodComparison.taxCheck.canPayInHalf && (
                    <div className="mt-2 rounded bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                      {periodComparison.taxCheck.suggestion}
                    </div>
                  )}
                </div>
              )}
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
                      feeInstallment ? 'bg-brand-gold' : 'bg-gray-300'
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

          {/* Tab 6: 개시신청서 (전자소송 양식) */}
          {tab === 5 && (
            <CaseApplicationSection
              value={caseApp}
              onChange={setCaseApp}
              aiContext={{
                name,
                totalDebt: debtTotal,
                debtCount: debts.length,
                job,
                income,
                family,
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4">
          <button
            onClick={handleSave}
            disabled={createMutation.isPending || updateMutation.isPending}
            className="w-full rounded-lg bg-brand-gold py-2.5 text-sm font-medium text-black hover:bg-[#b8973e] disabled:opacity-50 transition-colors"
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
