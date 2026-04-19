"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseNewDebts = parseNewDebts;
exports.parseLargeTransfers = parseLargeTransfers;
exports.parseCashWithdrawals = parseCashWithdrawals;
exports.parseLargeCardUsage = parseLargeCardUsage;
exports.parseCancelledInsurance = parseCancelledInsurance;
exports.parseStockLosses = parseStockLosses;
exports.handleStatementDataV2 = handleStatementDataV2;
const codefProxy_1 = require("./codefProxy");
// ---------------------------------------------------------------------------
// 파싱 함수들
// ---------------------------------------------------------------------------
// Q2: 신규 채무 (1년 이내)
function parseNewDebts(bankLoans, cardLoans, sinceDate) {
    const results = [];
    const allLoans = [
        ...(bankLoans?.data?.resList ?? []),
        ...(cardLoans?.data?.resList ?? []),
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
function parseLargeTransfers(bankTxns, threshold = 2_000_000) {
    const results = [];
    for (const tx of bankTxns?.data?.resList ?? []) {
        const amt = Number(tx.resAccountTrAmount ?? tx.resAccountOut ?? 0);
        const tp = (tx.resAccountTrType ?? "").toLowerCase();
        // 이체/송금 거래 유형 확장 판별
        const isTransfer = tp.includes("이체") ||
            tp.includes("송금") ||
            tp.includes("자동이체") ||
            tp.includes("타행") ||
            tp.includes("무통장") ||
            tp.includes("계좌이체");
        if (amt >= threshold && isTransfer) {
            let category = "기타";
            if (tp.includes("대출") || tp.includes("상환"))
                category = "대출상환";
            else if (tp.includes("송금"))
                category = "송금";
            else
                category = "이체";
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
function parseCashWithdrawals(bankTxns, threshold = 1_000_000) {
    const results = [];
    for (const tx of bankTxns?.data?.resList ?? []) {
        const amt = Number(tx.resAccountTrAmount ?? tx.resAccountOut ?? 0);
        const tp = (tx.resAccountTrType ?? "").toLowerCase();
        const isCash = tp.includes("현금") ||
            tp.includes("인출") ||
            tp.includes("수표") ||
            tp === "출금" ||
            tp.includes("atm") ||
            tp.includes("cd기");
        if (amt >= threshold && isCash) {
            let method = "기타";
            if (tp.includes("atm") || tp.includes("cd기"))
                method = "ATM";
            else if (tp.includes("창구"))
                method = "창구";
            else if (tp.includes("수표"))
                method = "수표";
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
function parseLargeCardUsage(cardApprovals, threshold = 1_000_000) {
    const results = [];
    for (const tx of cardApprovals?.data?.resList ?? []) {
        const amt = Number(tx.resApprovalAmount ?? tx.resUsedAmount ?? 0);
        if (amt >= threshold) {
            results.push({
                date: tx.resApprovalDate ?? "",
                cardNo: tx.resCardNo ?? "",
                amount: amt,
                merchant: tx.resMerchantName ?? "",
                category: tx.resMerchantCategory ?? tx.resMerchantType ?? "미분류",
            });
        }
    }
    return results.sort((a, b) => b.date.localeCompare(a.date));
}
// Q7: 보험 해약
function parseCancelledInsurance(insurance) {
    const results = [];
    for (const item of insurance?.data?.resList ?? []) {
        const status = item.resContractStatus ?? "";
        if (status.includes("해지") ||
            status.includes("소멸") ||
            status.includes("실효")) {
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
function parseStockLosses(stockTxns) {
    const results = [];
    // 증권 거래내역에서 매도 거래 중 손실이 발생한 건 추출
    for (const tx of stockTxns?.data?.resList ?? []) {
        const type = tx.resTransactionType ?? "";
        if (type.includes("매도") || type.includes("출고")) {
            const sellAmt = Number(tx.resTransactionAmount ?? 0);
            const buyAmt = Number(tx.resAcquisitionAmount ?? tx.resPurchaseAmount ?? 0);
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
async function handleStatementDataV2(req, res) {
    // 이 핸들러는 기존 handleStatementData를 대체
    // connectedId를 받아서 모든 상세 신고서 데이터를 수집
    // 기존 5개 + 증권 손실 추가 = 6개 카테고리
    try {
        const { connectedId } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId가 필요합니다" });
            return;
        }
        // 날짜 범위 (2년)
        const now = new Date();
        const ago2y = new Date(now);
        ago2y.setFullYear(now.getFullYear() - 2);
        const ago1y = new Date(now);
        ago1y.setFullYear(now.getFullYear() - 1);
        const fmt = (d) => d.toISOString().slice(0, 10).replace(/-/g, "");
        const token = await (0, codefProxy_1.getToken)();
        const [bankTxns, cardAppr, insList, bLoans, cLoans, stockTxns] = await Promise.allSettled([
            (0, codefProxy_1.callCodef)(token, "/v1/kr/bank/p/account/transaction-list", { connectedId, startDate: fmt(ago2y), endDate: fmt(now) }),
            (0, codefProxy_1.callCodef)(token, "/v1/kr/card/p/account/approval-list", { connectedId, startDate: fmt(ago2y), endDate: fmt(now) }),
            (0, codefProxy_1.callCodef)(token, "/v1/kr/insurance/p/common/product-list", { connectedId }),
            (0, codefProxy_1.callCodef)(token, "/v1/kr/bank/p/loan/loan-list", { connectedId }),
            (0, codefProxy_1.callCodef)(token, "/v1/kr/card/p/loan/loan-list", { connectedId }),
            (0, codefProxy_1.callCodef)(token, "/v1/kr/stock/a/account/transaction-list", { connectedId, startDate: fmt(ago2y), endDate: fmt(now) }),
        ]);
        const g = (r) => r.status === "fulfilled" ? r.value : null;
        res.json({
            newDebts: parseNewDebts(g(bLoans), g(cLoans), fmt(ago1y)),
            largeTransfers: parseLargeTransfers(g(bankTxns)),
            cashWithdrawals: parseCashWithdrawals(g(bankTxns)),
            largeCardUsage: parseLargeCardUsage(g(cardAppr)),
            cancelledInsurance: parseCancelledInsurance(g(insList)),
            stockLosses: parseStockLosses(g(stockTxns)),
        });
    }
    catch (err) {
        res.status(500).json({
            error: err.message ?? "진술서 데이터 수집 실패",
        });
    }
}
//# sourceMappingURL=statementHelpers.js.map