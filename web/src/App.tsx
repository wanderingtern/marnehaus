import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { SignIn, SignUp, useAuth, UserButton } from '@clerk/clerk-react';
import PropertiesPage from './pages/PropertiesPage';
import PropertyDetailPage from './pages/PropertyDetailPage';
import UnitsPage from './pages/UnitsPage';
import TenantsPage from './pages/TenantsPage';
import InvoicesPage from './pages/InvoicesPage';
import MaintenancePage from './pages/MaintenancePage';
import PortalLoginPage from './pages/portal/PortalLoginPage';
import PortalAuthPage from './pages/portal/PortalAuthPage';
import PortalDashboardPage from './pages/portal/PortalDashboardPage';

function Nav() {
  return (
    <nav style={styles.nav}>
      <Link to="/properties" style={styles.brand}>MarneHaus</Link>
      <div style={styles.navLinks}>
        <Link to="/properties" style={styles.navLink}>Properties</Link>
        <Link to="/units" style={styles.navLink}>Units</Link>
        <Link to="/tenants" style={styles.navLink}>Tenants</Link>
        <Link to="/invoices" style={styles.navLink}>Invoices</Link>
        <Link to="/maintenance" style={styles.navLink}>Maintenance</Link>
      </div>
      <UserButton afterSignOutUrl="/sign-in" />
    </nav>
  );
}

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) return <div style={styles.loading}>Loading…</div>;
  if (!isSignedIn) return <Navigate to="/sign-in" replace />;
  return (
    <>
      <Nav />
      <main style={styles.main}>{children}</main>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Landlord auth */}
      <Route path="/sign-in/*" element={<div style={styles.authPage}><SignIn routing="path" path="/sign-in" /></div>} />
      <Route path="/sign-up/*" element={<div style={styles.authPage}><SignUp routing="path" path="/sign-up" /></div>} />

      {/* Landlord dashboard routes */}
      <Route path="/properties" element={<ProtectedLayout><PropertiesPage /></ProtectedLayout>} />
      <Route path="/properties/:id" element={<ProtectedLayout><PropertyDetailPage /></ProtectedLayout>} />
      <Route path="/units" element={<ProtectedLayout><UnitsPage /></ProtectedLayout>} />
      <Route path="/tenants" element={<ProtectedLayout><TenantsPage /></ProtectedLayout>} />
      <Route path="/invoices" element={<ProtectedLayout><InvoicesPage /></ProtectedLayout>} />
      <Route path="/maintenance" element={<ProtectedLayout><MaintenancePage /></ProtectedLayout>} />

      {/* Tenant portal routes (no Clerk auth — magic link based) */}
      <Route path="/portal/login" element={<PortalLoginPage />} />
      <Route path="/portal/auth" element={<PortalAuthPage />} />
      <Route path="/portal" element={<PortalDashboardPage />} />

      <Route path="*" element={<Navigate to="/properties" replace />} />
    </Routes>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    display: 'flex', alignItems: 'center', gap: '1.5rem',
    padding: '0 2rem', height: '56px',
    background: '#fff', borderBottom: '1px solid #e2e8f0',
    position: 'sticky', top: 0, zIndex: 100,
  },
  brand: {
    fontWeight: 700, fontSize: '1.2rem', color: '#0f172a',
    textDecoration: 'none', marginRight: 'auto',
  },
  navLinks: { display: 'flex', gap: '1rem' },
  navLink: { color: '#475569', textDecoration: 'none', fontSize: '0.9rem' },
  main: { maxWidth: '1100px', margin: '0 auto', padding: '2rem 1rem' },
  authPage: {
    minHeight: '100vh', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  },
  loading: { padding: '4rem', textAlign: 'center', color: '#94a3b8' },
};
