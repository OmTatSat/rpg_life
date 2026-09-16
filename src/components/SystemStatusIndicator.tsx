import React from 'react';
import { AppState } from '../store';

interface Props {
  state: AppState;
  onOpenIntervention: () => void;
}

export default function SystemStatusIndicator({ state, onOpenIntervention }: Props) {
  const load = state.currentSomaticLoad;
  const capacity = state.nervousSystemCapacity;
  
  // Определяем зону
  let zone: 'green' | 'yellow' | 'red';
  let statusText: string;
  let statusColor: string;
  let borderColor: string;
  
  if (load < 40) {
    zone = 'green';
    statusText = 'Окно толерантности открыто';
    statusColor = 'var(--good)';
    borderColor = 'var(--good)';
  } else if (load < 80) {
    zone = 'yellow';
    statusText = 'Накопление напряжения';
    statusColor = 'var(--warn)';
    borderColor = 'var(--warn)';
  } else {
    zone = 'red';
    statusText = 'Критический груз. Запустите Протокол разгрузки';
    statusColor = 'var(--danger)';
    borderColor = 'var(--danger)';
  }
  
  const loadPercent = Math.min(100, load);
  
  return (
    <div className="glass-panel p-4 border-l-4" style={{ borderLeftColor: borderColor }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span>🧬</span>
          <span>Состояние системы</span>
        </h3>
        <div className="text-xs font-bold" style={{ color: statusColor }}>
          {Math.round(load)}%
        </div>
      </div>
      
      {/* Прогресс-бар */}
      <div className="mb-3">
        <div className="h-3 bg-[var(--panel-2)] rounded-full overflow-hidden relative">
          {/* Зоны */}
          <div className="absolute inset-0 flex">
            <div className="h-full bg-[var(--good)] opacity-20" style={{ width: '40%' }} />
            <div className="h-full bg-[var(--warn)] opacity-20" style={{ width: '40%' }} />
            <div className="h-full bg-[var(--danger)] opacity-20" style={{ width: '20%' }} />
          </div>
          {/* Индикатор */}
          <div
            className="h-full rounded-full transition-all duration-500 relative z-10"
            style={{
              width: `${loadPercent}%`,
              background: statusColor,
            }}
          />
        </div>
      </div>
      
      {/* Статус */}
      <div className="mb-3">
        <div className="text-sm font-semibold" style={{ color: statusColor }}>
          {statusText}
        </div>
      </div>
      
      {/* Ёмкость ЦНС */}
      <div className="text-xs text-[var(--text-dim)] mb-3">
        <div className="flex justify-between mb-1">
          <span>Ёмкость ЦНС</span>
          <span className="font-bold" style={{ color: 'var(--accent)' }}>{capacity}/100</span>
        </div>
        <div className="h-1.5 bg-[var(--panel-2)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${capacity}%`,
              background: 'var(--accent)',
            }}
          />
        </div>
      </div>
      
      {/* Кнопка протокола для красной зоны */}
      {zone === 'red' && (
        <button
          onClick={onOpenIntervention}
          className="w-full bg-[var(--danger)] text-white rounded-lg py-2 font-semibold text-sm hover:opacity-90 transition-opacity animate-pulse"
        >
          🧘 Запустить Протокол разгрузки
        </button>
      )}
      
      {/* Подсказка для жёлтой зоны */}
      {zone === 'yellow' && (
        <div className="text-xs text-[var(--text-dim)] italic">
          Рекомендуется снизить нагрузку или выполнить протокол восстановления
        </div>
      )}
      
      {/* Позитивное сообщение для зелёной зоны */}
      {zone === 'green' && (
        <div className="text-xs text-[var(--good)]">
          ✅ Система в оптимальном состоянии
        </div>
      )}
    </div>
  );
}
