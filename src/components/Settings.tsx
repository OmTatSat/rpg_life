import React, { useState } from 'react';
import { AppState, ACHIEVEMENTS, calculateStreak, deriveLevel, getCategoryTotalXp, getTotalXp, createDefaultState } from '../store';
import { fetchFromGitHub, saveToGitHub, mergeState } from '../github';

interface Props {
  state: AppState;
  setState: (fn: (prev: AppState) => AppState) => void;
}

export default function Settings({ state, setState }: Props) {
  const [syncStatus, setSyncStatus] = useState<{ type: 'idle' | 'loading' | 'ok' | 'err'; text: string }>({ type: 'idle', text: '' });
  const unlockedAchievements = ACHIEVEMENTS.filter(a => a.condition(state));
  const lockedAchievements = ACHIEVEMENTS.filter(a => !a.condition(state));

  const handleSyncLoad = async () => {
    setSyncStatus({ type: 'loading', text: 'Загружаю с GitHub...' });
    try {
      const remote = await fetchFromGitHub(state);
      if (!remote) {
        setSyncStatus({ type: 'ok', text: 'На GitHub пока нет данных — локальная версия сохранится при первом "Сохранить"' });
        return;
      }
      const merged = mergeState(state, remote);
      setState(() => merged);
      setSyncStatus({ type: 'ok', text: `Синхронизировано (${new Date().toLocaleTimeString()})` });
    } catch (e: any) {
      setSyncStatus({ type: 'err', text: e.message });
    }
  };

  const handleSyncSave = async () => {
    setSyncStatus({ type: 'loading', text: 'Сохраняю на GitHub...' });
    try {
      await saveToGitHub(state);
      setSyncStatus({ type: 'ok', text: `Сохранено на GitHub (${new Date().toLocaleTimeString()})` });
    } catch (e: any) {
      setSyncStatus({ type: 'err', text: e.message });
    }
  };

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
          const defaults = createDefaultState();
          setState(() => ({
            ...defaults,
            ...data,
            categories: data.categories || defaults.categories,
            history: data.history || [],
            goals: data.goals || [],
            supplements_log: data.supplements_log || [],
            seeds: data.seeds || [],
            artifacts: data.artifacts || [],
            daily_quests: data.daily_quests || [],
            gold: data.gold || 0,
            shop_items: data.shop_items || defaults.shop_items,
            apiKey: data.apiKey || '',
            modelName: data.modelName || 'gemini-flash-lite-latest',
            gh_token: data.gh_token || '',
            gh_repo: data.gh_repo || '',
            gh_file_path: data.gh_file_path || 'data/life-rpg-v2.json',
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

      {/* GitHub Sync */}
      <div className="glass-panel p-4">
        <h3 className="text-sm font-semibold mb-3">🔄 Синхронизация с GitHub</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[var(--text-dim)] block mb-1">GitHub Token (Personal Access Token)</label>
            <input
              type="password"
              value={state.gh_token}
              onChange={e => setState(prev => ({ ...prev, gh_token: e.target.value }))}
              placeholder="ghp_..."
              className="w-full bg-[var(--panel-2)] border border-[var(--line)] rounded-lg px-3 py-2 text-sm text-[var(--text)] font-mono focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-dim)] block mb-1">Репозиторий (owner/repo)</label>
            <input
              type="text"
              value={state.gh_repo}
              onChange={e => setState(prev => ({ ...prev, gh_repo: e.target.value }))}
              placeholder="username/life-rpg-data"
              className="w-full bg-[var(--panel-2)] border border-[var(--line)] rounded-lg px-3 py-2 text-sm text-[var(--text)] font-mono focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-dim)] block mb-1">Путь к файлу</label>
            <input
              type="text"
              value={state.gh_file_path}
              onChange={e => setState(prev => ({ ...prev, gh_file_path: e.target.value }))}
              placeholder="data/life-rpg.json"
              className="w-full bg-[var(--panel-2)] border border-[var(--line)] rounded-lg px-3 py-2 text-sm text-[var(--text)] font-mono focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <p className="text-xs text-[var(--text-dim)]">
            Создай приватный репозиторий и <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline">Personal Access Token</a> с правами <code className="bg-[var(--panel-2)] px-1 rounded">repo</code>. Токен хранится только в этом браузере.
          </p>
          <p className="text-xs text-[var(--warn)]">
            ⚠️ По умолчанию путь <code className="bg-[var(--panel-2)] px-1 rounded">data/life-rpg-v2.json</code> — это отдельный файл, чтобы не затирать данные из старой версии. Если хочешь мигрировать старые данные — используй Экспорт/Импорт JSON ниже.
          </p>
          {state.gh_token && state.gh_repo && (
            <div className="flex gap-2">
              <button
                onClick={handleSyncLoad}
                disabled={syncStatus.type === 'loading'}
                className="flex-1 px-4 py-2 border border-[var(--accent)] rounded-lg text-sm text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white disabled:opacity-50"
              >
                📥 Загрузить
              </button>
              <button
                onClick={handleSyncSave}
                disabled={syncStatus.type === 'loading'}
                className="flex-1 px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                📤 Сохранить
              </button>
            </div>
          )}
          {syncStatus.text && (
            <p className={`text-sm ${syncStatus.type === 'err' ? 'text-[var(--danger)]' : syncStatus.type === 'ok' ? 'text-[var(--good)]' : 'text-[var(--text-dim)]'}`}>
              {syncStatus.text}
            </p>
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
            <div className="text-xs text-[var(--text-dim)]">Золото 🪙</div>
            <div className="text-lg font-bold text-[var(--warn)]">{state.gold || 0}</div>
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
          <div className="bg-[var(--panel-2)] rounded-lg p-3">
            <div className="text-xs text-[var(--text-dim)]">Зёрен</div>
            <div className="text-lg font-bold">{state.seeds.length}</div>
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
