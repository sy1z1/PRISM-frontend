import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiUrl, fetchApi } from '../services/api';
import { getAuthToken } from '../services/authStorage';
import { getStoredUser, isManagementRole } from '../config/roles';
import type { CSSProperties } from 'react';

interface ReportSummary {
  scope: {
    organizationId: string | null;
    from: string | null;
    to: string | null;
    siteId: string | null;
    groupId: string | null;
  };
  totals: {
    total_tickets: number;
    active_tickets: number;
    pending_verification: number;
    approved_tickets: number;
    cancelled_tickets: number;
    reopened_tickets: number;
    avg_ack_hours: number | null;
    avg_resolution_hours: number | null;
    avg_approval_hours: number | null;
    reopen_rate: number;
  };
  statusBreakdown: Array<{ status: string; count: number }>;
  priorityBreakdown: Array<{ priority: string; count: number }>;
  groupPerformance: Array<{
    group_name: string | null;
    group_code: string | null;
    tickets: number;
    approved: number;
    cancelled: number;
    reopened: number;
    avg_resolution_hours: number | null;
  }>;
  assets: {
    total_assets: number | null;
    clear_assets: number | null;
    in_maintenance_assets: number | null;
    assets_with_tickets: number;
  };
}

const formatHours = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : `${value} h`;

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString() : 'All time';

export default function ReportsPage() {
  const navigate = useNavigate();
  const user = useMemo(() => getStoredUser(), []);
  const management = isManagementRole(user?.role);

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return params.toString();
  }, [from, to]);

  const summaryQuery = useQuery<ReportSummary>({
    queryKey: ['reportSummary', queryString],
    queryFn: () => fetchApi(`/api/reports/summary${queryString ? `?${queryString}` : ''}`),
    staleTime: 15_000
  });

  const summary = summaryQuery.data;

  const downloadCsv = async () => {
    if (downloading) return;
    setDownloading(true);
    setError('');
    try {
      const token = getAuthToken();
      const response = await fetch(
        apiUrl(`/api/reports/tickets.csv${queryString ? `?${queryString}` : ''}`),
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!response.ok) throw new Error('CSV export failed.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `prism-tickets-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV export failed.');
    } finally {
      setDownloading(false);
    }
  };

  const assetsTotal = summary?.assets.total_assets ?? summary?.assets.assets_with_tickets ?? 0;

  return (
    <div className="report-page" style={styles.page}>
      <style>{`
        @media print {
          .report-no-print { display: none !important; }
          .report-page { background: #ffffff !important; color: #0f172a !important; padding: 0 !important; }
          .report-card { background: #ffffff !important; border-color: #cbd5e1 !important; color: #0f172a !important; }
          .report-table th, .report-table td { color: #0f172a !important; border-color: #cbd5e1 !important; }
          .report-muted { color: #475569 !important; }
          .report-title { color: #0f172a !important; }
          body { background: #ffffff !important; }
        }
      `}</style>

      <header style={styles.header}>
        <div>
          <button
            type="button"
            className="report-no-print"
            style={styles.back}
            onClick={() => navigate(management ? '/management/dashboard' : '/maintenance/dashboard')}
          >
            ← Back to dashboard
          </button>
          <h1 className="report-title" style={styles.title}>Maintenance summary report</h1>
          <p className="report-muted" style={styles.subtitle}>
            {management ? 'Organization' : 'Supervised groups'} · {formatDate(from)} to {formatDate(to)}
          </p>
        </div>
        <div className="report-no-print" style={styles.actions}>
          <button type="button" style={styles.secondary} onClick={() => window.print()}>Print</button>
          <button type="button" style={styles.primary} onClick={() => void downloadCsv()} disabled={downloading}>
            {downloading ? 'Exporting…' : 'Download CSV'}
          </button>
        </div>
      </header>

      <section className="report-no-print" style={styles.filters}>
        <label style={styles.field}>
          <span style={styles.label}>From</span>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} style={styles.input} />
        </label>
        <label style={styles.field}>
          <span style={styles.label}>To</span>
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} style={styles.input} />
        </label>
        <button
          type="button"
          style={styles.secondary}
          onClick={() => { setFrom(''); setTo(''); }}
        >
          Clear range
        </button>
      </section>

      {error && <div style={styles.error} role="alert">{error}</div>}
      {summaryQuery.isError && (
        <div style={styles.error} role="alert">
          {summaryQuery.error instanceof Error ? summaryQuery.error.message : 'Could not load the report.'}
        </div>
      )}

      {!summary ? (
        <div style={styles.loading}>{summaryQuery.isLoading ? 'Loading report…' : 'No report data.'}</div>
      ) : (
        <>
          <section style={styles.cards}>
            <Metric label="Total tickets" value={summary.totals.total_tickets} />
            <Metric label="Active" value={summary.totals.active_tickets} accent="#38bdf8" />
            <Metric label="Pending verification" value={summary.totals.pending_verification} accent="#f59e0b" />
            <Metric label="Approved" value={summary.totals.approved_tickets} accent="#4ade80" />
            <Metric label="Reopen rate" value={formatPercent(summary.totals.reopen_rate)} accent="#f87171" />
            <Metric label="Avg resolution" value={formatHours(summary.totals.avg_resolution_hours)} />
            <Metric label="Avg approval" value={formatHours(summary.totals.avg_approval_hours)} />
            <Metric label="Assets tracked" value={assetsTotal} />
            <Metric label="Assets clear" value={summary.assets.clear_assets ?? '—'} accent="#4ade80" />
            <Metric label="In maintenance" value={summary.assets.in_maintenance_assets ?? '—'} accent="#f87171" />
          </section>

          <section className="report-card" style={styles.panel}>
            <h2 style={styles.sectionTitle}>Status breakdown</h2>
            <div style={styles.statusRow}>
              {summary.statusBreakdown.map((item) => (
                <div key={item.status} style={styles.statusPill}>
                  <span>{item.status.replaceAll('_', ' ')}</span>
                  <strong>{item.count}</strong>
                </div>
              ))}
              {summary.statusBreakdown.length === 0 && <span className="report-muted" style={styles.muted}>No tickets.</span>}
            </div>
          </section>

          <section className="report-card" style={styles.panel}>
            <h2 style={styles.sectionTitle}>Maintenance group performance</h2>
            <table className="report-table" style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Group</th>
                  <th style={styles.th}>Tickets</th>
                  <th style={styles.th}>Approved</th>
                  <th style={styles.th}>Cancelled</th>
                  <th style={styles.th}>Reopened</th>
                  <th style={styles.th}>Avg resolution</th>
                </tr>
              </thead>
              <tbody>
                {summary.groupPerformance.map((group) => (
                  <tr key={`${group.group_code}-${group.group_name}`}>
                    <td style={styles.td}>
                      {group.group_name || 'Unassigned'}
                      {group.group_code ? <div className="report-muted" style={styles.muted}>{group.group_code}</div> : null}
                    </td>
                    <td style={styles.td}>{group.tickets}</td>
                    <td style={styles.td}>{group.approved}</td>
                    <td style={styles.td}>{group.cancelled}</td>
                    <td style={styles.td}>{group.reopened}</td>
                    <td style={styles.td}>{formatHours(group.avg_resolution_hours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {summary.groupPerformance.length === 0 && (
              <div className="report-muted" style={styles.muted}>No group activity in this range.</div>
            )}
          </section>

          <footer className="report-muted" style={styles.footer}>
            Generated {new Date().toLocaleString()} · PRISM
          </footer>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="report-card" style={styles.metricCard}>
      <span className="report-muted" style={styles.metricLabel}>{label}</span>
      <strong style={{ fontSize: 26, color: accent || '#f8fafc' }}>{value}</strong>
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
  header: { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' },
  back: { background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, marginBottom: 12 },
  title: { margin: 0, fontSize: 28, color: '#f8fafc' },
  subtitle: { margin: '6px 0 0', color: '#94a3b8', fontSize: 13 },
  actions: { display: 'flex', gap: 8 },
  filters: { display: 'flex', gap: 12, alignItems: 'flex-end', margin: '24px 0 16px', flexWrap: 'wrap' },
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
  primary: { background: '#2563eb', border: 'none', color: '#fff', padding: '10px 16px', borderRadius: 10, cursor: 'pointer', fontWeight: 600 },
  secondary: { background: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.25)', color: '#e2e8f0', padding: '10px 16px', borderRadius: 10, cursor: 'pointer' },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 18 },
  metricCard: { border: '1px solid rgba(148,163,184,0.15)', borderRadius: 14, padding: '14px 16px', background: 'rgba(15,23,42,0.5)', display: 'flex', flexDirection: 'column', gap: 6 },
  metricLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' },
  panel: { border: '1px solid rgba(148,163,184,0.15)', borderRadius: 14, padding: '16px 18px', background: 'rgba(15,23,42,0.5)', marginBottom: 16 },
  sectionTitle: { margin: '0 0 12px', fontSize: 16, color: '#f8fafc' },
  statusRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  statusPill: { display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', borderRadius: 999, border: '1px solid rgba(148,163,184,0.2)', fontSize: 12 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '10px 12px', color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid rgba(148,163,184,0.15)' },
  td: { padding: '10px 12px', borderBottom: '1px solid rgba(148,163,184,0.1)' },
  muted: { color: '#64748b', fontSize: 12 },
  loading: { padding: 28, color: '#94a3b8' },
  error: { background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5', padding: '10px 14px', borderRadius: 10, marginBottom: 12 },
  footer: { marginTop: 18, fontSize: 11, color: '#475569' }
};
