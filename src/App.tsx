import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import UpgradeModal from '@/components/subscription/UpgradeModal';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import ClientsPage from '@/pages/ClientsPage';
import ClientDetailPage from '@/pages/ClientDetailPage';
import CollectionPage from '@/pages/CollectionPage';
import DocumentsPage from '@/pages/DocumentsPage';
import LiquidationPage from '@/pages/LiquidationPage';
import SettingsPage from '@/pages/SettingsPage';

function AuthGuard() {
  const { user, loading } = useAuthStore();
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-main">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-gold border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout />;
}

function AppLayout() {
  const upgradeModalOpen = useUiStore((s) => s.upgradeModalOpen);
  return (
    <div className="flex h-screen bg-bg-main">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-[220px]">
        <TopBar />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
      {upgradeModalOpen && <UpgradeModal />}
    </div>
  );
}

function PlanGuard({ requirePro }: { requirePro?: boolean }) {
  const hasPro = useAuthStore((s) => s.hasPro);
  const openUpgradeModal = useUiStore((s) => s.openUpgradeModal);

  if (requirePro && !hasPro()) {
    openUpgradeModal();
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

export default function App() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AuthGuard />}>
          <Route index element={<DashboardPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="clients/:id" element={<ClientDetailPage />} />
          <Route path="collection/:clientId" element={<CollectionPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route element={<PlanGuard requirePro />}>
            <Route path="liquidation" element={<LiquidationPage />} />
          </Route>
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
