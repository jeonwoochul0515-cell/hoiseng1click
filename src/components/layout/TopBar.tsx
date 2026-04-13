import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { PLAN_CONFIGS } from '@/types/subscription';
import AccessibilityToolbar from '@/components/ui/AccessibilityToolbar';

interface TopBarProps {
  title?: string;
}

export default function TopBar({ title }: TopBarProps) {
  const navigate = useNavigate();
  const office = useAuthStore((s) => s.office);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  const today = dayjs().format('YYYY년 M월 D일');
  const docCount = office?.docCountThisMonth ?? 0;
  const plan = office?.plan ?? 'starter';
  const docLimit = PLAN_CONFIGS[plan].maxDocsPerMonth;
  const docLimitLabel = docLimit === Infinity ? '∞' : String(docLimit);

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 md:px-6">
      {/* Left: hamburger (mobile) + page title */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleSidebar}
          className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100 md:hidden"
          aria-label="메뉴 열기"
        >
          <Menu size={22} />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">
          {title ?? ''}
        </h1>
      </div>

      {/* Right: date, doc counter, add client button */}
      <div className="flex items-center gap-2 md:gap-4">
        <span className="hidden text-sm text-gray-600 sm:inline">{today}</span>

        <span className="hidden rounded-md bg-gray-100 px-3 py-1 text-sm text-gray-700 sm:inline-block">
          이달 서류 {docCount}/{docLimitLabel}건
        </span>

        <AccessibilityToolbar />

        <button id="btn-add-client" onClick={() => navigate('/clients')} className="rounded-md bg-brand-gold px-3 py-1.5 text-sm font-semibold text-black hover:bg-[#b8973e] transition-colors md:px-4">
          + 의뢰인 등록
        </button>
      </div>
    </header>
  );
}
