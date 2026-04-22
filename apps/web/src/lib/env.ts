import { z } from 'zod';

const envSchema = z.object({
  // Datenbank
  DATABASE_URL: z.string().url('DATABASE_URL muss eine gültige URL sein'),
  DATABASE_POOL_MIN: z.coerce.number().int().min(1).default(2),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(10),

  // Better Auth
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET muss mindestens 32 Zeichen haben'),
  BETTER_AUTH_URL: z.string().url('BETTER_AUTH_URL muss eine gültige URL sein'),

  // E-Mail
  RESEND_API_KEY: z.string().startsWith('re_', 'RESEND_API_KEY muss mit re_ beginnen'),
  RESEND_FROM_EMAIL: z.string().email('RESEND_FROM_EMAIL muss eine gültige E-Mail sein'),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url('NEXT_PUBLIC_APP_URL muss eine gültige URL sein'),
  APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),

  // Admin-Consent
  ADMIN_CONSENT_MAX_DAYS: z.coerce.number().int().min(1).max(365).default(30),
});

type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Ungültige Umgebungsvariablen – Anwendung startet nicht:\n${errors}`
    );
  }
  return result.data;
}

export const env = validateEnv();
