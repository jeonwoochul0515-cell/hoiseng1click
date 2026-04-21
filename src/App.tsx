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

// 개인 사용자(B2C) 페이지
const IndividualLandingPage = lazy(() => import('@/pages/IndividualLandingPage'));
const IndividualDashboardPage = lazy(() => import('@/pages/IndividualDashboardPage'));
const CourtGuidePage = lazy(() => import('@/pages/CourtGuidePage'));
const EcfsHelperPage = lazy(() => import('@/pages/EcfsHelperPage'));
const IndividualUpgradePage = lazy(() => import('@/pages/IndividualUpgradePage'));
const SelfDiagnosisPage = lazy(() => import('@/pages/SelfDiagnosisPage'));
const DischargeCheckPage = lazy(() => import('@/pages/DischargeCheckPage'));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'));
const TermsPage = lazy(() => import('@/pages/TermsPage'));
const MyCaseApplicationPage = lazy(() => import('@/pages/MyCaseApplicationPage'));
const MyCreditorsPage = lazy(() => import('@/pages/MyCreditorsPage'));
const MyAdditionalApplicationsPage = lazy(() => import('@/pages/MyAdditionalApplicationsPage'));
const ClientAdditionalApplicationsPage = lazy(() => import('@/pages/ClientAdditionalApplicationsPage'));

// 문서 중심 UX (신규)
const DocsHubPage = lazy(() => import('@/pages/docs/DocsHubPage'));
const DocGeneratePage = lazy(() => import('@/pages/docs/DocGeneratePage'));

/** self.hoiseng1click.com 감지 */
const isSelfDomain = typeof window !== 'undefined' && window.location.hostname.startsWith('self.');

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

/** userType에 따라 적절한 대시보드로 리다이렉트 */
function DashboardRedirect() {
  const userType = useAuthStore((s) => s.userType);
  if (userType === 'individual') return <Navigate to="/my" replace />;
  return <Navigate to="/dashboard" replace />;
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

/** B2B(법률사무소) 전용 라우트 가드 — individual 사용자 접근 차단 */
function OfficeOnlyGuard() {
  const userType = useAuthStore((s) => s.userType);
  const loading = useAuthStore((s) => s.loading);
  if (loading || userType === null) return <LoadingSpinner />;
  if (userType === 'individual') return <Navigate to="/my" replace />;
  return <Outlet />;
}

/** B2C(개인) 전용 라우트 가드 — office 사용자 접근 차단 */
function IndividualOnlyGuard() {
  const userType = useAuthStore((s) => s.userType);
  const loading = useAuthStore((s) => s.loading);
  if (loading || userType === null) return <LoadingSpinner />;
  if (userType === 'office') return <Navigate to="/dashboard" replace />;
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
        <Route path="/" element={isSelfDomain ? <IndividualLandingPage /> : <LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/self" element={<IndividualLandingPage />} />
        <Route path="/self/diagnosis" element={<SelfDiagnosisPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/intake/:token" element={<IntakePage />} />
        <Route path="/docs/:token" element={<DocumentSubmitPage />} />
        <Route element={<AuthGuard />}>
          {/* 사무소용 (B2B) — office 유저만 */}
          <Route element={<OfficeOnlyGuard />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="clients" element={<ClientsPage />} />
            <Route path="clients/:id" element={<ClientDetailPage />} />
            <Route path="clients/:clientId/statement" element={<StatementPage />} />
            <Route path="clients/:clientId/additional-applications" element={<ClientAdditionalApplicationsPage />} />
            <Route path="collection" element={<Navigate to="/clients" replace />} />
            <Route path="collection/:clientId" element={<CollectionPage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="ecfs-helper" element={<EcfsHelperPage />} />
            <Route element={<PlanGuard requirePro />}>
              <Route path="liquidation" element={<LiquidationPage />} />
            </Route>
            <Route path="settings" element={<SettingsPage />} />
            <Route path="settings/my-creditors" element={<MyCreditorsPage />} />
          </Route>

          {/* admin 페이지는 별도 페이지 내 권한 체크 (userType 무관) */}
          <Route path="admin" element={<AdminPage />} />

          {/* 개인용 (B2C) — individual 유저만 */}
          <Route element={<IndividualOnlyGuard />}>
            <Route path="my" element={<IndividualDashboardPage />} />
            <Route path="my/court-guide" element={<CourtGuidePage />} />
            <Route path="my/ecfs-helper" element={<EcfsHelperPage />} />
            <Route path="my/documents" element={<DocumentsPage />} />
            <Route path="my/collection" element={<CollectionPage />} />
            <Route path="my/statement" element={<StatementPage />} />
            <Route path="my/settings" element={<SettingsPage />} />
            <Route path="my/upgrade" element={<IndividualUpgradePage />} />
            <Route path="my/discharge-check" element={<DischargeCheckPage />} />
            <Route path="my/application" element={<MyCaseApplicationPage />} />
            <Route path="my/additional-applications" element={<MyAdditionalApplicationsPage />} />
            {/* 문서 중심 UX (B2C) */}
            <Route path="my/docs" element={<DocsHubPage />} />
            <Route path="my/docs/:docType" element={<DocGeneratePage />} />
          </Route>

          {/* B2B도 문서 중심 UX 접근 가능 */}
          <Route element={<OfficeOnlyGuard />}>
            <Route path="docs-gen" element={<DocsHubPage />} />
            <Route path="docs-gen/:docType" element={<DocGeneratePage />} />
          </Route>

          <Route path="*" element={<DashboardRedirect />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
