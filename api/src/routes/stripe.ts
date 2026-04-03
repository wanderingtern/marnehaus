import { Router, Request, Response } from 'express';
import { stripe } from '../lib/stripe';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth());

const BASE_URL = process.env.APP_URL ?? 'http://localhost:5173';

/**
 * POST /api/stripe/connect-onboard
 * Creates a Stripe Express Connect account (if needed) and returns an onboarding URL.
 */
router.post('/connect-onboard', async (req: Request, res: Response) => {
  const user = (req as any).user;

  let accountId = user.stripeAccountId;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      email: user.email,
      metadata: { userId: user.id },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
    accountId = account.id;
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeAccountId: accountId },
    });
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${BASE_URL}/stripe/connect-refresh`,
    return_url: `${BASE_URL}/stripe/connect-return`,
    type: 'account_onboarding',
  });

  res.json({ url: accountLink.url });
});

/**
 * GET /api/stripe/connect-status
 * Returns whether the landlord's Stripe Connect account is fully onboarded.
 */
router.get('/connect-status', async (req: Request, res: Response) => {
  const user = (req as any).user;

  if (!user.stripeAccountId) {
    res.json({ connected: false, onboarded: false });
    return;
  }

  // Verify with Stripe in case status changed
  const account = await stripe.accounts.retrieve(user.stripeAccountId);
  const onboarded = account.details_submitted && !account.requirements?.currently_due?.length;

  if (onboarded && !user.stripeOnboarded) {
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeOnboarded: true },
    });
  }

  res.json({
    connected: true,
    onboarded,
    accountId: user.stripeAccountId,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
  });
});

export default router;
