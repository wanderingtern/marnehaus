import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, Property, Unit } from '../lib/api';

const STATUS_COLORS: Record<string, string> = {
  VACANT: '#d1fae5',
  OCCUPIED: '#dbeafe',
  MAINTENANCE: '#fef3c7',
};

const STATUS_TEXT: Record<string, string> = {
  VACANT: '#065f46',
  OCCUPIED: '#1e40af',
  MAINTENANCE: '#92400e',
};

interface UnitForm {
  unitNumber: string;
  type: string;
  monthlyRent: string;
  bedrooms: string;
  bathrooms: string;
  sqft: string;
}

const emptyUnitForm: UnitForm = { unitNumber: '', type: '1BR', monthlyRent: '', bedrooms: '1', bathrooms: '1', sqft: '' };

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [unitForm, setUnitForm] = useState<UnitForm>(emptyUnitForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const data = await api.get<Property>(`/properties/${id}`);
      setProperty(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function handleAddUnit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    try {
      await api.post<Unit>('/units', {
        propertyId: id,
        unitNumber: unitForm.unitNumber,
        type: unitForm.type,
        monthlyRent: parseFloat(unitForm.monthlyRent),
        bedrooms: parseInt(unitForm.bedrooms),
        bathrooms: parseFloat(unitForm.bathrooms),
        sqft: unitForm.sqft ? parseInt(unitForm.sqft) : undefined,
      });
      setShowUnitForm(false);
      setUnitForm(emptyUnitForm);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p style={s.muted}>Loading…</p>;
  if (error) return <p style={s.error}>{error}</p>;
  if (!property) return <p style={s.error}>Property not found</p>;

  const units = (property as any).units as Unit[] ?? [];

  return (
    <div>
      <Link to="/properties" style={s.back}>← Properties</Link>
      <div style={s.header}>
        <div>
          <h1 style={s.h1}>{property.name}</h1>
          <p style={s.addr}>{property.address}, {property.city}, {property.state} {property.zip}</p>
        </div>
        <button style={s.btnPrimary} onClick={() => setShowUnitForm(!showUnitForm)}>
          {showUnitForm ? 'Cancel' : '+ Add Unit'}
        </button>
      </div>

      {showUnitForm && (
        <form onSubmit={handleAddUnit} style={s.card}>
          <h2 style={s.h2}>New Unit</h2>
          <div style={s.grid3}>
            <label style={s.label}>
              Unit #
              <input style={s.input} required value={unitForm.unitNumber} onChange={e => setUnitForm({ ...unitForm, unitNumber: e.target.value })} placeholder="1A" />
            </label>
            <label style={s.label}>
              Type
              <select style={s.input} value={unitForm.type} onChange={e => setUnitForm({ ...unitForm, type: e.target.value })}>
                {['Studio', '1BR', '2BR', '3BR', '4BR'].map(t => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label style={s.label}>
              Monthly Rent ($)
              <input style={s.input} type="number" required min="0" value={unitForm.monthlyRent} onChange={e => setUnitForm({ ...unitForm, monthlyRent: e.target.value })} placeholder="1500" />
            </label>
            <label style={s.label}>
              Bedrooms
              <input style={s.input} type="number" min="0" value={unitForm.bedrooms} onChange={e => setUnitForm({ ...unitForm, bedrooms: e.target.value })} />
            </label>
            <label style={s.label}>
              Bathrooms
              <input style={s.input} type="number" min="0" step="0.5" value={unitForm.bathrooms} onChange={e => setUnitForm({ ...unitForm, bathrooms: e.target.value })} />
            </label>
            <label style={s.label}>
              Sq Ft
              <input style={s.input} type="number" min="0" value={unitForm.sqft} onChange={e => setUnitForm({ ...unitForm, sqft: e.target.value })} placeholder="optional" />
            </label>
          </div>
          <button type="submit" style={s.btnPrimary} disabled={saving}>{saving ? 'Saving…' : 'Add Unit'}</button>
        </form>
      )}

      <h2 style={{ ...s.h2, marginTop: '1.5rem' }}>Units ({units.length})</h2>
      {units.length === 0 ? (
        <div style={s.empty}>No units yet. Add one above.</div>
      ) : (
        <table style={s.table}>
          <thead>
            <tr>
              {['Unit', 'Type', 'Rent', 'Bed/Bath', 'Status', 'Tenants'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {units.map(u => (
              <tr key={u.id}>
                <td style={s.td}><strong>{u.unitNumber}</strong></td>
                <td style={s.td}>{u.type}</td>
                <td style={s.td}>${Number(u.monthlyRent).toLocaleString()}/mo</td>
                <td style={s.td}>{u.bedrooms}bd / {Number(u.bathrooms)}ba</td>
                <td style={s.td}>
                  <span style={{ ...s.badge, background: STATUS_COLORS[u.status], color: STATUS_TEXT[u.status] }}>
                    {u.status}
                  </span>
                </td>
                <td style={s.td}>{(u as any).tenants?.length ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  back: { color: '#2563eb', textDecoration: 'none', fontSize: '0.875rem', display: 'inline-block', marginBottom: '1rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' },
  h1: { fontSize: '1.75rem', fontWeight: 700 },
  h2: { fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' },
  addr: { color: '#64748b', marginTop: '0.25rem' },
  btnPrimary: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.5rem 1.25rem', cursor: 'pointer', fontWeight: 500 },
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.5rem', marginBottom: '1.5rem' },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' },
  label: { display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.875rem', fontWeight: 500 },
  input: { border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.9rem' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0' },
  th: { padding: '0.75rem 1rem', textAlign: 'left', background: '#f8fafc', fontSize: '0.8rem', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' },
  td: { padding: '0.75rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid #f1f5f9' },
  badge: { display: 'inline-block', borderRadius: '999px', padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 500 },
  empty: { textAlign: 'center', padding: '2rem', color: '#94a3b8', background: '#fff', borderRadius: '10px', border: '1px dashed #cbd5e1' },
  muted: { color: '#94a3b8', padding: '2rem 0' },
  error: { color: '#ef4444', padding: '1rem' },
};
