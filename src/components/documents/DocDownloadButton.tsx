import { useState } from 'react';
import { Download, Lock, Loader2 } from 'lucide-react';
import type { Client } from '@/types/client';
import type { DocType } from '@/types/document';
import { workerApi } from '@/api/worker';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { toast } from '@/utils/toast';

interface DocDownloadButtonProps {
  client: Client;
  docType: DocType | 'all';
  format: 'docx' | 'hwpx';
  label: string;
  disabled?: boolean;
}

export default function DocDownloadButton({
  client,
  docType,
  format,
  label,
  disabled = false,
}: DocDownloadButtonProps) {
  const [loading, setLoading] = useState(false);
  const office = useAuthStore((s) => s.office);
  const user = useAuthStore((s) => s.user);

  // HWPX 락 해제 — 모든 사용자 허용 (결제 시스템 연동 후 재도입 검토)
  const isLocked = false;

  const handleClick = async () => {
    if (loading) return;
    // B2C(개인) 도 다운로드 가능하도록 officeId 없으면 user.uid 로 fallback
    const officeId = office?.id ?? user?.uid ?? '';
    if (!officeId) {
      toast.error('로그인 정보를 불러올 수 없습니다. 다시 로그인해주세요.');
      return;
    }

    try {
      setLoading(true);
      const result = await workerApi.generateDoc({
        clientId: client.id,
        officeId,
        docType: String(docType),
        format,
        clientData: client,
      });
      window.open(result.downloadUrl, '_blank');
      useUiStore.getState().showGoldBurst();
    } catch (err) {
      console.error('문서 생성 실패:', err);
      toast.error('문서 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
        isLocked
          ? 'border border-gray-300 bg-gray-100 text-gray-500 hover:bg-gray-100'
          : disabled
            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
            : 'bg-brand-gold text-black hover:bg-[#b8973e]'
      }`}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : isLocked ? (
        <Lock size={16} />
      ) : (
        <Download size={16} />
      )}
      {label}
    </button>
  );
}
