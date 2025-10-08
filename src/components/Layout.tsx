import { ReactNode, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PushResult, retryFailedItems, pushLocalHistoryToServer } from '../lib/sync';
import { LayoutDashboard, Target, History, DollarSign, LogOut, Plus, Menu, X, TrendingUp } from 'lucide-react';

type LayoutProps = {
  children: ReactNode;
  currentView: 'dashboard' | 'budget' | 'history' | 'add-plan' | 'analytics' | 'assistant' | 'reflection' | 'goals' | 'habits' | 'sync' | 'smartpdf';
  onViewChange: (view: 'dashboard' | 'budget' | 'history' | 'add-plan' | 'analytics' | 'assistant' | 'reflection' | 'goals' | 'habits' | 'sync' | 'smartpdf') => void;
};

export function Layout({ children, currentView, onViewChange }: LayoutProps) {
  const { signOut, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [forceModalOpen, setForceModalOpen] = useState(false);
  const [forceResult, setForceResult] = useState<PushResult | null>(null);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'budget', label: 'Budget', icon: DollarSign },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'reflection', label: 'Reflection', icon: Target },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'habits', label: 'Habits', icon: Target },
    { id: 'sync', label: 'Sync', icon: Target },
    { id: 'smartpdf', label: 'Smart PDF', icon: TrendingUp },
    { id: 'assistant', label: 'Assistant', icon: TrendingUp },
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNnoiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIvPjwvZz48L3N2Zz4=')] opacity-30"></div>

      <div className="relative flex h-screen">
        {/* Sidebar - visible on desktop, toggleable on mobile */}
        <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900/50 backdrop-blur-xl border-r border-slate-700/50 flex flex-col transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-6 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Target className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Vision</h1>
                <p className="text-xs text-slate-400">Command Center</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => onViewChange(item.id as any)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => onViewChange('add-plan')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-[1.02] transition-all duration-200 mt-4"
            >
              <Plus className="w-5 h-5" />
              <span>New Plan</span>
            </button>
          </nav>

          <div className="p-4 border-t border-slate-700/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                  {user?.email?.[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{user?.email}</p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800/50 transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Sign Out</span>
            </button>
            <div className="mt-2">
              <button
                type="button"
                onClick={async () => {
                    setForceModalOpen(true);
                    setForceResult(null);
                    try {
                      const uid = user?.id || null;
                      const res = await pushLocalHistoryToServer(uid as any);
                      setForceResult(res as any);
                    } catch (e: any) {
                      setForceResult({ ok: false, errors: [String(e)] } as any);
                    }
                  }}
                className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-slate-300 bg-slate-800/40 hover:bg-slate-800/60 transition-all mt-2"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm">Force Push Unsynced</span>
              </button>
            </div>
          </div>
        </aside>

        {forceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-slate-900 p-4 rounded w-11/12 max-w-md">
              <h3 className="text-lg font-bold mb-2">Force Push Results</h3>
              {forceResult === null && <div className="text-sm text-slate-500">Running...</div>}
              {forceResult && (
                <div>
                  <div className={`mb-2 text-sm ${forceResult.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{forceResult.ok ? 'Push completed' : 'Push encountered errors'}</div>
                  <div className="text-xs text-slate-500 mb-2">Inserted: {forceResult.inserted ?? 0} • Updated: {forceResult.updated ?? 0} • Skipped: {forceResult.skipped ?? 0}</div>
                  {forceResult.errors && forceResult.errors.length > 0 && (
                    <div className="text-xs text-slate-600 max-h-40 overflow-auto bg-slate-100 p-2 rounded mb-2">{JSON.stringify(forceResult.errors, null, 2)}</div>
                  )}
                  {/* Retry failed items */}
                  {forceResult.errors && forceResult.errors.length > 0 && (
                    <div className="flex gap-2">
                      <button onClick={async () => {
                        try {
                          const failedIds = (forceResult?.errors || []).map(e => e.id).filter(Boolean);
                          const uid = user?.id || null;
                          const res = await retryFailedItems(uid as any, failedIds as string[]);
                          setForceResult(res as any);
                        } catch (e: any) {
                          setForceResult({ ok: false, errors: [String(e)], inserted: 0, updated: 0, skipped: 0, items: [] } as any);
                        }
                      }} className="px-3 py-1 bg-cyan-600 text-white rounded">Retry Failed</button>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={() => setForceModalOpen(false)} className="px-3 py-1 bg-slate-200 rounded">Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Backdrop for mobile when sidebar is open */}
        {sidebarOpen && (
          <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-30 bg-black/50 lg:hidden" />
        )}

        <main className="flex-1 overflow-auto lg:pl-0">
          {/* Top bar for mobile to control sidebar */}
          <div className="lg:hidden sticky top-0 z-20 bg-transparent p-3">
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => setSidebarOpen(true)} className="p-2 rounded-md bg-slate-900/60 text-white">
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="text-sm text-slate-300">{user?.email}</div>
                <button type="button" onClick={() => setSidebarOpen(false)} className="p-2 rounded-md bg-slate-900/60 text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
