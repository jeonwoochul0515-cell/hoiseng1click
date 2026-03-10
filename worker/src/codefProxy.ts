import type { Context } from 'hono';
import type { Env, Debt, Asset } from './types';

const OAUTH_URL = 'https://oauth.codef.io/oauth/token';
const CODEF_BASE = 'https://api.codef.io';

async function getToken(env: Env): Promise<string> {
  const cached = await env.TOKEN_CACHE.get('codef_token');
  if (cached) return cached;

  const creds = btoa(`${env.CODEF_CLIENT_ID}:${env.CODEF_CLIENT_SECRET}`);
  const res = await fetch(OAUTH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=read',
  });

  const data = await res.json() as { access_token: string };
  const token = data.access_token;
  await env.TOKEN_CACHE.put('codef_token', token, { expirationTtl: 1500 });
  return token;
}

async function callCodef(token: string, endpoint: string, body: object): Promise<unknown> {
  try {
    const res = await fetch(`${CODEF_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });
    return await res.json();
  } catch {
    return null;
  }
}

function parseDebts(bankLoans: unknown, cardLoans: unknown): Debt[] {
  const debts: Debt[] = [];
  const bl = (bankLoans as any)?.data?.resList ?? [];
  const cl = (cardLoans as any)?.data?.resList ?? [];

  for (const loan of bl) {
    debts.push({
      id: crypto.randomUUID(),
      name: loan.resLoanName ?? '은행대출',
      creditor: loan.resBankName ?? '',
      type: '무담보',
      amount: Number(loan.resLoanBalance ?? 0),
      rate: Number(loan.resLoanInterest ?? 0),
      monthly: 0,
      source: 'codef',
    });
  }
  for (const loan of cl) {
    debts.push({
      id: crypto.randomUUID(),
      name: loan.resLoanName ?? '카드론',
      creditor: loan.resCardName ?? '',
      type: '무담보',
      amount: Number(loan.resLoanBalance ?? 0),
      rate: Number(loan.resLoanInterest ?? 0),
      monthly: 0,
      source: 'codef',
    });
  }
  return debts;
}

function parseAssets(accounts: unknown, insurance: unknown): Asset[] {
  const assets: Asset[] = [];
  const ba = (accounts as any)?.data?.resList ?? [];
  const ins = (insurance as any)?.data?.resList ?? [];

  for (const acc of ba) {
    const balance = Number(acc.resAccountBalance ?? 0);
    if (balance > 0) {
      assets.push({
        id: crypto.randomUUID(),
        name: `${acc.resBankName ?? ''} ${acc.resAccountName ?? '예금'}`,
        type: '예금',
        rawValue: balance,
        liquidationRate: 1.0,
        mortgage: 0,
        value: balance,
        source: 'codef',
      });
    }
  }
  for (const item of ins) {
    const refund = Number(item.resSurrenderAmount ?? 0);
    if (refund > 0) {
      assets.push({
        id: crypto.randomUUID(),
        name: `${item.resInsuranceName ?? '보험'} 해지환급금`,
        type: '보험',
        rawValue: refund,
        liquidationRate: 1.0,
        mortgage: 0,
        value: refund,
        source: 'codef',
      });
    }
  }
  return assets;
}

export async function handleCodefCollect(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json() as {
    connectedId?: string;
    credentials: Array<{ loginType: string; id: string; password: string }>;
  };

  const token = await getToken(c.env);

  let cid = body.connectedId;
  if (!cid) {
    const res = await fetch(`${CODEF_BASE}/v1/account/create`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountList: body.credentials }),
    });
    const data = await res.json() as any;
    cid = data?.data?.connectedId;
    if (!cid) return c.json({ error: '금융기관 계정 연결 실패' }, 500);
  }

  const reqBody = { connectedId: cid };
  const [bankAccounts, bankLoans, cardLoans, insurance] = await Promise.allSettled([
    callCodef(token, '/v1/kr/bank/p/account/account-basic', reqBody),
    callCodef(token, '/v1/kr/bank/p/loan/loan-list', reqBody),
    callCodef(token, '/v1/kr/card/p/loan/loan-list', reqBody),
    callCodef(token, '/v1/kr/insurance/p/common/product-list', reqBody),
  ]);

  const get = (r: PromiseSettledResult<unknown>) => r.status === 'fulfilled' ? r.value : null;
  const debts = parseDebts(get(bankLoans), get(cardLoans));
  const assets = parseAssets(get(bankAccounts), get(insurance));

  return c.json({
    connectedId: cid,
    debts,
    assets,
    summary: {
      debtCount: debts.length,
      debtTotal: debts.reduce((s, d) => s + d.amount, 0),
      assetCount: assets.length,
      assetTotal: assets.reduce((s, a) => s + a.value, 0),
    },
  });
}
