import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

const app = createApp();

const mockUser = { id: 'user-1', clerkId: 'clerk-1', email: 'land@test.com', name: 'Test Landlord' };

function withAuth(req: any) {
  // Inject mock auth via a custom header that our mock clerkMiddleware reads
  return req.set('x-test-user-id', 'clerk-1');
}

// Inject auth into all requests via middleware spy
beforeEach(() => {
  vi.clearAllMocks();
  (prisma.user.findUnique as any).mockResolvedValue(mockUser);
});

// Patch getAuth mock to return userId when x-test-user-id header is present
vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (req: any, _res: any, next: any) => {
    if (req.headers['x-test-user-id']) {
      req._mockAuth = { userId: req.headers['x-test-user-id'] };
    }
    next();
  },
  getAuth: (req: any) => req._mockAuth ?? null,
}));

const mockProperty = {
  id: 'prop-1',
  userId: 'user-1',
  name: 'Test Apts',
  address: '100 Oak Ave',
  city: 'Austin',
  state: 'TX',
  zip: '78701',
  units: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('GET /api/properties', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/properties');
    expect(res.status).toBe(401);
  });

  it('returns property list for authenticated user', async () => {
    (prisma.property.findMany as any).mockResolvedValue([mockProperty]);

    const res = await withAuth(request(app).get('/api/properties'));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Test Apts');
  });
});

describe('POST /api/properties', () => {
  it('returns 400 on missing required fields', async () => {
    const res = await withAuth(request(app).post('/api/properties').send({ name: 'Only Name' }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  it('creates a property and returns 201', async () => {
    (prisma.property.create as any).mockResolvedValue(mockProperty);

    const res = await withAuth(request(app)
      .post('/api/properties')
      .send({ name: 'Test Apts', address: '100 Oak Ave', city: 'Austin', state: 'TX', zip: '78701' }));

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('prop-1');
    expect(prisma.property.create).toHaveBeenCalledOnce();
  });

  it('returns 400 on invalid state code', async () => {
    const res = await withAuth(request(app)
      .post('/api/properties')
      .send({ name: 'Test', address: '1 Main', city: 'City', state: 'Texas', zip: '78701' }));
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/properties/:id', () => {
  it('returns 404 if property not found', async () => {
    (prisma.property.findFirst as any).mockResolvedValue(null);
    const res = await withAuth(request(app).patch('/api/properties/does-not-exist').send({ name: 'New Name' }));
    expect(res.status).toBe(404);
  });

  it('updates a property', async () => {
    (prisma.property.findFirst as any).mockResolvedValue(mockProperty);
    (prisma.property.update as any).mockResolvedValue({ ...mockProperty, name: 'Updated' });

    const res = await withAuth(request(app).patch('/api/properties/prop-1').send({ name: 'Updated' }));
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated');
  });
});

describe('DELETE /api/properties/:id', () => {
  it('returns 404 if not found', async () => {
    (prisma.property.findFirst as any).mockResolvedValue(null);
    const res = await withAuth(request(app).delete('/api/properties/missing'));
    expect(res.status).toBe(404);
  });

  it('deletes and returns 204', async () => {
    (prisma.property.findFirst as any).mockResolvedValue(mockProperty);
    (prisma.property.delete as any).mockResolvedValue(mockProperty);

    const res = await withAuth(request(app).delete('/api/properties/prop-1'));
    expect(res.status).toBe(204);
  });
});
