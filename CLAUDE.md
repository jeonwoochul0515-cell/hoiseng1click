# LawDocs — 법률사무소 자동문서생성 SaaS

## 서비스 개요
법무사·변호사 사무소 전용 구독형 SaaS.
CODEF API + 공공데이터 API로 의뢰인 금융정보를 1회 인증으로 자동 수집하고
개인회생·파산 신청 법원 제출 서류 5종을 **DOCX / HWPX 템플릿 기반으로 자동 생성**한다.
Cloudflare Workers가 CODEF 프록시 + 문서 생성 서버 역할을 담당한다.

---

## 기술 스택

```
Frontend  : React 18 + Vite + TypeScript
UI        : Tailwind CSS + shadcn/ui
State     : Zustand + TanStack Query v5
Auth      : Firebase Authentication
DB        : Firebase Firestore
File 저장  : Cloudflare R2 (생성된 DOCX/HWPX 파일)
API 서버   : Cloudflare Workers (CODEF 프록시 + 문서 생성)
KV 캐시    : Cloudflare KV (CODEF 토큰 캐싱)
공공 API   : 국토교통부 공시가격 / 자동차 등록 API
문서 생성  : docxtemplater (DOCX) + hwpx-builder (HWPX)
배포       : Firebase Hosting (프론트) + Cloudflare Workers (API)
```

---

## 구독 요금제

```
┌─────────────────────────────────────────────────────────┐
│  STARTER   │  PRO        │  ENTERPRISE                  │
│  49,000원  │  99,000원   │  199,000원                   │
│  /월        │  /월         │  /월                         │
├─────────────┼─────────────┼─────────────────────────────┤
│ 의뢰인 30명  │ 의뢰인 150명 │ 의뢰인 무제한               │
│ 서류 50건/월 │ 서류 무제한  │ 서류 무제한                  │
│ CODEF 수집  │ CODEF 수집  │ CODEF 수집                   │
│ DOCX 출력   │ DOCX+HWPX   │ DOCX+HWPX                   │
│ 사용자 1명  │ 사용자 3명  │ 사용자 무제한                 │
│ 이메일 지원 │ 우선 지원   │ 전담 지원 + 온보딩            │
│             │ 청산가치리포 │ 청산가치리포트                │
│             │             │ API 직접 연동 (화이트라벨)    │
│             │             │ 맞춤 서류 양식 등록           │
└─────────────┴─────────────┴─────────────────────────────┘

연간 결제 시 2개월 무료 (약 17% 할인)
14일 무료체험 (카드 등록 불필요)
```

---

## 디렉터리 구조

```
lawdocs/
├── CLAUDE.md
├── .env.local                    # 환경변수 (gitignore)
├── firebase.json
├── firestore.rules
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── package.json
│
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── firebase.ts
│   │
│   ├── types/
│   │   ├── client.ts
│   │   ├── document.ts
│   │   └── subscription.ts
│   │
│   ├── store/
│   │   ├── authStore.ts
│   │   ├── clientStore.ts
│   │   └── uiStore.ts
│   │
│   ├── api/
│   │   ├── worker.ts            # Cloudflare Workers 호출
│   │   ├── firestore.ts         # Firestore CRUD
│   │   └── publicData.ts        # 공공데이터 API (직접 호출)
│   │
│   ├── hooks/
│   │   ├── useClients.ts
│   │   ├── useCollection.ts
│   │   └── useDocGen.ts
│   │
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── ClientsPage.tsx
│   │   ├── ClientDetailPage.tsx
│   │   ├── CollectionPage.tsx
│   │   ├── DocumentsPage.tsx
│   │   ├── LiquidationPage.tsx
│   │   └── SettingsPage.tsx
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── TopBar.tsx
│   │   ├── client/
│   │   │   ├── ClientForm.tsx
│   │   │   ├── DebtTable.tsx
│   │   │   └── AssetPanel.tsx
│   │   ├── property/
│   │   │   ├── PropertyLookup.tsx
│   │   │   └── VehicleLookup.tsx
│   │   ├── collection/
│   │   │   ├── ConsentStep.tsx
│   │   │   ├── AuthStep.tsx
│   │   │   ├── CollectStep.tsx
│   │   │   └── ResultStep.tsx
│   │   ├── documents/
│   │   │   ├── DocSelector.tsx
│   │   │   ├── DocPreview.tsx
│   │   │   └── DocDownloadButton.tsx
│   │   └── subscription/
│   │       ├── PlanBadge.tsx
│   │       └── UpgradeModal.tsx
│   │
│   └── utils/
│       ├── calculator.ts
│       └── formatter.ts
│
├── worker/                        # Cloudflare Workers
│   ├── package.json
│   ├── tsconfig.json
│   ├── wrangler.toml
│   └── src/
│       ├── index.ts              # Worker 라우터
│       ├── codefProxy.ts         # CODEF API 프록시
│       ├── docxGenerator.ts      # DOCX 생성
│       ├── hwpxGenerator.ts      # HWPX 생성
│       ├── publicDataProxy.ts    # 공공데이터 프록시
│       └── auth.ts               # Firebase JWT 검증
│
└── templates/                    # 서류 템플릿 파일
    ├── docx/
    │   ├── debt_list.docx         # 채권자 목록 템플릿
    │   ├── asset_list.docx        # 재산 목록 템플릿
    │   ├── income_list.docx       # 수입지출 목록 템플릿
    │   ├── application.docx       # 개인회생 신청서 템플릿
    │   └── repay_plan.docx        # 변제계획안 템플릿
    └── hwpx/
        ├── debt_list.hwpx
        ├── asset_list.hwpx
        ├── income_list.hwpx
        ├── application.hwpx
        └── repay_plan.hwpx
```

---

## Cloudflare Workers API 엔드포인트

```
BASE URL: https://api.lawdocs.kr  (또는 lawdocs-worker.계정명.workers.dev)

POST /codef/collect         CODEF 금융데이터 수집
POST /codef/token-refresh   CODEF 토큰 갱신
GET  /public/property        부동산 공시가격 조회 (공공데이터 프록시)
GET  /public/vehicle         차량 기준가액 조회
POST /doc/generate           서류 생성 (DOCX or HWPX 반환)
GET  /doc/download/:fileId   생성된 파일 다운로드
POST /auth/verify            Firebase JWT 검증
```

---

## 데이터 모델

### Client
```typescript
interface Client {
  id: string;
  name: string;
  ssn: string;           // 암호화 저장
  phone: string;
  address: string;
  job: string;
  jobType: 'employed' | 'self' | 'freelance' | 'daily' | 'unemployed';
  family: number;
  court: string;
  income: number;
  income2: number;
  rent: number;
  education: number;
  medical: number;
  status: 'new' | 'contacted' | 'collecting' | 'drafting' | 'submitted' | 'approved';
  collectionDone: boolean;
  connectedId?: string;  // CODEF Connected ID (재사용)
  debts: Debt[];
  assets: Asset[];
  memo: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface Debt {
  id: string;
  name: string;
  creditor: string;
  type: '무담보' | '담보' | '사채';
  amount: number;
  rate: number;
  monthly: number;
  source: 'codef' | 'manual';
}

interface Asset {
  id: string;
  name: string;
  type: '부동산' | '차량' | '예금' | '보험' | '증권' | '기타';
  rawValue: number;
  liquidationRate: number;
  mortgage: number;
  value: number;        // 순 청산가치
  source: 'codef' | 'api' | 'manual';
  meta?: { plate?: string; year?: number; address?: string; area?: number; };
}
```

### Office (사무소)
```typescript
interface Office {
  id: string;
  name: string;
  type: 'lawyer' | 'scrivener';
  rep: string;
  phone: string;
  plan: 'starter' | 'pro' | 'enterprise';
  planExpiry: Timestamp;
  clientCount: number;
  docCountThisMonth: number;
  codefConnected: boolean;
  createdAt: Timestamp;
}
```

---

## 변제금 계산 모듈

```typescript
// 2026년 기준중위소득 (보건복지부 고시)
const MEDIAN_INCOME_2026: Record<number, number> = {
npm install -g @google/gemini-cli

## 색상 시스템

```typescript
// tailwind.config.ts
colors: {
  brand: {
    navy: '#0D1B2A', gold: '#C9A84C',
    green: '#1B5E3B', blue: '#1A3A8F',
  },
  status: {
    new: '#3B82F6', contacted: '#8B5CF6',
    collecting: '#C9A84C', drafting: '#8B5CF6',
    submitted: '#F59E0B', approved: '#10B981',
  },
  plan: {
    starter: '#6B7280', pro: '#C9A84C', enterprise: '#8B5CF6',
  }
}
```

---

## 개발 단계

### Phase 1 (4주) — MVP
- 인증 + 사무소 등록 + 요금제 설정
- 의뢰인 CRUD + 수동 입력
- 변제금 계산기
- DOCX 템플릿 기반 서류 5종 생성

### Phase 2 (3주) — CODEF 연동
- Cloudflare Workers CODEF 프록시
- 금융 데이터 자동 수집
- HWPX 서류 생성 추가

### Phase 3 (2주) — 공공 API
- 부동산 공시가격 자동 조회
- 차량 기준가액 자동 조회
- 청산가치 리포트

### Phase 4 (1주) — SaaS 완성
- 요금제 제한 로직 (의뢰인 수, 서류 건수)
- 결제 연동 (토스페이먼츠)
- 배포 + 테스트
