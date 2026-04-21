import { useEffect, useState } from 'react';

export type SourceStatus = 'pending' | 'loading' | 'success' | 'error';

export interface SourceItem {
  id: string;
  label: string;    // "홈택스 · 소득금액증명원"
  icon?: string;    // 이모지 또는 아이콘 문자
  status: SourceStatus;
}

interface SourceBadgeProps {
  item: SourceItem;
  delayMs?: number;
}

const STATUS_STYLES: Record<SourceStatus, { bg: string; ring: string; dot: string; label: string }> = {
  pending: {
    bg: 'bg-white/60 backdrop-blur',
    ring: 'ring-1 ring-gray-200',
    dot: 'bg-gray-300',
    label: 'text-gray-500',
  },
  loading: {
    bg: 'bg-amber-50',
    ring: 'ring-1 ring-amber-300',
    dot: 'bg-amber-400 animate-pulse',
    label: 'text-amber-800',
  },
  success: {
    bg: 'bg-emerald-50',
    ring: 'ring-1 ring-emerald-300',
    dot: 'bg-emerald-500',
    label: 'text-emerald-800',
  },
  error: {
    bg: 'bg-red-50',
    ring: 'ring-1 ring-red-300',
    dot: 'bg-red-500',
    label: 'text-red-800',
  },
};

/**
 * 문서 위에 떠있는 출처 칩.
 * - API 상태에 따라 색상 변화
 * - 등장 시 살짝 아래에서 올라오는 fade-in
 */
export default function SourceBadge({ item, delayMs = 0 }: SourceBadgeProps) {
  const [visible, setVisible] = useState(false);
  const s = STATUS_STYLES[item.status];

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);

  return (
    <span
      className={[
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium',
        'shadow-sm transition-all duration-500 ease-out',
        s.bg,
        s.ring,
        s.label,
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
      ].join(' ')}
    >
      {item.icon && <span className="text-sm leading-none">{item.icon}</span>}
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${s.dot}`} />
      <span>{item.label}</span>
      {item.status === 'success' && <span className="text-[10px] opacity-70">✓</span>}
      {item.status === 'error' && <span className="text-[10px] opacity-70">!</span>}
    </span>
  );
}
