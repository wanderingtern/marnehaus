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

const mockUnit = {
  id: 'unit-1',
  propertyId: 'prop-1',
  unitNumber: '1A',
  type: '1BR',
  monthlyRent: '1500',
  bedrooms: 1,
  bathrooms: '1.0',
  sqft: 750,
  status: 'VACANT',
  property: { id: 'prop-1', name: 'Test Apts', address: '100 Oak Ave' },
  tenants: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('GET /api/units', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/api/units');
    expect(res.status).toBe(401);
  });

  it('returns units for authenticated user', async () => {
    (prisma.unit.findMany as any).mockResolvedValue([mockUnit]);
    const res = await auth(request(app).get('/api/units'));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('POST /api/units', () => {
  it('returns 400 on missing fields', async () => {
    const res = await auth(request(app).post('/api/units').send({ unitNumber: '1A' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 if property not found', async () => {
    (prisma.property.findFirst as any).mockResolvedValue(null);
    const res = await auth(request(app).post('/api/units').send({
      propertyId: 'bad-id', unitNumber: '1A', type: '1BR', monthlyRent: 1500,
    }));
    expect(res.status).toBe(404);
  });

  it('creates unit and returns 201', async () => {
    (prisma.property.findFirst as any).mockResolvedValue({ id: 'prop-1' });
    (prisma.unit.create as any).mockResolvedValue(mockUnit);

    const res = await auth(request(app).post('/api/units').send({
      propertyId: 'prop-1', unitNumber: '1A', type: '1BR', monthlyRent: 1500,
    }));
    expect(res.status).toBe(201);
    expect(res.body.unitNumber).toBe('1A');
  });
});

describe('PATCH /api/units/:id', () => {
  it('returns 404 if unit not found', async () => {
    (prisma.unit.findFirst as any).mockResolvedValue(null);
    const res = await auth(request(app).patch('/api/units/missing').send({ status: 'OCCUPIED' }));
    expect(res.status).toBe(404);
  });

  it('updates unit status', async () => {
    (prisma.unit.findFirst as any).mockResolvedValue(mockUnit);
    (prisma.unit.update as any).mockResolvedValue({ ...mockUnit, status: 'OCCUPIED' });

    const res = await auth(request(app).patch('/api/units/unit-1').send({ status: 'OCCUPIED' }));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OCCUPIED');
  });
});
