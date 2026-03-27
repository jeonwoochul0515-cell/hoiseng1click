/**
 * Content-Type 비교 테스트: application/json vs application/x-www-form-urlencoded
 * CODEF 공식 SDK 분석 결과: application/json이 올바른 Content-Type
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
const CODEF_PUBLIC_KEY = process.env.CODEF_PUBLIC_KEY;

function encryptRSA(plainText) {
  const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${CODEF_PUBLIC_KEY}\n-----END PUBLIC KEY-----`;
  return crypto.publicEncrypt(
    { key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(plainText, 'utf-8'),
  ).toString('base64');
}

async function getToken() {
  const creds = Buffer.from(
    `${process.env.CODEF_CLIENT_ID}:${process.env.CODEF_CLIENT_SECRET}`
  ).toString("base64");
  const res = await fetch(OAUTH_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${creds}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=read",
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("토큰 발급 실패");
  return data.access_token;
}

async function testWithContentType(token, contentType, label) {
  console.log(`\n=== ${label} ===`);
  console.log(`  Content-Type: ${contentType}`);

  const body = {
    accountList: [{
      countryCode: "KR",
      businessType: "BK",
      clientType: "P",
      organization: "0004",
      loginType: "1",
      id: "testuser",
      password: encryptRSA("testpass123"),
    }]
  };

  const jsonBody = JSON.stringify(body);
  const encodedBody = encodeURIComponent(jsonBody);

  console.log(`  Body (JSON 원본 길이): ${jsonBody.length}`);
  console.log(`  Body (인코딩 후 길이): ${encodedBody.length}`);

  try {
    const res = await fetch(`${CODEF_BASE}/v1/account/create`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType,
      },
      body: encodedBody,
    });

    const text = await res.text();
    let decoded;
    try { decoded = decodeURIComponent(text.replace(/\+/g, " ")); } catch { decoded = text; }

    console.log(`  HTTP Status: ${res.status}`);
    try {
      const parsed = JSON.parse(decoded);
      const code = parsed?.result?.code;
      const msg = parsed?.result?.message;
      console.log(`  CODEF Code: ${code}`);
      console.log(`  CODEF Message: ${msg}`);

      // errorList 상세
      const errorList = parsed?.data?.errorList ?? [];
      if (errorList.length > 0) {
        errorList.forEach((e, i) => {
          console.log(`  errorList[${i}]: code=${e.code}, org=${e.organization}, msg=${e.message}`);
        });
      }
      const successList = parsed?.data?.successList ?? [];
      if (successList.length > 0) {
        console.log(`  successList: ${successList.length}개 성공`);
      }
      const connectedId = parsed?.data?.connectedId;
      if (connectedId) {
        console.log(`  ✅ connectedId: ${connectedId}`);
      }
      return code;
    } catch {
      console.log(`  응답 파싱 실패: ${decoded.slice(0, 200)}`);
      return null;
    }
  } catch (err) {
    console.log(`  ❌ 에러: ${err.message}`);
    return null;
  }
}

async function testConnectedIdList(token, contentType, label) {
  console.log(`\n=== ${label}: connectedId-list ===`);

  const body = { pageNo: 0 };
  const jsonBody = JSON.stringify(body);
  const encodedBody = encodeURIComponent(jsonBody);

  try {
    const res = await fetch(`${CODEF_BASE}/v1/account/connectedId-list`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType,
      },
      body: encodedBody,
    });

    const text = await res.text();
    let decoded;
    try { decoded = decodeURIComponent(text.replace(/\+/g, " ")); } catch { decoded = text; }

    const parsed = JSON.parse(decoded);
    console.log(`  HTTP Status: ${res.status}`);
    console.log(`  CODEF Code: ${parsed?.result?.code}`);
    console.log(`  CODEF Message: ${parsed?.result?.message}`);
    return parsed?.result?.code;
  } catch (err) {
    console.log(`  ❌ 에러: ${err.message}`);
    return null;
  }
}

async function main() {
  console.log("🔍 CODEF Content-Type 비교 테스트");
  console.log("==========================================");

  const token = await getToken();
  console.log("✅ 토큰 발급 완료");

  // Test 1: application/json (SDK 방식)
  const r1 = await testWithContentType(token, "application/json", "TEST 1: application/json (SDK 정규 방식)");

  // Test 2: application/x-www-form-urlencoded (이전 버그 방식)
  const r2 = await testWithContentType(token, "application/x-www-form-urlencoded", "TEST 2: application/x-www-form-urlencoded (이전 방식)");

  // Test 3: connectedId-list도 비교
  await testConnectedIdList(token, "application/json", "TEST 3a: JSON");
  await testConnectedIdList(token, "application/x-www-form-urlencoded", "TEST 3b: form-urlencoded");

  console.log("\n==========================================");
  console.log("📊 비교 결과:");
  console.log(`  application/json:                  ${r1}`);
  console.log(`  application/x-www-form-urlencoded:  ${r2}`);
  if (r1 === r2) {
    console.log("  → 이 endpoint에서는 동일한 결과 (Content-Type 무관)");
  } else {
    console.log("  → ⚠️ Content-Type에 따라 결과가 다름!");
  }
  console.log("\n🏁 테스트 완료");
}

main().catch(console.error);
