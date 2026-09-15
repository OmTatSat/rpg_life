import React, { useState } from 'react';
import { AppState, genId } from '../store';
import { callSeedQuest, callSeedVerdict } from '../api';

interface Props {
  state: AppState;
  setState: (fn: (prev: AppState) => AppState) => void;
}

export default function Seeds({ state, setState }: Props) {
  const [seedInput, setSeedInput] = useState('');
  const [seedStatus, setSeedStatus] = useState('');
  const [resultInputs, setResultInputs] = useState<Record<string, string>>({});
  const [questStatus, setQuestStatus] = useState<Record<string, string>>({});

  const addSeed = () => {
    if (!seedInput.trim()) return;
    setState(prev => ({
      ...prev,
      seeds: [...prev.seeds, {
        id: genId(),
        text: seedInput.trim(),
        category_id: null,
        source: 'manual' as const,
        status: 'open' as const,
        quest_options: [],
        chosen_approach: null,
        experiment_result: null,
        verdict: null,
        feedback: null,
        artifact_id: null,
        created_at: new Date().toISOString(),
      }],
    }));
    setSeedInput('');
    setSeedStatus('Сохранено ✓');
    setTimeout(() => setSeedStatus(''), 2000);
  };

  const startQuest = async (seedId: string) => {
    const seed = state.seeds.find(s => s.id === seedId);
    if (!seed) return;

    setQuestStatus(prev => ({ ...prev, [seedId]: 'Ищу варианты...' }));
    try {
      const result = await callSeedQuest(state, seed);
      setState(prev => ({
        ...prev,
        seeds: prev.seeds.map(s => s.id === seedId ? {
          ...s,
          quest_options: result.options || [],
          status: 'questing' as const,
          chosen_approach: null,
          experiment_result: null,
          verdict: null,
          feedback: null,
        } : s),
      }));
      setQuestStatus(prev => ({ ...prev, [seedId]: '' }));
    } catch (e: any) {
      setQuestStatus(prev => ({ ...prev, [seedId]: e.message }));
    }
  };

  const pickOption = (seedId: string, optionIdx: number) => {
    const seed = state.seeds.find(s => s.id === seedId);
    if (!seed) return;
    const option = seed.quest_options[optionIdx];
    setState(prev => ({
      ...prev,
      seeds: prev.seeds.map(s => s.id === seedId ? {
        ...s,
        chosen_approach: option,
        status: 'experimenting' as const,
        experiment_result: null,
        verdict: null,
        feedback: null,
      } : s),
    }));
  };

  const submitResult = async (seedId: string) => {
    const seed = state.seeds.find(s => s.id === seedId);
    if (!seed || !seed.chosen_approach) return;
    const resultText = resultInputs[seedId];
    if (!resultText?.trim()) return;

    setQuestStatus(prev => ({ ...prev, [seedId]: 'Оцениваю результат...' }));
    try {
      const verdict = await callSeedVerdict(state, seed.text, seed.chosen_approach, resultText);

      setState(prev => {
        const newState = { ...prev };
        const seeds = newState.seeds.map(s => {
          if (s.id !== seedId) return s;
          const updated = {
            ...s,
            experiment_result: resultText,
            feedback: verdict.feedback || null,
            verdict: verdict.verdict as 'artifact' | 'refine',
          };

          if (verdict.verdict === 'artifact' && verdict.artifact) {
            const artifact = {
              id: genId(),
              name: verdict.artifact.name,
              description: verdict.artifact.description,
              category_id: s.category_id,
              source_seed_id: s.id,
              created_at: new Date().toISOString(),
            };
            newState.artifacts = [...newState.artifacts, artifact];
            return { ...updated, status: 'resolved' as const, artifact_id: artifact.id };
          }
          return updated;
        });
        return { ...newState, seeds };
      });
      setQuestStatus(prev => ({ ...prev, [seedId]: '' }));
    } catch (e: any) {
      setQuestStatus(prev => ({ ...prev, [seedId]: e.message }));
    }
  };

  const deleteSeed = (seedId: string) => {
    if (!confirm('Удалить это зерно?')) return;
    setState(prev => ({ ...prev, seeds: prev.seeds.filter(s => s.id !== seedId) }));
  };

  const deleteArtifact = (artifactId: string) => {
    if (!confirm('Удалить артефакт?')) return;
    setState(prev => ({ ...prev, artifacts: prev.artifacts.filter(a => a.id !== artifactId) }));
  };

  const order: Record<string, number> = { experimenting: 0, questing: 1, open: 2, resolved: 3 };
  const sortedSeeds = [...state.seeds].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Input */}
      <div className="glass-panel p-4">
        <h3 className="text-sm font-semibold mb-3">🌱 Зёрна — затруднения для исследования</h3>
        <textarea
          value={seedInput}
          onChange={e => setSeedInput(e.target.value)}
          placeholder="Опиши затруднение, изъян, то что не получается или повторяется..."
          className="w-full min-h-[60px] bg-[var(--panel-2)] border border-[var(--line)] rounded-lg p-3 text-sm text-[var(--text)] resize-y focus:outline-none focus:border-[var(--accent)]"
        />
        <button
          onClick={addSeed}
          disabled={!seedInput.trim()}
          className="w-full mt-2 bg-[var(--purple)] text-white rounded-lg py-2.5 font-semibold text-sm disabled:opacity-50"
        >
          Сохранить как зерно
        </button>
        {seedStatus && <p className="text-sm text-[var(--good)] mt-2">{seedStatus}</p>}
      </div>

      {/* Seeds List */}
      {sortedSeeds.length === 0 ? (
        <div className="glass-panel p-6 text-center">
          <p className="text-sm text-[var(--text-dim)]">Пока нет зёрен — пиши сюда затруднения, или они появятся автоматически из записей.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedSeeds.map(seed => {
            const cat = state.categories.find(c => c.id === seed.category_id);
            return (
              <div key={seed.id} className="glass-panel p-4 border-l-3" style={{ borderLeftColor: 'var(--purple)' }}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-sm font-semibold">{seed.text}</div>
                    <div className="text-xs text-[var(--text-dim)] mt-1 flex gap-2">
                      {cat && <span className="px-2 py-0.5 rounded-full border border-[var(--line)]">{cat.name}</span>}
                      <span className="px-2 py-0.5 rounded-full border border-[var(--line)]">
                        {seed.source === 'auto' ? 'замечено ИИ' : 'вручную'}
                      </span>
                      {seed.status === 'resolved' && <span className="px-2 py-0.5 rounded-full border border-[var(--good)] text-[var(--good)]">решено</span>}
                    </div>
                  </div>
                  <button onClick={() => deleteSeed(seed.id)} className="text-[var(--text-dim)] hover:text-[var(--danger)] text-lg">×</button>
                </div>

                {/* Open - waiting for quest */}
                {seed.status === 'open' && (
                  <div>
                    <button
                      onClick={() => startQuest(seed.id)}
                      className="mt-2 bg-[var(--purple)] text-white rounded-md px-3 py-1.5 text-xs font-semibold"
                    >
                      Начать квест-исследование
                    </button>
                    {questStatus[seed.id] && <p className="text-xs text-[var(--text-dim)] mt-2">{questStatus[seed.id]}</p>}
                  </div>
                )}

                {/* Questing - show options */}
                {seed.status === 'questing' && (
                  <div className="space-y-2 mt-3">
                    {seed.quest_options.map((opt, idx) => (
                      <div key={idx} className="bg-[var(--panel-2)] border border-[var(--line)] rounded-lg p-3">
                        <div className="text-sm font-semibold">{opt.label}</div>
                        <div className="text-xs text-[var(--text)] mt-1">{opt.description}</div>
                        <div className="text-xs text-[var(--text-dim)] mt-1 italic">Если сработает: {opt.hypothesis}</div>
                        <button
                          onClick={() => pickOption(seed.id, idx)}
                          className="mt-2 bg-[var(--purple)] text-white rounded-md px-3 py-1.5 text-xs"
                        >
                          Выбрать этот подход
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Experimenting - show chosen approach + result input */}
                {seed.status === 'experimenting' && seed.chosen_approach && (
                  <div className="mt-3">
                    <div className="bg-[var(--panel-2)] rounded-lg p-3">
                      <div className="text-sm font-semibold">{seed.chosen_approach.label}</div>
                      <div className="text-xs text-[var(--text)] mt-1">{seed.chosen_approach.description}</div>
                      <div className="text-xs text-[var(--text-dim)] mt-1 italic">Если сработает: {seed.chosen_approach.hypothesis}</div>
                    </div>

                    {seed.verdict === 'refine' && seed.feedback && (
                      <div className="mt-3 p-3 bg-[var(--panel-2)] border-l-3 border-l-[var(--warn)] rounded-lg">
                        <p className="text-xs">{seed.feedback}</p>
                        <button
                          onClick={() => startQuest(seed.id)}
                          className="mt-2 text-xs px-3 py-1.5 border border-[var(--line)] rounded-md text-[var(--text-dim)] hover:text-[var(--accent)]"
                        >
                          Другие варианты
                        </button>
                      </div>
                    )}

                    <textarea
                      value={resultInputs[seed.id] || ''}
                      onChange={e => setResultInputs(prev => ({ ...prev, [seed.id]: e.target.value }))}
                      placeholder="Что получилось? Опиши результат..."
                      className="w-full min-h-[50px] mt-3 bg-[var(--panel-2)] border border-[var(--line)] rounded-lg p-3 text-xs text-[var(--text)] resize-y focus:outline-none focus:border-[var(--accent)]"
                    />
                    <button
                      onClick={() => submitResult(seed.id)}
                      disabled={!resultInputs[seed.id]?.trim()}
                      className="mt-2 bg-[var(--accent)] text-white rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                    >
                      Записать результат
                    </button>
                    {questStatus[seed.id] && <p className="text-xs text-[var(--text-dim)] mt-2">{questStatus[seed.id]}</p>}
                  </div>
                )}

                {/* Resolved */}
                {seed.status === 'resolved' && seed.artifact_id && (
                  <div className="mt-2 text-xs text-[var(--good)]">
                    🏺 Получен артефакт: «{state.artifacts.find(a => a.id === seed.artifact_id)?.name}»
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Artifacts */}
      {state.artifacts.length > 0 && (
        <div className="glass-panel p-4">
          <h3 className="text-sm font-semibold mb-3">🏺 Артефакты ({state.artifacts.length})</h3>
          <div className="space-y-2">
            {state.artifacts.map(a => {
              const cat = state.categories.find(c => c.id === a.category_id);
              return (
                <div key={a.id} className="flex justify-between items-start p-3 bg-[var(--panel-2)] rounded-lg border-l-3" style={{ borderLeftColor: 'var(--good)' }}>
                  <div>
                    <div className="text-sm font-semibold">🏺 {a.name}</div>
                    <div className="text-xs text-[var(--text-dim)] mt-1">{a.description}</div>
                    <div className="text-xs text-[var(--text-dim)] mt-1">
                      {cat?.name} · {new Date(a.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button onClick={() => deleteArtifact(a.id)} className="text-[var(--text-dim)] hover:text-[var(--danger)] text-lg">×</button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
