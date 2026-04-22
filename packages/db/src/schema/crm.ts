import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { tenants } from './system';
import { tenantUsers } from './auth';

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  type: text('type').notNull().default('person'),
  salutation: text('salutation'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  companyName: text('company_name'),
  email: text('email'),
  phone: text('phone'),
  mobile: text('mobile'),
  website: text('website'),
  notes: text('notes'),
  tags: text('tags').array(),
  assignedTo: uuid('assigned_to').references(() => tenantUsers.id),
  createdBy: uuid('created_by').notNull().references(() => tenantUsers.id),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).default(sql`now()`),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const contactAddresses = pgTable('contact_addresses', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  type: text('type').default('billing'),
  street: text('street'),
  city: text('city'),
  zip: text('zip'),
  country: text('country').default('DE'),
  isPrimary: boolean('is_primary').default(false),
});

export const contactRelationships = pgTable('contact_relationships', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  fromContact: uuid('from_contact').notNull().references(() => contacts.id),
  toContact: uuid('to_contact').notNull().references(() => contacts.id),
  relationType: text('relation_type').notNull(),
});

export const contactNotes = pgTable('contact_notes', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  createdBy: uuid('created_by').notNull().references(() => tenantUsers.id),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`),
});

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type ContactAddress = typeof contactAddresses.$inferSelect;
export type NewContactAddress = typeof contactAddresses.$inferInsert;
export type ContactNote = typeof contactNotes.$inferSelect;
export type NewContactNote = typeof contactNotes.$inferInsert;
