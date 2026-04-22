# CLAUDE.md – Modulare Mandantenbuchhaltung: Kernmodul CRM

> **Zweck dieser Datei:** Vollständige Bau-Anleitung für Claude Code.
> Lies diese Datei **vollständig** bevor du eine einzige Zeile Code schreibst.
> Halte dich **strikt** an die Reihenfolge der Phasen. Überspringe keine Phase.

---

## 0 · Kontext & Ziele

Du baust eine **modulare, mandantenfähige Buchhaltungssoftware** in TypeScript.
Das erste Modul ist das **CRM** (Kundenverwaltung). Alle späteren Module (Buchhaltung, Rechnungen, Berichte …) bauen auf den Fundament-Patterns dieses Moduls auf.

**Zwei Ebenen:**

| Ebene | Beschreibung |
|---|---|
| **Super-Admin** | Betreiber der Plattform. Kann nach expliziter Kundenfreigabe lesend/schreibend auf Tenants zugreifen. |
| **Tenant** | Kundeninstanz. Eigene Nutzer, eigene Daten, eigene Rollen. |

**Nicht verhandelbare Anforderungen:**
- Vollständige Datentrennung zwischen Tenants (Row-Level Security in PostgreSQL)
- Admin-Zugriff auf Tenant-Daten **nur** mit gespeichertem, widerruflichem Consent + Audit-Log-Eintrag
- Granulares Rechte-System (RBAC + Permission-Flags) auf beiden Ebenen
- DSGVO-ready von Tag 1 (Datenlokalisierung DE/EU, Audit-Trail, Löschkonzept)
- Zero-Trust zwischen Modulen (jede Server Action prüft Permissions selbst)

---

## 1 · Tech-Stack (verbindlich)

```
Runtime:        Node.js 20 LTS
Framework:      Next.js 15 (App Router, Server Actions, Server Components)
Sprache:        TypeScript 5 – strict mode, keine `any`
Datenbank:      PostgreSQL 16 (mit Row-Level Security aktiviert)
ORM:            Drizzle ORM + drizzle-kit (Migrations)
Auth:           Better Auth (eigene Instanz, kein Third-Party-SSO im ersten Schritt)
UI:             shadcn/ui + Tailwind CSS v4
Validierung:    Zod (alle Inputs – API, Forms, Env)
E-Mail:         Resend (transaktional)
Logging:        Pino (strukturiert, JSON)
Testing:        Vitest + Playwright (E2E)
Hosting:        Hetzner (Coolify oder bare Docker Compose)
```

**Pakete, die du NICHT verwendest (begründet):**
- `any` TypeScript-Typ → niemals
- `prisma` → Drizzle wegen besserer RLS-Kontrolle
- `next-auth v4` → Better Auth wegen Multi-Tenant-Support
- `console.log` in Produktion → Pino verwenden

---

## 2 · Projektstruktur (muss exakt so angelegt werden)

```
/
├── apps/
│   └── web/                        # Next.js App
│       ├── app/
│       │   ├── (auth)/             # Login, Register, Password-Reset
│       │   ├── (admin)/            # Super-Admin-Bereich
│       │   │   ├── layout.tsx      # Admin-Auth-Guard
│       │   │   ├── dashboard/
│       │   │   ├── tenants/        # Tenant-Verwaltung
│       │   │   └── access-requests/# Consent-Workflow
│       │   └── (tenant)/           # Tenant-Bereich
│       │       ├── layout.tsx      # Tenant-Auth-Guard + Tenant-Resolver
│       │       └── [tenant]/
│       │           ├── dashboard/
│       │           └── crm/        # CRM-Modul
│       ├── components/
│       │   ├── ui/                 # shadcn primitives (nicht anfassen)
│       │   ├── admin/              # Admin-spezifische Komponenten
│       │   └── crm/                # CRM-Komponenten
│       ├── lib/
│       │   ├── auth/               # Better Auth Konfiguration
│       │   ├── db/                 # Drizzle Client + RLS-Helpers
│       │   ├── permissions/        # Permission-Check-Funktionen
│       │   ├── audit/              # Audit-Log-Helpers
│       │   └── validators/         # Zod-Schemas
│       └── server/
│           └── actions/            # Server Actions (nie direkt aus Client importieren)
├── packages/
│   ├── db/                         # Drizzle Schema + Migrations (shared)
│   │   ├── schema/
│   │   │   ├── system.ts           # System-Tabellen (Tenants, Admin-User)
│   │   │   ├── auth.ts             # Better Auth Tabellen
│   │   │   ├── permissions.ts      # Rollen + Permissions
│   │   │   ├── crm.ts              # CRM-Tabellen
│   │   │   └── audit.ts            # Audit-Log
│   │   └── migrations/
│   └── types/                      # Geteilte TypeScript-Typen
├── docker-compose.yml
├── docker-compose.prod.yml
└── .env.example                    # Alle benötigten Env-Vars dokumentiert
```

---

## 3 · Datenbank-Schema (Phase 1 – vollständig implementieren)

### 3.1 Tenants & System

```sql
-- packages/db/schema/system.ts

tenants
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
  slug          text UNIQUE NOT NULL          -- URL-Identifier z.B. "acme-gmbh"
  name          text NOT NULL
  plan          text NOT NULL DEFAULT 'trial' -- trial | starter | professional | enterprise
  status        text NOT NULL DEFAULT 'active'-- active | suspended | deleted
  admin_consent boolean NOT NULL DEFAULT false-- Zugriff für Super-Admin erlaubt?
  consent_granted_at timestamptz
  consent_granted_by uuid                     -- FK → tenant_users.id
  created_at    timestamptz DEFAULT now()
  updated_at    timestamptz DEFAULT now()
  deleted_at    timestamptz                   -- Soft Delete

tenant_settings
  tenant_id     uuid PRIMARY KEY REFERENCES tenants(id)
  locale        text DEFAULT 'de-DE'
  timezone      text DEFAULT 'Europe/Berlin'
  date_format   text DEFAULT 'DD.MM.YYYY'
  currency      text DEFAULT 'EUR'
  fiscal_year_start integer DEFAULT 1         -- Monat (1 = Januar)
```

### 3.2 Benutzer & Auth

```sql
-- packages/db/schema/auth.ts
-- Better Auth generiert seine eigenen Tabellen (users, sessions, accounts, verifications)
-- WIR ergänzen:

system_admin_users
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
  user_id       uuid REFERENCES users(id) ON DELETE CASCADE
  role          text NOT NULL DEFAULT 'admin' -- admin | superadmin
  is_active     boolean DEFAULT true
  created_at    timestamptz DEFAULT now()

tenant_users
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
  tenant_id     uuid REFERENCES tenants(id) ON DELETE CASCADE
  user_id       uuid REFERENCES users(id) ON DELETE CASCADE
  is_active     boolean DEFAULT true
  invited_by    uuid REFERENCES tenant_users(id)
  created_at    timestamptz DEFAULT now()
  UNIQUE(tenant_id, user_id)
```

### 3.3 Permissions (RBAC)

```sql
-- packages/db/schema/permissions.ts

roles
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
  tenant_id     uuid REFERENCES tenants(id)   -- NULL = System-Rolle
  name          text NOT NULL
  description   text
  is_system     boolean DEFAULT false          -- Systemrollen können nicht gelöscht werden
  created_at    timestamptz DEFAULT now()
  UNIQUE(tenant_id, name)

-- Verfügbare Permissions als Enum-ähnliche Konstante in TypeScript definieren
-- Format: MODULE:RESOURCE:ACTION
-- Beispiele:
--   crm:contacts:read
--   crm:contacts:write
--   crm:contacts:delete
--   crm:companies:read
--   admin:tenants:read
--   admin:tenants:impersonate

permissions
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
  key           text UNIQUE NOT NULL           -- z.B. "crm:contacts:read"
  module        text NOT NULL                  -- z.B. "crm"
  resource      text NOT NULL                  -- z.B. "contacts"
  action        text NOT NULL                  -- read | write | delete | admin
  description   text

role_permissions
  role_id       uuid REFERENCES roles(id) ON DELETE CASCADE
  permission_id uuid REFERENCES permissions(id) ON DELETE CASCADE
  PRIMARY KEY (role_id, permission_id)

user_roles
  user_id       uuid REFERENCES users(id) ON DELETE CASCADE
  role_id       uuid REFERENCES roles(id) ON DELETE CASCADE
  tenant_id     uuid REFERENCES tenants(id)   -- NULL = gilt systemweit
  granted_by    uuid REFERENCES users(id)
  granted_at    timestamptz DEFAULT now()
  PRIMARY KEY (user_id, role_id, tenant_id)

-- Direkte Permission-Overrides (Ausnahmen von Rollen)
user_permission_overrides
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
  user_id       uuid REFERENCES users(id) ON DELETE CASCADE
  permission_id uuid REFERENCES permissions(id) ON DELETE CASCADE
  tenant_id     uuid REFERENCES tenants(id)
  type          text NOT NULL                  -- 'grant' | 'deny'
  reason        text
  granted_by    uuid REFERENCES users(id)
  granted_at    timestamptz DEFAULT now()
  expires_at    timestamptz                    -- optional
```

### 3.4 CRM-Modul

```sql
-- packages/db/schema/crm.ts
-- ALLE Tabellen haben tenant_id – kein Eintrag ohne Mandantenzugehörigkeit

contacts
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
  type          text NOT NULL DEFAULT 'person' -- person | company
  salutation    text
  first_name    text
  last_name     text
  company_name  text                           -- Bei type='company'
  email         text
  phone         text
  mobile        text
  website       text
  notes         text
  tags          text[]
  assigned_to   uuid REFERENCES tenant_users(id)
  created_by    uuid NOT NULL REFERENCES tenant_users(id)
  created_at    timestamptz DEFAULT now()
  updated_at    timestamptz DEFAULT now()
  deleted_at    timestamptz                    -- Soft Delete (DSGVO: separate Löschanforderung)

contact_addresses
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
  contact_id    uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
  type          text DEFAULT 'billing'         -- billing | shipping | other
  street        text
  city          text
  zip           text
  country       text DEFAULT 'DE'
  is_primary    boolean DEFAULT false

contact_relationships
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
  from_contact  uuid NOT NULL REFERENCES contacts(id)
  to_contact    uuid NOT NULL REFERENCES contacts(id)
  relation_type text NOT NULL                  -- employee_of | subsidiary_of | partner_of

-- Für spätere Module vorbereitet (foreign key placeholder)
contact_notes
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
  contact_id    uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE
  content       text NOT NULL
  created_by    uuid NOT NULL REFERENCES tenant_users(id)
  created_at    timestamptz DEFAULT now()
```

### 3.5 Audit-Log

```sql
-- packages/db/schema/audit.ts
-- UNVERÄNDERLICH – kein UPDATE, kein DELETE auf dieser Tabelle (via RLS)

audit_logs
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
  tenant_id     uuid REFERENCES tenants(id)   -- NULL = Systemereignis
  actor_user_id uuid                           -- Wer hat gehandelt?
  actor_type    text NOT NULL                  -- 'tenant_user' | 'system_admin' | 'system'
  impersonated_as uuid                         -- Falls Admin als Tenant-User agiert
  action        text NOT NULL                  -- z.B. "crm.contact.created"
  resource_type text                           -- z.B. "contact"
  resource_id   uuid
  payload       jsonb                          -- Vorher/Nachher-Snapshot (sensible Felder maskieren)
  ip_address    text
  user_agent    text
  created_at    timestamptz DEFAULT now()

-- Index für schnelle Abfragen
CREATE INDEX idx_audit_tenant_created ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_actor ON audit_logs(actor_user_id, created_at DESC);
```

---

## 4 · Row-Level Security (RLS) – kritisch, nicht überspringen

**Implementiere RLS direkt nach den Migrations, BEVOR du Server Actions schreibst.**

```sql
-- Für JEDE Tabelle mit tenant_id:

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Policy: Tenant-User sehen nur eigene Daten
CREATE POLICY tenant_isolation ON contacts
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Policy: Gelöschte Einträge ausblenden
CREATE POLICY hide_deleted ON contacts
  USING (deleted_at IS NULL);

-- Policy: Super-Admin mit Consent darf lesen
CREATE POLICY admin_access ON contacts
  USING (
    current_setting('app.actor_type', true) = 'system_admin'
    AND EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = contacts.tenant_id
      AND t.admin_consent = true
    )
  );
```

**Drizzle RLS-Helper (lib/db/rls.ts):**

```typescript
// Diese Funktion MUSS am Anfang JEDER Server Action aufgerufen werden
export async function withTenantContext<T>(
  tenantId: string,
  actorType: 'tenant_user' | 'system_admin',
  fn: (db: DrizzleDB) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT set_config('app.current_tenant_id', ${tenantId}, true),
             set_config('app.actor_type', ${actorType}, true)
    `);
    return fn(tx);
  });
}
```

---

## 5 · Permission-System (Implementierung)

### 5.1 Permission-Konstanten (TypeScript)

```typescript
// packages/types/permissions.ts
// SINGLE SOURCE OF TRUTH – alle Permission-Keys hier definieren

export const PERMISSIONS = {
  // CRM
  CRM_CONTACTS_READ:    'crm:contacts:read',
  CRM_CONTACTS_WRITE:   'crm:contacts:write',
  CRM_CONTACTS_DELETE:  'crm:contacts:delete',
  CRM_COMPANIES_READ:   'crm:companies:read',
  CRM_COMPANIES_WRITE:  'crm:companies:write',
  
  // Admin
  ADMIN_TENANTS_READ:        'admin:tenants:read',
  ADMIN_TENANTS_WRITE:       'admin:tenants:write',
  ADMIN_TENANTS_IMPERSONATE: 'admin:tenants:impersonate',
  ADMIN_USERS_READ:          'admin:users:read',
  ADMIN_USERS_WRITE:         'admin:users:write',
} as const;

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS];
```

### 5.2 Permission-Check-Funktion

```typescript
// lib/permissions/check.ts

interface PermissionContext {
  userId: string;
  tenantId?: string;          // undefined = System-Kontext
  actorType: 'tenant_user' | 'system_admin';
}

export async function hasPermission(
  ctx: PermissionContext,
  permission: PermissionKey
): Promise<boolean> {
  // 1. Direkte DENY-Overrides haben absoluten Vorrang
  // 2. Rollen prüfen
  // 3. Direkte GRANT-Overrides
  // Implementierung via Datenbankabfrage (kein Caching in Phase 1)
}

// Wrapper: wirft Fehler statt boolean zurückzugeben
export async function requirePermission(
  ctx: PermissionContext,
  permission: PermissionKey
): Promise<void> {
  const allowed = await hasPermission(ctx, permission);
  if (!allowed) {
    throw new PermissionDeniedError(permission);
  }
}
```

### 5.3 Vordeffinierte System-Rollen (Seed-Daten)

```
SUPER_ADMIN   → alle Permissions
ADMIN         → alle Admin-Permissions, kein Impersonate
TENANT_OWNER  → alle Tenant-Permissions
TENANT_ADMIN  → alle Tenant-Permissions außer User-Delete
TENANT_USER   → read-only auf alle Modules
```

---

## 6 · Admin-Consent-Workflow (sicherheitskritisch)

Der Admin-Zugriff auf Tenant-Daten erfordert einen expliziten, auditierten Freigabeprozess.

### Ablauf (muss exakt so implementiert werden):

```
1. Super-Admin erstellt Access-Request (mit Begründung + Ablaufzeit)
   → Eintrag in access_requests Tabelle (status: 'pending')
   → E-Mail an Tenant-Owner via Resend

2. Tenant-Owner genehmigt/lehnt ab in seinem Dashboard
   → Bei Genehmigung: tenants.admin_consent = true, consent_granted_at = now()
   → Audit-Log-Eintrag: "admin_access.granted" mit Begründung

3. Super-Admin kann jetzt zugreifen (RLS-Policy greift)
   → JEDE Aktion im Tenant-Kontext schreibt Audit-Log mit actor_type='system_admin'
   → Impersonation wird separat geloggt

4. Consent läuft automatisch ab (cron-Job) oder wird widerrufen
   → tenants.admin_consent = false
   → Audit-Log: "admin_access.revoked"
```

**Neue Tabelle für diesen Workflow:**

```sql
access_requests
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
  tenant_id     uuid NOT NULL REFERENCES tenants(id)
  requested_by  uuid NOT NULL REFERENCES system_admin_users(id)
  reason        text NOT NULL
  status        text DEFAULT 'pending'         -- pending | approved | rejected | expired
  expires_at    timestamptz NOT NULL           -- max. 30 Tage
  reviewed_by   uuid REFERENCES tenant_users(id)
  reviewed_at   timestamptz
  created_at    timestamptz DEFAULT now()
```

---

## 7 · Implementierungsreihenfolge (Phase für Phase)

### ⚡ WICHTIG: Beginne nie mit Phase N+1 bevor Phase N vollständig getestet ist.

---

### Phase 1: Fundament (Infrastruktur)

**Ziel:** Lauffähiges Projekt mit DB, Auth und leerer Shell.

```
□ Turborepo-Monorepo initialisieren (apps/web, packages/db, packages/types)
□ PostgreSQL Docker-Container konfigurieren (docker-compose.yml)
□ Drizzle ORM einrichten + drizzle.config.ts
□ Alle Schema-Dateien aus Abschnitt 3 anlegen
□ Erste Migration ausführen: npx drizzle-kit generate + migrate
□ RLS-Policies aus Abschnitt 4 als SQL-Migration anlegen
□ Better Auth initialisieren (Email/Password, kein OAuth in Phase 1)
□ Env-Variablen dokumentieren (.env.example)
□ Pino-Logger konfigurieren
□ Zod-Env-Schema (alle Env-Vars zur Boot-Zeit validieren, App startet nicht bei Fehler)
```

**Akzeptanzkriterien Phase 1:**
- `npx drizzle-kit push` läuft fehlerfrei durch
- Better Auth Sign-Up/Sign-In funktioniert
- RLS: Direkter DB-Query ohne `set_config` gibt 0 Zeilen zurück (manuell testen!)

---

### Phase 2: Tenant-Management (Admin-Seite)

**Ziel:** Super-Admin kann Tenants anlegen und verwalten.

```
□ withTenantContext Helper (lib/db/rls.ts)
□ Permission-Konstanten (packages/types/permissions.ts)
□ hasPermission / requirePermission (lib/permissions/check.ts)
□ Audit-Log Helper: auditLog(ctx, action, payload) (lib/audit/index.ts)
□ Seed-Script: System-Rollen + Permissions in DB schreiben
□ Admin-Layout mit Auth-Guard (nur system_admin_users)
□ Server Actions: createTenant, updateTenant, suspendTenant
□ Admin-UI: Tenant-Liste, Tenant-Detail
□ Seed-Script: ersten Super-Admin-User anlegen (npm run seed:admin)
```

**Akzeptanzkriterien Phase 2:**
- Admin kann Tenant anlegen; Tenant erscheint in Liste
- Permission-Check: Nicht-Admin-User erhält 403
- Audit-Log enthält Eintrag für jede Mutation
- RLS: Admin ohne Consent sieht keine Tenant-Daten (Unit-Test!)

---

### Phase 3: Tenant-Auth & User-Management

**Ziel:** Tenant-User können sich registrieren und einloggen.

```
□ Tenant-Resolver Middleware: Slug aus URL → tenant_id (Middleware in Next.js)
□ Tenant-Auth-Guard (app/(tenant)/layout.tsx)
□ Tenant-Onboarding-Flow (Invite via E-Mail)
□ Tenant-User-Verwaltung: invite, deactivate, assign-role
□ Tenant-Rollen-Verwaltung: Rollen anlegen, Permissions zuweisen
□ User-Permission-Overrides: grant/deny für einzelne User
```

**Akzeptanzkriterien Phase 3:**
- Tenant-User sieht nur eigene Tenant-Daten (RLS-Test!)
- Einladungs-E-Mail kommt an (Resend-Integration)
- Rollen können frei konfiguriert werden
- Permission-Override: DENY schlägt Rollen-GRANT (Test!)

---

### Phase 4: Admin-Consent-Workflow

**Ziel:** Super-Admin kann nach Freigabe auf Tenant zugreifen.

```
□ access_requests Tabelle + Migration
□ Server Action: requestAccess (Admin erstellt Anfrage)
□ E-Mail-Benachrichtigung an Tenant-Owner
□ Tenant-Dashboard: Anfrage anzeigen, genehmigen/ablehnen
□ Server Action: approveAccess / revokeAccess
□ Admin-Impersonation: withTenantContext mit actorType='system_admin'
□ Cron-Job (oder tägliche Prüfung): abgelaufene Consents deaktivieren
□ Admin-UI: Tenant-Daten im Read-Only-Modus mit Consent-Banner
```

**Akzeptanzkriterien Phase 4:**
- Ohne Consent: Admin erhält 403 auf Tenant-Daten (auch direkt in DB geprüft!)
- Mit Consent: Admin kann lesen, jede Aktion im Audit-Log sichtbar
- Revoke: Sofortige Wirkung, nächste Anfrage schlägt fehl

---

### Phase 5: CRM-Modul

**Ziel:** Vollständige Kontaktverwaltung für Tenant-User.

```
□ Zod-Schemas für alle CRM-Entitäten (lib/validators/crm.ts)
□ Server Actions:
  - createContact, updateContact, softDeleteContact
  - createCompany, updateCompany
  - linkContactToCompany
  - addContactNote
□ CRM-UI:
  - Kontakt-Liste (mit Suche, Filter, Paginierung)
  - Kontakt-Detail-Seite
  - Kontakt-Formular (Anlage / Bearbeitung)
  - Unternehmens-Ansicht mit zugeordneten Personen
□ Soft-Delete mit DSGVO-Hinweis (Daten werden nach X Tagen endgültig gelöscht)
□ Permission-Guards in JEDER Server Action
```

**Akzeptanzkriterien Phase 5:**
- Tenant A sieht keine Kontakte von Tenant B (RLS-Test mit zwei Tenants!)
- TENANT_USER (read-only) kann nicht schreiben (Permission-Test!)
- Soft-Delete funktioniert, Kontakt verschwindet aus Liste, Audit-Log-Eintrag vorhanden

---

### Phase 6: Testing & Hardening

```
□ Vitest Unit-Tests: Permission-System (alle Rollenkombinationen)
□ Vitest Unit-Tests: RLS-Isolation (kritischste Tests!)
□ Playwright E2E: Login-Flow, Tenant-Onboarding, Kontakt anlegen
□ Playwright E2E: Admin-Consent-Workflow komplett
□ Security-Review:
  □ Alle Server Actions: Input-Validierung mit Zod vorhanden?
  □ Alle Server Actions: requirePermission aufgerufen?
  □ Alle Queries: innerhalb von withTenantContext?
  □ Keine direkten DB-Queries aus Client Components?
  □ Keine sensitiven Daten in Audit-Log-Payload? (Passwörter etc. maskiert)
□ .env.example vollständig?
□ README.md: Lokales Setup, Deployment, Seed-Skripte
```

---

## 8 · Coding-Regeln (absolut verbindlich)

### 8.1 Server Actions

```typescript
// IMMER dieses Muster verwenden:

'use server';

export async function createContact(input: unknown) {
  // 1. Session holen
  const session = await getSession();
  if (!session) throw new UnauthorizedError();

  // 2. Permission prüfen (VOR Validierung – fail fast)
  await requirePermission(
    { userId: session.userId, tenantId: session.tenantId, actorType: session.actorType },
    PERMISSIONS.CRM_CONTACTS_WRITE
  );

  // 3. Input validieren
  const data = contactCreateSchema.parse(input);

  // 4. RLS-Kontext setzen und Query ausführen
  return withTenantContext(session.tenantId, session.actorType, async (db) => {
    const contact = await db.insert(contacts).values({
      ...data,
      tenantId: session.tenantId,
      createdBy: session.userId,
    }).returning();

    // 5. Audit-Log
    await auditLog({
      tenantId: session.tenantId,
      actorUserId: session.userId,
      actorType: session.actorType,
      action: 'crm.contact.created',
      resourceType: 'contact',
      resourceId: contact[0].id,
      payload: { name: `${data.firstName} ${data.lastName}` }, // minimal!
    });

    return contact[0];
  });
}
```

### 8.2 Verbote

```
❌ Niemals raw SQL-Strings mit Template-Literals (SQL-Injection-Gefahr)
   → Immer Drizzle-Query-Builder oder sql`` mit parametrisierten Werten

❌ Niemals tenant_id aus dem Input des Users übernehmen
   → tenant_id IMMER aus der Session lesen

❌ Niemals Permission-Checks in Client Components
   → Nur serverseitig in Server Actions / Route Handlers

❌ Niemals sensible Daten (Passwörter, Tokens, IBAN) im Audit-Log speichern
   → Payload-Funktion mit allowlist schreiben

❌ Niemals Migrations manuell bearbeiten nachdem sie applied wurden
   → Neue Migration erstellen

❌ Niemals `console.log` in Produktionscode
   → logger.info() / logger.error() mit Pino

❌ Niemals Fehler kommentarlos schlucken
   → try/catch immer mit logger.error + strukturierten Feldern
```

### 8.3 Fehlerbehandlung

```typescript
// lib/errors.ts – Eigene Error-Klassen
export class UnauthorizedError extends Error { statusCode = 401 }
export class PermissionDeniedError extends Error { statusCode = 403 }
export class NotFoundError extends Error { statusCode = 404 }
export class ValidationError extends Error { statusCode = 422 }
export class ConflictError extends Error { statusCode = 409 }

// Server Actions geben IMMER dieses Format zurück:
type ActionResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string; code?: string }
```

---

## 9 · Sicherheitscheckliste (vor jedem Commit prüfen)

```
□ Alle neuen Tabellen haben tenant_id + RLS-Policy?
□ Alle neuen Server Actions: requirePermission aufgerufen?
□ Alle neuen Server Actions: Zod-Validierung auf Input?
□ Alle neuen Server Actions: withTenantContext verwendet?
□ Alle Mutationen: Audit-Log-Eintrag?
□ Keine neuen `any`-Typen in TypeScript?
□ Keine Secrets/Passwörter in Code oder Git?
□ Soft-Delete statt Hard-Delete implementiert?
```

---

## 10 · Umgebungsvariablen (.env.example)

```bash
# Datenbank
DATABASE_URL="postgresql://user:password@localhost:5432/accounting"
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Better Auth
BETTER_AUTH_SECRET="min-32-zeichen-zufalls-string"
BETTER_AUTH_URL="http://localhost:3000"

# E-Mail (Resend)
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="noreply@deine-domain.de"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
APP_ENV="development"                         # development | staging | production

# Logging
LOG_LEVEL="info"                              # trace | debug | info | warn | error

# Admin-Consent: maximale Gültigkeitsdauer in Tagen
ADMIN_CONSENT_MAX_DAYS=30
```

---

## 11 · Erste Befehle nach Projektstart

```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Env-Datei anlegen
cp .env.example .env.local
# .env.local mit echten Werten befüllen

# 3. Datenbank starten
docker-compose up -d postgres

# 4. Migrationen ausführen
npx drizzle-kit migrate

# 5. Seed: System-Rollen + erster Admin
npm run seed:system
npm run seed:admin   # fragt nach E-Mail + Passwort

# 6. Entwicklungsserver starten
npm run dev

# 7. Tests ausführen
npm run test
```

---

## 12 · Modul-Erweiterbarkeit (Hinweis für spätere Module)

Das CRM definiert die Patterns für alle weiteren Module. Bei neuen Modulen:

1. **Schema** in `packages/db/schema/<modul>.ts` anlegen (immer mit `tenant_id`)
2. **Permissions** in `packages/types/permissions.ts` ergänzen
3. **Seed** um neue Permissions erweitern (`npm run seed:permissions`)
4. **Server Actions** immer nach dem Muster aus Abschnitt 8.1
5. **Tests**: Minimum 1 RLS-Isolationstest + 1 Permission-Test pro neuer Resource

Vorbereitete Modul-Slots (können später aktiviert werden):
- `accounting` – Buchführung, Kontenrahmen (SKR03/SKR04)
- `invoicing` – Rechnungen, Angebote (Referenz auf CRM-Contacts)
- `banking` – Bankanbindung, Transaktionen
- `reporting` – Berichte, Dashboards
- `documents` – Belegverwaltung, Archivierung (GoBD-konform)

---

## 13 · DSGVO-Hinweise (Pflicht für DE-Markt)

```
□ Alle personenbezogenen Daten in EU-Region hosten (Hetzner Nürnberg/Falkenstein)
□ Datenschutzerklärung im Tenant-Onboarding
□ Löschkonzept: Soft-Delete sofort sichtbar, Hard-Delete nach konfigurierbarer Frist
□ Auskunftsfunktion: alle Daten eines Kontakts exportierbar (JSON/PDF)
□ Verarbeitungsverzeichnis: audit_logs als Grundlage
□ Auftragsverarbeitungsvertrag (AVV) mit Kunden (außerhalb dieser Software)
□ Keine Daten in US-Cloud-Dienste ohne SCCs (Standard Contractual Clauses)
```

---

*Stand: April 2026 – Dieses Dokument ist die einzige Quelle der Wahrheit für Claude Code.
Bei Widersprüchen zwischen dieser Datei und eigenem Vorwissen: diese Datei hat Vorrang.*
