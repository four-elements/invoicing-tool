import { headers } from 'next/headers';
import { auth } from './config.js';
import { db } from '@invoicing/db/client';
import { systemAdminUsers } from '@invoicing/db/schema';
import { eq } from 'drizzle-orm';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

export interface TenantSession {
  userId: string;
  tenantId: string;
  actorType: 'tenant_user';
  tenantUserId: string;
  user: SessionUser;
}

export interface AdminSession {
  userId: string;
  actorType: 'system_admin';
  adminRole: string;
  user: SessionUser;
}

export type AppSession = TenantSession | AdminSession;

export async function getSession(): Promise<AppSession | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const adminUser = await db.query.systemAdminUsers.findFirst({
    where: eq(systemAdminUsers.userId, session.user.id),
  });

  if (adminUser?.isActive) {
    return {
      userId: session.user.id,
      actorType: 'system_admin',
      adminRole: adminUser.role,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      },
    };
  }

  return null;
}

export async function getTenantSession(tenantId: string): Promise<TenantSession | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const { tenantUsers } = await import('@invoicing/db/schema');
  const { and } = await import('drizzle-orm');

  const tenantUser = await db.query.tenantUsers.findFirst({
    where: and(
      eq(tenantUsers.userId, session.user.id),
      eq(tenantUsers.tenantId, tenantId),
    ),
  });

  if (!tenantUser?.isActive) return null;

  return {
    userId: session.user.id,
    tenantId,
    actorType: 'tenant_user',
    tenantUserId: tenantUser.id,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    },
  };
}
