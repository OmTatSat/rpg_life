import React, { useState } from 'react';
import { AppState, Insight, Artifact, genId } from '../store';
import { callInsightValidation } from '../api';

interface Props {
  state: AppState;
  setState: (fn: (prev: AppState) => AppState) => void;
}

export default function Insights({ state, setState }: Props) {
  const [newInsight, setNewInsight] = useState('');
  const [validating, setValidating] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!newInsight.trim()) return;

    const insightId = genId();
    const insight: Insight = {
      id: insightId,
      text: newInsight.trim(),
      status: 'pending',
      validation_result: null,
      sources: [],
      artifact_id: null,
      created_at: new Date().toISOString(),
    };

    setState(prev => ({
      ...prev,
      insights: [...prev.insights, insight],
    }));

    setNewInsight('');
    setValidating(insightId);

    try {
      const result = await callInsightValidation(state, insight.text);

      setState(prev => {
        const updatedInsights = prev.insights.map(i => {
          if (i.id !== insightId) return i;

          if (result.validated && result.refined_insight) {
            // Create artifact
            const artifact: Artifact = {
              id: genId(),
              name: result.refined_insight.slice(0, 50),
              description: result.refined_insight,
              category_id: null,
              source_seed_id: insightId,
              created_at: new Date().toISOString(),
            };

            return {
              ...i,
              status: 'validated' as const,
              validation_result: result.validation_result,
              sources: result.sources || [],
              artifact_id: artifact.id,
            };
          } else {
            return {
              ...i,
              status: 'rejected' as const,
              validation_result: result.validation_result,
              sources: result.sources || [],
            };
          }
        });

        // If validated, add artifact
        if (result.validated && result.refined_insight) {
          const artifact: Artifact = {
            id: genId(),
            name: result.refined_insight.slice(0, 50),
            description: result.refined_insight,
            category_id: null,
            source_seed_id: insightId,
            created_at: new Date().toISOString(),
          };

          return {
            ...prev,
            insights: updatedInsights,
            artifacts: [...prev.artifacts, artifact],
          };
        }

        return {
          ...prev,
          insights: updatedInsights,
        };
      });
    } catch (error) {
      console.error('Validation failed:', error);
      setState(prev => ({
        ...prev,
        insights: prev.insights.map(i =>
          i.id === insightId
            ? { ...i, status: 'rejected', validation_result: 'Ошибка валидации' }
            : i
        ),
      }));
    } finally {
      setValidating(null);
    }
  };

  const validatedInsights = state.insights.filter(i => i.status === 'validated');
  const rejectedInsights = state.insights.filter(i => i.status === 'rejected');
  const pendingInsights = state.insights.filter(i => i.status === 'pending');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Input */}
      <div className="glass-panel p-4">
        <h3 className="text-sm font-semibold mb-3">💡 Новый инсайт</h3>
        <textarea
          value={newInsight}
          onChange={e => setNewInsight(e.target.value)}
          placeholder="Запиши идею, наблюдение или мысль, которую хочешь проверить на научной обоснованности..."
          className="w-full min-h-[80px] bg-[var(--panel-2)] border border-[var(--line)] rounded-lg p-3 text-sm text-[var(--text)] resize-y focus:outline-none focus:border-[var(--accent)] transition-colors"
        />
        <button
          onClick={handleSubmit}
          disabled={!newInsight.trim() || !!validating}
          className="w-full mt-3 bg-[var(--accent)] text-white rounded-lg py-2.5 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          {validating ? '🔍 Валидирую...' : '✨ Валидировать инсайт'}
        </button>
        <p className="text-xs text-[var(--text-dim)] mt-2">
          ИИ проверит идею на основе научных исследований и философии. Если обоснована — станет артефактом-мотиватором.
        </p>
      </div>

      {/* Validated Insights */}
      {validatedInsights.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 text-[var(--text-dim)]">
            ✅ Валидированные инсайты ({validatedInsights.length})
          </h3>
          <div className="space-y-3">
            {validatedInsights.map(insight => {
              const artifact = state.artifacts.find(a => a.id === insight.artifact_id);
              return (
                <div key={insight.id} className="glass-panel p-4 border-l-3" style={{ borderLeftColor: 'var(--good)' }}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{insight.text}</div>
                      {artifact && (
                        <div className="mt-2 p-3 bg-[var(--panel-2)] rounded-lg">
                          <div className="text-xs text-[var(--text-dim)] mb-1">🏺 Артефакт-мотиватор:</div>
                          <div className="text-sm italic">«{artifact.description}»</div>
                        </div>
                      )}
                      {insight.validation_result && (
                        <div className="mt-2 text-xs text-[var(--text-dim)]">
                          <strong>Обоснование:</strong> {insight.validation_result}
                        </div>
                      )}
                      {insight.sources.length > 0 && (
                        <div className="mt-2 text-xs text-[var(--text-dim)]">
                          <strong>Источники:</strong> {insight.sources.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending Insights */}
      {pendingInsights.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 text-[var(--text-dim)]">
            ⏳ На валидации ({pendingInsights.length})
          </h3>
          <div className="space-y-2">
            {pendingInsights.map(insight => (
              <div key={insight.id} className="glass-panel p-3 opacity-60">
                <div className="text-sm">{insight.text}</div>
                {validating === insight.id && (
                  <div className="text-xs text-[var(--accent)] mt-2">🔍 Проверяю...</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rejected Insights */}
      {rejectedInsights.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 text-[var(--text-dim)]">
            ❌ Не валидированы ({rejectedInsights.length})
          </h3>
          <div className="space-y-2">
            {rejectedInsights.map(insight => (
              <div key={insight.id} className="glass-panel p-3 border-l-3" style={{ borderLeftColor: 'var(--danger)' }}>
                <div className="text-sm">{insight.text}</div>
                {insight.validation_result && (
                  <div className="text-xs text-[var(--text-dim)] mt-2">
                    {insight.validation_result}
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
          <div className="text-4xl mb-3">💡</div>
          <p className="text-sm text-[var(--text-dim)]">
            Пока нет инсайтов. Запиши идею, которую хочешь проверить на научной обоснованности.
          </p>
        </div>
      )}
    </div>
  );
}
