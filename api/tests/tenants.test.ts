import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

const app = createApp();
const mockUser = { id: 'user-1', clerkId: 'clerk-1', email: 'land@test.com', name: 'Test Landlord' };

vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (req: any, _res: any, next: any) => {
    if (req.headers['x-test-user-id']) req._mockAuth = { userId: req.headers['x-test-user-id'] };
    next();
  },
  getAuth: (req: any) => req._mockAuth ?? null,
}));

function auth(req: any) {
  return req.set('x-test-user-id', 'clerk-1');
}

beforeEach(() => {
  vi.clearAllMocks();
  (prisma.user.findUnique as any).mockResolvedValue(mockUser);
});

const mockTenant = {
  id: 'tenant-1',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  phone: '512-555-0100',
  unitId: 'unit-1',
  unit: {
    id: 'unit-1',
    unitNumber: '1A',
    property: { id: 'prop-1', name: 'Test Apts', address: '100 Oak' },
  },
  leases: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('GET /api/tenants', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/api/tenants');
    expect(res.status).toBe(401);
  });

  it('returns tenants for authenticated user', async () => {
    (prisma.tenant.findMany as any).mockResolvedValue([mockTenant]);
    const res = await auth(request(app).get('/api/tenants'));
    expect(res.status).toBe(200);
    expect(res.body[0].email).toBe('jane@example.com');
  });
});

describe('POST /api/tenants', () => {
  it('returns 400 on invalid email', async () => {
    const res = await auth(request(app).post('/api/tenants').send({
      firstName: 'Jane', lastName: 'Doe', email: 'not-an-email',
    }));
    expect(res.status).toBe(400);
  });

  it('returns 400 on missing required fields', async () => {
    const res = await auth(request(app).post('/api/tenants').send({ email: 'jane@test.com' }));
    expect(res.status).toBe(400);
  });

  it('creates tenant and returns 201', async () => {
    (prisma.unit.findFirst as any).mockResolvedValue({ id: 'unit-1' });
    (prisma.tenant.create as any).mockResolvedValue(mockTenant);

    const res = await auth(request(app).post('/api/tenants').send({
      firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com',
      phone: '512-555-0100', unitId: 'unit-1',
    }));
    expect(res.status).toBe(201);
    expect(res.body.firstName).toBe('Jane');
  });

  it('creates tenant without unit', async () => {
    const tenantNoUnit = { ...mockTenant, unitId: null, unit: null };
    (prisma.tenant.create as any).mockResolvedValue(tenantNoUnit);

    const res = await auth(request(app).post('/api/tenants').send({
      firstName: 'Bob', lastName: 'Smith', email: 'bob@example.com',
    }));
    expect(res.status).toBe(201);
  });
});

describe('PATCH /api/tenants/:id', () => {
  it('returns 404 if tenant not found', async () => {
    (prisma.tenant.findFirst as any).mockResolvedValue(null);
    const res = await auth(request(app).patch('/api/tenants/missing').send({ phone: '555-1234' }));
    expect(res.status).toBe(404);
  });

  it('updates tenant', async () => {
    (prisma.tenant.findFirst as any).mockResolvedValue(mockTenant);
    (prisma.tenant.update as any).mockResolvedValue({ ...mockTenant, phone: '555-9999' });

    const res = await auth(request(app).patch('/api/tenants/tenant-1').send({ phone: '555-9999' }));
    expect(res.status).toBe(200);
    expect(res.body.phone).toBe('555-9999');
  });
});

describe('DELETE /api/tenants/:id', () => {
  it('returns 404 if not found', async () => {
    (prisma.tenant.findFirst as any).mockResolvedValue(null);
    const res = await auth(request(app).delete('/api/tenants/missing'));
    expect(res.status).toBe(404);
  });

  it('deletes tenant and returns 204', async () => {
    (prisma.tenant.findFirst as any).mockResolvedValue(mockTenant);
    (prisma.tenant.delete as any).mockResolvedValue(mockTenant);

    const res = await auth(request(app).delete('/api/tenants/tenant-1'));
    expect(res.status).toBe(204);
  });
});
