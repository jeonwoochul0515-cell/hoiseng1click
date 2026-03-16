import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { PLAN_CONFIGS } from '@/types/subscription';

interface TopBarProps {
  title?: string;
}

export default function TopBar({ title }: TopBarProps) {
  const navigate = useNavigate();
  const office = useAuthStore((s) => s.office);

  const today = dayjs().format('YYYY년 M월 D일');
  const docCount = office?.docCountThisMonth ?? 0;
  const plan = office?.plan ?? 'starter';
  const docLimit = PLAN_CONFIGS[plan].maxDocsPerMonth;
  const docLimitLabel = docLimit === Infinity ? '∞' : String(docLimit);

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
      {/* Left: page title */}
      <h1 className="text-lg font-semibold text-gray-900">
        {title ?? ''}
      </h1>

      {/* Right: date, doc counter, add client button */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">{today}</span>

        <span className="rounded-md bg-gray-100 px-3 py-1 text-sm text-gray-700">
          이달 서류 {docCount}/{docLimitLabel}건
        </span>

        <button onClick={() => navigate('/clients')} className="rounded-md bg-[#C9A84C] px-4 py-1.5 text-sm font-semibold text-black hover:bg-[#b8973e] transition-colors">
          + 의뢰인 등록
        </button>
      </div>
    </header>
  );
}
