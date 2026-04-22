import { db } from '@invoicing/db/client';
import { auditLogs } from '@invoicing/db/schema';
import { logger } from '@/lib/logger';

export interface AuditLogInput {
  tenantId?: string;
  actorUserId?: string;
  actorType: 'tenant_user' | 'system_admin' | 'system';
  impersonatedAs?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  payload?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

// Felder, die niemals in den Audit-Log geschrieben werden dürfen
const BLOCKED_PAYLOAD_KEYS = new Set([
  'password', 'passwordHash', 'token', 'secret',
  'iban', 'bic', 'cardNumber', 'cvv', 'pin',
]);

function sanitizePayload(
  payload: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [
      key,
      BLOCKED_PAYLOAD_KEYS.has(key) ? '[REDACTED]' : value,
    ])
  );
}

export async function auditLog(input: AuditLogInput): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      tenantId: input.tenantId ?? null,
      actorUserId: input.actorUserId ?? null,
      actorType: input.actorType,
      impersonatedAs: input.impersonatedAs ?? null,
      action: input.action,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      payload: input.payload ? sanitizePayload(input.payload) : null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    });
  } catch (err) {
    // Audit-Log-Fehler dürfen nie die eigentliche Operation blockieren,
    // aber immer geloggt werden
    logger.error({ err, action: input.action }, 'Audit-Log konnte nicht geschrieben werden');
  }
}
