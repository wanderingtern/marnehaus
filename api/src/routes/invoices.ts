import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { stripe } from '../lib/stripe';
import { sendInvoiceEmail } from '../lib/email';

const router = Router();
router.use(requireAuth());

const BASE_URL = process.env.APP_URL ?? 'http://localhost:5173';

const createInvoiceSchema = z.object({
  unitId: z.string().min(1),
  tenantId: z.string().min(1),
  amountCents: z.number().int().positive(),
  dueDate: z.string().datetime(),
});

/**
 * GET /api/invoices
 * List all invoices for the authenticated landlord, optionally filtered by unitId.
 */
router.get('/', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { unitId, status } = req.query as { unitId?: string; status?: string };

  const invoices = await prisma.invoice.findMany({
    where: {
      userId: user.id,
      ...(unitId ? { unitId } : {}),
      ...(status ? { status: status as any } : {}),
    },
    include: {
      unit: { select: { id: true, unitNumber: true, property: { select: { id: true, name: true, address: true } } } },
      tenant: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { dueDate: 'desc' },
  });

  res.json(invoices);
});

/**
 * GET /api/invoices/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const invoice = await prisma.invoice.findFirst({
    where: { id: req.params.id, userId: user.id },
    include: {
      unit: { include: { property: true } },
      tenant: true,
    },
  });
  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }
  res.json(invoice);
});

/**
 * POST /api/invoices
 * Create a rent invoice, create a Stripe Checkout Session, and email the tenant.
 */
router.post('/', async (req: Request, res: Response) => {
  const user = (req as any).user;
  const data = createInvoiceSchema.parse(req.body);

  // Verify the unit belongs to this landlord
  const unit = await prisma.unit.findFirst({
    where: { id: data.unitId, property: { userId: user.id } },
    include: { property: true },
  });
  if (!unit) {
    res.status(404).json({ error: 'Unit not found' });
    return;
  }

  // Verify the tenant exists
  const tenant = await prisma.tenant.findUnique({ where: { id: data.tenantId } });
  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }

  // Require Stripe Connect to be set up
  if (!user.stripeAccountId) {
    res.status(400).json({ error: 'Stripe Connect account not set up. Please complete onboarding first.' });
    return;
  }

  // Create invoice record first (pending, no Stripe IDs yet)
  const invoice = await prisma.invoice.create({
    data: {
      userId: user.id,
      unitId: data.unitId,
      tenantId: data.tenantId,
      amountCents: data.amountCents,
      dueDate: new Date(data.dueDate),
      status: 'PENDING',
    },
  });

  // Create Stripe Checkout Session on the connected account
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: data.amountCents,
            product_data: {
              name: `Rent — Unit ${unit.unitNumber} at ${unit.property.address}`,
              description: `Due ${new Date(data.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
            },
          },
          quantity: 1,
        },
      ],
      customer_email: tenant.email,
      metadata: {
        invoiceId: invoice.id,
        tenantId: data.tenantId,
        unitId: data.unitId,
      },
      success_url: `${BASE_URL}/invoices/${invoice.id}?paid=true`,
      cancel_url: `${BASE_URL}/invoices/${invoice.id}`,
    },
    { stripeAccount: user.stripeAccountId },
  );

  // Update invoice with Stripe session details
  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      stripeCheckoutSessionId: session.id,
      stripePaymentUrl: session.url,
    },
    include: {
      unit: { include: { property: true } },
      tenant: true,
    },
  });

  // Send email to tenant
  try {
    await sendInvoiceEmail({
      to: tenant.email,
      tenantName: `${tenant.firstName} ${tenant.lastName}`,
      landlordName: user.name ?? 'Your landlord',
      amountCents: data.amountCents,
      dueDate: new Date(data.dueDate),
      paymentUrl: session.url!,
      invoiceId: invoice.id,
    });
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { emailSentAt: new Date() },
    });
  } catch (emailErr) {
    // Don't fail the request if email fails — invoice + payment link already created
    console.error('Failed to send invoice email:', emailErr);
  }

  res.status(201).json(updated);
});

/**
 * PATCH /api/invoices/:id/cancel
 * Cancel a pending invoice.
 */
router.patch('/:id/cancel', async (req: Request, res: Response) => {
  const user = (req as any).user;

  const invoice = await prisma.invoice.findFirst({
    where: { id: req.params.id, userId: user.id },
  });
  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found' });
    return;
  }
  if (invoice.status === 'PAID') {
    res.status(400).json({ error: 'Cannot cancel a paid invoice' });
    return;
  }

  // Expire the Stripe checkout session if it exists
  if (invoice.stripeCheckoutSessionId && user.stripeAccountId) {
    try {
      await stripe.checkout.sessions.expire(invoice.stripeCheckoutSessionId, {
        stripeAccount: user.stripeAccountId,
      });
    } catch {
      // Best effort
    }
  }

  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: 'CANCELLED' },
  });
  res.json(updated);
});

export default router;
