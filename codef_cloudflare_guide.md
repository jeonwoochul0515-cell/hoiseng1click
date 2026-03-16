# CODEF × Cloudflare Workers — 쉬운 설명 + 복붙 코드

---

## 구조 한 줄 요약

```
브라우저 → Cloudflare Worker (우리 서버) → CODEF
              ↕ KV (토큰 캐시)
              ↕ R2 (생성 파일 저장)
```

Firebase Cloud Functions 대신 **Cloudflare Workers**를 쓰는 이유:
- 무료 할당량이 넉넉함 (10만 req/일 무료)
- 전 세계 엣지 서버 → 응답 빠름
- R2 (파일 저장), KV (캐시) 함께 써서 구조 단순

---

## 준비 체크리스트

```
□ 1. CODEF 가입
     https://developer.codef.io
     → 앱 생성 → CLIENT_ID, CLIENT_SECRET 발급
     → 처음엔 샌드박스(테스트) 모드

□ 2. Cloudflare 가입
     https://cloudflare.com (무료)
     → 대시보드 → Workers & Pages → 시작

□ 3. Wrangler CLI 설치 (딱 1번만)
     npm install -g wrangler
     wrangler login   ← 브라우저에서 Cloudflare 로그인
```

---

## 1단계 — Cloudflare 리소스 생성 (3분)

```bash
# R2 버킷 (생성된 DOCX/HWPX 파일 저장)
wrangler r2 bucket create lawdocs-docs

# KV 네임스페이스 (CODEF 토큰 25분 캐싱)
wrangler kv:namespace create TOKEN_CACHE
# 출력된 id 값을 wrangler.toml에 붙여넣기
```

---

## 2단계 — Secret 저장 (비밀번호처럼 관리)

```bash
# 이 명령 실행하면 값 입력 프롬프트 나옴
# 코드에 절대 하드코딩 X

wrangler secret put CODEF_CLIENT_ID
# 입력: 12345678-abcd-...

wrangler secret put CODEF_CLIENT_SECRET
# 입력: abcdefgh-1234-...

wrangler secret put FIREBASE_PROJECT_ID
# 입력: lawdocs-prod

wrangler secret put PUBLIC_DATA_API_KEY
# 입력: 공공데이터포털에서 발급받은 키
```

---

## 3단계 — wrangler.toml 작성

```toml
# worker/wrangler.toml

name = "lawdocs-worker"
main = "src/index.ts"
compatibility_date = "2024-09-01"

# R2 버킷 (DOCX/HWPX 파일 저장)
[[r2_buckets]]
binding = "DOCS_BUCKET"
bucket_name = "lawdocs-docs"

# KV (CODEF 토큰 캐싱)
[[kv_namespaces]]
binding = "TOKEN_CACHE"
id = "여기에_위에서_출력된_id_붙여넣기"
```

---

## 4단계 — 핵심 코드 (복붙용)

### worker/src/auth.ts — Firebase JWT 검증

```typescript
export async function verifyFirebaseToken(
  token: string,
  projectId: string
): Promise<{ uid: string; email: string; plan: string } | null> {
  try {
    // Firebase 공개키 조회
    const keysRes = await fetch(
      'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
    );
    const keys = await keysRes.json() as Record<string, string>;

    // JWT 헤더에서 kid 추출
    const [headerB64] = token.split('.');
    const header = JSON.parse(atob(headerB64));
    const pemKey = keys[header.kid];
    if (!pemKey) return null;

    // 공개키로 검증 (crypto.subtle 사용, Node 불필요)
    const key = await importPublicKey(pemKey);
    const [h, p, sig] = token.split('.');
    const data = new TextEncoder().encode(`${h}.${p}`);
    const signature = base64UrlDecode(sig);

    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data);
    if (!valid) return null;

    const payload = JSON.parse(atob(p));
    if (payload.aud !== projectId) return null;
    if (payload.exp < Date.now() / 1000) return null;

    return {
      uid: payload.sub,
      email: payload.email ?? '',
      plan: payload.plan ?? 'starter',
    };
  } catch {
    return null;
  }
}

async function importPublicKey(pem: string): Promise<CryptoKey> {
  const pemContent = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const der = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'spki', der.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['verify']
  );
}

function base64UrlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}
```

---

### worker/src/codefProxy.ts — CODEF 프록시

```typescript
import type { Context } from 'hono';
import type { Env } from './types';

const OAUTH_URL  = 'https://oauth.codef.io/oauth/token';
const CODEF_BASE = 'https://api.codef.io';

// ── 토큰 발급 + KV 캐싱 (25분) ──────────────
async function getToken(env: Env): Promise<string> {
  // 캐시 확인
  const cached = await env.TOKEN_CACHE.get('codef_token');
  if (cached) return cached;

  // 새로 발급
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

  // KV에 25분 저장
  await env.TOKEN_CACHE.put('codef_token', token, { expirationTtl: 1500 });
  return token;
}

// ── CODEF API 호출 (실패해도 null 반환) ─────
async function callCodef(
  token: string, endpoint: string, body: object
): Promise<unknown> {
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

// ── 응답 파싱 → 표준 Debt[] ─────────────────
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

// ── 응답 파싱 → 표준 Asset[] ────────────────
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
        rawValue: balance, liquidationRate: 1.0,
        mortgage: 0, value: balance, source: 'codef',
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
        rawValue: refund, liquidationRate: 1.0,
        mortgage: 0, value: refund, source: 'codef',
      });
    }
  }
  return assets;
}

// ── 메인 핸들러 ──────────────────────────────
export async function handleCodefCollect(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json() as {
    connectedId?: string;
    credentials: Array<{ loginType: string; id: string; password: string }>;
  };

  const token = await getToken(c.env);

  // Connected 계정 생성 (최초 1회)
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

  // 병렬 수집
  const [bankAccounts, bankLoans, cardLoans, insurance] =
    await Promise.allSettled([
      callCodef(token, '/v1/kr/bank/p/account/account-basic', reqBody),
      callCodef(token, '/v1/kr/bank/p/loan/loan-list', reqBody),
      callCodef(token, '/v1/kr/card/p/loan/loan-list', reqBody),
      callCodef(token, '/v1/kr/insurance/p/common/product-list', reqBody),
    ]);

  const get = (r: PromiseSettledResult<unknown>) =>
    r.status === 'fulfilled' ? r.value : null;

  const debts  = parseDebts(get(bankLoans), get(cardLoans));
  const assets = parseAssets(get(bankAccounts), get(insurance));

  return c.json({
    connectedId: cid,
    debts,
    assets,
    summary: {
      debtCount:  debts.length,
      debtTotal:  debts.reduce((s, d) => s + d.amount, 0),
      assetCount: assets.length,
      assetTotal: assets.reduce((s, a) => s + a.value, 0),
    },
  });
}

// 타입 (간략)
interface Debt { id:string; name:string; creditor:string; type:string; amount:number; rate:number; monthly:number; source:string; }
interface Asset { id:string; name:string; type:string; rawValue:number; liquidationRate:number; mortgage:number; value:number; source:string; }
```

---

### worker/src/docxGenerator.ts — DOCX 생성

```typescript
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

export async function generateDocx(
  templateName: string,
  data: Record<string, unknown>,
  env: Env
): Promise<Uint8Array> {
  // R2에서 템플릿 읽기
  const obj = await env.DOCS_BUCKET.get(`templates/docx/${templateName}.docx`);
  if (!obj) throw new Error(`템플릿 없음: ${templateName}.docx`);
  const buf = await obj.arrayBuffer();

  // docxtemplater로 데이터 바인딩
  const zip = new PizZip(buf);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{', end: '}' },
  });

  doc.render(data);

  const out = doc.getZip().generate({ type: 'uint8array' });
  return out;
}

export async function saveToR2(
  buffer: Uint8Array,
  path: string,
  env: Env
): Promise<string> {
  await env.DOCS_BUCKET.put(path, buffer, {
    httpMetadata: {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
  });
  // 서명된 URL (1시간)
  const url = await env.DOCS_BUCKET.createSignedUrl(path, 3600);
  return url ?? path;
}
```

---

### worker/src/hwpxGenerator.ts — HWPX 생성

```typescript
// HWPX = ZIP + XML 구조 (한글과컴퓨터 포맷)
// JSZip으로 압축 해제 후 XML 문자열 치환

export async function generateHwpx(
  templateName: string,
  data: Record<string, unknown>,
  env: Env
): Promise<Uint8Array> {
  // R2에서 템플릿 읽기
  const obj = await env.DOCS_BUCKET.get(`templates/hwpx/${templateName}.hwpx`);
  if (!obj) throw new Error(`HWPX 템플릿 없음: ${templateName}`);
  const buf = await obj.arrayBuffer();

  // ZIP 해제
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buf);

  // Contents/section0.xml 에 본문 있음
  let xml = await zip.file('Contents/section0.xml')!.async('string');

  // 단순 변수 치환: {{clientName}} → 실제 값
  for (const [key, val] of Object.entries(data)) {
    if (typeof val === 'string' || typeof val === 'number') {
      xml = xml.replaceAll(`{{${key}}}`, String(val));
    }
  }

  // 테이블 행 반복: <!--REPEAT:debts-->...<!--/REPEAT:debts-->
  xml = expandRepeat(xml, 'debts', data.debts as unknown[]);
  xml = expandRepeat(xml, 'assets', data.assets as unknown[]);

  zip.file('Contents/section0.xml', xml);
  const output = await zip.generateAsync({ type: 'uint8array' });
  return output;
}

function expandRepeat(xml: string, key: string, rows: unknown[]): string {
  const startTag = `<!--REPEAT:${key}-->`;
  const endTag   = `<!--/REPEAT:${key}-->`;
  const start = xml.indexOf(startTag);
  const end   = xml.indexOf(endTag);
  if (start === -1 || end === -1) return xml;

  const rowTemplate = xml.slice(start + startTag.length, end);
  const expanded = (rows ?? []).map(row => {
    let r = rowTemplate;
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
      r = r.replaceAll(`{{${k}}}`, String(v ?? ''));
    }
    return r;
  }).join('');

  return xml.slice(0, start) + expanded + xml.slice(end + endTag.length);
}
```

---

### worker/src/index.ts — Hono 라우터

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { verifyFirebaseToken } from './auth';
import { handleCodefCollect } from './codefProxy';
import { handlePropertyLookup, handleVehicleLookup } from './publicDataProxy';
import { handleDocGenerate } from './docGenerator';

const app = new Hono<{ Bindings: Env }>();

// CORS (Firebase Hosting 도메인 허용)
app.use('*', cors({
  origin: ['https://lawdocs-prod.web.app', 'http://localhost:5173'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// JWT 인증 미들웨어
app.use('*', async (c, next) => {
  const auth = c.req.header('Authorization') ?? '';
  const token = auth.replace('Bearer ', '');
  const user = await verifyFirebaseToken(token, c.env.FIREBASE_PROJECT_ID);
  if (!user) return c.json({ error: '인증 필요' }, 401);
  c.set('user', user);
  await next();
});

// 라우트
app.post('/codef/collect',    handleCodefCollect);
app.get ('/public/property',  handlePropertyLookup);
app.get ('/public/vehicle',   handleVehicleLookup);
app.post('/doc/generate',     handleDocGenerate);

export default app;
```

---

### src/api/worker.ts — 프론트엔드 호출 클라이언트

```typescript
import { getAuth } from 'firebase/auth';

const BASE = import.meta.env.VITE_WORKER_BASE_URL;

async function getToken(): Promise<string> {
  const user = getAuth().currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  return user.getIdToken();
}

async function fetchWorker<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any;
    throw new Error(err.error ?? `서버 오류 ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const workerApi = {
  codefCollect: (data: object) =>
    fetchWorker('/codef/collect', { method: 'POST', body: JSON.stringify(data) }),

  getPropertyPrice: (address: string, type: string, area: number) =>
    fetchWorker(`/public/property?address=${encodeURIComponent(address)}&type=${type}&area=${area}`),

  getVehicleValue: (plate: string) =>
    fetchWorker(`/public/vehicle?plate=${encodeURIComponent(plate)}`),

  generateDoc: (data: object) =>
    fetchWorker<{ downloadUrl: string }>('/doc/generate', {
      method: 'POST', body: JSON.stringify(data),
    }),
};
```

---

## 전체 흐름 다시 보기

```
[브라우저]                [Cloudflare Worker]              [외부]
    │                           │                            │
    │ workerApi.codefCollect()  │                            │
    │──────────────────────────>│ getToken() - KV 캐시 확인  │
    │                           │───────────────────────────>│ CODEF OAuth
    │                           │<─── access_token (25분) ───│
    │                           │                            │
    │                           │ 병렬 API 4개 호출          │
    │                           │───────────────────────────>│ CODEF 금융API
    │                           │<─── 대출/예금/보험 JSON ───│
    │                           │                            │
    │<── {debts, assets} ───────│ parseDebts() parseAssets() │
    │                           │                            │
    │ workerApi.generateDoc()   │                            │
    │──────────────────────────>│ R2에서 DOCX 템플릿 읽기    │
    │                           │ docxtemplater 데이터 바인딩│
    │                           │ R2에 완성 파일 저장        │
    │<── {downloadUrl} ─────────│ 서명된 URL 반환            │
    │                           │                            │
    │ window.open(downloadUrl)  │                            │
    │ → DOCX/HWPX 다운로드     │                            │
```

---

## 샌드박스 테스트

CODEF 샌드박스에서는 아래 더미 계정으로 테스트:
```
loginType: "id"
id:        "codef_test_user"
password:  "test1234!"
```
실제 금융사 응답 구조의 더미 데이터가 반환됨.

---

## 배포 후 확인

```bash
# Worker 정상 동작 테스트 (401이 나와야 정상 - 인증 없이 호출)
curl https://lawdocs-worker.xxx.workers.dev/public/property?address=부산

# Secret 설정 확인
wrangler secret list

# 로그 실시간 확인
wrangler tail
```
