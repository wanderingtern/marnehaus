import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../lib/prisma';
import { stripe } from '../lib/stripe';

const router = Router();

/**
 * Clerk webhook — syncs user creation/updates into our DB.
 */
router.post('/clerk', async (req: Request, res: Response) => {
  const event = req.body;

  if (event.type === 'user.created' || event.type === 'user.updated') {
    const { id: clerkId, email_addresses, first_name, last_name } = event.data;
    const email = email_addresses?.[0]?.email_address;
    if (!email) {
      res.status(400).json({ error: 'No email address in event' });
      return;
    }
    const name = [first_name, last_name].filter(Boolean).join(' ') || null;

    await prisma.user.upsert({
      where: { clerkId },
      create: { clerkId, email, name },
      update: { email, name },
    });
  }

  res.json({ received: true });
});

/**
 * Stripe webhook — handles payment events from connected accounts.
 *
 * Stripe sends Connect webhooks with the `Stripe-Account` header set to the
 * connected account ID. We verify the signature with STRIPE_WEBHOOK_SECRET.
 */
router.post('/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    res.status(500).json({ error: 'Webhook not configured' });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
  } catch (err: any) {
    console.error('Stripe webhook signature verification failed:', err.message);
    res.status(400).json({ error: `Webhook error: ${err.message}` });
    return;
  }

  await handleStripeEvent(event);
  res.json({ received: true });
});

async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      await markInvoicePaidByCheckout(session);
      break;
    }

    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await markInvoicePaidByPaymentIntent(paymentIntent);
      break;
    }

    case 'account.updated': {
      // Sync Stripe Connect account status
      const account = event.data.object as Stripe.Account;
      const onboarded = account.details_submitted && !account.requirements?.currently_due?.length;
      await prisma.user.updateMany({
        where: { stripeAccountId: account.id },
        data: { stripeOnboarded: onboarded ?? false },
      });
      break;
    }

    default:
      // Unhandled event type — log and ignore
      break;
  }
}

/**
 * Mark an invoice as paid when a Stripe Checkout Session completes.
 * Idempotent: safe to call multiple times for the same session.
 */
async function markInvoicePaidByCheckout(session: Stripe.Checkout.Session) {
  const invoiceId = session.metadata?.invoiceId;
  if (!invoiceId) return;

  const existing = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!existing || existing.status === 'PAID') return;

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: 'PAID',
      paidAt: new Date(),
      stripePaymentIntentId: typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null,
    },
  });
}

/**
 * Mark an invoice as paid when a PaymentIntent succeeds.
 * Idempotent: safe to call multiple times for the same payment intent.
 */
async function markInvoicePaidByPaymentIntent(paymentIntent: Stripe.PaymentIntent) {
  const existing = await prisma.invoice.findUnique({
    where: { stripePaymentIntentId: paymentIntent.id },
  });
  if (!existing || existing.status === 'PAID') return;

  await prisma.invoice.update({
    where: { stripePaymentIntentId: paymentIntent.id },
    data: {
      status: 'PAID',
      paidAt: new Date(),
    },
  });
}

export { handleStripeEvent };
export default router;
