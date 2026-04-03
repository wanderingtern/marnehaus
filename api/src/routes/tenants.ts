import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

const createTenantSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  unitId: z.string().optional(),
});

const updateTenantSchema = createTenantSchema.partial();

router.use(requireAuth());

// GET /tenants?unitId=...&propertyId=...
router.get('/', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { unitId, propertyId } = req.query;

  const where: any = {
    unit: { property: { userId: user.id } },
  };
  // Include tenants with no unit if no filter
  if (unitId) where.unitId = unitId as string;
  if (propertyId) where.unit = { propertyId: propertyId as string, property: { userId: user.id } };

  const tenants = await prisma.tenant.findMany({
    where: unitId || propertyId ? where : {
      OR: [
        { unit: { property: { userId: user.id } } },
        { unitId: null },
      ],
    },
    include: {
      unit: {
        include: {
          property: { select: { id: true, name: true, address: true } },
        },
      },
      leases: {
        where: { status: 'ACTIVE' },
        select: { id: true, startDate: true, endDate: true, monthlyRent: true, status: true },
      },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });
  res.json(tenants);
});

// POST /tenants
router.post('/', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const data = createTenantSchema.parse(req.body);

  // If unitId provided, verify it belongs to user
  if (data.unitId) {
    const unit = await prisma.unit.findFirst({
      where: { id: data.unitId, property: { userId: user.id } },
    });
    if (!unit) {
      res.status(404).json({ error: 'Unit not found' });
      return;
    }
  }

  const tenant = await prisma.tenant.create({
    data,
    include: {
      unit: {
        include: { property: { select: { id: true, name: true } } },
      },
    },
  });
  res.status(201).json(tenant);
});

// GET /tenants/:id
router.get('/:id', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const tenant = await prisma.tenant.findFirst({
    where: {
      id: req.params.id,
      OR: [
        { unit: { property: { userId: user.id } } },
        { unitId: null },
      ],
    },
    include: {
      unit: {
        include: { property: true },
      },
      leases: { orderBy: { startDate: 'desc' } },
    },
  });
  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }
  res.json(tenant);
});

// PATCH /tenants/:id
router.patch('/:id', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const data = updateTenantSchema.parse(req.body);

  const existing = await prisma.tenant.findFirst({
    where: {
      id: req.params.id,
      OR: [
        { unit: { property: { userId: user.id } } },
        { unitId: null },
      ],
    },
  });
  if (!existing) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }

  // Validate new unitId if provided
  if (data.unitId) {
    const unit = await prisma.unit.findFirst({
      where: { id: data.unitId, property: { userId: user.id } },
    });
    if (!unit) {
      res.status(404).json({ error: 'Unit not found' });
      return;
    }
  }

  const tenant = await prisma.tenant.update({
    where: { id: req.params.id },
    data,
    include: {
      unit: {
        include: { property: { select: { id: true, name: true } } },
      },
    },
  });
  res.json(tenant);
});

// DELETE /tenants/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const existing = await prisma.tenant.findFirst({
    where: {
      id: req.params.id,
      OR: [
        { unit: { property: { userId: user.id } } },
        { unitId: null },
      ],
    },
  });
  if (!existing) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }
  await prisma.tenant.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
