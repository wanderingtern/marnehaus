import { useState } from 'react';
import { portalApi } from '../../lib/portalApi';

export default function PortalLoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await portalApi.requestLink(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ background: '#fff', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>📬</div>
          <h2 style={{ margin: '0 0 8px', color: '#0f172a' }}>Check your email</h2>
          <p style={{ color: '#64748b', margin: 0 }}>
            We sent a login link to <strong>{email}</strong>. It expires in 1 hour.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ background: '#fff', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', maxWidth: '400px', width: '100%' }}>
        <h2 style={{ margin: '0 0 8px', color: '#0f172a' }}>Tenant Portal</h2>
        <p style={{ color: '#64748b', marginBottom: '24px', marginTop: 0 }}>Enter your email to receive a login link.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            required
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '1rem', boxSizing: 'border-box', marginBottom: '12px' }}
          />
          {error && <p style={{ color: '#dc2626', fontSize: '0.875rem', marginBottom: '8px' }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', padding: '10px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Sending…' : 'Send Login Link'}
          </button>
        </form>
      </div>
    </div>
  );
}
