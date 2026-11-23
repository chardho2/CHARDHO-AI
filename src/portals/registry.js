/**
 * Portal registry.
 * The `perm` on each nav item is a convenience for hiding links. The API
 * re-checks every one of these permissions server-side.
 */
export const PORTALS = {
  founder: {
    key: 'founder',
    name: 'Founder',
    route: '/founder',
    icon: 'shield',
    accent: 'from-cyan-400 to-violet-500',
    tagline: 'Complete ownership and platform control',
    nav: [
      { to: '', label: 'Overview', icon: 'grid', page: 'overview' },
      { to: 'users', label: 'Users', icon: 'users', perm: 'users.read', page: 'users' },
      { to: 'permissions', label: 'Roles & permissions', icon: 'lock', perm: 'permissions.manage', page: 'permissions' },
      { to: 'agents', label: 'Agents', icon: 'sparkles', perm: 'agents.read', page: 'agents' },
      { to: 'images', label: 'Image studio', icon: 'image', perm: 'images.generate', page: 'images' },
      { to: 'models', label: 'AI models', icon: 'layers', perm: 'ai_models.read', page: 'models' },
      { to: 'providers', label: 'AI providers', icon: 'server', perm: 'ai_providers.read', page: 'providers' },
      { to: 'tools', label: 'AI tools', icon: 'zap', perm: 'ai_tools.read', page: 'tools' },
      { to: 'workflows', label: 'Workflows', icon: 'layers', perm: 'settings.write', page: 'workflows' },
      { to: 'security', label: 'Security', icon: 'shield', perm: 'security.read', page: 'security' },
      { to: 'audit', label: 'Audit log', icon: 'doc', perm: 'audit.read', page: 'audit' },
      { to: 'usage', label: 'Usage & cost', icon: 'chart', perm: 'usage.read.all', page: 'usage' },
      { to: 'backups', label: 'Backups', icon: 'box', perm: 'backup.manage', page: 'backups' },
      { to: 'settings', label: 'Settings', icon: 'settings', perm: 'settings.write', page: 'settings' },
      { to: 'notifications', label: 'Notifications', icon: 'bell', page: 'notifications' },
      { to: 'profile', label: 'Profile', icon: 'user', page: 'profile' },
    ],
  },
  'super-admin': {
    key: 'super-admin',
    name: 'Super Admin',
    route: '/super-admin',
    icon: 'settings',
    accent: 'from-violet-500 to-blue-500',
    tagline: 'System settings, AI models and administration',
    nav: [
      { to: '', label: 'Overview', icon: 'grid', page: 'overview' },
      { to: 'users', label: 'User management', icon: 'users', perm: 'users.read', page: 'users' },
      { to: 'agents', label: 'Agents', icon: 'sparkles', perm: 'agents.read', page: 'agents' },
      { to: 'images', label: 'Image studio', icon: 'image', perm: 'images.generate', page: 'images' },
      { to: 'models', label: 'AI models', icon: 'layers', perm: 'ai_models.read', page: 'models' },
      { to: 'providers', label: 'AI providers', icon: 'server', perm: 'ai_providers.read', page: 'providers' },
      { to: 'tools', label: 'AI tools', icon: 'zap', perm: 'ai_tools.read', page: 'tools' },
      { to: 'tickets', label: 'Support', icon: 'ticket', perm: 'tickets.read', page: 'tickets' },
      { to: 'moderation', label: 'Content moderation', icon: 'doc', perm: 'content.moderate', page: 'moderation' },
      { to: 'audit', label: 'Audit log', icon: 'doc', perm: 'audit.read', page: 'audit' },
      { to: 'security', label: 'Security', icon: 'shield', perm: 'security.read', page: 'security' },
      { to: 'usage', label: 'Usage', icon: 'chart', perm: 'usage.read.all', page: 'usage' },
      { to: 'settings', label: 'Settings', icon: 'settings', perm: 'settings.write', page: 'settings' },
      { to: 'notifications', label: 'Notifications', icon: 'bell', page: 'notifications' },
      { to: 'profile', label: 'Profile', icon: 'user', page: 'profile' },
    ],
  },
  manager: {
    key: 'manager',
    name: 'Manager',
    route: '/manager',
    icon: 'users',
    accent: 'from-blue-500 to-cyan-400',
    tagline: 'Staff, reports, operations and approvals',
    nav: [
      { to: '', label: 'Overview', icon: 'grid', page: 'overview' },
      { to: 'tasks', label: 'Tasks', icon: 'tasks', perm: 'tasks.read', page: 'tasks' },
      { to: 'staff', label: 'Team', icon: 'users', perm: 'staff.manage', page: 'staff' },
      { to: 'attendance', label: 'Attendance', icon: 'clock', perm: 'attendance.read', page: 'attendance' },
      { to: 'tickets', label: 'Support requests', icon: 'ticket', perm: 'tickets.read', page: 'tickets' },
      { to: 'reports', label: 'Reports', icon: 'chart', perm: 'reports.read', page: 'reports' },
      { to: 'audit', label: 'Activity', icon: 'doc', perm: 'audit.read', page: 'audit' },
      { to: 'notifications', label: 'Notifications', icon: 'bell', page: 'notifications' },
      { to: 'profile', label: 'Profile', icon: 'user', page: 'profile' },
    ],
  },
  staff: {
    key: 'staff',
    name: 'Staff',
    route: '/staff',
    icon: 'tasks',
    accent: 'from-emerald-400 to-cyan-400',
    tagline: 'Assigned work, attendance and tasks',
    nav: [
      { to: '', label: 'Overview', icon: 'grid', page: 'overview' },
      { to: 'tasks', label: 'My tasks', icon: 'tasks', perm: 'tasks.read', page: 'tasks' },
      { to: 'attendance', label: 'Attendance', icon: 'clock', perm: 'attendance.read', page: 'attendance' },
      { to: 'tickets', label: 'My tickets', icon: 'ticket', perm: 'tickets.read', page: 'tickets' },
      { to: 'reports', label: 'Work reports', icon: 'chart', perm: 'reports.read', page: 'reports' },
      { to: 'notifications', label: 'Notifications', icon: 'bell', page: 'notifications' },
      { to: 'profile', label: 'Profile', icon: 'user', page: 'profile' },
    ],
  },
  developer: {
    key: 'developer',
    name: 'Developer',
    route: '/developer',
    icon: 'terminal',
    accent: 'from-amber-400 to-violet-500',
    tagline: 'API, integrations, logs and deployments',
    nav: [
      { to: '', label: 'Overview', icon: 'grid', page: 'overview' },
      { to: 'keys', label: 'API keys', icon: 'key', perm: 'apikeys.read', page: 'apikeys' },
      { to: 'webhooks', label: 'Webhooks', icon: 'zap', perm: 'webhooks.manage', page: 'webhooks' },
      { to: 'logs', label: 'Error logs', icon: 'alert', perm: 'logs.read', page: 'logs' },
      { to: 'deployments', label: 'Deployments', icon: 'server', perm: 'deploy.read', page: 'deployments' },
      { to: 'sandbox', label: 'Sandbox', icon: 'terminal', perm: 'sandbox.use', page: 'sandbox' },
      { to: 'models', label: 'Models', icon: 'layers', perm: 'ai_models.read', page: 'models' },
      { to: 'usage', label: 'Usage', icon: 'chart', perm: 'usage.read.all', page: 'usage' },
      { to: 'notifications', label: 'Notifications', icon: 'bell', page: 'notifications' },
      { to: 'profile', label: 'Profile', icon: 'user', page: 'profile' },
    ],
  },
  app: {
    key: 'app',
    name: 'AI User',
    route: '/app',
    icon: 'sparkles',
    accent: 'from-cyan-400 to-blue-500',
    tagline: 'Every free AI tool, agent and chat history',
    nav: [
      { to: '', label: 'Workspace', icon: 'grid', page: 'overview' },
      { to: 'chat', label: 'AI chat', icon: 'chat', perm: 'chat.use', page: 'chat' },
      { to: 'tools', label: 'AI tools', icon: 'zap', perm: 'ai_tools.read', page: 'tools' },
      { to: 'agents', label: 'Agents', icon: 'sparkles', perm: 'agents.read', page: 'agents' },
      { to: 'images', label: 'Image studio', icon: 'image', perm: 'images.generate', page: 'images' },
      { to: 'history', label: 'Saved chats', icon: 'doc', page: 'history' },
      { to: 'tickets', label: 'Support', icon: 'ticket', page: 'tickets' },
      { to: 'usage', label: 'Usage', icon: 'chart', perm: 'usage.read.self', page: 'usage' },
      { to: 'notifications', label: 'Notifications', icon: 'bell', page: 'notifications' },
      { to: 'profile', label: 'Profile', icon: 'user', page: 'profile' },
    ],
  },
  support: {
    key: 'support',
    name: 'Support',
    route: '/support',
    icon: 'ticket',
    accent: 'from-rose-400 to-violet-500',
    tagline: 'Tickets, customer queries and assistance',
    nav: [
      { to: '', label: 'Overview', icon: 'grid', page: 'overview' },
      { to: 'tickets', label: 'All tickets', icon: 'ticket', perm: 'tickets.read', page: 'tickets' },
      { to: 'users', label: 'Customers', icon: 'users', perm: 'users.read', page: 'users' },
      { to: 'reports', label: 'Reports', icon: 'chart', perm: 'reports.read', page: 'reports' },
      { to: 'notifications', label: 'Notifications', icon: 'bell', page: 'notifications' },
      { to: 'profile', label: 'Profile', icon: 'user', page: 'profile' },
    ],
  },
};

export const PORTAL_LIST = Object.values(PORTALS);

export function portalFor(user) {
  if (!user) return null;
  return PORTALS[user.portal] || PORTALS.app;
}

export function visibleNav(portal, can) {
  return portal.nav.filter((item) => !item.perm || can(item.perm));
}
