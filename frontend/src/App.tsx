import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { NewRequestPage } from './pages/NewRequestPage';
import { RequestDetailPage } from './pages/RequestDetailPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { DesignSystemPage } from './pages/DesignSystemPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {import.meta.env.DEV && (
          <Route path="design-system" element={<DesignSystemPage />} />
        )}
        <Route index element={<DashboardPage />} />
        <Route path="requests" element={<ApplicationsPage />} />
        <Route path="requests/new" element={<NewRequestPage />} />
        <Route path="requests/:requestId" element={<RequestDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
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
              ]}
            />
          }
        >
          <Route path="design-system/officer" element={<DesignSystemPage />} />
        </Route>
      )}
    </Routes>
  );
}
