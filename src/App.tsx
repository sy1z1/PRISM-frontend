import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import LoginPage from './pages/LoginPage';
import ManagementDashboard from './pages/ManagementDashboard';
import ManagementTicketsPage from './pages/ManagementTicketsPage';
import ManagementContractorsPage from './pages/ManagementContractorsPage';
import ReportsPage from './pages/ReportsPage';
import AssetDigitalTwinPage from './pages/AssetDigitalTwinPage';
import SupervisorQueuePage from './pages/maintenance/SupervisorQueuePage';
import SupervisorTicketDetailPage from './pages/maintenance/SupervisorTicketDetailPage';
import { defaultRouteFor, isManagementRole, isTwinEditorRole } from './config/roles';
import { getAuthToken, getStoredAuthUser } from './services/authStorage';
import { AUTH_EXPIRED_EVENT } from './services/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

const hasSession = () => Boolean(getAuthToken() && getStoredAuthUser());

function RequireAuth({ children }: { children: ReactNode }) {
  if (!hasSession()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// Map + digital twin shell. Data Entry needs this to reach the twin editor.
function RequireManagementShell({ children }: { children: ReactNode }) {
  const user = getStoredAuthUser();
  if (!getAuthToken() || !user) return <Navigate to="/login" replace />;
  if (!isTwinEditorRole(user.role)) return <Navigate to="/maintenance/dashboard" replace />;
  return <>{children}</>;
}

// Management-only pages (ticket queue, verification worklist).
function RequireManagement({ children }: { children: ReactNode }) {
  const user = getStoredAuthUser();
  if (!getAuthToken() || !user) return <Navigate to="/login" replace />;
  if (!isManagementRole(user.role)) return <Navigate to={defaultRouteFor(user.role)} replace />;
  return <>{children}</>;
}

function RequireSupervisor({ children }: { children: ReactNode }) {
  const user = getStoredAuthUser();
  if (!getAuthToken() || !user) return <Navigate to="/login" replace />;
  if (isTwinEditorRole(user.role)) return <Navigate to="/management/dashboard" replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const user = getStoredAuthUser();
  if (!getAuthToken() || !user) return <Navigate to="/login" replace />;
  return <Navigate to={defaultRouteFor(user.role)} replace />;
}

function AuthExpiredListener() {
  const navigate = useNavigate();
  const client = useQueryClient();

  useEffect(() => {
    const handler = () => {
      client.clear();
      if (window.location.pathname !== '/login') {
        navigate('/login?reason=expired', { replace: true });
      }
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
  }, [client, navigate]);

  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthExpiredListener />
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/management/dashboard"
            element={
              <RequireManagementShell>
                <ManagementDashboard />
              </RequireManagementShell>
            }
          >
            <Route path="assets/:assetId/digital-twin" element={<AssetDigitalTwinPage />} />
          </Route>

          <Route
            path="/management/tickets"
            element={
              <RequireManagement>
                <ManagementTicketsPage />
              </RequireManagement>
            }
          />

          <Route
            path="/management/contractors"
            element={
              <RequireManagement>
                <ManagementContractorsPage />
              </RequireManagement>
            }
          />

          <Route
            path="/reports"
            element={
              <RequireAuth>
                <ReportsPage />
              </RequireAuth>
            }
          />

          <Route
            path="/maintenance/dashboard"
            element={
              <RequireSupervisor>
                <SupervisorQueuePage />
              </RequireSupervisor>
            }
          />
          <Route
            path="/maintenance/tickets/:ticketId"
            element={
              <RequireAuth>
                <SupervisorTicketDetailPage />
              </RequireAuth>
            }
          />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}
