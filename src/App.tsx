import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Auth } from './components/Auth';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Budget } from './components/Budget';
import { History } from './components/History';
import { PlanForm } from './components/PlanForm';
import { Analytics } from './components/Analytics';
import Assistant from './components/Assistant';
import Reflection from './components/Reflection';
import Goals from './components/Goals';
import Habits from './components/Habits';
import Sync from './components/Sync';
import SmartPDFReader from './components/SmartPDFReader';
import { Plan as Plan } from './lib/supabase';
import { PlansProvider } from './contexts/PlansContext';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<'dashboard' | 'budget' | 'history' | 'add-plan' | 'analytics' | 'assistant' | 'reflection' | 'goals' | 'habits' | 'sync' | 'smartpdf'>('dashboard');
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  const handleEditPlan = (plan: Plan) => {
    setEditingPlan(plan);
    setCurrentView('add-plan');
  };

  const handleClosePlanForm = () => {
    setEditingPlan(null);
    setCurrentView('dashboard');
  };

  const handleSavePlan = () => {
    setEditingPlan(null);
    setCurrentView('dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center">
        <div className="animate-spin w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <>
      <Layout currentView={currentView} onViewChange={setCurrentView}>
  {currentView === 'dashboard' && <Dashboard onEditPlan={handleEditPlan} />}
  {currentView === 'budget' && <Budget />}
  {currentView === 'analytics' && <Analytics />}
  {currentView === 'assistant' && <Assistant />}
  {currentView === 'smartpdf' && <SmartPDFReader />}
  {currentView === 'reflection' && <Reflection />}
  {currentView === 'goals' && <Goals />}
  {currentView === 'habits' && <Habits />}
  {currentView === 'sync' && <Sync />}
  {currentView === 'history' && <History />}
      </Layout>

      {currentView === 'add-plan' && (
        <PlanForm
          plan={editingPlan}
          onClose={handleClosePlanForm}
          onSave={handleSavePlan}
        />
      )}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <PlansProvider>
        <AppContent />
      </PlansProvider>
    </AuthProvider>
  );
}

export default App;
