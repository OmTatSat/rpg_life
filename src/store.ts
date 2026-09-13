// Types
export interface Category {
  id: string;
  name: string;
  weight: number;
  color: string;
}

export interface HistoryEntry {
  id: string;
  text: string;
  full_text: string;
  category_id: string;
  final_xp: number;
  quest_type: 'repeating' | 'medium' | 'vision';
  timestamp: string;
}

export interface GoalStep {
  id: string;
  text: string;
  contribution_factor: number;
  status: 'pending' | 'done';
}

export interface RecurringGoal {
  id: string;
  category_id: string;
  title: string;
  target_value: number;
  unit: string;
  unit_value: number; // сколько единиц за одно выполнение
  period: 'daily' | 'weekly' | 'monthly';
  current_value: number;
  period_start: string;
  created_at: string;
}

export interface Goal {
  id: string;
  category_id: string;
  title: string;
  vision_text: string;
  status: 'planning' | 'active' | 'done';
  plan_options?: PlanOption[];
  steps: GoalStep[];
}

export interface PlanOption {
  label: string;
  rationale: string;
  steps: { text: string; contribution_factor: number }[];
}

export interface Seed {
  id: string;
  text: string;
  category_id: string | null;
  source: 'auto' | 'manual';
  status: 'open' | 'questing' | 'experimenting' | 'resolved';
  quest_options: QuestOption[];
  chosen_approach: QuestOption | null;
  experiment_result: string | null;
  verdict: 'artifact' | 'refine' | null;
  feedback: string | null;
  artifact_id: string | null;
  created_at: string;
}

export interface QuestOption {
  label: string;
  description: string;
  hypothesis: string;
}

export interface Artifact {
  id: string;
  name: string;
  description: string;
  category_id: string | null;
  source_seed_id: string;
  created_at: string;
}

export interface InsightMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface Insight {
  id: string;
  text: string;
  status: 'pending' | 'investigating' | 'refined' | 'bounded' | 'retired';
  messages: InsightMessage[];
  final_insight: string | null;
  sources: string[];
  artifact_id: string | null;
  created_at: string;
}

export interface SupplementEntry {
  id: string;
  name: string;
  dose_amount: number | null;
  dose_unit: string | null;
  context: string | null;
  timestamp: string;
}

export interface DailyQuest {
  id: string;
  text: string;
  category_id: string;
  done: boolean;
  date: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked_at: string | null;
  condition: (state: AppState) => boolean;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  tier: 'cheap' | 'expensive';
  purchased_count: number;
}

export interface AppState {
  categories: Category[];
  history: HistoryEntry[];
  goals: Goal[];
  recurring_goals: RecurringGoal[];
  supplements_log: SupplementEntry[];
  seeds: Seed[];
  artifacts: Artifact[];
  insights: Insight[];
  daily_quests: DailyQuest[];
  gold: number;
  shop_items: ShopItem[];
  apiKey: string;
  modelName: string;
  gh_token: string;
  gh_repo: string;
  gh_file_path: string;
  gh_auto_sync: boolean;
}

// Default state
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'health', name: 'Здоровье', weight: 20, color: '#45b26b' },
  { id: 'learning', name: 'Обучение', weight: 15, color: '#6c7bff' },
  { id: 'sport', name: 'Спорт', weight: 10, color: '#e0574f' },
  { id: 'relationships', name: 'Отношения', weight: 8, color: '#e0a13c' },
  { id: 'programming', name: 'Программирование', weight: 5, color: '#a06fd6' },
];

export function createDefaultState(): AppState {
  return {
    categories: DEFAULT_CATEGORIES,
    history: [],
    goals: [],
    recurring_goals: [],
    supplements_log: [],
    seeds: [],
    artifacts: [],
    insights: [],
    daily_quests: [],
    gold: 0,
    shop_items: [
      { id: 'cheap_1', name: 'Чашка кофе', description: 'Маленькое удовольствие', cost: 10, tier: 'cheap', purchased_count: 0 },
      { id: 'cheap_2', name: 'Эпизод сериала', description: '30 минут отдыха', cost: 15, tier: 'cheap', purchased_count: 0 },
      { id: 'cheap_3', name: 'Вкусняшка', description: 'Что-то вкусное', cost: 20, tier: 'cheap', purchased_count: 0 },
      { id: 'expensive_1', name: 'День без дел', description: 'Целый день на себя', cost: 100, tier: 'expensive', purchased_count: 0 },
      { id: 'expensive_2', name: 'Покупка до 500 грн', description: 'Маленькая хотелка', cost: 150, tier: 'expensive', purchased_count: 0 },
      { id: 'expensive_3', name: 'Выходной', description: 'Полный выходной без обязательств', cost: 200, tier: 'expensive', purchased_count: 0 },
    ],
    apiKey: '',
    modelName: 'gemini-flash-lite-latest',
    gh_token: '',
    gh_repo: '',
    gh_file_path: 'data/life-rpg-v2.json',
    gh_auto_sync: true,
  };
}

// Utility functions
export function genId(): string {
  return 'x_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

export function deriveLevel(totalXp: number): { level: number; current_xp: number; xp_to_next_level: number } {
  let level = 1;
  let threshold = 100;
  let remaining = totalXp;
  while (remaining >= threshold) {
    remaining -= threshold;
    level += 1;
    threshold = Math.round(threshold * 1.15);
  }
  return { level, current_xp: remaining, xp_to_next_level: threshold };
}

export function getCategoryTotalXp(state: AppState, catId: string): number {
  return state.history.filter(h => h.category_id === catId).reduce((s, h) => s + (h.final_xp || 0), 0);
}

export function getTotalXp(state: AppState): number {
  return state.history.reduce((s, h) => s + (h.final_xp || 0), 0);
}

// Gold calculation: 1 gold per 5 XP earned, with speed bonus
export function calculateGoldFromXp(baseXp: number, speedBonus: number = 1): number {
  return Math.round((baseXp / 5) * speedBonus);
}

// Speed bonus: if action logged within 1 hour of creation, 1.5x multiplier
export function getSpeedBonus(createdAt: string, loggedAt: string): number {
  const created = new Date(createdAt).getTime();
  const logged = new Date(loggedAt).getTime();
  const hoursDiff = (logged - created) / (1000 * 60 * 60);
  if (hoursDiff <= 1) return 1.5; // Within 1 hour
  if (hoursDiff <= 6) return 1.2; // Within 6 hours
  return 1; // No bonus
}

export function getOverallLevel(state: AppState): { level: number; current_xp: number; xp_to_next_level: number } {
  return deriveLevel(getTotalXp(state));
}

// Streak calculation
export function calculateStreak(history: HistoryEntry[]): number {
  if (history.length === 0) return 0;
  
  const days = new Set<string>();
  history.forEach(h => {
    const d = new Date(h.timestamp);
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  });

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const key = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
    if (days.has(key)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

// Heat map data
export function getHeatmapData(history: HistoryEntry[], days: number = 90): { date: string; count: number; xp: number }[] {
  const result: { date: string; count: number; xp: number }[] = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const entries = history.filter(h => h.timestamp.slice(0, 10) === dateStr);
    result.push({
      date: dateStr,
      count: entries.length,
      xp: entries.reduce((s, h) => s + (h.final_xp || 0), 0),
    });
  }
  return result;
}

// Quick templates from history
export function getQuickTemplates(state: AppState, catId: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (let i = state.history.length - 1; i >= 0; i--) {
    const h = state.history[i];
    if (h.category_id === catId) {
      const t = h.full_text || h.text;
      if (!seen.has(t)) {
        seen.add(t);
        result.push(t);
        if (result.length >= 5) break;
      }
    }
  }
  return result;
}

// Recurring goals helpers
export function getPeriodStart(period: 'daily' | 'weekly' | 'monthly', now: Date = new Date()): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  
  if (period === 'daily') {
    return start;
  } else if (period === 'weekly') {
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1; // Monday as first day
    start.setDate(start.getDate() - diff);
    return start;
  } else { // monthly
    start.setDate(1);
    return start;
  }
}

export function checkPeriodReset(goal: RecurringGoal): RecurringGoal {
  const now = new Date();
  const periodStart = getPeriodStart(goal.period, now);
  const goalPeriodStart = new Date(goal.period_start);
  
  if (periodStart > goalPeriodStart) {
    return { ...goal, current_value: 0, period_start: periodStart.toISOString() };
  }
  return goal;
}

export function extractDurationFromText(text: string): number | null {
  // Match patterns like "40 минут", "1.5 часа", "90 мин"
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(?:минут|мин|minutes?|min)/i,
    /(\d+(?:\.\d+)?)\s*(?:час(?:а|ов)?|hours?|hrs?)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseFloat(match[1]);
      if (pattern.toString().includes('час')) {
        return value * 60; // Convert hours to minutes
      }
      return value;
    }
  }
  return null;
}

export function calculateRecurringProgress(
  state: AppState,
  goal: RecurringGoal
): number {
  const periodStart = new Date(goal.period_start);
  let total = 0;
  
  for (const entry of state.history) {
    const entryDate = new Date(entry.timestamp);
    if (entryDate < periodStart) continue;
    if (entry.category_id !== goal.category_id) continue;
    
    // Try to extract duration from text
    const duration = extractDurationFromText(entry.text);
    if (duration !== null) {
      total += duration;
    }
  }
  
  return total;
}

// Achievements definitions
export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_step',
    name: 'Первый шаг',
    description: 'Записать первое действие',
    icon: '🎯',
    unlocked_at: null,
    condition: (s) => s.history.length >= 1,
  },
  {
    id: 'ten_entries',
    name: 'Набираем обороты',
    description: '10 записей в истории',
    icon: '📝',
    unlocked_at: null,
    condition: (s) => s.history.length >= 10,
  },
  {
    id: 'fifty_entries',
    name: 'Полтинник',
    description: '50 записей в истории',
    icon: '🏅',
    unlocked_at: null,
    condition: (s) => s.history.length >= 50,
  },
  {
    id: 'streak_3',
    name: 'Три дня кряду',
    description: 'Серия из 3 дней подряд',
    icon: '🔥',
    unlocked_at: null,
    condition: (s) => calculateStreak(s.history) >= 3,
  },
  {
    id: 'streak_7',
    name: 'Неделя силы',
    description: 'Серия из 7 дней подряд',
    icon: '⚡',
    unlocked_at: null,
    condition: (s) => calculateStreak(s.history) >= 7,
  },
  {
    id: 'streak_30',
    name: 'Месяц дисциплины',
    description: 'Серия из 30 дней подряд',
    icon: '👑',
    unlocked_at: null,
    condition: (s) => calculateStreak(s.history) >= 30,
  },
  {
    id: 'diverse',
    name: 'Разносторонний',
    description: 'Записи во всех категориях',
    icon: '🌈',
    unlocked_at: null,
    condition: (s) => {
      const cats = new Set(s.history.map(h => h.category_id));
      return cats.size >= s.categories.length;
    },
  },
  {
    id: 'first_goal',
    name: 'Целеполагатель',
    description: 'Создать первую цель',
    icon: '🎪',
    unlocked_at: null,
    condition: (s) => s.goals.length >= 1,
  },
  {
    id: 'goal_complete',
    name: 'Достигатор',
    description: 'Завершить первую цель',
    icon: '🏆',
    unlocked_at: null,
    condition: (s) => s.goals.some(g => g.status === 'done'),
  },
  {
    id: 'first_artifact',
    name: 'Собиратель',
    description: 'Получить первый артефакт',
    icon: '🏺',
    unlocked_at: null,
    condition: (s) => s.artifacts.length >= 1,
  },
  {
    id: 'level_5',
    name: 'Пятый уровень',
    description: 'Достичь 5 уровня в любой категории',
    icon: '⭐',
    unlocked_at: null,
    condition: (s) => s.categories.some(c => deriveLevel(getCategoryTotalXp(s, c.id)).level >= 5),
  },
  {
    id: 'hundred_xp',
    name: 'Сотня XP',
    description: 'Накопить 100 XP суммарно',
    icon: '💎',
    unlocked_at: null,
    condition: (s) => getTotalXp(s) >= 100,
  },
];

// LocalStorage
const LS_KEY = 'liferpg_state_v2';

export function saveState(state: AppState): void {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

export function loadState(): AppState {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const defaultState = createDefaultState();
      return {
        ...defaultState,
        ...parsed,
        categories: parsed.categories || DEFAULT_CATEGORIES,
        history: parsed.history || [],
        goals: parsed.goals || [],
        recurring_goals: (parsed.recurring_goals || []).map((g: any) => ({
          ...g,
          unit_value: g.unit_value || 1,
        })),
        supplements_log: parsed.supplements_log || [],
        seeds: parsed.seeds || [],
        artifacts: parsed.artifacts || [],
        insights: parsed.insights || [],
        daily_quests: parsed.daily_quests || [],
        gold: parsed.gold || 0,
        shop_items: parsed.shop_items || defaultState.shop_items,
        apiKey: parsed.apiKey || '',
        modelName: parsed.modelName || 'gemini-flash-lite-latest',
        gh_token: parsed.gh_token || '',
        gh_repo: parsed.gh_repo || '',
        gh_file_path: parsed.gh_file_path || 'data/life-rpg-v2.json',
        gh_auto_sync: parsed.gh_auto_sync !== false, // default true
      };
    }
  } catch (e) {
    console.error('Failed to load state:', e);
  }
  return createDefaultState();
}
