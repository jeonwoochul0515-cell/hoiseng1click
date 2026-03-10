import type { DocType } from '@/types/document';
import type { Client } from '@/types/client';
import { formatKRW } from '@/utils/formatter';
import { calcMonthlyPayment } from '@/utils/calculator';

interface DocPreviewProps {
  docType: DocType;
  clientData: Client | null;
}

function getClientName(c: Client | null): string {
  return c?.name ?? '홍길동';
}

function getClientAddress(c: Client | null): string {
  return c?.address ?? '서울특별시 강남구 테헤란로 123';
}

function getClientCourt(c: Client | null): string {
  return c?.court ?? '서울회생법원';
}

function renderDebtList(c: Client | null) {
  const debts = c?.debts ?? [
    { id: '1', creditor: '국민은행', name: '신용대출', type: '무담보' as const, amount: 35000000, rate: 5.5, monthly: 580000, source: 'codef' as const },
    { id: '2', creditor: '신한카드', name: '카드론', type: '무담보' as const, amount: 12000000, rate: 12.0, monthly: 320000, source: 'codef' as const },
    { id: '3', creditor: '하나은행', name: '주택담보대출', type: '담보' as const, amount: 80000000, rate: 3.8, monthly: 450000, source: 'codef' as const },
  ];
  const total = debts.reduce((s, d) => s + d.amount, 0);

  return (
    <>
      <h2 className="mb-4 text-center text-xl font-bold">채 권 자 목 록</h2>
      <div className="mb-4 text-sm">
        <p>채무자: {getClientName(c)}</p>
        <p>주 소: {getClientAddress(c)}</p>
      </div>
      <table className="w-full border-collapse border border-gray-400 text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-400 px-2 py-1">순번</th>
            <th className="border border-gray-400 px-2 py-1">채권자</th>
            <th className="border border-gray-400 px-2 py-1">채무명</th>
            <th className="border border-gray-400 px-2 py-1">종류</th>
            <th className="border border-gray-400 px-2 py-1 text-right">채무액</th>
            <th className="border border-gray-400 px-2 py-1 text-right">이율(%)</th>
          </tr>
        </thead>
        <tbody>
          {debts.map((d, i) => (
            <tr key={d.id}>
              <td className="border border-gray-400 px-2 py-1 text-center">{i + 1}</td>
              <td className="border border-gray-400 px-2 py-1">{d.creditor}</td>
              <td className="border border-gray-400 px-2 py-1">{d.name}</td>
              <td className="border border-gray-400 px-2 py-1 text-center">{d.type}</td>
              <td className="border border-gray-400 px-2 py-1 text-right">{formatKRW(d.amount)}</td>
              <td className="border border-gray-400 px-2 py-1 text-right">{d.rate}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold bg-gray-50">
            <td colSpan={4} className="border border-gray-400 px-2 py-1 text-center">합 계</td>
            <td className="border border-gray-400 px-2 py-1 text-right">{formatKRW(total)}</td>
            <td className="border border-gray-400 px-2 py-1" />
          </tr>
        </tfoot>
      </table>
      <div className="mt-8 text-center text-sm">
        <p>위와 같이 채권자 목록을 제출합니다.</p>
        <p className="mt-4">20__년 __월 __일</p>
        <p className="mt-4">신청인 {getClientName(c)} (인)</p>
      </div>
      <p className="mt-6 text-center text-sm font-bold">{getClientCourt(c)} 귀중</p>
    </>
  );
}

function renderAssetList(c: Client | null) {
  const assets = c?.assets ?? [
    { id: '1', name: '아파트', type: '부동산' as const, rawValue: 350000000, liquidationRate: 0.7, mortgage: 200000000, value: 45000000, source: 'api' as const },
    { id: '2', name: '현대 아반떼', type: '차량' as const, rawValue: 15000000, liquidationRate: 0.6, mortgage: 0, value: 9000000, source: 'api' as const },
    { id: '3', name: '국민은행 예금', type: '예금' as const, rawValue: 2500000, liquidationRate: 1.0, mortgage: 0, value: 2500000, source: 'codef' as const },
  ];
  const total = assets.reduce((s, a) => s + a.value, 0);

  return (
    <>
      <h2 className="mb-4 text-center text-xl font-bold">재 산 목 록</h2>
      <div className="mb-4 text-sm">
        <p>채무자: {getClientName(c)}</p>
      </div>
      <table className="w-full border-collapse border border-gray-400 text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-400 px-2 py-1">순번</th>
            <th className="border border-gray-400 px-2 py-1">재산명</th>
            <th className="border border-gray-400 px-2 py-1">종류</th>
            <th className="border border-gray-400 px-2 py-1 text-right">시가</th>
            <th className="border border-gray-400 px-2 py-1 text-right">담보액</th>
            <th className="border border-gray-400 px-2 py-1 text-right">청산가치</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((a, i) => (
            <tr key={a.id}>
              <td className="border border-gray-400 px-2 py-1 text-center">{i + 1}</td>
              <td className="border border-gray-400 px-2 py-1">{a.name}</td>
              <td className="border border-gray-400 px-2 py-1 text-center">{a.type}</td>
              <td className="border border-gray-400 px-2 py-1 text-right">{formatKRW(a.rawValue)}</td>
              <td className="border border-gray-400 px-2 py-1 text-right">{formatKRW(a.mortgage)}</td>
              <td className="border border-gray-400 px-2 py-1 text-right">{formatKRW(a.value)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold bg-gray-50">
            <td colSpan={5} className="border border-gray-400 px-2 py-1 text-center">순 청산가치 합계</td>
            <td className="border border-gray-400 px-2 py-1 text-right">{formatKRW(total)}</td>
          </tr>
        </tfoot>
      </table>
      <div className="mt-8 text-center text-sm">
        <p>위와 같이 재산 목록을 제출합니다.</p>
        <p className="mt-4">신청인 {getClientName(c)} (인)</p>
      </div>
      <p className="mt-6 text-center text-sm font-bold">{getClientCourt(c)} 귀중</p>
    </>
  );
}

function renderIncomeList(c: Client | null) {
  const income = c?.income ?? 3200000;
  const income2 = c?.income2 ?? 0;
  const rent = c?.rent ?? 500000;
  const education = c?.education ?? 200000;
  const medical = c?.medical ?? 100000;
  const family = c?.family ?? 3;
  const monthly = calcMonthlyPayment({ income, income2, family, rent, education, medical });

  return (
    <>
      <h2 className="mb-4 text-center text-xl font-bold">수입 및 지출에 관한 목록</h2>
      <div className="mb-4 text-sm">
        <p>채무자: {getClientName(c)}</p>
      </div>
      <h3 className="mt-4 mb-2 font-bold text-base">1. 수입</h3>
      <table className="w-full border-collapse border border-gray-400 text-sm mb-4">
        <tbody>
          <tr>
            <td className="border border-gray-400 px-2 py-1 w-40 bg-gray-100">근로소득</td>
            <td className="border border-gray-400 px-2 py-1 text-right">{formatKRW(income)}</td>
          </tr>
          <tr>
            <td className="border border-gray-400 px-2 py-1 bg-gray-100">기타소득</td>
            <td className="border border-gray-400 px-2 py-1 text-right">{formatKRW(income2)}</td>
          </tr>
          <tr className="font-bold">
            <td className="border border-gray-400 px-2 py-1 bg-gray-100">수입 합계</td>
            <td className="border border-gray-400 px-2 py-1 text-right">{formatKRW(income + income2)}</td>
          </tr>
        </tbody>
      </table>
      <h3 className="mt-4 mb-2 font-bold text-base">2. 지출</h3>
      <table className="w-full border-collapse border border-gray-400 text-sm mb-4">
        <tbody>
          <tr>
            <td className="border border-gray-400 px-2 py-1 w-40 bg-gray-100">주거비</td>
            <td className="border border-gray-400 px-2 py-1 text-right">{formatKRW(rent)}</td>
          </tr>
          <tr>
            <td className="border border-gray-400 px-2 py-1 bg-gray-100">교육비</td>
            <td className="border border-gray-400 px-2 py-1 text-right">{formatKRW(education)}</td>
          </tr>
          <tr>
            <td className="border border-gray-400 px-2 py-1 bg-gray-100">의료비</td>
            <td className="border border-gray-400 px-2 py-1 text-right">{formatKRW(medical)}</td>
          </tr>
        </tbody>
      </table>
      <h3 className="mt-4 mb-2 font-bold text-base">3. 가용소득 (월 변제금)</h3>
      <p className="text-sm">가구원 수: {family}인 / 월 변제가능금액: <strong>{formatKRW(monthly)}</strong></p>
      <div className="mt-8 text-center text-sm">
        <p>위와 같이 수입지출 목록을 제출합니다.</p>
        <p className="mt-4">신청인 {getClientName(c)} (인)</p>
      </div>
      <p className="mt-6 text-center text-sm font-bold">{getClientCourt(c)} 귀중</p>
    </>
  );
}

function renderApplication(c: Client | null) {
  return (
    <>
      <h2 className="mb-6 text-center text-xl font-bold">개인회생절차개시 신청서</h2>
      <table className="w-full border-collapse border border-gray-400 text-sm mb-6">
        <tbody>
          <tr>
            <td className="border border-gray-400 px-2 py-1 w-28 bg-gray-100 font-bold">신청인(채무자)</td>
            <td className="border border-gray-400 px-2 py-1">{getClientName(c)}</td>
          </tr>
          <tr>
            <td className="border border-gray-400 px-2 py-1 bg-gray-100 font-bold">주민등록번호</td>
            <td className="border border-gray-400 px-2 py-1">{c?.ssn ? c.ssn.slice(0, 6) + '-*******' : '900101-*******'}</td>
          </tr>
          <tr>
            <td className="border border-gray-400 px-2 py-1 bg-gray-100 font-bold">주 소</td>
            <td className="border border-gray-400 px-2 py-1">{getClientAddress(c)}</td>
          </tr>
          <tr>
            <td className="border border-gray-400 px-2 py-1 bg-gray-100 font-bold">직 업</td>
            <td className="border border-gray-400 px-2 py-1">{c?.job ?? '회사원'}</td>
          </tr>
          <tr>
            <td className="border border-gray-400 px-2 py-1 bg-gray-100 font-bold">연락처</td>
            <td className="border border-gray-400 px-2 py-1">{c?.phone ?? '010-1234-5678'}</td>
          </tr>
        </tbody>
      </table>
      <h3 className="mb-2 font-bold text-base">신청 취지</h3>
      <p className="mb-4 text-sm leading-relaxed">
        신청인은 현재 급여소득자로서 총 채무액이 {formatKRW(c?.debts?.reduce((s, d) => s + d.amount, 0) ?? 127000000)}에 달하며,
        지급불능의 상태에 있으므로, 채무자 회생 및 파산에 관한 법률 제589조에 의하여
        개인회생절차의 개시를 신청합니다.
      </p>
      <h3 className="mb-2 font-bold text-base">신청 원인</h3>
      <p className="mb-4 text-sm leading-relaxed">
        1. 신청인은 {c?.job ?? '회사원'}으로 근무하며 월 {formatKRW(c?.income ?? 3200000)}의 급여를 받고 있습니다.<br />
        2. 가족 {c?.family ?? 3}인 가구로서 생계비를 공제하면 매월 변제에 충당할 수 있는 금액이 한정되어 있습니다.<br />
        3. 이에 채무자 회생 및 파산에 관한 법률에 따라 개인회생절차 개시를 신청합니다.
      </p>
      <div className="mt-8 text-center text-sm">
        <p>20__년 __월 __일</p>
        <p className="mt-4">위 신청인 {getClientName(c)} (인)</p>
      </div>
      <p className="mt-6 text-center text-sm font-bold">{getClientCourt(c)} 귀중</p>
    </>
  );
}

function renderRepayPlan(c: Client | null) {
  const debts = c?.debts ?? [
    { id: '1', creditor: '국민은행', name: '신용대출', type: '무담보' as const, amount: 35000000, rate: 5.5, monthly: 580000, source: 'codef' as const },
    { id: '2', creditor: '신한카드', name: '카드론', type: '무담보' as const, amount: 12000000, rate: 12.0, monthly: 320000, source: 'codef' as const },
    { id: '3', creditor: '하나은행', name: '주택담보대출', type: '담보' as const, amount: 80000000, rate: 3.8, monthly: 450000, source: 'codef' as const },
  ];
  const totalDebt = debts.reduce((s, d) => s + d.amount, 0);
  const income = c?.income ?? 3200000;
  const income2 = c?.income2 ?? 0;
  const family = c?.family ?? 3;
  const monthly = calcMonthlyPayment({
    income, income2, family,
    rent: c?.rent ?? 500000,
    education: c?.education ?? 200000,
    medical: c?.medical ?? 100000,
  });
  const totalRepay = monthly * 36;

  return (
    <>
      <h2 className="mb-4 text-center text-xl font-bold">변 제 계 획 안</h2>
      <div className="mb-4 text-sm">
        <p>채무자: {getClientName(c)}</p>
        <p>변제기간: 36개월</p>
        <p>월 변제금: {formatKRW(monthly)}</p>
        <p>총 변제금: {formatKRW(totalRepay)}</p>
      </div>
      <h3 className="mt-4 mb-2 font-bold text-base">채권자별 변제 배분표</h3>
      <table className="w-full border-collapse border border-gray-400 text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-400 px-2 py-1">채권자</th>
            <th className="border border-gray-400 px-2 py-1 text-right">채무액</th>
            <th className="border border-gray-400 px-2 py-1 text-right">비율</th>
            <th className="border border-gray-400 px-2 py-1 text-right">월 배당금</th>
            <th className="border border-gray-400 px-2 py-1 text-right">총 변제금</th>
            <th className="border border-gray-400 px-2 py-1 text-right">변제율</th>
          </tr>
        </thead>
        <tbody>
          {debts.map((d) => {
            const ratio = d.amount / totalDebt;
            const monthlyShare = Math.floor(monthly * ratio);
            const totalShare = monthlyShare * 36;
            const repayRate = ((totalShare / d.amount) * 100).toFixed(1);
            return (
              <tr key={d.id}>
                <td className="border border-gray-400 px-2 py-1">{d.creditor}</td>
                <td className="border border-gray-400 px-2 py-1 text-right">{formatKRW(d.amount)}</td>
                <td className="border border-gray-400 px-2 py-1 text-right">{(ratio * 100).toFixed(1)}%</td>
                <td className="border border-gray-400 px-2 py-1 text-right">{formatKRW(monthlyShare)}</td>
                <td className="border border-gray-400 px-2 py-1 text-right">{formatKRW(totalShare)}</td>
                <td className="border border-gray-400 px-2 py-1 text-right">{repayRate}%</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="font-bold bg-gray-50">
            <td className="border border-gray-400 px-2 py-1">합계</td>
            <td className="border border-gray-400 px-2 py-1 text-right">{formatKRW(totalDebt)}</td>
            <td className="border border-gray-400 px-2 py-1 text-right">100%</td>
            <td className="border border-gray-400 px-2 py-1 text-right">{formatKRW(monthly)}</td>
            <td className="border border-gray-400 px-2 py-1 text-right">{formatKRW(totalRepay)}</td>
            <td className="border border-gray-400 px-2 py-1 text-right">{((totalRepay / totalDebt) * 100).toFixed(1)}%</td>
          </tr>
        </tfoot>
      </table>
      <div className="mt-8 text-center text-sm">
        <p>위와 같이 변제계획안을 제출합니다.</p>
        <p className="mt-4">신청인 {getClientName(c)} (인)</p>
      </div>
      <p className="mt-6 text-center text-sm font-bold">{getClientCourt(c)} 귀중</p>
    </>
  );
}

const RENDERERS: Record<DocType, (c: Client | null) => React.ReactNode> = {
  debt_list: renderDebtList,
  asset_list: renderAssetList,
  income_list: renderIncomeList,
  application: renderApplication,
  repay_plan: renderRepayPlan,
};

export default function DocPreview({ docType, clientData }: DocPreviewProps) {
  const render = RENDERERS[docType];
  return (
    <div className="mx-auto max-w-[210mm] bg-white text-black p-10 shadow-lg print:shadow-none print:p-0" style={{ minHeight: '297mm' }}>
      {render(clientData)}
    </div>
  );
}
