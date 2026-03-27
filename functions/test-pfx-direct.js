/**
 * PFX 파일을 CODEF에 직접 전달하는 테스트
 * CODEF SDK README: "pfx파일도 지원합니다" → pfxFile 필드로 직접 전달
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
  });
}

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
  const res = await fetch("https://oauth.codef.io/oauth/token", {
    method: "POST",
    headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=read",
  });
  return (await res.json()).access_token;
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

  // PFX가 있으면 읽기, 없으면 DER+KEY에서 PFX 생성
  let pfxBase64;
  const pfxPath = path.join(certDir, 'cert.pfx');
  if (fs.existsSync(pfxPath)) {
    pfxBase64 = fs.readFileSync(pfxPath).toString('base64');
    console.log("PFX 파일 로드:", pfxBase64.length, "chars");
  } else {
    console.log("PFX 파일 없음 — 원본 DER+KEY만 테스트");
  }

  const token = await getToken();
  const certPassword = process.argv[2] || "test1234";
  console.log(`비밀번호: ${certPassword.slice(0, 2)}${'*'.repeat(certPassword.length - 2)}`);

  const encPw = encryptRSA(certPassword);

  // TEST 1: 원본 DER + KEY (반드시 성공해야 함)
  console.log("\n=== TEST 1: 원본 signCert.der + signPri.key ===");
  const r1 = await callCodef(token, "/v1/account/create", {
    accountList: [{
      countryCode: "KR", businessType: "BK", clientType: "P",
      organization: "0004", loginType: "0", certType: "1",
      derFile: origDer,
      keyFile: origKey,
      password: encPw,
    }]
  });
  console.log(`  code: ${r1?.result?.code}`);
  console.log(`  msg: ${r1?.result?.message}`);
  const e1 = r1?.data?.errorList?.[0];
  if (e1) console.log(`  error: ${e1.code} — ${e1.message} ${e1.extraMessage || ''}`);
  if (r1?.data?.connectedId) console.log(`  ✅ connectedId: ${r1.data.connectedId}`);

  // TEST 2: pfxFile 직접 전달 (CODEF가 서버에서 분리)
  if (pfxBase64) {
    console.log("\n=== TEST 2: pfxFile 직접 전달 ===");
    const r2 = await callCodef(token, "/v1/account/create", {
      accountList: [{
        countryCode: "KR", businessType: "BK", clientType: "P",
        organization: "0004", loginType: "0", certType: "1",
        pfxFile: pfxBase64,
        password: encPw,
      }]
    });
    console.log(`  code: ${r2?.result?.code}`);
    console.log(`  msg: ${r2?.result?.message}`);
    const e2 = r2?.data?.errorList?.[0];
    if (e2) console.log(`  error: ${e2.code} — ${e2.message} ${e2.extraMessage || ''}`);
    if (r2?.data?.connectedId) console.log(`  ✅ connectedId: ${r2.data.connectedId}`);
  }

  // TEST 3: pfxFile + pfxPassword (별도 필드 시도)
  if (pfxBase64) {
    console.log("\n=== TEST 3: pfxFile + pfxPassword ===");
    const r3 = await callCodef(token, "/v1/account/create", {
      accountList: [{
        countryCode: "KR", businessType: "BK", clientType: "P",
        organization: "0004", loginType: "0", certType: "1",
        pfxFile: pfxBase64,
        pfxPassword: encPw,
        password: encPw,
      }]
    });
    console.log(`  code: ${r3?.result?.code}`);
    console.log(`  msg: ${r3?.result?.message}`);
    const e3 = r3?.data?.errorList?.[0];
    if (e3) console.log(`  error: ${e3.code} — ${e3.message} ${e3.extraMessage || ''}`);
    if (r3?.data?.connectedId) console.log(`  ✅ connectedId: ${r3.data.connectedId}`);
  }

  console.log("\n=== 완료 ===");
}

main().catch(console.error);
