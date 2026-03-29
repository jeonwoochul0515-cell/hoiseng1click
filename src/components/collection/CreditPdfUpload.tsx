import { useState, useRef, useCallback } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '@/firebase';
import {
  FileText,
  Upload,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Camera,
} from 'lucide-react';

/* ── 타입 ── */

interface ParsedDebt {
  creditor: string;
  type: string;
  amount: number;
  [key: string]: unknown;
}

interface CreditPdfUploadProps {
  clientId: string;
  officeId: string;
  onParsed?: (debts: ParsedDebt[]) => void;
  onSkip?: () => void;
}

type UploadStatus = 'idle' | 'uploading' | 'parsing' | 'done' | 'error';

const WORKER_BASE = import.meta.env.VITE_WORKER_BASE_URL ?? 'http://localhost:8787';

/* ── 금액 포맷 ── */

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount) + '원';
}

/* ── 컴포넌트 ── */

export default function CreditPdfUpload({
  clientId,
  officeId,
  onParsed,
  onSkip,
}: CreditPdfUploadProps) {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [parsedDebts, setParsedDebts] = useState<ParsedDebt[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── 파일 업로드 + 파싱 ── */

  const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

  const processFile = useCallback(
    async (file: File) => {
      if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(pdf|jpe?g|png|webp|heic|heif)$/i)) {
        setErrorMsg('PDF 또는 이미지 파일(JPG, PNG)만 업로드할 수 있습니다.');
        setStatus('error');
        return;
      }

      const isImage = file.type.startsWith('image/') || file.name.match(/\.(jpe?g|png|webp|heic|heif)$/i);
      const ext = isImage ? file.name.split('.').pop() ?? 'jpg' : 'pdf';

      try {
        // 1) Firebase Storage 업로드
        setStatus('uploading');
        setProgress(10);
        setErrorMsg('');

        const timestamp = Date.now();
        const storagePath = `offices/${officeId}/clients/${clientId}/credit-report/${timestamp}.${ext}`;
        const storageRef = ref(storage, storagePath);

        setProgress(20);
        await uploadBytes(storageRef, file);
        setProgress(50);

        // 다운로드 URL 확보 (필요 시)
        await getDownloadURL(storageRef);

        // 2) 파싱 API 호출
        setStatus('parsing');
        setProgress(60);

        const user = auth.currentUser;
        if (!user) throw new Error('로그인이 필요합니다.');
        const token = await user.getIdToken();

        const res = await fetch(`${WORKER_BASE}/credit-report/parse`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ storagePath, clientId, officeId, fileType: isImage ? 'image' : 'pdf' }),
        });

        setProgress(80);

        if (!res.ok) {
          const body = (await res.json().catch(() => ({ error: res.statusText }))) as {
            error?: string;
          };
          throw new Error(body.error ?? `파싱 실패 (${res.status})`);
        }

        const data = (await res.json()) as { debts: ParsedDebt[] };
        setProgress(100);
        setParsedDebts(data.debts);
        setStatus('done');
        onParsed?.(data.debts);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
        setStatus('error');
      }
    },
    [clientId, officeId, onParsed],
  );

  /* ── 이벤트 핸들러 ── */

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  /* ── 상태별 아이콘 ── */

  const StatusIndicator = () => {
    switch (status) {
      case 'uploading':
        return (
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>업로드 중... {progress}%</span>
          </div>
        );
      case 'parsing':
        return (
          <div className="flex items-center gap-2 text-sm text-amber-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>파싱 중... {progress}%</span>
          </div>
        );
      case 'done':
        return (
          <div className="flex items-center gap-2 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            <span>파싱 완료</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span>{errorMsg}</span>
          </div>
        );
      default:
        return null;
    }
  };

  /* ── 프로그레스 바 ── */

  const ProgressBar = () => {
    if (status !== 'uploading' && status !== 'parsing') return null;
    return (
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-[var(--color-brand-gold)] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    );
  };

  /* ── 렌더 ── */

  return (
    <div className="rounded-xl border border-gray-200 bg-[var(--color-bg-card)] p-6 space-y-5">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-[var(--color-brand-gold)]" />
        <h3 className="text-base font-semibold text-gray-900">
          신용조회서 업로드
          <span className="ml-2 text-xs font-normal text-gray-400">(PDF 또는 사진 / 선택사항)</span>
        </h3>
      </div>

      <p className="text-sm text-gray-600 leading-relaxed">
        크레딧포유에서 신용조회서를 다운로드하면 채권자목록을 자동으로 작성합니다.
      </p>

      {/* 단계 안내 */}
      <div className="space-y-3 text-sm text-gray-700">
        {/* Step 1 */}
        <div className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-gold)] text-xs font-bold text-[var(--color-brand-navy)]">
            1
          </span>
          <div className="space-y-1">
            <a
              href="https://www.credit4u.or.kr"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
            >
              크레딧포유 접속하기
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <p className="text-xs text-gray-500">credit4u.or.kr 에서 간편인증 로그인</p>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-gold)] text-xs font-bold text-[var(--color-brand-navy)]">
            2
          </span>
          <p>
            개인신용정보 조회 → <strong>PDF 다운로드</strong>
          </p>
        </div>

        {/* Step 3 : 드래그 앤 드롭 영역 */}
        <div className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-gold)] text-xs font-bold text-[var(--color-brand-navy)]">
            3
          </span>
          <div className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.heic"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              disabled={status === 'uploading' || status === 'parsing'}
              className={`flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-sm transition-colors
                ${
                  isDragOver
                    ? 'border-[var(--color-brand-gold)] bg-amber-50'
                    : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
                }
                ${status === 'uploading' || status === 'parsing' ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
              `}
            >
              <div className="flex items-center gap-3">
                <Upload className="h-6 w-6 text-gray-400" />
                <Camera className="h-6 w-6 text-gray-400" />
              </div>
              <span className="text-gray-500">PDF 또는 사진을 드래그하거나 클릭하여 선택</span>
              <span className="text-xs text-gray-400">카메라로 촬영도 가능합니다</span>
            </button>
          </div>
        </div>
      </div>

      {/* 상태 + 프로그레스 */}
      <StatusIndicator />
      <ProgressBar />

      {/* 파싱 결과 미리보기 */}
      {status === 'done' && parsedDebts.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-2">
          <h4 className="text-sm font-semibold text-gray-800">파싱 결과 미리보기</h4>
          <ul className="divide-y divide-gray-200 text-sm">
            {parsedDebts.slice(0, 10).map((debt, idx) => (
              <li key={idx} className="flex items-center justify-between py-2">
                <span className="text-gray-700">
                  {debt.creditor}
                  {debt.type ? ` ${debt.type}` : ''}
                </span>
                <span className="font-medium text-gray-900 tabular-nums">
                  {formatAmount(debt.amount)}
                </span>
              </li>
            ))}
          </ul>
          {parsedDebts.length > 10 && (
            <p className="text-xs text-gray-500">...외 {parsedDebts.length - 10}건</p>
          )}
          <p className="text-xs text-gray-500">총 {parsedDebts.length}건</p>
        </div>
      )}

      {/* 하단 버튼 */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onSkip}
          className="rounded-lg px-6 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors"
        >
          건너뛰기
        </button>

        {status === 'done' && (
          <button
            type="button"
            onClick={() => onParsed?.(parsedDebts)}
            className="rounded-lg bg-[var(--color-brand-gold)] px-8 py-2.5 text-sm font-semibold text-[var(--color-brand-navy)] hover:brightness-110 transition-colors"
          >
            다음 단계 →
          </button>
        )}
      </div>
    </div>
  );
}
