import React from 'react';
import { AppState, ACHIEVEMENTS, calculateStreak, deriveLevel, getCategoryTotalXp, getTotalXp } from '../store';

interface Props {
  state: AppState;
  setState: (fn: (prev: AppState) => AppState) => void;
}

export default function Settings({ state, setState }: Props) {
  const unlockedAchievements = ACHIEVEMENTS.filter(a => a.condition(state));
  const lockedAchievements = ACHIEVEMENTS.filter(a => !a.condition(state));

  const clearAll = () => {
    if (!confirm('Удалить ВСЕ данные? Это действие нельзя отменить!')) return;
    if (!confirm('Точно? Все записи, цели, зёрна — всё пропадёт.')) return;
    localStorage.removeItem('liferpg_state_v2');
    window.location.reload();
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `life-rpg-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (!data.categories) throw new Error('bad shape');
          setState(() => ({
            ...data,
            goals: data.goals || [],
            supplements_log: data.supplements_log || [],
            seeds: data.seeds || [],
            artifacts: data.artifacts || [],
            daily_quests: data.daily_quests || [],
            apiKey: data.apiKey || '',
            modelName: data.modelName || 'gemini-flash-lite-latest',
          }));
          alert('Данные импортированы!');
        } catch {
          alert('Не удалось прочитать файл.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* API Settings */}
      <div className="glass-panel p-4">
        <h3 className="text-sm font-semibold mb-3">⚙ Настройки API</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[var(--text-dim)] block mb-1">Gemini API Key</label>
            <input
              type="password"
              value={state.apiKey}
              onChange={e => setState(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder="AIza..."
              className="w-full bg-[var(--panel-2)] border border-[var(--line)] rounded-lg px-3 py-2 text-sm text-[var(--text)] font-mono focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-dim)] block mb-1">Модель</label>
            <input
              type="text"
              value={state.modelName}
              onChange={e => setState(prev => ({ ...prev, modelName: e.target.value }))}
              className="w-full bg-[var(--panel-2)] border border-[var(--line)] rounded-lg px-3 py-2 text-sm text-[var(--text)] font-mono focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <p className="text-xs text-[var(--text-dim)]">
            Ключ получить в <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline">Google AI Studio</a>. Ключ хранится только в этом браузере.
          </p>
          {state.apiKey && (
            <button
              onClick={() => setState(prev => ({ ...prev, apiKey: '' }))}
              className="text-xs px-3 py-1.5 border border-[var(--line)] rounded-lg text-[var(--text-dim)] hover:text-[var(--danger)] hover:border-[var(--danger)]"
            >
              Забыть ключ
            </button>
          )}
        </div>
      </div>

      {/* Categories */}
      <div className="glass-panel p-4">
        <h3 className="text-sm font-semibold mb-3">Категории</h3>
        <div className="space-y-2">
          {state.categories.map((cat, idx) => (
            <div key={cat.id} className="flex items-center gap-3 bg-[var(--panel-2)] rounded-lg p-2">
              <div className="w-3 h-3 rounded-full" style={{ background: cat.color }} />
              <span className="flex-1 text-sm">{cat.name}</span>
              <input
                type="number"
                value={cat.weight}
                onChange={e => {
                  const w = parseInt(e.target.value) || 1;
                  setState(prev => ({
                    ...prev,
                    categories: prev.categories.map((c, i) => i === idx ? { ...c, weight: w } : c),
                  }));
                }}
                className="w-16 bg-[var(--panel)] border border-[var(--line)] rounded px-2 py-1 text-xs text-center text-[var(--text)]"
              />
              <span className="text-xs text-[var(--text-dim)]">вес</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-[var(--text-dim)] mt-2">Вес влияет на множитель XP для категории.</p>
      </div>

      {/* Achievements */}
      <div className="glass-panel p-4">
        <h3 className="text-sm font-semibold mb-3">🏆 Достижения ({unlockedAchievements.length}/{ACHIEVEMENTS.length})</h3>
        <div className="grid grid-cols-2 gap-2">
          {ACHIEVEMENTS.map(a => {
            const unlocked = a.condition(state);
            return (
              <div
                key={a.id}
                className={`p-3 rounded-lg border ${
                  unlocked
                    ? 'bg-[var(--panel-2)] border-[var(--good)]'
                    : 'bg-[var(--panel)] border-[var(--line)] opacity-50'
                }`}
              >
                <div className="text-lg">{a.icon}</div>
                <div className="text-xs font-semibold mt-1">{a.name}</div>
                <div className="text-xs text-[var(--text-dim)]">{a.description}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="glass-panel p-4">
        <h3 className="text-sm font-semibold mb-3">📊 Статистика</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-[var(--panel-2)] rounded-lg p-3">
            <div className="text-xs text-[var(--text-dim)]">Всего записей</div>
            <div className="text-lg font-bold">{state.history.length}</div>
          </div>
          <div className="bg-[var(--panel-2)] rounded-lg p-3">
            <div className="text-xs text-[var(--text-dim)]">Всего XP</div>
            <div className="text-lg font-bold">{getTotalXp(state)}</div>
          </div>
          <div className="bg-[var(--panel-2)] rounded-lg p-3">
            <div className="text-xs text-[var(--text-dim)]">Серия дней</div>
            <div className="text-lg font-bold">{calculateStreak(state.history)}</div>
          </div>
          <div className="bg-[var(--panel-2)] rounded-lg p-3">
            <div className="text-xs text-[var(--text-dim)]">Общий уровень</div>
            <div className="text-lg font-bold">{deriveLevel(getTotalXp(state)).level}</div>
          </div>
          <div className="bg-[var(--panel-2)] rounded-lg p-3">
            <div className="text-xs text-[var(--text-dim)]">Целей</div>
            <div className="text-lg font-bold">{state.goals.length}</div>
          </div>
          <div className="bg-[var(--panel-2)] rounded-lg p-3">
            <div className="text-xs text-[var(--text-dim)]">Артефактов</div>
            <div className="text-lg font-bold">{state.artifacts.length}</div>
          </div>
        </div>
      </div>

      {/* Data */}
      <div className="glass-panel p-4">
        <h3 className="text-sm font-semibold mb-3">💾 Данные</h3>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportData} className="px-4 py-2 border border-[var(--line)] rounded-lg text-sm text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--accent)]">
            📤 Экспорт JSON
          </button>
          <button onClick={importData} className="px-4 py-2 border border-[var(--line)] rounded-lg text-sm text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--accent)]">
            📥 Импорт JSON
          </button>
          <button onClick={clearAll} className="px-4 py-2 border border-[var(--danger)] rounded-lg text-sm text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white">
            🗑 Очистить всё
          </button>
        </div>
      </div>
    </div>
  );
}
