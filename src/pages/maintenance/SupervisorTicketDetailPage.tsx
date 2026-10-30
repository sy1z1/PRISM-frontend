import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchApi, resolveMediaUrl } from '../../services/api';
import { getStoredUser, isManagementRole } from '../../config/roles';

interface TicketMedia {
  id: string;
  media_url: string;
  evidence_stage: string;
  created_at: string;
}

interface AuditEntry {
  id: string;
  action_type: string;
  old_value: string | null;
  new_value: string | null;
  notes: string | null;
  logged_at: string;
}

interface TicketDetail {
  id: string;
  ticket_number: string;
  asset_id: string;
  asset_name: string;
  site_name: string | null;
  site_code: string | null;
  category: string;
  priority: string;
  status: string;
  description: string;
  resolution_notes: string | null;
  maintenance_group_id: string | null;
  maintenance_group_name: string | null;
  maintenance_group_code: string | null;
  acknowledged_at: string | null;
  completed_at: string | null;
  reopen_count: number;
  created_at: string;
  updated_at: string;
  media: TicketMedia[];
  auditLogs: AuditEntry[];
}

interface GroupOption {
  id: string;
  name: string;
  group_code: string;
}

export default function SupervisorTicketDetailPage() {
  const { ticketId = '' } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const user = useMemo(() => getStoredUser(), []);
  const management = isManagementRole(user?.role);

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [groupId, setGroupId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const result = await fetchApi<TicketDetail>(`/api/tickets/${encodeURIComponent(ticketId)}`);
      setTicket(result);
      setGroupId(result.maintenance_group_id || '');
      if (management && result.asset_id) {
        const available = await fetchApi<{ groups: GroupOption[] }>(
          `/api/maintenance-groups/available?assetId=${encodeURIComponent(result.asset_id)}`
        );
        setGroups(available.groups || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load ticket.');
    }
  }, [ticketId, management]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (label: string, action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(`${label} completed.`);
      setNote('');
      setReason('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${label} failed.`);
    } finally {
      setBusy(false);
    }
  };

  const acknowledge = () => run('Acknowledge', () =>
    fetchApi(`/api/tickets/${encodeURIComponent(ticketId)}/acknowledge`, { method: 'POST' }));

  const start = () => run('Start work', () =>
    fetchApi(`/api/tickets/${encodeURIComponent(ticketId)}/start`, {
      method: 'PATCH',
      body: JSON.stringify({ note: note || null })
    }));

  const complete = () => {
    if (!note.trim()) {
      setError('Resolution notes are required.');
      return;
    }
    return run('Completion', () =>
      fetchApi(`/api/tickets/${encodeURIComponent(ticketId)}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ resolutionNotes: note })
      }));
  };

  const verify = (approved: boolean) => {
    if (!approved && !reason.trim()) {
      setError('A rejection reason is required.');
      return;
    }
    return run(approved ? 'Approval' : 'Rejection', () =>
      fetchApi(`/api/tickets/${encodeURIComponent(ticketId)}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({ approved, rejectionReason: approved ? null : reason })
      }));
  };

  const cancel = () => {
    if (!reason.trim()) {
      setError('A cancellation reason is required.');
      return;
    }
    return run('Cancellation', () =>
      fetchApi(`/api/tickets/${encodeURIComponent(ticketId)}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ reason })
      }));
  };

  const reopen = () => {
    if (!groupId) {
      setError('Select a maintenance group to reopen.');
      return;
    }
    if (!reason.trim()) {
      setError('A reopen reason is required.');
      return;
    }
    return run('Reopen', () =>
      fetchApi(`/api/tickets/${encodeURIComponent(ticketId)}/reopen`, {
        method: 'PATCH',
        body: JSON.stringify({ groupId, reason })
      }));
  };

  const reassign = () => {
    if (!groupId) {
      setError('Select a maintenance group to reassign.');
      return;
    }
    return run('Reassignment', () =>
      fetchApi(`/api/tickets/${encodeURIComponent(ticketId)}/assign`, {
        method: 'POST',
        body: JSON.stringify({ groupId })
      }));
  };

  return (
    <div style={styles.page}>
      <button type="button" style={styles.back} onClick={() => navigate('/maintenance/dashboard')}>
        ← Back to queue
      </button>

      {error && <div style={styles.error} role="alert">{error}</div>}
      {notice && <div style={styles.notice} role="status">{notice}</div>}

      {!ticket ? (
        <div style={styles.empty}>Loading ticket…</div>
      ) : (
        <>
          <header style={styles.header}>
            <div>
              <h1 style={styles.title}>{ticket.ticket_number}</h1>
              <p style={styles.subtitle}>{ticket.asset_name} · {ticket.site_name || 'Unknown site'}</p>
            </div>
            <span style={styles.status}>{ticket.status.replaceAll('_', ' ')}</span>
          </header>

          <section style={styles.panel}>
            <Row label="Maintenance group">
              {ticket.maintenance_group_name || 'Unassigned'}
              {ticket.maintenance_group_code ? ` (${ticket.maintenance_group_code})` : ''}
            </Row>
            <Row label="Priority">{ticket.priority}</Row>
            <Row label="Category">{ticket.category}</Row>
            <Row label="Reported">{formatDate(ticket.created_at)}</Row>
            {ticket.acknowledged_at && <Row label="Acknowledged">{formatDate(ticket.acknowledged_at)}</Row>}
            {ticket.completed_at && <Row label="Completed">{formatDate(ticket.completed_at)}</Row>}
            {ticket.reopen_count > 0 && <Row label="Reopened">{ticket.reopen_count} time(s)</Row>}
            <div style={styles.description}>{ticket.description}</div>
            {ticket.resolution_notes && (
              <div style={styles.description}><strong>Resolution:</strong> {ticket.resolution_notes}</div>
            )}
          </section>

          <section style={styles.panel}>
            <h2 style={styles.sectionTitle}>Evidence</h2>
            {ticket.media.length ? (
              <div style={styles.mediaGrid}>
                {ticket.media.map((media) => (
                  <a
                    key={media.id}
                    href={resolveMediaUrl(media.media_url)}
                    target="_blank"
                    rel="noreferrer"
                    style={styles.mediaLink}
                  >
                    <img src={resolveMediaUrl(media.media_url)} alt={`${media.evidence_stage} evidence`} style={styles.mediaImage} />
                    <span>{media.evidence_stage} · {formatDate(media.created_at)}</span>
                  </a>
                ))}
              </div>
            ) : (
              <div style={styles.muted}>No evidence attached.</div>
            )}
          </section>

          <section style={styles.panel}>
            <h2 style={styles.sectionTitle}>Supervisor actions</h2>
            {ticket.status === 'ASSIGNED' && (
              <button type="button" style={styles.primary} onClick={acknowledge} disabled={busy}>Acknowledge ticket</button>
            )}

            {(ticket.status === 'ACKNOWLEDGED' || ticket.status === 'IN_PROGRESS') && (
              <div style={styles.actionGroup}>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={ticket.status === 'IN_PROGRESS' ? 'Resolution notes (required to complete)' : 'Progress note (optional)'}
                  style={styles.textarea}
                  disabled={busy}
                />
                {ticket.status === 'ACKNOWLEDGED' && (
                  <button type="button" style={styles.primary} onClick={start} disabled={busy}>Start work</button>
                )}
                {ticket.status === 'IN_PROGRESS' && (
                  <button type="button" style={styles.primary} onClick={complete} disabled={busy}>
                    Submit completion for verification
                  </button>
                )}
              </div>
            )}

            {ticket.status === 'PENDING_VERIFICATION' && !management && (
              <div style={styles.muted}>
                Completion submitted. Awaiting independent management verification.
              </div>
            )}

            {!['ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'PENDING_VERIFICATION'].includes(ticket.status) && (
              <div style={styles.muted}>No supervisor actions available for this status.</div>
            )}
          </section>

          {management && (
            <section style={styles.panel}>
              <h2 style={styles.sectionTitle}>Management actions</h2>

              {['ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'PENDING_VERIFICATION'].includes(ticket.status) && (
                <>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason (required for reject/cancel)"
                    style={styles.textarea}
                    disabled={busy}
                  />
                  <button type="button" style={styles.danger} onClick={cancel} disabled={busy}>Cancel ticket</button>
                </>
              )}

              {ticket.status === 'PENDING_VERIFICATION' && (
                <div style={styles.actionGroup}>
                  <button type="button" style={styles.primary} onClick={() => verify(true)} disabled={busy}>Approve</button>
                  <button type="button" style={styles.danger} onClick={() => verify(false)} disabled={busy}>Reject</button>
                </div>
              )}

              {['ASSIGNED', 'ACKNOWLEDGED'].includes(ticket.status) && (
                <div style={styles.actionGroup}>
                  <select value={groupId} onChange={(e) => setGroupId(e.target.value)} style={styles.input} disabled={busy}>
                    <option value="">Select group</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>{group.name} ({group.group_code})</option>
                    ))}
                  </select>
                  <button type="button" style={styles.secondary} onClick={reassign} disabled={busy}>Reassign group</button>
                </div>
              )}

              {['APPROVED', 'CANCELLED'].includes(ticket.status) && (
                <div style={styles.actionGroup}>
                  <select value={groupId} onChange={(e) => setGroupId(e.target.value)} style={styles.input} disabled={busy}>
                    <option value="">Select group</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>{group.name} ({group.group_code})</option>
                    ))}
                  </select>
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reopen reason (required)"
                    style={styles.input}
                    disabled={busy}
                  />
                  <button type="button" style={styles.primary} onClick={reopen} disabled={busy}>Reopen ticket</button>
                </div>
              )}
            </section>
          )}

          <section style={styles.panel}>
            <h2 style={styles.sectionTitle}>History</h2>
            <div style={styles.auditList}>
              {ticket.auditLogs.map((entry) => (
                <div key={entry.id} style={styles.auditRow}>
                  <strong>{entry.action_type.replaceAll('_', ' ')}</strong>
                  <span style={styles.muted}>
                    {entry.old_value || '—'} → {entry.new_value || '—'} · {formatDate(entry.logged_at)}
                  </span>
                  {entry.notes && <span style={styles.notes}>{entry.notes}</span>}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={styles.row}>
      <span style={styles.rowLabel}>{label}</span>
      <span style={styles.rowValue}>{children}</span>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return 'unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'unknown' : date.toLocaleString();
}

const styles: Record<string, CSSProperties> = {
  page: { minHeight: '100vh', backgroundColor: '#0f172a', color: '#e2e8f0', padding: '32px', boxSizing: 'border-box' },
  back: { marginBottom: '16px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#e2e8f0', cursor: 'pointer' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '20px' },
  title: { margin: 0, fontSize: '24px', color: '#93c5fd' },
  subtitle: { margin: '4px 0 0', color: '#94a3b8', fontSize: '14px' },
  status: { fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#fbbf24' },
  panel: { backgroundColor: '#131d2f', border: '1px solid #263449', borderRadius: '10px', padding: '18px', marginBottom: '16px' },
  sectionTitle: { margin: '0 0 12px', fontSize: '16px' },
  row: { display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '6px 0', borderBottom: '1px solid #1f2c3f' },
  rowLabel: { color: '#94a3b8', fontSize: '13px' },
  rowValue: { fontSize: '14px' },
  description: { marginTop: '12px', color: '#cbd5e1', lineHeight: 1.6 },
  muted: { color: '#94a3b8', fontSize: '13px' },
  mediaGrid: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  mediaLink: { display: 'flex', flexDirection: 'column', gap: '6px', color: '#94a3b8', fontSize: '12px', textDecoration: 'none' },
  mediaImage: { width: '160px', height: '110px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #334155' },
  actionGroup: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px', alignItems: 'center' },
  input: { padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#e2e8f0' },
  textarea: { width: '100%', minHeight: '80px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#e2e8f0', boxSizing: 'border-box', fontFamily: 'inherit' },
  primary: { padding: '10px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#2563eb', color: '#fff', cursor: 'pointer' },
  secondary: { padding: '10px 16px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#e2e8f0', cursor: 'pointer' },
  danger: { padding: '10px 16px', borderRadius: '8px', border: 'none', backgroundColor: '#dc2626', color: '#fff', cursor: 'pointer' },
  error: { padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(239,68,68,0.15)', color: '#fecaca', marginBottom: '16px' },
  notice: { padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(34,197,94,0.15)', color: '#bbf7d0', marginBottom: '16px' },
  empty: { padding: '32px', textAlign: 'center', color: '#94a3b8' },
  auditList: { display: 'grid', gap: '10px' },
  auditRow: { display: 'flex', flexDirection: 'column', gap: '2px', padding: '8px 0', borderBottom: '1px solid #1f2c3f', fontSize: '13px' },
  notes: { color: '#fbbf24' }
};
