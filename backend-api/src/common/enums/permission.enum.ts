export enum Permission {
  // User permissions
  USER_READ = 'user:read',
  USER_CREATE = 'user:create',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',

  // Admin permissions
  ADMIN_ACCESS = 'admin:access',
  ADMIN_MANAGE_USERS = 'admin:manage_users',
  ADMIN_MANAGE_ROLES = 'admin:manage_roles',
  ADMIN_VIEW_AUDIT = 'admin:view_audit',
  ADMIN_MANAGE_SETTINGS = 'admin:manage_settings',

  // Tenant permissions
  TENANT_CREATE = 'tenant:create',
  TENANT_READ = 'tenant:read',
  TENANT_UPDATE = 'tenant:update',
  TENANT_DELETE = 'tenant:delete',
  TENANT_MANAGE_USERS = 'tenant:manage_users',
  TENANT_MANAGE_SETTINGS = 'tenant:manage_settings',
  TENANT_VIEW_AUDIT = 'tenant:view_audit',
}
