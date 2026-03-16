import React from 'react';
import type { DocType } from '@/types/document';
import type { Client, StatementData } from '@/types/client';
import type { Office } from '@/store/authStore';
import { formatPhone } from '@/utils/formatter';
import { calcMonthlyPayment, calcLivingCost, getMedianIncome } from '@/utils/calculator';
import { findCreditor } from '@/utils/creditorDirectory';

interface DocPreviewProps {
  docType: DocType;
  clientData: Client | null;
  office?: Office | null;
}

/* ─── 공통 스타일 (법원 간이양식 기준) ─── */
const today = new Date();
const yr = today.getFullYear();

/* 법원 양식: 얇은 검정 테두리, 배경색 없음
   나눔명조 400/700/800 — Google Fonts에서 로드 */
const tbl = 'w-full border-collapse text-[11.5pt]';
const tblOuter = `${tbl}`;
const td = 'border border-black px-2 py-[3px] text-[11pt] align-middle';
const th = `${td} font-bold text-center`;
const tdR = `${td} text-right`;
const tdC = `${td} text-center`;

function val(v: string | number | undefined | null, fallback = ''): string {
  if (v === undefined || v === null || v === '') return fallback;
  return String(v);
}

function num(v: number | undefined | null): string {
  if (!v) return '';
  return new Intl.NumberFormat('ko-KR').format(v);
}

/** 법원 양식 번호 표기 — 우측 정렬 */
function formLabel(label: string) {
  return <p className="text-right text-[10.5pt] mb-2" style={{ letterSpacing: '0.02em' }}>[{label}]</p>;
}

/** 법원 양식 제목 — 가운데 굵게, 진한 명조 */
function formTitle(title: string) {
  return (
    <h2
      className="mb-8 text-center font-extrabold"
      style={{
        fontSize: '18pt',
        letterSpacing: '0.35em',
        fontWeight: 800,
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {title}
    </h2>
  );
}

/** 서명란 (법원 양식 하단) */
function signatureBlock(court: string, name: string, role = '채무자', labelSuffix = '(서명 또는 날인)') {
  return (
    <>
      <div className="mt-14 text-center" style={{ fontSize: '11.5pt', letterSpacing: '0.04em' }}>
        <p className="mb-10">{yr}  .{' '}{' '} .{' '}{' '} .</p>
        <p className="mb-2">
          {role}{'　　'}
          <span className="inline-block min-w-[100px] mx-1">{val(name)}</span>
          {'　　'}{labelSuffix}
        </p>
      </div>
      <p className="mt-10 text-right font-bold pr-4" style={{ fontSize: '13pt', letterSpacing: '0.05em' }}>{court} 귀중</p>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────
   간이양식 1: 개인회생절차 개시신청서
   ──────────────────────────────────────────────────────────────────── */
function renderApplication(c: Client | null, office?: Office | null) {
  const name = c?.name ?? '';
  const ssn = c?.ssn ?? '';
  const address = c?.address ?? '';
  const zonecode = c?.zonecode ?? '';
  const phone = c?.phone ? formatPhone(c.phone) : '';
  const court = c?.court ?? '○○법원';
  const officeTitle = office?.type === 'lawyer' ? '변호사' : '법무사';
  const agentName = office?.rep ? `${officeTitle} ${office.rep}` : '';
  const agentAddress = office?.address ?? '';
  const agentPhone = office?.phone ? formatPhone(office.phone) : '';
  const agentEmail = office?.email ?? '';

  /* 밑줄 빈칸 */
  const blank = (w = 80) => <span className="inline-block border-b border-black" style={{ minWidth: w }}>&nbsp;</span>;

  return (
    <>
      {formLabel('간이양식 1')}
      {formTitle('개인회생절차 개시신청서')}

      {/* ── 신청인 테이블 ── */}
      <table className={tblOuter}>
        <colgroup>
          <col style={{ width: 38 }} />
          <col style={{ width: 105 }} />
          <col />
          <col style={{ width: 100 }} />
          <col style={{ width: '22%' }} />
        </colgroup>
        <tbody>
          <tr>
            <td className={th} rowSpan={4} style={{ writingMode: 'vertical-lr', letterSpacing: '0.2em', padding: '8px 4px' }}>
              신청인
            </td>
            <td className={th}>성　　명</td>
            <td className={td}>{val(name)}</td>
            <td className={th}>주민등록번호</td>
            <td className={td}>{val(ssn)}</td>
          </tr>
          <tr>
            <td className={th}>주민등록상<br />주소</td>
            <td className={td} colSpan={2}>{val(address)}</td>
            <td className={td}>우편번호: {zonecode}</td>
          </tr>
          <tr>
            <td className={th}>현 주 소</td>
            <td className={td} colSpan={2}>{val(address)}</td>
            <td className={td}>우편번호: {zonecode}</td>
          </tr>
          <tr>
            <td className={th}>전화번호<br />(집·직장)</td>
            <td className={td}></td>
            <td className={th}>전화번호<br />(휴대전화)</td>
            <td className={td}>{val(phone)}</td>
          </tr>
        </tbody>
      </table>

      {/* ── 대리인 테이블 ── */}
      <table className={tblOuter} style={{ marginTop: -1 }}>
        <colgroup>
          <col style={{ width: 38 }} />
          <col style={{ width: 105 }} />
          <col />
          <col style={{ width: 100 }} />
          <col style={{ width: '22%' }} />
        </colgroup>
        <tbody>
          <tr>
            <td className={th} rowSpan={4} style={{ writingMode: 'vertical-lr', letterSpacing: '0.2em', padding: '8px 4px' }}>
              대리인
            </td>
            <td className={th}>성　　명</td>
            <td className={td} colSpan={3}>{val(agentName)}</td>
          </tr>
          <tr>
            <td className={th}>사무실 주소</td>
            <td className={td} colSpan={2}>{val(agentAddress)}</td>
            <td className={td}>우편번호: {zonecode}</td>
          </tr>
          <tr>
            <td className={th}>전화번호<br />(사무실)</td>
            <td className={td} colSpan={3}>{val(agentPhone)}</td>
          </tr>
          <tr>
            <td className={th}>이-메일 주소</td>
            <td className={td}>{val(agentEmail)}</td>
            <td className={th}>팩스번호</td>
            <td className={td}></td>
          </tr>
        </tbody>
      </table>

      {/* ── 관련 사건 안내 (연한 하늘색 박스) ── */}
      <div className="border border-black p-3 leading-relaxed" style={{ marginTop: -1, backgroundColor: '#eef7ff', fontSize: '10pt' }}>
        <p className="indent-2">
          주채무자가(또는 보증채무자가, 연대채무자가, 배우자가) 이미 귀 법원에 파산절차 또는 개인회생절차 개시신청을 하였으므로 그 사실을 아래와 같이 기재합니다.
        </p>
        <table className={tblOuter} style={{ marginTop: 8 }}>
          <tbody>
            <tr>
              <td className={th} style={{ width: 100 }}>성　　명</td>
              <td className={td}></td>
              <td className={th} style={{ width: 100 }}>사건번호</td>
              <td className={td}></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── 신 청 취 지 ── */}
      <h3 className="mt-10 mb-4 text-center font-extrabold" style={{ fontSize: '14pt', letterSpacing: '0.6em', fontWeight: 800 }}>신 청 취 지</h3>
      <p className="leading-relaxed text-center indent-4" style={{ fontSize: '11.5pt' }}>
        「신청인에 대하여 개인회생절차를 개시한다.」라는 결정을 구합니다.
      </p>

      {/* ── 신 청 이 유 ── */}
      <h3 className="mt-10 mb-4 text-center font-extrabold" style={{ fontSize: '14pt', letterSpacing: '0.6em', fontWeight: 800 }}>신 청 이 유</h3>
      <div style={{ fontSize: '10.5pt', lineHeight: 2.2 }}>
        <p className="text-justify indent-2">
          1. 신청인은 첨부한 개인회생채권자목록 기재와 같은 채무를 부담하고 있으나, 수입 및 재산이 별지 수입 및 지출에 관한 목록과 재산목록에 기재된 바와 같으므로,파산의 원인사실이 발생하였습니다(파산의 원인사실이 생길 염려가 있습니다.).
        </p>
        <p className="mt-4 text-justify indent-2">
          □　신청인은 정기적이고 확실한 수입을 얻을 것으로 예상되고, 또한 채무자 회생 및 파산에 관한 법률 제595조에 해당하는 개시신청 기각사유는 없습니다(<u>급여소득자의 경우</u>).
        </p>
        <p className="mt-4 text-justify indent-2">
          □　신청인은 부동산임대소득·사업소득·농업소득·임업소득 그 밖에 이와 유사한 수입을 장래에 계속적으로 또는 반복하여 얻을 것으로 예상되고, 또한 채무자 회생 및 파산에 관한 법률 제595조에 해당하는 개시신청 기각사유는 없습니다(<u>영업소득자의 경우</u>).
        </p>
        <p className="mt-4 text-justify indent-2">
          2. 신청인은 각 회생채권자에 대한 채무 전액의 변제가 곤란하므로, 그 일부를 분할하여 지급할 계획입니다. 즉 현시점에서 계획하고 있는 변제예정액은 {blank(50)} 개월간 월 {blank(90)}원씩이고, 이 변제의 준비 및 절차비용지급의 준비를 위하여, 개시결정이 내려지는 경우 {blank(60)}을 제1회로 하여, 이후 매월 {blank(50)}에 개시결정 시 통지되는 개인회생위원의 은행계좌에 동액의 금전을 입금하겠습니다.
        </p>
        <p className="mt-4 text-justify indent-2">
          3. 이 사건 개인회생절차에서 변제계획이 불인가될 경우 불인가 결정 시까지의 적립금을 반환 받을 신청인의 예금계좌는 {blank(60)} 은행 {blank(120)}입니다.
        </p>
        <p className="mt-4 text-justify indent-2">
          4. <strong>개인회생채권자목록 부본</strong>(개인회생채권자목록상의 채권자 수 ＋ 2통)은 개시결정 전 회생위원의 지시에 따라 지정하는 일자까지 반드시 제출하겠습니다.
        </p>
      </div>

      {/* ── 첨 부 서 류 ── */}
      <h3 className="mt-10 mb-4 text-center font-extrabold" style={{ fontSize: '14pt', letterSpacing: '0.6em', fontWeight: 800 }}>첨 부 서 류</h3>
      <div style={{ fontSize: '10.5pt', lineHeight: 2 }}>
        <p className="indent-2">1. 개인회생채권자목록 1통</p>
        <p className="indent-2">2. 재산목록 1통</p>
        <p className="indent-2">3. 수입 및 지출에 관한 목록 1 통</p>
        <p className="indent-2">4. 진술서 1통</p>
        <p className="indent-2">5. 수입인지 1통(30,000원)</p>
        <p className="indent-2">6. 송달료납부서 1통(송달료 10회분 ＋ (채권자 수 × 8회분))</p>
        <p className="indent-2">7. 신청인 본인의 예금계좌 사본 1통(대리인의 예금계좌 사본 아님)</p>
        <p className="indent-2">8. 위임장 1통(대리인을 통해 신청하는 경우)</p>
      </div>

      {/* ── 휴대전화를 통한 정보 수신 신청서 ── */}
      <div className="mt-8 border border-black p-4 leading-relaxed" style={{ fontSize: '10.5pt' }}>
        <p className="font-bold text-center mb-3" style={{ fontSize: '11.5pt', fontWeight: 700 }}>휴대전화를 통한 정보 수신 신청서</p>
        <p className="text-justify indent-4">
          위 사건에 관한 개인회생절차 개시결정, 월 변제액 3개월분 연체의 정보를 예납의무자가 납부한 송달료 잔액 범위 내에서 휴대전화를 통하여 알려주실 것을 신청합니다.
        </p>
        <p className="mt-3">■ <strong>휴대전화번호</strong> : {val(phone)}</p>

        <p className="mt-6 text-center text-[10.5pt]">{yr}{'  '}.{'  '}{' '}.{'  '}{' '}.</p>
        <p className="mt-4 text-center text-[10.5pt]">
          신청인{'  '}채무자{'　　　　　　　　'}(날인 또는 서명)
        </p>

        <p className="mt-6 text-[9pt] text-justify indent-2">
          ※ 개인회생절차 개시결정이 있거나 변제계획 인가결정 후 월 변제액 3개월분 이상 연체 시 위 휴대전화로 문자메시지가 발송됩니다.
        </p>
        <p className="text-[9pt] text-justify indent-2">
          ※ 문자메시지 서비스 이용 금액은 메시지 1건당 17원씩 납부된 송달료에서 지급됩니다(송달료가 부족하면 문자메시지가 발송되지 않습니다.). 추후 서비스 대상 정보, 이용 금액 등이 변동될 수 있습니다.
        </p>
      </div>

      {/* ── 최종 서명란 ── */}
      <div className="mt-14 text-center text-[11pt]">
        <p>{yr}{'  '}.{'  '}{' '}.{'  '}{' '}.</p>
        <p className="mt-10">
          신청인{'　　　　　　　　　'}(서명 또는 날인)
        </p>
      </div>
      <p className="mt-10 text-right text-[13pt] font-bold pr-4">{court} 귀중</p>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────
   간이양식 1-1: 개인회생채권자목록
   ──────────────────────────────────────────────────────────────────── */
function renderDebtList(c: Client | null) {
  const debts = c?.debts ?? [];
  const totalPrincipal = debts.reduce((s, d) => s + d.amount, 0);
  const totalInterest = debts.reduce((s, d) => s + (d.overdueInterest ?? 0), 0);
  const name = c?.name ?? '';
  const court = c?.court ?? '○○법원';

  return (
    <>
      {/* 상단 서류번호 좌/우 */}
      <div className="flex justify-between text-[10.5pt] mb-1">
        <span>[신청서 첨부서류 1]</span>
        <span>[간이양식 1-1]</span>
      </div>
      <h2 className="mb-4 text-center font-extrabold" style={{ fontSize: '18pt', letterSpacing: '0.35em', fontWeight: 800 }}>개인회생채권자목록 간이양식</h2>

      {/* 산정기준일 */}
      <p className="text-right text-[10.5pt] mb-3">산정기준일:{'　　'}.{'　　'}.{'　　'}.</p>

      {/* 사건번호 / 채무자 / 합계 */}
      <table className={tblOuter + ' mb-4'}>
        <tbody>
          <tr>
            <td className={td} style={{ width: '35%' }}>
              <span className="mr-1">20</span>{'　'}개회
            </td>
            <td className={td}>채무자: {val(name)}</td>
            <td className={td} style={{ width: '40%' }}>
              채권현재액 합계:{'　　　　　　　　　　'}{totalPrincipal + totalInterest > 0 ? `${num(totalPrincipal + totalInterest)}` : ''}{'　'}원
            </td>
          </tr>
        </tbody>
      </table>

      {/* 메인 테이블 — 5열 구조 */}
      <table className={tblOuter}>
        <colgroup>
          <col style={{ width: 30 }} />   {/* A: 채권번호 */}
          <col style={{ width: 42 }} />   {/* B: 채권자 */}
          <col style={{ width: '22%' }} /> {/* C: 채권의 원인 / 원금 / 이자 */}
          <col style={{ width: 65 }} />    {/* D: □담보□무담보 */}
          <col />                          {/* E: 주소및전화번호 / 산정근거 */}
        </colgroup>
        {/* ── 헤더 3행 ── */}
        <thead>
          <tr>
            <th className={th} rowSpan={3} style={{ writingMode: 'vertical-lr', letterSpacing: '0.3em', padding: '8px 2px' }}>
              채권번호
            </th>
            <th className={th} rowSpan={3} style={{ writingMode: 'vertical-lr', letterSpacing: '0.2em', padding: '8px 2px' }}>
              채<br />권<br />자
            </th>
            <td className={th}>채권의 원인</td>
            <td className={td} style={{ textAlign: 'left', fontSize: 11 }}>□담보<br />□무담보</td>
            <td className={th}>주소 및 전화번호</td>
          </tr>
          <tr>
            <td className={th}>채권현재액(원금)</td>
            <td className={th} colSpan={2}>채권현재액(원금) 산정근거</td>
          </tr>
          <tr>
            <td className={th}>채권현재액(이자)</td>
            <td className={th} colSpan={2}>채권현재액(이자) 산정근거</td>
          </tr>
        </thead>
        <tbody>
          {debts.length === 0 ? (
            /* ── 빈 채권자 슬롯 4개 ── */
            <>
              {[1, 2, 3, 4].map(n => (
                <React.Fragment key={n}>
                  {/* 행1: 담보 + 주소/전화/팩스 */}
                  <tr>
                    <td className={tdC} rowSpan={3}>{n}</td>
                    <td className={td} rowSpan={3}></td>
                    <td className={td} colSpan={3}>
                      <div className="flex">
                        <span className="shrink-0" style={{ width: 65 }}>□담보<br />□무담보</span>
                        <span className="flex-1">(주소)<br />(전화){'　　　　　　　　　'}(팩스)</span>
                      </div>
                    </td>
                  </tr>
                  {/* 행2: 원금 (점선) */}
                  <tr>
                    <td className={td} style={{ borderTop: 'none', borderBottom: '1px dotted #aaa' }}></td>
                    <td className={td} colSpan={2} style={{ borderTop: 'none', borderBottom: '1px dotted #aaa' }}></td>
                  </tr>
                  {/* 행3: 이자 (점선) */}
                  <tr>
                    <td className={td} style={{ borderTop: 'none', borderBottom: '1px dotted #aaa' }}></td>
                    <td className={td} colSpan={2} style={{ borderTop: 'none', borderBottom: '1px dotted #aaa' }}></td>
                  </tr>
                </React.Fragment>
              ))}
            </>
          ) : (
            debts.map((d, i) => {
              const ci = findCreditor(d.creditor);
              const cAddr = d.creditorAddress || ci?.address || '';
              const cPhone = d.creditorPhone || ci?.phone || '';
              const cFax = d.creditorFax || ci?.fax || '';
              return (
                <React.Fragment key={d.id}>
                  {/* 행1: 담보/무담보 + 주소·전화·팩스 */}
                  <tr>
                    <td className={tdC} rowSpan={3}>{i + 1}</td>
                    <td className={td} rowSpan={3}>{d.creditor}</td>
                    <td className={td} colSpan={3}>
                      <div className="flex">
                        <span className="shrink-0" style={{ width: 65 }}>
                          {d.type === '담보' ? '☑담보' : '□담보'}<br />
                          {d.type !== '담보' ? '☑무담보' : '□무담보'}
                        </span>
                        <span className="flex-1">
                          (주소) {cAddr}<br />
                          (전화) {cPhone}{'　　　　　'}(팩스) {cFax}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {/* 행2: 원금 + 산정근거 */}
                  <tr>
                    <td className={td}>{num(d.amount)}원</td>
                    <td className={td} colSpan={2}>
                      <span className="text-[9.5pt]">
                        {d.originalDate ? `${d.originalDate}자 ` : ''}
                        {d.name}
                        {d.originalAmount ? ` ${num(d.originalAmount)}원` : ''}
                      </span>
                    </td>
                  </tr>
                  {/* 행3: 이자 + 산정근거 */}
                  <tr>
                    <td className={td}>{d.overdueInterest ? `${num(d.overdueInterest)}원` : ''}</td>
                    <td className={td} colSpan={2}></td>
                  </tr>
                </React.Fragment>
              );
            })
          )}
        </tbody>
      </table>

      <p className="mt-4 text-[9pt] text-center">※ 채권자가 많아 한 장에 다 적을 수 없는 경우는 다음 장에 계속 적어야 합니다.</p>

      {signatureBlock(court, name)}
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────
   간이양식 1-2: 재산목록
   원본 법원 양식과 동일한 5열 구조:
   명칭 | 금액 | 압류 | 비고-라벨 | 비고-데이터
   ──────────────────────────────────────────────────────────────────── */
function renderAssetList(c: Client | null) {
  const assets = c?.assets ?? [];
  const name = c?.name ?? '';
  const court = c?.court ?? '○○회생법원';

  const cash = assets.filter(a => a.type === '기타' && a.name.includes('현금'));
  const deposits = assets.filter(a => a.type === '예금');
  const insurance = assets.filter(a => a.type === '보험');
  const vehicles = assets.filter(a => a.type === '차량');
  const realEstate = assets.filter(a => a.type === '부동산');
  const others = assets.filter(a => a.type === '기타' && !a.name.includes('현금'));
  const rentalDeposits = assets.filter(a => a.name.includes('임차') || a.name.includes('전세') || a.name.includes('보증금'));

  const total = assets.reduce((s, a) => s + a.value, 0);

  /* 셀 공통 */
  const B = 'border border-black';  // 테두리
  const cName = `${B} px-2 py-1 font-bold text-center align-middle`;
  const cAmt  = `${B} px-2 py-1 text-right align-middle`;
  const cSeiz = `${B} px-1 py-1 text-center align-middle`;
  const cLbl  = `${B} px-2 py-1 align-middle`;           // 비고-라벨
  const cVal  = `${B} px-2 py-1 align-middle`;           // 비고-데이터

  const cashTotal = cash.reduce((s, a) => s + a.rawValue, 0);
  const depositTotal = deposits.reduce((s, a) => s + a.rawValue, 0);
  const insuranceTotal = insurance.reduce((s, a) => s + (a.meta?.surrenderValue ?? a.rawValue), 0);
  const rentalTotal = rentalDeposits.reduce((s, a) => s + a.rawValue, 0);
  const reTotal = realEstate.reduce((s, a) => s + a.value, 0);
  const otherTotal = others.reduce((s, a) => s + a.rawValue, 0);

  return (
    <>
      <div className="flex justify-between mb-0.5" style={{ fontSize: '10pt' }}>
        <span>[신청서 첨부서류 2]</span>
        <span>[간이양식 1-2]</span>
      </div>
      {formTitle('재 산 목 록 간 이 양 식')}

      <table className="w-full border-collapse" style={{ fontSize: '10.5pt' }}>
        <colgroup>
          <col style={{ width: 115 }} />  {/* 명칭 */}
          <col style={{ width: 95 }} />   {/* 금액 */}
          <col style={{ width: 40 }} />   {/* 압류 */}
          <col style={{ width: 90 }} />   {/* 비고-라벨 */}
          <col />                          {/* 비고-데이터 */}
        </colgroup>

        {/* ═══ 헤더 ═══ */}
        <thead>
          <tr>
            <th className={`${B} px-2 py-1 font-bold text-center`}>명{'　　'}칭</th>
            <th className={`${B} px-2 py-1 font-bold text-center`}>금액 또는<br />시가(단위:<br />원)</th>
            <th className={`${B} px-1 py-1 font-bold text-center`}>압류<br />등<br />유무</th>
            <th className={`${B} px-2 py-1 font-bold text-center`} colSpan={2}>비{'　　　'}고</th>
          </tr>
        </thead>
        <tbody>

          {/* ═══ 1. 현금 ═══ */}
          <tr>
            <td className={cName}>현금</td>
            <td className={cAmt}>{cashTotal > 0 ? num(cashTotal) : ''}</td>
            <td className={cSeiz}></td>
            <td className={cLbl}></td>
            <td className={cVal}></td>
          </tr>

          {/* ═══ 2. 예금 — 3 서브행 ═══ */}
          <tr>
            <td className={cName} rowSpan={3} style={{ verticalAlign: 'middle' }}>예금</td>
            <td className={cAmt} rowSpan={3} style={{ verticalAlign: 'middle' }}>{depositTotal > 0 ? num(depositTotal) : ''}</td>
            <td className={cSeiz} rowSpan={3}></td>
            <td className={cLbl}>금융기관명</td>
            <td className={cVal}>{deposits.map(a => a.meta?.bankName ?? a.name).join(', ')}</td>
          </tr>
          <tr>
            <td className={cLbl}>계좌번호</td>
            <td className={cVal}>{deposits.map(a => a.meta?.accountLast4 ? `****-${a.meta.accountLast4}` : '').join(', ')}</td>
          </tr>
          <tr>
            <td className={cLbl}>잔고</td>
            <td className={cVal}>{deposits.map(a => num(a.rawValue) + '원').join(', ')}</td>
          </tr>

          {/* ═══ 3. 보험 — 3 서브행 ═══ */}
          <tr>
            <td className={cName} rowSpan={3} style={{ verticalAlign: 'middle' }}>보험</td>
            <td className={cAmt} rowSpan={3} style={{ verticalAlign: 'middle' }}>{insuranceTotal > 0 ? num(insuranceTotal) : ''}</td>
            <td className={cSeiz} rowSpan={3}></td>
            <td className={cLbl}>보험회사명</td>
            <td className={cVal}>{insurance.map(a => a.meta?.insurerName ?? a.name).join(', ')}</td>
          </tr>
          <tr>
            <td className={cLbl}>증권번호</td>
            <td className={cVal}>{insurance.map(a => a.meta?.insuranceType ?? '').join(', ')}</td>
          </tr>
          <tr>
            <td className={cLbl}>해약반환금</td>
            <td className={cVal}>{insurance.map(a => num(a.meta?.surrenderValue ?? a.rawValue) + '원').join(', ')}</td>
          </tr>

          {/* ═══ 4. 자동차 ═══ */}
          <tr>
            <td className={cName}>자동차<br />(오토바이 포함)</td>
            <td className={cAmt}>{vehicles.reduce((s, a) => s + a.rawValue, 0) > 0 ? num(vehicles.reduce((s, a) => s + a.rawValue, 0)) : ''}</td>
            <td className={cSeiz}></td>
            <td className={cLbl}></td>
            <td className={cVal}>
              {vehicles.map(a => {
                const parts: string[] = [];
                if (a.meta?.model ?? a.name) parts.push(a.meta?.model ?? a.name);
                if (a.meta?.year) parts.push(`${a.meta.year}년식`);
                if (a.meta?.plate) parts.push(a.meta.plate);
                return parts.join(' ');
              }).join(', ')}
            </td>
          </tr>

          {/* ═══ 5. 임차보증금 — 3 서브행 ═══ */}
          <tr>
            <td className={cName} rowSpan={3} style={{ verticalAlign: 'top', paddingTop: 6 }}>
              임차보증금<br />
              <span className="font-normal" style={{ fontSize: '8.5pt', lineHeight: 1.3, display: 'inline-block', marginTop: 2 }}>
                (반환받을 금액을<br />금액란에 적는다.)
              </span>
            </td>
            <td className={cAmt} rowSpan={3} style={{ verticalAlign: 'middle' }}>{rentalTotal > 0 ? num(rentalTotal) : ''}</td>
            <td className={cSeiz} rowSpan={3}></td>
            <td className={cLbl}>임차물건</td>
            <td className={cVal}>{rentalDeposits.map(a => a.meta?.address ?? a.name).join(', ')}</td>
          </tr>
          <tr>
            <td className={cLbl}>보증금 및<br />월세</td>
            <td className={cVal}>{rentalDeposits.map(a => num(a.rawValue) + '원').join(', ')}</td>
          </tr>
          <tr>
            <td className={cLbl}>차이 나는<br />사유</td>
            <td className={cVal}></td>
          </tr>

          {/* ═══ 6. 부동산 — 5 서브행 ═══ */}
          <tr>
            <td className={cName} rowSpan={5} style={{ verticalAlign: 'top', paddingTop: 6 }}>
              부동산<br />
              <span className="font-normal" style={{ fontSize: '8.5pt', lineHeight: 1.3, display: 'inline-block', marginTop: 2 }}>
                (환가예상액에서<br />피담보채권을 뺀<br />금액을 금액란에<br />적음)
              </span>
            </td>
            <td className={cAmt} rowSpan={5} style={{ verticalAlign: 'middle' }}>{reTotal > 0 ? num(reTotal) : ''}</td>
            <td className={cSeiz} rowSpan={5}></td>
            <td className={cLbl}>소재지, 면적</td>
            <td className={cVal}>{realEstate.map(a => (a.meta?.address ?? '') + (a.meta?.area ? ` ${a.meta.area}㎡` : '')).join(', ')}</td>
          </tr>
          <tr>
            <td className={cLbl}>부동산의<br />종류</td>
            <td className={cVal}>토지({'　　'}), 건물({'　　'}), 집합건물({'　　'})</td>
          </tr>
          <tr>
            <td className={cLbl}>권리의 종류</td>
            <td className={cVal}>{realEstate.length > 0 ? '소유권' : ''}</td>
          </tr>
          <tr>
            <td className={cLbl}>환가예상액</td>
            <td className={cVal}>{realEstate.map(a => num(a.rawValue) + '원').join(', ')}</td>
          </tr>
          <tr>
            <td className={cLbl}>담보권<br />설정된 경우<br />그 종류 및<br />담보액</td>
            <td className={cVal}>{realEstate.filter(a => a.mortgage > 0).map(a => `근저당 ${num(a.mortgage)}원`).join(', ')}</td>
          </tr>

          {/* ═══ 7. 사업용 설비 — 3 서브행 ═══ */}
          <tr>
            <td className={cName} rowSpan={3} style={{ verticalAlign: 'middle' }}>
              사업용 설비,<br />재고품, 비품 등
            </td>
            <td className={cAmt} rowSpan={3} style={{ verticalAlign: 'middle' }}></td>
            <td className={cSeiz} rowSpan={3}></td>
            <td className={cLbl}>품목, 개수</td>
            <td className={cVal}></td>
          </tr>
          <tr>
            <td className={cLbl}>구입 시기</td>
            <td className={cVal}></td>
          </tr>
          <tr>
            <td className={cLbl}>평가액</td>
            <td className={cVal}></td>
          </tr>

          {/* ═══ 8. 대여금 채권 — 2 서브행 ═══ */}
          <tr>
            <td className={cName} rowSpan={2} style={{ verticalAlign: 'middle' }}>대여금 채권</td>
            <td className={cAmt} rowSpan={2} style={{ verticalAlign: 'middle' }}></td>
            <td className={cSeiz} rowSpan={2}></td>
            <td className={cLbl}>상대방 채무자 1:</td>
            <td className={cVal} style={{ textAlign: 'right' }}>□ 소명자료 별첨</td>
          </tr>
          <tr>
            <td className={cLbl}>상대방 채무자 2:</td>
            <td className={cVal} style={{ textAlign: 'right' }}>□ 소명자료 별첨</td>
          </tr>

          {/* ═══ 9. 매출금 채권 — 2 서브행 ═══ */}
          <tr>
            <td className={cName} rowSpan={2} style={{ verticalAlign: 'middle' }}>매출금 채권</td>
            <td className={cAmt} rowSpan={2} style={{ verticalAlign: 'middle' }}></td>
            <td className={cSeiz} rowSpan={2}></td>
            <td className={cLbl}>상대방 채무자 1:</td>
            <td className={cVal} style={{ textAlign: 'right' }}>□ 소명자료 별첨</td>
          </tr>
          <tr>
            <td className={cLbl}>상대방 채무자 2:</td>
            <td className={cVal} style={{ textAlign: 'right' }}>□ 소명자료 별첨</td>
          </tr>

          {/* ═══ 10. 예상 퇴직금 ═══ */}
          <tr>
            <td className={cName}>예상 퇴직금</td>
            <td className={cAmt}></td>
            <td className={cSeiz}></td>
            <td className={cLbl}>근무처:</td>
            <td className={cVal}>{c?.job ?? ''}{'　　　'}(압류할 수 없는 재산{'　　　　'}원 제외)</td>
          </tr>

          {/* ═══ 11. 기타 ═══ */}
          <tr>
            <td className={cName}>기타 ({'　　　　'})</td>
            <td className={cAmt}>{otherTotal > 0 ? num(otherTotal) : ''}</td>
            <td className={cSeiz}></td>
            <td className={cLbl}></td>
            <td className={cVal}>
              {others.length > 0
                ? others.map(a => `${a.name} ${num(a.rawValue)}원`).join(', ')
                : ''}
            </td>
          </tr>
        </tbody>

        {/* ═══ 하단: 합계 / 면제재산 / 청산가치 ═══ */}
        <tfoot>
          <tr>
            <td className={`${cName}`}>합{'　　'}계</td>
            <td className={`${cAmt} font-bold`}>{num(total)}</td>
            <td className={cSeiz}></td>
            <td className={cLbl}></td>
            <td className={cVal}></td>
          </tr>
          <tr>
            <td className={`${cName}`}>면제재산 결정신청<br />금액</td>
            <td className={cAmt}></td>
            <td className={cSeiz}></td>
            <td className={cLbl}></td>
            <td className={cVal}>면제재산 결정신청 내용:</td>
          </tr>
          <tr>
            <td className={`${cName}`}>청산가치</td>
            <td className={`${cAmt} font-bold`}>{num(total)}</td>
            <td className={cSeiz}></td>
            <td className={cLbl}></td>
            <td className={cVal}></td>
          </tr>
        </tfoot>
      </table>

      <p className="mt-8 text-center" style={{ fontSize: '11pt' }}>위와 같이 재산목록을 제출합니다.</p>
      {signatureBlock(court, name)}
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────
   간이양식 1-3: 수입 및 지출에 관한 목록
   ──────────────────────────────────────────────────────────────────── */
function renderIncomeList(c: Client | null) {
  const name = c?.name ?? '';
  const court = c?.court ?? '○○회생법원';
  const income = c?.income ?? 0;
  const income2 = c?.income2 ?? 0;
  const family = c?.family ?? 1;
  const rent = c?.rent ?? 0;
  const education = c?.education ?? 0;
  const medical = c?.medical ?? 0;
  const food = c?.food ?? 0;
  const transport = c?.transport ?? 0;
  const telecom = c?.telecom ?? 0;
  const insurancePremium = c?.insurancePremium ?? 0;
  const isEmployed = c?.jobType === 'employed' || c?.jobType === 'daily';
  const livingCost = calcLivingCost(family);
  const medianIncome = getMedianIncome(family);
  const totalExpense = livingCost + rent + education + medical;
  const totalMonthly = income + income2;
  const annualIncome = totalMonthly * 12;
  // 실제 지출 비율 (중위소득 대비)
  const expensePercent = medianIncome > 0 ? Math.round((totalExpense / medianIncome) * 100) : 60;
  const isOver60 = totalExpense > livingCost;

  const familyMembers = c?.familyMembers ?? [];

  // 생계비 세부항목 합산 (식료품비+교통통신비 등)
  const livingSubtotal = food + transport + telecom + insurancePremium;

  return (
    <>
      <div className="flex justify-between text-[9.5pt] mb-0.5">
        <span>[신청서 첨부서류 3]</span>
        <span>[간이양식 1-3]</span>
      </div>
      {formTitle('수입 및 지출에 관한 목록 간이양식')}

      {/* ═══ I. 현재의 수입 목록 ═══ */}
      <h3 className="mb-3 font-bold" style={{ fontSize: '12.5pt', fontWeight: 700, letterSpacing: '0.05em' }}>Ⅰ. 현재의 수입 목록</h3>

      <p className="text-right text-[9.5pt] mb-1">(단위: 원)</p>
      <table className={tblOuter + ' mb-6'}>
        <tbody>
          {/* 수입 상황 4행 */}
          <tr>
            <td className={`${td} font-bold text-center`} rowSpan={4} style={{ width: 70 }}>수입 상황</td>
            <td className={`${td} text-center`} colSpan={2}>자영(상호)</td>
            <td className={td} colSpan={3}>
              {!isEmployed ? (c?.job ?? '') : ''}
            </td>
            <td className={`${td} text-center`} colSpan={2}>고용(직장명)</td>
            <td className={td} colSpan={2}>
              {isEmployed ? (c?.job ?? '') : ''}
            </td>
          </tr>
          <tr>
            <td className={`${td} text-center`} colSpan={2}>업종</td>
            <td className={td} colSpan={3}></td>
            <td className={`${td} text-center`} colSpan={2}>직위</td>
            <td className={td} colSpan={2}></td>
          </tr>
          <tr>
            <td className={`${td} text-center`} colSpan={2}>종사경력</td>
            <td className={`${td} text-center`}>{'　'}년</td>
            <td className={`${td} text-center`} colSpan={2}>{'　'}개월</td>
            <td className={`${td} text-center`}>근무 기간</td>
            <td className={td} colSpan={3}>{'　　'}년{'　'}월부터 현재까지</td>
          </tr>
          {/* 명목 헤더행 */}
          <tr>
            <td className={th} colSpan={2}>명목</td>
            <td className={th}>기간 구분</td>
            <td className={th} colSpan={2}>금액</td>
            <td className={th} colSpan={2}>연간 환산 금액</td>
            <td className={th} colSpan={2}>압류, 가압류 등 유무</td>
          </tr>
          {/* 소득 데이터 행 */}
          <tr>
            <td className={`${td} text-center`} colSpan={3}>
              {isEmployed ? '근로소득(월급여)' : '사업소득'}
            </td>
            <td className={td}>월</td>
            <td className={tdR} colSpan={2}>{num(income)}</td>
            <td className={tdR} colSpan={2}>{num(income * 12)}</td>
            <td className={tdC} colSpan={2}></td>
          </tr>
          {income2 > 0 && (
            <tr>
              <td className={`${td} text-center`} colSpan={3}>기타소득</td>
              <td className={td}>월</td>
              <td className={tdR} colSpan={2}>{num(income2)}</td>
              <td className={tdR} colSpan={2}>{num(income2 * 12)}</td>
              <td className={tdC} colSpan={2}></td>
            </tr>
          )}
          {/* 빈 행 (추가 입력용) */}
          {income2 === 0 && (
            <tr>
              <td className={td} colSpan={3}></td>
              <td className={td}></td>
              <td className={tdR} colSpan={2}></td>
              <td className={tdR} colSpan={2}></td>
              <td className={tdC} colSpan={2}></td>
            </tr>
          )}
          <tr>
            <td className={td} colSpan={3}></td>
            <td className={td}></td>
            <td className={tdR} colSpan={2}></td>
            <td className={tdR} colSpan={2}></td>
            <td className={tdC} colSpan={2}></td>
          </tr>
          {/* 합계행 */}
          <tr>
            <td className={td} colSpan={4}></td>
            <td className={`${td} text-center font-bold`} colSpan={2}>연 수입</td>
            <td className={`${tdR} font-bold`} colSpan={2}>{num(annualIncome)}</td>
            <td className={td} colSpan={2}></td>
          </tr>
          <tr>
            <td className={td} colSpan={6}></td>
            <td className={`${td} text-center font-bold`} colSpan={2}>월 평균 수입 (</td>
            <td className={`${tdR} font-bold`} colSpan={1}>{num(totalMonthly)})</td>
          </tr>
        </tbody>
      </table>

      {/* ═══ II. 변제계획 수행 시의 예상 지출 목록 ═══ */}
      <h3 className="mb-3 font-bold" style={{ fontSize: '12.5pt', fontWeight: 700, letterSpacing: '0.05em' }}>Ⅱ. 변제계획 수행 시의 예상 지출 목록</h3>

      <p className="text-[10.5pt] mb-2 leading-relaxed">
        <strong>1.</strong> 채무자가 예상하는 생계비가 보건복지부 공표 <strong>기준 중위소득의 100분의 60 이하</strong>인 경우에는
        별도의 설명 없이 아래의 괄호에 기재만 하시면 됩니다.
      </p>
      <p className="text-[10.5pt] mb-4 ml-6 leading-relaxed">
        보건복지부 공표 ({' '}<strong className="underline">{family}</strong>{' '})인 <strong>가구 기준 중위소득</strong> ({' '}<strong className="underline">{num(medianIncome)}</strong>{' '})원의{'  '}약 ({' '}<strong className="underline">{!isOver60 ? expensePercent : '　'}</strong>{' '})%인 ({' '}<strong className="underline">{!isOver60 ? num(totalExpense) : '　　'}</strong>{' '})원을 지출할 것으로 예상됩니다.
      </p>

      <p className="text-[10.5pt] mb-2 leading-relaxed">
        <strong>2.</strong> 채무자가 예상하는 생계비가 보건복지부 공표 <strong>기준 중위소득의 100분의 60을 초과</strong>하는 경우
        에는 아래의 괄호에 내역을 기재한 후 뒷면의 표와 보충 기재 사항란에 추가로 지출되는 금액
        과 사유를 구체적으로 기재하시면 됩니다.
      </p>
      <p className="text-[10.5pt] mb-6 ml-6 leading-relaxed">
        보건복지부 공표 ({' '}<strong className="underline">{family}</strong>{' '})인 <strong>가구 기준 중위소득</strong> ({' '}<strong className="underline">{num(medianIncome)}</strong>{' '})원의{'  '}약 ({' '}<strong className="underline">{isOver60 ? expensePercent : '　'}</strong>{' '})%인 ({' '}<strong className="underline">{isOver60 ? num(totalExpense) : '　　'}</strong>{' '})원을 지출할 것으로 예상됩니다.
      </p>

      {/* ═══ III. 가족관계 ═══ */}
      <h3 className="mb-3 font-bold" style={{ fontSize: '12.5pt', fontWeight: 700, letterSpacing: '0.05em' }}>Ⅲ. 가족관계</h3>

      <table className={tblOuter + ' mb-6'}>
        <thead>
          <tr>
            <th className={th} style={{ width: 55 }}>관계</th>
            <th className={th} style={{ width: 70 }}>성　명</th>
            <th className={th} style={{ width: 40 }}>연령</th>
            <th className={th}>동거 여부 및 기간</th>
            <th className={th} style={{ width: 70 }}>직　업</th>
            <th className={th} style={{ width: 65 }}>월 수입</th>
            <th className={th} style={{ width: 60 }}>재산 총액</th>
            <th className={th} style={{ width: 50 }}>부양 유무</th>
          </tr>
        </thead>
        <tbody>
          {familyMembers.length > 0 ? (
            <>
              {familyMembers.map((m, i) => (
                <tr key={i}>
                  <td className={tdC}>{m.relation}</td>
                  <td className={tdC}>{m.name}</td>
                  <td className={tdC}>{m.age}</td>
                  <td className={tdC}>동거</td>
                  <td className={tdC}>{m.hasIncome ? '' : '무직'}</td>
                  <td className={tdR}>{m.hasIncome ? '' : ''}</td>
                  <td className={tdR}></td>
                  <td className={tdC}>유</td>
                </tr>
              ))}
              {/* 빈 행 추가 (양식에 맞게) */}
              {familyMembers.length < 5 && Array.from({ length: 5 - familyMembers.length }).map((_, i) => (
                <tr key={`empty-${i}`}>
                  <td className={td}></td>
                  <td className={td}></td>
                  <td className={td}></td>
                  <td className={td}></td>
                  <td className={td}></td>
                  <td className={td}></td>
                  <td className={td}></td>
                  <td className={td}></td>
                </tr>
              ))}
            </>
          ) : (
            <>
              <tr>
                <td className={tdC}>배우자</td>
                <td className={td}></td>
                <td className={td}></td>
                <td className={td}></td>
                <td className={td}></td>
                <td className={td}></td>
                <td className={td}></td>
                <td className={td}></td>
              </tr>
              <tr>
                <td className={tdC}>자</td>
                <td className={td}></td>
                <td className={td}></td>
                <td className={td}></td>
                <td className={td}></td>
                <td className={td}></td>
                <td className={td}></td>
                <td className={td}></td>
              </tr>
              <tr>
                <td className={tdC}>자</td>
                <td className={td}></td>
                <td className={td}></td>
                <td className={td}></td>
                <td className={td}></td>
                <td className={td}></td>
                <td className={td}></td>
                <td className={td}></td>
              </tr>
              {Array.from({ length: 3 }).map((_, i) => (
                <tr key={`empty-${i}`}>
                  <td className={td}></td>
                  <td className={td}></td>
                  <td className={td}></td>
                  <td className={td}></td>
                  <td className={td}></td>
                  <td className={td}></td>
                  <td className={td}></td>
                  <td className={td}></td>
                </tr>
              ))}
            </>
          )}
        </tbody>
      </table>

      {/* ═══ 생계비 초과 시 뒷면 표 ═══ */}
      <p className="text-[10.5pt] mb-2 mt-6">
        ☞ 채무자가 예상하는 생계비가 보건복지부 공표 최저생계비의 150%를 초과하는 경우
      </p>
      <p className="text-[10.5pt] font-bold mb-2">1. 생계비의 지출 내역</p>
      <table className={tblOuter + ' mb-4'}>
        <thead>
          <tr>
            <th className={th} style={{ width: 170 }}>비　　목</th>
            <th className={th} style={{ width: 100 }}>지출 예상<br />생계비</th>
            <th className={th}>추가 지출 사유</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={td}>
              생계비<br />
              <span className="text-[9pt]">☞생계비에는 식료품비, 광열수도비, 가구집기비, 피복신발비, 교양오락비, 교통통신비, 기타 비용의 합산액을 기재합니다.</span>
            </td>
            <td className={tdR}>{livingSubtotal > 0 ? num(livingSubtotal) : ''}</td>
            <td className={td}></td>
          </tr>
          <tr>
            <td className={td}>주거비</td>
            <td className={tdR}>{rent > 0 ? num(rent) : ''}</td>
            <td className={td}></td>
          </tr>
          <tr>
            <td className={td}>의료비</td>
            <td className={tdR}>{medical > 0 ? num(medical) : ''}</td>
            <td className={td}></td>
          </tr>
          <tr>
            <td className={td}>교육비</td>
            <td className={tdR}>{education > 0 ? num(education) : ''}</td>
            <td className={td}></td>
          </tr>
          <tr>
            <td className={`${td} text-center font-bold`}>계</td>
            <td className={`${tdR} font-bold`}>{num(totalExpense)}</td>
            <td className={td}>추가비율:{'　　'}{isOver60 ? `${Math.round(((totalExpense - livingCost) / livingCost) * 100)}` : ''}%</td>
          </tr>
        </tbody>
      </table>

      <p className="text-[10.5pt] font-bold mb-2">2. 생계비 추가 지출 사유에 관한 보충 기재 사항</p>
      <div className="border border-black min-h-[150px] p-3 mb-6 text-[10.5pt]">
      </div>

      <p className="mt-8 text-center text-[11pt]">위와 같이 수입 및 지출에 관한 목록을 제출합니다.</p>
      {signatureBlock(court, name)}
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────
   간이양식 2: 변제계획안 + 변제예정액표
   ──────────────────────────────────────────────────────────────────── */
function renderRepayPlan(c: Client | null, office?: Office | null) {
  const debts = c?.debts ?? [];
  const name = c?.name ?? '';
  const income = c?.income ?? 0;
  const income2 = c?.income2 ?? 0;
  const family = c?.family ?? 1;
  const rent = c?.rent ?? 0;
  const education = c?.education ?? 0;
  const medical = c?.medical ?? 0;
  const monthly = c ? calcMonthlyPayment({ income, income2, family, rent, education, medical }) : 0;
  const totalExpenseVal = (income + income2) - monthly;
  const periodMonths = c?.repayPeriodMonths ?? 36;
  const totalDebt = debts.reduce((s, d) => s + d.amount, 0);

  const trusteeMonthly = Math.round(monthly * 0.01);
  const actualMonthly = monthly - trusteeMonthly;
  const totalActual = actualMonthly * periodMonths;

  const creditorShares = debts.map(d => {
    const ratio = totalDebt > 0 ? d.amount / totalDebt : 0;
    const monthlyShare = Math.ceil(actualMonthly * ratio);
    const totalShare = monthlyShare * periodMonths;
    return { ...d, ratio, monthlyShare, totalShare };
  });

  const monthlyShareSum = creditorShares.reduce((s, d) => s + d.monthlyShare, 0);
  const totalShareSum = creditorShares.reduce((s, d) => s + d.totalShare, 0);
  const repayRate = totalDebt > 0 ? Math.round((totalShareSum / totalDebt) * 100) : 0;

  const agentName = office?.rep ?? '';
  return (
    <>
      {/* ═══ 표지 ═══ */}
      <p className="text-right text-[10.5pt] mb-4">[간이양식 2]</p>

      <div className="border-2 border-black inline-block px-4 py-2 mb-8">
        <p className="text-[11pt] font-bold">가용소득만으로 변제하는 경우</p>
      </div>

      {formTitle('변제계획안 간이양식')}

      <div className="text-[11pt] mb-8 leading-[2.2]">
        <p>사{'　　'}건{'　　'}20{'　　'}개회{'　　　　'}개인회생</p>
        <p>채 무 자{'　　'}{val(name)}</p>
        <p>대 리 인{'　　'}{agentName}</p>
      </div>

      <p className="text-[11pt] mb-10 mt-10 leading-relaxed text-center">
        채무자는 별지와 같이 변제계획안을 작성하여 제출하니 인가하여 주시기 바랍니다.
      </p>

      <div className="mt-14 text-center text-[11pt]">
        <p className="mb-10">20{'　　'}.{'　　'}.{'　　'}.</p>
        <p className="mb-2">
          채무자{'　　'}
          <span className="inline-block min-w-[100px] mx-1">{val(name)}</span>
          {'　　'}(서명 또는 날인)
        </p>
      </div>
      <p className="mt-10 text-right text-[13pt] font-bold pr-4">○○회생(지방)법원 귀중</p>

      {/* ═══ 변제계획(안) 본문 ═══ */}
      <div className="mt-16">
        <p className="text-[11pt] mb-1">20{'　　'}개회{'　　　　'}호{'　　'}채무자 <span className="underline">{val(name)}</span></p>
        {formTitle('변 제 계 획 (안)')}
        <p className="text-right text-[10.5pt] mb-6 underline">20{'　　'}.{'　　'}.{'　　'}. 작성</p>
      </div>

      <h4 className="font-bold text-[11pt] mb-3">1. 변제기간</h4>
      <p className="text-[10.5pt] mb-6 leading-relaxed ml-4">
        [{'　　'}]년 [{'　　'}]월 [{'　　'}]일부터 [{'　　'}]년 [{'　　'}]월 [{'　　'}]일까지 [{'　'}<strong>{periodMonths}</strong>{'　'}]개월간
      </p>

      <h4 className="font-bold text-[11pt] mb-3">2. 변제에 제공되는 소득</h4>
      <div className="text-[10.5pt] mb-6 leading-[2] ml-4">
        <p><strong>(1)</strong> 변제기간 동안 월 평균 수입: [{'　　'}<strong>{num(income + income2)}</strong>{'　　'}]원</p>
        <p><strong>(2)</strong> 채무자 및 피부양자의 생활에 필요한 생계비: 월 [{'　　'}<strong>{num(totalExpenseVal)}</strong>{'　　'}]원</p>
        <p><strong>(3)</strong> 채무자의 월 평균 가용소득: [{'　　'}<strong>{num(monthly)}</strong>{'　　'}]원</p>
        <p><strong>(4)</strong> 총 가용소득: [{'　　'}<strong>{num(monthly * periodMonths)}</strong>{'　　'}]원 (월 평균 가용소득 x 변제 횟수)</p>
      </div>

      <h4 className="font-bold text-[11pt] mb-3">3. 일반 개인회생채권에 대한 변제</h4>
      <div className="text-[10.5pt] mb-2 leading-relaxed ml-4">
        <p className="font-bold mb-1">(1) 월 변제예정액 및 총 변제예정액의 산정</p>
        <p className="mb-2 ml-4 leading-relaxed">
          월 실제 가용소득을 각 일반 개인회생채권의 원금의 액수를 기준으로 안분하여 산출한
          금액을 각 일반 개인회생채권자에게 변제한다. 이를 기초로 산정한 월 변제예정액은 [{'　'}<strong>{num(monthlyShareSum)}</strong>{'　'}]원이고 총 변제예정액은 [{'　　'}<strong>{num(totalShareSum)}</strong>{'　　'}]원이다.
        </p>
        <p className="text-[9.5pt] ml-4 mb-4">☞구체적 산정 내역은 별지 개인회생채권 변제예정액 표 참조.</p>

        <p className="font-bold mb-1">(2) 변제방법</p>
        <p className="mb-2 ml-4">위 (1)항의 변제예정액은 다음과 같이 분할하여 변제한다.</p>

        <p className="font-bold mb-1 ml-4">(가) 기간 및 횟수</p>
        <p className="mb-1 ml-8">
          [{'　　'}]년 [{'　'}]월 [{'　'}]일부터 [{'　　'}]년 [{'　'}]월 [{'　'}]일까지 [{'　'}<strong>{periodMonths}</strong>{'　'}]개월간
        </p>
        <p className="mb-3 ml-8">합계 [{'　'}<strong>{periodMonths}</strong>{'　'}]회</p>

        <p className="font-bold mb-1 ml-4">(나) 변제월 및 변제일</p>
        <p className="mb-1 ml-8">
          ① [{'　　'}]년 [{'　'}]월 [{'　'}]일부터 변제계획인가일 직전 [{'　'}]일까지 기간
        </p>
        <p className="mb-2 ml-12 text-[9.5pt] leading-relaxed">
          변제계획인가일 직후 최초 도래하는 월의 [{'　'}]일에 위 기간 동안의 변제분을<br />
          개인회생절차개시 후 변제계획 인가 전에 적립된 가용소득으로 일시에 조기 변제
        </p>
        <p className="mb-1 ml-8">
          ② 변제계획인가일 직후 최초 도래하는 월의 [{'　'}]일부터 [{'　　'}]년 [{'　'}]월 [{'　'}]일까지 기간
        </p>
        <p className="mb-4 ml-12">
          <strong>매월마다 [{'　　'}]일에 변제</strong>
        </p>
      </div>

      <h4 className="font-bold text-[11pt] mb-3">4. 변제금원의 회생위원에 대한 임치 및 지급</h4>
      <p className="text-[10.5pt] mb-6 leading-relaxed ml-4">
        채무자는 위 3항에 따라 개인회생채권자들에게 변제하여야 할 금액을 개시결정 시 통지
        되는 개인회생위원의 예금계좌 {'{'} [{'　　　　'}]은행 계좌번호 [{'　　　　　　　　'}] {'}'}에 순차 임
        치하고, 개인회생채권자는 법원에 예금계좌를 신고하여 회생위원으로부터 변제액을 송금받
        는 방법으로 지급받는다. 회생위원은 계좌번호를 신고하지 않은 개인회생채권자에 대하여는
        변제액을 적립하였다가 이를 연 1회 개인회생사건이 계속되어 있는 지방법원에 공탁하여
        지급할 수 있다.
      </p>
      <p className="text-[9.5pt] ml-4 mb-6">☞ 개인회생위원의 예금계좌는 신청 당시에는 알 수 없으므로 공란으로 두었다가 추후 보완합니다.</p>

      <h4 className="font-bold text-[11pt] mb-3">5. 면책의 범위 및 효력발생시기</h4>
      <p className="text-[10.5pt] mb-8 leading-relaxed ml-4">
        채무자가 개인회생채권에 대하여 이 변제계획에 따라 변제를 완료하고 면책신청을 하여 면
        책결정이 확정되었을 경우에는, 이 변제계획에 따라 변제한 것을 제외하고 개인회생채권자
        에 대한 채무에 관하여 그 책임이 면제된다. 단, 채무자 회생 및 파산에 관한 법률 제625조
        제2항 단서 각호 소정의 채무에 관하여는 그러하지 아니하다.
      </p>

      {/* ═══ 변제예정액표 (별지) ═══ */}
      <div className="mt-16 mb-4">
        <p className="text-[11pt] mb-1">20○○개회{'　　　'}호　채무자 {val(name)}</p>
        {formTitle('개인회생채권 변제예정액 표')}
      </div>

      <h4 className="font-bold text-[11pt] mb-2">1. 기초사항</h4>
      <p className="text-right text-[9.5pt] mb-1">(단위: 원)</p>
      <table className={tblOuter + ' mb-6'}>
        <thead>
          <tr>
            <th className={th}>(A) 월 실제 가용소득</th>
            <th className={th}>(B) 변제횟수</th>
            <th className={th}>(C) 총 실제 가용소득</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={tdR}>{num(actualMonthly)}</td>
            <td className={tdC}>{periodMonths}</td>
            <td className={tdR}>{num(totalActual)}</td>
          </tr>
        </tbody>
      </table>

      <h4 className="font-bold text-[11pt] mb-2">2. 채권자별 변제예정액의 산정내역</h4>
      <p className="text-right text-[9.5pt] mb-1">(단위: 원)</p>
      {debts.length === 0 ? (
        <p className="text-[11pt] text-gray-400 text-center py-8 border border-black">채무 데이터가 없습니다.</p>
      ) : (
        <table className={tblOuter}>
          <thead>
            <tr>
              <th className={th} style={{ width: 40 }}>채권<br />번호</th>
              <th className={th}>채권자</th>
              <th className={th} style={{ width: 120 }}>개인회생<br />채권액(원금)</th>
              <th className={th} style={{ width: 110 }}>월 변제예정액</th>
              <th className={th} style={{ width: 110 }}>총 변제예정액</th>
            </tr>
          </thead>
          <tbody>
            {creditorShares.map((d, i) => (
              <tr key={d.id}>
                <td className={tdC}>{i + 1}</td>
                <td className={td}>{d.creditor}</td>
                <td className={tdR}>{num(d.amount)}</td>
                <td className={tdR}>{num(d.monthlyShare)}</td>
                <td className={tdR}>{num(d.totalShare)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className={`${td} text-center font-bold`}>합　계</td>
              <td className={`${tdR} font-bold`}>{num(totalDebt)}</td>
              <td className={`${tdR} font-bold`}>{num(monthlyShareSum)}</td>
              <td className={`${tdR} font-bold`}>{num(totalShareSum)}</td>
            </tr>
          </tfoot>
        </table>
      )}

      <div className="mt-4 text-[10.5pt] leading-relaxed">
        <p>3. 변제율: 원금의 [{'　'}<strong>{repayRate}</strong>{'　'}]%  상당액</p>
        <p className="text-[9.5pt] mt-1">☞ [총변제예정액을 개인회생채권 합계액으로 나눈 비율] × 100 을 기재하되 소수점 이하는 반올림</p>
      </div>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────
   간이양식 1-4: 진술서
   ──────────────────────────────────────────────────────────────────── */
function renderStatement(c: Client | null) {
  const s: StatementData = c?.statement ?? {};
  const job = c?.job ?? '';
  const jobType = c?.jobType;
  const isEmployed = jobType === 'employed' || jobType === 'daily';
  const rent = c?.rent ?? 0;

  return (
    <>
      <div className="flex justify-between text-[9.5pt] mb-0.5">
        <span>[신청서 첨부서류 4]</span>
        <span>[간이양식 1-4]</span>
      </div>
      {formTitle('진 술 서')}

      {/* ═══ I. 경력 ═══ */}
      <h3 className="mb-3 font-bold" style={{ fontSize: '12.5pt', fontWeight: 700, letterSpacing: '0.05em' }}>I. 경력</h3>

      <p className="text-[10.5pt] mb-2"><strong>1. 최종 학력</strong></p>
      <p className="text-[10.5pt] mb-4 ml-6">
        {'　　　'}년{'　　'}월{'　　'}일{'　　　　　　　　　　'}학교 ( 졸업,{'　'}중퇴 )
      </p>

      <p className="text-[10.5pt] mb-2"><strong>2. 과거 경력</strong> (최근 경력부터 기재하여 주십시오)</p>
      <table className={tblOuter + ' mb-4'}>
        <tbody>
          {/* 현재 직장 (첫 번째) */}
          <tr>
            <td className={td} style={{ width: 50 }}>기간</td>
            <td className={td} colSpan={3}>{'　　'}년{'　　'}월{'　　'}일부터</td>
            <td className={td} colSpan={3}>현재까지 ({isEmployed ? '근무' : '자영'}, {isEmployed ? '근무' : '자영'})</td>
          </tr>
          <tr>
            <td className={td}>업종</td>
            <td className={td} colSpan={2}></td>
            <td className={td}>직장명</td>
            <td className={td} colSpan={2}>{job}</td>
            <td className={td}>직위</td>
          </tr>
          {/* 2~4번째 경력 (빈 행) */}
          {[1, 2, 3].map((n) => (
            <React.Fragment key={n}>
              <tr>
                <td className={td}>기간</td>
                <td className={td} colSpan={2}>{'　　'}년{'　　'}월{'　　'}일부터</td>
                <td className={td} colSpan={2}>{'　　'}년{'　　'}월{'　　'}일까지</td>
                <td className={td} colSpan={2}>(자영, 근무)</td>
              </tr>
              <tr>
                <td className={td}>업종</td>
                <td className={td} colSpan={2}></td>
                <td className={td}>직장명</td>
                <td className={td} colSpan={2}></td>
                <td className={td}>직위</td>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>

      <p className="text-[10.5pt] mb-2"><strong>3. 과거 결혼, 이혼 경력</strong></p>
      <div className="text-[10.5pt] mb-6 ml-6 leading-[2]">
        <p>{'　　　'}년{'　　'}월{'　　'}일{'　　　　　　　'}와 (결혼, 이혼)</p>
        <p>{'　　　'}년{'　　'}월{'　　'}일{'　　　　　　　'}와 (결혼, 이혼)</p>
        <p>{'　　　'}년{'　　'}월{'　　'}일{'　　　　　　　'}와 (결혼, 이혼)</p>
      </div>

      {/* ═══ II. 현재 주거 상황 ═══ */}
      <h3 className="mb-3 font-bold" style={{ fontSize: '12.5pt', fontWeight: 700, letterSpacing: '0.05em' }}>II. 현재 주거 상황</h3>
      <p className="text-[10.5pt] mb-3 ml-4">
        거주를 시작한 시점{'　　'}({'　　　　'}년{'　　'}월{'　　'}일 )
      </p>

      <table className={tblOuter + ' mb-3'}>
        <thead>
          <tr>
            <th className={th} style={{ width: '40%' }}>거주관계(해당란에 표시)</th>
            <th className={th}>상세한 내역</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={td}>㉮ 신청인 소유의 주택</td>
            <td className={td}></td>
          </tr>
          <tr>
            <td className={td}>
              ㉯ 사택 또는 기숙사<br />
              {rent > 0 ? '☑' : '㉰'} 임차(전·월세) 주택
            </td>
            <td className={td}>
              임대보증금 ({'　　　　　　　'}원)<br />
              임대료 (월{'　　　'}{rent > 0 ? num(rent) : ''}{'　　'}원), 연체액 ({'　　　　'}원)<br />
              임차인 성명 ({'　　　　　　　　　'})
            </td>
          </tr>
          <tr>
            <td className={td}>
              ㉱ 친족 소유 주택에 무상 거주<br />
              ㉲ 친족 외 소유 주택에 무상 거주
            </td>
            <td className={td}>
              소유자 성명 ({'　　　　　　　　　'})<br />
              신청인과의 관계 ({'　　　　　　　'})
            </td>
          </tr>
          <tr>
            <td className={td}>㉳ 기타({'　　　　　　　　'})</td>
            <td className={td}></td>
          </tr>
        </tbody>
      </table>
      <div className="text-[9.5pt] mb-6 leading-relaxed">
        <p>☆ ㉮ 또는 ㉱항을 선택한 분은 주택의 등기부등본을 첨부하여 주십시오.</p>
        <p>☆ ㉯ 또는 ㉰항을 선택한 분은 임대차계약서(전월세 계약서) 또는 사용허가서 사본을 첨부하여 주시기 바랍니다.</p>
        <p>☆ ㉱ 또는 ㉲항을 선택한 분은 소유자 작성의 거주 증명서를 첨부하여 주십시오.</p>
      </div>

      {/* ═══ III. 부채 상황 ═══ */}
      <h3 className="mb-3 font-bold" style={{ fontSize: '12.5pt', fontWeight: 700, letterSpacing: '0.05em' }}>III. 부채 상황</h3>

      <p className="text-[10.5pt] mb-2">
        <strong>1. 채권자로부터 소송·지급명령·전부명령·압류·가압류 등을 받은 경험</strong>(있음, 없음)
      </p>
      <table className={tblOuter + ' mb-2'}>
        <thead>
          <tr>
            <th className={th}>내{'　　'}역</th>
            <th className={th}>채권자</th>
            <th className={th}>관할법원</th>
            <th className={th}>사건번호</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={td} style={{ height: 30 }}>{s.garnishment ? (s.garnishmentDetail ?? '') : ''}</td>
            <td className={td}></td>
            <td className={td}></td>
            <td className={td}></td>
          </tr>
          <tr>
            <td className={td} style={{ height: 30 }}></td>
            <td className={td}></td>
            <td className={td}></td>
            <td className={td}></td>
          </tr>
        </tbody>
      </table>
      <div className="text-[9.5pt] mb-4 leading-relaxed">
        <p>위 내역란에는 소송, 지급명령, 압류 등으로 그 내용을 기재합니다.</p>
        <p>☆ 위 기재사항에 해당하는 소장·지급명령·전부명령·압류 및 가압류결정의 각 사본을 첨부하여 주십시오.</p>
      </div>

      <p className="text-[10.5pt] mb-2">
        <strong>2. 개인회생절차에 이르게 된 사정</strong>(여러 항목 중복 선택 가능)
      </p>
      <div className="text-[10.5pt] mb-4 ml-4">
        <div className="grid grid-cols-2 gap-y-1">
          <p>({'　'}) 생활비 부족</p>
          <p>({'　'}) 병원비 과다 지출</p>
          <p>({'　'}) 교육비 과다 지출</p>
          <p>({'　'}) 음식, 음주, 여행, 도박 또는 취미 활동</p>
          <p>({'　'}) 점포 운영의 실패</p>
          <p>({'　'}) 타인 채무의 보증</p>
          <p>({'　'}) 주식 투자 실패</p>
          <p>({'　'}) 사기 피해</p>
          <p>({'　'}) 기타 ({'　　　　　　　　　　　　　　　　　'})</p>
        </div>
      </div>

      <p className="text-[10.5pt] mb-2">
        <strong>3. 채무자가 많은 채무를 부담하게 된 사정 및 개인회생절차 개시의 신청에 이르게 된 사정에
        관하여 구체적으로 기재하여 주십시오</strong>(추가 기재 시에는 별지를 이용하시면 됩니다).
      </p>
      <div className="border border-black min-h-[250px] p-3 mb-4 text-[10.5pt] whitespace-pre-wrap">
        {s.debtHistory ?? ''}
      </div>

      <p className="text-right text-[9.5pt] mb-6">4-3</p>

      {/* ═══ IV. 과거 면책절차 등의 이용 상황 ═══ */}
      <h3 className="mb-3 font-bold" style={{ fontSize: '12.5pt', fontWeight: 700, letterSpacing: '0.05em' }}>IV. 과거 면책절차 등의 이용 상황</h3>

      <table className={tblOuter + ' mb-3'}>
        <thead>
          <tr>
            <th className={th} style={{ width: '30%' }}>절차</th>
            <th className={th}>법원 또는 기관</th>
            <th className={th} style={{ width: '15%' }}>신청 시기</th>
            <th className={th}>현재까지 진행 상황</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={td}>
              □{'　'}파산·면책절차<br />
              □{'　'}화의·회생·개인회생절차
            </td>
            <td className={td}>{s.priorApplication ? (s.priorApplicationDetail ?? '') : ''}</td>
            <td className={td}></td>
            <td className={td}></td>
          </tr>
          <tr>
            <td className={td}>
              □{'　'}신용회복위원회 워크아웃<br />
              □{'　'}배드뱅크
            </td>
            <td className={td}></td>
            <td className={td}></td>
            <td className={td}>
              ({'　　　　'})회<br />
              ({'　　　　'})원 변제
            </td>
          </tr>
        </tbody>
      </table>
      <div className="text-[9.5pt] mb-6 leading-relaxed">
        <p><strong>☆ 과거에 면책절차 등을 이용하였다면 해당란에 ☑ 표시 후 기재합니다.</strong></p>
        <p><strong>☆ 신청일 전 10년 내에 회생사건·화의사건·파산사건 또는 개인회생사건을 신청한 사실이 있는 때에는 그 관련 서류 1통을 제출하여야 합니다.</strong></p>
      </div>
    </>
  );
}

/* ─── Dispatcher ─── */
const RENDERERS: Record<DocType, (c: Client | null, office?: Office | null) => React.ReactNode> = {
  application: renderApplication,
  debt_list: (c) => renderDebtList(c),
  asset_list: (c) => renderAssetList(c),
  income_list: (c) => renderIncomeList(c),
  repay_plan: (c, office) => renderRepayPlan(c, office),
  statement: (c) => renderStatement(c),
};

export default function DocPreview({ docType, clientData, office }: DocPreviewProps) {
  const render = RENDERERS[docType];
  return (
    <div
      className="mx-auto max-w-[210mm] bg-white text-black p-[20mm] shadow-lg print:shadow-none print:p-0"
      style={{
        minHeight: '297mm',
        fontFamily: "'Nanum Myeongjo', '바탕', 'Batang', 'Times New Roman', serif",
        fontSize: '11pt',
        lineHeight: 1.9,
        letterSpacing: '0.01em',
        fontWeight: 400,
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        wordBreak: 'keep-all',
        textRendering: 'optimizeLegibility',
      }}
    >
      {render(clientData, office)}
    </div>
  );
}
