import type { ClientStatus } from '@/types/client';

export const STATUS_LABELS: Record<ClientStatus, string> = {
  new: '신규',
  contacted: '상담완료',
  collecting: '수집중',
  drafting: '작성중',
  submitted: '제출완료',
  approved: '인가완료',
};

export const STATUS_COLORS: Record<ClientStatus, { bg: string; text: string; dot: string }> = {
  new:        { bg: 'bg-blue-500/20',    text: 'text-blue-500',    dot: 'bg-blue-500' },
  contacted:  { bg: 'bg-purple-500/20',  text: 'text-purple-500',  dot: 'bg-purple-500' },
  collecting: { bg: 'bg-amber-500/20',   text: 'text-amber-500',   dot: 'bg-amber-500' },
  drafting:   { bg: 'bg-purple-500/20',  text: 'text-purple-500',  dot: 'bg-purple-500' },
  submitted:  { bg: 'bg-orange-500/20',  text: 'text-orange-500',  dot: 'bg-orange-500' },
  approved:   { bg: 'bg-emerald-500/20', text: 'text-emerald-500', dot: 'bg-emerald-500' },
};
