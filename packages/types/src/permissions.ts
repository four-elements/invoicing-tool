// SINGLE SOURCE OF TRUTH – alle Permission-Keys hier definieren
// Format: MODULE:RESOURCE:ACTION

export const PERMISSIONS = {
  // CRM
  CRM_CONTACTS_READ:    'crm:contacts:read',
  CRM_CONTACTS_WRITE:   'crm:contacts:write',
  CRM_CONTACTS_DELETE:  'crm:contacts:delete',
  CRM_COMPANIES_READ:   'crm:companies:read',
  CRM_COMPANIES_WRITE:  'crm:companies:write',

  // Admin
  ADMIN_TENANTS_READ:         'admin:tenants:read',
  ADMIN_TENANTS_WRITE:        'admin:tenants:write',
  ADMIN_TENANTS_IMPERSONATE:  'admin:tenants:impersonate',
  ADMIN_USERS_READ:           'admin:users:read',
  ADMIN_USERS_WRITE:          'admin:users:write',
} as const;

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// System-Rollen mit ihren zugehörigen Permissions
export const SYSTEM_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  TENANT_OWNER: 'tenant_owner',
  TENANT_ADMIN: 'tenant_admin',
  TENANT_USER: 'tenant_user',
} as const;

export type SystemRole = typeof SYSTEM_ROLES[keyof typeof SYSTEM_ROLES];

export const SYSTEM_ROLE_PERMISSIONS: Record<SystemRole, PermissionKey[]> = {
  super_admin: Object.values(PERMISSIONS) as PermissionKey[],
  admin: [
    PERMISSIONS.ADMIN_TENANTS_READ,
    PERMISSIONS.ADMIN_TENANTS_WRITE,
    PERMISSIONS.ADMIN_USERS_READ,
    PERMISSIONS.ADMIN_USERS_WRITE,
    PERMISSIONS.CRM_CONTACTS_READ,
    PERMISSIONS.CRM_CONTACTS_WRITE,
    PERMISSIONS.CRM_CONTACTS_DELETE,
    PERMISSIONS.CRM_COMPANIES_READ,
    PERMISSIONS.CRM_COMPANIES_WRITE,
  ],
  tenant_owner: [
    PERMISSIONS.CRM_CONTACTS_READ,
    PERMISSIONS.CRM_CONTACTS_WRITE,
    PERMISSIONS.CRM_CONTACTS_DELETE,
    PERMISSIONS.CRM_COMPANIES_READ,
    PERMISSIONS.CRM_COMPANIES_WRITE,
  ],
  tenant_admin: [
    PERMISSIONS.CRM_CONTACTS_READ,
    PERMISSIONS.CRM_CONTACTS_WRITE,
    PERMISSIONS.CRM_COMPANIES_READ,
    PERMISSIONS.CRM_COMPANIES_WRITE,
  ],
  tenant_user: [
    PERMISSIONS.CRM_CONTACTS_READ,
    PERMISSIONS.CRM_COMPANIES_READ,
  ],
};
