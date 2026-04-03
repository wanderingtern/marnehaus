import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { setTokenProvider } from './lib/api';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');

function TokenBridge({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  setTokenProvider(() => getToken());
  return <>{children}</>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <BrowserRouter>
        <TokenBridge>
          <App />
        </TokenBridge>
      </BrowserRouter>
    </ClerkProvider>
  </React.StrictMode>,
);
