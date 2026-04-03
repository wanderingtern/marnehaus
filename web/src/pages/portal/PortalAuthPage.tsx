import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { portalApi } from '../../lib/portalApi';

export default function PortalAuthPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('Invalid or missing token.');
      return;
    }

    portalApi.verifyToken(token)
      .then(({ sessionToken }) => {
        sessionStorage.setItem('tenantToken', sessionToken);
        navigate('/portal', { replace: true });
      })
      .catch(err => {
        setError(err.message ?? 'Login failed. The link may have expired.');
      });
  }, []);

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ background: '#fff', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ margin: '0 0 8px', color: '#dc2626' }}>Login Failed</h2>
          <p style={{ color: '#64748b' }}>{error}</p>
          <a href="/portal/login" style={{ color: '#0f172a', fontWeight: 600 }}>Request a new link</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <p style={{ color: '#64748b' }}>Logging you in…</p>
    </div>
  );
}
