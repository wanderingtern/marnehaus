import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Stripe from 'stripe';

// Mock stripe lib before importing webhook handler
vi.mock('../src/lib/stripe', () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
  },
}));

// Mock prisma (extended to include invoice model)
vi.mock('../src/lib/prisma', () => {
  const mockPrisma = {
    invoice: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    user: { findUnique: vi.fn(), create: vi.fn(), upsert: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    unit: { findFirst: vi.fn() },
    tenant: { findUnique: vi.fn() },
  };
  return { prisma: mockPrisma };
});

import { prisma } from '../src/lib/prisma';
import { handleStripeEvent } from '../src/routes/webhooks';

const mockInvoicePending = {
  id: 'inv_test_001',
  userId: 'user_1',
  unitId: 'unit_1',
  tenantId: 'tenant_1',
  amountCents: 120000,
  dueDate: new Date('2026-05-01'),
  status: 'PENDING',
  stripeCheckoutSessionId: 'cs_test_001',
  stripePaymentIntentId: null,
  paidAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Webhook: checkout.session.completed', () => {
  it('marks a PENDING invoice as PAID', async () => {
    (prisma.invoice.findUnique as any).mockResolvedValue(mockInvoicePending);
    (prisma.invoice.update as any).mockResolvedValue({ ...mockInvoicePending, status: 'PAID', paidAt: new Date() });

    const event = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_001',
          payment_intent: 'pi_test_001',
          metadata: { invoiceId: 'inv_test_001' },
        } as Partial<Stripe.Checkout.Session>,
      },
    } as Stripe.Event;

    await handleStripeEvent(event);

    expect(prisma.invoice.findUnique).toHaveBeenCalledWith({ where: { id: 'inv_test_001' } });
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv_test_001' },
        data: expect.objectContaining({ status: 'PAID', stripePaymentIntentId: 'pi_test_001' }),
      }),
    );
  });

  it('is idempotent — does not double-update a PAID invoice', async () => {
    (prisma.invoice.findUnique as any).mockResolvedValue({ ...mockInvoicePending, status: 'PAID' });

    const event = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_001',
          payment_intent: 'pi_test_001',
          metadata: { invoiceId: 'inv_test_001' },
        } as Partial<Stripe.Checkout.Session>,
      },
    } as Stripe.Event;

    await handleStripeEvent(event);

    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it('does nothing if invoiceId is missing from metadata', async () => {
    const event = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_002',
          payment_intent: 'pi_test_002',
          metadata: {},
        } as Partial<Stripe.Checkout.Session>,
      },
    } as Stripe.Event;

    await handleStripeEvent(event);

    expect(prisma.invoice.findUnique).not.toHaveBeenCalled();
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });
});

describe('Webhook: payment_intent.succeeded', () => {
  it('marks a PENDING invoice as PAID by payment intent ID', async () => {
    (prisma.invoice.findUnique as any).mockResolvedValue({
      ...mockInvoicePending,
      stripePaymentIntentId: 'pi_test_001',
    });
    (prisma.invoice.update as any).mockResolvedValue({
      ...mockInvoicePending,
      status: 'PAID',
      paidAt: new Date(),
    });

    const event = {
      type: 'payment_intent.succeeded',
      data: {
        object: { id: 'pi_test_001' } as Stripe.PaymentIntent,
      },
    } as Stripe.Event;

    await handleStripeEvent(event);

    expect(prisma.invoice.findUnique).toHaveBeenCalledWith({
      where: { stripePaymentIntentId: 'pi_test_001' },
    });
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripePaymentIntentId: 'pi_test_001' },
        data: expect.objectContaining({ status: 'PAID' }),
      }),
    );
  });

  it('is idempotent — does not double-update a PAID invoice', async () => {
    (prisma.invoice.findUnique as any).mockResolvedValue({
      ...mockInvoicePending,
      status: 'PAID',
      stripePaymentIntentId: 'pi_test_001',
    });

    const event = {
      type: 'payment_intent.succeeded',
      data: {
        object: { id: 'pi_test_001' } as Stripe.PaymentIntent,
      },
    } as Stripe.Event;

    await handleStripeEvent(event);

    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it('does nothing if no invoice found for payment intent', async () => {
    (prisma.invoice.findUnique as any).mockResolvedValue(null);

    const event = {
      type: 'payment_intent.succeeded',
      data: {
        object: { id: 'pi_nonexistent' } as Stripe.PaymentIntent,
      },
    } as Stripe.Event;

    await handleStripeEvent(event);

    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });
});

describe('Webhook: account.updated', () => {
  it('marks user as onboarded when details_submitted and no requirements', async () => {
    (prisma.user.updateMany as any).mockResolvedValue({ count: 1 });

    const event = {
      type: 'account.updated',
      data: {
        object: {
          id: 'acct_test',
          details_submitted: true,
          requirements: { currently_due: [] },
        } as unknown as Stripe.Account,
      },
    } as Stripe.Event;

    await handleStripeEvent(event);

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { stripeAccountId: 'acct_test' },
      data: { stripeOnboarded: true },
    });
  });

  it('marks user as not onboarded when requirements are pending', async () => {
    (prisma.user.updateMany as any).mockResolvedValue({ count: 1 });

    const event = {
      type: 'account.updated',
      data: {
        object: {
          id: 'acct_test',
          details_submitted: true,
          requirements: { currently_due: ['individual.id_number'] },
        } as unknown as Stripe.Account,
      },
    } as Stripe.Event;

    await handleStripeEvent(event);

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { stripeAccountId: 'acct_test' },
      data: { stripeOnboarded: false },
    });
  });
});
