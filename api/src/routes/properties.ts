import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

const createPropertySchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().length(2),
  zip: z.string().min(5).max(10),
});

const updatePropertySchema = createPropertySchema.partial();

router.use(requireAuth());

// GET /properties
router.get('/', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const properties = await prisma.property.findMany({
    where: { userId: user.id },
    include: {
      units: {
        select: { id: true, unitNumber: true, status: true, monthlyRent: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(properties);
});

// POST /properties
router.post('/', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const data = createPropertySchema.parse(req.body);
  const property = await prisma.property.create({
    data: { ...data, userId: user.id },
    include: { units: true },
  });
  res.status(201).json(property);
});

// GET /properties/:id
router.get('/:id', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const property = await prisma.property.findFirst({
    where: { id: req.params.id, userId: user.id },
    include: {
      units: {
        include: { tenants: true },
      },
    },
  });
  if (!property) {
    res.status(404).json({ error: 'Property not found' });
    return;
  }
  res.json(property);
});

// PATCH /properties/:id
router.patch('/:id', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const data = updatePropertySchema.parse(req.body);

  const existing = await prisma.property.findFirst({
    where: { id: req.params.id, userId: user.id },
  });
  if (!existing) {
    res.status(404).json({ error: 'Property not found' });
    return;
  }

  const property = await prisma.property.update({
    where: { id: req.params.id },
    data,
    include: { units: true },
  });
  res.json(property);
});

// DELETE /properties/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const existing = await prisma.property.findFirst({
    where: { id: req.params.id, userId: user.id },
  });
  if (!existing) {
    res.status(404).json({ error: 'Property not found' });
    return;
  }
  await prisma.property.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
