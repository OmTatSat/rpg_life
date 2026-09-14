import React from 'react';
import { AppState, deriveLevel, getCategoryTotalXp, checkPeriodReset, calculateRecurringProgress, migrateRecurringGoal } from '../store';

interface Props {
  state: AppState;
  setState: (fn: (prev: AppState) => AppState) => void;
}

export default function GoalsSidebar({ state, setState }: Props) {
  const activeGoals = state.goals.filter(g => g.status === 'active').slice(0, 3);
  const planningGoals = state.goals.filter(g => g.status === 'planning').slice(0, 2);
  const recurringGoals = (state.recurring_goals || []).slice(0, 3);

  if (activeGoals.length === 0 && planningGoals.length === 0 && recurringGoals.length === 0) {
    return (
      <aside className="hidden lg:flex flex-col gap-4 w-64 flex-shrink-0 sticky top-4 self-start">
        <div className="glass-panel p-4">
          <div className="text-xs text-[var(--text-dim)] mb-3 uppercase tracking-wider">🎯 Активные цели</div>
          <p className="text-xs text-[var(--text-dim)] italic">
            Нет активных целей. Создайте в разделе «Цели».
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden lg:flex flex-col gap-4 w-64 flex-shrink-0 sticky top-4 self-start">
      {/* Active Goals */}
      {activeGoals.length > 0 && (
        <div className="glass-panel p-4">
          <div className="text-xs text-[var(--text-dim)] mb-3 uppercase tracking-wider">🎯 Активные цели</div>
          <div className="space-y-3">
            {activeGoals.map(goal => {
              const cat = state.categories.find(c => c.id === goal.category_id);
              const doneCount = goal.steps.filter(s => s.status === 'done').length;
              const progress = goal.steps.length > 0 ? (doneCount / goal.steps.length) * 100 : 0;

              return (
                <div key={goal.id} className="border-l-2 pl-3" style={{ borderColor: cat?.color || 'var(--accent)' }}>
                  <div className="text-xs font-semibold mb-1 line-clamp-2">{goal.title}</div>
                  <div className="text-xs text-[var(--text-dim)] mb-2">
                    {doneCount}/{goal.steps.length} шагов
                  </div>
                  <div className="h-1 bg-[var(--panel-2)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${progress}%`, background: cat?.color || 'var(--accent)' }}
                    />
                  </div>
                  {/* Show next pending step */}
                  {goal.steps.find(s => s.status === 'pending') && (
                    <div className="text-xs text-[var(--text-dim)] mt-2 italic">
                      Следующий: {goal.steps.find(s => s.status === 'pending')!.text.slice(0, 50)}
                      {goal.steps.find(s => s.status === 'pending')!.text.length > 50 ? '...' : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Planning Goals */}
      {planningGoals.length > 0 && (
        <div className="glass-panel p-4">
          <div className="text-xs text-[var(--text-dim)] mb-3 uppercase tracking-wider">📝 В планировании</div>
          <div className="space-y-2">
            {planningGoals.map(goal => {
              const cat = state.categories.find(c => c.id === goal.category_id);
              return (
                <div key={goal.id} className="border-l-2 pl-3 border-[var(--warn)]">
                  <div className="text-xs font-semibold mb-1 line-clamp-2">{goal.title}</div>
                  <div className="text-xs text-[var(--warn)]">Выберите подход</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recurring Goals */}
      {recurringGoals.length > 0 && (
        <div className="glass-panel p-4">
          <div className="text-xs text-[var(--text-dim)] mb-3 uppercase tracking-wider">🔄 Повторяющиеся</div>
          <div className="space-y-3">
            {recurringGoals.map(goal => {
              const cat = state.categories.find(c => c.id === goal.category_id);
              const migratedGoal = migrateRecurringGoal(goal);
              const updatedGoal = checkPeriodReset(migratedGoal);
              // Use current_value directly from the goal object
              const progress = updatedGoal.current_value;
              const percentage = Math.min(100, (progress / updatedGoal.target_value) * 100);
              const isCompletedToday = progress >= updatedGoal.unit_value;
              
              return (
                <div key={goal.id} className="border-l-2 pl-3" style={{ borderColor: cat?.color || 'var(--accent)' }}>
                  <div className="text-xs font-semibold mb-1 line-clamp-2">{updatedGoal.title}</div>
                  <div className="text-xs text-[var(--text-dim)] mb-2">
                    {Math.round(progress)}/{updatedGoal.target_value} {updatedGoal.unit}
                  </div>
                  <div className="h-1 bg-[var(--panel-2)] rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                        background: percentage >= 100 ? 'var(--good)' : cat?.color || 'var(--accent)',
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isCompletedToday}
                        onChange={() => {
                          setState(prev => ({
                            ...prev,
                            recurring_goals: prev.recurring_goals.map(g => {
                              if (g.id !== updatedGoal.id) return g;
                              // Migration: ensure unit_value exists
                              const unitValue = g.unit_value || 1;
                              const currentValue = g.current_value || 0;
                              if (currentValue >= unitValue) {
                                return { ...g, unit_value: unitValue, current_value: 0 };
                              }
                              return { ...g, unit_value: unitValue, current_value: currentValue + unitValue };
                            }),
                          }));
                        }}
                        className="w-3 h-3"
                      />
                      <span className="text-xs text-[var(--text-dim)]">✓</span>
                    </label>
                    <button
                      onClick={() => {
                        setState(prev => ({
                          ...prev,
                          recurring_goals: prev.recurring_goals.map(g => {
                            if (g.id !== updatedGoal.id) return g;
                            // Migration: ensure unit_value exists
                            const unitValue = g.unit_value || 1;
                            const currentValue = g.current_value || 0;
                            return { ...g, unit_value: unitValue, current_value: currentValue + unitValue };
                          }),
                        }));
                      }}
                      className="ml-auto text-xs px-2 py-0.5 bg-[var(--accent)] text-white rounded hover:opacity-90"
                    >
                      +{updatedGoal.unit_value || 1}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category Levels */}
      <div className="glass-panel p-4">
        <div className="text-xs text-[var(--text-dim)] mb-3 uppercase tracking-wider">📊 Уровни категорий</div>
        <div className="space-y-2">
          {state.categories.map(cat => {
            const totalXp = getCategoryTotalXp(state, cat.id);
            const { level } = deriveLevel(totalXp);
            return (
              <div key={cat.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: cat.color }} />
                  <span className="text-xs">{cat.name}</span>
                </div>
                <span className="text-xs font-bold" style={{ color: cat.color }}>
                  Ур. {level}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
