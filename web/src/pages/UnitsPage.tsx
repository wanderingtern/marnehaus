import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, Unit } from '../lib/api';

const STATUS_COLORS: Record<string, string> = {
  VACANT: '#d1fae5', OCCUPIED: '#dbeafe', MAINTENANCE: '#fef3c7',
};
const STATUS_TEXT: Record<string, string> = {
  VACANT: '#065f46', OCCUPIED: '#1e40af', MAINTENANCE: '#92400e',
};

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Unit[]>('/units')
      .then(setUnits)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={s.muted}>Loading units…</p>;
  if (error) return <p style={s.error}>{error}</p>;

  return (
    <div>
      <h1 style={s.h1}>All Units</h1>
      {units.length === 0 ? (
        <div style={s.empty}>
          No units found. <Link to="/properties">Add units from a property page.</Link>
        </div>
      ) : (
        <table style={s.table}>
          <thead>
            <tr>
              {['Property', 'Unit', 'Type', 'Rent', 'Status', 'Tenants'].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {units.map(u => (
              <tr key={u.id}>
                <td style={s.td}>
                  <Link to={`/properties/${u.property?.id}`} style={s.link}>
                    {u.property?.name}
                  </Link>
                </td>
                <td style={s.td}><strong>{u.unitNumber}</strong></td>
                <td style={s.td}>{u.type}</td>
                <td style={s.td}>${Number(u.monthlyRent).toLocaleString()}/mo</td>
                <td style={s.td}>
                  <span style={{ ...s.badge, background: STATUS_COLORS[u.status], color: STATUS_TEXT[u.status] }}>
                    {u.status}
                  </span>
                </td>
                <td style={s.td}>{u.tenants?.length ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  h1: { fontSize: '1.75rem', fontWeight: 700, marginBottom: '1.5rem' },
  table: { width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0' },
  th: { padding: '0.75rem 1rem', textAlign: 'left', background: '#f8fafc', fontSize: '0.8rem', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e2e8f0' },
  td: { padding: '0.75rem 1rem', fontSize: '0.875rem', borderBottom: '1px solid #f1f5f9' },
  badge: { display: 'inline-block', borderRadius: '999px', padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 500 },
  link: { color: '#2563eb', textDecoration: 'none' },
  empty: { textAlign: 'center', padding: '3rem', color: '#94a3b8', background: '#fff', borderRadius: '10px', border: '1px dashed #cbd5e1' },
  muted: { color: '#94a3b8', padding: '2rem 0' },
  error: { color: '#ef4444', padding: '1rem' },
};
