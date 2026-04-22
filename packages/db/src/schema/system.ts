import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  slug: text('slug').unique().notNull(),
  name: text('name').notNull(),
  plan: text('plan').notNull().default('trial'),
  status: text('status').notNull().default('active'),
  adminConsent: boolean('admin_consent').notNull().default(false),
  consentGrantedAt: timestamp('consent_granted_at', { withTimezone: true }),
  consentGrantedBy: uuid('consent_granted_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`now()`),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const tenantSettings = pgTable('tenant_settings', {
  tenantId: uuid('tenant_id').primaryKey().references(() => tenants.id),
  locale: text('locale').default('de-DE'),
  timezone: text('timezone').default('Europe/Berlin'),
  dateFormat: text('date_format').default('DD.MM.YYYY'),
  currency: text('currency').default('EUR'),
  fiscalYearStart: integer('fiscal_year_start').default(1),
});

export const accessRequests = pgTable('access_requests', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  requestedBy: uuid('requested_by').notNull(),
  reason: text('reason').notNull(),
  status: text('status').default('pending'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  reviewedBy: uuid('reviewed_by'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type TenantSettings = typeof tenantSettings.$inferSelect;
export type AccessRequest = typeof accessRequests.$inferSelect;
export type NewAccessRequest = typeof accessRequests.$inferInsert;
