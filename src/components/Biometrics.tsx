import React from 'react';
import { AppState, applyDailyReset, updateBaselineShift } from '../store';

interface Props {
  state: AppState;
  setState: (fn: (prev: AppState) => AppState) => void;
}

export default function Biometrics({ state, setState }: Props) {
  // Применяем ночной гомеостаз при монтировании
  React.useEffect(() => {
    const updatedState = applyDailyReset(state);
    const finalState = updateBaselineShift(updatedState);
    if (finalState !== state) {
      setState(() => finalState);
    }
  }, []);

  const capacityPercent = (state.nervousSystemCapacity / 100) * 100;
  const loadPercent = state.currentSomaticLoad;
  
  const shiftLabels = {
    optimal: { label: 'Оптимальное состояние', color: 'var(--good)', icon: '✅' },
    hyperaroused: { label: 'Перегрузка ЦНС', color: 'var(--danger)', icon: '⚠️' },
    hypoaroused: { label: 'Недостаточная активация', color: 'var(--warn)', icon: '💤' },
  };
  
  const shift = shiftLabels[state.baselineShift];

  return (
    <div className="glass-panel p-4">
      <h3 className="text-sm font-semibold mb-3">🧠 Биометрика ЦНС</h3>
      
      {/* Емкость Буфера ЦНС */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-[var(--text-dim)]">Емкость Буфера ЦНС</span>
          <span className="text-xs font-bold" style={{ color: 'var(--accent)' }}>
            {state.nervousSystemCapacity}/100
          </span>
        </div>
        <div className="h-2 bg-[var(--panel-2)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${capacityPercent}%`,
              background: 'var(--accent)',
            }}
          />
        </div>
        <p className="text-xs text-[var(--text-dim)] mt-1">
          Растёт с опытом, минимум 50
        </p>
      </div>

      {/* Текущий Соматический Груз */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-[var(--text-dim)]">Соматический Груз</span>
          <span className="text-xs font-bold" style={{ color: loadPercent > 85 ? 'var(--danger)' : loadPercent > 70 ? 'var(--warn)' : 'var(--good)' }}>
            {Math.round(loadPercent)}%
          </span>
        </div>
        <div className="h-2 bg-[var(--panel-2)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${loadPercent}%`,
              background: loadPercent > 85 ? 'var(--danger)' : loadPercent > 70 ? 'var(--warn)' : 'var(--good)',
            }}
          />
        </div>
        <p className="text-xs text-[var(--text-dim)] mt-1">
          {loadPercent > 85 
            ? '⚠️ Критическая нагрузка! Риск выгорания'
            : loadPercent > 70 
            ? 'Высокая нагрузка, нужен отдых'
            : loadPercent > 30
            ? 'Умеренная нагрузка'
            : 'Низкая нагрузка, можно брать больше'}
        </p>
      </div>

      {/* Сдвиг базовой линии */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{shift.icon}</span>
          <span className="text-sm font-semibold" style={{ color: shift.color }}>
            {shift.label}
          </span>
        </div>
        <p className="text-xs text-[var(--text-dim)]">
          {state.baselineShift === 'optimal' && 'Баланс между нагрузкой и восстановлением'}
          {state.baselineShift === 'hyperaroused' && 'Слишком много стимуляции, нужен отдых'}
          {state.baselineShift === 'hypoaroused' && 'Недостаточно активации, нужна стимуляция'}
        </p>
      </div>

      {/* Флаг риска выгорания */}
      {state.isBurnoutRisk && (
        <div className="p-3 bg-[var(--danger)] bg-opacity-10 border border-[var(--danger)] rounded-lg">
          <div className="text-sm font-semibold text-[var(--danger)] mb-1">
            🚨 Риск выгорания
          </div>
          <p className="text-xs text-[var(--text-dim)]">
            Соматический груз превышает 85%. Рекомендуется снизить нагрузку и уделить внимание восстановлению.
          </p>
        </div>
      )}

      {/* Информация о последнем сбросе */}
      <div className="mt-3 pt-3 border-t border-[var(--line)]">
        <p className="text-xs text-[var(--text-dim)]">
          Последний ночной гомеостаз: {new Date(state.lastDailyReset).toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}
