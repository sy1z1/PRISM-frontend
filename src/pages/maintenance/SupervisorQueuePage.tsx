import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../../services/api';
import { clearAuthSession } from '../../services/authStorage';
import { getStoredUser } from '../../config/roles';

interface QueueTicket {
  id: string;
  ticket_number: string;
  asset_name: string;
  site_name: string | null;
  site_code: string | null;
  category: string;
  priority: string;
  status: string;
  description: string;
  created_at: string;
  maintenance_group_name: string | null;
}

interface QueueResponse {
  tickets: QueueTicket[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const STATUS_OPTIONS = ['', 'ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'PENDING_VERIFICATION'];
const PRIORITY_OPTIONS = ['', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const statusLabel = (status: string) => status.replaceAll('_', ' ');

export default function SupervisorQueuePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useMemo(() => getStoredUser(), []);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<QueueResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (priority) params.set('priority', priority);
      if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim());
      params.set('page', String(page));
      params.set('limit', '20');
      const result = await fetchApi<QueueResponse>(`/api/tickets/queue?${params.toString()}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the queue.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [status, priority, debouncedSearch, page]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(true), 60_000);
    return () => clearInterval(timer);
  }, [load]);

  const signOut = async () => {
    try {
      await fetchApi('/api/identity/logout', { method: 'POST' });
    } catch {
      // Session may already be invalid.
    } finally {
      clearAuthSession();
      queryClient.clear();
      window.location.href = '/login';
    }
  };

  const totalPages = data?.totalPages || 0;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Maintenance group queue</h1>
          <p style={styles.subtitle}>
            {user?.email ? `${user.email} · ` : ''}Tickets for your authorized groups · refreshes every 60s
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            style={{ ...styles.signOut, background: 'rgba(59,130,246,0.12)', borderColor: 'rgba(59,130,246,0.4)', color: '#93c5fd' }}
            onClick={() => navigate('/reports')}
          >
            Reports
          </button>
          <button type="button" style={styles.signOut} onClick={signOut}>Sign out</button>
        </div>
      </header>

      <section style={styles.filters}>
        <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} style={styles.input}>
          {STATUS_OPTIONS.map((option) => (
            <option key={option || 'all'} value={option}>{option ? statusLabel(option) : 'All statuses'}</option>
          ))}
        </select>
        <select value={priority} onChange={(e) => { setPage(1); setPriority(e.target.value); }} style={styles.input}>
          {PRIORITY_OPTIONS.map((option) => (
            <option key={option || 'all'} value={option}>{option || 'All priorities'}</option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value); }}
          placeholder="Search ticket, asset, description"
          style={{ ...styles.input, flex: 1 }}
        />
        <button type="button" style={styles.refresh} onClick={() => void load()} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </section>

      {error && <div style={styles.error} role="alert">{error}</div>}

      <section style={styles.list}>
        {data?.tickets?.length ? data.tickets.map((ticket) => (
          <button
            key={ticket.id}
            type="button"
            style={styles.card}
            onClick={() => navigate(`/maintenance/tickets/${ticket.id}`)}
          >
            <div style={styles.cardTop}>
              <strong style={styles.ticketNumber}>{ticket.ticket_number}</strong>
              <span style={styles.status}>{statusLabel(ticket.status)}</span>
            </div>
            <div style={styles.assetName}>{ticket.asset_name}</div>
            <div style={styles.meta}>
              {ticket.site_name || 'Unknown site'} · {ticket.maintenance_group_name || 'Unassigned group'}
            </div>
            <div style={styles.description}>{ticket.description}</div>
            <div style={styles.meta}>{ticket.priority} priority · reported {formatDate(ticket.created_at)}</div>
          </button>
        )) : (
          !loading && <div style={styles.empty}>No tickets in your queue.</div>
        )}
      </section>

      {totalPages > 1 && (
        <footer style={styles.pagination}>
          <button type="button" style={styles.pageButton} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span style={styles.pageInfo}>Page {data?.page || page} of {totalPages}</span>
          <button type="button" style={styles.pageButton} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </footer>
      )}
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return 'unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'unknown' : date.toLocaleString();
}

const styles: Record<string, CSSProperties> = {
  page: { minHeight: '100vh', backgroundColor: '#0f172a', color: '#e2e8f0', padding: '32px', boxSizing: 'border-box' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '20px' },
  title: { margin: 0, fontSize: '24px' },
  subtitle: { margin: '4px 0 0', color: '#94a3b8', fontSize: '14px' },
  signOut: { padding: '10px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#ef4444', color: '#fff', cursor: 'pointer' },
  filters: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' },
  input: { padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#e2e8f0' },
  refresh: { padding: '10px 16px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#e2e8f0', cursor: 'pointer' },
  error: { padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(239,68,68,0.15)', color: '#fecaca', marginBottom: '16px' },
  list: { display: 'grid', gap: '12px' },
  card: { textAlign: 'left', padding: '16px', borderRadius: '10px', border: '1px solid #263449', backgroundColor: '#131d2f', color: '#e2e8f0', cursor: 'pointer' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  ticketNumber: { color: '#93c5fd', fontSize: '15px' },
  status: { fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#fbbf24' },
  assetName: { marginTop: '8px', fontSize: '17px', fontWeight: 600 },
  meta: { marginTop: '6px', color: '#94a3b8', fontSize: '13px' },
  description: { marginTop: '8px', color: '#cbd5e1', fontSize: '14px' },
  empty: { padding: '32px', textAlign: 'center', color: '#94a3b8', border: '1px dashed #334155', borderRadius: '10px' },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '20px' },
  pageButton: { padding: '8px 14px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#e2e8f0', cursor: 'pointer' },
  pageInfo: { color: '#94a3b8', fontSize: '13px' }
};
