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

/**
 * Requires a valid tenant session token (X-Tenant-Token header).
 * Attaches `req.tenant` for downstream handlers.
 */
export function requireTenant(): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers['x-tenant-token'] as string | undefined;
    if (!token) {
      res.status(401).json({ error: 'Tenant token required' });
      return;
    }

    const tenantToken = await prisma.tenantToken.findUnique({
      where: { token },
      include: { tenant: true },
    });

    if (!tenantToken) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    if (tenantToken.expiresAt < new Date()) {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    if (tenantToken.usedAt && !isSessionToken(tenantToken.expiresAt)) {
      res.status(401).json({ error: 'Token already used' });
      return;
    }

    (req as any).tenant = tenantToken.tenant;
    next();
  };
}

// Session tokens have long expiry (>1h); one-time magic links expire in 1h exactly
function isSessionToken(expiresAt: Date): boolean {
  return expiresAt.getTime() - Date.now() > 60 * 60 * 1000;
}
