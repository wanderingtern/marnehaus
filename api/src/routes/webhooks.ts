import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();

/**
 * Clerk webhook endpoint — syncs user creation/updates into our DB.
 * Verify the Svix signature in production using the CLERK_WEBHOOK_SECRET env var.
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

export default router;
