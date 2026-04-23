/**
 * 로컬 templates/hwpx/*.hwpx → Firebase Storage templates/hwpx/ 업로드.
 *
 * 실행:
 *   cd functions
 *   node scripts/upload-hwpx-templates.cjs
 *
 * 인증: gcloud application-default login 또는 service-account.json
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.join(__dirname, "..", "..");
const LOCAL_HWPX_DIR = path.join(PROJECT_ROOT, "templates", "hwpx");
const STORAGE_BUCKET = "hoiseng1click.firebasestorage.app";

// Firebase Admin 초기화 (service-account.json 있으면 사용, 없으면 ADC)
const serviceAccountPath = path.join(__dirname, "..", "service-account.json");
let credential;
if (fs.existsSync(serviceAccountPath)) {
  const sa = require(serviceAccountPath);
  credential = admin.credential.cert(sa);
  console.log("✓ service-account.json 사용");
} else {
  credential = admin.credential.applicationDefault();
  console.log("✓ Application Default Credentials 사용");
}

admin.initializeApp({ credential, storageBucket: STORAGE_BUCKET });
const bucket = admin.storage().bucket();

async function main() {
  const files = fs.readdirSync(LOCAL_HWPX_DIR).filter((f) => f.endsWith(".hwpx"));
  console.log(`로컬 HWPX 파일 ${files.length}개 발견:`, files);

  for (const fileName of files) {
    const localPath = path.join(LOCAL_HWPX_DIR, fileName);
    const remotePath = `templates/hwpx/${fileName}`;
    const size = fs.statSync(localPath).size;
    process.stdout.write(`업로드 중: ${fileName} (${size} bytes)... `);
    await bucket.upload(localPath, {
      destination: remotePath,
      metadata: { contentType: "application/hwp+zip" },
    });
    console.log("✓");
  }
  console.log(`\n${files.length}개 업로드 완료 → gs://${STORAGE_BUCKET}/templates/hwpx/`);
}

main().catch((err) => {
  console.error("❌ 업로드 실패:", err.message);
  console.error(err.stack);
  process.exit(1);
});
