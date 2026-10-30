import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import LoginPage from './pages/LoginPage';
import ManagementDashboard from './pages/ManagementDashboard';
import AssetDigitalTwinPage from './pages/AssetDigitalTwinPage';
import SupervisorQueuePage from './pages/maintenance/SupervisorQueuePage';
import SupervisorTicketDetailPage from './pages/maintenance/SupervisorTicketDetailPage';
import { isManagementRole } from './config/roles';
import { getAuthToken, getStoredAuthUser } from './services/authStorage';

// Create a single QueryClient instance for TanStack Query caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const hasSession = () => Boolean(getAuthToken() && getStoredAuthUser());

const defaultRouteFor = (role?: string | null) =>
  isManagementRole(role) ? '/management/dashboard' : '/maintenance/dashboard';

// Any authenticated role.
function RequireAuth({ children }: { children: ReactNode }) {
  if (!hasSession()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// Management-only routes. A supervisor token must never render these pages,
// otherwise the management UI would silently display supervisor-scoped data.
function RequireManagement({ children }: { children: ReactNode }) {
  const user = getStoredAuthUser();
  if (!getAuthToken() || !user) return <Navigate to="/login" replace />;
  if (!isManagementRole(user.role)) return <Navigate to="/maintenance/dashboard" replace />;
  return <>{children}</>;
}

// Field/supervisor-only routes. Management uses the management dashboard.
function RequireSupervisor({ children }: { children: ReactNode }) {
  const user = getStoredAuthUser();
  if (!getAuthToken() || !user) return <Navigate to="/login" replace />;
  if (isManagementRole(user.role)) return <Navigate to="/management/dashboard" replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const user = getStoredAuthUser();
  if (!getAuthToken() || !user) return <Navigate to="/login" replace />;
  return <Navigate to={defaultRouteFor(user.role)} replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          {/* Default route sends signed-in users to their role's home */}
          <Route path="/" element={<RootRedirect />} />

          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/management/dashboard"
            element={
              <RequireManagement>
                <ManagementDashboard />
              </RequireManagement>
            }
          >
            <Route path="assets/:assetId/digital-twin" element={<AssetDigitalTwinPage />} />
          </Route>

          {/* Maintenance supervisor platform */}
          <Route
            path="/maintenance/dashboard"
            element={
              <RequireSupervisor>
                <SupervisorQueuePage />
              </RequireSupervisor>
            }
          />
          {/* Ticket detail supports both supervisor and management actions */}
          <Route
            path="/maintenance/tickets/:ticketId"
            element={
              <RequireAuth>
                <SupervisorTicketDetailPage />
              </RequireAuth>
            }
          />

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}