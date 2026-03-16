/**
 * HWPX 템플릿 6종 생성 → Firebase Storage 업로드
 *
 * HWPX = ZIP archive containing:
 *   mimetype
 *   META-INF/container.xml
 *   Contents/header.xml
 *   Contents/section0.xml   ← 본문 (플레이스홀더 포함)
 *   Contents/content.hpf
 *   version.xml
 */

const admin = require("firebase-admin");
const JSZip = require("jszip");
const path = require("path");

// Firebase Admin 초기화
const serviceAccountPath = path.join(__dirname, "..", "functions", "service-account.json");
let app;
try {
  const sa = require(serviceAccountPath);
  app = admin.initializeApp({
    credential: admin.credential.cert(sa),
    storageBucket: "hoiseng1click.firebasestorage.app",
  });
} catch {
  // service account 없으면 기본 인증
  app = admin.initializeApp({
    storageBucket: "hoiseng1click.firebasestorage.app",
  });
}

const bucket = admin.storage().bucket();

// ─── HWPX 공통 파일들 ───

const MIMETYPE = "application/hwp+zip";

const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0">
  <rootfiles>
    <rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/>
  </rootfiles>
</container>`;

const VERSION_XML = `<?xml version="1.0" encoding="UTF-8"?>
<hcfVersion api="0.16" program="HWP" version="5.1.0.1"/>`;

const CONTENT_HPF = `<?xml version="1.0" encoding="UTF-8"?>
<opf:package version="1.0" unique-identifier="bookid" xmlns:opf="http://www.idpf.org/2007/opf">
  <opf:manifest>
    <opf:item id="header" href="header.xml" media-type="application/xml"/>
    <opf:item id="section0" href="section0.xml" media-type="application/xml"/>
  </opf:manifest>
  <opf:spine>
    <opf:itemref idref="section0"/>
  </opf:spine>
</opf:package>`;

const HEADER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head">
  <hh:beginNum page="1" footnote="1" endnote="1"/>
  <hh:refList>
    <hh:fontfaces>
      <hh:fontface lang="HANGUL">
        <hh:font face="함초롬바탕" type="TTF"/>
      </hh:fontface>
      <hh:fontface lang="LATIN">
        <hh:font face="함초롬바탕" type="TTF"/>
      </hh:fontface>
    </hh:fontfaces>
    <hh:charProperties>
      <hh:charPr id="0" height="1000" bold="false">
        <hh:typeface lang="HANGUL" face="함초롬바탕"/>
        <hh:typeface lang="LATIN" face="함초롬바탕"/>
      </hh:charPr>
      <hh:charPr id="1" height="1600" bold="true">
        <hh:typeface lang="HANGUL" face="함초롬바탕"/>
        <hh:typeface lang="LATIN" face="함초롬바탕"/>
      </hh:charPr>
      <hh:charPr id="2" height="1200" bold="true">
        <hh:typeface lang="HANGUL" face="함초롬바탕"/>
        <hh:typeface lang="LATIN" face="함초롬바탕"/>
      </hh:charPr>
    </hh:charProperties>
    <hh:paraProperties>
      <hh:paraPr id="0" align="JUSTIFY">
        <hh:spacing line="160" lineType="PERCENT"/>
      </hh:paraPr>
      <hh:paraPr id="1" align="CENTER">
        <hh:spacing line="160" lineType="PERCENT"/>
      </hh:paraPr>
    </hh:paraProperties>
  </hh:refList>
</hh:head>`;

// ─── 헬퍼: XML 본문 빌드 ───

function wrapSection(bodyXml) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section"
        xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"
        xmlns:hr="http://www.hancom.co.kr/hwpml/2011/run"
        xmlns:ht="http://www.hancom.co.kr/hwpml/2011/table">
${bodyXml}
</hs:sec>`;
}

/** 단락: <hp:p> */
function para(text, opts = {}) {
  const align = opts.center ? '1' : '0';
  const charPr = opts.bold ? (opts.title ? '1' : '2') : '0';
  return `  <hp:p paraPrIDRef="${align}">
    <hp:run charPrIDRef="${charPr}">
      <hp:secPr/>
      <hr:t>${escXml(text)}</hr:t>
    </hp:run>
  </hp:p>`;
}

function escXml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/** 테이블 행 */
function trow(cells) {
  const cellsXml = cells.map(c => {
    const text = typeof c === 'object' ? c.text : c;
    const bold = typeof c === 'object' && c.bold;
    return `      <ht:tc>
        <hp:p paraPrIDRef="0">
          <hp:run charPrIDRef="${bold ? '2' : '0'}">
            <hr:t>${escXml(String(text))}</hr:t>
          </hp:run>
        </hp:p>
      </ht:tc>`;
  }).join('\n');
  return `    <ht:tr>\n${cellsXml}\n    </ht:tr>`;
}

function table(rows) {
  return `  <ht:tbl>\n${rows.join('\n')}\n  </ht:tbl>`;
}

// ─── 각 서류별 section0.xml 생성 ───

function applicationSection() {
  return wrapSection([
    para('[간이양식 1]', { center: true }),
    para('개인회생절차 개시신청서', { center: true, bold: true, title: true }),
    '',
    table([
      trow([{text:'성　　명', bold:true}, '{{clientName}}', {text:'주민등록번호', bold:true}, '{{clientSSN}}']),
      trow([{text:'주　　소', bold:true}, '{{clientAddr}}', {text:'우편번호', bold:true}, '']),
      trow([{text:'전화번호', bold:true}, '{{clientPhone}}', {text:'직　　업', bold:true}, '{{clientJob}}']),
    ]),
    '',
    para('신 청 취 지', { center: true, bold: true }),
    para('「신청인에 대하여 개인회생절차를 개시한다.」라는 결정을 구합니다.'),
    '',
    para('신 청 이 유', { center: true, bold: true }),
    para('1. 신청인은 첨부한 개인회생채권자목록 기재와 같은 채무를 부담하고 있으나, 수입 및 재산이 별지 수입 및 지출에 관한 목록과 재산목록에 기재된 바와 같으므로, 파산의 원인사실이 발생하였습니다.'),
    para('총 채무액: {{totalDebt}}'),
    para('채권자 수: {{creditorCount}}명'),
    para('변제기간: {{repayPeriodMonths}}개월'),
    para('월 변제금: {{monthlyPayment}}'),
    '',
    para('첨 부 서 류', { center: true, bold: true }),
    para('1. 개인회생채권자목록 1통'),
    para('2. 재산목록 1통'),
    para('3. 수입 및 지출에 관한 목록 1통'),
    para('4. 진술서 1통'),
    para('5. 변제계획안 1통'),
    '',
    para('{{today}}', { center: true }),
    para('신청인　{{clientName}}　(서명 또는 날인)', { center: true }),
    para('{{court}} 귀중', { center: true, bold: true }),
  ].join('\n'));
}

function debtListSection() {
  return wrapSection([
    para('[간이양식 1-1]', { center: true }),
    para('개인회생채권자목록 간이양식', { center: true, bold: true, title: true }),
    para('채무자: {{clientName}}'),
    '',
    table([
      trow([{text:'순번',bold:true}, {text:'채권자',bold:true}, {text:'종류',bold:true}, {text:'잔존원금',bold:true}, {text:'이율',bold:true}, {text:'연체이자',bold:true}, {text:'합계액',bold:true}]),
      `<!--REPEAT:debts-->`,
      trow(['{{no}}', '{{creditor}}', '{{type}}', '{{amount}}', '{{rate}}', '{{overdueInterest}}', '{{totalOwed}}']),
      `<!--/REPEAT:debts-->`,
    ]),
    '',
    para('무담보 채무 합계: {{unsecuredDebt}}'),
    para('담보 채무 합계: {{securedDebt}}'),
    para('채무 총 합계: {{totalDebt}}'),
    '',
    para('{{today}}', { center: true }),
    para('채무자　{{clientName}}　(서명 또는 날인)', { center: true }),
    para('{{court}} 귀중', { center: true, bold: true }),
  ].join('\n'));
}

function assetListSection() {
  return wrapSection([
    para('[간이양식 1-2]', { center: true }),
    para('재산목록 간이양식', { center: true, bold: true, title: true }),
    para('채무자: {{clientName}}'),
    '',
    para('1. 부동산', { bold: true }),
    table([
      trow([{text:'순번',bold:true}, {text:'소재지',bold:true}, {text:'면적(㎡)',bold:true}, {text:'공시가격',bold:true}, {text:'근저당',bold:true}, {text:'청산가치',bold:true}]),
      `<!--REPEAT:realEstate-->`,
      trow(['{{no}}', '{{address}}', '{{area}}', '{{publicPrice}}', '{{mortgage}}', '{{liquidationValue}}']),
      `<!--/REPEAT:realEstate-->`,
    ]),
    '',
    para('2. 차량', { bold: true }),
    table([
      trow([{text:'순번',bold:true}, {text:'차종',bold:true}, {text:'연식',bold:true}, {text:'기준가액',bold:true}, {text:'청산가치',bold:true}]),
      `<!--REPEAT:vehicles-->`,
      trow(['{{no}}', '{{model}}', '{{year}}', '{{basePrice}}', '{{liquidationValue}}']),
      `<!--/REPEAT:vehicles-->`,
    ]),
    '',
    para('3. 예금', { bold: true }),
    table([
      trow([{text:'순번',bold:true}, {text:'은행명',bold:true}, {text:'계좌번호',bold:true}, {text:'잔액',bold:true}]),
      `<!--REPEAT:deposits-->`,
      trow(['{{no}}', '{{bankName}}', '{{accountLast4}}', '{{balance}}']),
      `<!--/REPEAT:deposits-->`,
    ]),
    '',
    para('4. 보험', { bold: true }),
    table([
      trow([{text:'순번',bold:true}, {text:'보험회사',bold:true}, {text:'보험종류',bold:true}, {text:'해약환급금',bold:true}]),
      `<!--REPEAT:insurance-->`,
      trow(['{{no}}', '{{insurerName}}', '{{insuranceType}}', '{{surrenderValue}}']),
      `<!--/REPEAT:insurance-->`,
    ]),
    '',
    para('청산가치 합계: {{totalLiquidationValue}}', { bold: true }),
    '',
    para('{{today}}', { center: true }),
    para('채무자　{{clientName}}　(서명 또는 날인)', { center: true }),
    para('{{court}} 귀중', { center: true, bold: true }),
  ].join('\n'));
}

function incomeListSection() {
  return wrapSection([
    para('[간이양식 1-3]', { center: true }),
    para('수입 및 지출에 관한 목록 간이양식', { center: true, bold: true, title: true }),
    para('채무자: {{clientName}}'),
    '',
    para('Ⅰ. 현재의 수입 목록', { bold: true }),
    table([
      trow([{text:'항목',bold:true}, {text:'금액(원)',bold:true}]),
      trow(['급여', '{{salary}}']),
      trow(['사업소득', '{{businessIncome}}']),
      trow(['기타소득', '{{otherIncome}}']),
      trow([{text:'합계',bold:true}, {text:'{{totalIncome}}',bold:true}]),
    ]),
    '',
    para('Ⅱ. 예상 지출 목록', { bold: true }),
    table([
      trow([{text:'항목',bold:true}, {text:'금액(원)',bold:true}]),
      trow(['주거비', '{{rent}}']),
      trow(['식비', '{{food}}']),
      trow(['교통비', '{{transport}}']),
      trow(['통신비', '{{telecom}}']),
      trow(['교육비', '{{education}}']),
      trow(['의료비', '{{medical}}']),
      trow(['보험료', '{{insurancePremium}}']),
      trow([{text:'합계',bold:true}, {text:'{{totalExpense}}',bold:true}]),
    ]),
    '',
    para('Ⅲ. 가족관계', { bold: true }),
    para('가족 수: {{family}}명'),
    table([
      trow([{text:'관계',bold:true}, {text:'성명',bold:true}, {text:'나이',bold:true}, {text:'직업',bold:true}, {text:'소득',bold:true}]),
      `<!--REPEAT:familyMembers-->`,
      trow(['{{relation}}', '{{name}}', '{{age}}', '{{job}}', '{{income}}']),
      `<!--/REPEAT:familyMembers-->`,
    ]),
    '',
    para('기준중위소득 ({{family}}인 가구): {{medianIncome}}'),
    para('생계비 기준 (60%): {{livingCostBasis}}'),
    para('가용소득: {{availableIncome}}', { bold: true }),
    para('월 변제금: {{monthlyPayment}}', { bold: true }),
    '',
    para('{{today}}', { center: true }),
    para('채무자　{{clientName}}　(서명 또는 날인)', { center: true }),
    para('{{court}} 귀중', { center: true, bold: true }),
  ].join('\n'));
}

function repayPlanSection() {
  return wrapSection([
    para('[간이양식 2]', { center: true }),
    para('변제계획안 간이양식', { center: true, bold: true, title: true }),
    para('채무자: {{clientName}}'),
    '',
    para('1. 변제기간: {{repayPeriodMonths}}개월'),
    para('2. 월 변제금: {{monthlyPayment}}'),
    para('3. 총 변제금: {{totalRepay}}'),
    para('4. 총 채무: {{totalDebt}}'),
    para('5. 변제율: {{repayRate}}'),
    '',
    para('채권자별 변제예정액', { bold: true }),
    table([
      trow([{text:'채권자',bold:true}, {text:'채무액',bold:true}, {text:'배당비율',bold:true}, {text:'월 배당액',bold:true}, {text:'총 배당액',bold:true}]),
      `<!--REPEAT:creditorShares-->`,
      trow(['{{creditor}}', '{{debtAmount}}', '{{sharePercent}}', '{{monthlyShare}}', '{{totalShare}}']),
      `<!--/REPEAT:creditorShares-->`,
    ]),
    '',
    para('변제예정액표', { bold: true }),
    table([
      trow([{text:'회차',bold:true}, {text:'변제일',bold:true}, {text:'변제금액',bold:true}, {text:'누적변제금액',bold:true}]),
      `<!--REPEAT:repaySchedule-->`,
      trow(['{{round}}', '{{payDate}}', '{{payAmount}}', '{{cumulativeAmount}}']),
      `<!--/REPEAT:repaySchedule-->`,
    ]),
    '',
    para('{{today}}', { center: true }),
    para('채무자　{{clientName}}　(서명 또는 날인)', { center: true }),
    para('{{court}} 귀중', { center: true, bold: true }),
  ].join('\n'));
}

function statementSection() {
  return wrapSection([
    para('[간이양식 1-4]', { center: true }),
    para('진 술 서', { center: true, bold: true, title: true }),
    para('채무자: {{clientName}}'),
    '',
    para('1. 채무 발생 경위', { bold: true }),
    para('{{debtCause}}'),
    '',
    para('2. 채무 경과', { bold: true }),
    para('{{debtTimeline}}'),
    '',
    para('3. 변제 노력', { bold: true }),
    para('{{repayEfforts}}'),
    '',
    para('4. 향후 소득 계획', { bold: true }),
    para('{{futureIncomePlan}}'),
    '',
    para('위 내용은 사실과 다름이 없음을 서약합니다.', { center: true, bold: true }),
    '',
    para('{{today}}', { center: true }),
    para('채무자　{{clientName}}　(서명 또는 날인)', { center: true }),
    para('{{court}} 귀중', { center: true, bold: true }),
  ].join('\n'));
}

// ─── HWPX ZIP 생성 ───

async function createHwpx(sectionXml) {
  const zip = new JSZip();
  zip.file("mimetype", MIMETYPE);
  zip.folder("META-INF").file("container.xml", CONTAINER_XML);
  const contents = zip.folder("Contents");
  contents.file("content.hpf", CONTENT_HPF);
  contents.file("header.xml", HEADER_XML);
  contents.file("section0.xml", sectionXml);
  zip.file("version.xml", VERSION_XML);
  return zip.generateAsync({ type: "nodebuffer" });
}

// ─── 메인: 6종 생성 + 업로드 ───

const TEMPLATES = {
  application: applicationSection,
  debt_list: debtListSection,
  asset_list: assetListSection,
  income_list: incomeListSection,
  repay_plan: repayPlanSection,
  statement: statementSection,
};

async function main() {
  console.log("HWPX 템플릿 6종 생성 시작...\n");

  for (const [name, builder] of Object.entries(TEMPLATES)) {
    const xml = builder();
    const buf = await createHwpx(xml);
    const storagePath = `templates/hwpx/${name}.hwpx`;

    console.log(`  ${name}.hwpx (${(buf.length / 1024).toFixed(1)} KB) → ${storagePath}`);

    const file = bucket.file(storagePath);
    await file.save(buf, {
      contentType: "application/octet-stream",
      metadata: { cacheControl: "public, max-age=86400" },
    });
  }

  console.log("\n✅ 6종 HWPX 템플릿 업로드 완료!");
  process.exit(0);
}

main().catch(err => {
  console.error("❌ 실패:", err.message);
  process.exit(1);
});
