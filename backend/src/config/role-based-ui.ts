/**
 * Role-Based UI Router Configuration
 * 
 * This configuration maps roles to their UI layouts, dashboards, and components.
 * Different roles will see completely different interfaces based on their role assignment.
 * 
 * Usage in Frontend:
 * ```tsx
 * const userRole = getCurrentUserRole(); // from auth context
 * const uiConfig = getRoleUIConfig(userRole);
 * 
 * return (
 *   <>
 *     <Navbar sections={uiConfig.navigation} />
 *     <Sidebar sections={uiConfig.sidebar} />
 *     <Main components={uiConfig.components} />
 *   </>
 * );
 * ```
 */

export type UILayout = 'sales-crm' | 'content-studio' | 'admin-panel' | 'editor-suite';

interface UISection {
  id: string;
  label: string;
  icon: string;
  path: string;
  permission?: string;
}

interface UIConfig {
  layout: UILayout;
  navigation: UISection[];
  sidebar: UISection[];
  dashboardComponents: string[];
  features: string[];
  styling: {
    theme: string;
    accentColor: string;
    logo: string;
  };
  permissions: string[];
}

// ============================================================================
// SALES TEAM UI (Sales Agents & Managers)
// ============================================================================

const SALES_AGENT_UI: UIConfig = {
  layout: 'sales-crm',
  navigation: [
    { id: 'dashboard', label: 'Dashboard', icon: 'gauge', path: '/dashboard' },
    { id: 'leads', label: 'Leads', icon: 'users', path: '/leads' },
    { id: 'tasks', label: 'My Tasks', icon: 'tasks', path: '/tasks' },
    { id: 'follow-ups', label: 'Follow-ups', icon: 'calendar', path: '/follow-ups' },
    { id: 'payments', label: 'Payments', icon: 'credit-card', path: '/payments' },
    { id: 'quotations', label: 'Quotations', icon: 'file-text', path: '/quotations' },
    { id: 'itineraries', label: 'Itineraries', icon: 'map', path: '/itineraries' },
  ],
  sidebar: [
    { id: 'profile', label: 'My Profile', icon: 'user', path: '/profile' },
    { id: 'settings', label: 'Settings', icon: 'settings', path: '/settings' },
    { id: 'reports', label: 'My Reports', icon: 'bar-chart', path: '/reports' },
  ],
  dashboardComponents: [
    'LeadsSummary',
    'UpcomingFollowUps',
    'RecentPayments',
    'QuotationStatus',
    'MyTasks',
    'PerformanceMetrics'
  ],
  features: [
    'lead-management',
    'task-tracking',
    'follow-up-scheduling',
    'payment-tracking',
    'quotation-generation',
    'itinerary-building'
  ],
  styling: {
    theme: 'light',
    accentColor: '#3b82f6', // blue
    logo: '/logo-sales.svg'
  },
  permissions: [
    'leads.view',
    'leads.create',
    'leads.edit',
    'tasks.view',
    'tasks.start',
    'tasks.submit',
    'payments.view',
    'quotations.create'
  ]
};

const SALES_MANAGER_UI: UIConfig = {
  layout: 'sales-crm',
  navigation: [
    { id: 'dashboard', label: 'Dashboard', icon: 'gauge', path: '/dashboard' },
    { id: 'team', label: 'Team Management', icon: 'users', path: '/team' },
    { id: 'leads', label: 'All Leads', icon: 'list', path: '/leads' },
    { id: 'tasks', label: 'Team Tasks', icon: 'tasks', path: '/tasks' },
    { id: 'approvals', label: 'Approvals', icon: 'check-circle', path: '/approvals' },
    { id: 'reports', label: 'Team Reports', icon: 'bar-chart', path: '/reports' },
    { id: 'settings', label: 'Settings', icon: 'settings', path: '/settings' },
  ],
  sidebar: [
    { id: 'team-members', label: 'Team Members', icon: 'people', path: '/team-members' },
    { id: 'performance', label: 'Performance', icon: 'trending-up', path: '/performance' },
    { id: 'quotas', label: 'Quotas', icon: 'target', path: '/quotas' },
  ],
  dashboardComponents: [
    'TeamSummary',
    'LeadPipeline',
    'TeamPerformance',
    'PendingApprovals',
    'TeamMetrics',
    'RevenueForecast'
  ],
  features: [
    'lead-management',
    'team-management',
    'task-tracking',
    'task-approval',
    'performance-analytics',
    'quota-management',
    'follow-up-scheduling'
  ],
  styling: {
    theme: 'light',
    accentColor: '#10b981', // green
    logo: '/logo-manager.svg'
  },
  permissions: [
    'leads.view_all',
    'leads.transfer',
    'tasks.view_all',
    'tasks.create',
    'tasks.assign',
    'tasks.approve',
    'tasks.request_revision',
    'quotations.approve'
  ]
};

// ============================================================================
// CONTENT CREATOR UI
// ============================================================================

const CONTENT_CREATOR_UI: UIConfig = {
  layout: 'content-studio',
  navigation: [
    { id: 'dashboard', label: 'Studio', icon: 'video', path: '/content/dashboard' },
    { id: 'projects', label: 'Projects', icon: 'folder', path: '/content/projects' },
    { id: 'tasks', label: 'Content Tasks', icon: 'clipboard', path: '/content/tasks' },
    { id: 'media', label: 'Media Library', icon: 'image', path: '/content/media' },
    { id: 'schedule', label: 'Publishing', icon: 'calendar', path: '/content/schedule' },
    { id: 'submissions', label: 'Submissions', icon: 'upload', path: '/content/submissions' },
  ],
  sidebar: [
    { id: 'drafts', label: 'Drafts', icon: 'file', path: '/content/drafts' },
    { id: 'analytics', label: 'Analytics', icon: 'bar-chart', path: '/content/analytics' },
    { id: 'guidelines', label: 'Guidelines', icon: 'book', path: '/content/guidelines' },
  ],
  dashboardComponents: [
    'ContentTasksOverview',
    'DraftContent',
    'PublishingSchedule',
    'MediaLibrarySummary',
    'SubmissionStatus',
    'ContentAnalytics'
  ],
  features: [
    'content-creation',
    'task-tracking',
    'media-management',
    'publishing-schedule',
    'version-control',
    'collaboration'
  ],
  styling: {
    theme: 'dark',
    accentColor: '#f59e0b', // amber
    logo: '/logo-content.svg'
  },
  permissions: [
    'content.create',
    'content.edit',
    'content.submit',
    'media.upload',
    'media.view',
    'tasks.view',
    'tasks.start',
    'tasks.submit'
  ]
};

// ============================================================================
// VIDEO EDITOR UI
// ============================================================================

const VIDEO_EDITOR_UI: UIConfig = {
  layout: 'editor-suite',
  navigation: [
    { id: 'editor', label: 'Editor', icon: 'film', path: '/editor' },
    { id: 'projects', label: 'Projects', icon: 'folder', path: '/editor/projects' },
    { id: 'tasks', label: 'Edit Tasks', icon: 'list', path: '/editor/tasks' },
    { id: 'assets', label: 'Assets', icon: 'layers', path: '/editor/assets' },
    { id: 'export', label: 'Export', icon: 'download', path: '/editor/export' },
  ],
  sidebar: [
    { id: 'templates', label: 'Templates', icon: 'layout', path: '/editor/templates' },
    { id: 'effects', label: 'Effects', icon: 'sparkles', path: '/editor/effects' },
    { id: 'music', label: 'Music Library', icon: 'music', path: '/editor/music' },
  ],
  dashboardComponents: [
    'RecentProjects',
    'EditingTasks',
    'ExportQueue',
    'TemplateLibrary',
    'EffectsBrowser',
    'AudioLibrary'
  ],
  features: [
    'video-editing',
    'task-tracking',
    'asset-management',
    'template-library',
    'effects-library',
    'batch-export',
    'collaboration'
  ],
  styling: {
    theme: 'dark',
    accentColor: '#ef4444', // red
    logo: '/logo-editor.svg'
  },
  permissions: [
    'videos.create',
    'videos.edit',
    'videos.submit',
    'assets.view',
    'assets.upload',
    'tasks.view',
    'tasks.start',
    'tasks.submit',
    'export.create'
  ]
};

// ============================================================================
// ADMIN PANEL UI
// ============================================================================

const ADMIN_UI: UIConfig = {
  layout: 'admin-panel',
  navigation: [
    { id: 'dashboard', label: 'Dashboard', icon: 'gauge', path: '/admin/dashboard' },
    { id: 'users', label: 'Users & Roles', icon: 'people', path: '/admin/users' },
    { id: 'leads', label: 'All Leads', icon: 'database', path: '/admin/leads' },
    { id: 'tasks', label: 'Task Management', icon: 'tasks', path: '/admin/tasks' },
    { id: 'reports', label: 'Reports', icon: 'bar-chart', path: '/admin/reports' },
    { id: 'system', label: 'System', icon: 'settings', path: '/admin/system' },
  ],
  sidebar: [
    { id: 'audit-logs', label: 'Audit Logs', icon: 'log', path: '/admin/audit-logs' },
    { id: 'backups', label: 'Backups', icon: 'save', path: '/admin/backups' },
    { id: 'integrations', label: 'Integrations', icon: 'link', path: '/admin/integrations' },
  ],
  dashboardComponents: [
    'SystemOverview',
    'UserManagement',
    'RoleManagement',
    'SystemHealth',
    'AuditTrail',
    'BackupStatus'
  ],
  features: [
    'user-management',
    'role-management',
    'permission-management',
    'system-configuration',
    'audit-logging',
    'backup-management',
    'integration-management',
    'full-data-access'
  ],
  styling: {
    theme: 'light',
    accentColor: '#8b5cf6', // purple
    logo: '/logo-admin.svg'
  },
  permissions: [
    'users.manage',
    'roles.manage',
    'permissions.manage',
    'system.configure',
    'leads.view_all',
    'leads.delete',
    'tasks.view_all',
    'tasks.delete',
    'reports.view_all'
  ]
};

// ============================================================================
// ROLE TO UI MAPPING
// ============================================================================

const ROLE_UI_MAP: Record<string, UIConfig> = {
  admin: ADMIN_UI,
  'sales executive': SALES_AGENT_UI,
  agent: SALES_AGENT_UI,
  'sales manager': SALES_MANAGER_UI,
  manager: SALES_MANAGER_UI,
  'content creator': CONTENT_CREATOR_UI,
  'video editor': VIDEO_EDITOR_UI,
};

/**
 * Get UI configuration for a role
 */
export function getRoleUIConfig(roleSlug: string): UIConfig {
  return ROLE_UI_MAP[roleSlug.toLowerCase()] || SALES_AGENT_UI;
}

/**
 * Get all available UI configurations
 */
export function getAllUIConfigs(): Record<string, UIConfig> {
  return ROLE_UI_MAP;
}

/**
 * Export all UI configurations for frontend
 */
export const ROLE_BASED_UI = {
  admin: ADMIN_UI,
  salesAgent: SALES_AGENT_UI,
  salesManager: SALES_MANAGER_UI,
  contentCreator: CONTENT_CREATOR_UI,
  videoEditor: VIDEO_EDITOR_UI,
};

export default ROLE_BASED_UI;
