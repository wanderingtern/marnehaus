import { useEffect, useState } from 'react';
import { api, Invoice } from '../lib/api';

type InvoiceStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';

const STATUS_COLORS: Record<InvoiceStatus, React.CSSProperties> = {
  PENDING:   { background: '#fef9c3', color: '#854d0e' },
  PAID:      { background: '#dcfce7', color: '#166534' },
  OVERDUE:   { background: '#fee2e2', color: '#991b1b' },
  CANCELLED: { background: '#f1f5f9', color: '#475569' },
};

function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span style={{
      ...STATUS_COLORS[status],
      padding: '2px 10px',
      borderRadius: '999px',
      fontSize: '0.78rem',
      fontWeight: 600,
    }}>
      {status}
    </span>
  );
}

interface StripeStatus {
  connected: boolean;
  onboarded: boolean;
  chargesEnabled?: boolean;
}

interface CreateForm {
  unitId: string;
  tenantId: string;
  amountDollars: string;
  dueDate: string;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateForm>({ unitId: '', tenantId: '', amountDollars: '', dueDate: '' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Invoice[]>('/invoices'),
      api.get<StripeStatus>('/stripe/connect-status'),
    ]).then(([inv, stripe]) => {
      setInvoices(inv);
      setStripeStatus(stripe);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function handleConnectStripe() {
    try {
      const { url } = await api.post<{ url: string }>('/stripe/connect-onboard', {});
      window.location.href = url;
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setCreating(true);
    try {
      const amountCents = Math.round(parseFloat(form.amountDollars) * 100);
      if (!amountCents || amountCents <= 0) throw new Error('Invalid amount');

      const invoice = await api.post<Invoice>('/invoices', {
        unitId: form.unitId,
        tenantId: form.tenantId,
        amountCents,
        dueDate: new Date(form.dueDate).toISOString(),
      });

      setInvoices(prev => [invoice, ...prev]);
      setShowForm(false);
      setForm({ unitId: '', tenantId: '', amountDollars: '', dueDate: '' });
      setSuccess('Invoice created and email sent to tenant.');
    } catch (err: any) {
      setError(err.message ?? 'Failed to create invoice');
    } finally {
      setCreating(false);
    }
  }

  async function handleCancel(invoiceId: string) {
    if (!confirm('Cancel this invoice?')) return;
    try {
      const updated = await api.patch<Invoice>(`/invoices/${invoiceId}/cancel`, {});
      setInvoices(prev => prev.map(i => i.id === invoiceId ? updated : i));
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (loading) return <div style={styles.loading}>Loading…</div>;

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>Invoices</h1>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {stripeStatus && !stripeStatus.onboarded && (
            <button onClick={handleConnectStripe} style={styles.btnSecondary}>
              Connect Stripe →
            </button>
          )}
          {stripeStatus?.onboarded && (
            <span style={styles.connected}>Stripe Connected ✓</span>
          )}
          <button
            onClick={() => setShowForm(v => !v)}
            style={styles.btnPrimary}
            disabled={!stripeStatus?.onboarded}
            title={!stripeStatus?.onboarded ? 'Connect Stripe first' : undefined}
          >
            + New Invoice
          </button>
        </div>
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}
      {success && <div style={styles.successBanner}>{success}</div>}

      {showForm && (
        <form onSubmit={handleCreateInvoice} style={styles.form}>
          <h3 style={{ margin: '0 0 1rem' }}>Create Invoice</h3>
          <div style={styles.formGrid}>
            <label style={styles.label}>
              Unit ID
              <input
                style={styles.input}
                value={form.unitId}
                onChange={e => setForm(f => ({ ...f, unitId: e.target.value }))}
                placeholder="unit_..."
                required
              />
            </label>
            <label style={styles.label}>
              Tenant ID
              <input
                style={styles.input}
                value={form.tenantId}
                onChange={e => setForm(f => ({ ...f, tenantId: e.target.value }))}
                placeholder="tenant_..."
                required
              />
            </label>
            <label style={styles.label}>
              Amount ($)
              <input
                style={styles.input}
                type="number"
                min="0.50"
                step="0.01"
                value={form.amountDollars}
                onChange={e => setForm(f => ({ ...f, amountDollars: e.target.value }))}
                placeholder="1200.00"
                required
              />
            </label>
            <label style={styles.label}>
              Due Date
              <input
                style={styles.input}
                type="date"
                value={form.dueDate}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                required
              />
            </label>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="submit" style={styles.btnPrimary} disabled={creating}>
              {creating ? 'Creating…' : 'Create & Send Email'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} style={styles.btnSecondary}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {invoices.length === 0 ? (
        <div style={styles.empty}>No invoices yet. Create one to get started.</div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              {['Tenant', 'Unit / Property', 'Amount', 'Due Date', 'Status', 'Actions'].map(h => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv.id} style={styles.tr}>
                <td style={styles.td}>
                  {inv.tenant ? `${inv.tenant.firstName} ${inv.tenant.lastName}` : '—'}
                  {inv.tenant && <div style={styles.subtext}>{inv.tenant.email}</div>}
                </td>
                <td style={styles.td}>
                  {inv.unit?.unitNumber ?? '—'}
                  {inv.unit?.property && (
                    <div style={styles.subtext}>{inv.unit.property.name ?? inv.unit.property.address}</div>
                  )}
                </td>
                <td style={styles.td}>${(inv.amountCents / 100).toFixed(2)}</td>
                <td style={styles.td}>
                  {new Date(inv.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
                <td style={styles.td}>
                  <StatusBadge status={inv.status as InvoiceStatus} />
                </td>
                <td style={styles.td}>
                  {inv.stripePaymentUrl && inv.status === 'PENDING' && (
                    <a href={inv.stripePaymentUrl} target="_blank" rel="noreferrer" style={styles.link}>
                      Payment Link
                    </a>
                  )}
                  {inv.status === 'PENDING' && (
                    <button
                      onClick={() => handleCancel(inv.id)}
                      style={{ ...styles.link, background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', marginLeft: '0.5rem' }}
                    >
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  title: { margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' },
  btnPrimary: {
    background: '#0f172a', color: '#fff', border: 'none',
    padding: '8px 20px', borderRadius: '6px', cursor: 'pointer',
    fontSize: '0.9rem', fontWeight: 600,
  },
  btnSecondary: {
    background: '#fff', color: '#0f172a',
    border: '1px solid #e2e8f0',
    padding: '8px 20px', borderRadius: '6px', cursor: 'pointer',
    fontSize: '0.9rem', fontWeight: 600,
  },
  connected: { color: '#166534', fontWeight: 600, fontSize: '0.85rem' },
  form: {
    background: '#f8fafc', border: '1px solid #e2e8f0',
    borderRadius: '8px', padding: '1.5rem', marginBottom: '1.5rem',
  },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
  label: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', fontWeight: 600, color: '#374151' },
  input: {
    border: '1px solid #e2e8f0', borderRadius: '6px',
    padding: '8px 12px', fontSize: '0.9rem', marginTop: '2px',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left', padding: '10px 12px', fontSize: '0.78rem',
    fontWeight: 600, color: '#64748b', textTransform: 'uppercase',
    borderBottom: '2px solid #e2e8f0',
  },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '12px', fontSize: '0.9rem', color: '#1e293b', verticalAlign: 'top' },
  subtext: { fontSize: '0.78rem', color: '#64748b', marginTop: '2px' },
  link: { color: '#2563eb', textDecoration: 'none', fontSize: '0.85rem' },
  empty: { textAlign: 'center', padding: '3rem', color: '#94a3b8' },
  loading: { padding: '4rem', textAlign: 'center', color: '#94a3b8' },
  errorBanner: {
    background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca',
    borderRadius: '6px', padding: '10px 16px', marginBottom: '1rem', fontSize: '0.9rem',
  },
  successBanner: {
    background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0',
    borderRadius: '6px', padding: '10px 16px', marginBottom: '1rem', fontSize: '0.9rem',
  },
};
