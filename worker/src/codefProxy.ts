import type { Context } from 'hono';
import type { Env, Debt, Asset } from './types';

const OAUTH_URL = 'https://oauth.codef.io/oauth/token';

export function getCodefBase(env: Env): string {
  return env.CODEF_API_HOST || 'https://api.codef.io';
}

export async function getToken(env: Env): Promise<string> {
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
  // CODEF 토큰은 1주일 유효 → 6일 캐시
  await env.TOKEN_CACHE.put('codef_token', token, { expirationTtl: 518400 });
  return token;
}

// ── RSA 암호화 (CODEF publicKey로 비밀번호 암호화) ──
// CODEF는 PKCS1 v1.5 패딩만 지원. Web Crypto API는 RSA-OAEP만 지원하므로
// 순수 JS 구현 사용 (node-forge 등이 없는 Workers 환경용).
// 주의: Workers에서 nodejs_compat 플래그 활성화 시 crypto.publicEncrypt 사용 가능.
export async function encryptRSA(publicKeyB64: string, plainText: string): Promise<string> {
  // Workers nodejs_compat 모드에서는 Node.js crypto 사용 가능
  try {
    const nodeCrypto = await import('crypto') as any;
    if (nodeCrypto.publicEncrypt) {
      const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${publicKeyB64}\n-----END PUBLIC KEY-----`;
      const encrypted = nodeCrypto.publicEncrypt(
        { key: publicKeyPem, padding: nodeCrypto.constants.RSA_PKCS1_PADDING },
        Buffer.from(plainText, 'utf-8'),
      );
      return encrypted.toString('base64');
    }
  } catch { /* nodejs_compat 미활성화 — fallback */ }

  // Fallback: Web Crypto RSA-OAEP (CODEF와 비호환 — 경고 로그)
  console.warn('[CODEF] RSA-OAEP fallback 사용 — CODEF와 비호환. nodejs_compat 활성화 필요.');
  const binaryDer = Uint8Array.from(atob(publicKeyB64), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'spki',
    binaryDer.buffer,
    { name: 'RSA-OAEP', hash: 'SHA-1' },
    false,
    ['encrypt'],
  );
  const encoded = new TextEncoder().encode(plainText);
  const encrypted = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, encoded);
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

// ── 기관코드 매핑 ──
const ORG_MAP: Record<string, { code: string; businessType: string }> = {
  // 은행 (BK)
  '국민은행': { code: '0004', businessType: 'BK' },
  '신한은행': { code: '0088', businessType: 'BK' },
  '우리은행': { code: '0020', businessType: 'BK' },
  '하나은행': { code: '0081', businessType: 'BK' },
  '농협':     { code: '0011', businessType: 'BK' },
  'IBK기업은행': { code: '0003', businessType: 'BK' },
  'SC제일은행': { code: '0023', businessType: 'BK' },
  '카카오뱅크': { code: '0090', businessType: 'BK' },
  '토스뱅크': { code: '0092', businessType: 'BK' },
  '케이뱅크': { code: '0089', businessType: 'BK' },
  '수협은행': { code: '0007', businessType: 'BK' },
  'OK저축은행': { code: '0105', businessType: 'BK' },
  'SBI저축은행': { code: '0101', businessType: 'BK' },
  // 카드 (CD)
  '삼성카드': { code: '0303', businessType: 'CD' },
  '현대카드': { code: '0302', businessType: 'CD' },
  '롯데카드': { code: '0311', businessType: 'CD' },
  'BC카드':   { code: '0305', businessType: 'CD' },
  'KB국민카드': { code: '0301', businessType: 'CD' },
  '신한카드': { code: '0306', businessType: 'CD' },
  '우리카드': { code: '0309', businessType: 'CD' },
  '하나카드': { code: '0313', businessType: 'CD' },
  'NH카드':   { code: '0304', businessType: 'CD' },
  // 보험 (IS) — CODEF 보험협회 어그리게이터 코드
  '삼성생명': { code: '0002', businessType: 'IS' },
  '한화생명': { code: '0002', businessType: 'IS' },
  '교보생명': { code: '0002', businessType: 'IS' },
  '삼성화재': { code: '0003', businessType: 'IS' },
  '현대해상': { code: '0003', businessType: 'IS' },
  'DB손해보험': { code: '0003', businessType: 'IS' },
};

// loginType 매핑: 프론트 키 → CODEF 코드
const LOGIN_TYPE_MAP: Record<string, string> = {
  cert: '0',      // 공동인증서
  finCert: '0',   // 금융인증서
  kakao: '1',     // 간편인증(ID/PW)
  pass: '1',
};

/** 프론트에서 받은 banks + credentials → CODEF accountList 변환 */
interface CodefAccount {
  countryCode: string;
  businessType: string;
  clientType: string;
  organization: string;
  loginType: string;
  id: string;
  password: string;
}

export async function buildAccountList(
  env: Env,
  banks: string[],
  credentials: { loginType: string; id: string; password: string },
): Promise<CodefAccount[]> {
  const encPw = await encryptRSA(env.CODEF_PUBLIC_KEY, credentials.password);
  const codefLoginType = LOGIN_TYPE_MAP[credentials.loginType] ?? '1';

  const result: CodefAccount[] = [];
  for (const bankName of banks) {
    const org = ORG_MAP[bankName];
    if (!org) continue;
    result.push({
      countryCode: 'KR',
      businessType: org.businessType,
      clientType: 'P',
      organization: org.code,
      loginType: codefLoginType,
      id: credentials.id,
      password: encPw,
    });
  }
  return result;
}

export async function callCodef(env: Env, token: string, endpoint: string, body: object): Promise<unknown> {
  try {
    const res = await fetch(`${getCodefBase(env)}${endpoint}`, {
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

export function parseDebts(bankLoans: unknown, cardLoans: unknown): Debt[] {
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

export function parseAssets(accounts: unknown, insurance: unknown): Asset[] {
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
    clientId?: string;
    authMethod?: string;
    credentials: { loginType: string; id: string; password: string };
    banks?: string[];
  };

  const token = await getToken(c.env);

  let cid = body.connectedId;
  if (!cid) {
    // 프론트에서 받은 banks + credentials → CODEF 형식으로 변환
    const accountList = body.banks?.length
      ? await buildAccountList(c.env, body.banks, body.credentials)
      : [body.credentials];

    if (accountList.length === 0) {
      return c.json({ error: '유효한 금융기관이 선택되지 않았습니다' }, 400);
    }

    const res = await fetch(`${getCodefBase(c.env)}/v1/account/create`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountList }),
    });
    const data = await res.json() as any;
    cid = data?.data?.connectedId;
    if (!cid) {
      const errMsg = data?.result?.message ?? '금융기관 계정 연결 실패';
      return c.json({ error: errMsg, detail: data }, 500);
    }
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
