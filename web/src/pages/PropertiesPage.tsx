import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, Property } from '../lib/api';

interface PropertyForm {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

const emptyForm: PropertyForm = { name: '', address: '', city: '', state: '', zip: '' };

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PropertyForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const data = await api.get<Property[]>('/properties');
      setProperties(data);
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
      const created = await api.post<Property>('/properties', form);
      setProperties(prev => [created, ...prev]);
      setShowForm(false);
      setForm(emptyForm);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p style={s.muted}>Loading properties…</p>;
  if (error) return <p style={s.error}>{error}</p>;

  return (
    <div>
      <div style={s.header}>
        <h1 style={s.h1}>Properties</h1>
        <button style={s.btnPrimary} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Property'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={s.card}>
          <h2 style={s.h2}>New Property</h2>
          <div style={s.grid2}>
            <label style={s.label}>
              Name
              <input style={s.input} required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Sunrise Apts" />
            </label>
            <label style={s.label}>
              Address
              <input style={s.input} required value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="123 Main St" />
            </label>
            <label style={s.label}>
              City
              <input style={s.input} required value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Austin" />
            </label>
            <label style={s.label}>
              State (2-letter)
              <input style={s.input} required maxLength={2} value={form.state} onChange={e => setForm({ ...form, state: e.target.value.toUpperCase() })} placeholder="TX" />
            </label>
            <label style={s.label}>
              ZIP
              <input style={s.input} required value={form.zip} onChange={e => setForm({ ...form, zip: e.target.value })} placeholder="78701" />
            </label>
          </div>
          <button type="submit" style={s.btnPrimary} disabled={saving}>
            {saving ? 'Saving…' : 'Create Property'}
          </button>
        </form>
      )}

      {properties.length === 0 ? (
        <div style={s.empty}>
          <p>No properties yet. Add your first property above.</p>
        </div>
      ) : (
        <div style={s.grid}>
          {properties.map(p => (
            <Link key={p.id} to={`/properties/${p.id}`} style={s.propertyCard}>
              <div style={s.propertyName}>{p.name}</div>
              <div style={s.propertyAddr}>{p.address}, {p.city}, {p.state} {p.zip}</div>
              <div style={s.unitCount}>
                {p.units?.length ?? 0} unit{(p.units?.length ?? 0) !== 1 ? 's' : ''}
              </div>
            </Link>
          ))}
        </div>
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
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' },
  propertyCard: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem', textDecoration: 'none', color: 'inherit', display: 'block' },
  propertyName: { fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem' },
  propertyAddr: { color: '#64748b', fontSize: '0.875rem', marginBottom: '0.5rem' },
  unitCount: { fontSize: '0.8rem', color: '#94a3b8' },
  empty: { textAlign: 'center', padding: '3rem', color: '#94a3b8', background: '#fff', borderRadius: '10px', border: '1px dashed #cbd5e1' },
  muted: { color: '#94a3b8', padding: '2rem 0' },
  error: { color: '#ef4444', padding: '1rem' },
};
