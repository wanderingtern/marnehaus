import { useState, useEffect } from 'react';
import { api, Tenant, Unit } from '../lib/api';

interface TenantForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  unitId: string;
}

const emptyForm: TenantForm = { firstName: '', lastName: '', email: '', phone: '', unitId: '' };

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TenantForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [ts, us] = await Promise.all([
        api.get<Tenant[]>('/tenants'),
        api.get<Unit[]>('/units'),
      ]);
      setTenants(ts);
      setUnits(us);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await api.post<Tenant>('/tenants', {
        ...form,
        unitId: form.unitId || undefined,
        phone: form.phone || undefined,
      });
      setTenants(prev => [created, ...prev]);
      setShowForm(false);
      setForm(emptyForm);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p style={s.muted}>Loading tenants…</p>;
  if (error) return <p style={s.error}>{error}</p>;

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.h1}>Tenants</h1>
        <button style={s.btnPrimary} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Tenant'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={s.card}>
          <h2 style={s.h2}>New Tenant</h2>
          <div style={s.grid2}>
            <label style={s.label}>
              First Name
              <input style={s.input} required value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
            </label>
            <label style={s.label}>
              Last Name
              <input style={s.input} required value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
            </label>
            <label style={s.label}>
              Email
              <input style={s.input} type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </label>
            <label style={s.label}>
              Phone
              <input style={s.input} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="optional" />
            </label>
            <label style={s.label}>
              Assign to Unit
              <select style={s.input} value={form.unitId} onChange={e => setForm({ ...form, unitId: e.target.value })}>
                <option value="">— Unassigned —</option>
                {units.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.property?.name} — Unit {u.unitNumber} ({u.type})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="submit" style={s.btnPrimary} disabled={saving}>{saving ? 'Saving…' : 'Add Tenant'}</button>
        </form>
      )}

      {tenants.length === 0 ? (
        <div style={s.empty}>No tenants yet.</div>
      ) : (
        <table style={s.table}>
          <thead>
            <tr>
              {['Name', 'Email', 'Phone', 'Unit', 'Active Lease'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tenants.map(t => (
              <tr key={t.id}>
                <td style={s.td}>{t.firstName} {t.lastName}</td>
                <td style={s.td}>{t.email}</td>
                <td style={s.td}>{t.phone ?? '—'}</td>
                <td style={s.td}>
                  {t.unit ? `${t.unit.property?.name} — ${t.unit.unitNumber}` : '—'}
                </td>
                <td style={s.td}>
                  {t.leases && t.leases.length > 0 ? (
                    <span style={s.activeBadge}>
                      Until {new Date(t.leases[0].endDate).toLocaleDateString()}
                    </span>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  h1: { fontSize: '1.75rem', fontWeight: 700 },
  h2: { fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' },
  btnPrimary: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.25rem', cursor: 'pointer', fontWeight: 500 },
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.5rem', marginBottom: '1.5rem' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' },
  label: { display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.875rem', fontWeight: 500 },
  input: { border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.9rem' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0' },
  th: { padding: '0.75rem 1rem', textAlign: 'left', background: '#f8fafc', fontSize: '0.8rem', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' },
  td: { padding: '0.75rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid #f1f5f9' },
  activeBadge: { background: '#d1fae5', color: '#065f46', borderRadius: '999px', padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 500 },
  empty: { textAlign: 'center', padding: '3rem', color: '#94a3b8', background: '#fff', borderRadius: '10px', border: '1px dashed #cbd5e1' },
  muted: { color: '#94a3b8', padding: '2rem 0' },
  error: { color: '#ef4444', padding: '1rem' },
};
