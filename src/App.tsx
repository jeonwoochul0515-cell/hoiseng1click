import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import UpgradeModal from '@/components/subscription/UpgradeModal';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import ToastContainer from '@/components/ui/Toast';
import GoldBurst from '@/components/ui/GoldBurst';

// 라우트 기반 코드 스플리팅
const LandingPage = lazy(() => import('@/pages/LandingPage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const IntakePage = lazy(() => import('@/pages/IntakePage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const ClientsPage = lazy(() => import('@/pages/ClientsPage'));
const ClientDetailPage = lazy(() => import('@/pages/ClientDetailPage'));
const CollectionPage = lazy(() => import('@/pages/CollectionPage'));
const DocumentsPage = lazy(() => import('@/pages/DocumentsPage'));
const LiquidationPage = lazy(() => import('@/pages/LiquidationPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const StatementPage = lazy(() => import('@/pages/StatementPage'));
const AdminPage = lazy(() => import('@/pages/AdminPage'));
const DocumentSubmitPage = lazy(() => import('@/pages/DocumentSubmitPage'));

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-gold border-t-transparent" />
    </div>
  );
}

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
      <div className="flex-1 flex flex-col md:ml-[220px]">
        <TopBar />
        <main className="flex-1 overflow-auto p-6">
          <Suspense fallback={<LoadingSpinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      {upgradeModalOpen && <UpgradeModal />}
    </div>
  );
}

function PlanGuard({ requirePro }: { requirePro?: boolean }) {
  const hasPro = useAuthStore((s) => s.hasPro);
  const openUpgradeModal = useUiStore((s) => s.openUpgradeModal);
  const shouldRedirect = requirePro && !hasPro();

  useEffect(() => {
    if (shouldRedirect) openUpgradeModal();
  }, [shouldRedirect, openUpgradeModal]);

  if (shouldRedirect) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

export default function App() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    const unsubscribe = init();
    return () => { unsubscribe(); };
  }, [init]);

  return (
    <ErrorBoundary>
    <BrowserRouter>
      <ToastContainer />
      <GoldBurst />
      <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/intake/:token" element={<IntakePage />} />
        <Route path="/docs/:token" element={<DocumentSubmitPage />} />
        <Route element={<AuthGuard />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="clients/:id" element={<ClientDetailPage />} />
          <Route path="clients/:clientId/statement" element={<StatementPage />} />
          <Route path="collection" element={<Navigate to="/clients" replace />} />
          <Route path="collection/:clientId" element={<CollectionPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route element={<PlanGuard requirePro />}>
            <Route path="liquidation" element={<LiquidationPage />} />
          </Route>
          <Route path="settings" element={<SettingsPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
