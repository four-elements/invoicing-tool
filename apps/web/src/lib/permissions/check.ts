import { and, eq, isNull, or } from 'drizzle-orm';
import { db } from '@invoicing/db/client';
import {
  userPermissionOverrides,
  userRoles,
  rolePermissions,
  permissions,
} from '@invoicing/db/schema';
import { PermissionDeniedError } from '@invoicing/types/errors';
import type { PermissionKey } from '@invoicing/types/permissions';

export interface PermissionContext {
  userId: string;
  tenantId?: string;
  actorType: 'tenant_user' | 'system_admin';
}

export async function hasPermission(
  ctx: PermissionContext,
  permission: PermissionKey
): Promise<boolean> {
  // 1. Direkte DENY-Overrides haben absoluten Vorrang
  const denyOverride = await db
    .select()
    .from(userPermissionOverrides)
    .innerJoin(permissions, eq(userPermissionOverrides.permissionId, permissions.id))
    .where(
      and(
        eq(userPermissionOverrides.userId, ctx.userId),
        eq(permissions.key, permission),
        eq(userPermissionOverrides.type, 'deny'),
        ctx.tenantId
          ? eq(userPermissionOverrides.tenantId, ctx.tenantId)
          : isNull(userPermissionOverrides.tenantId),
      )
    )
    .limit(1);

  if (denyOverride.length > 0) return false;

  // 2. Rollen prüfen (Tenant-Rollen + System-Rollen)
  const roleGrant = await db
    .select()
    .from(userRoles)
    .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(
      and(
        eq(userRoles.userId, ctx.userId),
        eq(permissions.key, permission),
        ctx.tenantId
          ? or(
              eq(userRoles.tenantId, ctx.tenantId),
              isNull(userRoles.tenantId),
            )
          : isNull(userRoles.tenantId),
      )
    )
    .limit(1);

  if (roleGrant.length > 0) return true;

  // 3. Direkte GRANT-Overrides
  const grantOverride = await db
    .select()
    .from(userPermissionOverrides)
    .innerJoin(permissions, eq(userPermissionOverrides.permissionId, permissions.id))
    .where(
      and(
        eq(userPermissionOverrides.userId, ctx.userId),
        eq(permissions.key, permission),
        eq(userPermissionOverrides.type, 'grant'),
        ctx.tenantId
          ? eq(userPermissionOverrides.tenantId, ctx.tenantId)
          : isNull(userPermissionOverrides.tenantId),
      )
    )
    .limit(1);

  return grantOverride.length > 0;
}

export async function requirePermission(
  ctx: PermissionContext,
  permission: PermissionKey
): Promise<void> {
  const allowed = await hasPermission(ctx, permission);
  if (!allowed) {
    throw new PermissionDeniedError(permission);
  }
}
