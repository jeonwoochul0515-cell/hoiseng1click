// 공유 채권자 디렉토리 시드 업로드 스크립트
//
// 사용법 (admin custom claim 설정된 계정 필요):
//   cd functions
//   node ../scripts/seed-shared-creditors.mjs
//
// 또는 로컬 Firebase 에뮬레이터:
//   FIRESTORE_EMULATOR_HOST=localhost:8080 node scripts/seed-shared-creditors.mjs

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

admin.initializeApp({ projectId: 'hoiseng1click' });

async function main() {
  const jsonPath = path.join(__dirname, '..', 'samples', '공유디렉토리_시드데이터.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('❌ 시드 파일을 찾을 수 없습니다:', jsonPath);
    process.exit(1);
  }

  const seed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`📦 ${seed.documents.length}개 문서 업로드 시작...`);

  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  let success = 0;
  let failed = 0;

  for (const d of seed.documents) {
    try {
      await db
        .collection('sharedCreditors')
        .doc(d.id)
        .set(
          {
            ...d.data,
            createdAt: now,
            updatedAt: now,
          },
          { merge: true },
        );
      console.log(`  ✓ ${d.data.name}`);
      success++;
    } catch (err) {
      console.error(`  ✗ ${d.data.name}:`, err.message);
      failed++;
    }
  }

  console.log(`\n✅ 완료: ${success}건 성공 / ${failed}건 실패`);
}

main().catch((err) => {
  console.error('❌ 오류:', err);
  process.exit(1);
});
