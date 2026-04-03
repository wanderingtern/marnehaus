import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { portalApi } from '../../lib/portalApi';

const CATEGORIES = ['Plumbing', 'Electrical', 'HVAC', 'Appliance', 'Structural', 'Other'];

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#f59e0b',
  PAID: '#22c55e',
  OVERDUE: '#ef4444',
  CANCELLED: '#94a3b8',
  OPEN: '#3b82f6',
  IN_PROGRESS: '#f59e0b',
  RESOLVED: '#22c55e',
};

export default function PortalDashboardPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'invoices' | 'maintenance' | 'profile'>('invoices');
  const [me, setMe] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [form, setForm] = useState({ category: CATEGORIES[0], description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState('');

  useEffect(() => {
    const token = sessionStorage.getItem('tenantToken');
    if (!token) { navigate('/portal/login', { replace: true }); return; }

    portalApi.getMe().then(setMe).catch(() => {
      sessionStorage.removeItem('tenantToken');
      navigate('/portal/login', { replace: true });
    });
    portalApi.getInvoices().then(setInvoices);
    portalApi.getMaintenance().then(setMaintenance);
  }, []);

  async function submitMaintenanceRequest(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormMsg('');
    try {
      const req = await portalApi.submitMaintenance(form.category, form.description);
      setMaintenance(prev => [req, ...prev]);
      setForm({ category: CATEGORIES[0], description: '' });
      setFormMsg('Request submitted!');
    } catch (err: any) {
      setFormMsg(err.message ?? 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }

  function logout() {
    sessionStorage.removeItem('tenantToken');
    navigate('/portal/login', { replace: true });
  }

  const tabStyle = (active: boolean) => ({
    padding: '8px 20px',
    border: 'none',
    background: active ? '#0f172a' : 'transparent',
    color: active ? '#fff' : '#64748b',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: active ? 600 : 400,
    fontSize: '0.9rem',
  });

  const badgeStyle = (status: string) => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 600,
    background: STATUS_COLOR[status] + '22',
    color: STATUS_COLOR[status] ?? '#64748b',
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ background: '#0f172a', color: '#fff', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>MarneHaus Tenant Portal</div>
          {me && <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{me.firstName} {me.lastName} — {me.unit?.property?.name ?? 'No unit assigned'}</div>}
        </div>
        <button onClick={logout} style={{ background: 'transparent', border: '1px solid #475569', color: '#94a3b8', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer' }}>
          Log out
        </button>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: '#f1f5f9', padding: '4px', borderRadius: '8px', width: 'fit-content' }}>
          <button style={tabStyle(tab === 'invoices')} onClick={() => setTab('invoices')}>Invoices</button>
          <button style={tabStyle(tab === 'maintenance')} onClick={() => setTab('maintenance')}>Maintenance</button>
          <button style={tabStyle(tab === 'profile')} onClick={() => setTab('profile')}>Profile</button>
        </div>

        {/* Invoices */}
        {tab === 'invoices' && (
          <div style={{ background: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>Invoices</div>
            {invoices.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No invoices yet.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Due Date', 'Amount', 'Status', 'Action'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv: any) => (
                    <tr key={inv.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontSize: '0.9rem' }}>{new Date(inv.dueDate).toLocaleDateString()}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>${(inv.amountCents / 100).toFixed(2)}</td>
                      <td style={{ padding: '12px 16px' }}><span style={badgeStyle(inv.status)}>{inv.status}</span></td>
                      <td style={{ padding: '12px 16px' }}>
                        {inv.stripePaymentUrl && inv.status === 'PENDING' && (
                          <a href={inv.stripePaymentUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#0f172a', fontWeight: 600, fontSize: '0.85rem' }}>Pay Now →</a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Maintenance */}
        {tab === 'maintenance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Submit form */}
            <div style={{ background: '#fff', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <h3 style={{ margin: '0 0 16px', color: '#0f172a' }}>Submit a Request</h3>
              <form onSubmit={submitMaintenanceRequest} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  style={{ padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.95rem' }}
                >
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
                <textarea
                  required
                  minLength={10}
                  placeholder="Describe the issue…"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  style={{ padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.95rem', resize: 'vertical' }}
                />
                {formMsg && <p style={{ margin: 0, fontSize: '0.875rem', color: formMsg === 'Request submitted!' ? '#22c55e' : '#dc2626' }}>{formMsg}</p>}
                <button type="submit" disabled={submitting} style={{ alignSelf: 'flex-start', padding: '9px 20px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>
                  {submitting ? 'Submitting…' : 'Submit Request'}
                </button>
              </form>
            </div>

            {/* Request history */}
            <div style={{ background: '#fff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 600 }}>Your Requests</div>
              {maintenance.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No requests yet.</div>
              ) : maintenance.map((req: any) => (
                <div key={req.id} style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{req.category}</span>
                    <span style={badgeStyle(req.status)}>{req.status.replace('_', ' ')}</span>
                  </div>
                  <p style={{ margin: '0 0 4px', color: '#475569', fontSize: '0.9rem' }}>{req.description}</p>
                  {req.landlordNote && <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', fontStyle: 'italic' }}>Note: {req.landlordNote}</p>}
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{new Date(req.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Profile */}
        {tab === 'profile' && me && (
          <div style={{ background: '#fff', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <h3 style={{ margin: '0 0 16px', color: '#0f172a' }}>Your Profile</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[['Name', `${me.firstName} ${me.lastName}`], ['Email', me.email], ['Phone', me.phone ?? '—'], ['Unit', me.unit?.unitNumber ?? '—'], ['Property', me.unit?.property?.name ?? '—'], ['Address', me.unit?.property?.address ? `${me.unit.property.address}, ${me.unit.property.city}, ${me.unit.property.state}` : '—']].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '2px' }}>{label}</div>
                  <div style={{ fontWeight: 500, color: '#0f172a' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
