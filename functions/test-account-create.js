/**
 * CODEF account/create 직접 테스트 (공동인증서 방식)
 * 실행: node test-account-create.js
 *
 * 목적: 서버를 거치지 않고 CODEF API에 직접 account/create를 호출하여
 * 어떤 에러 코드와 메시지가 반환되는지 확인
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
  const encrypted = crypto.publicEncrypt(
    { key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(plainText, 'utf-8'),
  );
  return encrypted.toString('base64');
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

async function callCodef(token, endpoint, body) {
  const jsonBody = JSON.stringify(body);
  const encodedBody = encodeURIComponent(jsonBody);

  console.log(`\n[요청] ${endpoint}`);
  console.log(`  Body 길이: ${jsonBody.length}`);
  // accountList의 구조만 출력 (민감 데이터 제외)
  if (body.accountList) {
    body.accountList.forEach((a, i) => {
      console.log(`  account[${i}]: org=${a.organization}, biz=${a.businessType}, login=${a.loginType}`);
      console.log(`    derFile: ${a.derFile ? a.derFile.length + 'chars' : 'N/A'}`);
      console.log(`    keyFile: ${a.keyFile ? a.keyFile.length + 'chars' : 'N/A'}`);
      console.log(`    password: ${a.password ? a.password.length + 'chars (RSA)' : 'N/A'}`);
      console.log(`    id: ${a.id ?? 'N/A'}`);
    });
  }

  const res = await fetch(`${CODEF_BASE}${endpoint}`, {
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
  return parsed;
}

async function main() {
  console.log("=== CODEF account/create 직접 테스트 ===\n");

  const token = await getToken();
  console.log("✅ 토큰 발급 완료\n");

  // 테스트 1: 빈 accountList
  console.log("--- TEST 1: 빈 accountList ---");
  try {
    const r1 = await callCodef(token, "/v1/account/create", { accountList: [] });
    console.log(`  code: ${r1?.result?.code}`);
    console.log(`  msg:  ${r1?.result?.message}`);
  } catch (e) {
    console.log(`  에러: ${e.message}`);
  }

  // 테스트 2: 더미 공동인증서 (loginType 0, 실패 예상)
  console.log("\n--- TEST 2: 더미 인증서 (국민은행, loginType 0) ---");
  try {
    const dummyPassword = encryptRSA("test1234");
    const r2 = await callCodef(token, "/v1/account/create", {
      accountList: [{
        countryCode: "KR",
        businessType: "BK",
        clientType: "P",
        organization: "0004",
        loginType: "0",
        password: dummyPassword,
        derFile: "dummyDerFileBase64",
        keyFile: "dummyKeyFileBase64",
      }]
    });
    console.log(`  code: ${r2?.result?.code}`);
    console.log(`  msg:  ${r2?.result?.message}`);
    console.log(`  data: ${JSON.stringify(r2?.data ?? {}).slice(0, 500)}`);
  } catch (e) {
    console.log(`  에러: ${e.message}`);
  }

  // 테스트 3: 간편인증 방식 (loginType 5, 2-way 예상)
  console.log("\n--- TEST 3: 간편인증 방식 (국민은행, loginType 5) ---");
  try {
    const r3 = await callCodef(token, "/v1/account/create", {
      accountList: [{
        countryCode: "KR",
        businessType: "BK",
        clientType: "P",
        organization: "0004",
        loginType: "5",
        loginTypeLevel: "1",  // 카카오톡
        userName: "테스트",
        phoneNo: "01012345678",
        identity: "19900101",
        password: encryptRSA(""),
      }]
    });
    console.log(`  code: ${r3?.result?.code}`);
    console.log(`  msg:  ${r3?.result?.message}`);
    console.log(`  data: ${JSON.stringify(r3?.data ?? {}).slice(0, 500)}`);
  } catch (e) {
    console.log(`  에러: ${e.message}`);
  }

  // 테스트 4: password를 RSA 암호화하지 않은 경우
  console.log("\n--- TEST 4: password 평문 (암호화 안 한 경우) ---");
  try {
    const r4 = await callCodef(token, "/v1/account/create", {
      accountList: [{
        countryCode: "KR",
        businessType: "BK",
        clientType: "P",
        organization: "0004",
        loginType: "0",
        password: "test1234",
        derFile: "dummyDerFileBase64",
        keyFile: "dummyKeyFileBase64",
      }]
    });
    console.log(`  code: ${r4?.result?.code}`);
    console.log(`  msg:  ${r4?.result?.message}`);
  } catch (e) {
    console.log(`  에러: ${e.message}`);
  }

  console.log("\n=== 테스트 완료 ===");
}

main().catch(console.error);
