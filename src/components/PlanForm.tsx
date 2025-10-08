import { useState, useEffect, useRef } from 'react';
import { Plan } from '../lib/supabase';
import { usePlans } from '../contexts/PlansContext';
import { useAuth } from '../contexts/AuthContext';
import { X, Save, Trash2, Target, TrendingUp, Zap, AlertCircle } from 'lucide-react';

type PlanFormProps = {
  plan?: Plan | null;
  onClose: () => void;
  onSave: () => void;
};

const CATEGORIES = ['Business', 'Learning', 'Personal', 'Finance', 'Health', 'Technology', 'Other'];

export function PlanForm({ plan, onClose, onSave }: PlanFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { addPlan, updatePlan, deletePlan } = usePlans();
  const [formData, setFormData] = useState({
    title: '',
    layer: 'Strategy' as 'Vision' | 'Strategy' | 'Tactic',
    category: 'Business',
    start_date: '',
    end_date: '',
    budget_planned: 0,
    budget_spent: 0,
    progress: 0,
    notes: '',
    status: 'active' as 'active' | 'completed' | 'archived',
  });
  const { layerTips } = usePlans() as any;
  const [showTip, setShowTip] = useState(false);
  const tipTimeout = useRef<number | null>(null);

  useEffect(() => {
    if (plan) {
      setFormData({
        title: plan.title,
        layer: plan.layer,
        category: plan.category,
        start_date: plan.start_date,
        end_date: plan.end_date,
        budget_planned: Number(plan.budget_planned),
        budget_spent: Number(plan.budget_spent),
        progress: plan.progress,
        notes: plan.notes,
        status: plan.status,
      });
    }
  }, [plan]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setLoading(true);

    try {
      // Use local Dexie DB via PlansContext
      if (plan) {
        await updatePlan(plan.id, { ...formData });
      } else {
        await addPlan({ ...formData, user_id: user.id });
      }

      onSave();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!plan || !confirm('Are you sure you want to delete this plan?')) return;

    setLoading(true);
    try {
      await deletePlan(plan.id);
      onSave();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setLoading(false);
    }
  };

  const getLayerIcon = (layer: string) => {
    switch (layer) {
      case 'Vision': return Target;
      case 'Strategy': return TrendingUp;
      case 'Tactic': return Zap;
      default: return Target;
    }
  };

  const layers: Array<'Vision' | 'Strategy' | 'Tactic'> = ['Vision', 'Strategy', 'Tactic'];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 z-50">
      <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-auto md:mx-4 sm:mx-2">
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-xl border-b border-slate-700/50 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg md:text-2xl font-bold text-white">{plan ? 'Edit Plan' : 'Create New Plan'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

  <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
              placeholder="e.g., Launch AI SaaS MVP"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Strategic Layer</label>
              <div className="grid grid-cols-3 gap-2">
                {layers.map((layer) => {
                  const Icon = getLayerIcon(layer);
                  return (
                    <button
                      key={layer}
                      type="button"
                      onClick={() => setFormData({ ...formData, layer })}
                      className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                        formData.layer === layer
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                          : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-medium">{layer}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center justify-between">
                  <span>Start {formData.layer === 'Tactic' ? 'Date & Time' : 'Date'}</span>
                  <button
                    type="button"
                    onMouseEnter={() => setShowTip(true)}
                    onMouseLeave={() => setShowTip(false)}
                    onFocus={() => setShowTip(true)}
                    onBlur={() => setShowTip(false)}
                    onTouchStart={() => { tipTimeout.current = window.setTimeout(() => setShowTip(true), 500); }}
                    onTouchEnd={() => { if (tipTimeout.current) { clearTimeout(tipTimeout.current); tipTimeout.current = null; } }}
                    aria-describedby={`layer-tip-${formData.layer}`}
                    className="text-xs text-slate-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded"
                  >
                    {formData.layer}
                  </button>
                </label>
                {showTip && layerTips && layerTips[formData.layer] && (
                  <div id={`layer-tip-${formData.layer}`} role="tooltip" className="mb-2 p-3 bg-slate-800/80 rounded-md text-sm text-slate-200">
                    <div className="font-semibold">{layerTips[formData.layer].title}</div>
                    <div className="text-xs text-slate-300">{layerTips[formData.layer].description}</div>
                    <div className="text-xs text-slate-400 italic mt-1">Example: {layerTips[formData.layer].example}</div>
                  </div>
                )}
                <input
                  type={formData.layer === 'Tactic' ? 'datetime-local' : 'date'}
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  required
                />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">End {formData.layer === 'Tactic' ? 'Date & Time' : 'Date'}</label>
              <input
                type={formData.layer === 'Tactic' ? 'datetime-local' : 'date'}
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Planned Budget</label>
              <input
                type="number"
                value={formData.budget_planned}
                onChange={(e) => setFormData({ ...formData, budget_planned: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Actual Spent</label>
              <input
                type="number"
                value={formData.budget_spent}
                onChange={(e) => setFormData({ ...formData, budget_spent: Number(e.target.value) })}
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Progress: {formData.progress}%</label>
            <input
              type="range"
              value={formData.progress}
              onChange={(e) => setFormData({ ...formData, progress: Number(e.target.value) })}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              min="0"
              max="100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all resize-none"
              rows={4}
              placeholder="Add any additional details or notes..."
            />
          </div>

          <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-700/50">
            {plan && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-lg shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Saving...' : 'Save Plan'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
