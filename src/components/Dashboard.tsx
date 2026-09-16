import React from 'react';
import { AppState, deriveLevel, getCategoryTotalXp, getOverallLevel, calculateStreak, getHeatmapData, getTotalXp } from '../store';
import Biometrics from './Biometrics';
import InterventionProtocol from './InterventionProtocol';

interface Props {
  state: AppState;
  setState: (fn: (prev: AppState) => AppState) => void;
}

function ProgressRing({ percent, size = 60, strokeWidth = 5, color = '#6c7bff' }: { percent: number; size?: number; strokeWidth?: number; color?: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg width={size} height={size} className="progress-ring">
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        stroke="var(--line)" strokeWidth={strokeWidth} fill="none"
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        stroke={color} strokeWidth={strokeWidth} fill="none"
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" className="progress-ring-circle"
      />
    </svg>
  );
}

function HeatMap({ data }: { data: { date: string; count: number; xp: number }[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  
  return (
    <div className="flex flex-wrap gap-[3px]">
      {data.map((d, i) => {
        const intensity = d.count === 0 ? 0 : Math.min(1, d.count / maxCount);
        const bg = d.count === 0 
          ? 'var(--panel-2)' 
          : `rgba(108, 123, 255, ${0.2 + intensity * 0.8})`;
        
        return (
          <div
            key={i}
            className="heat-cell w-[10px] h-[10px] rounded-[2px] cursor-pointer"
            style={{ background: bg }}
            title={`${d.date}: ${d.count} записей, +${d.xp} XP`}
          />
        );
      })}
    </div>
  );
}

export default function Dashboard({ state, setState }: Props) {
  const overall = getOverallLevel(state);
  const streak = calculateStreak(state.history);
  const heatmapData = getHeatmapData(state.history);
  const totalXp = getTotalXp(state);
  const todayEntries = state.history.filter(h => h.timestamp.slice(0, 10) === new Date().toISOString().slice(0, 10));
  const todayXp = todayEntries.reduce((s, h) => s + h.final_xp, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Overall Stats */}
      <div className="glass-panel p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Общий прогресс</h2>
            <p className="text-sm text-[var(--text-dim)]">Уровень {overall.level} · {totalXp} XP всего</p>
          </div>
          <div className="relative">
            <ProgressRing
              percent={(overall.current_xp / overall.xp_to_next_level) * 100}
              size={70}
              strokeWidth={6}
            />
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
              {overall.level}
            </span>
          </div>
        </div>
        <div className="h-2 bg-[var(--panel-2)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
            style={{ width: `${(overall.current_xp / overall.xp_to_next_level) * 100}%` }}
          />
        </div>
        <p className="text-xs text-[var(--text-dim)] mt-1">
          {overall.current_xp} / {overall.xp_to_next_level} XP до уровня {overall.level + 1}
        </p>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="glass-panel p-4 text-center">
          <div className={`text-2xl font-bold ${streak > 0 ? 'streak-fire' : ''}`}>
            {streak > 0 ? '🔥' : '💤'} {streak}
          </div>
          <div className="text-xs text-[var(--text-dim)] mt-1">дней подряд</div>
        </div>
        <div className="glass-panel p-4 text-center">
          <div className="text-2xl font-bold text-[var(--good)]">+{todayXp}</div>
          <div className="text-xs text-[var(--text-dim)] mt-1">XP сегодня</div>
        </div>
        <div className="glass-panel p-4 text-center">
          <div className="text-2xl font-bold">{todayEntries.length}</div>
          <div className="text-xs text-[var(--text-dim)] mt-1">записей сегодня</div>
        </div>
        <div className="glass-panel p-4 text-center">
          <div className="text-2xl font-bold text-[var(--warn)]">🪙 {state.gold || 0}</div>
          <div className="text-xs text-[var(--text-dim)] mt-1">золото</div>
        </div>
      </div>

      {/* Биометрика ЦНС */}
      <Biometrics state={state} setState={setState} />

      {/* Протокол вмешательства */}
      <InterventionProtocol state={state} setState={setState} />

      {/* Heat Map */}
      <div className="glass-panel p-4">
        <h3 className="text-sm font-semibold mb-3">Активность (90 дней)</h3>
        <HeatMap data={heatmapData} />
        <div className="flex items-center gap-2 mt-3 text-xs text-[var(--text-dim)]">
          <span>Меньше</span>
          <div className="flex gap-[2px]">
            {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
              <div key={i} className="w-[10px] h-[10px] rounded-[2px]"
                style={{ background: v === 0 ? 'var(--panel-2)' : `rgba(108,123,255,${0.2 + v * 0.8})` }} />
            ))}
          </div>
          <span>Больше</span>
        </div>
      </div>

      {/* Categories */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-[var(--text-dim)]">Категории персонажа</h3>
        <div className="space-y-3">
          {state.categories.map(cat => {
            const totalXp = getCategoryTotalXp(state, cat.id);
            const { level, current_xp, xp_to_next_level } = deriveLevel(totalXp);
            const pct = Math.min(100, (current_xp / xp_to_next_level) * 100);

            return (
              <div key={cat.id} className="glass-panel p-4 flex items-center gap-4">
                <div className="relative">
                  <ProgressRing percent={pct} size={48} strokeWidth={4} color={cat.color} />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                    {level}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <span className="font-semibold text-sm">{cat.name}</span>
                    <span className="text-xs text-[var(--text-dim)]">вес {cat.weight}</span>
                  </div>
                  <div className="h-1.5 bg-[var(--panel-2)] rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: cat.color }}
                    />
                  </div>
                  <div className="text-xs text-[var(--text-dim)] mt-1">
                    {current_xp}/{xp_to_next_level} XP · {totalXp} всего
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Artifacts */}
      {state.artifacts.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 text-[var(--text-dim)]">🏺 Артефакты ({state.artifacts.length})</h3>
          <div className="grid grid-cols-1 gap-2">
            {state.artifacts.slice(0, 5).map(a => (
              <div key={a.id} className="glass-panel p-3 border-l-3" style={{ borderLeftColor: 'var(--good)' }}>
                <div className="font-semibold text-sm">🏺 {a.name}</div>
                <div className="text-xs text-[var(--text-dim)] mt-1">{a.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mobile: Active Goals Preview (only on mobile/tablet) */}
      <div className="mobile-goals-preview lg:hidden">
        {state.goals.filter(g => g.status === 'active').length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3 text-[var(--text-dim)]">🎯 Активные цели</h3>
            <div className="space-y-2">
              {state.goals.filter(g => g.status === 'active').slice(0, 3).map(goal => {
                const cat = state.categories.find(c => c.id === goal.category_id);
                const doneCount = goal.steps.filter(s => s.status === 'done').length;
                const progress = goal.steps.length > 0 ? (doneCount / goal.steps.length) * 100 : 0;
                return (
                  <div key={goal.id} className="glass-panel p-3 border-l-3" style={{ borderLeftColor: cat?.color || 'var(--accent)' }}>
                    <div className="text-sm font-semibold">{goal.title}</div>
                    <div className="text-xs text-[var(--text-dim)] mt-1">{doneCount}/{goal.steps.length} шагов</div>
                    <div className="h-1 bg-[var(--panel-2)] rounded-full mt-2 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${progress}%`, background: cat?.color || 'var(--accent)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
