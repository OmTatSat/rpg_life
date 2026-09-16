import React, { useState } from 'react';
import { AppState, genId, getQuickTemplates, calculateGoldFromXp, addSomaticLoad } from '../store';
import { callGameMaster } from '../api';

interface Props {
  state: AppState;
  setState: (fn: (prev: AppState) => AppState) => void;
}

export default function ActionLogger({ state, setState }: Props) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'ok' | 'err'; text: string }>({ type: 'idle', text: '' });
  const [clarification, setClarification] = useState<string | null>(null);
  const [artifactHint, setArtifactHint] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [nervousSystemImpact, setNervousSystemImpact] = useState<{ somaticImpact: number; nscModifier: number } | null>(null);
  
  // Умный поиск
  const searchText = text.toLowerCase().trim();
  const hasSearchText = searchText.length > 0;
  
  // Фильтрация быстрых действий
  const filteredQuickActions = hasSearchText
    ? state.categories.map(cat => ({
        ...cat,
        templates: getQuickTemplates(state, cat.id).filter(t => 
          t.toLowerCase().includes(searchText)
        )
      })).filter(cat => cat.templates.length > 0)
    : [];
  
  // Фильтрация истории
  const filteredHistory = hasSearchText
    ? state.history.filter(h => {
        const fullText = (h.full_text || h.text).toLowerCase();
        return fullText.includes(searchText);
      })
    : [];

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setStatus({ type: 'loading', text: 'Спрашиваю Game Master\'а...' });
    setClarification(null);
    setArtifactHint(null);

    try {
      const result = await callGameMaster(state, text.trim());
      const matches = Array.isArray(result.matches) ? result.matches : [];

      if (result.confidence === 'low' || matches.length === 0) {
        setClarification(result.clarification_needed || 'Не понял, к какой категории это относится — уточни?');
        setStatus({ type: 'idle', text: '' });
        return;
      }

      const ts = new Date().toISOString();
      const summaryParts: string[] = [];

      // Calculate gold and somatic impact before setState
      let totalGold = 0;
      let totalSomaticImpact = 0;
      let totalNscModifier = 0;
      matches.forEach((m: any) => {
        const cat = state.categories.find(c => c.id === m.matched_category_id);
        if (!cat) return;
        const finalXp = Math.round(m.base_xp * cat.weight * m.contribution_factor);
        totalGold += calculateGoldFromXp(finalXp);
        
        // Собираем влияние на нервную систему
        if (typeof m.somaticImpact === 'number') {
          totalSomaticImpact += m.somaticImpact;
        }
        if (typeof m.nscModifier === 'number') {
          totalNscModifier += m.nscModifier;
        }
      });

      setState(prev => {
        const newState = { ...prev };
        matches.forEach((m: any) => {
          const cat = prev.categories.find(c => c.id === m.matched_category_id);
          if (!cat) return;
          const finalXp = Math.round(m.base_xp * cat.weight * m.contribution_factor);
          newState.history = [...newState.history, {
            id: genId(),
            text: m.new_quest_text || text,
            full_text: text,
            category_id: cat.id,
            final_xp: finalXp,
            quest_type: m.quest_type,
            timestamp: ts,
          }];
          summaryParts.push(`+${finalXp} XP → ${cat.name}`);
        });
        newState.gold = (newState.gold || 0) + totalGold;
        
        // Применяем влияние на нервную систему
        if (totalSomaticImpact !== 0) {
          const updated = addSomaticLoad(newState, totalSomaticImpact);
          newState.currentSomaticLoad = updated.currentSomaticLoad;
          newState.isBurnoutRisk = updated.isBurnoutRisk;
        }
        if (totalNscModifier !== 0) {
          // Модифицируем ёмкость нервной системы
          const newCapacity = Math.max(50, Math.min(150, newState.nervousSystemCapacity + totalNscModifier));
          newState.nervousSystemCapacity = newCapacity;
        }

        // Supplements
        if (Array.isArray(result.supplements) && result.supplements.length > 0) {
          const newSupps = result.supplements.map((s: any) => ({
            id: genId(),
            name: s.name,
            dose_amount: s.dose_amount ?? null,
            dose_unit: s.dose_unit ?? null,
            context: s.context ?? null,
            timestamp: ts,
          }));
          newState.supplements_log = [...newState.supplements_log, ...newSupps];
        }

        // Seed detected
        if (result.seed_detected && result.seed_detected.text) {
          newState.seeds = [...newState.seeds, {
            id: genId(),
            text: result.seed_detected.text,
            category_id: result.seed_detected.category_id || null,
            source: 'auto' as const,
            status: 'open' as const,
            quest_options: [],
            chosen_approach: null,
            experiment_result: null,
            verdict: null,
            feedback: null,
            artifact_id: null,
            created_at: ts,
          }];
        }

        return newState;
      });

      setText('');
      let summaryText = `Записано: ${summaryParts.join(', ')}`;
      if (totalGold > 0) summaryText += ` · +${totalGold} 🪙`;
      if (result.seed_detected?.text) summaryText += ' · 🌱 замечено зерно';
      setStatus({ type: 'ok', text: summaryText });

      // Сохраняем влияние на нервную систему для отображения
      setNervousSystemImpact({
        somaticImpact: totalSomaticImpact,
        nscModifier: totalNscModifier,
      });

      if (result.artifact_hint?.artifact_id) {
        const art = state.artifacts.find(a => a.id === result.artifact_hint.artifact_id);
        if (art) setArtifactHint(`💡 «${art.name}»: ${result.artifact_hint.note}`);
      }
    } catch (e: any) {
      setStatus({ type: 'err', text: e.message });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
  };

  const deleteEntry = (idx: number) => {
    if (!confirm('Удалить запись?')) return;
    setState(prev => ({
      ...prev,
      history: prev.history.filter((_, i) => i !== idx),
    }));
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Input */}
      <div className="glass-panel p-4">
        <h3 className="text-sm font-semibold mb-3">Что сделал?</h3>
        <textarea
          value={text}
          onChange={e => {
            setText(e.target.value);
            // Очищаем индикаторы при новом вводе
            if (nervousSystemImpact) {
              setNervousSystemImpact(null);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Например: потренировался 40 минут, потом почитал книгу..."
          className="w-full min-h-[80px] bg-[var(--panel-2)] border border-[var(--line)] rounded-lg p-3 text-sm text-[var(--text)] resize-y focus:outline-none focus:border-[var(--accent)] transition-colors"
        />
        
        {/* Quick templates */}
        <div className="mt-3">
          <div className="text-xs text-[var(--text-dim)] mb-2">
            {hasSearchText 
              ? `Найдено в быстрых действиях (${filteredQuickActions.reduce((sum, cat) => sum + cat.templates.length, 0)}):`
              : `Быстрые действия (${state.history.length} в истории):`
            }
          </div>
          <div className="max-h-[120px] overflow-y-auto pr-2">
            <div className="flex flex-wrap gap-2">
              {(hasSearchText ? filteredQuickActions : state.categories.map(cat => ({
                ...cat,
                templates: getQuickTemplates(state, cat.id)
              }))).map(cat => {
                if (cat.templates.length === 0) return null;
                return (
                  <div key={cat.id} className="w-full mb-2">
                    <div className="text-xs text-[var(--text-dim)] mb-1 font-medium" style={{ color: cat.color }}>
                      {cat.name} ({cat.templates.length}):
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {cat.templates.map((t, i) => (
                        <button
                          key={`${cat.id}-${i}`}
                          onClick={() => setText(t)}
                          title={t}
                          className="chip-quick text-xs px-3 py-1.5 rounded-full bg-[var(--panel-2)] border border-[var(--line)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--accent)]"
                        >
                          {t.length > 25 ? t.slice(0, 25) + '…' : t}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {hasSearchText && filteredQuickActions.length === 0 && (
                <div className="text-xs text-[var(--text-dim)] italic">Ничего не найдено</div>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!text.trim() || status.type === 'loading'}
          className="w-full mt-3 bg-[var(--accent)] text-white rounded-lg py-3 font-semibold text-sm disabled:opacity-50 disabled:cursor-default hover:opacity-90 transition-opacity"
        >
          {status.type === 'loading' ? '⏳ Обрабатываю...' : '🎯 Записать'}
        </button>

        {clarification && (
          <div className="mt-3 p-3 bg-[var(--panel-2)] border border-[var(--warn)] rounded-lg text-sm">
            ❓ {clarification}
          </div>
        )}

        {artifactHint && (
          <div className="mt-3 text-sm text-[var(--good)]">{artifactHint}</div>
        )}

        {status.text && (
          <div className={`mt-3 text-sm ${status.type === 'err' ? 'text-[var(--danger)]' : status.type === 'ok' ? 'text-[var(--good)]' : 'text-[var(--text-dim)]'}`}>
            {status.text}
          </div>
        )}

        {/* Индикаторы влияния на нервную систему */}
        {nervousSystemImpact && status.type === 'ok' && (
          <div className="mt-3 space-y-2">
            {nervousSystemImpact.somaticImpact > 0 && (
              <div className="flex items-center gap-2 p-2 bg-[var(--danger)] bg-opacity-10 border border-[var(--danger)] rounded-lg">
                <span className="text-lg">⚠️</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-[var(--danger)]">
                    +{nervousSystemImpact.somaticImpact} Соматический груз
                  </div>
                  <div className="text-xs text-[var(--text-dim)]">
                    Нагрузка на нервную систему увеличена
                  </div>
                </div>
              </div>
            )}
            {nervousSystemImpact.somaticImpact < 0 && (
              <div className="flex items-center gap-2 p-2 bg-[var(--good)] bg-opacity-10 border border-[var(--good)] rounded-lg">
                <span className="text-lg">✨</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-[var(--good)]">
                    {nervousSystemImpact.somaticImpact} Соматический груз
                  </div>
                  <div className="text-xs text-[var(--text-dim)]">
                    Восстановление нервной системы
                  </div>
                </div>
              </div>
            )}
            {nervousSystemImpact.nscModifier < 0 && (
              <div className="flex items-center gap-2 p-2 bg-[var(--warn)] bg-opacity-10 border border-[var(--warn)] rounded-lg">
                <span className="text-lg">🧠</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-[var(--warn)]">
                    Зафиксировано сужение Емкости ЦНС
                  </div>
                  <div className="text-xs text-[var(--text-dim)]">
                    {nervousSystemImpact.nscModifier} к ёмкости нервной системы
                  </div>
                </div>
              </div>
            )}
            {nervousSystemImpact.nscModifier > 0 && (
              <div className="flex items-center gap-2 p-2 bg-[var(--accent)] bg-opacity-10 border border-[var(--accent)] rounded-lg">
                <span className="text-lg">💪</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-[var(--accent)]">
                    Расширение Емкости ЦНС
                  </div>
                  <div className="text-xs text-[var(--text-dim)]">
                    +{nervousSystemImpact.nscModifier} к ёмкости нервной системы
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-[var(--text-dim)] mt-2">Ctrl+Enter для быстрой записи</p>
      </div>

      {/* History */}
      <div className="glass-panel p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold">
            {hasSearchText 
              ? `Найдено в истории (${filteredHistory.length}):`
              : `История (${state.history.length})`
            }
          </h3>
          {!hasSearchText && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs text-[var(--accent)] hover:underline"
            >
              {showHistory ? 'Свернуть' : 'Показать все'}
            </button>
          )}
        </div>

        {state.history.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)]">Пока пусто — запиши первое действие выше.</p>
        ) : hasSearchText && filteredHistory.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)] italic">Ничего не найдено по запросу "{text}"</p>
        ) : (
          <div className="space-y-2">
            {(hasSearchText 
              ? filteredHistory 
              : (showHistory ? state.history : state.history.slice(-10))
            ).slice().reverse().map((h, revIdx) => {
              const origIdx = state.history.length - 1 - revIdx;
              const cat = state.categories.find(c => c.id === h.category_id);
              // Автоматически раскрывать при поиске
              const isExpanded = hasSearchText || expandedId === h.id;
              const fullText = h.full_text || h.text;
              return (
                <div key={h.id} className="border-b border-[var(--line)] last:border-0">
                  <div className="flex items-start gap-3 py-2">
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => !hasSearchText && setExpandedId(expandedId === h.id ? null : h.id)}
                    >
                      <div className="text-sm">{h.text}</div>
                      <div className="text-xs text-[var(--text-dim)] mt-0.5 flex items-center gap-1">
                        <span style={{ color: cat?.color }}>{cat?.name || h.category_id}</span>
                        <span>·</span>
                        <span>{new Date(h.timestamp).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        {!hasSearchText && fullText !== h.text && (
                          <span className="text-[var(--accent)] text-xs">{expandedId === h.id ? '▲' : '▼'}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-[var(--good)]">+{h.final_xp}</span>
                      <button
                        onClick={() => deleteEntry(showHistory ? origIdx : state.history.length - 1 - revIdx)}
                        className="text-[var(--text-dim)] hover:text-[var(--danger)] text-lg leading-none px-1"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  {isExpanded && fullText !== h.text && (
                    <div className="ml-4 mb-2 animate-slide-up">
                      <div className="bg-[var(--panel-2)] border border-[var(--line)] rounded-lg p-3">
                        <div className="text-xs text-[var(--text-dim)] mb-1">Полный текст:</div>
                        <div className="text-sm whitespace-pre-wrap">{fullText}</div>
                        <button
                          onClick={() => {
                            setText(fullText);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="mt-2 text-xs px-3 py-1.5 bg-[var(--accent)] text-white rounded hover:opacity-90"
                        >
                          📋 Использовать как новое действие
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Supplements */}
      {state.supplements_log.length > 0 && (
        <div className="glass-panel p-4">
          <h3 className="text-sm font-semibold mb-3">💊 Добавки</h3>
          <div className="space-y-2">
            {state.supplements_log.slice(-10).reverse().map(s => (
              <div key={s.id} className="flex justify-between text-sm py-1 border-b border-[var(--line)] last:border-0">
                <div>
                  <span>{s.name}</span>
                  {s.context && <span className="text-[var(--text-dim)] ml-2">· {s.context}</span>}
                </div>
                <div className="text-[var(--text-dim)]">
                  {s.dose_amount ? `${s.dose_amount} ${s.dose_unit || ''}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
