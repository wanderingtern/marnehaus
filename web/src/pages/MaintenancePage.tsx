import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const STATUS_COLOR: Record<string, string> = {
  OPEN: '#3b82f6',
  IN_PROGRESS: '#f59e0b',
  RESOLVED: '#22c55e',
};

const NEXT_STATUS: Record<string, string> = {
  OPEN: 'IN_PROGRESS',
  IN_PROGRESS: 'RESOLVED',
};

export default function MaintenancePage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = filter ? `/maintenance?status=${filter}` : '/maintenance';
    api.get(url).then((data: any[]) => { setRequests(data); setLoading(false); });
  }, [filter]);

  async function advance(req: any) {
    const next = NEXT_STATUS[req.status];
    if (!next) return;
    const updated = await api.patch(`/maintenance/${req.id}`, { status: next });
    setRequests(prev => prev.map((r: any) => r.id === req.id ? updated : r));
  }

  const badge = (status: string) => (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, background: (STATUS_COLOR[status] ?? '#94a3b8') + '22', color: STATUS_COLOR[status] ?? '#94a3b8' }}>
      {status.replace('_', ' ')}
    </span>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Maintenance Requests</h1>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.9rem' }}
        >
          <option value="">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
        </select>
      </div>

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Loading…</p>
      ) : requests.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '10px', padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
          No maintenance requests found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {requests.map((req: any) => (
            <div key={req.id} style={{ background: '#fff', borderRadius: '10px', padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <span style={{ fontWeight: 700, color: '#0f172a', marginRight: '10px' }}>{req.category}</span>
                  {badge(req.status)}
                </div>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{new Date(req.createdAt).toLocaleDateString()}</span>
              </div>
              <p style={{ margin: '0 0 6px', color: '#475569', fontSize: '0.9rem' }}>{req.description}</p>
              <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '10px' }}>
                <strong>Tenant:</strong> {req.tenant?.firstName} {req.tenant?.lastName} ({req.tenant?.email}) &nbsp;·&nbsp;
                <strong>Unit:</strong> {req.unit?.unitNumber} — {req.unit?.property?.name}
              </div>
              {NEXT_STATUS[req.status] && (
                <button
                  onClick={() => advance(req)}
                  style={{ padding: '6px 16px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Mark {NEXT_STATUS[req.status]?.replace('_', ' ')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
