import { ExternalLink, CheckCircle2, Star } from 'lucide-react';

interface ExternalLinkButtonProps {
  url: string;
  label: string;
  certName: string;
  path: string;
  icon?: React.ReactNode;
  status?: 'todo' | 'uploaded' | 'verified';
  onUploaded?: () => void;
}

export default function ExternalLinkButton({
  url,
  label,
  certName,
  path,
  icon,
  status = 'todo',
  onUploaded,
}: ExternalLinkButtonProps) {
  const handleClick = () => {
    window.open(url, '_blank');
    if (status === 'todo' && onUploaded) {
      onUploaded();
    }
  };

  const statusConfig = {
    todo: {
      bg: 'bg-gray-100 hover:bg-gray-200 border-gray-300',
      text: 'text-gray-700',
      label: '발급하기',
      icon: null,
    },
    uploaded: {
      bg: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300',
      text: 'text-emerald-700',
      label: '업로드 완료',
      icon: <CheckCircle2 size={16} className="text-emerald-500" />,
    },
    verified: {
      bg: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300',
      text: 'text-emerald-700',
      label: '검증 완료',
      icon: <Star size={16} className="fill-emerald-500 text-emerald-500" />,
    },
  };

  const config = statusConfig[status];

  return (
    <div className="w-full">
      <button
        onClick={handleClick}
        className={`flex w-full items-center gap-3 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${config.bg} ${config.text}`}
      >
        {/* 좌측: 아이콘 + 라벨 + 서류명 */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {icon && <span className="flex-shrink-0">{icon}</span>}
          {config.icon && <span className="flex-shrink-0">{config.icon}</span>}
          <span className="truncate">{label}</span>
          <span className="text-xs text-gray-400 truncate">— {certName}</span>
        </div>

        {/* 우측: 상태 라벨 + 외부링크 아이콘 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs">{config.label}</span>
          <ExternalLink size={14} className="text-gray-400" />
        </div>
      </button>

      {/* 메뉴 경로 안내 */}
      <p className="mt-1 px-1 text-xs text-gray-400">{path}</p>
    </div>
  );
}
