import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { UnitStatus } from '@prisma/client';

const router = Router();

const createUnitSchema = z.object({
  propertyId: z.string().min(1),
  unitNumber: z.string().min(1),
  type: z.string().min(1),
  monthlyRent: z.number().positive(),
  bedrooms: z.number().int().min(0).default(0),
  bathrooms: z.number().min(0).default(1),
  sqft: z.number().int().positive().optional(),
  status: z.nativeEnum(UnitStatus).default(UnitStatus.VACANT),
});

const updateUnitSchema = createUnitSchema.omit({ propertyId: true }).partial();

router.use(requireAuth());

// GET /units?propertyId=...
router.get('/', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { propertyId } = req.query;

  const where: any = {
    property: { userId: user.id },
  };
  if (propertyId) where.propertyId = propertyId as string;

  const units = await prisma.unit.findMany({
    where,
    include: {
      property: { select: { id: true, name: true, address: true } },
      tenants: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: [{ property: { name: 'asc' } }, { unitNumber: 'asc' }],
  });
  res.json(units);
});

// POST /units
router.post('/', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const data = createUnitSchema.parse(req.body);

  // Verify property belongs to user
  const property = await prisma.property.findFirst({
    where: { id: data.propertyId, userId: user.id },
  });
  if (!property) {
    res.status(404).json({ error: 'Property not found' });
    return;
  }

  const { propertyId, ...rest } = data;
  const unit = await prisma.unit.create({
    data: { ...rest, propertyId },
    include: {
      property: { select: { id: true, name: true } },
      tenants: true,
    },
  });
  res.status(201).json(unit);
});

// GET /units/:id
router.get('/:id', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const unit = await prisma.unit.findFirst({
    where: { id: req.params.id, property: { userId: user.id } },
    include: {
      property: true,
      tenants: true,
      leases: { orderBy: { startDate: 'desc' } },
    },
  });
  if (!unit) {
    res.status(404).json({ error: 'Unit not found' });
    return;
  }
  res.json(unit);
});

// PATCH /units/:id
router.patch('/:id', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const data = updateUnitSchema.parse(req.body);

  const existing = await prisma.unit.findFirst({
    where: { id: req.params.id, property: { userId: user.id } },
  });
  if (!existing) {
    res.status(404).json({ error: 'Unit not found' });
    return;
  }

  const unit = await prisma.unit.update({
    where: { id: req.params.id },
    data,
    include: {
      property: { select: { id: true, name: true } },
      tenants: true,
    },
  });
  res.json(unit);
});

// DELETE /units/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const existing = await prisma.unit.findFirst({
    where: { id: req.params.id, property: { userId: user.id } },
  });
  if (!existing) {
    res.status(404).json({ error: 'Unit not found' });
    return;
  }
  await prisma.unit.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
