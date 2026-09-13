import React, { useState, useRef, useEffect } from 'react';
import { AppState, Insight, InsightMessage, Artifact, genId } from '../store';
import { callInsightInvestigation } from '../api';

interface Props {
  state: AppState;
  setState: (fn: (prev: AppState) => AppState) => void;
}

function StatusBadge({ status }: { status: Insight['status'] }) {
  const config: Record<Insight['status'], { label: string; color: string; icon: string }> = {
    pending: { label: 'Ожидает', color: 'var(--text-dim)', icon: '⏳' },
    investigating: { label: 'Исследуется', color: 'var(--warn)', icon: '🔬' },
    refined: { label: 'Уточнён', color: 'var(--good)', icon: '✨' },
    bounded: { label: 'С границами', color: 'var(--accent)', icon: '🎯' },
    retired: { label: 'Отложен', color: 'var(--text-dim)', icon: '💤' },
  };
  const c = config[status];
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full border"
      style={{ color: c.color, borderColor: c.color }}
    >
      {c.icon} {c.label}
    </span>
  );
}

function InsightChat({
  insight,
  state,
  setState,
  onClose,
}: {
  insight: Insight;
  state: AppState;
  setState: (fn: (prev: AppState) => AppState) => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [insight.messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: InsightMessage = { role: 'user', text: input.trim() };

    setState(prev => ({
      ...prev,
      insights: prev.insights.map(i =>
        i.id === insight.id
          ? { ...i, messages: [...i.messages, userMsg], status: 'investigating' as const }
          : i
      ),
    }));
    setInput('');
    setLoading(true);

    try {
      const conversation = [...insight.messages, userMsg].map(m => ({
        role: m.role,
        text: m.text,
      }));

      const result = await callInsightInvestigation(state, insight.text, conversation);

      const assistantMsg: InsightMessage = { role: 'assistant', text: result.message };

      setState(prev => {
        const updated = prev.insights.map(i => {
          if (i.id !== insight.id) return i;
          const newMessages = [...i.messages, assistantMsg];
          const update: Partial<Insight> = { messages: newMessages };

          if (result.status === 'refined' || result.status === 'bounded') {
            update.status = result.status;
            update.final_insight = result.final_insight;
            update.sources = result.sources || [];

            // Create artifact
            if (result.final_insight) {
              const artifact: Artifact = {
                id: genId(),
                name: result.final_insight.slice(0, 50),
                description: result.final_insight,
                category_id: null,
                source_seed_id: insight.id,
                created_at: new Date().toISOString(),
              };
              update.artifact_id = artifact.id;
              return { ...i, ...update, artifacts: [...(prev.artifacts || []), artifact] };
            }
          } else if (result.status === 'retired') {
            update.status = 'retired';
            update.final_insight = result.final_insight;
            update.sources = result.sources || [];
          }

          return { ...i, ...update };
        });

        // Handle artifact creation separately
        if (result.status === 'refined' || result.status === 'bounded') {
          if (result.final_insight) {
            const artifact: Artifact = {
              id: genId(),
              name: result.final_insight.slice(0, 50),
              description: result.final_insight,
              category_id: null,
              source_seed_id: insight.id,
              created_at: new Date().toISOString(),
            };
            return {
              ...prev,
              insights: updated,
              artifacts: [...(prev.artifacts || []), artifact],
            };
          }
        }

        return { ...prev, insights: updated };
      });
    } catch (e: any) {
      console.error('Investigation failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const retire = () => {
    setState(prev => ({
      ...prev,
      insights: prev.insights.map(i =>
        i.id === insight.id ? { ...i, status: 'retired' as const } : i
      ),
    }));
    onClose();
  };

  return (
    <div className="glass-panel p-4 animate-slide-up">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold">🔬 Исследование</h3>
        <div className="flex gap-2">
          {insight.status === 'investigating' && (
            <button
              onClick={retire}
              className="text-xs px-2 py-1 border border-[var(--line)] rounded text-[var(--text-dim)] hover:text-[var(--text)]"
            >
              💤 Отложить
            </button>
          )}
          <button
            onClick={onClose}
            className="text-[var(--text-dim)] hover:text-[var(--text)] text-lg"
          >
            ×
          </button>
        </div>
      </div>

      <div className="text-xs text-[var(--text-dim)] mb-3 italic">
        «{insight.text}»
      </div>

      {/* Chat log */}
      <div ref={logRef} className="max-h-[300px] overflow-y-auto space-y-2 mb-3">
        {insight.messages.length === 0 && (
          <div className="text-xs text-[var(--text-dim)] italic p-2">
            Начни диалог — напиши что думаешь об этой идее, или задай вопрос...
          </div>
        )}
        {insight.messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                m.role === 'user'
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--panel-2)] border border-[var(--line)]'
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[var(--panel-2)] border border-[var(--line)] rounded-xl px-3 py-2 text-sm text-[var(--text-dim)]">
              🔬 Думаю...
            </div>
          </div>
        )}
      </div>

      {/* Final insight display */}
      {insight.final_insight && (insight.status === 'refined' || insight.status === 'bounded') && (
        <div className="p-3 bg-[var(--panel-2)] rounded-lg border-l-3 mb-3" style={{ borderLeftColor: 'var(--good)' }}>
          <div className="text-xs text-[var(--text-dim)] mb-1">✨ Уточнённая формулировка:</div>
          <div className="text-sm italic">«{insight.final_insight}»</div>
          {insight.sources.length > 0 && (
            <div className="text-xs text-[var(--text-dim)] mt-2">
              Источники: {insight.sources.join(', ')}
            </div>
          )}
        </div>
      )}

      {insight.status === 'retired' && (
        <div className="p-3 bg-[var(--panel-2)] rounded-lg border-l-3 mb-3" style={{ borderLeftColor: 'var(--text-dim)' }}>
          <div className="text-xs text-[var(--text-dim)] mb-1">💤 Отложено</div>
          {insight.final_insight && (
            <div className="text-sm italic">«{insight.final_insight}»</div>
          )}
        </div>
      )}

      {/* Input (only if not finished) */}
      {(insight.status === 'pending' || insight.status === 'investigating') && (
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send();
            }}
            placeholder="Напиши свои мысли..."
            className="flex-1 min-h-[50px] bg-[var(--panel-2)] border border-[var(--line)] rounded-lg p-3 text-sm text-[var(--text)] resize-y focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
      )}
      {(insight.status === 'pending' || insight.status === 'investigating') && (
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          className="w-full mt-2 bg-[var(--accent)] text-white rounded-lg py-2 font-semibold text-sm disabled:opacity-50"
        >
          {loading ? '🔬 Думаю...' : '💬 Отправить'}
        </button>
      )}
    </div>
  );
}

export default function Insights({ state, setState }: Props) {
  const [newInsight, setNewInsight] = useState('');
  const [openInsightId, setOpenInsightId] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!newInsight.trim()) return;

    const insight: Insight = {
      id: genId(),
      text: newInsight.trim(),
      status: 'pending',
      messages: [],
      final_insight: null,
      sources: [],
      artifact_id: null,
      created_at: new Date().toISOString(),
    };

    setState(prev => ({
      ...prev,
      insights: [...prev.insights, insight],
    }));

    setNewInsight('');
    setOpenInsightId(insight.id);
  };

  const openInsight = state.insights.find(i => i.id === openInsightId);

  const investigating = state.insights.filter(i => i.status === 'investigating');
  const pending = state.insights.filter(i => i.status === 'pending');
  const finished = state.insights.filter(i =>
    i.status === 'refined' || i.status === 'bounded' || i.status === 'retired'
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Input */}
      <div className="glass-panel p-4">
        <h3 className="text-sm font-semibold mb-3">💡 Лаборатория идей</h3>
        <textarea
          value={newInsight}
          onChange={e => setNewInsight(e.target.value)}
          placeholder="Запиши идею, наблюдение или мысль — исследуем её вместе с ИИ через диалог..."
          className="w-full min-h-[70px] bg-[var(--panel-2)] border border-[var(--line)] rounded-lg p-3 text-sm text-[var(--text)] resize-y focus:outline-none focus:border-[var(--accent)] transition-colors"
        />
        <button
          onClick={handleSubmit}
          disabled={!newInsight.trim()}
          className="w-full mt-3 bg-[var(--accent)] text-white rounded-lg py-2.5 font-semibold text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          🔬 Начать исследование
        </button>
        <p className="text-xs text-[var(--text-dim)] mt-2">
          Вместо жёсткой оценки — мягкий диалог. ИИ задаст вопросы, приведёт примеры и поможет уточнить идею.
        </p>
      </div>

      {/* Active chat */}
      {openInsight && (
        <InsightChat
          insight={openInsight}
          state={state}
          setState={setState}
          onClose={() => setOpenInsightId(null)}
        />
      )}

      {/* Investigating */}
      {investigating.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 text-[var(--text-dim)]">
            🔬 В исследовании ({investigating.length})
          </h3>
          <div className="space-y-2">
            {investigating.map(insight => (
              <div
                key={insight.id}
                onClick={() => setOpenInsightId(insight.id)}
                className="glass-panel p-3 cursor-pointer hover:border-[var(--accent)] transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="text-sm">{insight.text}</div>
                  <StatusBadge status={insight.status} />
                </div>
                <div className="text-xs text-[var(--text-dim)] mt-1">
                  💬 {insight.messages.length} сообщений
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 text-[var(--text-dim)]">
            ⏳ Ожидают ({pending.length})
          </h3>
          <div className="space-y-2">
            {pending.map(insight => (
              <div
                key={insight.id}
                onClick={() => setOpenInsightId(insight.id)}
                className="glass-panel p-3 cursor-pointer hover:border-[var(--accent)] transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="text-sm">{insight.text}</div>
                  <StatusBadge status={insight.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Finished */}
      {finished.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 text-[var(--text-dim)]">
            Завершённые ({finished.length})
          </h3>
          <div className="space-y-2">
            {finished.map(insight => (
              <div
                key={insight.id}
                onClick={() => setOpenInsightId(insight.id)}
                className="glass-panel p-3 cursor-pointer hover:border-[var(--accent)] transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm">{insight.text}</div>
                  <StatusBadge status={insight.status} />
                </div>
                {insight.final_insight && (
                  <div className="text-xs italic text-[var(--text-dim)] mt-1">
                    → «{insight.final_insight}»
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {state.insights.length === 0 && (
        <div className="glass-panel p-6 text-center">
          <div className="text-4xl mb-3">🔬</div>
          <p className="text-sm text-[var(--text-dim)]">
            Лаборатория пуста. Запиши идею и исследуй её через диалог с ИИ.
          </p>
          <p className="text-xs text-[var(--text-dim)] mt-2">
            Это не тест — это совместное исследование. ИИ не скажет "ты неправ", а поможет уточнить мысль.
          </p>
        </div>
      )}
    </div>
  );
}
