import React, { useState, useEffect, useCallback } from 'react';
import { AppState, loadState, saveState } from './store';
import { fetchFromGitHub, mergeState } from './github';
import Dashboard from './components/Dashboard';
import ActionLogger from './components/ActionLogger';
import Goals from './components/Goals';
import Seeds from './components/Seeds';
import Brainstorm from './components/Brainstorm';
import Shop from './components/Shop';
import Settings from './components/Settings';
import MotivatorSidebar from './components/Motivators';
import GoalsSidebar from './components/GoalsSidebar';

type Tab = 'dashboard' | 'log' | 'goals' | 'seeds' | 'brainstorm' | 'shop' | 'settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Обзор', icon: '📊' },
  { id: 'log', label: 'Действия', icon: '⚡' },
  { id: 'goals', label: 'Цели', icon: '🎯' },
  { id: 'seeds', label: 'Зёрна', icon: '🌱' },
  { id: 'brainstorm', label: 'Советник', icon: '💭' },
  { id: 'shop', label: 'Магазин', icon: '🛒' },
  { id: 'settings', label: '⚙', icon: '' },
];

export default function App() {
  const [state, setStateRaw] = useState<AppState>(loadState);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [xpAnimation, setXpAnimation] = useState<{ amount: number; category: string } | null>(null);

  // Save state on every change
  const setState = useCallback((fn: (prev: AppState) => AppState) => {
    setStateRaw(prev => {
      const newState = fn(prev);
      saveState(newState);
      return newState;
    });
  }, []);

  // Watch for XP changes to trigger animation
  const prevHistoryLength = React.useRef(state.history.length);
  useEffect(() => {
    if (state.history.length > prevHistoryLength.current) {
      const lastEntry = state.history[state.history.length - 1];
      const cat = state.categories.find(c => c.id === lastEntry.category_id);
      if (cat) {
        setXpAnimation({ amount: lastEntry.final_xp, category: cat.name });
        setTimeout(() => setXpAnimation(null), 2000);
      }
    }
    prevHistoryLength.current = state.history.length;
  }, [state.history.length, state.history, state.categories]);

  // Auto-sync from GitHub on load
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  useEffect(() => {
    if (state.gh_token && state.gh_repo) {
      fetchFromGitHub(state).then(remote => {
        if (remote) {
          const merged = mergeState(state, remote);
          setState(() => merged);
          setSyncNotice(`Синхронизировано с GitHub (${new Date().toLocaleTimeString()})`);
          setTimeout(() => setSyncNotice(null), 4000);
        }
      }).catch(e => {
        console.error('Auto-sync failed:', e);
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex flex-col">
      {/* XP Animation Overlay */}
      {xpAnimation && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className="bg-[var(--good)] text-white px-4 py-2 rounded-full font-bold text-sm shadow-lg glow-accent xp-burst">
            +{xpAnimation.amount} XP → {xpAnimation.category}
          </div>
        </div>
      )}

      {/* Sync Notice */}
      {syncNotice && (
        <div className="fixed top-4 right-4 z-50 animate-slide-up">
          <div className="bg-[var(--panel-2)] border border-[var(--good)] text-[var(--good)] px-4 py-2 rounded-lg text-sm shadow-lg">
            ✅ {syncNotice}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-[var(--line)] px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">LiFE RPG</h1>
          <p className="text-xs text-[var(--text-dim)]">Геймификатор жизни v2.0</p>
        </div>
        <div className="flex items-center gap-2">
          {state.apiKey ? (
            <span className="text-xs text-[var(--good)]">● API</span>
          ) : (
            <button
              onClick={() => setActiveTab('settings')}
              className="text-xs text-[var(--warn)] hover:underline"
            >
              ⚠ API
            </button>
          )}
          {state.gh_token && state.gh_repo ? (
            <span className="text-xs text-[var(--good)]">● GitHub</span>
          ) : (
            <button
              onClick={() => setActiveTab('settings')}
              className="text-xs text-[var(--warn)] hover:underline"
            >
              ⚠ GitHub
            </button>
          )}
        </div>
      </header>

      {/* Main Content with Sidebars */}
      <main className="flex-1 w-full px-4 py-4 pb-20 max-w-7xl mx-auto">
        <div className="flex gap-6 justify-center">
          {/* Left Sidebar - Motivators (desktop only) */}
          <MotivatorSidebar state={state} />

          {/* Center Content */}
          <div className="flex-1 max-w-lg min-w-0">
            {activeTab === 'dashboard' && <Dashboard state={state} />}
            {activeTab === 'log' && <ActionLogger state={state} setState={setState} />}
            {activeTab === 'goals' && <Goals state={state} setState={setState} />}
            {activeTab === 'seeds' && <Seeds state={state} setState={setState} />}
            {activeTab === 'brainstorm' && <Brainstorm state={state} setState={setState} />}
            {activeTab === 'shop' && <Shop state={state} setState={setState} />}
            {activeTab === 'settings' && <Settings state={state} setState={setState} />}
          </div>

          {/* Right Sidebar - Goals (desktop only) */}
          <GoalsSidebar state={state} />
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[var(--panel)] border-t border-[var(--line)] px-2 py-1 z-40">
        <div className="max-w-lg mx-auto flex justify-around">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'tab-active'
                  : 'text-[var(--text-dim)] hover:text-[var(--text)]'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span className="text-[10px] mt-0.5">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
