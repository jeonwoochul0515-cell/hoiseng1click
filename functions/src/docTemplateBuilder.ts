import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  AlignmentType,
  BorderStyle,
  WidthType,
} from "docx";

// ──────────────────────────────────────────────
// Shared constants & helpers
// ──────────────────────────────────────────────

const FONT = "맑은 고딕";
const BODY_SIZE = 22; // half-points → 11pt
const TITLE_SIZE = 32; // 16pt
const SECTION_SIZE = 28; // 14pt

const PAGE_MARGIN = {
  top: 1440, // 25.4mm ≈ 1440 twips (1 inch)
  bottom: 1440,
  left: 1440,
  right: 1440,
};

const THIN_BORDER = {
  style: BorderStyle.SINGLE,
  size: 1,
  color: "000000",
};

const ALL_BORDERS = {
  top: THIN_BORDER,
  bottom: THIN_BORDER,
  left: THIN_BORDER,
  right: THIN_BORDER,
};

function makeDoc(children: (Paragraph | Table)[]): Document {
  return new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: BODY_SIZE },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: PAGE_MARGIN,
          },
        },
        children,
      },
    ],
  });
}

function createTitle(text: string, size: number = TITLE_SIZE): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
    children: [
      new TextRun({ text, bold: true, size, font: FONT }),
    ],
  });
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 300, after: 150 },
    children: [
      new TextRun({ text, bold: true, size: SECTION_SIZE, font: FONT }),
    ],
  });
}

function p(text: string, opts?: { bold?: boolean; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number }): Paragraph {
  return new Paragraph({
    alignment: opts?.alignment,
    spacing: { before: opts?.before ?? 60, after: opts?.after ?? 60 },
    children: [
      new TextRun({ text, bold: opts?.bold, size: BODY_SIZE, font: FONT }),
    ],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: BODY_SIZE, font: FONT })],
  });
}

function emptyLine(): Paragraph {
  return new Paragraph({ spacing: { before: 120, after: 120 }, children: [] });
}

function cell(text: string, opts?: { bold?: boolean; width?: number; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType] }): TableCell {
  return new TableCell({
    borders: ALL_BORDERS,
    width: opts?.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    children: [
      new Paragraph({
        alignment: opts?.alignment ?? AlignmentType.CENTER,
        children: [new TextRun({ text, bold: opts?.bold, size: BODY_SIZE, font: FONT })],
      }),
    ],
  });
}

function headerRow(labels: string[], widths?: number[]): TableRow {
  return new TableRow({
    children: labels.map((label, i) =>
      cell(label, { bold: true, width: widths?.[i] })
    ),
  });
}

function dataRow(values: string[], widths?: number[]): TableRow {
  return new TableRow({
    children: values.map((v, i) => cell(v, { width: widths?.[i] })),
  });
}

function kvTable(pairs: [string, string][], labelWidth = 2200, valueWidth = 6800): Table {
  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: pairs.map(
      ([k, v]) =>
        new TableRow({
          children: [
            cell(k, { bold: true, width: labelWidth }),
            cell(v, { width: valueWidth, alignment: AlignmentType.LEFT }),
          ],
        })
    ),
  });
}

function fmt(v: string | number | undefined | null): string {
  if (v == null) return "0";
  if (typeof v === "string") return v;
  return v.toLocaleString("ko-KR");
}

function signatureBlock(court: string, today: string, clientName: string): Paragraph[] {
  return [
    emptyLine(),
    p(today, { alignment: AlignmentType.CENTER }),
    emptyLine(),
    p(`${court} 귀중`, { alignment: AlignmentType.CENTER }),
    emptyLine(),
    emptyLine(),
    p(`신청인 (채무자)  ${clientName}  (인)`, { alignment: AlignmentType.RIGHT }),
  ];
}

// ──────────────────────────────────────────────
// 1. 개인회생절차개시 신청서
// ──────────────────────────────────────────────

type V = string | number;

interface ApplicationData {
  court: string;
  clientName: string;
  clientSSN: string;
  clientAddr: string;
  clientPhone: string;
  clientJob: string;
  debtReason: string;
  totalDebt: V;
  creditorCount: number;
  repayPeriodMonths: number;
  monthlyPayment: V;
  today: string;
}

export async function createApplicationDoc(data: ApplicationData): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    createTitle("개인회생절차개시 신청서"),
    sectionHeading("1. 채무자 인적사항"),
    kvTable([
      ["성명", data.clientName],
      ["주민등록번호", data.clientSSN],
      ["주소", data.clientAddr],
      ["연락처", data.clientPhone],
      ["직업", data.clientJob],
    ]),
    sectionHeading("2. 신청 취지"),
    p("채무자에 대하여 개인회생절차를 개시하여 주시기 바랍니다."),
    sectionHeading("3. 신청 원인"),
    p(data.debtReason),
    emptyLine(),
    p(`- 총 채무액: ${fmt(data.totalDebt)}원`, { bold: true }),
    p(`- 채권자 수: ${data.creditorCount}명`),
    p(`- 변제기간: ${data.repayPeriodMonths}개월`),
    p(`- 월 변제금: ${fmt(data.monthlyPayment)}원`),
    sectionHeading("4. 첨부서류"),
    bullet("채권자목록 1부"),
    bullet("재산목록 1부"),
    bullet("수입 및 지출에 관한 목록 1부"),
    bullet("변제계획안 1부"),
    bullet("진술서 1부"),
    ...signatureBlock(data.court, data.today, data.clientName),
  ];

  const doc = makeDoc(children);
  return await Packer.toBuffer(doc) as unknown as Buffer;
}

// ──────────────────────────────────────────────
// 2. 채권자목록
// ──────────────────────────────────────────────

interface DebtEntry {
  no: number;
  creditor: string;
  type: string;
  originalDate: string;
  originalAmount: V;
  amount: V;
  rate: V;
  overdueInterest: V;
  accelerationDate: string;
  totalOwed: V;
  securedNote: string;
}

interface DebtListData {
  clientName: string;
  clientAddr: string;
  court: string;
  today: string;
  debts: DebtEntry[];
  totalDebt: V;
  unsecuredDebt: V;
  securedDebt: V;
}

export async function createDebtListDoc(data: DebtListData): Promise<Buffer> {
  const headers = [
    "순번", "채권자", "종류", "최초차용일", "최초차용금액",
    "잔존원금", "이율(%)", "연체이자", "기한이익상실일", "합계액", "비고",
  ];
  const widths = [600, 1200, 700, 900, 1000, 1000, 700, 900, 900, 1000, 800];

  const rows: TableRow[] = [
    headerRow(headers, widths),
    ...data.debts.map((d) =>
      dataRow(
        [
          String(d.no),
          d.creditor,
          d.type,
          d.originalDate,
          fmt(d.originalAmount),
          fmt(d.amount),
          String(d.rate),
          fmt(d.overdueInterest),
          d.accelerationDate,
          fmt(d.totalOwed),
          d.securedNote,
        ],
        widths
      )
    ),
    dataRow(
      ["", "합계", "", "", "", "", "", "", "", fmt(data.totalDebt), ""],
      widths
    ),
  ];

  const children: (Paragraph | Table)[] = [
    createTitle("채 권 자 목 록"),
    p(`채무자 성명: ${data.clientName}`, { bold: true }),
    p(`주소: ${data.clientAddr}`),
    emptyLine(),
    new Table({ width: { size: 9700, type: WidthType.DXA }, rows }),
    emptyLine(),
    p(`무담보 채무 합계: ${fmt(data.unsecuredDebt)}원`),
    p(`담보 채무 합계: ${fmt(data.securedDebt)}원`),
    ...signatureBlock(data.court, data.today, data.clientName),
  ];

  const doc = makeDoc(children);
  return await Packer.toBuffer(doc) as unknown as Buffer;
}

// ──────────────────────────────────────────────
// 3. 재산목록
// ──────────────────────────────────────────────

interface RealEstateItem { no: number; address: string; area: number; publicPrice: V; mortgage: V; liquidationValue: V; }
interface VehicleItem { no: number; model: string; year: number; mileage: number; basePrice: V; liquidationValue: V; }
interface DepositItem { no: number; bankName: string; accountLast4: string; balance: V; }
interface InsuranceItem { no: number; insurerName: string; insuranceType: string; surrenderValue: V; }
interface SecuritiesItem { no: number; brokerName: string; stockName: string; evalAmount: V; }
interface OtherAssetItem { no: number; name: string; rawValue: V; liquidationValue: V; }

interface LeibnizItem {
  no: number;
  name: string;
  rawValue: V;
  factor: string;
  years: number;
  presentValue: V;
  basis: string;
}

interface AssetListData {
  clientName: string;
  court: string;
  today: string;
  realEstate: RealEstateItem[];
  vehicles: VehicleItem[];
  deposits: DepositItem[];
  insurance: InsuranceItem[];
  securities: SecuritiesItem[];
  otherAssets: OtherAssetItem[];
  leibnizItems?: LeibnizItem[];
  leibnizTotal?: V;
  hasLeibniz?: boolean;
  taxDelinquent?: V;
  wageClaim?: V;
  smallDeposit?: V;
  priorityClaims?: V;
  assetLiquidation?: V;
  totalLiquidationValue: V;
}

export async function createAssetListDoc(data: AssetListData): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    createTitle("재 산 목 록"),
    p(`채무자: ${data.clientName}`, { bold: true }),
    emptyLine(),
  ];

  // 1. 부동산
  children.push(sectionHeading("1. 부동산"));
  if (data.realEstate.length > 0) {
    const w = [500, 2200, 800, 1200, 1500, 1200];
    children.push(
      new Table({
        width: { size: 9000, type: WidthType.DXA },
        rows: [
          headerRow(["순번", "소재지", "면적(㎡)", "공시가격", "근저당/전세", "청산가치"], w),
          ...data.realEstate.map((r) =>
            dataRow([String(r.no), r.address, String(r.area), fmt(r.publicPrice), fmt(r.mortgage), fmt(r.liquidationValue)], w)
          ),
        ],
      })
    );
  } else {
    children.push(p("해당 없음"));
  }

  // 2. 차량
  children.push(sectionHeading("2. 차량"));
  if (data.vehicles.length > 0) {
    const w = [500, 1800, 800, 1200, 1200, 1200];
    children.push(
      new Table({
        width: { size: 9000, type: WidthType.DXA },
        rows: [
          headerRow(["순번", "차종", "연식", "주행거리", "기준가액", "청산가치"], w),
          ...data.vehicles.map((v) =>
            dataRow([String(v.no), v.model, String(v.year), `${fmt(v.mileage)}km`, fmt(v.basePrice), fmt(v.liquidationValue)], w)
          ),
        ],
      })
    );
  } else {
    children.push(p("해당 없음"));
  }

  // 3. 예금
  children.push(sectionHeading("3. 예금"));
  if (data.deposits.length > 0) {
    const w = [500, 2000, 3000, 2000];
    children.push(
      new Table({
        width: { size: 9000, type: WidthType.DXA },
        rows: [
          headerRow(["순번", "은행명", "계좌번호", "잔액"], w),
          ...data.deposits.map((d) =>
            dataRow([String(d.no), d.bankName, d.accountLast4, fmt(d.balance)], w)
          ),
        ],
      })
    );
  } else {
    children.push(p("해당 없음"));
  }

  // 4. 보험
  children.push(sectionHeading("4. 보험"));
  if (data.insurance.length > 0) {
    const w = [500, 2200, 2200, 2000];
    children.push(
      new Table({
        width: { size: 9000, type: WidthType.DXA },
        rows: [
          headerRow(["순번", "보험회사", "보험종류", "해약환급금"], w),
          ...data.insurance.map((ins) =>
            dataRow([String(ins.no), ins.insurerName, ins.insuranceType, fmt(ins.surrenderValue)], w)
          ),
        ],
      })
    );
  } else {
    children.push(p("해당 없음"));
  }

  // 5. 증권
  children.push(sectionHeading("5. 증권"));
  if (data.securities.length > 0) {
    const w = [500, 2200, 2200, 2000];
    children.push(
      new Table({
        width: { size: 9000, type: WidthType.DXA },
        rows: [
          headerRow(["순번", "증권회사", "종목명", "평가금액"], w),
          ...data.securities.map((s) =>
            dataRow([String(s.no), s.brokerName, s.stockName, fmt(s.evalAmount)], w)
          ),
        ],
      })
    );
  } else {
    children.push(p("해당 없음"));
  }

  // 6. 기타재산
  children.push(sectionHeading("6. 기타재산"));
  if (data.otherAssets.length > 0) {
    const w = [500, 4500, 2000];
    children.push(
      new Table({
        width: { size: 9000, type: WidthType.DXA },
        rows: [
          headerRow(["순번", "재산명", "평가액"], w),
          ...data.otherAssets.map((o) =>
            dataRow([String(o.no), o.name, fmt(o.rawValue)], w)
          ),
        ],
      })
    );
  } else {
    children.push(p("해당 없음"));
  }

  // 7. 라이프니츠 현재가치 항목
  const leibnizItems = data.leibnizItems ?? [];
  if (data.hasLeibniz && leibnizItems.length > 0) {
    children.push(sectionHeading("7. 라이프니츠 현재가치 항목"));
    const w = [500, 1500, 1500, 1000, 800, 1500, 2200];
    children.push(
      new Table({
        width: { size: 9500, type: WidthType.DXA },
        rows: [
          headerRow(["순번", "항목", "원래금액", "할인계수", "기간(년)", "현재가치", "산출근거"], w),
          ...leibnizItems.map((lb) =>
            dataRow([String(lb.no), lb.name, fmt(lb.rawValue), lb.factor, String(lb.years), fmt(lb.presentValue), lb.basis], w)
          ),
        ],
      })
    );
    children.push(p(`라이프니츠 현재가치 합계: ${fmt(data.leibnizTotal ?? 0)}원`, { bold: true }));
  }

  // 8. 우선채권 공제
  if (data.priorityClaims && fmt(data.priorityClaims) !== "0") {
    children.push(sectionHeading("8. 우선채권 공제"));
    const pcW = [4500, 3500];
    children.push(
      new Table({
        width: { size: 8000, type: WidthType.DXA },
        rows: [
          headerRow(["항목", "금액"], pcW),
          dataRow(["체납세금", fmt(data.taxDelinquent ?? 0)], pcW),
          dataRow(["임금채권", fmt(data.wageClaim ?? 0)], pcW),
          dataRow(["소액임차보증금", fmt(data.smallDeposit ?? 0)], pcW),
          dataRow(["우선채권 합계", fmt(data.priorityClaims)], pcW),
        ],
      })
    );
  }

  // 청산가치 합계
  children.push(emptyLine());
  if (data.assetLiquidation != null) {
    children.push(p(`재산 청산가치 소계: ${fmt(data.assetLiquidation)}원`));
    if (data.hasLeibniz) {
      children.push(p(`(+) 라이프니츠 현재가치: ${fmt(data.leibnizTotal ?? 0)}원`));
    }
    if (data.priorityClaims && fmt(data.priorityClaims) !== "0") {
      children.push(p(`(-) 우선채권 공제: ${fmt(data.priorityClaims)}원`));
    }
    children.push(p("─────────────────────────────────────"));
  }
  children.push(p(`청산가치 합계: ${fmt(data.totalLiquidationValue)}원`, { bold: true }));
  children.push(...signatureBlock(data.court, data.today, data.clientName));

  const doc = makeDoc(children);
  return await Packer.toBuffer(doc) as unknown as Buffer;
}

// ──────────────────────────────────────────────
// 4. 수입 및 지출에 관한 목록
// ──────────────────────────────────────────────

interface IncFamilyMember {
  no?: number;
  relation: string;
  name: string;
  age: number;
  job?: string;
  income?: V;
  hasIncome?: string;
}

interface IncomeListData {
  clientName: string;
  court: string;
  today: string;
  salary: V;
  businessIncome: V;
  otherIncome: V;
  totalIncome: V;
  rent: V;
  food: V;
  transport: V;
  telecom: V;
  education: V;
  medical: V;
  insurancePremium: V;
  otherExpense?: V;
  totalExpense: V;
  medianIncome: V;
  livingCostBasis: V;
  family: number;
  familyMembers: IncFamilyMember[];
  availableIncome: V;
  monthlyPayment: V;
}

export async function createIncomeListDoc(data: IncomeListData): Promise<Buffer> {
  const amountW = [5000, 3000];

  const incomeRows: TableRow[] = [
    headerRow(["항목", "금액(원)"], amountW),
    dataRow(["급여", fmt(data.salary)], amountW),
    dataRow(["사업소득", fmt(data.businessIncome)], amountW),
    dataRow(["기타소득", fmt(data.otherIncome)], amountW),
    dataRow(["합계", fmt(data.totalIncome)], amountW),
  ];

  const expenseRows: TableRow[] = [
    headerRow(["항목", "금액(원)"], amountW),
    dataRow(["주거비", fmt(data.rent)], amountW),
    dataRow(["식비", fmt(data.food)], amountW),
    dataRow(["교통비", fmt(data.transport)], amountW),
    dataRow(["통신비", fmt(data.telecom)], amountW),
    dataRow(["교육비", fmt(data.education)], amountW),
    dataRow(["의료비", fmt(data.medical)], amountW),
    dataRow(["보험료", fmt(data.insurancePremium)], amountW),
    dataRow(["기타", fmt(data.otherExpense ?? 0)], amountW),
    dataRow(["합계", fmt(data.totalExpense)], amountW),
  ];

  const familyW = [1500, 2000, 1000, 1500];
  const familyRows: TableRow[] = [
    headerRow(["관계", "성명", "나이", "소득여부"], familyW),
    ...data.familyMembers.map((m) =>
      dataRow([m.relation, m.name, String(m.age), m.hasIncome ?? (m.income ? "유" : "무")], familyW)
    ),
  ];

  const children: (Paragraph | Table)[] = [
    createTitle("수입 및 지출에 관한 목록"),
    p(`채무자: ${data.clientName}`, { bold: true }),
    emptyLine(),
    sectionHeading("1. 수입 내역"),
    new Table({ width: { size: 8000, type: WidthType.DXA }, rows: incomeRows }),
    sectionHeading("2. 지출 내역"),
    new Table({ width: { size: 8000, type: WidthType.DXA }, rows: expenseRows }),
    sectionHeading("3. 가족 구성원"),
    p(`가족 수: ${data.family}명`),
    new Table({ width: { size: 6000, type: WidthType.DXA }, rows: familyRows }),
    sectionHeading("4. 가용소득 산출"),
    p(`기준중위소득 (${data.family}인 가구): ${fmt(data.medianIncome)}원`),
    p(`생계비 기준: ${fmt(data.livingCostBasis)}원`),
    emptyLine(),
    p(`총 수입: ${fmt(data.totalIncome)}원`),
    p(`(-) 생계비 기준: ${fmt(data.livingCostBasis)}원`),
    p(`(-) 기타 지출: ${fmt(data.totalExpense)}원`),
    p("─────────────────────────────────────"),
    p(`가용소득: ${fmt(data.availableIncome)}원`, { bold: true }),
    emptyLine(),
    p(`월 변제금: ${fmt(data.monthlyPayment)}원`, { bold: true }),
    ...signatureBlock(data.court, data.today, data.clientName),
  ];

  const doc = makeDoc(children);
  return await Packer.toBuffer(doc) as unknown as Buffer;
}

// ──────────────────────────────────────────────
// 5. 변제계획안
// ──────────────────────────────────────────────

interface CreditorShare {
  no?: number;
  creditor: string;
  debtAmount: V;
  sharePercent?: V;
  shareRate?: V;
  monthlyShare: V;
  totalShare: V;
}

interface RepayScheduleEntry {
  round: number;
  date?: string;
  payDate?: string;
  amount?: V;
  payAmount?: V;
  cumulative?: V;
  cumulativeAmount?: V;
}

interface RepayPlanData {
  clientName: string;
  court: string;
  today: string;
  repayPeriodMonths: number;
  disposableMonthly?: V;
  disposableTotal?: V;
  netLiquidation?: V;
  isLiquidationAdjusted?: boolean;
  adjustedNote?: string;
  monthlyPayment: V;
  totalRepay: V;
  totalDebt?: V;
  repayRate: V;
  creditorShares: CreditorShare[];
  repaySchedule: RepayScheduleEntry[];
}

export async function createRepayPlanDoc(data: RepayPlanData): Promise<Buffer> {
  // 1. Summary table
  const summaryW = [3000, 5000];
  const summaryRows: TableRow[] = [
    headerRow(["항목", "내용"], summaryW),
    dataRow(["변제기간", `${data.repayPeriodMonths}개월`], summaryW),
    dataRow(["월 변제금", `${fmt(data.monthlyPayment)}원`], summaryW),
    dataRow(["총 변제금", `${fmt(data.totalRepay)}원`], summaryW),
    dataRow(["변제율", `${data.repayRate}%`], summaryW),
  ];

  // 2. Creditor shares table
  const csW = [1800, 1800, 1200, 1400, 1400];
  const csRows: TableRow[] = [
    headerRow(["채권자", "채무액", "배당비율(%)", "월 배당액", "총 배당액"], csW),
    ...data.creditorShares.map((c) =>
      dataRow([c.creditor, fmt(c.debtAmount), String(c.sharePercent ?? c.shareRate ?? ""), fmt(c.monthlyShare), fmt(c.totalShare)], csW)
    ),
  ];

  // 3. Schedule table
  const schW = [1000, 2500, 2000, 2500];
  const schRows: TableRow[] = [
    headerRow(["회차", "변제일", "변제금액", "누적변제금액"], schW),
    ...data.repaySchedule.map((s) =>
      dataRow([String(s.round), s.payDate ?? s.date ?? "", fmt(s.payAmount ?? s.amount ?? 0), fmt(s.cumulativeAmount ?? s.cumulative ?? 0)], schW)
    ),
  ];

  const children: (Paragraph | Table)[] = [
    createTitle("변 제 계 획 안"),
    p(`채무자: ${data.clientName}`, { bold: true }),
    emptyLine(),
    sectionHeading("1. 변제계획 요약"),
    new Table({ width: { size: 8000, type: WidthType.DXA }, rows: summaryRows }),
  ];

  // 청산가치 보장원칙 설명
  if (data.disposableMonthly != null || data.netLiquidation != null) {
    children.push(emptyLine());
    if (data.disposableMonthly != null) {
      children.push(p(`가용소득 (월): ${fmt(data.disposableMonthly)}원`));
    }
    if (data.disposableTotal != null) {
      children.push(p(`가용소득 총액 (${data.repayPeriodMonths}개월): ${fmt(data.disposableTotal)}원`));
    }
    if (data.netLiquidation != null) {
      children.push(p(`청산가치: ${fmt(data.netLiquidation)}원`));
    }
    if (data.isLiquidationAdjusted && data.adjustedNote) {
      children.push(emptyLine());
      children.push(p(`※ ${data.adjustedNote}`, { bold: true }));
    }
    if (data.totalDebt != null) {
      children.push(p(`총 채무액: ${fmt(data.totalDebt)}원`));
    }
  }

  children.push(
    sectionHeading("2. 채권자별 변제 비율"),
    new Table({ width: { size: 9000, type: WidthType.DXA }, rows: csRows }),
    sectionHeading("3. 변제예정액표"),
    new Table({ width: { size: 8000, type: WidthType.DXA }, rows: schRows }),
    ...signatureBlock(data.court, data.today, data.clientName),
  );

  const doc = makeDoc(children);
  return await Packer.toBuffer(doc) as unknown as Buffer;
}

// ──────────────────────────────────────────────
// 6. 진술서
// ──────────────────────────────────────────────

interface TransferItem { no?: number; date: string; target?: string; recipient?: string; amount: V; reason: string; }
interface CashItem { no?: number; date: string; amount: V; purpose: string; }
interface CardItem { no?: number; date: string; store?: string; merchant?: string; amount: V; category?: string; }
interface InsuranceCancelItem { no?: number; date?: string; cancelDate?: string; company?: string; insurer?: string; type?: string; surrenderValue: V; }
interface InvestmentLossItem { no?: number; type: string; amount?: V; lossAmount?: V; period: string; }
interface GamblingLossItem { no?: number; type: string; amount?: V; lossAmount?: V; period: string; }

interface StatementData {
  clientName: string;
  clientSSN?: string;
  clientAddr?: string;
  court: string;
  today: string;
  debtHistory?: string;
  debtCause?: string;
  debtTimeline?: string;
  propertyChanges2yr?: string;
  repayEfforts?: string;
  futureIncomePlan?: string;
  hasNewDebts1yr: boolean;
  newDebts1yr: { creditor: string; date: string; amount: number; purpose: string }[];
  hasLargeTransfers: boolean;
  largeTransfers: TransferItem[];
  hasCashWithdrawals: boolean;
  cashWithdrawals: CashItem[];
  hasLargeCardUsage: boolean;
  largeCardUsage: CardItem[];
  hasCancelledInsurance: boolean;
  cancelledInsurance: InsuranceCancelItem[];
  hasInvestmentLosses: boolean;
  investmentLosses: InvestmentLossItem[];
  hasGamblingLosses: boolean;
  gamblingLosses: GamblingLossItem[];
  divorced2yr?: string | boolean;
  jobChange1yr?: boolean;
  jobChangeDetail?: string;
  garnishment?: boolean;
  garnishmentDetail?: string;
  priorApplication?: boolean;
  priorApplicationDetail?: string;
  creditEducation?: string | boolean;
  repayWillingness?: string;
}

export async function createStatementDoc(data: StatementData): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  children.push(createTitle("진 술 서"));
  children.push(
    kvTable([
      ["성명", data.clientName],
      ["주민등록번호", data.clientSSN ?? ""],
      ["주소", data.clientAddr ?? ""],
    ])
  );
  children.push(emptyLine());

  // Q1 — 채무 경위
  children.push(sectionHeading("Q1. 채무 발생 경위를 기재하시오."));
  children.push(p(data.debtHistory ?? data.debtCause ?? "(기재 없음)"));

  // Q2 — 재산 변동
  children.push(sectionHeading("Q2. 최근 2년간 재산 변동 사항을 기재하시오."));
  children.push(p(data.propertyChanges2yr ?? data.debtTimeline ?? "(기재 없음)"));

  // Q3 — 최근 1년 이내 신규 차입
  children.push(sectionHeading("Q3. 최근 1년 이내 신규 차입이 있습니까?"));
  if (data.hasNewDebts1yr && data.newDebts1yr.length > 0) {
    children.push(p("예"));
    const w = [1800, 1200, 1500, 2500];
    children.push(
      new Table({
        width: { size: 7000, type: WidthType.DXA },
        rows: [
          headerRow(["채권자", "차입일", "금액", "용도"], w),
          ...data.newDebts1yr.map((d) =>
            dataRow([d.creditor, d.date, fmt(d.amount), d.purpose], w)
          ),
        ],
      })
    );
  } else {
    children.push(p("아니오"));
  }

  // Q4 — 대규모 재산이전
  children.push(sectionHeading("Q4. 최근 2년간 대규모 재산이전이 있습니까?"));
  if (data.hasLargeTransfers && data.largeTransfers.length > 0) {
    children.push(p("예"));
    const w = [1200, 1800, 1500, 2500];
    children.push(
      new Table({
        width: { size: 7000, type: WidthType.DXA },
        rows: [
          headerRow(["일자", "대상", "금액", "사유"], w),
          ...data.largeTransfers.map((t) =>
            dataRow([t.date, t.target ?? t.recipient ?? "", fmt(t.amount), t.reason], w)
          ),
        ],
      })
    );
  } else {
    children.push(p("아니오"));
  }

  // Q5 — 대규모 현금 인출
  children.push(sectionHeading("Q5. 최근 1년간 대규모 현금 인출이 있습니까?"));
  if (data.hasCashWithdrawals && data.cashWithdrawals.length > 0) {
    children.push(p("예"));
    const w = [1500, 2000, 3500];
    children.push(
      new Table({
        width: { size: 7000, type: WidthType.DXA },
        rows: [
          headerRow(["일자", "금액", "용도"], w),
          ...data.cashWithdrawals.map((c) =>
            dataRow([c.date, fmt(c.amount), c.purpose], w)
          ),
        ],
      })
    );
  } else {
    children.push(p("아니오"));
  }

  // Q6 — 대규모 카드 사용
  children.push(sectionHeading("Q6. 최근 1년간 대규모 카드 사용이 있습니까?"));
  if (data.hasLargeCardUsage && data.largeCardUsage.length > 0) {
    children.push(p("예"));
    const w = [1500, 3000, 2500];
    children.push(
      new Table({
        width: { size: 7000, type: WidthType.DXA },
        rows: [
          headerRow(["일자", "가맹점", "금액"], w),
          ...data.largeCardUsage.map((c) =>
            dataRow([c.date, c.store ?? c.merchant ?? "", fmt(c.amount)], w)
          ),
        ],
      })
    );
  } else {
    children.push(p("아니오"));
  }

  // Q7 — 보험 해약
  children.push(sectionHeading("Q7. 최근 2년간 보험을 해약한 사실이 있습니까?"));
  if (data.hasCancelledInsurance && data.cancelledInsurance.length > 0) {
    children.push(p("예"));
    const w = [1200, 1800, 1800, 2000];
    children.push(
      new Table({
        width: { size: 7000, type: WidthType.DXA },
        rows: [
          headerRow(["일자", "보험회사", "보험종류", "해약환급금"], w),
          ...data.cancelledInsurance.map((ins) =>
            dataRow([ins.cancelDate ?? ins.date ?? "", ins.insurer ?? ins.company ?? "", ins.type ?? "", fmt(ins.surrenderValue)], w)
          ),
        ],
      })
    );
  } else {
    children.push(p("아니오"));
  }

  // Q8 — 투자 손실
  children.push(sectionHeading("Q8. 투자로 인한 손실이 있습니까?"));
  if (data.hasInvestmentLosses && data.investmentLosses.length > 0) {
    children.push(p("예"));
    const w = [2000, 2500, 2500];
    children.push(
      new Table({
        width: { size: 7000, type: WidthType.DXA },
        rows: [
          headerRow(["투자종류", "손실금액", "기간"], w),
          ...data.investmentLosses.map((inv) =>
            dataRow([inv.type, fmt(inv.lossAmount ?? inv.amount ?? 0), inv.period], w)
          ),
        ],
      })
    );
  } else {
    children.push(p("아니오"));
  }

  // Q9 — 도박 손실
  children.push(sectionHeading("Q9. 도박 등으로 인한 손실이 있습니까?"));
  if (data.hasGamblingLosses && data.gamblingLosses.length > 0) {
    children.push(p("예"));
    const w = [2000, 2500, 2500];
    children.push(
      new Table({
        width: { size: 7000, type: WidthType.DXA },
        rows: [
          headerRow(["종류", "손실금액", "기간"], w),
          ...data.gamblingLosses.map((g) =>
            dataRow([g.type, fmt(g.lossAmount ?? g.amount ?? 0), g.period], w)
          ),
        ],
      })
    );
  } else {
    children.push(p("아니오"));
  }

  // Q10 — 이혼
  children.push(sectionHeading("Q10. 최근 2년간 이혼한 사실이 있습니까?"));
  children.push(p(typeof data.divorced2yr === "boolean" ? (data.divorced2yr ? "예" : "아니오") : (data.divorced2yr ?? "아니오")));

  // Q11 — 직업 변동
  children.push(sectionHeading("Q11. 최근 1년간 직업 변동이 있습니까?"));
  if (data.jobChange1yr) {
    children.push(p("예"));
    children.push(p(data.jobChangeDetail ?? ""));
  } else {
    children.push(p("아니오"));
  }

  // Q12 — 압류/추심
  children.push(sectionHeading("Q12. 현재 압류 또는 추심을 받고 있습니까?"));
  if (data.garnishment) {
    children.push(p("예"));
    children.push(p(data.garnishmentDetail ?? ""));
  } else {
    children.push(p("아니오"));
  }

  // Q13 — 과거 신청 이력
  children.push(sectionHeading("Q13. 과거에 개인회생/파산을 신청한 적이 있습니까?"));
  if (data.priorApplication) {
    children.push(p("예"));
    children.push(p(data.priorApplicationDetail ?? ""));
  } else {
    children.push(p("아니오"));
  }

  // 신용교육
  children.push(emptyLine());
  children.push(p(`신용회복위원회 채무자교육 이수 여부: ${typeof data.creditEducation === "boolean" ? (data.creditEducation ? "예" : "아니오") : (data.creditEducation ?? "미확인")}`, { bold: true }));

  // 변제 의지
  children.push(sectionHeading("변제 의지"));
  children.push(p(data.repayWillingness ?? data.futureIncomePlan ?? "(기재 없음)"));

  // 서약
  children.push(emptyLine());
  children.push(p("위 내용은 사실과 다름이 없음을 서약합니다.", { bold: true, alignment: AlignmentType.CENTER }));

  children.push(...signatureBlock(data.court, data.today, data.clientName));

  const doc = makeDoc(children);
  return await Packer.toBuffer(doc) as unknown as Buffer;
}

// ──────────────────────────────────────────────
// Main dispatcher
// ──────────────────────────────────────────────

export async function buildDocx(
  docType: string,
  data: Record<string, unknown>
): Promise<Buffer> {
  switch (docType) {
    case "application":
      return createApplicationDoc(data as unknown as ApplicationData);
    case "debt_list":
      return createDebtListDoc(data as unknown as DebtListData);
    case "asset_list":
      return createAssetListDoc(data as unknown as AssetListData);
    case "income_list":
      return createIncomeListDoc(data as unknown as IncomeListData);
    case "repay_plan":
      return createRepayPlanDoc(data as unknown as RepayPlanData);
    case "statement":
      return createStatementDoc(data as unknown as StatementData);
    default:
      throw new Error(`Unknown document type: ${docType}`);
  }
}
