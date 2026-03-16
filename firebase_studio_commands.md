# LawDocs — Firebase Studio Claude CLI 명령 (Cloudflare Workers + DOCX/HWPX 버전)

> CLAUDE.md를 프로젝트 루트에 먼저 복사하고 시작한다.
> 각 STEP을 Claude CLI에 붙여넣어 순서대로 실행한다.

---

## 🚀 STEP 1 — 프로젝트 초기화

```
CLAUDE.md를 읽고 이 디렉터리에 LawDocs 프로젝트를 초기화해줘.

프론트엔드 (루트):
- npm create vite@latest . -- --template react-ts
- 추가 패키지: react-router-dom firebase zustand @tanstack/react-query
  dayjs lucide-react clsx tailwind-merge
- Tailwind CSS + PostCSS 설정
- shadcn/ui 초기화 (npx shadcn-ui@latest init)
- tsconfig에 @/ → src/ 경로 별칭 설정
- vite.config.ts에 resolve.alias 설정

Cloudflare Worker (worker/ 서브디렉터리):
- mkdir worker && cd worker
- npm init -y
- 패키지: hono@latest @hono/zod-validator zod
  docxtemplater pizzip
  @cloudflare/workers-types wrangler typescript
- tsconfig.json 생성 (lib: ES2022, target: ES2022)
- wrangler.toml 생성:
  name = "lawdocs-worker"
  compatibility_date = "2024-09-01"
  main = "src/index.ts"
  [[r2_buckets]]
  binding = "DOCS_BUCKET"
  bucket_name = "lawdocs-docs"
  [[kv_namespaces]]
  binding = "TOKEN_CACHE"
  id = "나중에채울것"

Firebase 설정:
- firebase.json: hosting → dist, 없음 functions 없음
- firestore.rules 생성
- .env.local.example 생성:
  VITE_FIREBASE_API_KEY=
  VITE_FIREBASE_AUTH_DOMAIN=
  VITE_FIREBASE_PROJECT_ID=
  VITE_FIREBASE_STORAGE_BUCKET=
  VITE_FIREBASE_MESSAGING_SENDER_ID=
  VITE_FIREBASE_APP_ID=
  VITE_WORKER_BASE_URL=https://lawdocs-worker.계정명.workers.dev
  VITE_PUBLIC_DATA_API_KEY=
```

---

## 🎨 STEP 2 — 디자인 시스템 + 레이아웃

```
CLAUDE.md를 읽고 디자인 시스템과 레이아웃을 구현해줘.

1. tailwind.config.ts:
   CLAUDE.md의 색상 시스템(brand, status, plan) 전체 추가

2. src/components/layout/Sidebar.tsx:
   - 너비 220px, 배경 #0D1B2A에서 살짝 밝은 #111827
   - 상단: "⚖ LawDocs" 로고 + 사무소명 + 플랜 배지 (STARTER/PRO/ENTERPRISE)
   - 메뉴:
     🏠 대시보드  → /
     👥 의뢰인 관리 → /clients
     🔗 데이터 수집 → /collection
     📄 서류 생성  → /documents
     📊 청산가치   → /liquidation  [PRO 이상만 표시]
     ⚙️  설정      → /settings
   - lucide-react 아이콘
   - active 시 brand-gold 강조, 좌측 3px border
   - 하단: 플랜명 + 만료일 + "업그레이드" 버튼 (plan=starter이면 gold)
   - 로그인 사용자 이메일 + 로그아웃

3. src/components/layout/TopBar.tsx:
   - 높이 56px, 우측: 오늘 날짜 + "이달 서류 X/N건" 카운터 + "+ 의뢰인 등록"

4. src/components/subscription/PlanBadge.tsx:
   - starter: 회색, pro: gold, enterprise: 보라
   - 텍스트: STARTER / PRO / ENTERPRISE

5. src/components/subscription/UpgradeModal.tsx:
   요금제 3개 카드 비교 UI:
   STARTER 49,000원 / PRO 99,000원 / ENTERPRISE 199,000원
   각 카드에 기능 목록 (CLAUDE.md 요금제 표 참조)
   "현재 플랜" 배지, "업그레이드" 버튼 → 토스페이먼츠 연결 예정

6. src/App.tsx:
   React Router 설정:
   /login → LoginPage (레이아웃 없음)
   / → DashboardPage
   /clients → ClientsPage
   /clients/:id → ClientDetailPage
   /collection/:id → CollectionPage
   /documents → DocumentsPage
   /liquidation → LiquidationPage [PRO 이상]
   /settings → SettingsPage

   인증 가드: 로그인 안 됨 → /login
   플랜 가드: 권한 없는 페이지 → UpgradeModal 오픈

7. 전체 배경: #080D14
```

---

## 🔐 STEP 3 — Firebase 인증 + 사무소 + 요금제

```
CLAUDE.md를 읽고 인증, 사무소 설정, 요금제 로직을 구현해줘.

1. src/firebase.ts: 환경변수로 Firebase 초기화

2. src/store/authStore.ts (Zustand):
   상태: user, office (Office 타입), loading
   액션: login(), logout(), loadOffice(), refreshPlanStatus()
   플랜 헬퍼:
   - canAddClient(): 의뢰인 수 한도 확인 (starter: 30, pro: 150, enterprise: 무제한)
   - canGenerateDoc(): 월 서류 건수 확인 (starter: 50, pro/enterprise: 무제한)
   - hasPro(): plan이 pro 또는 enterprise
   - planExpired(): planExpiry 지났으면 true

3. src/pages/LoginPage.tsx:
   - 좌측 절반: 브랜드 소개 (로고, 슬로건 "1회 인증으로 법원 서류 완성")
   - 우측 절반: 로그인 폼
   - 이메일 + 비밀번호 → Firebase Auth
   - "무료체험 시작" 버튼 (회원가입 → 14일 PRO 체험 자동 부여)
   - 로그인 성공 → / 이동

4. src/pages/SettingsPage.tsx 탭 3개:
   a) 사무소 정보: 사무소명, 대표자명, 전화, 유형(법무사/변호사)
   b) API 연동:
      - CODEF 연결 상태 (연결됨/미연결)
      - "CODEF 연결" 버튼 → CODEF 인증 플로우 (CLIENT_ID 입력)
        → Worker POST /codef/connect 호출 → 성공 시 codefConnected: true
      - 공공데이터포털 API 키 입력
   c) 구독 관리:
      - 현재 플랜, 만료일, 이달 서류 건수
      - 플랜 변경 버튼 → UpgradeModal

5. Firestore 보안규칙 (firestore.rules):
   - 인증된 유저만 본인 officeId 문서 접근
   - 의뢰인은 /offices/{officeId}/clients/{clientId} 경로
   - 다른 사무소 데이터 접근 불가
```

---

## 👥 STEP 4 — 의뢰인 관리 (CRUD + 계산기)

```
CLAUDE.md를 읽고 의뢰인 관리 전체를 구현해줘.

1. src/types/client.ts: CLAUDE.md의 Client, Debt, Asset 타입 전체

2. src/api/firestore.ts:
   getClients / getClient / createClient / updateClient / deleteClient
   (officeId 기반, Firestore 컬렉션: /offices/{officeId}/clients)

3. src/pages/ClientsPage.tsx:
   - 검색 (이름/연락처) + 상태 필터 + 정렬 (최신/채무순)
   - 플랜 제한 표시: "의뢰인 23/30명 (STARTER 한도)"
   - "+ 의뢰인 등록" → canAddClient() false이면 UpgradeModal
   - 테이블: 이름, 연락처, 채무합계, 상태배지, 수집여부 (✅/⬜), 등록일, 액션

4. src/components/client/ClientForm.tsx (등록/수정 슬라이드오버):
   탭 4개:

   [탭1] 기본정보
   - 이름*, 연락처*, 주민번호, 주소*, 직업유형(선택), 가족수, 관할법원, 유입경로, 메모

   [탭2] 채무내역
   - 행 추가/삭제: 채무명, 채권자, 유형(무담보/담보/사채), 원금, 금리(%), 월상환액
   - 하단: 총 채무 자동 합계

   [탭3] 재산내역 (STEP 5에서 완성, 여기서는 기타재산 수동만)
   - 행 추가/삭제: 재산명, 종류, 평가액
   - 하단: 총 재산 합계

   [탭4] 소득/생계비
   - 월 소득(세후), 기타 수입, 주거비, 교육비, 의료비, 가족수
   - 실시간 변제금 계산 박스:
     기준중위소득 60%: X원
     추가생계비: X원
     월 변제금: X원 (굵은 gold 색)
     36개월 총 변제: X원
   - CLAUDE.md의 calcMonthlyPayment 로직 사용, 2026 기준중위소득 내장

5. src/pages/ClientDetailPage.tsx:
   탭: 기본정보 | 채무내역 | 재산내역 | 소득·변제금 | 서류생성 | 메모
   상단: 이름, 상태 드롭다운, 수집일, CODEF 수집 버튼 → /collection/:id
```

---

## ☁️ STEP 5 — Cloudflare Workers 설정 + CODEF 프록시

```
CLAUDE.md를 읽고 worker/ 디렉터리에 Cloudflare Workers를 구현해줘.
Hono 프레임워크 사용.

1. worker/src/auth.ts — Firebase JWT 검증 미들웨어
   모든 API 요청에 Authorization: Bearer {firebase_id_token} 필요
   Firebase 공개키로 JWT 검증 (crypto.subtle 사용, Node 불필요)
   검증 실패 시 401 반환

2. worker/src/codefProxy.ts

   const CODEF_OAUTH = 'https://oauth.codef.io/oauth/token';
   const CODEF_BASE  = 'https://api.codef.io';

   // 토큰 발급 + KV 캐싱 (25분)
   async function getToken(env: Env): Promise<string>
   - KV에서 'codef_token' 조회 → 있으면 반환
   - 없으면 CODEF OAuth 호출 → 발급 → KV에 TTL 25분으로 저장

   // CODEF 단일 API 호출 (실패해도 null 반환)
   async function callCodef(token, endpoint, body): Promise<unknown>

   // /codef/collect  POST 핸들러
   export async function handleCodefCollect(c: Context)
   입력: { connectedId?, credentials: [{loginType, id, password}] }

   처리:
   a) 토큰 발급 (KV 캐시)
   b) connectedId 없으면 /v1/account/create
   c) Promise.allSettled로 병렬 수집:
      - 은행 계좌: /v1/kr/bank/p/account/account-basic
      - 은행 대출: /v1/kr/bank/p/loan/loan-list
      - 카드 대출: /v1/kr/card/p/loan/loan-list
      - 보험:      /v1/kr/insurance/p/common/product-list
      - 자동차:    /v1/kr/car/vehicle-registration
   d) parseDebts(), parseAssets() 로 표준 형식 변환
   e) JSON 반환: { connectedId, debts, assets, summary }

   parseDebts(bankLoans, cardLoans): Debt[]
   parseAssets(bankAccounts, insurance, vehicles): Asset[]

3. worker/src/publicDataProxy.ts

   // GET /public/property?address=...&type=apt&area=84
   export async function handlePropertyLookup(c: Context)
   - env.PUBLIC_DATA_API_KEY 사용
   - 국토교통부 공동주택 공시가격 API 호출
   - 실패 시 주소 기반 시뮬레이션 폴백 (지역별 단가 내장)
   - 반환: { rawPrice, address, liquidation75: rawPrice*0.75 }

   // GET /public/vehicle?plate=...
   export async function handleVehicleLookup(c: Context)
   - 국토교통부 자동차 등록 API 호출
   - 보험개발원 기준가액 내장 DB (15개 차종, 연식별 잔존가율)
   - 반환: { model, year, km, basePrice, liquidation70: basePrice*0.70 }

4. worker/src/index.ts — Hono 라우터
   import { Hono } from 'hono'
   import { cors } from 'hono/cors'

   const app = new Hono<{ Bindings: Env }>()
   app.use('*', cors({ origin: ['https://lawdocs.kr', 'http://localhost:5173'] }))
   app.use('*', authMiddleware)   // JWT 검증 (login 제외)
   app.post('/codef/collect', handleCodefCollect)
   app.get('/public/property', handlePropertyLookup)
   app.get('/public/vehicle', handleVehicleLookup)
   app.post('/doc/generate', handleDocGenerate)   // STEP 6에서 구현
   export default app

5. worker/wrangler.toml secrets 주석:
   # wrangler secret put CODEF_CLIENT_ID
   # wrangler secret put CODEF_CLIENT_SECRET
   # wrangler secret put FIREBASE_PROJECT_ID
   # wrangler secret put PUBLIC_DATA_API_KEY

6. Env 타입 (worker/src/types.ts):
   interface Env {
     DOCS_BUCKET: R2Bucket;
     TOKEN_CACHE: KVNamespace;
     CODEF_CLIENT_ID: string;
     CODEF_CLIENT_SECRET: string;
     FIREBASE_PROJECT_ID: string;
     PUBLIC_DATA_API_KEY: string;
   }
```

---

## 📄 STEP 6 — DOCX + HWPX 서류 자동생성

```
CLAUDE.md를 읽고 서류 자동생성 시스템을 구현해줘.

=== Worker 서버 측 (worker/src/docxGenerator.ts) ===

docxtemplater + pizzip 사용.

// DOCX 생성 함수
export async function generateDocx(
  templateName: string,    // 예: 'debt_list'
  data: Record<string, unknown>,
  env: Env
): Promise<Uint8Array>

처리:
1. R2에서 templates/docx/{templateName}.docx 읽기
2. PizZip으로 압축 해제
3. Docxtemplater로 데이터 바인딩
   - 반복: {#debts}{name}{/debts}
   - 조건: {#hasProperty}있음{/hasProperty}
   - 값: {clientName}, {totalDebt}, {monthlyPayment}
4. buffer 반환

// DOCX → R2 저장 후 다운로드 URL 반환
export async function saveAndGetUrl(
  buffer: Uint8Array,
  fileName: string,
  env: Env
): Promise<string>
R2에 docs/{officeId}/{clientId}/{fileName} 경로로 저장
서명된 URL (1시간 유효) 반환

=== Worker 서버 측 (worker/src/hwpxGenerator.ts) ===

HWPX는 ZIP 구조 XML 파일. 직접 XML 조작으로 생성.

export async function generateHwpx(
  templateName: string,
  data: Record<string, unknown>,
  env: Env
): Promise<Uint8Array>

처리:
1. R2에서 templates/hwpx/{templateName}.hwpx 읽기 (ZIP)
2. JSZip으로 압축 해제
3. Contents/section0.xml 파싱
4. 템플릿 마커 {{변수명}} 치환
5. 테이블 행 반복 처리 (채무/재산 목록)
6. 재압축 → Uint8Array 반환

HWPX 테이블 행 반복 헬퍼:
function expandTableRows(xml: string, key: string, rows: unknown[]): string
- <!--REPEAT:debts--> ... <!--/REPEAT:debts--> 마커 사이 행을 rows 수만큼 복제
- 각 행에 {{name}}, {{amount}} 등 치환

=== Worker 라우터 (POST /doc/generate) ===

export async function handleDocGenerate(c: Context)
입력:
{
  clientId: string,
  officeId: string,
  docType: 'debt_list' | 'asset_list' | 'income_list' | 'application' | 'repay_plan' | 'all',
  format: 'docx' | 'hwpx',
  clientData: Client   // 완전한 Client 객체
}

처리:
1. 플랜 검증 (hwpx는 PRO 이상만)
2. 데이터 → 템플릿 변수 매핑 buildTemplateData(client)
3. docType === 'all' → 5종 생성 후 ZIP으로 묶어서 반환
4. 단건 → 해당 서류 생성 → R2 저장 → URL 반환

buildTemplateData(client: Client) → TemplateData:
{
  // 공통
  clientName: client.name,
  clientAddr: client.address,
  clientSSN: maskSSN(client.ssn),   // 앞 6자리만
  court: client.court,
  today: dayjs().format('YYYY년 MM월 DD일'),
  
  // 채무
  debts: client.debts.map((d, i) => ({
    no: i + 1,
    name: d.name,
    creditor: d.creditor,
    type: d.type,
    amount: formatKRW(d.amount),
    rate: d.rate.toFixed(1) + '%',
    monthly: formatKRW(d.monthly),
  })),
  totalDebt: formatKRW(sum(client.debts, 'amount')),
  unsecuredDebt: formatKRW(unsecured(client.debts)),
  
  // 재산
  assets: client.assets.map((a, i) => ({
    no: i + 1,
    name: a.name,
    type: a.type,
    rawValue: formatKRW(a.rawValue),
    rate: (a.liquidationRate * 100).toFixed(0) + '%',
    mortgage: formatKRW(a.mortgage),
    value: formatKRW(a.value),
    basis: a.type === '부동산' ? '국토부 공시가격 환가율 75%' :
           a.type === '차량'   ? '보험개발원 기준가액 환가율 70%' : '-',
  })),
  totalAsset: formatKRW(sum(client.assets, 'value')),
  
  // 소득·생계비
  income: formatKRW(client.income + client.income2),
  livCost: formatKRW(calcLivCost(client.family)),
  extraCost: formatKRW(client.rent + client.education + client.medical),
  monthlyPayment: formatKRW(calcMonthlyPayment(client)),
  repayTotal36: formatKRW(calcMonthlyPayment(client) * 36),
  repayTotal60: formatKRW(calcMonthlyPayment(client) * 60),
  medianIncome: formatKRW(MEDIAN_INCOME_2026[client.family] ?? 0),
}

=== 프론트엔드 (src/components/documents/DocDownloadButton.tsx) ===

interface Props {
  client: Client;
  docType: DocType;
  format: 'docx' | 'hwpx';
}

버튼 클릭 시:
1. POST {VITE_WORKER_BASE_URL}/doc/generate 호출
   Authorization: Bearer {firebase_id_token}
2. 응답에서 downloadUrl 추출
3. window.open(downloadUrl) 로 다운로드
4. format=hwpx이고 plan=starter → UpgradeModal 표시

=== 프론트엔드 (src/pages/DocumentsPage.tsx) ===

좌측 패널: 의뢰인 선택 (검색 가능한 리스트)
우측 패널:
  상단: 서류 5종 선택 버튼 (채권자목록/재산목록/수입지출/신청서/변제계획안)
  중앙: HTML 미리보기 (브라우저에서 렌더, 동일 데이터 사용)
  하단 버튼 그룹:
    📥 DOCX 다운로드        (전 플랜)
    📥 HWPX 다운로드        (PRO 이상, 아니면 잠금 아이콘)
    📦 전체 5종 ZIP (DOCX)  (전 플랜)
    📦 전체 5종 ZIP (HWPX)  (PRO 이상)
    🖨 인쇄 (미리보기 HTML)  (전 플랜)

=== 서류 HTML 미리보기 (브라우저 측, src/utils/docPreview.ts) ===

DOCX 다운로드와 동일한 데이터를 사용해 HTML로 렌더링.
5종 각각의 genXxxPreview(data: TemplateData): string 함수 구현.
A4 흰 배경, 법원 제출 규격 (상단: 법원명·서류명·날짜, 표, 서명란).
```

---

## 🏠🚗 STEP 7 — 재산 자동조회 UI

```
CLAUDE.md를 읽고 재산 자동조회 UI를 구현해줘.
Worker의 /public/property, /public/vehicle 엔드포인트 사용.

1. src/api/worker.ts — Worker 호출 클라이언트
   getWorkerBaseUrl(): string → import.meta.env.VITE_WORKER_BASE_URL
   getIdToken(): Promise<string> → Firebase currentUser.getIdToken()

   fetchWorker(path, options): fetch with Authorization header

   export const workerApi = {
     codefCollect: (data) => fetchWorker('/codef/collect', { method: 'POST', body: data }),
     getPropertyPrice: (params) => fetchWorker('/public/property?' + qs(params)),
     getVehicleValue: (params) => fetchWorker('/public/vehicle?' + qs(params)),
     generateDoc: (data) => fetchWorker('/doc/generate', { method: 'POST', body: data }),
   }

2. src/components/property/PropertyLookup.tsx:
   입력: 주소, 유형(아파트/토지/단독/연립), 면적(㎡), 층
   "공시가격 조회" → workerApi.getPropertyPrice() 호출
   결과 카드:
   - 공시가격: X원
   - 환가율 75% 적용: X원
   - 근저당 설정액: [수정 가능 입력]원 → 실시간 차감
   - 순 청산가치: X원 (green, 굵게)
   - "재산 목록에 추가" 버튼

3. src/components/property/VehicleLookup.tsx:
   입력: 차량번호 (자동조회) 또는 차종+연식+주행km (수동)
   "조회" → workerApi.getVehicleValue() 호출
   결과 카드:
   - 차종/연식: 소나타 / 2020년식
   - 보험개발원 기준가액: X원
   - 환가율 70% 적용: X원
   - 저당·압류: [수정 가능 입력]원
   - 순 청산가치: X원 (green, 굵게)
   - "재산 목록에 추가" 버튼

4. ClientDetailPage 재산내역 탭 완성:
   서브탭: 🏠 부동산 | 🚗 차량 | 💰 기타재산
   각 서브탭에 위 컴포넌트 배치
   추가된 재산은 칩(chip) 카드로 목록 표시 (삭제 버튼 포함)
   하단: "부동산 X원 + 차량 X원 + 기타 X원 = 총 청산가치 X원"
```

---

## 🔗 STEP 8 — CODEF 수집 플로우 페이지

```
CLAUDE.md를 읽고 /collection/:clientId 페이지를 구현해줘.
상단에 4단계 스텝 바 표시.

[STEP 1] 동의 확인
- 의뢰인 이름과 수집 목적 안내
- 체크박스 4종 (모두 체크해야 다음 활성화):
  ① 서비스 이용약관 동의
  ② 개인정보 수집·이용 동의 (개인회생 서류 작성 목적 한정)
  ③ 개인신용정보 전송요구권 행사 동의 (신용정보법 제33조의2)
  ④ CODEF 중계기관을 통한 금융데이터 수집 동의
- "다음" 버튼

[STEP 2] 인증 정보 입력
- 인증 방식 탭: 공동인증서 | 간편인증(카카오/PASS) | 금융인증서
- 아이디/비밀번호 입력 (인증서는 업로드)
- 수집 기관 멀티셀렉트 체크박스 (국민은행, 신한, 우리, 하나, 농협, 카카오, 토스,
  삼성카드, 현대카드, 롯데카드, OK저축, SBI저축, 삼성생명, 한화생명)
- "수집 시작" 버튼

[STEP 3] 실시간 수집 진행
- 전체 프로그레스바 (0~100%)
- 기관별 상태 목록:
  ⏳ 대기 / 🔄 수집중 (spinning) / ✅ 완료 / ❌ 실패
- workerApi.codefCollect() 호출 (단일 요청, Worker가 병렬 처리)
- 완료 후 Firestore 업데이트: debts, assets, collectionDone: true
- 자동으로 STEP 4 진행

[STEP 4] 결과 확인
- 수집 요약 박스:
  채무 N건 합계 X원 / 재산 N건 합계 X원
- 채무 목록 테이블 (채권자, 유형, 금액, 금리)
- 재산 목록 테이블 (재산명, 종류, 청산가치)
- 버튼:
  "서류 생성으로 이동" → /documents?clientId=...
  "재산 추가 입력" → ClientDetailPage 재산탭

상태 관리: src/store/collectionStore.ts (Zustand)
step, consents, selectedBanks, progress, result
```

---

## 📊 STEP 9 — 대시보드 + 청산가치 리포트

```
CLAUDE.md를 읽고 대시보드와 청산가치 리포트를 구현해줘.

1. src/pages/DashboardPage.tsx:
   상단 KPI (3열 2행 그리드):
   - 전체 의뢰인 수 / 이달 신규
   - 수집 완료 / 서류 생성
   - 법원 제출 / 인가 완료
   - 이달 서류 X건 (플랜 한도 표시)
   - 총 관리 채무 합계

   파이프라인 바:
   6단계 수평 바 차트 (의뢰인 수 + 비율)
   각 단계 클릭 → 해당 상태 필터로 /clients 이동

   최근 활동 (5건 테이블):
   이름, 채무, 상태, 마지막 업데이트

   빠른 액션 카드:
   "CODEF 수집 대기" 의뢰인 (status=contacted)
   "서류 미생성" 의뢰인 (collectionDone=true, 서류 0건)

2. src/pages/LiquidationPage.tsx [PRO 이상]:
   청산가치 리포트 페이지

   좌측: 의뢰인 선택 리스트
   우측 리포트:
   헤더: 의뢰인명 + 조회일 + "PDF 출력" 버튼

   섹션 1 — 부동산 자산:
   - workerApi.getPropertyPrice() 자동 조회 (client.address 기반)
   - 공시가격, 근저당, 순청산가치 테이블

   섹션 2 — 차량 자산:
   - assets에서 type='차량'인 항목 목록
   - 기준가액, 저당, 순청산가치

   섹션 3 — 금융 재산:
   - assets에서 예금/보험/증권 목록
   - CODEF 수집 기준

   섹션 4 — 우선채권 공제:
   - 체납세금 (직접 입력)
   - 임금채권 (직접 입력)
   - 소액 보증금 (직접 입력)

   섹션 5 — 청산가치 최종:
   (부동산 + 차량 + 금융) - 우선채권 = 청산가치 합계
   36개월 총 변제액 vs 청산가치 비교:
   ✅ 충족 (초록) / ⚠️ 미달 (빨강) + 부족액 표시
```

---

## 🔒 STEP 10 — 요금제 제한 + 빌드 + 배포

```
CLAUDE.md를 읽고 요금제 제한 로직, 빌드, 배포를 완성해줘.

1. 요금제 제한 로직 강화:
   - 의뢰인 등록: Firestore clientCount 조회 후 플랜 한도 확인
   - 서류 생성: docCountThisMonth 조회 후 한도 확인
   - HWPX 생성: plan !== 'pro' && plan !== 'enterprise' → 차단
   - 청산가치 리포트: plan === 'starter' → 차단
   - Worker에서도 2차 검증 (Firebase JWT의 plan 클레임 확인)

2. TypeScript 오류 전수 확인 및 수정:
   npm run type-check (worker/ 와 src/ 모두)

3. Worker 빌드 + 배포:
   cd worker
   wrangler secret put CODEF_CLIENT_ID
   wrangler secret put CODEF_CLIENT_SECRET
   wrangler secret put FIREBASE_PROJECT_ID
   wrangler secret put PUBLIC_DATA_API_KEY
   wrangler r2 bucket create lawdocs-docs
   wrangler kv:namespace create TOKEN_CACHE
   wrangler deploy

4. 프론트엔드 빌드 + 배포:
   npm run build
   firebase deploy --only hosting,firestore

5. README.md 생성:
   ## LawDocs 설정 가이드
   ### 1. 준비물
   - CODEF 계정 (developer.codef.io) → CLIENT_ID, CLIENT_SECRET
   - Cloudflare 계정 (cloudflare.com)
   - Firebase 프로젝트 (console.firebase.google.com)
   - 공공데이터포털 API 키 (data.go.kr)

   ### 2. Worker 배포 (Cloudflare)
   cd worker
   wrangler secret put CODEF_CLIENT_ID  # CODEF 키 입력
   wrangler secret put CODEF_CLIENT_SECRET
   wrangler secret put FIREBASE_PROJECT_ID  # Firebase 프로젝트 ID
   wrangler deploy

   ### 3. 프론트엔드 배포 (Firebase)
   .env.local 작성 (VITE_WORKER_BASE_URL=https://lawdocs-worker.xxx.workers.dev)
   npm run build && firebase deploy

   ### 4. DOCX/HWPX 템플릿 업로드
   Cloudflare R2 콘솔 → lawdocs-docs 버킷
   templates/docx/*.docx 파일 업로드 (5종)
   templates/hwpx/*.hwpx 파일 업로드 (5종)

   ### 5. 서비스 시작
   회원가입 → 14일 PRO 무료체험 자동 부여
```

---

## 🛠 보너스 명령

### DOCX 템플릿 파일 생성
```
worker/templates/docx/ 에 들어갈 개인회생 서류 DOCX 템플릿 5종을 생성해줘.
docxtemplater 문법 사용 (중괄호 변수: {clientName}, 반복: {#debts}...{/debts}).

각 파일에 포함할 내용:
- debt_list.docx: 제목, 채무자 기본정보, {#debts} 반복 테이블, 합계행, 서명란
- asset_list.docx: 제목, {#assets} 반복 테이블 (공시가격/환가율/청산가치 3열), 합계
- income_list.docx: 수입/지출 각 섹션, 월 변제금 계산 결과
- application.docx: 개인회생 신청서 전문 (신청인, 신청이유, 첨부서류)
- repay_plan.docx: 변제계획안 (채권자별 배분율 테이블, 변제기간)

node.js 스크립트로 생성 (docxtemplater 없이 docx 패키지로 기본 구조 생성):
npm install docx
node scripts/createTemplates.js
```

### 토스페이먼츠 결제 연동
```
src/pages/SettingsPage.tsx 구독 관리 탭에 토스페이먼츠 결제를 연동해줘.

1. @tosspayments/payment-widget 설치
2. 플랜 선택 → 토스페이먼츠 위젯 오픈
3. 결제 성공 콜백 → Firestore office.plan, office.planExpiry 업데이트
4. Worker /billing/confirm 엔드포인트로 서버 검증 (토스 API 호출)
5. 가격: starter 49000 / pro 99000 / enterprise 199000 (월)
   연간: starter 490000 / pro 990000 / enterprise 1990000
```

### 다중 사용자 (사무소 내 직원)
```
사무소 내 여러 직원이 같은 officeId로 접근할 수 있도록 구현해줘.

1. Office에 members: string[] (uid 배열) 추가
2. "직원 초대" 이메일 → Firebase Auth 계정 생성 링크 발송
3. 직원 로그인 시 officeId 연결
4. 플랜별 허용 인원: starter 1명, pro 3명, enterprise 무제한
5. 역할: owner(대표) / staff(직원) — staff는 설정·결제 불가
```
