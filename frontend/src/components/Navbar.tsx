import React from 'react';
import { useAuth } from '../context/AuthContext';
import { notificationsAPI } from '../utils/api-service';
import { useDataStore } from '../context/store';
import RemindersPanel from './RemindersPanel';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [userOpen, setUserOpen] = React.useState(false);
  const notifications = useDataStore((s) => s.notifications);
  const setNotifications = useDataStore((s) => s.setNotifications);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await notificationsAPI.list();
        if (mounted) setNotifications(res.data || []);
      } catch (err) {
        // ignore
      }
    };
    load();
    const id = window.setInterval(load, 30000);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [setNotifications]);

  if (!user) return null;

  const [remindersOpen, setRemindersOpen] = React.useState(false);

  return (
    <>
    <nav className="brand-header border-b sticky top-0 z-10">
      <div className="px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold" style={{color: '#000000'}}>TRIPNEXUS</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="relative px-3 py-2 rounded-lg hover:bg-[rgba(0,0,0,0.04)]"
            >
              <span className="sr-only">Notifications</span>
              <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118.6 14.6V11a6 6 0 10-12 0v3.6c0 .538-.214 1.055-.595 1.422L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">{unreadCount}</span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-700 rounded-lg shadow-lg z-20">
                <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-600">
                  <p className="text-sm font-medium">Notifications</p>
                </div>
                <div className="max-h-64 overflow-auto">
                  {notifications.length === 0 && (
                    <div className="p-4 text-sm text-slate-500">No notifications</div>
                  )}
                  {notifications.map((n: any) => (
                    <div key={n.id} className={`px-4 py-3 border-b border-slate-100 dark:border-slate-600 ${n.is_read ? 'bg-white dark:bg-slate-700' : 'bg-slate-50 dark:bg-slate-800'}`}>
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{n.message}</p>
                          <p className="text-xs text-slate-500">{new Date(n.created_at).toLocaleString()}</p>
                        </div>
                        <div>
                          {!n.is_read && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await notificationsAPI.markRead(n.id);
                                  const res = await notificationsAPI.list();
                                  setNotifications(res.data || []);
                                } catch (err) {}
                              }}
                              className="text-xs px-2 py-1 rounded bg-primary-500 text-white"
                            >
                              Mark
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
            <div>
            <button onClick={() => setRemindersOpen(true)} className="text-xs px-3 py-2 rounded" style={{background: 'rgba(0,0,0,0.06)', color: '#000'}}>Reminders</button>
          </div>
          <div className="relative">
            <button
              onClick={() => setUserOpen(!userOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[rgba(0,0,0,0.04)]"
            >
              <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium">{user.name}</span>
            </button>

            {userOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-700 rounded-lg shadow-lg z-20">
                <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-600">
                  <p className="text-sm font-medium">{user.email}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 capitalize">{user.role}</p>
                </div>
                <button
                  onClick={() => {
                    logout();
                    window.location.href = '/login';
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-slate-100 dark:hover:bg-slate-600"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
    {remindersOpen && <RemindersPanel onClose={() => setRemindersOpen(false)} />}
    </>
  );
};
