import React from 'react';
import { useUIStore } from '../context/store';

interface SidebarProps {
  navItems: { label: string; href: string; icon: string }[];
  currentPath: string;
  onNavigate: (href: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ navItems, currentPath, onNavigate }) => {
  const { sidebarOpen, toggleSidebar } = useUIStore();

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-lg"
        style={{ background: 'var(--brand)', color: '#000' }}
      >
        ☰
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-[var(--surface)] border-r transform transition-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } md:relative md:translate-x-0 z-40 mt-16 md:mt-0`}
      >
        <nav className="p-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.href}
              onClick={() => {
                onNavigate(item.href);
                if (window.innerWidth < 768) toggleSidebar();
              }}
              className={`w-full text-left rounded-lg transition-colors ${
                currentPath === item.href
                  ? 'nav-item-active'
                  : 'nav-btn'
              }`}
            >
              <span className="mr-3">{item.icon}</span>
              <span style={{color: '#000'}}>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
};
