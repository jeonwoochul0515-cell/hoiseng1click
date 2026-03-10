import { NavLink } from 'react-router-dom';
import {
  Home,
  Users,
  Link,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  Scale,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import PlanBadge from '@/components/subscription/PlanBadge';
import dayjs from 'dayjs';

interface NavItem {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  to: string;
  proOnly?: boolean;
}

const navItems: NavItem[] = [
  { icon: Home, label: '대시보드', to: '/' },
  { icon: Users, label: '의뢰인 관리', to: '/clients' },
  { icon: Link, label: '데이터 수집', to: '/collection' },
  { icon: FileText, label: '서류 생성', to: '/documents' },
  { icon: BarChart3, label: '청산가치', to: '/liquidation', proOnly: true },
  { icon: Settings, label: '설정', to: '/settings' },
];

export default function Sidebar() {
  const { user, office, logout, hasPro } = useAuthStore();
  const { openUpgradeModal } = useUiStore();

  const plan = office?.plan ?? 'starter';
  const planExpiry = office?.planExpiry
    ? dayjs(office.planExpiry.toDate()).format('YYYY.MM.DD')
    : null;

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-full w-[220px] flex-col bg-[#111827]">
      {/* Logo section */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2">
          <Scale size={22} className="text-[#C9A84C]" />
          <span className="text-lg font-bold text-[#C9A84C]">LawDocs</span>
        </div>
        {office && (
          <div className="mt-2">
            <p className="truncate text-sm text-gray-300">{office.name}</p>
            <div className="mt-1">
              <PlanBadge plan={plan} />
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-2">
        {navItems
          .filter((item) => !item.proOnly || hasPro())
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'border-l-[3px] border-[#C9A84C] text-[#C9A84C]'
                    : 'border-l-[3px] border-transparent text-gray-400 hover:bg-white/5 hover:text-gray-200'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-gray-700/50 px-4 py-4">
        {/* Plan info */}
        <div className="mb-3 text-xs text-gray-500">
          <p>{plan.toUpperCase()} 플랜</p>
          {planExpiry && <p>만료: {planExpiry}</p>}
        </div>

        {plan === 'starter' && (
          <button
            onClick={openUpgradeModal}
            className="mb-3 w-full rounded-md bg-[#C9A84C] py-1.5 text-xs font-semibold text-black hover:bg-[#b8973e] transition-colors"
          >
            업그레이드
          </button>
        )}

        {/* User info + logout */}
        <div className="flex items-center justify-between">
          <span className="truncate text-xs text-gray-400">
            {user?.email}
          </span>
          <button
            onClick={logout}
            className="text-gray-500 hover:text-gray-300 transition-colors"
            title="로그아웃"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
