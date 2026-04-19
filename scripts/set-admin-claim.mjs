// 관리자 권한 Custom Claim 설정 스크립트
// 실행 전 firebase.json이 있는 디렉터리에서 GOOGLE_APPLICATION_CREDENTIALS 환경변수 설정 필요
// 또는 gcloud auth application-default login 으로 사용자 인증
//
// 사용법:
//   node scripts/set-admin-claim.mjs <UID>
//   예: node scripts/set-admin-claim.mjs abcd1234xyz
//
// 또는 이메일로 조회:
//   node scripts/set-admin-claim.mjs --email jeonwoochul0515@gmail.com

import admin from "firebase-admin";

admin.initializeApp({ projectId: "hoiseng1click" });

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("사용법: node scripts/set-admin-claim.mjs <UID | --email user@example.com>");
    process.exit(1);
  }

  let uid;
  if (args[0] === "--email" && args[1]) {
    const user = await admin.auth().getUserByEmail(args[1]);
    uid = user.uid;
    console.log(`✓ ${args[1]} → UID: ${uid}`);
  } else {
    uid = args[0];
  }

  await admin.auth().setCustomUserClaims(uid, { admin: true });
  const user = await admin.auth().getUser(uid);
  console.log(`✅ admin claim 설정 완료: ${user.email ?? uid}`);
  console.log(`   현재 claims: ${JSON.stringify(user.customClaims)}`);
  console.log(`   ⚠️ 로그아웃 후 재로그인해야 새 토큰에 반영됩니다.`);
}

main().catch((err) => {
  console.error("❌ 오류:", err.message);
  process.exit(1);
});
