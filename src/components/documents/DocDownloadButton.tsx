import { useState } from 'react';
import { Download, Lock, Loader2 } from 'lucide-react';
import type { Client } from '@/types/client';
import type { DocType } from '@/types/document';
import { workerApi } from '@/api/worker';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';

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
  const hasPro = useAuthStore((s) => s.hasPro);
  const office = useAuthStore((s) => s.office);
  const openUpgradeModal = useUiStore((s) => s.openUpgradeModal);

  const isLocked = format === 'hwpx' && !hasPro();

  const handleClick = async () => {
    if (isLocked) {
      openUpgradeModal();
      return;
    }

    try {
      setLoading(true);
      const result = await workerApi.generateDoc({
        clientId: client.id,
        officeId: office?.id ?? '',
        docType: String(docType),
        format,
        clientData: client,
      });
      window.open(result.downloadUrl, '_blank');
    } catch (err) {
      console.error('문서 생성 실패:', err);
      alert('문서 생성에 실패했습니다. 다시 시도해주세요.');
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
            : 'bg-[#C9A84C] text-black hover:bg-[#b8973e]'
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
