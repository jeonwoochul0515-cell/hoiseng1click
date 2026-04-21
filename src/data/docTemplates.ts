import type { DocTemplate, DocType } from '@/types/docgen';
import { MOCK_CLIENT } from './mockClient';

const krw = (n: number) => new Intl.NumberFormat('ko-KR').format(n) + '원';

const totalDebt = MOCK_CLIENT.debts.reduce((s, d) => s + d.amount, 0);
const totalAsset = MOCK_CLIENT.assets.reduce((s, a) => s + a.value, 0);
const monthlyRepayment = Math.max(
  0,
  MOCK_CLIENT.monthlyIncome - MOCK_CLIENT.livingExpense - MOCK_CLIENT.rent - MOCK_CLIENT.medical,
);

/**
 * 5종 문서 템플릿.
 * - requiredSources: 문서 생성 시 호출되어야 할 API들
 * - sections: 타이핑 순서대로 배치
 */
export const DOC_TEMPLATES: Record<DocType, DocTemplate> = {
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
          { id: 'name', label: '성명', value: MOCK_CLIENT.name, sourceId: 'gov24-resident-abstract' },
          { id: 'ssn', label: '주민등록번호', value: MOCK_CLIENT.ssnMasked, sourceId: 'gov24-resident-abstract' },
          { id: 'phone', label: '전화번호', value: MOCK_CLIENT.phone },
          { id: 'addr', label: '주소', value: MOCK_CLIENT.address, sourceId: 'gov24-resident-abstract' },
          { id: 'job', label: '직업', value: MOCK_CLIENT.job, sourceId: 'hometax-income-proof' },
          { id: 'family', label: '부양가족', value: `${MOCK_CLIENT.familyCount}명`, sourceId: 'court-family-relation' },
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
            value: `채무자는 ${MOCK_CLIENT.companyName}에 근무하며 월 ${krw(MOCK_CLIENT.monthlyIncome)}의 급여를 수령하는 급여소득자로서, 과도한 채무로 인하여 변제가 불가능한 상태에 이르렀습니다.`,
            block: true,
            sourceId: 'hometax-wage-statement',
          },
          {
            id: 'reason-2',
            label: '총 채무액',
            value: `${krw(totalDebt)} (${MOCK_CLIENT.debts.length}개 채권자)`,
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
            value: `${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n${MOCK_CLIENT.court} 귀중`,
            block: true,
          },
        ],
      },
    ],
  },

  'debt-list': {
    type: 'debt-list',
    title: '채권자 목록',
    subtitle: `전 ${MOCK_CLIENT.debts.length}건 · 총 ${krw(totalDebt)}`,
    icon: '📑',
    description: '전체 금융기관별 부채 현황과 채권자 정보',
    requiredSources: ['bank-loans', 'card-list', 'savings-accounts', 'bank-accounts'],
    sections: [
      {
        id: 'header',
        title: '',
        fields: [
          { id: 'doc-title', label: '', value: '채 권 자 목 록', block: true, highlight: true },
          { id: 'debtor-name', label: '채무자', value: MOCK_CLIENT.name },
          { id: 'total', label: '총 채무액', value: krw(totalDebt), highlight: true, sourceId: 'bank-loans' },
        ],
      },
      ...MOCK_CLIENT.debts.map((d, i) => ({
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
  },

  'asset-list': {
    type: 'asset-list',
    title: '재산 목록',
    subtitle: `총 ${krw(totalAsset)} · 청산가치 기준`,
    icon: '🏠',
    description: '예금·보험·차량·부동산 등 모든 재산과 청산가치',
    requiredSources: ['bank-accounts', 'insurance-list', 'gov24-vehicle', 'land-value', 'calc-liquidation'],
    sections: [
      {
        id: 'header',
        title: '',
        fields: [
          { id: 'doc-title', label: '', value: '재 산 목 록', block: true, highlight: true },
          { id: 'debtor-name', label: '채무자', value: MOCK_CLIENT.name },
        ],
      },
      ...MOCK_CLIENT.assets.map((a, i) => ({
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
  },

  'income-list': {
    type: 'income-list',
    title: '수입 및 지출 목록',
    subtitle: '최근 12개월 기준',
    icon: '💰',
    description: '월 소득과 생계비·고정지출 명세',
    requiredSources: ['hometax-income-proof', 'hometax-wage-statement', 'nhis-qualification'],
    sections: [
      {
        id: 'header',
        title: '',
        fields: [
          { id: 'doc-title', label: '', value: '수입 및 지출 목록', block: true, highlight: true },
          { id: 'debtor-name', label: '채무자', value: MOCK_CLIENT.name },
        ],
      },
      {
        id: 'income',
        title: '수입',
        fields: [
          { id: 'company', label: '근무지', value: MOCK_CLIENT.companyName, sourceId: 'nhis-qualification' },
          { id: 'monthly', label: '월 급여 (세후)', value: krw(MOCK_CLIENT.monthlyIncome), sourceId: 'hometax-wage-statement', highlight: true },
          { id: 'annual', label: '연 소득', value: krw(MOCK_CLIENT.monthlyIncome * 12), sourceId: 'hometax-income-proof' },
        ],
      },
      {
        id: 'expense',
        title: '지출',
        fields: [
          { id: 'living', label: '생계비', value: krw(MOCK_CLIENT.livingExpense) },
          { id: 'rent', label: '주거비 (임대료)', value: krw(MOCK_CLIENT.rent) },
          { id: 'medical', label: '의료비', value: krw(MOCK_CLIENT.medical) },
          { id: 'education', label: '교육비', value: krw(MOCK_CLIENT.education) },
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
  },

  'repay-plan': {
    type: 'repay-plan',
    title: '변제계획안',
    subtitle: `36개월 · 월 ${krw(monthlyRepayment)}`,
    icon: '📅',
    description: '법원 인가 기준 36~60개월 변제 스케줄',
    requiredSources: ['calc-repayment', 'calc-liquidation', 'bank-loans'],
    sections: [
      {
        id: 'header',
        title: '',
        fields: [
          { id: 'doc-title', label: '', value: '변 제 계 획 안', block: true, highlight: true },
          { id: 'debtor-name', label: '채무자', value: MOCK_CLIENT.name },
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
        fields: MOCK_CLIENT.debts.map((d, i) => ({
          id: `dist-${i}`,
          label: d.creditor,
          value: `${((d.amount / totalDebt) * 100).toFixed(1)}% · 월 ${krw(Math.floor((d.amount / totalDebt) * monthlyRepayment))}`,
          sourceId: 'calc-repayment',
        })),
      },
    ],
  },
};

function assetSourceId(type: string): string {
  if (type === '예금') return 'bank-accounts';
  if (type === '보험') return 'insurance-list';
  if (type === '차량') return 'gov24-vehicle';
  if (type === '부동산') return 'land-value';
  return 'bank-accounts';
}

export function getDocTemplate(type: DocType): DocTemplate {
  return DOC_TEMPLATES[type];
}

export function listDocTemplates(): DocTemplate[] {
  return Object.values(DOC_TEMPLATES);
}
