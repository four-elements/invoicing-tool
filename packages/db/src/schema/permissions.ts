import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './system';
import { users } from './auth';

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  name: text('name').notNull(),
  description: text('description'),
  isSystem: boolean('is_system').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`),
});

export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  key: text('key').unique().notNull(),
  module: text('module').notNull(),
  resource: text('resource').notNull(),
  action: text('action').notNull(),
  description: text('description'),
});

export const rolePermissions = pgTable('role_permissions', {
  roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permissionId: uuid('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.roleId, table.permissionId] }),
]);

export const userRoles = pgTable('user_roles', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  grantedBy: text('granted_by').references(() => users.id),
  grantedAt: timestamp('granted_at', { withTimezone: true }).default(sql`now()`),
}, (table) => [
  primaryKey({ columns: [table.userId, table.roleId, table.tenantId] }),
]);

export const userPermissionOverrides = pgTable('user_permission_overrides', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  permissionId: uuid('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  type: text('type').notNull(),
  reason: text('reason'),
  grantedBy: text('granted_by').references(() => users.id),
  grantedAt: timestamp('granted_at', { withTimezone: true }).default(sql`now()`),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
});

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;
export type UserPermissionOverride = typeof userPermissionOverrides.$inferSelect;
