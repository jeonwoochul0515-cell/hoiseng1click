import type { DocTemplate, DocType } from '@/types/docgen';
import type { Client } from '@/types/client';
import { MOCK_CLIENT } from './mockClient';

/**
 * 5종 문서 템플릿을 실제 Client(혹은 데모 의뢰인) 기준으로 빌드.
 * - 목록(허브 카드)용 메타는 getDocMetaList() 로만 얻고 Client 불필요
 * - 개별 문서 생성(타이핑)용은 buildDocTemplate(type, client) 사용
 */

const krw = (n: number) => new Intl.NumberFormat('ko-KR').format(n) + '원';

/** Client 의 ssn(6-7자리 원본 또는 ssnMasked) → 마스킹된 형태로 통일 */
function maskSsn(client: Client): string {
  if (client.ssnMasked && client.ssnMasked.includes('-')) return client.ssnMasked;
  const raw = (client.ssn || '').replace(/\D/g, '');
  if (raw.length >= 7) return `${raw.slice(0, 6)}-${raw[6]}******`;
  return '******-*******';
}

/** Client 에서 생계비 근사치 추출 (카테고리 합) */
function livingExpenseOf(client: Client): number {
  const sub = (client.food ?? 0) + (client.transport ?? 0) + (client.telecom ?? 0) + (client.insurancePremium ?? 0);
  return sub > 0 ? sub : 0;
}

/** 데모용 MOCK_CLIENT 을 Client 모양으로 어댑트 */
function demoClient(): Client {
  const m = MOCK_CLIENT;
  return {
    id: 'demo',
    name: m.name,
    ssn: '',
    ssnMasked: m.ssnMasked,
    phone: m.phone,
    address: m.address,
    job: m.job,
    jobType: 'employed',
    family: m.familyCount,
    court: m.court,
    income: m.monthlyIncome,
    income2: 0,
    rent: m.rent,
    education: m.education,
    medical: m.medical,
    food: m.livingExpense,
    status: 'new',
    collectionDone: false,
    debts: m.debts.map((d, i) => ({
      id: `demo-debt-${i}`,
      name: d.creditor,
      creditor: d.creditor,
      type: d.type as Client['debts'][number]['type'],
      amount: d.amount,
      rate: d.rate,
      monthly: d.monthly,
      source: 'manual',
    })),
    assets: m.assets.map((a, i) => ({
      id: `demo-asset-${i}`,
      name: a.name,
      type: a.type as Client['assets'][number]['type'],
      rawValue: a.value,
      liquidationRate: 100,
      mortgage: 0,
      value: a.value,
      source: 'manual',
    })),
    memo: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/** 허브 카드 목록에서만 쓰이는 정적 메타 (Client 없이 표시 가능) */
const DOC_META: Record<DocType, Omit<DocTemplate, 'sections'>> = {
  application: {
    type: 'application',
    title: '개인회생절차 개시신청서',
    subtitle: '법원 제출용 · A4 1매',
    icon: '📋',
    description: '법원에 개인회생 신청을 정식으로 접수하는 대표 서류',
    requiredSources: [
      'gov24-resident-abstract',
      'court-family-relation',
      'hometax-income-proof',
      'bank-loans',
    ],
  },
  'debt-list': {
    type: 'debt-list',
    title: '채권자 목록',
    subtitle: '전체 금융기관별 부채 현황',
    icon: '📑',
    description: '전체 금융기관별 부채 현황과 채권자 정보',
    requiredSources: ['bank-loans', 'card-list', 'savings-accounts', 'bank-accounts'],
  },
  'asset-list': {
    type: 'asset-list',
    title: '재산 목록',
    subtitle: '청산가치 기준 재산 명세',
    icon: '🏠',
    description: '예금·보험·차량·부동산 등 모든 재산과 청산가치',
    requiredSources: ['bank-accounts', 'insurance-list', 'gov24-vehicle', 'land-value', 'calc-liquidation'],
  },
  'income-list': {
    type: 'income-list',
    title: '수입 및 지출 목록',
    subtitle: '최근 12개월 기준',
    icon: '💰',
    description: '월 소득과 생계비·고정지출 명세',
    requiredSources: ['hometax-income-proof', 'hometax-wage-statement', 'nhis-qualification'],
  },
  'repay-plan': {
    type: 'repay-plan',
    title: '변제계획안',
    subtitle: '36개월 변제 스케줄',
    icon: '📅',
    description: '법원 인가 기준 36~60개월 변제 스케줄',
    requiredSources: ['calc-repayment', 'calc-liquidation', 'bank-loans'],
  },
};

export function listDocMeta(): Omit<DocTemplate, 'sections'>[] {
  return Object.values(DOC_META);
}

/** 실제 Client 를 받아 타이핑 템플릿을 조립 */
export function buildDocTemplate(type: DocType, client: Client | null): DocTemplate {
  const c = client ?? demoClient();
  const meta = DOC_META[type];
  const totalDebt = c.debts.reduce((s, d) => s + d.amount, 0);
  const totalAsset = c.assets.reduce((s, a) => s + a.value, 0);
  const monthlyIncome = c.income ?? 0;
  const livingExpense = livingExpenseOf(c);
  const rent = c.rent ?? 0;
  const medical = c.medical ?? 0;
  const education = c.education ?? 0;
  const monthlyRepayment = Math.max(0, monthlyIncome - livingExpense - rent - medical - education);

  switch (type) {
    case 'application':
      return {
        ...meta,
        sections: [
          {
            id: 'header',
            title: '',
            fields: [
              { id: 'doc-title', label: '', value: '개인회생절차 개시신청서', block: true, highlight: true },
            ],
          },
          {
            id: 'debtor',
            title: '채무자 정보',
            fields: [
              { id: 'name', label: '성명', value: c.name, sourceId: 'gov24-resident-abstract' },
              { id: 'ssn', label: '주민등록번호', value: maskSsn(c), sourceId: 'gov24-resident-abstract' },
              { id: 'phone', label: '전화번호', value: c.phone || '-' },
              { id: 'addr', label: '주소', value: c.address || '-', sourceId: 'gov24-resident-abstract' },
              { id: 'job', label: '직업', value: c.job || '-', sourceId: 'hometax-income-proof' },
              { id: 'family', label: '부양가족', value: `${c.family ?? 0}명`, sourceId: 'court-family-relation' },
            ],
          },
          {
            id: 'purpose',
            title: '신청 취지',
            fields: [
              {
                id: 'purpose-1',
                label: '',
                value:
                  '채무자에 대하여 개인회생절차를 개시한다. 채무자의 재산에 대한 강제집행 등의 조치를 중지 또는 금지한다. 라는 결정을 구합니다.',
                block: true,
              },
            ],
          },
          {
            id: 'reason',
            title: '신청 이유',
            fields: [
              {
                id: 'reason-1',
                label: '',
                value: `채무자는 ${c.job || '근로자'}로서 월 ${krw(monthlyIncome)}의 급여를 수령하며, 과도한 채무로 변제가 불가능한 상태에 이르렀습니다.`,
                block: true,
                sourceId: 'hometax-wage-statement',
              },
              {
                id: 'reason-2',
                label: '총 채무액',
                value: `${krw(totalDebt)} (${c.debts.length}개 채권자)`,
                sourceId: 'bank-loans',
                highlight: true,
              },
              {
                id: 'reason-3',
                label: '월 변제 가능액',
                value: krw(monthlyRepayment),
                sourceId: 'calc-repayment',
                highlight: true,
              },
              {
                id: 'reason-4',
                label: '',
                value:
                  '위와 같이 채무 변제가 불가능한 상태이므로, 채무자 재활을 위하여 개인회생절차의 개시를 신청합니다.',
                block: true,
              },
            ],
          },
          {
            id: 'footer',
            title: '',
            fields: [
              {
                id: 'court',
                label: '',
                value: `${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n${c.court || '관할 회생법원'} 귀중`,
                block: true,
              },
            ],
          },
        ],
      };

    case 'debt-list':
      return {
        ...meta,
        subtitle: `전 ${c.debts.length}건 · 총 ${krw(totalDebt)}`,
        sections: [
          {
            id: 'header',
            title: '',
            fields: [
              { id: 'doc-title', label: '', value: '채 권 자 목 록', block: true, highlight: true },
              { id: 'debtor-name', label: '채무자', value: c.name },
              { id: 'total', label: '총 채무액', value: krw(totalDebt), highlight: true, sourceId: 'bank-loans' },
            ],
          },
          ...c.debts.slice(0, 10).map((d, i) => ({
            id: `debt-${i + 1}`,
            title: `${i + 1}. ${d.creditor}`,
            fields: [
              { id: `d${i}-type`, label: '채무 종류', value: d.type, sourceId: 'bank-loans' },
              { id: `d${i}-amount`, label: '채무액', value: krw(d.amount), sourceId: 'bank-loans', highlight: true },
              { id: `d${i}-rate`, label: '이자율', value: `연 ${d.rate}%`, sourceId: 'bank-loans' },
              { id: `d${i}-monthly`, label: '월 상환액', value: krw(d.monthly), sourceId: 'bank-loans' },
            ],
          })),
        ],
      };

    case 'asset-list':
      return {
        ...meta,
        subtitle: `총 ${krw(totalAsset)} · 청산가치 기준`,
        sections: [
          {
            id: 'header',
            title: '',
            fields: [
              { id: 'doc-title', label: '', value: '재 산 목 록', block: true, highlight: true },
              { id: 'debtor-name', label: '채무자', value: c.name },
            ],
          },
          ...c.assets.slice(0, 10).map((a, i) => ({
            id: `asset-${i + 1}`,
            title: `${i + 1}. ${a.name}`,
            fields: [
              { id: `a${i}-type`, label: '재산 종류', value: a.type, sourceId: assetSourceId(a.type) },
              { id: `a${i}-value`, label: '평가액', value: krw(a.value), sourceId: assetSourceId(a.type), highlight: true },
            ],
          })),
          {
            id: 'summary',
            title: '합계',
            fields: [
              { id: 'total-asset', label: '총 재산', value: krw(totalAsset), highlight: true },
              { id: 'liquidation', label: '청산가치 (75%)', value: krw(Math.floor(totalAsset * 0.75)), sourceId: 'calc-liquidation', highlight: true },
            ],
          },
        ],
      };

    case 'income-list':
      return {
        ...meta,
        sections: [
          {
            id: 'header',
            title: '',
            fields: [
              { id: 'doc-title', label: '', value: '수입 및 지출 목록', block: true, highlight: true },
              { id: 'debtor-name', label: '채무자', value: c.name },
            ],
          },
          {
            id: 'income',
            title: '수입',
            fields: [
              { id: 'job', label: '직업', value: c.job || '-', sourceId: 'nhis-qualification' },
              { id: 'monthly', label: '월 급여 (세후)', value: krw(monthlyIncome), sourceId: 'hometax-wage-statement', highlight: true },
              { id: 'annual', label: '연 소득', value: krw(monthlyIncome * 12), sourceId: 'hometax-income-proof' },
            ],
          },
          {
            id: 'expense',
            title: '지출',
            fields: [
              { id: 'living', label: '생계비', value: krw(livingExpense) },
              { id: 'rent', label: '주거비 (임대료)', value: krw(rent) },
              { id: 'medical', label: '의료비', value: krw(medical) },
              { id: 'education', label: '교육비', value: krw(education) },
            ],
          },
          {
            id: 'net',
            title: '변제 가능액',
            fields: [
              { id: 'net-monthly', label: '월 변제 가능액', value: krw(monthlyRepayment), sourceId: 'calc-repayment', highlight: true },
            ],
          },
        ],
      };

    case 'repay-plan':
      return {
        ...meta,
        subtitle: `36개월 · 월 ${krw(monthlyRepayment)}`,
        sections: [
          {
            id: 'header',
            title: '',
            fields: [
              { id: 'doc-title', label: '', value: '변 제 계 획 안', block: true, highlight: true },
              { id: 'debtor-name', label: '채무자', value: c.name },
            ],
          },
          {
            id: 'plan',
            title: '변제 계획',
            fields: [
              { id: 'period', label: '변제 기간', value: '36개월', highlight: true },
              { id: 'monthly', label: '월 변제액', value: krw(monthlyRepayment), sourceId: 'calc-repayment', highlight: true },
              { id: 'total', label: '총 변제액', value: krw(monthlyRepayment * 36), sourceId: 'calc-repayment' },
              { id: 'start', label: '개시 예정일', value: '인가결정일 다음 달부터' },
            ],
          },
          {
            id: 'distribution',
            title: '채권자별 배당',
            fields: c.debts.slice(0, 10).map((d, i) => ({
              id: `dist-${i}`,
              label: d.creditor,
              value: totalDebt > 0
                ? `${((d.amount / totalDebt) * 100).toFixed(1)}% · 월 ${krw(Math.floor((d.amount / totalDebt) * monthlyRepayment))}`
                : '-',
              sourceId: 'calc-repayment',
            })),
          },
        ],
      };
  }
}

function assetSourceId(type: string): string {
  if (type === '예금') return 'bank-accounts';
  if (type === '보험') return 'insurance-list';
  if (type === '차량') return 'gov24-vehicle';
  if (type === '부동산') return 'land-value';
  return 'bank-accounts';
}

/** 신규 docgen DocType → 백엔드(worker) DocType 매핑 */
export function docgenToBackendType(t: DocType): 'debt_list' | 'asset_list' | 'income_list' | 'application' | 'repay_plan' {
  switch (t) {
    case 'debt-list': return 'debt_list';
    case 'asset-list': return 'asset_list';
    case 'income-list': return 'income_list';
    case 'application': return 'application';
    case 'repay-plan': return 'repay_plan';
  }
}

// ─── 과거 API 호환 (SelfDiagnosisPage 등이 사용) ────────────────────────────
// Client 가 없을 때는 데모 데이터로 채움.
export function getDocTemplate(type: DocType): DocTemplate {
  return buildDocTemplate(type, null);
}
export function listDocTemplates(): DocTemplate[] {
  return (Object.keys(DOC_META) as DocType[]).map((t) => buildDocTemplate(t, null));
}
