-- RLS-Policies für alle Tabellen mit tenant_id
-- KRITISCH: Muss nach der initialen Drizzle-Migration ausgeführt werden
--
-- Design-Entscheidungen:
-- 1. FORCE ROW LEVEL SECURITY: gilt auch für den Tabellenbesitzer
-- 2. hide_deleted als RESTRICTIVE Policy: wird immer mit AND angewendet
-- 3. tenant_isolation + admin_access als PERMISSIVE: werden mit OR verknüpft
-- 4. Leerer Setting-String wird explizit abgefangen (current_setting gibt '' zurück wenn nicht gesetzt)

-- ============================================================
-- contacts
-- ============================================================
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts FORCE ROW LEVEL SECURITY;

CREATE POLICY hide_deleted ON contacts
  AS RESTRICTIVE
  FOR ALL
  USING (deleted_at IS NULL);

CREATE POLICY tenant_isolation ON contacts
  AS PERMISSIVE
  FOR ALL
  USING (
    current_setting('app.actor_type', true) = 'tenant_user'
    AND current_setting('app.current_tenant_id', true) <> ''
    AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

CREATE POLICY admin_access ON contacts
  AS PERMISSIVE
  FOR ALL
  USING (
    current_setting('app.actor_type', true) = 'system_admin'
    AND EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = contacts.tenant_id
        AND t.admin_consent = true
    )
  );

-- ============================================================
-- contact_addresses
-- ============================================================
ALTER TABLE contact_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_addresses FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON contact_addresses
  AS PERMISSIVE
  FOR ALL
  USING (
    current_setting('app.actor_type', true) = 'tenant_user'
    AND current_setting('app.current_tenant_id', true) <> ''
    AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

CREATE POLICY admin_access ON contact_addresses
  AS PERMISSIVE
  FOR ALL
  USING (
    current_setting('app.actor_type', true) = 'system_admin'
    AND EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = contact_addresses.tenant_id
        AND t.admin_consent = true
    )
  );

-- ============================================================
-- contact_relationships
-- ============================================================
ALTER TABLE contact_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_relationships FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON contact_relationships
  AS PERMISSIVE
  FOR ALL
  USING (
    current_setting('app.actor_type', true) = 'tenant_user'
    AND current_setting('app.current_tenant_id', true) <> ''
    AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

CREATE POLICY admin_access ON contact_relationships
  AS PERMISSIVE
  FOR ALL
  USING (
    current_setting('app.actor_type', true) = 'system_admin'
    AND EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = contact_relationships.tenant_id
        AND t.admin_consent = true
    )
  );

-- ============================================================
-- contact_notes
-- ============================================================
ALTER TABLE contact_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_notes FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON contact_notes
  AS PERMISSIVE
  FOR ALL
  USING (
    current_setting('app.actor_type', true) = 'tenant_user'
    AND current_setting('app.current_tenant_id', true) <> ''
    AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

CREATE POLICY admin_access ON contact_notes
  AS PERMISSIVE
  FOR ALL
  USING (
    current_setting('app.actor_type', true) = 'system_admin'
    AND EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = contact_notes.tenant_id
        AND t.admin_consent = true
    )
  );

-- ============================================================
-- tenant_settings
-- ============================================================
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON tenant_settings
  AS PERMISSIVE
  FOR ALL
  USING (
    current_setting('app.actor_type', true) = 'tenant_user'
    AND current_setting('app.current_tenant_id', true) <> ''
    AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

CREATE POLICY admin_access ON tenant_settings
  AS PERMISSIVE
  FOR ALL
  USING (
    current_setting('app.actor_type', true) = 'system_admin'
    AND EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = tenant_settings.tenant_id
        AND t.admin_consent = true
    )
  );

-- ============================================================
-- tenant_users
-- ============================================================
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON tenant_users
  AS PERMISSIVE
  FOR ALL
  USING (
    current_setting('app.actor_type', true) = 'tenant_user'
    AND current_setting('app.current_tenant_id', true) <> ''
    AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

CREATE POLICY admin_access ON tenant_users
  AS PERMISSIVE
  FOR ALL
  USING (
    current_setting('app.actor_type', true) = 'system_admin'
    AND EXISTS (
      SELECT 1 FROM tenants t
      WHERE t.id = tenant_users.tenant_id
        AND t.admin_consent = true
    )
  );

-- ============================================================
-- access_requests
-- ============================================================
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_requests FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON access_requests
  AS PERMISSIVE
  FOR ALL
  USING (
    current_setting('app.actor_type', true) = 'tenant_user'
    AND current_setting('app.current_tenant_id', true) <> ''
    AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

CREATE POLICY admin_read ON access_requests
  AS PERMISSIVE
  FOR SELECT
  USING (current_setting('app.actor_type', true) = 'system_admin');

-- ============================================================
-- audit_logs: NUR INSERT erlaubt, kein UPDATE/DELETE via RLS
-- ============================================================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_read ON audit_logs
  AS PERMISSIVE
  FOR SELECT
  USING (
    current_setting('app.actor_type', true) = 'tenant_user'
    AND current_setting('app.current_tenant_id', true) <> ''
    AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

CREATE POLICY admin_read ON audit_logs
  AS PERMISSIVE
  FOR SELECT
  USING (current_setting('app.actor_type', true) = 'system_admin');

-- INSERT immer erlaubt (Audit-Log muss immer schreibbar sein)
CREATE POLICY insert_only ON audit_logs
  AS PERMISSIVE
  FOR INSERT
  WITH CHECK (true);

-- UPDATE/DELETE: keine Policy → automatisch verboten bei aktivem RLS

-- ============================================================
-- user_roles / user_permission_overrides: tenant-scoped
-- ============================================================
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON user_roles
  AS PERMISSIVE
  FOR ALL
  USING (
    (
      current_setting('app.actor_type', true) = 'tenant_user'
    AND current_setting('app.current_tenant_id', true) <> ''
      AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
    )
    OR tenant_id IS NULL  -- System-Rollen: sichtbar für Admins
  );

ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permission_overrides FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON user_permission_overrides
  AS PERMISSIVE
  FOR ALL
  USING (
    (
      current_setting('app.actor_type', true) = 'tenant_user'
    AND current_setting('app.current_tenant_id', true) <> ''
      AND tenant_id = current_setting('app.current_tenant_id', true)::uuid
    )
    OR tenant_id IS NULL
  );
