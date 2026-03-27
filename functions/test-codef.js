/**
 * CODEF API 연결 테스트 (순수 Node.js — 의존성 없음)
 * 실행: node test-codef.js
 */
const fs = require('fs');
const path = require('path');

// .env 파일 수동 파싱
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
  });
}

const OAUTH_URL = "https://oauth.codef.io/oauth/token";
const CODEF_BASE = process.env.CODEF_API_HOST || "https://development.codef.io";

async function testOAuth() {
  console.log("\n=== TEST 1: CODEF OAuth 토큰 발급 ===");
  console.log(`  Client ID: ${(process.env.CODEF_CLIENT_ID || '').slice(0, 8)}...`);
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
      console.log(`  ❌ 토큰 발급 실패: ${res.status}`, JSON.stringify(data));
      return null;
    }
  } catch (err) {
    console.log(`  ❌ 네트워크 오류: ${err.message}`);
    return null;
  }
}

async function testFixedMethod(token) {
  console.log("\n=== TEST 2: 수정된 방식 (application/x-www-form-urlencoded) ===");

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
    let decoded;
    try { decoded = decodeURIComponent(text.replace(/\+/g, " ")); } catch { decoded = text; }

    const parsed = JSON.parse(decoded);
    const code = parsed?.result?.code;
    const message = parsed?.result?.message;

    console.log(`  HTTP Status: ${res.status}`);
    console.log(`  CODEF Code: ${code}`);
    console.log(`  CODEF Message: ${message}`);

    if (code === "CF-00000" || code === "CF-00001") {
      console.log(`  ✅ API 호출 성공!`);
    } else {
      console.log(`  ⚠️  예상 외 응답`);
    }
    return code;
  } catch (err) {
    console.log(`  ❌ 호출 실패: ${err.message}`);
    return null;
  }
}

async function testOldBugMethod(token) {
  console.log("\n=== TEST 3: 이전 버그 방식 비교 (application/json + encoded body) ===");

  const body = { pageNo: 0 };
  const encodedBody = encodeURIComponent(JSON.stringify(body));

  try {
    const res = await fetch(`${CODEF_BASE}/v1/account/connectedId-list`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: encodedBody,
    });

    const text = await res.text();
    let decoded;
    try { decoded = decodeURIComponent(text.replace(/\+/g, " ")); } catch { decoded = text; }

    console.log(`  HTTP Status: ${res.status}`);
    console.log(`  Response (첫 300자): ${decoded.slice(0, 300)}`);

    try {
      const parsed = JSON.parse(decoded);
      const code = parsed?.result?.code;
      console.log(`  CODEF Code: ${code}`);
      console.log(`  CODEF Message: ${parsed?.result?.message}`);
      if (code === "CF-00000" || code === "CF-00001") {
        console.log(`  ℹ️  이 endpoint에서는 application/json도 작동함`);
      } else {
        console.log(`  ✅ 예상대로 실패 — Content-Type 수정이 필요했음`);
      }
      return code;
    } catch {
      console.log(`  ✅ JSON 파싱 실패 — Content-Type 수정이 필요했음`);
      return null;
    }
  } catch (err) {
    console.log(`  ❌ 호출 실패: ${err.message}`);
    return null;
  }
}

async function testResponseParsing(token) {
  console.log("\n=== TEST 4: 응답 파싱 순서 테스트 ===");

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

    const rawText = await res.text();
    console.log(`  Raw response 길이: ${rawText.length}`);
    console.log(`  Raw 시작 50자: ${rawText.slice(0, 50)}`);

    // URL 인코딩 여부 확인
    const hasUrlEncoding = rawText.includes('%') || rawText.includes('+');
    console.log(`  URL 인코딩 포함: ${hasUrlEncoding}`);

    // 방법 A: JSON.parse 먼저 (이전 버그 방식)
    let methodA = null;
    try {
      methodA = JSON.parse(rawText);
      console.log(`  방법A (JSON먼저): 성공 — code=${methodA?.result?.code}`);
    } catch {
      console.log(`  방법A (JSON먼저): 실패 — URL 디코딩 필요`);
    }

    // 방법 B: URL 디코딩 먼저 (수정된 방식)
    let methodB = null;
    try {
      const decoded = decodeURIComponent(rawText.replace(/\+/g, " "));
      methodB = JSON.parse(decoded);
      console.log(`  방법B (URL디코딩먼저): 성공 — code=${methodB?.result?.code}`);
    } catch {
      console.log(`  방법B (URL디코딩먼저): 실패`);
    }

    if (methodA && methodB) {
      const same = JSON.stringify(methodA) === JSON.stringify(methodB);
      console.log(`  두 결과 동일: ${same}`);
      if (!same) {
        console.log(`  ⚠️  파싱 순서에 따라 결과가 다름! URL 디코딩 우선이 정확함`);
      }
    }
  } catch (err) {
    console.log(`  ❌ 호출 실패: ${err.message}`);
  }
}

async function main() {
  console.log("🔍 CODEF API 연결 테스트 시작");
  console.log("================================");

  const token = await testOAuth();
  if (!token) {
    console.log("\n❌ OAuth 토큰 발급 실패. 테스트 중단.");
    process.exit(1);
  }

  await testFixedMethod(token);
  await testOldBugMethod(token);
  await testResponseParsing(token);

  console.log("\n================================");
  console.log("🏁 테스트 완료");
}

main().catch(console.error);
