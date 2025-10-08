import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Rocket, Mail, Lock, AlertCircle } from 'lucide-react';
import { loadMigrationLogFromDB } from '../lib/authCache';

export function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [usedOfflineCache, setUsedOfflineCache] = useState(false);
  const { signIn, signUp } = useAuth();
  const { getCachedAuthInfo, revalidateOnline } = useAuth();
  const [cachedInfo, setCachedInfo] = useState<{ email: string; cachedAt: string } | null>(null);
  const [migrationLog, setMigrationLog] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password);
        // newly signed up accounts are cached by the provider for offline use
        setUsedOfflineCache(false);
      } else {
        const offline = await signIn(email, password);
        setUsedOfflineCache(!!offline);
      }
      // refresh cached info for display
      try { const info = await getCachedAuthInfo(); setCachedInfo(info); } catch (e) { /* ignore */ }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try { const info = await getCachedAuthInfo(); setCachedInfo(info); } catch (e) { /* ignore */ }
      try { const log = await loadMigrationLogFromDB(); setMigrationLog(log); } catch (e) { /* ignore */ }
    })();
  }, []);

  const handleRevalidate = async () => {
    // Open modal for password entry
    setShowRevalidateModal(true);
  };

  const [showRevalidateModal, setShowRevalidateModal] = useState(false);
  const [revalidatePassword, setRevalidatePassword] = useState('');
  const [revalidateError, setRevalidateError] = useState('');
  const [revalidateLoading, setRevalidateLoading] = useState(false);

  const handleConfirmRevalidate = async () => {
    setRevalidateError('');
    if (!revalidatePassword) { setRevalidateError('Please enter your password'); return; }
    setRevalidateLoading(true);
    const ok = await revalidateOnline(revalidatePassword);
    setRevalidateLoading(false);
    setShowRevalidateModal(false);
    setRevalidatePassword('');
    if (ok) {
      setUsedOfflineCache(false);
      setError('Revalidated online and refreshed cached credentials.');
      const info = await getCachedAuthInfo(); setCachedInfo(info);
    } else {
      setError('Failed to revalidate online. Check your network and password.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNnoiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIvPjwvZz48L3N2Zz4=')] opacity-20"></div>

      <div className="relative w-full max-w-md">
        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl blur-xl opacity-30"></div>

        <div className="relative bg-slate-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/50">
              <Rocket className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Mission Control</h1>
            <p className="text-slate-400 text-center">Plan, budget, and track your empire</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {usedOfflineCache && (
            <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-400/50 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-yellow-300 text-sm">Signed in offline using a cached credential. Some features that require network access may be unavailable.</p>
            </div>
          )}

          {cachedInfo && (
            <div className="mb-4 p-3 bg-slate-800/40 border border-slate-700/50 rounded-lg">
              <p className="text-slate-300 text-sm">Cached user: <strong className="text-white">{cachedInfo.email}</strong></p>
              <p className="text-slate-400 text-xs">Cached at: {new Date(cachedInfo.cachedAt).toLocaleString()}</p>
                <div className="mt-2 flex gap-2">
                <button type="button" onClick={handleRevalidate} className="px-3 py-1 bg-cyan-600 text-white rounded text-sm">Revalidate online</button>
              </div>
            </div>
          )}

          {migrationLog && (
            <div className="mb-4 p-3 bg-green-800/20 border border-green-700/40 rounded-lg">
              <p className="text-green-200 text-sm">Migration: {migrationLog.migratedAt ? `migrated at ${new Date(migrationLog.migratedAt).toLocaleString()}` : JSON.stringify(migrationLog)}</p>
            </div>
          )}

          {/* Revalidate modal */}
          {showRevalidateModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-slate-900 rounded-lg p-6 w-full max-w-md">
                <h3 className="text-lg font-semibold text-white mb-2">Revalidate online</h3>
                <p className="text-slate-400 text-sm mb-4">Enter your password to revalidate your cached credentials and refresh them from the server.</p>
                <input
                  type="password"
                  value={revalidatePassword}
                  onChange={(e) => setRevalidatePassword(e.target.value)}
                  className="w-full px-3 py-2 mb-3 bg-slate-800 border border-slate-700 rounded text-white"
                  placeholder="Your password"
                />
                {revalidateError && <p className="text-red-400 text-sm mb-2">{revalidateError}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setShowRevalidateModal(false); setRevalidatePassword(''); }} className="px-3 py-2 bg-slate-700 text-white rounded">Cancel</button>
                  <button type="button" onClick={handleConfirmRevalidate} disabled={revalidateLoading} className="px-3 py-2 bg-cyan-600 text-white rounded">{revalidateLoading ? 'Working...' : 'Revalidate'}</button>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-lg shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
          </form>

            <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
