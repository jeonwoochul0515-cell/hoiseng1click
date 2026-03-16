"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STOCK_ORGS = void 0;
exports.handleCardApprovals = handleCardApprovals;
exports.handleCardBills = handleCardBills;
exports.handleBankTransactions = handleBankTransactions;
exports.handleStockAccounts = handleStockAccounts;
exports.handleStockAssets = handleStockAssets;
exports.handleStockTransactions = handleStockTransactions;
exports.handleExtendedFinanceCollect = handleExtendedFinanceCollect;
// ---------------------------------------------------------------------------
// Config & Auth helpers (self-contained, mirrors codefProxy.ts)
// ---------------------------------------------------------------------------
const OAUTH_URL = "https://oauth.codef.io/oauth/token";
function getCodefBase() {
    return process.env.CODEF_API_HOST || "https://development.codef.io";
}
let cachedToken = null;
async function getToken() {
    if (cachedToken && cachedToken.expiry > Date.now()) {
        return cachedToken.token;
    }
    const creds = Buffer.from(`${process.env.CODEF_CLIENT_ID ?? ""}:${process.env.CODEF_CLIENT_SECRET ?? ""}`).toString("base64");
    const res = await fetch(OAUTH_URL, {
        method: "POST",
        headers: {
            Authorization: `Basic ${creds}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials&scope=read",
    });
    if (!res.ok) {
        throw new Error(`CODEF OAuth failed: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json());
    if (!data.access_token) {
        throw new Error("CODEF OAuth response missing access_token");
    }
    cachedToken = { token: data.access_token, expiry: Date.now() + 6 * 24 * 60 * 60 * 1000 };
    return cachedToken.token;
}
async function callCodef(token, endpoint, body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const jsonBody = JSON.stringify(body);
    console.log(`[CODEF-FINANCE] Calling endpoint: ${endpoint}`);
    try {
        const res = await fetch(`${getCodefBase()}${endpoint}`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: jsonBody,
            signal: controller.signal,
        });
        clearTimeout(timeout);
        const text = await res.text();
        try {
            return JSON.parse(text);
        }
        catch {
            return JSON.parse(decodeURIComponent(text.replace(/\+/g, " ")));
        }
    }
    catch (err) {
        clearTimeout(timeout);
        const message = err instanceof Error ? err.message : "CODEF API 호출 실패";
        throw new Error(`CODEF API error on ${endpoint}: ${message}`);
    }
}
// ---------------------------------------------------------------------------
// 증권사 기관코드
// ---------------------------------------------------------------------------
exports.STOCK_ORGS = {
    "키움증권": "0264",
    "미래에셋증권": "0240",
    "삼성증권": "0218",
    "NH투자증권": "0247",
    "한국투자증권": "0243",
    "대신증권": "0267",
    "신한투자증권": "0278",
    "KB증권": "0261",
    "하나증권": "0270",
    "토스증권": "0271",
};
// ---------------------------------------------------------------------------
// 날짜 헬퍼
// ---------------------------------------------------------------------------
function fmtDate(d) {
    return d.toISOString().slice(0, 10).replace(/-/g, "");
}
function defaultDateRange() {
    const now = new Date();
    const ago1y = new Date(now);
    ago1y.setFullYear(now.getFullYear() - 1);
    return { startDate: fmtDate(ago1y), endDate: fmtDate(now) };
}
// ---------------------------------------------------------------------------
// 파싱 헬퍼 — 카드
// ---------------------------------------------------------------------------
function parseCardApprovals(raw) {
    const list = raw?.data?.resList ?? [];
    return list.map((item) => ({
        approvalDate: item.resApprovalDate ?? "",
        approvalAmount: Number(item.resApprovalAmount ?? 0),
        merchantName: item.resMerchantName ?? "",
        cardNo: item.resCardNo ?? "",
        approvalStatus: item.resApprovalStatus ?? "",
        approvalNo: item.resApprovalNo ?? "",
        installmentCount: item.resInstallmentCount ?? "0",
        currency: item.resCurrency ?? "KRW",
    }));
}
function parseCardBills(raw) {
    const list = raw?.data?.resList ?? [];
    return list.map((item) => ({
        billingDate: item.resBillingDate ?? "",
        billingAmount: Number(item.resBillingAmount ?? 0),
        cardNo: item.resCardNo ?? "",
        merchantName: item.resMerchantName ?? "",
        installmentCount: item.resInstallmentCount ?? "0",
        currentInstallment: item.resCurrentInstallment ?? "0",
        principalAmount: Number(item.resPrincipalAmount ?? 0),
        interestAmount: Number(item.resInterestAmount ?? 0),
    }));
}
// ---------------------------------------------------------------------------
// 파싱 헬퍼 — 은행 거래내역
// ---------------------------------------------------------------------------
function parseBankTransactions(raw) {
    const list = raw?.data?.resList ?? [];
    return list.map((tx) => ({
        transactionDate: tx.resAccountTrDate ?? "",
        transactionTime: tx.resAccountTrTime ?? "",
        transactionType: tx.resAccountTrType ?? "",
        amount: Number(tx.resAccountTrAmount ?? tx.resAccountOut ?? tx.resAccountIn ?? 0),
        balance: Number(tx.resAccountBalance ?? 0),
        description: tx.resAccountDesc ?? "",
        memo: tx.resAccountMemo ?? "",
        accountNo: tx.resAccountNum ?? "",
    }));
}
// ---------------------------------------------------------------------------
// 파싱 헬퍼 — 증권
// ---------------------------------------------------------------------------
function parseStockAccounts(raw) {
    const list = raw?.data?.resList ?? [];
    return list.map((acc) => ({
        accountNo: acc.resAccountNo ?? acc.resAccount ?? "",
        accountName: acc.resAccountName ?? "",
        accountType: acc.resAccountType ?? "",
        openDate: acc.resOpenDate ?? "",
        status: acc.resAccountStatus ?? "",
    }));
}
function parseStockHoldings(raw) {
    const data = raw?.data ?? {};
    const list = data.resList ?? [];
    const depositBalance = Number(data.resDepositBalance ?? data.resDepositReceived ?? 0);
    const holdings = list.map((item) => {
        const purchaseAmount = Number(item.resPurchaseAmount ?? 0);
        const evaluationAmount = Number(item.resEvaluationAmount ?? 0);
        const profitLoss = evaluationAmount - purchaseAmount;
        const profitLossRate = purchaseAmount > 0 ? (profitLoss / purchaseAmount) * 100 : 0;
        return {
            stockCode: item.resStockCode ?? item.resItemCode ?? "",
            stockName: item.resStockName ?? item.resItemName ?? "",
            quantity: Number(item.resQuantity ?? item.resHoldingQuantity ?? 0),
            purchaseAmount,
            evaluationAmount,
            profitLoss,
            profitLossRate: Math.round(profitLossRate * 100) / 100,
            currentPrice: Number(item.resCurrentPrice ?? 0),
        };
    });
    return { holdings, depositBalance };
}
function parseStockTransactions(raw) {
    const list = raw?.data?.resList ?? [];
    return list.map((tx) => ({
        transactionDate: tx.resTransactionDate ?? tx.resTrDate ?? "",
        transactionType: tx.resTransactionType ?? tx.resTrType ?? "",
        stockCode: tx.resStockCode ?? tx.resItemCode ?? "",
        stockName: tx.resStockName ?? tx.resItemName ?? "",
        quantity: Number(tx.resQuantity ?? 0),
        unitPrice: Number(tx.resUnitPrice ?? 0),
        amount: Number(tx.resAmount ?? tx.resTrAmount ?? 0),
        fee: Number(tx.resFee ?? tx.resCommission ?? 0),
        tax: Number(tx.resTax ?? 0),
    }));
}
// ===========================================================================
// 핸들러 1: 카드 승인내역 조회
// POST /codef/card-approvals
// ===========================================================================
async function handleCardApprovals(req, res) {
    try {
        const { connectedId, startDate, endDate } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId가 필요합니다" });
            return;
        }
        const dates = startDate && endDate
            ? { startDate, endDate }
            : defaultDateRange();
        const token = await getToken();
        const raw = await callCodef(token, "/v1/kr/card/p/account/approval-list", {
            connectedId,
            startDate: dates.startDate,
            endDate: dates.endDate,
        });
        const approvals = parseCardApprovals(raw);
        const totalAmount = approvals.reduce((sum, a) => sum + a.approvalAmount, 0);
        const result = {
            connectedId,
            startDate: dates.startDate,
            endDate: dates.endDate,
            approvals,
            summary: {
                totalCount: approvals.length,
                totalAmount,
            },
        };
        res.json(result);
    }
    catch (err) {
        console.error("[handleCardApprovals]", err);
        res.status(500).json({ error: err.message ?? "카드 승인내역 조회 실패" });
    }
}
// ===========================================================================
// 핸들러 2: 카드 청구내역 조회
// POST /codef/card-bills
// ===========================================================================
async function handleCardBills(req, res) {
    try {
        const { connectedId, startDate, endDate } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId가 필요합니다" });
            return;
        }
        const dates = startDate && endDate
            ? { startDate, endDate }
            : defaultDateRange();
        const token = await getToken();
        const raw = await callCodef(token, "/v1/kr/card/p/account/billing-list", {
            connectedId,
            startDate: dates.startDate,
            endDate: dates.endDate,
        });
        const bills = parseCardBills(raw);
        const totalAmount = bills.reduce((sum, b) => sum + b.billingAmount, 0);
        const result = {
            connectedId,
            startDate: dates.startDate,
            endDate: dates.endDate,
            bills,
            summary: {
                totalCount: bills.length,
                totalAmount,
            },
        };
        res.json(result);
    }
    catch (err) {
        console.error("[handleCardBills]", err);
        res.status(500).json({ error: err.message ?? "카드 청구내역 조회 실패" });
    }
}
// ===========================================================================
// 핸들러 3: 은행 거래내역 조회
// POST /codef/bank-transactions
// ===========================================================================
async function handleBankTransactions(req, res) {
    try {
        const { connectedId, startDate, endDate } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId가 필요합니다" });
            return;
        }
        const dates = startDate && endDate
            ? { startDate, endDate }
            : defaultDateRange();
        const token = await getToken();
        const raw = await callCodef(token, "/v1/kr/bank/p/account/transaction-list", {
            connectedId,
            startDate: dates.startDate,
            endDate: dates.endDate,
        });
        const transactions = parseBankTransactions(raw);
        let totalDeposit = 0;
        let totalWithdrawal = 0;
        for (const tx of transactions) {
            const type = tx.transactionType;
            if (type.includes("입금") || type.includes("이체입") || type === "입") {
                totalDeposit += tx.amount;
            }
            else {
                totalWithdrawal += tx.amount;
            }
        }
        const result = {
            connectedId,
            startDate: dates.startDate,
            endDate: dates.endDate,
            transactions,
            summary: {
                totalCount: transactions.length,
                totalDeposit,
                totalWithdrawal,
            },
        };
        res.json(result);
    }
    catch (err) {
        console.error("[handleBankTransactions]", err);
        res.status(500).json({ error: err.message ?? "은행 거래내역 조회 실패" });
    }
}
// ===========================================================================
// 핸들러 4: 증권 보유계좌 조회
// POST /codef/stock-accounts
// ===========================================================================
async function handleStockAccounts(req, res) {
    try {
        const { connectedId } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId가 필요합니다" });
            return;
        }
        const token = await getToken();
        const raw = await callCodef(token, "/v1/kr/stock/a/account", {
            connectedId,
        });
        const accounts = parseStockAccounts(raw);
        const result = {
            connectedId,
            accounts,
            summary: {
                totalCount: accounts.length,
            },
        };
        res.json(result);
    }
    catch (err) {
        console.error("[handleStockAccounts]", err);
        res.status(500).json({ error: err.message ?? "증권 보유계좌 조회 실패" });
    }
}
// ===========================================================================
// 핸들러 5: 증권 종합자산 조회
// POST /codef/stock-assets
// ===========================================================================
async function handleStockAssets(req, res) {
    try {
        const { connectedId } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId가 필요합니다" });
            return;
        }
        const token = await getToken();
        const raw = await callCodef(token, "/v1/kr/stock/a/account/asset", {
            connectedId,
        });
        const { holdings, depositBalance } = parseStockHoldings(raw);
        const totalPurchaseAmount = holdings.reduce((sum, h) => sum + h.purchaseAmount, 0);
        const totalEvaluationAmount = holdings.reduce((sum, h) => sum + h.evaluationAmount, 0);
        const result = {
            connectedId,
            holdings,
            summary: {
                totalCount: holdings.length,
                totalPurchaseAmount,
                totalEvaluationAmount,
                totalProfitLoss: totalEvaluationAmount - totalPurchaseAmount,
                depositBalance,
            },
        };
        res.json(result);
    }
    catch (err) {
        console.error("[handleStockAssets]", err);
        res.status(500).json({ error: err.message ?? "증권 종합자산 조회 실패" });
    }
}
// ===========================================================================
// 핸들러 6: 증권 거래내역 조회
// POST /codef/stock-transactions
// ===========================================================================
async function handleStockTransactions(req, res) {
    try {
        const { connectedId, startDate, endDate } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId가 필요합니다" });
            return;
        }
        const dates = startDate && endDate
            ? { startDate, endDate }
            : defaultDateRange();
        const token = await getToken();
        const raw = await callCodef(token, "/v1/kr/stock/a/account/transaction-list", {
            connectedId,
            startDate: dates.startDate,
            endDate: dates.endDate,
        });
        const transactions = parseStockTransactions(raw);
        let totalBuyAmount = 0;
        let totalSellAmount = 0;
        for (const tx of transactions) {
            const type = tx.transactionType;
            if (type.includes("매수") || type.includes("buy") || type === "1") {
                totalBuyAmount += tx.amount;
            }
            else if (type.includes("매도") || type.includes("sell") || type === "2") {
                totalSellAmount += tx.amount;
            }
        }
        const result = {
            connectedId,
            startDate: dates.startDate,
            endDate: dates.endDate,
            transactions,
            summary: {
                totalCount: transactions.length,
                totalBuyAmount,
                totalSellAmount,
            },
        };
        res.json(result);
    }
    catch (err) {
        console.error("[handleStockTransactions]", err);
        res.status(500).json({ error: err.message ?? "증권 거래내역 조회 실패" });
    }
}
// ===========================================================================
// 핸들러 7: 금융 확장 수집 통합
// POST /codef/extended-collect
// 카드승인 + 은행거래 + 증권자산을 병렬 호출하여 통합 결과 반환
// ===========================================================================
async function handleExtendedFinanceCollect(req, res) {
    try {
        const { connectedId, startDate, endDate } = req.body;
        if (!connectedId) {
            res.status(400).json({ error: "connectedId가 필요합니다" });
            return;
        }
        const dates = startDate && endDate
            ? { startDate, endDate }
            : defaultDateRange();
        const token = await getToken();
        const dateBody = { connectedId, startDate: dates.startDate, endDate: dates.endDate };
        const idBody = { connectedId };
        const [cardResult, bankResult, stockResult] = await Promise.allSettled([
            callCodef(token, "/v1/kr/card/p/account/approval-list", dateBody),
            callCodef(token, "/v1/kr/bank/p/account/transaction-list", dateBody),
            callCodef(token, "/v1/kr/stock/a/account/asset", idBody),
        ]);
        const errors = [];
        const getValue = (r, label) => {
            if (r.status === "fulfilled")
                return r.value;
            errors.push(`${label}: ${r.reason?.message ?? "호출 실패"}`);
            return null;
        };
        const cardRaw = getValue(cardResult, "카드승인내역");
        const bankRaw = getValue(bankResult, "은행거래내역");
        const stockRaw = getValue(stockResult, "증권자산");
        const cardApprovals = cardRaw ? parseCardApprovals(cardRaw) : null;
        const bankTransactions = bankRaw ? parseBankTransactions(bankRaw) : null;
        let stockAssets = null;
        if (stockRaw) {
            const { holdings, depositBalance } = parseStockHoldings(stockRaw);
            const totalPurchaseAmount = holdings.reduce((sum, h) => sum + h.purchaseAmount, 0);
            const totalEvaluationAmount = holdings.reduce((sum, h) => sum + h.evaluationAmount, 0);
            stockAssets = {
                connectedId,
                holdings,
                summary: {
                    totalCount: holdings.length,
                    totalPurchaseAmount,
                    totalEvaluationAmount,
                    totalProfitLoss: totalEvaluationAmount - totalPurchaseAmount,
                    depositBalance,
                },
            };
        }
        const result = {
            connectedId,
            cardApprovals,
            bankTransactions,
            stockAssets,
            errors,
            summary: {
                cardApprovalTotal: cardApprovals
                    ? cardApprovals.reduce((sum, a) => sum + a.approvalAmount, 0)
                    : 0,
                bankTransactionCount: bankTransactions ? bankTransactions.length : 0,
                stockEvaluationTotal: stockAssets
                    ? stockAssets.summary.totalEvaluationAmount
                    : 0,
            },
        };
        res.json(result);
    }
    catch (err) {
        console.error("[handleExtendedFinanceCollect]", err);
        res.status(500).json({ error: err.message ?? "금융 확장 수집 실패" });
    }
}
//# sourceMappingURL=codefFinance.js.map