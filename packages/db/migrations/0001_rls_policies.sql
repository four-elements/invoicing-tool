-- RLS-Policies für alle Tabellen mit tenant_id
-- KRITISCH: Muss nach der initialen Drizzle-Migration ausgeführt werden

-- ============================================================
-- contacts
-- ============================================================
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON contacts
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY hide_deleted ON contacts
  USING (deleted_at IS NULL);

CREATE POLICY admin_access ON contacts
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

CREATE POLICY tenant_isolation ON contact_addresses
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY admin_access ON contact_addresses
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

CREATE POLICY tenant_isolation ON contact_relationships
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY admin_access ON contact_relationships
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

CREATE POLICY tenant_isolation ON contact_notes
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY admin_access ON contact_notes
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

CREATE POLICY tenant_isolation ON tenant_settings
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY admin_access ON tenant_settings
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

CREATE POLICY tenant_isolation ON tenant_users
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY admin_access ON tenant_users
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

CREATE POLICY tenant_isolation ON access_requests
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY admin_read ON access_requests
  USING (current_setting('app.actor_type', true) = 'system_admin');

-- ============================================================
-- audit_logs: NUR INSERT erlaubt, kein UPDATE/DELETE
-- ============================================================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_read ON audit_logs
  FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY admin_read ON audit_logs
  FOR SELECT USING (current_setting('app.actor_type', true) = 'system_admin');

CREATE POLICY insert_only ON audit_logs
  FOR INSERT WITH CHECK (true);

-- Kein UPDATE, kein DELETE → keine Policies → automatisch verboten bei RLS

-- ============================================================
-- user_roles / user_permission_overrides: tenant-scoped
-- ============================================================
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON user_roles
  USING (
    tenant_id IS NULL -- Systemrollen: nur für Admins sichtbar
    OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );

ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON user_permission_overrides
  USING (
    tenant_id IS NULL
    OR tenant_id = current_setting('app.current_tenant_id', true)::uuid
  );
