import type { Context } from 'hono';
import type { Env } from './types';
import { getCodefBase, getToken, callCodef, parseDebts, parseAssets, buildAccountList } from './codefProxy';

export async function handleIntakeCodefCollect(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json() as {
    tokenId?: string;
    credentials: { loginType: string; id: string; password: string };
    banks?: string[];
  };

  if (!body.tokenId) {
    return c.json({ error: '토큰 ID가 필요합니다' }, 400);
  }

  if (!body.credentials) {
    return c.json({ error: '금융기관 인증 정보가 필요합니다' }, 400);
  }

  const token = await getToken(c.env);

  // 프론트에서 받은 banks + credentials → CODEF 형식으로 변환
  const accountList = body.banks?.length
    ? await buildAccountList(c.env, body.banks, body.credentials)
    : [body.credentials];

  const res = await fetch(`${getCodefBase(c.env)}/v1/account/create`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountList }),
  });
  const data = await res.json() as any;
  const cid = data?.data?.connectedId;
  if (!cid) {
    const errMsg = data?.result?.message ?? '금융기관 계정 연결 실패';
    return c.json({ error: errMsg, detail: data }, 500);
  }

  const reqBody = { connectedId: cid };
  const [bankAccounts, bankLoans, cardLoans, insurance] = await Promise.allSettled([
    callCodef(c.env, token, '/v1/kr/bank/p/account/account-basic', reqBody),
    callCodef(c.env, token, '/v1/kr/bank/p/loan/loan-list', reqBody),
    callCodef(c.env, token, '/v1/kr/card/p/loan/loan-list', reqBody),
    callCodef(c.env, token, '/v1/kr/insurance/p/common/product-list', reqBody),
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
