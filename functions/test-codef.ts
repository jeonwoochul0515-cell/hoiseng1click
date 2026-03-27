/**
 * CODEF API 연결 테스트 스크립트
 * 실행: npx ts-node --project tsconfig.json test-codef.ts
 */
import * as dotenv from "dotenv";
dotenv.config();

const OAUTH_URL = "https://oauth.codef.io/oauth/token";
const CODEF_BASE = process.env.CODEF_API_HOST || "https://development.codef.io";

async function testOAuth(): Promise<string | null> {
  console.log("\n=== TEST 1: CODEF OAuth 토큰 발급 ===");
  console.log(`  Client ID: ${process.env.CODEF_CLIENT_ID?.slice(0, 8)}...`);
  console.log(`  API Host: ${CODEF_BASE}`);

  const creds = Buffer.from(
    `${process.env.CODEF_CLIENT_ID}:${process.env.CODEF_CLIENT_SECRET}`
  ).toString("base64");

  try {
    const res = await fetch(OAUTH_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials&scope=read",
    });

    const data = await res.json();
    if (res.ok && data.access_token) {
      console.log(`  ✅ 토큰 발급 성공! (길이: ${data.access_token.length})`);
      return data.access_token;
    } else {
      console.log(`  ❌ 토큰 발급 실패: ${res.status}`, data);
      return null;
    }
  } catch (err: any) {
    console.log(`  ❌ 네트워크 오류: ${err.message}`);
    return null;
  }
}

async function testApiCall(token: string): Promise<void> {
  console.log("\n=== TEST 2: CODEF API 호출 (connectedId 목록 조회) ===");
  console.log(`  Content-Type: application/x-www-form-urlencoded`);
  console.log(`  Body encoding: encodeURIComponent(JSON.stringify(...))`);

  const body = { pageNo: 0 };
  const encodedBody = encodeURIComponent(JSON.stringify(body));

  try {
    const res = await fetch(`${CODEF_BASE}/v1/account/connectedId-list`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: encodedBody,
    });

    const text = await res.text();
    // URL 디코딩 먼저 (CODEF SDK 방식)
    let decoded: string;
    try {
      decoded = decodeURIComponent(text.replace(/\+/g, " "));
    } catch {
      decoded = text;
    }

    const parsed = JSON.parse(decoded);
    const code = parsed?.result?.code;
    const message = parsed?.result?.message;

    console.log(`  HTTP Status: ${res.status}`);
    console.log(`  CODEF Code: ${code}`);
    console.log(`  CODEF Message: ${message}`);

    if (code === "CF-00000") {
      console.log(`  ✅ API 호출 성공!`);
      const connectedIds = parsed?.data ?? [];
      console.log(`  ConnectedID 수: ${Array.isArray(connectedIds) ? connectedIds.length : 'N/A'}`);
    } else if (code === "CF-00001") {
      console.log(`  ✅ API 호출 성공 (데이터 없음 — 정상)`);
    } else {
      console.log(`  ⚠️  API 응답 코드: ${code} — ${message}`);
    }
  } catch (err: any) {
    console.log(`  ❌ 호출 실패: ${err.message}`);
  }
}

async function testWrongContentType(token: string): Promise<void> {
  console.log("\n=== TEST 3: 구 방식 비교 (application/json — 버그 재현) ===");

  const body = { pageNo: 0 };
  const encodedBody = encodeURIComponent(JSON.stringify(body));

  try {
    const res = await fetch(`${CODEF_BASE}/v1/account/connectedId-list`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",  // 이전 버그 방식
      },
      body: encodedBody,
    });

    const text = await res.text();
    let decoded: string;
    try {
      decoded = decodeURIComponent(text.replace(/\+/g, " "));
    } catch {
      decoded = text;
    }

    console.log(`  HTTP Status: ${res.status}`);
    console.log(`  Response (첫 200자): ${decoded.slice(0, 200)}`);

    try {
      const parsed = JSON.parse(decoded);
      console.log(`  CODEF Code: ${parsed?.result?.code}`);
      console.log(`  CODEF Message: ${parsed?.result?.message}`);
      if (parsed?.result?.code === "CF-00000" || parsed?.result?.code === "CF-00001") {
        console.log(`  ⚠️  application/json도 작동함 (이 endpoint에서는)`);
      } else {
        console.log(`  ✅ 예상대로 실패 — Content-Type 수정이 필요했음 확인`);
      }
    } catch {
      console.log(`  ✅ JSON 파싱 실패 — Content-Type 수정이 필요했음 확인`);
    }
  } catch (err: any) {
    console.log(`  ❌ 호출 실패: ${err.message}`);
  }
}

async function main() {
  console.log("🔍 CODEF API 연결 테스트 시작");
  console.log("================================");

  // Test 1: OAuth
  const token = await testOAuth();
  if (!token) {
    console.log("\n❌ OAuth 토큰 발급 실패. 테스트 중단.");
    process.exit(1);
  }

  // Test 2: 수정된 방식 (application/x-www-form-urlencoded)
  await testApiCall(token);

  // Test 3: 이전 버그 방식 비교
  await testWrongContentType(token);

  console.log("\n================================");
  console.log("🏁 테스트 완료");
}

main().catch(console.error);
