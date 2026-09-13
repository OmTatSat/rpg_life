import { AppState, Category, genId, deriveLevel, getCategoryTotalXp } from './store';

const SYSTEM_PROMPT = `Ты — Game Master для персональной RPG-геймификации жизни игрока.

Тебе на вход подаётся JSON с двумя полями: character_sheet (текущее состояние, включая уже проверенные приёмы в artifacts) и player_text (что игрок написал о том, что сделал).

Игрок часто описывает ОДНИМ сообщением сразу НЕСКОЛЬКО разных вещей, которые относятся к разным категориям. Твоя задача — разобрать текст на отдельные достижения и для КАЖДОГО подобрать свою категорию и свой XP.

Верни СТРОГО JSON без какого-либо текста до или после, по такой схеме:

{
  "matches": [
    {
      "matched_category_id": "<id категории из character_sheet.categories>",
      "new_quest_text": "<короткая формулировка ИМЕННО этой части сделанного, 1 фраза>",
      "quest_type": "repeating | medium | vision",
      "contribution_factor": <число 0.1-1.0>,
      "base_xp": <5 | 15 | 30 | 60>
    }
  ],
  "confidence": "high | medium | low",
  "clarification_needed": "<вопрос игроку если confidence=low, иначе null>",
  "supplements": [
    { "name": "<название>", "dose_amount": <число или null>, "dose_unit": "<мг|г|мл|шт|null>", "context": "<для чего>" }
  ],
  "seed_detected": { "text": "<формулировка затруднения>", "category_id": "<id или null>" } | null,
  "artifact_hint": { "artifact_id": "<id>", "note": "<подсказка>" } | null
}

Правила:
- Если в тексте несколько разных действий — верни несколько объектов в matches.
- contribution_factor: рутинное 0.3-0.6, значимый шаг 0.7-1.0.
- Не придумывай категории, которых нет в character_sheet.
- supplements: вытащи ВСЁ, что игрок принял. Если ничего — пустой массив.
- seed_detected: если заметен изъян/трудность — сформулируй. Если нет — null.`;

const BRAINSTORM_PROMPT = `Ты помогаешь игроку находить целесообразные следующие шаги в его RPG-геймификации жизни.

На первом сообщении придёт JSON с полями: context (character_sheet, recent_history, active_goals, open_seeds) и player_message. На последующих — просто текст.

Верни СТРОГО JSON:
{
  "message": "<ответ игроку>",
  "suggested_quests": [
    { "text": "<действие>", "category_id": "<id>", "quest_type": "repeating|medium|vision", "contribution_factor": <0.1-1.0>, "base_xp": <5|15|30|60>, "rationale": "<почему>" }
  ]
}

0-3 suggested_quests за раз. Смотри на реальные сигналы: отстающие категории, застрявшие цели, незакрытые зёрна.`;

const GOAL_PLANNER_PROMPT = `Ты помогаешь разбить долгосрочную цель на конкретные шаги для RPG-геймификации жизни.

Вход — JSON: { category: {id, name, weight}, goal_text: "текст цели" }

Верни СТРОГО JSON:
{
  "plan_options": [
    {
      "label": "<название подхода, до 6 слов>",
      "rationale": "<почему этот путь>",
      "steps": [{ "text": "<конкретный шаг>", "contribution_factor": <0.1-1.0> }]
    }
  ]
}

2-3 РАЗНЫХ варианта. 3-7 шагов. Без жёстких дедлайнов.`;

const DAILY_QUESTS_PROMPT = `Ты генерируешь ежедневные квесты для игрока в RPG-геймификации жизни.

Вход — JSON с context (character_sheet с уровнями, recent_history за 7 дней, active_goals).

Верни СТРОГО JSON:
{
  "daily_quests": [
    { "text": "<конкретное действие на сегодня>", "category_id": "<id>", "rationale": "<почему именно это>" }
  ]
}

3 квеста: один для самой отстающей категории, один связанный с активной целью, один для поддержания серии. Конкретные, выполнимые за день.`;

const SEED_QUEST_PROMPT = `Ты помогаешь исследовать затруднение через эксперимент.

Вход — JSON: { seed_text, category: {id, name, weight} | null, previous_attempt: {approach, result_text, feedback} | null }

Верни СТРОГО JSON:
{
  "options": [
    { "label": "<название>", "description": "<что попробовать>", "hypothesis": "<что изменится>" }
  ]
}

2-4 реально разных варианта. Конкретные действия на ближайшие дни.`;

const SEED_VERDICT_PROMPT = `Ты оцениваешь результат эксперимента.

Вход — JSON: { seed_text, chosen_approach: {label, description, hypothesis}, result_text }

Верни СТРОГО JSON:
{
  "verdict": "artifact | refine",
  "artifact": { "name": "<до 5 слов>", "description": "<суть, 1-2 предложения>" } | null,
  "feedback": "<честная реакция>"
}

artifact — ТОЛЬКО если реальный ощутимый эффект. Если сомнительно — refine.`;

export async function callGemini(apiKey: string, model: string, systemPrompt: string, userContent: string, temperature: number = 0): Promise<any> {
  if (!apiKey) throw new Error('Вставь API-ключ в настройках (⚙)');

  const payload = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userContent }] }],
    generationConfig: { responseMimeType: 'application/json', temperature },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API ошибка ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error('Пустой ответ от модели');

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Модель вернула не-JSON: ' + raw.slice(0, 200));
  }
}

export async function callGameMaster(state: AppState, playerText: string) {
  const content = JSON.stringify({
    character_sheet: {
      categories: state.categories,
      artifacts: state.artifacts.map(a => ({ id: a.id, name: a.name, description: a.description })),
    },
    player_text: playerText,
  });
  return callGemini(state.apiKey, state.modelName, SYSTEM_PROMPT, content, 0);
}

export async function callBrainstorm(
  state: AppState,
  messages: { role: string; text: string }[],
  userText: string
) {

  const categories = state.categories.map(c => {
    const { level, current_xp, xp_to_next_level } = deriveLevel(getCategoryTotalXp(state, c.id));
    return { id: c.id, name: c.name, weight: c.weight, level, current_xp, xp_to_next_level };
  });

  const recentHistory = state.history.slice(-15).map(h => ({
    category_id: h.category_id, text: h.text, final_xp: h.final_xp, timestamp: h.timestamp,
  }));

  const activeGoals = state.goals.filter(g => g.status === 'active').map(g => ({
    title: g.title, category_id: g.category_id,
    steps: g.steps.map(s => ({ text: s.text, status: s.status })),
  }));

  const artifacts = state.artifacts.map(a => ({ id: a.id, name: a.name, description: a.description }));
  const openSeeds = state.seeds.filter(s => s.status === 'open').map(s => ({ id: s.id, text: s.text }));

  const context = {
    character_sheet: { categories, artifacts },
    recent_history: recentHistory,
    active_goals: activeGoals,
    open_seeds: openSeeds,
  };

  let contents: { role: string; parts: { text: string }[] }[];

  if (messages.length === 0) {
    contents = [{ role: 'user', parts: [{ text: JSON.stringify({ context, player_message: userText }) }] }];
  } else {
    contents = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }));
    contents.push({ role: 'user', parts: [{ text: userText }] });
  }

  if (!state.apiKey) throw new Error('Вставь API-ключ в настройках (⚙)');

  const payload = {
    systemInstruction: { parts: [{ text: BRAINSTORM_PROMPT }] },
    contents,
    generationConfig: { responseMimeType: 'application/json', temperature: 0.5 },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${state.modelName}:generateContent?key=${state.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API ошибка ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error('Пустой ответ от модели');
  return JSON.parse(raw);
}

export async function callGoalPlanner(state: AppState, category: Category, goalText: string) {
  const content = JSON.stringify({
    category: { id: category.id, name: category.name, weight: category.weight },
    goal_text: goalText,
  });
  return callGemini(state.apiKey, state.modelName, GOAL_PLANNER_PROMPT, content, 0.4);
}

export async function callDailyQuests(state: AppState) {

  const categories = state.categories.map(c => {
    const { level } = deriveLevel(getCategoryTotalXp(state, c.id));
    return { id: c.id, name: c.name, weight: c.weight, level };
  });

  const recentHistory = state.history.slice(-20).map(h => ({
    category_id: h.category_id, text: h.text, timestamp: h.timestamp,
  }));

  const activeGoals = state.goals.filter(g => g.status === 'active').map(g => ({
    title: g.title, category_id: g.category_id,
    steps: g.steps.filter(s => s.status === 'pending').map(s => s.text),
  }));

  const content = JSON.stringify({
    context: { character_sheet: { categories }, recent_history: recentHistory, active_goals: activeGoals },
  });

  return callGemini(state.apiKey, state.modelName, DAILY_QUESTS_PROMPT, content, 0.6);
}

export async function callSeedQuest(state: AppState, seed: { text: string; category_id: string | null; chosen_approach: any; experiment_result: string | null; feedback: string | null }) {
  const cat = state.categories.find(c => c.id === seed.category_id) || null;
  const previousAttempt = seed.chosen_approach ? {
    approach: { label: seed.chosen_approach.label, description: seed.chosen_approach.description },
    result_text: seed.experiment_result,
    feedback: seed.feedback,
  } : null;

  const content = JSON.stringify({
    seed_text: seed.text,
    category: cat ? { id: cat.id, name: cat.name, weight: cat.weight } : null,
    previous_attempt: previousAttempt,
  });

  return callGemini(state.apiKey, state.modelName, SEED_QUEST_PROMPT, content, 0.5);
}

export async function callSeedVerdict(state: AppState, seedText: string, approach: any, resultText: string) {
  const content = JSON.stringify({
    seed_text: seedText,
    chosen_approach: approach,
    result_text: resultText,
  });
  return callGemini(state.apiKey, state.modelName, SEED_VERDICT_PROMPT, content, 0.2);
}

const INSIGHT_INVESTIGATION_PROMPT = `Ты — мягкий исследователь в "Лаборатории идей". Твоя задача — не доказать неправоту, а помочь уточнить идею через диалог.

Стиль общения:
- Дружелюбный, любопытный, как Сократ
- Не говори "это не работает" или "ты неправ"
- Вместо этого задавай вопросы, приводи контрпримеры
- Подводи к осознанию через примеры, а не прямые утверждения
- Если идея частично верна — отметь это, но уточни границы

Вход — JSON:
{
  "insight_text": "текст идеи",
  "conversation": [{"role": "user|assistant", "text": "..."}]
}

Верни СТРОГО JSON:
{
  "message": "<твой ответ в диалоге>",
  "status": "continue | refined | bounded | retired",
  "final_insight": "<уточнённая формулировка>" | null,
  "sources": ["<источник 1>", "<источник 2>"]
}

Статусы:
- continue: диалог продолжается, ещё не пришли к выводу
- refined: идея уточнена и работает (частично или полностью)
- bounded: идея работает, но с ограничениями/границами
- retired: идея не подтверждена, но это нормально — просто откладываем

Важно:
- Никогда не демотивируй
- Признавай ценность мысли, даже если она не совсем точна
- Цель — уточнить, а не отвергнуть`;

export async function callInsightInvestigation(
  state: AppState,
  insightText: string,
  conversation: { role: string; text: string }[]
) {
  const content = JSON.stringify({
    insight_text: insightText,
    conversation,
  });
  return callGemini(state.apiKey, state.modelName, INSIGHT_INVESTIGATION_PROMPT, content, 0.5);
}
