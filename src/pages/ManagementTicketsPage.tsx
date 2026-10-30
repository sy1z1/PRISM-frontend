import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../services/api';
import { clearAuthSession } from '../services/authStorage';
import type { CSSProperties } from 'react';

interface QueueTicket {
  id: string;
  ticket_number: string;
  asset_id: string;
  asset_name: string;
  site_name: string | null;
  site_code: string | null;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  maintenance_group_name: string | null;
  maintenance_group_code: string | null;
  organization_name: string | null;
}

interface QueueResponse {
  tickets: QueueTicket[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const STATUS_OPTIONS = [
  'PENDING_VERIFICATION',
  'ASSIGNED',
  'ACKNOWLEDGED',
  'IN_PROGRESS',
  'APPROVED',
  'CANCELLED',
  'OPEN'
];

const statusStyle = (status: string): CSSProperties => {
  const palette: Record<string, string> = {
    PENDING_VERIFICATION: '#f59e0b',
    ASSIGNED: '#38bdf8',
    ACKNOWLEDGED: '#a78bfa',
    IN_PROGRESS: '#fb923c',
    APPROVED: '#4ade80',
    CANCELLED: '#94a3b8',
    OPEN: '#e879f9'
  };
  return { color: palette[status] || '#e2e8f0', fontWeight: 600 };
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export default function ManagementTicketsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState('PENDING_VERIFICATION');
  const [priority, setPriority] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const params = useMemo(() => {
    const query = new URLSearchParams();
    if (status) query.set('status', status);
    if (priority) query.set('priority', priority);
    if (search.trim()) query.set('q', search.trim());
    query.set('page', String(page));
    query.set('limit', '20');
    return query.toString();
  }, [status, priority, search, page]);

  const queueQuery = useQuery<QueueResponse>({
    queryKey: ['managementQueue', params],
    queryFn: () => fetchApi(`/api/tickets/queue?${params}`),
    refetchInterval: 60_000,
    staleTime: 15_000
  });

  const tickets = queueQuery.data?.tickets || [];
  const total = queueQuery.data?.total || 0;

  const signOut = async () => {
    try {
      await fetchApi('/api/identity/logout', { method: 'POST' });
    } catch {
      // Session may already be invalid.
    } finally {
      clearAuthSession();
      queryClient.clear();
      navigate('/login', { replace: true });
    }
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <button type="button" style={styles.back} onClick={() => navigate('/management/dashboard')}>
            ← Back to map
          </button>
          <h1 style={styles.title}>Maintenance tickets</h1>
          <p style={styles.subtitle}>
            {queueQuery.isLoading ? 'Loading…' : `${total} ticket(s) · auto-refreshes every 60s`}
          </p>
        </div>
        <button type="button" style={styles.signOut} onClick={() => void signOut()}>
          Sign out
        </button>
      </header>

      <section style={styles.filters}>
        <label style={styles.field}>
          <span style={styles.label}>Status</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            style={styles.input}
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.field}>
          <span style={styles.label}>Priority</span>
          <select
            value={priority}
            onChange={(event) => {
              setPriority(event.target.value);
              setPage(1);
            }}
            style={styles.input}
          >
            <option value="">Any</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </label>

        <label style={{ ...styles.field, flex: 1, minWidth: 240 }}>
          <span style={styles.label}>Search</span>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Ticket, asset, or description"
            style={styles.input}
          />
        </label>
      </section>

      {queueQuery.isError && (
        <div style={styles.error} role="alert">
          Could not load tickets. {queueQuery.error instanceof Error ? queueQuery.error.message : ''}
        </div>
      )}

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Ticket</th>
              <th style={styles.th}>Asset</th>
              <th style={styles.th}>Organization</th>
              <th style={styles.th}>Group</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Priority</th>
              <th style={styles.th}>Created</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr
                key={ticket.id}
                style={styles.row}
                onClick={() => navigate(`/maintenance/tickets/${encodeURIComponent(ticket.id)}`)}
              >
                <td style={styles.td}>
                  <strong>{ticket.ticket_number}</strong>
                  <div style={styles.muted}>{ticket.category}</div>
                </td>
                <td style={styles.td}>
                  {ticket.asset_name}
                  <div style={styles.muted}>{ticket.site_name || 'Unknown site'}</div>
                </td>
                <td style={styles.td}>{ticket.organization_name || '—'}</td>
                <td style={styles.td}>
                  {ticket.maintenance_group_name || 'Unassigned'}
                  {ticket.maintenance_group_code ? (
                    <div style={styles.muted}>{ticket.maintenance_group_code}</div>
                  ) : null}
                </td>
                <td style={styles.td}>
                  <span style={statusStyle(ticket.status)}>{ticket.status.replaceAll('_', ' ')}</span>
                </td>
                <td style={styles.td}>{ticket.priority}</td>
                <td style={styles.td}>{formatDate(ticket.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!queueQuery.isLoading && tickets.length === 0 && (
          <div style={styles.empty}>No tickets match the current filters.</div>
        )}
      </div>

      <footer style={styles.pagination}>
        <button
          type="button"
          style={styles.pageButton}
          disabled={page <= 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
        >
          Previous
        </button>
        <span style={styles.muted}>
          Page {queueQuery.data?.page || page} of {Math.max(1, queueQuery.data?.totalPages || 1)}
        </span>
        <button
          type="button"
          style={styles.pageButton}
          disabled={page >= (queueQuery.data?.totalPages || 1)}
          onClick={() => setPage((current) => current + 1)}
        >
          Next
        </button>
      </footer>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#020617',
    color: '#e2e8f0',
    padding: '32px clamp(16px, 4vw, 48px)',
    fontFamily: "'Inter', system-ui, sans-serif"
  },
  header: { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' },
  back: {
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: 0,
    marginBottom: 12
  },
  title: { margin: 0, fontSize: 28, color: '#f8fafc' },
  subtitle: { margin: '6px 0 0', color: '#94a3b8', fontSize: 13 },
  signOut: {
    background: 'rgba(248,113,113,0.12)',
    border: '1px solid rgba(248,113,113,0.4)',
    color: '#fca5a5',
    padding: '8px 14px',
    borderRadius: 10,
    cursor: 'pointer'
  },
  filters: { display: 'flex', flexWrap: 'wrap', gap: 12, margin: '24px 0 16px' },
  field: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 160 },
  label: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' },
  input: {
    background: 'rgba(15,23,42,0.9)',
    border: '1px solid rgba(148,163,184,0.25)',
    color: '#e2e8f0',
    borderRadius: 10,
    padding: '9px 11px',
    outline: 'none'
  },
  tableWrap: {
    border: '1px solid rgba(148,163,184,0.15)',
    borderRadius: 14,
    overflow: 'hidden',
    background: 'rgba(15,23,42,0.5)'
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left',
    padding: '12px 14px',
    background: 'rgba(2,6,23,0.6)',
    color: '#94a3b8',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.06em'
  },
  td: { padding: '12px 14px', borderTop: '1px solid rgba(148,163,184,0.1)', verticalAlign: 'top' },
  row: { cursor: 'pointer' },
  muted: { color: '#64748b', fontSize: 12, marginTop: 3 },
  empty: { padding: 28, textAlign: 'center', color: '#64748b' },
  error: {
    background: 'rgba(248,113,113,0.12)',
    border: '1px solid rgba(248,113,113,0.3)',
    color: '#fca5a5',
    padding: '10px 14px',
    borderRadius: 10,
    marginBottom: 12
  },
  pagination: { display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'flex-end', marginTop: 14 },
  pageButton: {
    background: 'rgba(148,163,184,0.12)',
    border: '1px solid rgba(148,163,184,0.25)',
    color: '#e2e8f0',
    padding: '7px 12px',
    borderRadius: 8,
    cursor: 'pointer'
  }
};
