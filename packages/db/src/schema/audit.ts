import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './system.js';

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  actorUserId: text('actor_user_id'),
  actorType: text('actor_type').notNull(),
  impersonatedAs: text('impersonated_as'),
  action: text('action').notNull(),
  resourceType: text('resource_type'),
  resourceId: uuid('resource_id'),
  payload: jsonb('payload'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`),
}, (table) => [
  index('idx_audit_tenant_created').on(table.tenantId, table.createdAt),
  index('idx_audit_actor').on(table.actorUserId, table.createdAt),
]);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
