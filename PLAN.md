# 개인회생 서류 자동화 서비스 — 구현 계획서 v2

> 2026-03-29 | 리서치 + 재검사 기반 고도화 플랜

---

## 목표

**기존 2~4주 걸리던 서류 수집을 1~2일로 단축**
- 40개 첨부서류 중 25개 자동 수집 (63%)
- 8개 데이터만 자동 + PDF는 바로가기 (20%)
- 7개만 수동 (17%)

---

## 전체 아키텍처

```
[의뢰인 스마트폰]
  └─ 크레딧포유 PDF 다운 → 업로드 (5분)

[법무사 대시보드] — 7단계 위자드
  ├─ Step 1: 동의 (기존 유지)
  ├─ Step 2: 크레딧포유 PDF 업로드 → AI 파싱 (신규)
  ├─ Step 3: 인증 — PFX + 간편인증 + 홈택스 ID/PW (기존 확장)
  ├─ Step 4: 자동수집 — CODEF 금융 + 공공 + 공시가격 (기존 세분화)
  ├─ Step 5: 서류 체크리스트 — 바로가기 버튼 + 업로드 (신규)
  ├─ Step 6: 수동 보완 — 사채, 임대차, 퇴직금 (신규)
  └─ Step 7: 검증 + 서류 자동생성 (기존 확장)

[Backend]
  ├─ Cloud Functions: PDF 파싱 (Claude Haiku), CODEF 프록시
  ├─ Firestore: 파이프라인 상태, 중간 저장
  └─ Firebase Storage: PDF 원본 보관
```

---

## Phase 1: 크레딧포유 PDF → AI 파싱 (Week 1)

### Backend

**`functions/src/creditReportParser.ts` (신규)**
- Firebase Storage에서 PDF 다운로드
- 비밀번호 보호 해제 (주민번호 앞6자리, `ssnCrypto.ts` 활용)
- Claude Haiku 3.5 `document` type으로 PDF 직접 전송
- JSON 응답: 채권자명, 유형, 원금, 이자, 연체, 대출일, 만기일
- Firestore `clients/{id}` debts 배열에 `source: 'pdf'`로 저장
- `creditorDirectory.ts` 매칭으로 채권자 주소/전화 자동 입력

**`functions/src/index.ts` (수정)**
- `app.post("/credit-report/parse", handleCreditReportParse)` 추가

### Frontend

**`src/components/collection/CreditPdfStep.tsx` (신규)**
- credit4u.or.kr 바로가기 버튼 (새 탭)
- 3단계 가이드 (접속 → 조회 → PDF 다운)
- FileUploadZone (드래그앤드롭, .pdf 전용)
- 파싱 상태 실시간 표시 (Firestore onSnapshot)
- 파싱 결과 채권자 테이블 미리보기 + 편집
- "건너뛰기" 버튼 (CODEF만으로 진행)

**`src/components/collection/ParsedDebtTable.tsx` (신규)**
- 채권자명, 유형, 원금, 이자율 편집 가능 테이블
- CODEF 데이터와 불일치 시 노란 하이라이트
- "확인 완료" 버튼 → Client.debts에 반영

**비용:** Claude Haiku 건당 $0.003~0.01

---

## Phase 2: 공공기관 ID/PW 인증 (Week 1~2)

### Backend

**`functions/src/codefPublicAuth.ts` (신규)**
- 홈택스 ID/PW → CODEF connectedId 생성 (loginType: "1")
- 건보공단, 국민연금, 근로복지공단도 동일 패턴
- 정부24는 간편인증 (loginType: "5")
- connectedId를 Firestore `publicConnectedIds` 필드에 저장

**이미 구현된 것 활용:**
- `codefPublic.ts`: 홈택스/건보/연금 API 핸들러 존재
- `codefProxy.ts`: callCodef, getToken 함수 재사용

### Frontend

**`src/components/collection/AuthStep.tsx` (수정)**
- 기존 PFX/간편인증 탭에 "홈택스 ID/PW" 탭 추가
- ID/PW 입력 → 서버 전송 후 즉시 삭제 (로컬 미저장)
- 인증 성공 시 자동 데이터 수집 시작

---

## Phase 3: 바로가기 버튼 시스템 (Week 2)

### 보험사 해약환급금 — 바로가기

| 보험사 | 바로가기 대상 | 안내 |
|--------|-------------|------|
| **통합** | insure.or.kr (내보험다보여) | 모든 보험 계약 + 해약환급금 한번에 |
| 삼성생명 | samsunglife.com 마이페이지 | 마이페이지 > 계약상세 > 해약환급금 |
| 한화생명 | hanwhalife.com 마이페이지 | 동일 패턴 |
| (기타) | 각 보험사 마이페이지 | 동일 패턴 |

### 채무잔액확인서 — 바로가기

| 기관 | 바로가기 | 안내 경로 |
|------|---------|----------|
| **통합** | credit4u.or.kr | 전체 채무 통합조회 |
| 국민은행 | kbstar.com | 뱅킹서비스 > 증명서 > 잔액증명서 |
| 삼성카드 | samsungcard.com | 마이페이지 > 증명서 > 채무잔액확인서 |
| (기타) | 각 기관 메인 | 메뉴 경로 텍스트 안내 |

### 구현

**`src/utils/bankDirectory.ts` (수정)**
- 보험사 해약환급금 URL 추가
- 기관별 "증명서 발급 메뉴 경로" 텍스트 추가

**`src/components/collection/ExternalLinkButton.tsx` (신규)**
- 공통 바로가기 버튼 컴포넌트
- 아이콘 + 기관명 + "새 탭에서 열기"
- 메뉴 경로 툴팁 표시

**핵심 원칙:** URL 딥링크 대신 **메인 홈페이지 + 메뉴 경로 텍스트 안내** (딥링크는 불안정)

---

## Phase 4: 위자드 UI 고도화 (Week 2~3)

### 재검사 결과: 7단계 → 4단계 유지 (내용만 풍부하게)

7단계는 다중채무자에게 심리적 부담. 기존 4단계 구조를 살리되 각 단계 내부를 확장.

```
Step 1: 시작 (동의 + 크레딧포유 PDF 업로드)
  └─ ConsentStep 유지 + CreditPdfStep 통합 (PDF는 선택)

Step 2: 인증 및 수집 (기존 AuthStep + CollectStep 통합)
  └─ PFX/간편인증 + 홈택스 ID/PW → 인증 즉시 자동수집 시작

Step 3: 서류 보완 (체크리스트 + 수동입력 + 바로가기 통합)
  └─ 40개 항목 체크리스트 (자동수집 완료 항목 체크)
  └─ 바로가기 버튼 (보험 해약환급금, 채무잔액확인서)
  └─ 수동 입력 (사채, 임대차, 퇴직금)

Step 4: 확인 및 생성 (기존 ResultStep 확장)
  └─ CODEF vs PDF 불일치 해결 UI ("어떤 값 사용?" 선택)
  └─ 편집 가능 채무/재산 테이블
  └─ 변제계획안 자동계산 미리보기
  └─ 서류 5종 일괄 생성 (DOCX/HWPX)
```

### 신규 컴포넌트

**`src/components/collection/WizardStepper.tsx`**
- 7단계 진행률 바 (모바일: 상단 고정 축약형)
- 예상 소요시간 표시 ("약 20분 남음")

**`src/components/collection/ChecklistStep.tsx`**
- `requiredDocs.ts`의 `generateDocButtons()` 활용
- 카테고리별 아코디언 (기본서류/은행/카드/보험/소득/자산)
- 각 항목 상태: 자동수집(초록) / 업로드완료(파랑) / 미완료(회색)
- 바로가기 버튼 + 업로드 버튼

**`src/components/collection/SupplementStep.tsx`**
- 사채 입력 폼 (채권자명, 금액, 금리, 차용일)
- 임대차 정보 (보증금, 월세, 계약서 업로드)
- 퇴직금 예상액 입력
- 각 섹션 "해당 없음" 체크 시 접기

**`src/components/collection/ReviewStep.tsx`**
- 채무/재산 편집 가능 테이블 (기존 ResultStep 확장)
- CODEF vs PDF 불일치 하이라이트
- 서류 5종 일괄 생성 버튼 (DOCX/HWPX)
- 서류 수집 완료율 요약

### 중간 저장

**`src/store/collectionStore.ts` (확장)**
- 크레딧포유 PDF 상태, 홈택스 인증, 체크리스트, 수동입력 상태 추가
- Firestore `clients/{id}/collectionDraft`에 디바운스 2초 자동저장
- 페이지 재진입 시 draft 로드 → 이어서 진행

---

## Phase 5: UI/UX 고도화 (Week 3~4)

### 모바일 우선

- WizardStepper: 모바일에서 축약형 상단 고정
- FileUploadZone: `capture="environment"` 카메라 촬영 지원
- 테이블: 모바일에서 카드형으로 변환
- 바로가기 버튼: 전체 너비

### 에러 대안 제시

```
수집 실패 시:
[다시 시도] [해당 기관에서 직접 발급 (새 탭)] [나중에 수동 업로드]
```

기존 AuthStep의 CODEF 에러코드 매핑 패턴 확장.

### 의뢰인 가이드

- 크레딧포유 PDF 다운로드 방법: 스크린샷 3장 + 30초 동영상
- 카카오톡으로 가이드 링크 전송 기능

---

## 서류 40개 자동화 매핑

### 자동 수집 (CODEF/API) — 25개

| # | 서류 | CODEF 엔드포인트 | loginType |
|---|------|-----------------|-----------|
| 1 | 주민등록등본 | `/v1/kr/public/mw/resident-registration-copy/issuance` | 간편인증 |
| 2 | 주민등록초본 | `/v1/kr/public/mw/resident-registration-abstract/issuance` | 간편인증 |
| 3 | 가족관계증명서 | `/v1/kr/public/ck/family-relations/issue` | 간편인증 |
| 4 | 소득금액증명원 | `/v1/kr/public/mw/issuance/proof-income` | 홈택스 ID/PW |
| 5 | 원천징수영수증 | `/v1/kr/public/nt/proof-issue/paystatement-income` | 홈택스 ID/PW |
| 6 | 건보 자격득실확인서 | `/v1/kr/public/pp/nhis-join/identify-confirmation` | ID/PW |
| 7 | 건보 납부확인서 | `/v1/kr/public/pp/nhis-insurance-payment/confirmation` | ID/PW |
| 8 | 국민연금 가입증명 | `/v1/kr/public/pp/nps-minwon/member-join-list` | ID/PW |
| 9 | 납세증명서 | `/v1/kr/public/nt/proof-issue/tax-cert-all` | 홈택스 ID/PW |
| 10 | 지방세 과세증명 | `/v1/kr/public/mw/localtax-payment-certificate/inquiry` | 간편인증 |
| 11 | 부동산 등기부등본 | `/v1/kr/public/ck/real-estate-register/status` | - (건당 700원) |
| 12 | 부동산 공시가격 | data.go.kr API | API키 (무료) |
| 13 | 자동차등록원부 | `/v1/kr/public/mw/car-registration-a/issuance` | 간편인증 |
| 14 | 차량 시세 | `/v1/kr/etc/complex/used-car/common-price-info` | - |
| 15 | 은행 예금잔액 | `/v1/kr/bank/p/account/account-list` | PFX/간편 |
| 16 | 은행 대출목록 | `/v1/kr/bank/p/loan/transaction-list` | PFX/간편 |
| 17 | 카드 대출목록 | `/v1/kr/card/p/account/card-list` | PFX/간편 |
| 18 | 카드 청구내역 | `/v1/kr/card/p/account/billing-list` | PFX/간편 |
| 19 | 보험 계약목록 | `/v1/kr/insurance/0001/credit4u/contract-info` | 인증서 |
| 20 | 증권 자산 | `/v1/kr/stock/a/account/financial-assets` | PFX/간편 |
| 21 | 은행 거래내역 | `/v1/kr/bank/p/account/transaction-list` | PFX/간편 |
| 22 | 4대보험 체납 | `/v1/kr/public/pp/nhis-insurance-payment/confirmation` | ID/PW |
| 23 | 고용보험 이력 | 근로복지공단 엔드포인트 | ID/PW |
| 24 | 위택스 지방세 | `/v1/kr/public/wt/local-tax/imposition-details` | ID/PW |
| 25 | 신용정보조회서 | 크레딧포유 PDF → AI 파싱 | 의뢰인 직접 |

### 바로가기 버튼 (데이터는 자동, PDF는 외부발급) — 8개

| # | 서류 | 바로가기 대상 | 안내 |
|---|------|-------------|------|
| 26 | 보험 해약환급금 | insure.or.kr (통합) + 각 보험사 | 마이페이지 > 해약환급금 |
| 27 | 은행 채무잔액증명서 | 각 은행 인터넷뱅킹 | 증명서 > 잔액증명서 |
| 28 | 카드 채무확인서 | 각 카드사 홈페이지 | 마이페이지 > 증명서 |
| 29 | 저축은행 채무확인서 | 각 저축은행 | 마이페이지 > 증명서 |
| 30 | 예금잔액증명서 | 각 은행 | 증명서 > 잔액증명서 |
| 31 | 전금융기관 계좌조회 | payinfo.or.kr | 내계좌한눈에 |
| 32 | 보험가입내역 | insure.or.kr | 내보험찾아줌 |
| 33 | 사업자등록증 | hometax.go.kr | 민원증명 > 사업자등록 |

### 수동 입력/업로드 필수 — 7개

| # | 서류 | 수집 방법 |
|---|------|----------|
| 34 | 급여명세서 | 회사에서 받아 업로드 (사진/PDF) |
| 35 | 재직증명서 | 회사에서 받아 업로드 |
| 36 | 퇴직금증명서 | 회사에서 받아 업로드 |
| 37 | 임대차계약서 | 사진 촬영 업로드 |
| 38 | 의료비 증빙 | 해당 시 업로드 |
| 39 | 사채 채무 | 직접 입력 (채권자명, 금액) |
| 40 | 진술서(채무경위) | 텍스트 입력 또는 AI 초안 생성 |

---

## 비용 요약

| 항목 | 1건당 비용 |
|------|-----------|
| CODEF API (25개 자동수집) | 2,000~7,500원 |
| 부동산 등기부등본 | 건당 700원 |
| Claude Haiku PDF 파싱 | ~$0.01 (약 13원) |
| 부동산 공시가격 API | 무료 |
| **합계** | **약 3,000~9,000원/건** |

---

## 구현 일정 (재조정 — 빠른 가치 증명 우선)

| 주차 | 내용 | 가치 증명 |
|------|------|----------|
| **Week 1** | **체크리스트 + 바로가기 버튼** | 법무사 즉시 체감: "40개 서류가 한눈에!" |
| | - `requiredDocs.ts` 확장 (법원별 동적 체크리스트) | |
| | - `bankDirectory.ts` 보험사 URL 추가 | |
| | - Step 3 서류보완 UI (ChecklistStep) | |
| | - ExternalLinkButton 컴포넌트 | |
| **Week 2** | **크레딧포유 PDF 파싱** | "PDF 올리니까 채권자목록이 자동으로!" |
| | - `ocrProcessor.ts`에 `credit_report` 타입 추가 | |
| | - Step 1에 CreditPdfUpload 통합 | |
| | - ParsedDebtTable (편집 가능) | |
| | - `Debt.source`에 `'pdf'` 추가 | |
| **Week 3** | **공공기관 + 변제계획안** | "소득증명도 자동, 변제금도 자동 계산!" |
| | - 홈택스 ID/PW 인증 (codefPublicAuth.ts) | |
| | - `calculator.ts` 확장 (배당률, 우선채권, 청산가치 보장) | |
| | - Step 4 변제계획안 미리보기 | |
| **Week 4** | **통합 + 모바일 + 배포** | 전체 플로우 완성 |
| | - 4단계 위자드 통합 | |
| | - Firestore 중간 저장 | |
| | - 모바일 최적화 | |
| | - CODEF vs PDF 불일치 해결 UI | |

---

## 재검사에서 발견된 추가 고려사항

### 기존 코드 활용 (새로 만들지 말 것)
- `ocrProcessor.ts` — PDF 파싱을 여기에 `credit_report` 타입 추가 (새 파일 불필요)
- `requiredDocs.ts`의 `generateDocButtons()` — 체크리스트 기반 이미 존재
- `bankDirectory.ts`의 `BANK_CERT_DIRECTORY` — 30+ 기관 URL 이미 매핑됨
- `DocumentSubmitPage.tsx` — 의뢰인 전용 서류 제출 UI 이미 존재

### 놓치면 안 되는 것
- **채권양도 이력**: 크레딧포유 PDF에서 추출, CODEF에는 없음
- **대부업체 채무**: 서민금융진흥원(kinfa.or.kr) 바로가기 추가 필수
- **법원별 서류 차이**: `Client.court` 기반 동적 체크리스트
- **CODEF vs PDF 불일치**: "어떤 값 사용?" 선택 UI (단순 하이라이트 부족)
- **의뢰인 플로우 분리**: CollectionPage(법무사용) / DocumentSubmitPage(의뢰인용)

### 기술적 주의
- PDF 비밀번호 해제: `pdf-lib` 또는 `qpdf` 필요 (Claude API는 암호화 PDF 직접 못 읽음)
- Cloud Functions 120초 타임아웃: 25개 서류 순차수집 시 초과 가능 → 기관별 병렬화
- 홈택스 ID/PW 보안: 전송 후 즉시 삭제, 로그 미기록, 에러 로그에도 미포함

---

## 검증 방법

1. **크레딧포유 PDF 파싱**: 실제 신용조회서 PDF 파싱 → 채권자 수/금액 정확도
2. **바로가기 버튼**: 각 금융기관 URL 월 1회 헬스체크
3. **CODEF 공공기관**: 홈택스 ID/PW 소득금액증명 조회 테스트
4. **변제계획안**: 수동 계산 결과와 자동 계산 비교 검증
5. **4단계 위자드**: 실제 의뢰인 데이터 전체 플로우 테스트
6. **모바일**: 스마트폰에서 PDF 업로드 + 바로가기 테스트
