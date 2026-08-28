import React from 'react';
import { useUIStore } from '../context/store';

interface SidebarProps {
  navItems: { label: string; href: string; icon: string }[];
  currentPath: string;
  onNavigate: (href: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ navItems, currentPath, onNavigate }) => {
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={toggleSidebar}
        className="fixed left-4 top-4 z-50 rounded-md bg-[var(--brand)] p-2 text-[var(--sidebar)] shadow-sm md:hidden"
        aria-label="Open navigation"
      >
        <span aria-hidden="true">☰</span>
      </button>

      {/* Sidebar */}
      <aside
        className={`app-sidebar fixed inset-y-0 left-0 border-r transform transition-all duration-200 ${collapsed ? 'sidebar-collapsed' : ''} ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } md:relative md:translate-x-0 z-40 mt-16 md:mt-0`}
      >
        <div className="sidebar-brand">
          <span className="sidebar-mark">TN</span>
          <div>
            <p className="sidebar-title">TripNexus</p>
            <p className="sidebar-caption">Lead operations</p>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className="sidebar-collapse-button ml-auto hidden rounded-md p-2 text-slate-300 hover:bg-white/10 md:block"
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            <span aria-hidden="true">{collapsed ? '›' : '‹'}</span>
          </button>
        </div>
        <nav className="space-y-1 py-4" aria-label="Primary navigation">
          {navItems.map((item) => (
            <button
              key={item.href}
              onClick={() => {
                onNavigate(item.href);
                if (window.innerWidth < 768) toggleSidebar();
              }}
              className={`sidebar-nav-item w-full text-left rounded-lg transition-colors ${
                currentPath === item.href
                  ? 'nav-item-active'
                  : 'nav-btn'
              }`}
            >
              <span className="sidebar-nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="sidebar-nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
};
