import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  Users,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  Scale,
  ShieldCheck,
  MapPin,
  ArrowUpCircle,
  Heart,
  Monitor,
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
  adminOnly?: boolean;
}

const ADMIN_EMAILS = ['admin@lawdocs.kr', 'jeonwoochul0515@gmail.com'];

const officeNavItems: NavItem[] = [
  { icon: Home, label: '대시보드', to: '/dashboard' },
  { icon: Users, label: '의뢰인 관리', to: '/clients' },
  { icon: BarChart3, label: '청산가치', to: '/liquidation', proOnly: true },
  { icon: FileText, label: '서류 생성', to: '/documents' },
  { icon: Monitor, label: '전자소송 제출', to: '/ecfs-helper' },
  { icon: Settings, label: '설정', to: '/settings' },
  { icon: ShieldCheck, label: '관리자', to: '/admin', adminOnly: true },
];

const individualNavItems: NavItem[] = [
  { icon: Home, label: '내 현황', to: '/my' },
  { icon: FileText, label: '서류 생성', to: '/my/documents' },
  { icon: Monitor, label: '전자소송 제출', to: '/my/ecfs-helper' },
  { icon: MapPin, label: '법원 접수 가이드', to: '/my/court-guide' },
  { icon: Settings, label: '설정', to: '/my/settings' },
];

export default function Sidebar() {
  const { user, office, individual, userType, logout, hasPro } = useAuthStore();
  const { openUpgradeModal, sidebarOpen, closeSidebar } = useUiStore();
  const location = useLocation();

  // /my 경로면 항상 개인용 사이드바 표시 (userType 무관)
  const isIndividual = userType === 'individual' || location.pathname.startsWith('/my');
  const navItems = isIndividual ? individualNavItems : officeNavItems;

  const plan = isIndividual
    ? (individual?.plan ?? null)
    : (office?.plan ?? 'starter');
  const planExpiry = isIndividual
    ? (individual?.planExpiresAt ? dayjs(individual.planExpiresAt.toDate()).format('YYYY.MM.DD') : null)
    : (office?.planExpiry ? dayjs(office.planExpiry.toDate()).format('YYYY.MM.DD') : null);
  const displayName = isIndividual
    ? (individual?.name ?? '개인 사용자')
    : (office?.name ?? '내 사무소');

  return (
    <>
      {/* Overlay — mobile only */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-[220px] flex-col transition-transform duration-300 md:translate-x-0 ${
          isIndividual ? 'bg-[#1a2f2f]' : 'bg-[#111827]'
        } ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo section */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-2">
            {isIndividual ? (
              <>
                <Heart size={22} className="text-[#48B5A0]" />
                <span className="text-lg font-bold text-[#48B5A0]">회생클릭</span>
              </>
            ) : (
              <>
                <Scale size={22} className="text-brand-gold" />
                <span className="text-lg font-bold text-brand-gold">회생원클릭</span>
              </>
            )}
          </div>
          <div className="mt-2">
            <p className="truncate text-sm text-gray-300">{displayName}</p>
            <div className="mt-1">
              {plan ? <PlanBadge plan={plan} /> : <span className="text-xs text-gray-500">플랜 미선택</span>}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-2">
          {navItems
            .filter((item) => !item.proOnly || hasPro())
            .filter((item) => !item.adminOnly || ADMIN_EMAILS.includes(user?.email ?? ''))
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard' || item.to === '/my'}
                onClick={closeSidebar}
                id={
                  item.to === '/documents'
                    ? 'sidebar-nav-documents'
                    : item.to === '/settings'
                      ? 'sidebar-nav-settings'
                      : undefined
                }
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'border-l-[3px] border-brand-gold text-brand-gold'
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
            <p>{plan ? (typeof plan === 'string' ? plan.toUpperCase() : '') : '무료'} 플랜</p>
            {planExpiry && <p>만료: {planExpiry}</p>}
          </div>

          {!isIndividual && plan === 'starter' && (
            <button
              onClick={openUpgradeModal}
              className="mb-3 w-full rounded-md bg-brand-gold py-1.5 text-xs font-semibold text-black hover:bg-[#b8973e] transition-colors"
            >
              업그레이드
            </button>
          )}

          {isIndividual && (!plan || plan === 'self') && (
            <NavLink
              to="/my/upgrade"
              className="mb-3 block w-full rounded-md bg-brand-gold py-1.5 text-center text-xs font-semibold text-black hover:bg-[#b8973e] transition-colors"
            >
              {plan ? 'SELF+ 업그레이드' : '플랜 선택하기'}
            </NavLink>
          )}

          {/* User info + logout */}
          <div className="flex items-center justify-between">
            <span className="truncate text-xs text-gray-400">
              {user?.email}
            </span>
            <button
              onClick={logout}
              className="flex items-center gap-1 text-gray-500 hover:text-gray-300 transition-colors"
              title="로그아웃"
              aria-label="로그아웃"
            >
              <LogOut size={14} />
              <span className="text-xs">로그아웃</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
