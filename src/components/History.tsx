import { useEffect, useState } from 'react';
import { Plan } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePlans } from '../contexts/PlansContext';
import { Search, Target, TrendingUp, Zap, CheckCircle, Archive, Calendar, DollarSign } from 'lucide-react';

export function History() {
  const { user } = useAuth();
  const { plans: allPlans, loading, exportCSV, clearHistory, historyEnabled, setHistoryEnabled, uploadToOneDrive, uploadToGoogleDrive } = usePlans() as any;
  const [filteredPlans, setFilteredPlans] = useState<Plan[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLayer, setFilterLayer] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    // plans are provided by PlansContext
    applyFilters();
  }, [user]);
  useEffect(() => {
    applyFilters();
  }, [allPlans, searchTerm, filterLayer, filterStatus]);
  // filtering will operate on allPlans

  const [backupToken, setBackupToken] = useState('');
  const [backupProvider, setBackupProvider] = useState<'onedrive' | 'gdrive'>('onedrive');
  const [backupMessage, setBackupMessage] = useState('');
  const applyFilters = () => {
  let filtered = (allPlans || []) as Plan[];

    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.notes.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }


    if (filterLayer !== 'all') {
      filtered = filtered.filter((p: Plan) => p.layer === filterLayer);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((p: Plan) => p.status === filterStatus);
    }

    setFilteredPlans(filtered);
  };

  const getLayerIcon = (layer: string) => {
    switch (layer) {
      case 'Vision': return Target;
      case 'Strategy': return TrendingUp;
      case 'Tactic': return Zap;
      default: return Target;
    }
  };

  const handleExport = async () => {
    const csv = await exportCSV(false);
    if (!csv) return;
    const filename = `mission-control-export-${new Date().toISOString()}.csv`;
    // lazy import to avoid SSR issues
    const { downloadCSV } = await import('../lib/export');
    downloadCSV(csv, filename);
  };

  const handleClearHistory = async () => {
    if (!confirm('This will permanently remove archived and completed plans and related logs. Continue?')) return;
    await clearHistory();
    applyFilters();
  };

  const handleBackup = async () => {
    setBackupMessage('Backing up...');
    let ok = false;
    if (backupProvider === 'onedrive') {
      ok = await uploadToOneDrive(backupToken);
    } else {
      ok = await uploadToGoogleDrive(backupToken);
    }
    setBackupMessage(ok ? 'Backup successful' : 'Backup failed. Check token/permissions in provider.');
    setTimeout(() => setBackupMessage(''), 5000);
  };
  
  const getLayerColor = (layer: string) => {
    switch (layer) {
      case 'Vision': return 'from-purple-500 to-pink-500';
      case 'Strategy': return 'from-cyan-500 to-blue-500';
      case 'Tactic': return 'from-green-500 to-emerald-500';
      default: return 'from-slate-500 to-slate-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle;
      case 'archived': return Archive;
      default: return Archive;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Mission History</h1>
        <p className="text-slate-400">Review your completed and archived plans</p>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg shadow-sm"
          >Export CSV</button>
          <button
            type="button"
            onClick={handleClearHistory}
            className="px-4 py-2 text-red-400 hover:text-red-300 bg-slate-800/50 rounded-lg"
          >Clear History</button>
          <label className="flex items-center gap-2 text-sm text-slate-400 ml-3">
            <input type="checkbox" checked={historyEnabled} onChange={(e) => setHistoryEnabled(e.target.checked)} />
            <span>Save history</span>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <select value={backupProvider} onChange={(e) => setBackupProvider(e.target.value as any)} className="px-3 py-2 bg-slate-800/50 rounded-lg text-white">
            <option value="onedrive">OneDrive</option>
            <option value="gdrive">Google Drive</option>
          </select>
          <input value={backupToken} onChange={(e) => setBackupToken(e.target.value)} placeholder="Access token" className="px-3 py-2 bg-slate-800/50 rounded-lg text-white" />
          <button type="button" onClick={handleBackup} className="px-3 py-2 bg-green-600 rounded-lg text-white">Backup Now</button>
          {backupMessage && <span className="text-sm text-slate-400 ml-3">{backupMessage}</span>}
        </div>
      </div>

      <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
              placeholder="Search plans..."
            />
          </div>

          <div>
            <select
              value={filterLayer}
              onChange={(e) => setFilterLayer(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
            >
              <option value="all">All Layers</option>
              <option value="Vision">Vision</option>
              <option value="Strategy">Strategy</option>
              <option value="Tactic">Tactic</option>
            </select>
          </div>

          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {filteredPlans.length === 0 ? (
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-12 text-center">
            <Archive className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">No plans found</p>
            <p className="text-slate-500 text-sm mt-2">Try adjusting your filters</p>
          </div>
        ) : (
          filteredPlans.map((plan) => {
            const LayerIcon = getLayerIcon(plan.layer);
            const StatusIcon = getStatusIcon(plan.status);
            const duration = Math.ceil((new Date(plan.end_date).getTime() - new Date(plan.start_date).getTime()) / (1000 * 60 * 60 * 24));
            const budgetUtilization = Number(plan.budget_planned) > 0
              ? ((Number(plan.budget_spent) / Number(plan.budget_planned)) * 100).toFixed(1)
              : '0';

            return (
              <div
                key={plan.id}
                className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6 hover:border-slate-600/50 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`w-12 h-12 bg-gradient-to-br ${getLayerColor(plan.layer)} rounded-lg flex items-center justify-center shadow-lg flex-shrink-0`}>
                      <LayerIcon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-white truncate">{plan.title}</h3>
                        <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                          plan.status === 'completed'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-slate-700/50 text-slate-400'
                        }`}>
                          <StatusIcon className="w-3 h-3" />
                          {plan.status === 'completed' ? 'Completed' : 'Archived'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-400 mb-3">
                        <span className="px-3 py-1 bg-slate-800/50 rounded-full">{plan.layer}</span>
                        <span>{plan.category}</span>
                      </div>
                      {plan.notes && (
                        <p className="text-slate-400 text-sm line-clamp-2">{plan.notes}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-700/50">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Progress</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${getLayerColor(plan.layer)}`}
                          style={{ width: `${plan.progress}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-white">{plan.progress}%</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 mb-1">Duration</p>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-500" />
                      <span className="text-sm font-semibold text-white">{duration} days</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 mb-1">Budget</p>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-slate-500" />
                      <span className="text-sm font-semibold text-white">${Number(plan.budget_spent).toLocaleString()}</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500 mb-1">Utilization</p>
                    <span className={`text-sm font-semibold ${
                      Number(budgetUtilization) > 100
                        ? 'text-red-400'
                        : Number(budgetUtilization) > 80
                        ? 'text-orange-400'
                        : 'text-green-400'
                    }`}>
                      {budgetUtilization}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
