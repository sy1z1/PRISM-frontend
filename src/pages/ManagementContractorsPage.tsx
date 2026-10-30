import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '../services/api';
import { getStoredUser } from '../config/roles';
import type { CSSProperties } from 'react';

interface LinkedGroup {
  link_id: string;
  status: string;
  group_id: string;
  name: string;
  group_code: string;
  group_type: string | null;
  specialty_category: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}

interface LinkedGroupsResponse {
  organizationId: string;
  groups: LinkedGroup[];
}

const statusColor = (status: string) =>
  status === 'ACTIVE' ? '#4ade80' : status === 'INACTIVE' ? '#94a3b8' : '#fbbf24';

export default function ManagementContractorsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = getStoredUser();
  const isSuperAdmin = user?.role === 'SuperAdmin';

  const [organizationId, setOrganizationId] = useState('');
  const [groupCode, setGroupCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const organizationsQuery = useQuery<{ organizations: Array<{ id: string; name: string }> }>({
    queryKey: ['organizations'],
    queryFn: () => fetchApi('/api/identity/organizations'),
    enabled: isSuperAdmin
  });

  useEffect(() => {
    if (isSuperAdmin && !organizationId && organizationsQuery.data?.organizations?.length) {
      setOrganizationId(organizationsQuery.data.organizations[0].id);
    }
  }, [isSuperAdmin, organizationId, organizationsQuery.data]);

  const linkedQuery = useQuery<LinkedGroupsResponse>({
    queryKey: ['linkedGroups', organizationId],
    queryFn: () =>
      fetchApi(
        `/api/maintenance-groups/linked${
          organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ''
        }`
      ),
    enabled: !isSuperAdmin || Boolean(organizationId),
    staleTime: 30_000
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['linkedGroups'] });

  const linkGroup = async () => {
    if (!groupCode.trim() || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fetchApi('/api/maintenance-groups/link', {
        method: 'POST',
        body: JSON.stringify({
          groupCode: groupCode.trim(),
          ...(isSuperAdmin ? { organizationId } : {})
        })
      });
      setGroupCode('');
      setNotice('Contractor group linked.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to link the group.');
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (group: LinkedGroup) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const status = group.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await fetchApi(`/api/maintenance-groups/${encodeURIComponent(group.group_id)}/link`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          ...(isSuperAdmin ? { organizationId } : {})
        })
      });
      setNotice(`${group.name} is now ${status}.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update the group link.');
    } finally {
      setBusy(false);
    }
  };

  const groups = linkedQuery.data?.groups || [];

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <button type="button" style={styles.back} onClick={() => navigate('/management/dashboard')}>
            ← Back to map
          </button>
          <h1 style={styles.title}>Contracted maintenance groups</h1>
          <p style={styles.subtitle}>
            Link a contractor by its group code. Inactive groups cannot be assigned new tickets and their
            supervisors lose access to this organization&apos;s tickets.
          </p>
        </div>
      </header>

      <section style={styles.linkBox}>
        {isSuperAdmin && (
          <label style={styles.field}>
            <span style={styles.label}>Organization</span>
            <select
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
              style={styles.input}
              disabled={busy}
            >
              {(organizationsQuery.data?.organizations || []).map((organization) => (
                <option key={organization.id} value={organization.id}>{organization.name}</option>
              ))}
            </select>
          </label>
        )}
        <label style={styles.field}>
          <span style={styles.label}>Group code</span>
          <input
            value={groupCode}
            onChange={(event) => setGroupCode(event.target.value)}
            placeholder="e.g. GRP-PAINT-101"
            style={styles.input}
            disabled={busy || (isSuperAdmin && !organizationId)}
          />
        </label>
        <button
          type="button"
          style={styles.primary}
          onClick={() => void linkGroup()}
          disabled={busy || (isSuperAdmin && !organizationId)}
        >
          {busy ? 'Working…' : 'Link group'}
        </button>
      </section>

      {error && <div style={styles.error} role="alert">{error}</div>}
      {notice && <div style={styles.notice} role="status">{notice}</div>}
      {linkedQuery.isError && (
        <div style={styles.error} role="alert">Could not load linked groups.</div>
      )}

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Group</th>
              <th style={styles.th}>Code</th>
              <th style={styles.th}>Type</th>
              <th style={styles.th}>Specialty</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.group_id}>
                <td style={styles.td}>
                  <strong>{group.name}</strong>
                  {group.contact_email ? <div style={styles.muted}>{group.contact_email}</div> : null}
                </td>
                <td style={styles.td}>{group.group_code}</td>
                <td style={styles.td}>{group.group_type || '—'}</td>
                <td style={styles.td}>{group.specialty_category || '—'}</td>
                <td style={styles.td}>
                  <span style={{ color: statusColor(group.status), fontWeight: 600 }}>{group.status}</span>
                </td>
                <td style={styles.td}>
                  <button
                    type="button"
                    style={styles.toggle}
                    onClick={() => void toggleStatus(group)}
                    disabled={busy}
                  >
                    {group.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!linkedQuery.isLoading && groups.length === 0 && (
          <div style={styles.empty}>No contractor groups linked yet.</div>
        )}
      </div>
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
  back: { background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, marginBottom: 12 },
  title: { margin: 0, fontSize: 28, color: '#f8fafc' },
  subtitle: { margin: '8px 0 0', color: '#94a3b8', fontSize: 13, maxWidth: 720, lineHeight: 1.5 },
  linkBox: { display: 'flex', gap: 12, alignItems: 'flex-end', margin: '24px 0 16px', flexWrap: 'wrap' },
  field: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 260 },
  label: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' },
  input: {
    background: 'rgba(15,23,42,0.9)',
    border: '1px solid rgba(148,163,184,0.25)',
    color: '#e2e8f0',
    borderRadius: 10,
    padding: '9px 11px',
    outline: 'none'
  },
  primary: {
    background: '#2563eb',
    border: 'none',
    color: '#fff',
    padding: '10px 16px',
    borderRadius: 10,
    cursor: 'pointer',
    fontWeight: 600
  },
  tableWrap: { border: '1px solid rgba(148,163,184,0.15)', borderRadius: 14, overflow: 'hidden', background: 'rgba(15,23,42,0.5)' },
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
  muted: { color: '#64748b', fontSize: 12, marginTop: 3 },
  empty: { padding: 28, textAlign: 'center', color: '#64748b' },
  toggle: {
    background: 'rgba(148,163,184,0.12)',
    border: '1px solid rgba(148,163,184,0.25)',
    color: '#e2e8f0',
    padding: '7px 12px',
    borderRadius: 8,
    cursor: 'pointer'
  },
  error: {
    background: 'rgba(248,113,113,0.12)',
    border: '1px solid rgba(248,113,113,0.3)',
    color: '#fca5a5',
    padding: '10px 14px',
    borderRadius: 10,
    marginBottom: 12
  },
  notice: {
    background: 'rgba(74,222,128,0.1)',
    border: '1px solid rgba(74,222,128,0.3)',
    color: '#86efac',
    padding: '10px 14px',
    borderRadius: 10,
    marginBottom: 12
  }
};
