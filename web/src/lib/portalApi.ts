const API_BASE = '/api/portal';

function getToken(): string | null {
  return sessionStorage.getItem('tenantToken');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-Tenant-Token': token } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const portalApi = {
  requestLink: (email: string) =>
    request<{ ok: boolean }>('/request-link', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  verifyToken: (token: string) =>
    request<{ sessionToken: string; tenant: { id: string; firstName: string; lastName: string; email: string } }>(
      '/verify-token',
      { method: 'POST', body: JSON.stringify({ token }) },
    ),

  getMe: () => request<any>('/me'),
  getInvoices: () => request<any[]>('/invoices'),
  getLease: () => request<any>('/lease'),
  getMaintenance: () => request<any[]>('/maintenance'),
  submitMaintenance: (category: string, description: string) =>
    request<any>('/maintenance', {
      method: 'POST',
      body: JSON.stringify({ category, description }),
    }),
};
