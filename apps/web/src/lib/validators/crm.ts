import { z } from 'zod';

const contactBaseSchema = z.object({
  type: z.enum(['person', 'company']).default('person'),
  salutation: z.string().max(50).optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  companyName: z.string().max(200).optional(),
  email: z.string().email().max(255).optional(),
  phone: z.string().max(50).optional(),
  mobile: z.string().max(50).optional(),
  website: z.string().url().max(255).optional(),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string().max(100)).max(20).optional(),
  assignedTo: z.string().uuid().optional(),
});

export const contactCreateSchema = contactBaseSchema.refine(
  (data) => {
    if (data.type === 'person') return data.firstName ?? data.lastName;
    if (data.type === 'company') return data.companyName;
    return true;
  },
  { message: 'Person benötigt Vor- oder Nachname; Unternehmen benötigt Firmenname' }
);

export const contactUpdateSchema = contactBaseSchema.partial();

export const contactAddressSchema = z.object({
  type: z.enum(['billing', 'shipping', 'other']).default('billing'),
  street: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  zip: z.string().max(20).optional(),
  country: z.string().length(2).default('DE'),
  isPrimary: z.boolean().default(false),
});

export const contactNoteSchema = z.object({
  content: z.string().min(1).max(10000),
});

export const contactRelationshipSchema = z.object({
  fromContact: z.string().uuid(),
  toContact: z.string().uuid(),
  relationType: z.enum(['employee_of', 'subsidiary_of', 'partner_of']),
});

export type ContactCreateInput = z.infer<typeof contactCreateSchema>;
export type ContactUpdateInput = z.infer<typeof contactUpdateSchema>;
export type ContactAddressInput = z.infer<typeof contactAddressSchema>;
export type ContactNoteInput = z.infer<typeof contactNoteSchema>;
