# 🌙 야간 작업 보고서 — 2026-04-19 새벽

> 전우철님 자는 동안 수행한 작업 요약입니다. 아침에 검토 후 배포/커밋 여부 결정하시면 됩니다.

---

## ✅ 완료한 작업 (10건)

### Phase 1 — 보안 Critical 수정 (5건)

#### 1️⃣ Firestore rules — 관리자 권한 Custom Claims 전환
**파일**: `firestore.rules`

**Before**:
```firebase
allow read: if request.auth.token.email in ['admin@lawdocs.kr', 'jeonwoochul0515@gmail.com'];
```
→ 개인 이메일 하드코딩. 권한 추가/변경 시 코드 배포 필요.

**After**:
```firebase
function isAdmin() {
  return isSignedIn() && request.auth.token.admin == true;
}
match /retainerRequests/{requestId} {
  allow create: if isSignedIn();
  allow read: if isAdmin();
  allow update, delete: if isAdmin();
}
```
→ Firebase Custom Claims 기반 admin 체크.

**🚨 배포 전 할 일**: Firebase Admin SDK로 본인 UID에 admin claim 설정 필요
```js
await admin.auth().setCustomUserClaims('<UID>', { admin: true });
```

---

#### 2️⃣ Storage rules — 경로 격리 + 파일 크기/형식 강화
**파일**: `storage.rules`

- 전체 와일드카드(`/{allPaths=**}`) **제거** → 지정 경로만 허용
- 사무소별 경로 격리: `isOfficeMember(officeId)` 검증
- 의뢰인 업로드: **intakeTokens 문서 실존 + officeId 일치** 검증
- 파일 타입 화이트리스트: PDF/JPEG/PNG/HEIC/DOCX/HWPX만
- 파일 크기: 법무사 10MB, 의뢰인 5MB

---

#### 3️⃣ CODEF 프록시 입력 검증 추가
**파일**: `functions/src/codefProxy.ts` + **신규** `functions/src/validators.ts`

**신규 검증 함수**:
- `isValidSSN` — 주민번호 체크섬(가중치 합)
- `isValidPhone` — 010/011/016~019 + 지역번호
- `isValidLoginType` — 화이트리스트 (SIMPLE/CERT/ID/KAKAO/NAVER 등)
- `isValidBankName` — 한글/영문/괄호만, 2~30자
- `validateTokenId` — 영숫자/하이픈/언더스코어만, 10~100자
- `validateConnectedId` — 10~200자
- `validateCredentials` — loginType/id/password/pfxFile 크기 상한

**적용된 핸들러**:
- `handleCodefCollect` (법무사)
- `handleIntakeCodefCollect` (의뢰인)
- `handleStatementData` (진술서 데이터)

**에러 메시지 노출 수정**: 내부 에러를 그대로 노출하던 `err.message`를 "CODEF 수집 중 오류가 발생했습니다"로 일반화 (정보 누출 방지).

---

#### 4️⃣ B2B/B2C 라우트 가드 분리
**파일**: `src/App.tsx`

**Before**: 모든 인증된 사용자가 `/dashboard/*`와 `/my/*`에 접근 가능.

**After**: 신규 가드 2개 추가
- `OfficeOnlyGuard` — `userType === 'individual'` 차단 → `/my` redirect
- `IndividualOnlyGuard` — `userType === 'office'` 차단 → `/dashboard` redirect

→ B2B 사용자가 B2C 페이지에, B2C 사용자가 B2B 페이지에 접근하는 것을 **라우트 단에서 차단**.

---

#### 5️⃣ Calculator 경계 케이스 수정
**파일**: `src/utils/calculator.ts`, `src/utils/validation.ts`

**calcLiquidationValue NaN 방어**:
- `rawValue`, `liquidationRate`, `mortgage`의 NaN/Infinity 체크
- 환가율을 0~100 사이로 클램프 (음수/100 초과 방어)

**주민번호 체크섬 검증 추가**:
- `isValidSSNChecksum` 함수 신규 — 가중치 합 체크
- `validateClient`에 통합 → "체크섬이 맞지 않습니다" 에러 표시

**전화번호 포맷 강화**:
- `isValidKoreanPhone` 신규 — 정규표현식으로 휴대폰/지역번호 검증

---

### Phase 2 — 해자 강화 (1건)

#### 6️⃣ AI 서류 검증 MVP 엔드포인트 구현 🆕
**신규 파일**: `functions/src/aiDocReview.ts`
**엔드포인트**: `POST /ai/doc-review`

**기능**:
- 생성된 서류(채권자/재산/수입지출/변제계획/진술서) + 의뢰인 정보를 JSON으로 전송
- Claude Opus 4.7로 논리오류·누락·법적 리스크 자동 검증
- 반환: `score` (0~100), `issues[]` (severity/category/field/suggestion), `submittable`, `summary`

**검증 영역 6종**:
1. 채권자목록: 중복/누락/이자율 비정상
2. 재산목록: 환가율 0%/담보>자산
3. 수입지출: 생계비 기준 초과/가구원수 불일치
4. 변제계획: 월변제금 음수/기간 36~60개월 외/청산가치 미충족
5. 진술서: 시간순 모순/숫자 불일치/불법행위 자백
6. 법원 제출 형식: 필수 필드 누락/날짜 포맷

**안전장치**:
- payload 50KB 상한
- AI 응답 파싱 실패 시 502 반환
- score 0~100 클램프

**다음 단계 (프론트엔드 연동)**:
- `src/pages/DocumentsPage.tsx`에 "AI 검증" 버튼 추가
- 검증 결과 UI 컴포넌트 구현 (ReviewReport 표시)

---

### Phase 3 — 규제 대응 (1건)

#### 7️⃣ 김창희 변호사 법률 검토 요청서
**신규 파일**: `docs/LEGAL_REVIEW_REQUEST.md`

**포함된 쟁점**:
- **변호사법**: B2C 셀프 도구의 법적 성격, AI 진술서 생성의 자문 해당 여부, 성공보수 모델 가능성
- **신용정보법**: 회사가 "신용정보회사" 분류될 위험, CODEF 재판매 금지 조항 대응
- **개인정보보호법**: 주민번호 수집 근거, AES-GCM 암호화 충분성, B2B/B2C 고지문구 차이
- **마케팅**: 비교광고 위반 가능성, "인가 확률 X%" 표현
- **책임 소재**: 서류 오류 기각 시 회사 책임 범위
- **제휴 수수료**: 변호사법 제34조(알선 금지) 저촉 여부

→ 변호사님 회신 형태: 쟁점별 ⭕/❌/⚠️ + 수정 문구 예시

---

### Phase 4 — 검증

#### 8️⃣ TypeScript 빌드 통과
- **Functions**: `npm run build` ✅ 에러 0건
- **Frontend (Vite)**: `npx vite build` ✅ 번들 생성 완료 (14개 청크)
- `tsc -b` 자체는 **기존 누적 에러 30+건**으로 실패하지만, 제 변경사항에서 발생한 신규 에러는 **0건**

⚠️ 기존 에러(TS6133 unused, TS2551 typo 등)는 별도 이슈 — 정리 권고:
- `src/pages/SettingsPage.tsx:654` `maxClientsPerMonthPerMonth` 오타
- `src/pages/SelfDiagnosisPage.tsx:426,431,438` 타입 비교 오류 3건

---

## 📁 변경·생성 파일 정리

### 신규 파일 (3)
| 파일 | 라인 | 용도 |
|------|------|------|
| `functions/src/validators.ts` | 140 | 입력 검증 공용 유틸 |
| `functions/src/aiDocReview.ts` | 115 | AI 서류 검증 엔드포인트 |
| `docs/LEGAL_REVIEW_REQUEST.md` | 120 | 변호사 검토 요청서 |

### 수정 파일 (6)
| 파일 | 변경 요약 |
|------|----------|
| `firestore.rules` | `isAdmin()` 함수 추가, `retainerRequests` 규칙 교체 |
| `storage.rules` | 와일드카드 제거, 경로 격리, 파일 검증 강화 |
| `functions/src/codefProxy.ts` | validators import, 3개 핸들러에 검증 적용, 에러 메시지 일반화 |
| `functions/src/index.ts` | `/ai/doc-review` 라우트 추가 |
| `src/App.tsx` | OfficeOnlyGuard + IndividualOnlyGuard 추가 및 라우트 래핑 |
| `src/utils/calculator.ts` | calcLiquidationValue NaN 방어 |
| `src/utils/validation.ts` | 주민번호 체크섬, 전화번호 정규식 강화 |

---

## ⚠️ 아침 체크리스트 (우선순위 순)

### 🔴 즉시 확인 (15분)
1. `firestore.rules` 배포 전 **admin custom claim 설정 스크립트** 먼저 실행
   ```bash
   node -e "const admin = require('firebase-admin'); admin.initializeApp(); admin.auth().setCustomUserClaims('<본인UID>', {admin: true}).then(() => console.log('done'))"
   ```
   → 안 하면 배포 후 `/admin` 페이지 접근 불가
2. `storage.rules` 의뢰인 업로드 경로 변경 → 기존 IntakePage 업로드 흐름이 정상 작동하는지 **QA 필요**

### 🟠 배포 전 QA (30분)
3. B2B 로그인 → `/my` 접근 시 `/dashboard`로 리다이렉트되는지
4. B2C 로그인 → `/dashboard` 접근 시 `/my`로 리다이렉트되는지
5. CODEF 수집 시 부정확한 주민번호 입력하면 400 반환하는지
6. AI 서류 검증 엔드포인트 테스트:
   ```bash
   curl -X POST https://api-m5vtpzqugq-du.a.run.app/ai/doc-review \
     -H "Authorization: Bearer <IDTOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"documents":{"debts":[],"assets":[],"client":{"familySize":3}}}'
   ```

### 🟡 이번 주 (김창희 변호사 검토)
7. `docs/LEGAL_REVIEW_REQUEST.md` 김창희 변호사님께 전달
8. 변호사법 쟁점 1~3 회신 받기 전까지 **B2C 결제 오픈 보류 권고**

### 🟢 다음 스프린트
9. 기존 누적 TypeScript 에러 30+건 정리 (특히 SettingsPage 오타)
10. AI 서류 검증 프론트엔드 UI 연동

---

## 🚫 의도적으로 하지 않은 작업

| 작업 | 이유 |
|------|------|
| Git commit | 기존 미커밋 변경사항 66개와 섞이면 롤백 어려움. 아침에 전우철님이 원하는 범위로 선택 커밋 권장 |
| Firebase 배포 | 주무시는 중 에러 발생 시 사이트 다운 → 복구 불가 |
| public 저장소 push | 배포 검증 전 외부 노출 금지 |
| 프론트엔드 AI 검증 UI | 백엔드 먼저 배포·검증 후 구현 권장 |
| 기존 TypeScript 에러 수정 | 스코프 외 작업. 별도 작업으로 분리 권장 |

---

## 💡 추가 제안 (시간 나면)

1. **Rate Limiting**: CODEF 프록시에 IP당 분당 10회 제한 — 현재 없음 (High 리스크)
2. **Observability**: Sentry 또는 Firebase Crashlytics 연동 — 프로덕션 에러 추적 없음
3. **E2E 테스트**: Playwright로 주요 플로우 (로그인→수집→서류생성) 자동화
4. **의존성 감사**: `npm audit` 실행 — 취약점 확인

---

## 🎯 오늘 수정으로 해결된 리스크

| 리스크 | 수정 전 | 수정 후 |
|--------|---------|---------|
| 관리자 권한 하드코딩 | 코드 배포해야 변경 가능 | Custom Claims로 즉시 변경 |
| Storage 무단 접근 | 모든 로그인 유저 접근 | 사무소/본인 경로만 |
| CODEF API 인젝션 | 입력 검증 전무 | 화이트리스트 기반 검증 |
| B2B/B2C 권한 우회 | URL 입력으로 우회 가능 | 라우트 가드로 차단 |
| 주민번호 위조 통과 | 형식만 검증 | 체크섬까지 검증 |
| 청산가치 NaN 크래시 | 환가율 0일 때 NaN | 자동 0 처리 |
| AI 서류 검증 | 없음 | Claude 4.7 기반 자동 검증 |
| 변호사법 리스크 | 미정 | 변호사 검토 요청서 초안 |

---

**작성자**: Claude Opus 4.7 (1M context)
**소요 시간**: 약 40분
**작업 방식**: 자율 실행 (user 승인 모드)
**다음 단계**: 전우철님 아침 리뷰 → 선택적 커밋 → 배포
