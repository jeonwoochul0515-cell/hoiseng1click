/**
 * 실제 공동인증서로 CODEF account/create 테스트
 * 원본 signCert.der + signPri.key 파일 사용
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// .env
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
  const pem = `-----BEGIN PUBLIC KEY-----\n${CODEF_PUBLIC_KEY}\n-----END PUBLIC KEY-----`;
  return crypto.publicEncrypt(
    { key: pem, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(plainText, 'utf-8'),
  ).toString('base64');
}

async function getToken() {
  const creds = Buffer.from(`${process.env.CODEF_CLIENT_ID}:${process.env.CODEF_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(OAUTH_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=read",
  });
  const data = await res.json();
  return data.access_token;
}

async function callCodef(token, endpoint, body) {
  const encodedBody = encodeURIComponent(JSON.stringify(body));
  const res = await fetch(`${CODEF_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: encodedBody,
  });
  const text = await res.text();
  let decoded;
  try { decoded = decodeURIComponent(text.replace(/\+/g, " ")); } catch { decoded = text; }
  return JSON.parse(decoded);
}

async function main() {
  const certDir = 'C:/Users/jeonw/AppData/LocalLow/NPKI/KICA/USER/cn=마을부엌정지협동조합()001105720230816511001574,ou=NACF,ou=licensedCA,o=KICA,c=KR';

  // 원본 파일 읽기
  const origDer = fs.readFileSync(path.join(certDir, 'signCert.der')).toString('base64');
  const origKey = fs.readFileSync(path.join(certDir, 'signPri.key')).toString('base64');

  console.log("=== 원본 DER+KEY로 CODEF 테스트 ===");
  console.log(`  derFile: ${origDer.length}chars`);
  console.log(`  keyFile: ${origKey.length}chars`);

  const token = await getToken();
  console.log("  토큰 발급 완료");

  // 비밀번호 입력 — 테스트용 (실제 비밀번호 필요)
  const certPassword = process.argv[2] || "test1234";
  console.log(`  비밀번호: ${certPassword.slice(0,2)}${'*'.repeat(certPassword.length-2)}`);

  const encPw = encryptRSA(certPassword);

  // TEST 1: 국민은행 (0004) — 원본 DER+KEY
  console.log("\n--- TEST 1: 국민은행 원본 DER+KEY ---");
  const r1 = await callCodef(token, "/v1/account/create", {
    accountList: [{
      countryCode: "KR",
      businessType: "BK",
      clientType: "P",
      organization: "0004",
      loginType: "0",
      certType: "1",
      derFile: origDer,
      keyFile: origKey,
      password: encPw,
    }]
  });
  console.log(`  code: ${r1?.result?.code}`);
  console.log(`  msg: ${r1?.result?.message}`);
  const err = r1?.data?.errorList?.[0];
  if (err) console.log(`  detail: ${err.code} — ${err.message}`);
  const succ = r1?.data?.successList?.[0];
  if (succ) console.log(`  success: ${succ.code} — ${succ.message}`);
  if (r1?.data?.connectedId) console.log(`  ✅ connectedId: ${r1.data.connectedId}`);

  console.log("\n=== 완료 ===");
}

main().catch(console.error);
