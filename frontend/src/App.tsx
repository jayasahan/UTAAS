import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AuthGuard } from './auth/AuthGuard';
import { SignInPage } from './pages/SignInPage';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { NewRequestPage } from './pages/NewRequestPage';
import { RequestDetailPage } from './pages/RequestDetailPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { DesignSystemPage } from './pages/DesignSystemPage';
import { OfficerPortalLayout } from './features/officer-queue/OfficerPortalLayout';
import { OfficerQueuePage } from './features/officer-queue/OfficerQueuePage';
import { OfficerDashboardPage } from './features/officer-dashboard/OfficerDashboardPage';
import { OfficerClaimReviewPage } from './features/officer-review/OfficerClaimReviewPage';
import { OfficerReviewHistoryPage } from './features/officer-history/OfficerReviewHistoryPage';

const DevOfficerClaimReviewPreview = import.meta.env.DEV
  ? lazy(() => import('./features/officer-review/DevOfficerClaimReviewPreview'))
  : null;
const DevOfficerReviewHistoryPreview = import.meta.env.DEV
  ? lazy(() =>
      import('./features/officer-history/DevOfficerReviewHistoryPreview').then(
        (module) => ({ default: module.DevOfficerReviewHistoryPreview }),
      ),
    )
  : null;

export default function App() {
  return (
    <Routes>
      <Route path="login" element={<SignInPage />} />
      <Route
        element={
          <AuthGuard allowedRoles={['LECTURER']}>
            <AppLayout />
          </AuthGuard>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="requests" element={<ApplicationsPage />} />
        <Route path="requests/new" element={<NewRequestPage />} />
        <Route path="requests/:requestId" element={<RequestDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route
        element={
          <AuthGuard
            allowedRoles={[
              'HOD',
              'DEAN',
              'EXAMINATION_OFFICER',
              'FINANCIAL_OFFICER',
              'ASSISTANT_BURSAR',
              'ADMIN',
            ]}
          >
            <OfficerPortalLayout />
          </AuthGuard>
        }
      >
        <Route path="officer" element={<OfficerDashboardPage />} />
        <Route path="officer/queue" element={<OfficerQueuePage />} />
        <Route
          path="officer/queue/:requestId"
          element={<OfficerClaimReviewPage />}
        />
        <Route
          path="officer/review-history"
          element={<OfficerReviewHistoryPage />}
        />
      </Route>
      {import.meta.env.DEV && (
        <Route element={<AppLayout />}>
          <Route path="design-system" element={<DesignSystemPage />} />
        </Route>
      )}
      {import.meta.env.DEV && (
        <Route
          element={
            <AppLayout
              variant="officer"
              workspaceLabel="Officer portal"
              items={[
                {
                  to: '/design-system/officer',
                  label: 'Component examples',
                  end: true,
                },
                {
                  to: '/design-system/officer/claim-review',
                  label: 'Claim review preview',
                  end: true,
                },
                {
                  to: '/design-system/officer/review-history',
                  label: 'Review history preview',
                  end: true,
                },
              ]}
            />
          }
        >
          <Route path="design-system/officer" element={<DesignSystemPage />} />
          {DevOfficerClaimReviewPreview && (
            <Route
              path="design-system/officer/claim-review"
              element={
                <Suspense fallback={<p role="status">Loading preview…</p>}>
                  <DevOfficerClaimReviewPreview />
                </Suspense>
              }
            />
          )}
          {DevOfficerReviewHistoryPreview && (
            <Route
              path="design-system/officer/review-history"
              element={
                <Suspense fallback={<p role="status">Loading preview…</p>}>
                  <DevOfficerReviewHistoryPreview />
                </Suspense>
              }
            />
          )}
        </Route>
      )}
    </Routes>
  );
}
