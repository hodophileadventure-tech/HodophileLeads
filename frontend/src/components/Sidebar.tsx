import React from 'react';
import { useUIStore } from '../context/store';
import { Activity, BarChart3, Bell, CalendarDays, CheckSquare, FileCheck2, FileText, GitBranch, Hotel, LayoutDashboard, Map, Megaphone, Receipt, ShieldCheck, Users, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import hodophileLogo from '../assets/hodophile-logo-black.png';

interface SidebarProps {
  navItems: { label: string; href: string; icon: string }[];
  currentPath: string;
  onNavigate: (href: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ navItems, currentPath, onNavigate }) => {
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const [collapsed, setCollapsed] = React.useState(false);

  const iconMap: Record<string, LucideIcon> = {
    Dashboard: LayoutDashboard,
    Leads: Users,
    'Follow-ups': Bell,
    'Report Issue': Megaphone,
    'Users & Roles': ShieldCheck,
    Attendance: CalendarDays,
    'Task Management': CheckSquare,
    'Daily Reports': BarChart3,
    'Quotes & Invoices': Receipt,
    'Pending Quotes': FileText,
    'Pending Invoices': FileCheck2,
    'Quotation Approvals': ShieldCheck,
    'Manager Quotations': FileText,
    'Quick Summary': Activity,
    'Transfer Leads': GitBranch,
    'Hotel Directory': Hotel,
    'Agent Panel': Users,
    'Created Quotations': FileText,
    Itineraries: Map,
    'Developer Panel': Wrench,
    'Git History': GitBranch,
    Analytics: BarChart3,
    Workspace: LayoutDashboard,
    'My Tasks': CheckSquare
  };

  const getSection = (label: string) => {
    if (['Dashboard', 'Workspace'].includes(label)) return 'Overview';
    if (['Leads', 'Follow-ups', 'Agent Panel'].includes(label)) return 'Sales';
    if (['Quotes & Invoices', 'Pending Quotes', 'Pending Invoices', 'Quotation Approvals', 'Manager Quotations', 'Created Quotations'].includes(label)) return 'Commercial';
    if (['Hotel Directory', 'Itineraries', 'Transfer Leads'].includes(label)) return 'Operations';
    if (['Users & Roles', 'Attendance', 'Task Management', 'My Tasks'].includes(label)) return 'People';
    if (['Analytics', 'Quick Summary', 'Daily Reports'].includes(label)) return 'Analytics';
    return 'Workspace';
  };

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
          <img src={hodophileLogo} alt="Hodophile logo" className="h-auto w-full max-w-[175px] object-contain" />
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
        <nav className="space-y-4 py-4" aria-label="Primary navigation">
          {navItems.map((item, index) => {
            const previous = navItems[index - 1];
            const section = getSection(item.label);
            const showSection = !previous || getSection(previous.label) !== section;
            const Icon = iconMap[item.label] || Activity;
            return (
              <div key={`${item.href}-${item.label}`}>
                {showSection && <p className="sidebar-section-label">{section}</p>}
                <button
                  onClick={() => {
                    onNavigate(item.href);
                    if (window.innerWidth < 768) toggleSidebar();
                  }}
                  className={`sidebar-nav-item w-full text-left rounded-lg transition-colors ${
                    currentPath === item.href ? 'nav-item-active' : 'nav-btn'
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="sidebar-nav-icon" aria-hidden="true"><Icon size={16} strokeWidth={1.9} /></span>
                  <span className="sidebar-nav-label">{item.label}</span>
                </button>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
};
