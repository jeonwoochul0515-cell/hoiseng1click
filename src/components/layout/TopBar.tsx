import dayjs from 'dayjs';
import { useAuthStore } from '@/store/authStore';

interface TopBarProps {
  title?: string;
}

const PLAN_DOC_LIMITS: Record<string, number> = {
  starter: 50,
  pro: Infinity,
  enterprise: Infinity,
};

export default function TopBar({ title }: TopBarProps) {
  const office = useAuthStore((s) => s.office);

  const today = dayjs().format('YYYY년 M월 D일');
  const docCount = office?.docCountThisMonth ?? 0;
  const plan = office?.plan ?? 'starter';
  const docLimit = PLAN_DOC_LIMITS[plan];
  const docLimitLabel = docLimit === Infinity ? '∞' : String(docLimit);

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-700/50 bg-[#111827] px-6">
      {/* Left: page title */}
      <h1 className="text-lg font-semibold text-white">
        {title ?? ''}
      </h1>

      {/* Right: date, doc counter, add client button */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-400">{today}</span>

        <span className="rounded-md bg-white/5 px-3 py-1 text-sm text-gray-300">
          이달 서류 {docCount}/{docLimitLabel}건
        </span>

        <button className="rounded-md bg-[#C9A84C] px-4 py-1.5 text-sm font-semibold text-black hover:bg-[#b8973e] transition-colors">
          + 의뢰인 등록
        </button>
      </div>
    </header>
  );
}
