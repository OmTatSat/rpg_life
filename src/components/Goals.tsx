import React, { useState } from 'react';
import { AppState, Goal, genId } from '../store';
import { callGoalPlanner, callGemini } from '../api';

interface Props {
  state: AppState;
  setState: (fn: (prev: AppState) => AppState) => void;
}

export default function Goals({ state, setState }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [newGoalCat, setNewGoalCat] = useState(state.categories[0]?.id || '');
  const [newGoalText, setNewGoalText] = useState('');
  const [planStatus, setPlanStatus] = useState('');
  const [refineInputs, setRefineInputs] = useState<Record<string, string>>({});
  const [refineStatus, setRefineStatus] = useState<Record<string, string>>({});

  const generatePlan = async () => {
    if (!newGoalText.trim()) return;
    const cat = state.categories.find(c => c.id === newGoalCat);
    if (!cat) return;

    setPlanStatus('Генерирую варианты плана...');
    try {
      const result = await callGoalPlanner(state, cat, newGoalText);
      const goal: Goal = {
        id: genId(),
        category_id: cat.id,
        title: newGoalText.length > 60 ? newGoalText.slice(0, 60) + '…' : newGoalText,
        vision_text: newGoalText,
        status: 'planning',
        plan_options: result.plan_options || [],
        steps: [],
      };
      setState(prev => ({ ...prev, goals: [...prev.goals, goal] }));
      setShowForm(false);
      setNewGoalText('');
      setPlanStatus('');
    } catch (e: any) {
      setPlanStatus(e.message);
    }
  };

  const pickPlanOption = (goalId: string, optionIdx: number) => {
    setState(prev => {
      const goals = prev.goals.map(g => {
        if (g.id !== goalId) return g;
        const option = g.plan_options?.[optionIdx];
        if (!option) return g;
        return {
          ...g,
          steps: option.steps.map(s => ({
            id: genId(),
            text: s.text,
            contribution_factor: s.contribution_factor,
            status: 'pending' as const,
          })),
          status: 'active' as const,
          plan_options: undefined,
        };
      });
      return { ...prev, goals };
    });
  };

  const refinePlan = async (goalId: string, optionIdx: number) => {
    const goal = state.goals.find(g => g.id === goalId);
    if (!goal) return;
    const option = goal.plan_options?.[optionIdx];
    if (!option) return;
    const feedback = refineInputs[`${goalId}-${optionIdx}`];
    if (!feedback?.trim()) return;

    const key = `${goalId}-${optionIdx}`;
    setRefineStatus(prev => ({ ...prev, [key]: 'Дорабатываю...' }));

    try {
      const cat = state.categories.find(c => c.id === goal.category_id);
      if (!cat) return;

      const prompt = `Ты дорабатываешь вариант плана для цели. Вход — JSON. Верни СТРОГО JSON:
{ "label": "<название>", "rationale": "<почему>", "steps": [{ "text": "<шаг>", "contribution_factor": <0.1-1.0> }] }
Доработай текущий вариант с учётом feedback. 3-7 шагов. Без дедлайнов.`;

      const result = await callGemini(state.apiKey, state.modelName, prompt, JSON.stringify({
        category: { id: cat.id, name: cat.name, weight: cat.weight },
        goal_text: goal.vision_text,
        current_option: option,
        feedback,
      }), 0.4);

      setState(prev => ({
        ...prev,
        goals: prev.goals.map(g => {
          if (g.id !== goalId || !g.plan_options) return g;
          const opts = [...g.plan_options];
          opts[optionIdx] = result;
          return { ...g, plan_options: opts };
        }),
      }));
      setRefineInputs(prev => ({ ...prev, [key]: '' }));
      setRefineStatus(prev => ({ ...prev, [key]: '' }));
    } catch (e: any) {
      setRefineStatus(prev => ({ ...prev, [key]: e.message }));
    }
  };

  const completeStep = (goalId: string, stepId: string) => {
    setState(prev => {
      const goals = prev.goals.map(g => {
        if (g.id !== goalId) return g;
        const steps = g.steps.map(s => s.id === stepId ? { ...s, status: 'done' as const } : s);
        const cat = prev.categories.find(c => c.id === g.category_id);
        const step = g.steps.find(s => s.id === stepId);
        
        let newHistory = [...prev.history];
        if (step && cat) {
          const finalXp = Math.round(20 * cat.weight * step.contribution_factor);
          newHistory.push({
            id: genId(),
            text: step.text,
            full_text: `[Цель: ${g.title}] ${step.text}`,
            category_id: cat.id,
            final_xp: finalXp,
            quest_type: 'medium',
            timestamp: new Date().toISOString(),
          });
        }

        return {
          ...g,
          steps,
          status: steps.every(s => s.status === 'done') ? 'done' as const : g.status,
        };
      });
      // We need to update history too
      const goal = prev.goals.find(g => g.id === goalId);
      const step = goal?.steps.find(s => s.id === stepId);
      const cat = prev.categories.find(c => c.id === goal?.category_id);
      let newHistory = [...prev.history];
      if (step && cat) {
        const finalXp = Math.round(20 * cat.weight * step.contribution_factor);
        newHistory.push({
          id: genId(),
          text: step.text,
          full_text: `[Цель: ${goal!.title}] ${step.text}`,
          category_id: cat.id,
          final_xp: finalXp,
          quest_type: 'medium',
          timestamp: new Date().toISOString(),
        });
      }
      return { ...prev, goals, history: newHistory };
    });
  };

  const addStep = (goalId: string, text: string) => {
    if (!text.trim()) return;
    setState(prev => ({
      ...prev,
      goals: prev.goals.map(g => {
        if (g.id !== goalId) return g;
        return {
          ...g,
          steps: [...g.steps, { id: genId(), text: text.trim(), contribution_factor: 0.5, status: 'pending' as const }],
          status: g.status === 'done' ? 'active' as const : g.status,
        };
      }),
    }));
  };

  const deleteGoal = (goalId: string) => {
    if (!confirm('Удалить эту цель?')) return;
    setState(prev => ({ ...prev, goals: prev.goals.filter(g => g.id !== goalId) }));
  };

  const deleteStep = (goalId: string, stepId: string) => {
    setState(prev => ({
      ...prev,
      goals: prev.goals.map(g => g.id === goalId ? { ...g, steps: g.steps.filter(s => s.id !== stepId) } : g),
    }));
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* New Goal Form */}
      <div className="glass-panel p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold">🎯 Долгосрочные цели</h3>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-xs px-3 py-1.5 rounded-lg bg-[var(--panel-2)] border border-[var(--line)] text-[var(--text-dim)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
          >
            {showForm ? 'Отмена' : '+ Новая цель'}
          </button>
        </div>

        {showForm && (
          <div className="space-y-3 animate-slide-up">
            <select
              value={newGoalCat}
              onChange={e => setNewGoalCat(e.target.value)}
              className="w-full bg-[var(--panel-2)] border border-[var(--line)] rounded-lg p-2.5 text-sm text-[var(--text)]"
            >
              {state.categories.map(c => (
                <option key={c.id} value={c.id}>{c.name} (вес {c.weight})</option>
              ))}
            </select>
            <textarea
              value={newGoalText}
              onChange={e => setNewGoalText(e.target.value)}
              placeholder="Опиши цель своими словами..."
              className="w-full min-h-[60px] bg-[var(--panel-2)] border border-[var(--line)] rounded-lg p-3 text-sm text-[var(--text)] resize-y focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              onClick={generatePlan}
              disabled={!newGoalText.trim()}
              className="w-full bg-[var(--accent)] text-white rounded-lg py-2.5 font-semibold text-sm disabled:opacity-50"
            >
              Сгенерировать варианты плана
            </button>
            {planStatus && <p className="text-sm text-[var(--text-dim)]">{planStatus}</p>}
          </div>
        )}
      </div>

      {/* Goals List */}
      {state.goals.length === 0 ? (
        <div className="glass-panel p-6 text-center">
          <p className="text-sm text-[var(--text-dim)]">Пока нет целей — добавь через «+ Новая цель»</p>
        </div>
      ) : (
        <div className="space-y-3">
          {state.goals.map(goal => {
            const cat = state.categories.find(c => c.id === goal.category_id);
            
            if (goal.status === 'planning' && goal.plan_options) {
              return (
                <div key={goal.id} className="glass-panel p-4 border-l-3" style={{ borderLeftColor: 'var(--warn)' }}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-semibold text-sm">{goal.title}</div>
                      <div className="text-xs text-[var(--text-dim)]">{cat?.name} · выбери подход</div>
                    </div>
                    <button onClick={() => deleteGoal(goal.id)} className="text-[var(--text-dim)] hover:text-[var(--danger)] text-lg">×</button>
                  </div>

                  {goal.plan_options.map((opt, idx) => {
                    const key = `${goal.id}-${idx}`;
                    return (
                      <div key={idx} className="bg-[var(--panel-2)] border border-[var(--line)] rounded-lg p-3 mt-3 hover:border-[var(--accent)] transition-colors">
                        <div className="font-semibold text-sm">{opt.label}</div>
                        <div className="text-xs text-[var(--text-dim)] mt-1">{opt.rationale}</div>
                        <ul className="text-xs text-[var(--text-dim)] mt-2 pl-4 list-disc">
                          {opt.steps.map((s, i) => <li key={i}>{s.text}</li>)}
                        </ul>
                        <button
                          onClick={() => pickPlanOption(goal.id, idx)}
                          className="mt-3 bg-[var(--accent)] text-white rounded-md px-3 py-1.5 text-xs font-semibold"
                        >
                          Выбрать этот путь
                        </button>
                        <div className="flex gap-2 mt-2">
                          <input
                            type="text"
                            value={refineInputs[key] || ''}
                            onChange={e => setRefineInputs(prev => ({ ...prev, [key]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') refinePlan(goal.id, idx); }}
                            placeholder="Замечания к варианту..."
                            className="flex-1 bg-[var(--panel)] border border-[var(--line)] rounded-md px-2 py-1.5 text-xs text-[var(--text)]"
                          />
                          <button
                            onClick={() => refinePlan(goal.id, idx)}
                            className="text-xs px-3 py-1.5 border border-[var(--line)] rounded-md text-[var(--text-dim)] hover:text-[var(--accent)] hover:border-[var(--accent)]"
                          >
                            Уточнить
                          </button>
                        </div>
                        {refineStatus[key] && <p className="text-xs text-[var(--text-dim)] mt-1">{refineStatus[key]}</p>}
                      </div>
                    );
                  })}
                </div>
              );
            }

            // Active or done goal
            const doneCount = goal.steps.filter(s => s.status === 'done').length;
            const progress = goal.steps.length > 0 ? (doneCount / goal.steps.length) * 100 : 0;

            return (
              <div key={goal.id} className="glass-panel p-4 border-l-3" style={{ borderLeftColor: goal.status === 'done' ? 'var(--good)' : 'var(--warn)' }}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-semibold text-sm">{goal.title}</div>
                    <div className="text-xs text-[var(--text-dim)]">
                      {cat?.name}
                      {goal.status === 'done' && ' · ✅ достигнута'}
                    </div>
                  </div>
                  <button onClick={() => deleteGoal(goal.id)} className="text-[var(--text-dim)] hover:text-[var(--danger)] text-lg">×</button>
                </div>

                <div className="text-xs text-[var(--text-dim)] mb-3">{doneCount}/{goal.steps.length} шагов</div>
                <div className="h-1.5 bg-[var(--panel-2)] rounded-full overflow-hidden mb-3">
                  <div className="h-full bg-[var(--good)] rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>

                <div className="space-y-2">
                  {goal.steps.map(step => (
                    <div key={step.id} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={step.status === 'done'}
                        disabled={step.status === 'done'}
                        onChange={() => completeStep(goal.id, step.id)}
                        className="mt-0.5 w-4 h-4 accent-[var(--accent)]"
                      />
                      <span className={`flex-1 text-sm ${step.status === 'done' ? 'line-through text-[var(--text-dim)]' : ''}`}>
                        {step.text}
                      </span>
                      {step.status !== 'done' && (
                        <button
                          onClick={() => deleteStep(goal.id, step.id)}
                          className="text-[var(--text-dim)] hover:text-[var(--danger)] text-sm"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {goal.status !== 'done' && (
                  <AddStepInput onAdd={(text) => addStep(goal.id, text)} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddStepInput({ onAdd }: { onAdd: (text: string) => void }) {
  const [text, setText] = useState('');
  return (
    <div className="flex gap-2 mt-3">
      <input
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && text.trim()) { onAdd(text); setText(''); } }}
        placeholder="+ добавить шаг"
        className="flex-1 bg-[var(--panel-2)] border border-[var(--line)] rounded-lg px-3 py-2 text-xs text-[var(--text)]"
      />
    </div>
  );
}
