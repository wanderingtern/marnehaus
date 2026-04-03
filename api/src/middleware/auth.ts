import { clerkMiddleware, getAuth } from '@clerk/express';
import { RequestHandler, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

export const clerkAuth = clerkMiddleware();

/**
 * Requires a valid Clerk session and resolves the local User record.
 * Attaches `req.user` for downstream handlers.
 */
export function requireAuth(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const auth = getAuth(req);
    if (!auth?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let user = await prisma.user.findUnique({ where: { clerkId: auth.userId } });

    // Auto-provision user on first request after Clerk signup
    if (!user) {
      const clerkUser = (req as any).clerkUser;
      const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? `${auth.userId}@unknown.clerk`;
      user = await prisma.user.create({
        data: {
          clerkId: auth.userId,
          email,
          name: clerkUser ? `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim() : null,
        },
      });
    }

    (req as any).user = user;
    next();
  };
}
