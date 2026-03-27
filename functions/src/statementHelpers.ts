import type { Request, Response } from "express";

// ---------------------------------------------------------------------------
// 인터페이스 정의
// ---------------------------------------------------------------------------
export interface NewDebtItem {
  date: string;
  creditor: string;
  type: string;
  amount: number;
  rate: number;
}

export interface LargeTransferItem {
  date: string;
  account: string;
  amount: number;
  recipient: string;
  memo: string;
  category: "송금" | "이체" | "대출상환" | "기타";
}

export interface CashWithdrawalItem {
  date: string;
  account: string;
  amount: number;
  memo: string;
  method: "ATM" | "창구" | "수표" | "기타";
}

export interface LargeCardItem {
  date: string;
  cardNo: string;
  amount: number;
  merchant: string;
  category: string; // 가맹점 업종 분류
}

export interface CancelledInsuranceItem {
  company: string;
  productName: string;
  cancelDate: string;
  monthlyPremium: number;
  refundAmount: number;
  status: string;
}

export interface StockLossItem {
  broker: string; // 증권사
  stockName: string; // 종목명
  buyAmount: number; // 매입금액
  sellAmount: number; // 매도금액
  loss: number; // 손실액
  tradeDate: string;
}

export interface PropertyDisposalItem {
  address: string;
  disposalDate: string;
  amount: number;
  type: "매매" | "경매" | "기타";
}

import { getToken, callCodef } from "./codefProxy";

// ---------------------------------------------------------------------------
// 파싱 함수들
// ---------------------------------------------------------------------------

// Q2: 신규 채무 (1년 이내)
export function parseNewDebts(
  bankLoans: unknown,
  cardLoans: unknown,
  sinceDate: string,
): NewDebtItem[] {
  const results: NewDebtItem[] = [];
  const allLoans = [
    ...((bankLoans as any)?.data?.resList ?? []),
    ...((cardLoans as any)?.data?.resList ?? []),
  ];
  for (const l of allLoans) {
    const dt = l.resLoanDate ?? l.resContractDate ?? "";
    if (dt >= sinceDate) {
      results.push({
        date: dt,
        creditor: l.resBankName ?? l.resCardName ?? "",
        type: l.resLoanName ?? "대출",
        amount: Number(l.resLoanBalance ?? 0),
        rate: Number(l.resLoanInterest ?? 0),
      });
    }
  }
  return results.sort((a, b) => b.date.localeCompare(a.date));
}

// Q4: 200만원 이상 이체
export function parseLargeTransfers(
  bankTxns: unknown,
  threshold: number = 2_000_000,
): LargeTransferItem[] {
  const results: LargeTransferItem[] = [];
  for (const tx of (bankTxns as any)?.data?.resList ?? []) {
    const amt = Number(tx.resAccountTrAmount ?? tx.resAccountOut ?? 0);
    const tp = (tx.resAccountTrType ?? "").toLowerCase();

    // 이체/송금 거래 유형 확장 판별
    const isTransfer =
      tp.includes("이체") ||
      tp.includes("송금") ||
      tp.includes("자동이체") ||
      tp.includes("타행") ||
      tp.includes("무통장") ||
      tp.includes("계좌이체");

    if (amt >= threshold && isTransfer) {
      let category: LargeTransferItem["category"] = "기타";
      if (tp.includes("대출") || tp.includes("상환")) category = "대출상환";
      else if (tp.includes("송금")) category = "송금";
      else category = "이체";

      results.push({
        date: tx.resAccountTrDate ?? "",
        account: tx.resAccountNum ?? "",
        amount: amt,
        recipient: tx.resAccountDesc ?? tx.resAccountContent ?? "",
        memo: tx.resAccountMemo ?? "",
        category,
      });
    }
  }
  return results.sort((a, b) => b.date.localeCompare(a.date));
}

// Q5: 100만원 이상 현금인출
export function parseCashWithdrawals(
  bankTxns: unknown,
  threshold: number = 1_000_000,
): CashWithdrawalItem[] {
  const results: CashWithdrawalItem[] = [];
  for (const tx of (bankTxns as any)?.data?.resList ?? []) {
    const amt = Number(tx.resAccountTrAmount ?? tx.resAccountOut ?? 0);
    const tp = (tx.resAccountTrType ?? "").toLowerCase();

    const isCash =
      tp.includes("현금") ||
      tp.includes("인출") ||
      tp.includes("수표") ||
      tp === "출금" ||
      tp.includes("atm") ||
      tp.includes("cd기");

    if (amt >= threshold && isCash) {
      let method: CashWithdrawalItem["method"] = "기타";
      if (tp.includes("atm") || tp.includes("cd기")) method = "ATM";
      else if (tp.includes("창구")) method = "창구";
      else if (tp.includes("수표")) method = "수표";

      results.push({
        date: tx.resAccountTrDate ?? "",
        account: tx.resAccountNum ?? "",
        amount: amt,
        memo: tx.resAccountMemo ?? "",
        method,
      });
    }
  }
  return results.sort((a, b) => b.date.localeCompare(a.date));
}

// Q6: 100만원 이상 카드사용
export function parseLargeCardUsage(
  cardApprovals: unknown,
  threshold: number = 1_000_000,
): LargeCardItem[] {
  const results: LargeCardItem[] = [];
  for (const tx of (cardApprovals as any)?.data?.resList ?? []) {
    const amt = Number(tx.resApprovalAmount ?? tx.resUsedAmount ?? 0);
    if (amt >= threshold) {
      results.push({
        date: tx.resApprovalDate ?? "",
        cardNo: tx.resCardNo ?? "",
        amount: amt,
        merchant: tx.resMerchantName ?? "",
        category:
          tx.resMerchantCategory ?? tx.resMerchantType ?? "미분류",
      });
    }
  }
  return results.sort((a, b) => b.date.localeCompare(a.date));
}

// Q7: 보험 해약
export function parseCancelledInsurance(
  insurance: unknown,
): CancelledInsuranceItem[] {
  const results: CancelledInsuranceItem[] = [];
  for (const item of (insurance as any)?.data?.resList ?? []) {
    const status = item.resContractStatus ?? "";
    if (
      status.includes("해지") ||
      status.includes("소멸") ||
      status.includes("실효")
    ) {
      results.push({
        company: item.resCompanyName ?? "",
        productName: item.resInsuranceName ?? "",
        cancelDate: item.resCancelDate ?? item.resContractEndDate ?? "",
        monthlyPremium: Number(item.resMonthlyPremium ?? 0),
        refundAmount: Number(item.resSurrenderAmount ?? 0),
        status,
      });
    }
  }
  return results;
}

// Q8: 주식/증권 손실 (새로 추가)
export function parseStockLosses(stockTxns: unknown): StockLossItem[] {
  const results: StockLossItem[] = [];
  // 증권 거래내역에서 매도 거래 중 손실이 발생한 건 추출
  for (const tx of (stockTxns as any)?.data?.resList ?? []) {
    const type = tx.resTransactionType ?? "";
    if (type.includes("매도") || type.includes("출고")) {
      const sellAmt = Number(tx.resTransactionAmount ?? 0);
      const buyAmt = Number(
        tx.resAcquisitionAmount ?? tx.resPurchaseAmount ?? 0,
      );
      if (buyAmt > sellAmt) {
        results.push({
          broker: tx.resCompanyName ?? "",
          stockName: tx.resItemName ?? tx.resStockName ?? "",
          buyAmount: buyAmt,
          sellAmount: sellAmt,
          loss: buyAmt - sellAmt,
          tradeDate: tx.resTransactionDate ?? "",
        });
      }
    }
  }
  return results.sort((a, b) => b.loss - a.loss);
}

// ---------------------------------------------------------------------------
// 통합 핸들러: POST /codef/statement-data-v2
// ---------------------------------------------------------------------------
export async function handleStatementDataV2(
  req: Request,
  res: Response,
): Promise<void> {
  // 이 핸들러는 기존 handleStatementData를 대체
  // connectedId를 받아서 모든 상세 신고서 데이터를 수집
  // 기존 5개 + 증권 손실 추가 = 6개 카테고리

  try {
    const { connectedId } = req.body as { connectedId: string };
    if (!connectedId) {
      res.status(400).json({ error: "connectedId가 필요합니다" });
      return;
    }

    // 샌드박스 모드: 데모 데이터 반환
    const host = process.env.CODEF_API_HOST || "https://development.codef.io";
    const isSandbox = !process.env.CODEF_CLIENT_ID || !process.env.CODEF_CLIENT_SECRET ||
      host.includes("sandbox");

    if (isSandbox) {
      res.json({
        newDebts: [
          { date: "20250815", creditor: "카카오뱅크", type: "신용대출", amount: 10000000, rate: 7.5 },
          { date: "20251102", creditor: "신한카드", type: "카드론", amount: 5000000, rate: 12.3 },
        ],
        largeTransfers: [
          { date: "20260110", account: "110-xxx-1234", amount: 5000000, recipient: "홍길동", memo: "가족 송금", category: "송금" },
          { date: "20260205", account: "110-xxx-1234", amount: 3000000, recipient: "부동산중개", memo: "보증금 반환", category: "이체" },
        ],
        cashWithdrawals: [
          { date: "20260115", account: "110-xxx-1234", amount: 2000000, memo: "생활비", method: "ATM" },
        ],
        largeCardUsage: [
          { date: "20260205", cardNo: "1234-xxxx-xxxx-5678", amount: 2500000, merchant: "○○인테리어", category: "생활서비스" },
          { date: "20260118", cardNo: "9876-xxxx-xxxx-4321", amount: 1500000, merchant: "○○가전", category: "가전/전자" },
        ],
        cancelledInsurance: [
          { company: "삼성생명", productName: "종신보험", cancelDate: "20260101", monthlyPremium: 150000, refundAmount: 3200000, status: "해지" },
        ],
        stockLosses: [
          { broker: "키움증권", stockName: "○○바이오", buyAmount: 5000000, sellAmount: 2800000, loss: 2200000, tradeDate: "20250930" },
        ],
      });
      return;
    }

    // 날짜 범위 (2년)
    const now = new Date();
    const ago2y = new Date(now);
    ago2y.setFullYear(now.getFullYear() - 2);
    const ago1y = new Date(now);
    ago1y.setFullYear(now.getFullYear() - 1);
    const fmt = (d: Date) =>
      d.toISOString().slice(0, 10).replace(/-/g, "");

    const token = await getToken();

    const [bankTxns, cardAppr, insList, bLoans, cLoans, stockTxns] =
      await Promise.allSettled([
        callCodef(
          token,
          "/v1/kr/bank/p/account/transaction-list",
          { connectedId, startDate: fmt(ago2y), endDate: fmt(now) },
        ),
        callCodef(
          token,
          "/v1/kr/card/p/account/approval-list",
          { connectedId, startDate: fmt(ago2y), endDate: fmt(now) },
        ),
        callCodef(
          token,
          "/v1/kr/insurance/p/common/product-list",
          { connectedId },
        ),
        callCodef(
          token,
          "/v1/kr/bank/p/loan/loan-list",
          { connectedId },
        ),
        callCodef(
          token,
          "/v1/kr/card/p/loan/loan-list",
          { connectedId },
        ),
        callCodef(
          token,
          "/v1/kr/stock/a/account/transaction-list",
          { connectedId, startDate: fmt(ago2y), endDate: fmt(now) },
        ),
      ]);

    const g = (r: PromiseSettledResult<unknown>) =>
      r.status === "fulfilled" ? r.value : null;

    res.json({
      newDebts: parseNewDebts(g(bLoans), g(cLoans), fmt(ago1y)),
      largeTransfers: parseLargeTransfers(g(bankTxns)),
      cashWithdrawals: parseCashWithdrawals(g(bankTxns)),
      largeCardUsage: parseLargeCardUsage(g(cardAppr)),
      cancelledInsurance: parseCancelledInsurance(g(insList)),
      stockLosses: parseStockLosses(g(stockTxns)),
    });
  } catch (err: any) {
    res.status(500).json({
      error: err.message ?? "진술서 데이터 수집 실패",
    });
  }
}
