// 사무소별 "내 채권자" 자동 백업
// 매주 일요일 새벽 3시(KST) 실행
// - 각 사무소의 myCreditors 컬렉션을 CSV로 변환
// - Cloud Storage: gs://{bucket}/backups/myCreditors/{officeId}/{YYYY-MM-DD}.csv
// - 4주치 롤링 보관 (이전 백업 자동 삭제)
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

const RETENTION_WEEKS = 4;
const BACKUP_PREFIX = 'backups/myCreditors';

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[,"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const backupMyCreditorsWeekly = onSchedule(
  {
    schedule: '0 3 * * 0', // 매주 일요일 03:00
    timeZone: 'Asia/Seoul',
    region: 'asia-northeast3',
    retryCount: 2,
  },
  async () => {
    const db = admin.firestore();
    const bucket = admin.storage().bucket();
    const today = formatDate(new Date());
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_WEEKS * 7);

    let totalOffices = 0;
    let totalCreditors = 0;
    let deletedOld = 0;

    // 모든 사무소 순회
    const officesSnap = await db.collection('offices').get();
    logger.info(`[backup] 시작: ${officesSnap.size}개 사무소`);

    for (const officeDoc of officesSnap.docs) {
      const officeId = officeDoc.id;
      try {
        const myCreditorsSnap = await db
          .collection('offices')
          .doc(officeId)
          .collection('myCreditors')
          .get();

        if (myCreditorsSnap.empty) continue;

        const header = [
          '이름', '인격구분', '우편번호', '주소', '상세주소',
          '전화', '휴대전화', '팩스', '이메일', '사용횟수', '최근사용일',
        ];
        const rows = myCreditorsSnap.docs.map((d) => {
          const data = d.data();
          return [
            data.name ?? '',
            data.personalityType ?? '',
            data.zipCode ?? '',
            data.address ?? '',
            data.addressDetail ?? '',
            data.phone ?? '',
            data.mobile ?? '',
            data.fax ?? '',
            data.email ?? '',
            data.useCount ?? 0,
            data.lastUsedAt?.toDate?.()?.toISOString?.().slice(0, 10) ?? '',
          ];
        });

        const csv = [header, ...rows]
          .map((r) => r.map(csvEscape).join(','))
          .join('\r\n');
        // BOM 추가 (Excel 한글)
        const content = '\uFEFF' + csv;

        const filePath = `${BACKUP_PREFIX}/${officeId}/${today}.csv`;
        await bucket.file(filePath).save(Buffer.from(content, 'utf8'), {
          contentType: 'text/csv; charset=utf-8',
          metadata: {
            metadata: {
              officeId,
              backupDate: today,
              creditorCount: String(rows.length),
            },
          },
        });

        totalOffices++;
        totalCreditors += rows.length;

        // 4주 이상 된 백업 삭제
        const [files] = await bucket.getFiles({
          prefix: `${BACKUP_PREFIX}/${officeId}/`,
        });
        for (const f of files) {
          const fileName = f.name.split('/').pop() ?? '';
          const match = fileName.match(/^(\d{4}-\d{2}-\d{2})\.csv$/);
          if (!match) continue;
          const fileDate = new Date(match[1]);
          if (fileDate < cutoff) {
            await f.delete();
            deletedOld++;
          }
        }
      } catch (err: any) {
        logger.error(`[backup] office ${officeId} 실패:`, err?.message ?? err);
      }
    }

    logger.info(
      `[backup] 완료: ${totalOffices}개 사무소 · ${totalCreditors}건 채권자 · ${deletedOld}개 만료 백업 삭제`,
    );
  },
);
