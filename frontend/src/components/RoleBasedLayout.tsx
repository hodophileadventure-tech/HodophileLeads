/**
 * Role-Based UI Router Example - React Component
 * 
 * This demonstrates how to conditionally render different UIs based on user role.
 * Each role gets a completely different interface, navigation, and dashboard.
 * 
 * Usage:
 * ```tsx
 * import RoleBasedLayout from './RoleBasedLayout';
 * 
 * function App() {
 *   const { user } = useAuth();
 *   return <RoleBasedLayout user={user} />;
 * }
 * ```
 */

import { ReactNode, FC } from 'react';

// ============================================================================
// Type Definitions
// ============================================================================

interface User {
  id: string;
  email: string;
  name: string;
  role_slug?: string;
  role?: string;
}

interface LayoutProps {
  user: User;
  children: ReactNode;
}

// ============================================================================
// Sales Team UI Component
// ============================================================================

function SalesTeamLayout({ user, children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-gray-200">
        <div className="p-4 border-b">
          <h1 className="font-bold text-lg text-blue-600">TripNexus</h1>
          <p className="text-sm text-gray-500">Sales Platform</p>
        </div>

        <nav className="p-4 space-y-2">
          {[
            { icon: '📊', label: 'Dashboard', path: '/dashboard' },
            { icon: '👥', label: 'Leads', path: '/leads' },
            { icon: '✓', label: 'Tasks', path: '/tasks' },
            { icon: '📅', label: 'Follow-ups', path: '/follow-ups' },
            { icon: '💳', label: 'Payments', path: '/payments' },
            { icon: '📄', label: 'Quotations', path: '/quotations' },
          ].map((item) => (
            <a
              key={item.path}
              href={item.path}
              className="flex items-center space-x-3 p-3 rounded-lg hover:bg-blue-50 text-gray-700"
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Sales Dashboard</h2>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">{user.name}</span>
            <div className="w-8 h-8 bg-blue-500 rounded-full"></div>
          </div>
        </header>

        {/* Content */}
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}

// ============================================================================
// Content Creator UI Component
// ============================================================================

function ContentCreatorLayout({ user, children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-gray-800 border-r border-gray-700">
        <div className="p-4 border-b border-gray-700">
          <h1 className="font-bold text-lg text-amber-400">Content Studio</h1>
          <p className="text-sm text-gray-400">Creator Platform</p>
        </div>

        <nav className="p-4 space-y-2">
          {[
            { icon: '🎬', label: 'Studio', path: '/content/dashboard' },
            { icon: '📁', label: 'Projects', path: '/content/projects' },
            { icon: '✏️', label: 'Tasks', path: '/content/tasks' },
            { icon: '🖼️', label: 'Media', path: '/content/media' },
            { icon: '📅', label: 'Publishing', path: '/content/schedule' },
            { icon: '📤', label: 'Submissions', path: '/content/submissions' },
          ].map((item) => (
            <a
              key={item.path}
              href={item.path}
              className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-700 text-gray-300"
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-amber-400">Content Creation Studio</h2>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-400">{user.name}</span>
            <div className="w-8 h-8 bg-amber-500 rounded-full"></div>
          </div>
        </header>

        {/* Content */}
        <div className="p-6 text-gray-100">{children}</div>
      </main>
    </div>
  );
}

// ============================================================================
// Video Editor UI Component
// ============================================================================

function VideoEditorLayout({ user, children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-gray-800 border-r border-gray-700">
        <div className="p-4 border-b border-gray-700">
          <h1 className="font-bold text-lg text-red-500">Editor Suite</h1>
          <p className="text-sm text-gray-400">Professional Editor</p>
        </div>

        <nav className="p-4 space-y-2">
          {[
            { icon: '🎞️', label: 'Editor', path: '/editor' },
            { icon: '📁', label: 'Projects', path: '/editor/projects' },
            { icon: '✏️', label: 'Tasks', path: '/editor/tasks' },
            { icon: '🎨', label: 'Assets', path: '/editor/assets' },
            { icon: '💾', label: 'Export', path: '/editor/export' },
          ].map((item) => (
            <a
              key={item.path}
              href={item.path}
              className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-700 text-gray-300"
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-red-500">Video Editor</h2>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-400">{user.name}</span>
            <div className="w-8 h-8 bg-red-600 rounded-full"></div>
          </div>
        </header>

        {/* Content */}
        <div className="p-6 text-gray-100">{children}</div>
      </main>
    </div>
  );
}

// ============================================================================
// Admin Panel UI Component
// ============================================================================

function AdminLayout({ user, children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-gray-200">
        <div className="p-4 border-b">
          <h1 className="font-bold text-lg text-purple-600">Admin Panel</h1>
          <p className="text-sm text-gray-500">System Management</p>
        </div>

        <nav className="p-4 space-y-2">
          {[
            { icon: '📊', label: 'Dashboard', path: '/admin/dashboard' },
            { icon: '👥', label: 'Users & Roles', path: '/admin/users' },
            { icon: '📅', label: 'Attendance', path: '/admin/attendance' },
            { icon: '🗂️', label: 'All Leads', path: '/admin/leads' },
            { icon: '✓', label: 'Tasks', path: '/admin/tasks' },
            { icon: '📈', label: 'Reports', path: '/admin/reports' },
            { icon: '⚙️', label: 'System', path: '/admin/system' },
          ].map((item) => (
            <a
              key={item.path}
              href={item.path}
              className="flex items-center space-x-3 p-3 rounded-lg hover:bg-purple-50 text-gray-700"
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">System Administration</h2>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">{user.name}</span>
            <div className="w-8 h-8 bg-purple-600 rounded-full"></div>
          </div>
        </header>

        {/* Content */}
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}

// ============================================================================
// Main Router Component - Returns correct UI based on role
// ============================================================================

export function RoleBasedLayout({ user, children }: LayoutProps) {
  const roleSlug = user?.role_slug || user?.role || 'agent';

  // Map role to layout
  const layoutMap: Record<string, FC<LayoutProps>> = {
    admin: AdminLayout,
    'sales executive': SalesTeamLayout,
    agent: SalesTeamLayout,
    'sales manager': SalesTeamLayout,
    manager: SalesTeamLayout,
    'content creator': ContentCreatorLayout,
    'video editor': VideoEditorLayout,
  };

  const Layout = layoutMap[roleSlug.toLowerCase()] || SalesTeamLayout;

  return <Layout user={user}>{children}</Layout>;
}

// ============================================================================
// Example Usage in App.tsx
// ============================================================================

// Usage:
// import { RoleBasedLayout } from './components/RoleBasedLayout';
//
// function App() {
//   const { user } = useAuth();
//   return (
//     <RoleBasedLayout user={user}>
//       <Routes>
//         <Route path="/dashboard" element={<SalesDashboard />} />
//         <Route path="/leads" element={<LeadsList />} />
//         <Route path="/tasks" element={<TasksList />} />
//         <Route path="/content/dashboard" element={<ContentDashboard />} />
//         <Route path="/editor" element={<VideoEditor />} />
//         <Route path="/admin/dashboard" element={<AdminDashboard />} />
//       </Routes>
//     </RoleBasedLayout>
//   );
// }

export { SalesTeamLayout, ContentCreatorLayout, VideoEditorLayout, AdminLayout };
