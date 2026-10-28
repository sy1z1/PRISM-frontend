import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import LoginPage from './pages/LoginPage';
import ManagementDashboard from './pages/ManagementDashboard';
import AssetDigitalTwinPage from './pages/AssetDigitalTwinPage';

// Create a single QueryClient instance for TanStack Query caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function MaintenanceDashboard() {
  return (
    <div style={{ padding: '40px', color: '#fff', backgroundColor: '#0f172a', minHeight: '100vh' }}>
      <h1>Maintenance Dashboard (Field Technician)</h1>
      <p>Welcome, Technician! Your assigned tickets and work start/resolve buttons will live here.</p>
      <button 
        onClick={() => { localStorage.clear(); window.location.href = '/login'; }}
        style={{ padding: '10px 20px', marginTop: '20px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
      >
        Sign Out
      </button>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          {/* Default route redirects to login */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          <Route path="/login" element={<LoginPage />} />
          
          <Route path="/management/dashboard" element={<ManagementDashboard />}>
            <Route path="assets/:assetId/digital-twin" element={<AssetDigitalTwinPage />} />
          </Route>
          
          {/* Maintenance Platform Route */}
          <Route path="/maintenance/dashboard" element={<MaintenanceDashboard />} />
          
          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}