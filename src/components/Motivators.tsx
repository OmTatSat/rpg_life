import React, { useState, useEffect, useRef } from 'react';

interface Props {
  state: any;
}

// Оригинальные мотиваторы из чата — с честными источниками
const MOTIVATORS_GENERAL = [
  { text: "Малое действие всё же двигает счётчик — большие рывки не обязательны.", source: "поведенческая активация" },
  { text: "Мотивация обычно приходит после начала, а не до него.", source: "поведенческая активация" },
  { text: "Незакрытая задача занимает голову больше, чем закрытая — даже маленькая.", source: "эффект Зейгарник" },
  { text: "Прошлые мелкие победы — не повод для хайпа, а реальное доказательство, что получалось.", source: "self-efficacy, Bandura" },
  { text: "Не «я не умею», а «я пока не умею — следующий шаг известен».", source: "growth mindset + self-efficacy" },
  { text: "Сорвался — это данные, не приговор. Важно, что делаешь дальше.", source: "self-compassion, Neff" },
  { text: "Что бы ты сказал другу с этой же мыслью?", source: "self-distancing, Kross" },
  { text: "Дискомфорт от начала почти всегда меньше, чем кажется до начала.", source: "поведенческая активация" },
  { text: "Ты не теряешь время отдыха — ты не бесконечно откладываешь то, что сам выбрал важным.", source: "prospect theory / reframe" },
  { text: "Фокус на том, что реально в твоей власти прямо сейчас.", source: "дихотомия контроля, стоицизм" },
  { text: "Каждое действие — крошечное голосование за то, каким человеком себя видишь.", source: "identity-based habits" },
  { text: "Не обязательно хотеть — достаточно начать, и захочется по ходу.", source: "поведенческая активация" },
];

const MOTIVATORS_BY_CATEGORY: Record<string, { text: string; source: string }[]> = {
  health: [
    { text: "Тело — это база, на которой держится всё остальное сегодня.", source: "" },
    { text: "Маленькая забота о теле сейчас — это меньше кортизола потом.", source: "HPA-ось" },
    { text: "Не нужно идеально — нужно чуть лучше, чем если бы ты не делал ничего.", source: "поведенческая активация" },
  ],
  learning: [
    { text: "Каждый час обучения сейчас — это опция, которой не было вчера.", source: "" },
    { text: "Не всё должно быть понятно с первого раза — это и есть процесс.", source: "growth mindset" },
    { text: "Знание, которое пригодится не сразу, всё равно копится.", source: "" },
  ],
  sport: [
    { text: "Тело помнит движение дольше, чем кажется в моменте лени.", source: "" },
    { text: "Не про рекорд сегодня — про то, что счётчик не на нуле.", source: "" },
    { text: "Даже слабая тренировка — это не пропущенная тренировка.", source: "" },
  ],
  relationships: [
    { text: "Внимание, которое ты дал сегодня, не обязано быть длинным, чтобы быть настоящим.", source: "" },
    { text: "Спросить как дела — маленькое действие с несоразмерно большим эффектом.", source: "" },
    { text: "Связь держится на частоте касаний, не только на глубине разговоров.", source: "" },
  ],
  programming: [
    { text: "Хобби не обязано быть продуктивным, чтобы быть законным.", source: "" },
    { text: "Даже неэффективное время в этом — всё ещё крупица навыка.", source: "" },
    { text: "Разрешить себе — не то же самое, что потерять контроль.", source: "" },
  ],
};

function MotivatorCard({ motivator, visible }: { motivator: { text: string; source: string }; visible: boolean }) {
  return (
    <div className={`transition-opacity duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <p className="text-sm italic leading-relaxed text-[var(--text)]">
        «{motivator.text}»
      </p>
      {motivator.source && (
        <p className="text-xs text-[var(--text-dim)] mt-2 not-italic">
          — {motivator.source}
        </p>
      )}
    </div>
  );
}

export default function MotivatorSidebar({ state }: Props) {
  const [visible, setVisible] = useState(true);
  const lastTextRef = useRef<string | null>(null);

  // Get insight artifacts (only refined/bounded, not retired)
  const insightArtifacts = (state.artifacts || []).filter((a: any) => {
    const insight = (state.insights || []).find((i: any) => i.artifact_id === a.id);
    return insight && (insight.status === 'refined' || insight.status === 'bounded');
  });

  // Build pool of all motivators (general + insights)
  const allMotivators = [
    ...MOTIVATORS_GENERAL,
    ...insightArtifacts.map((a: any) => ({ text: a.description, source: '✨ инсайт' })),
  ];

  // Pick initial random
  const [currentMotivator, setCurrentMotivator] = useState(() => {
    if (allMotivators.length === 0) return MOTIVATORS_GENERAL[0];
    const choice = allMotivators[Math.floor(Math.random() * allMotivators.length)];
    lastTextRef.current = choice.text;
    return choice;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        let choice;
        do {
          choice = allMotivators[Math.floor(Math.random() * allMotivators.length)];
        } while (allMotivators.length > 1 && choice.text === lastTextRef.current);
        lastTextRef.current = choice.text;
        setCurrentMotivator(choice);
        setVisible(true);
      }, 700);
    }, 60000);

    return () => clearInterval(interval);
  }, [allMotivators]);

  return (
    <aside className="hidden lg:flex flex-col gap-4 w-64 flex-shrink-0 sticky top-4 self-start">
      <div className="glass-panel p-4">
        <div className="text-xs text-[var(--text-dim)] mb-3 uppercase tracking-wider">💡 Мотивация</div>
        <MotivatorCard motivator={currentMotivator} visible={visible} />
      </div>
    </aside>
  );
}

export function CategoryMotivator({ categoryId, visible }: { categoryId: string; visible: boolean }) {
  const pool = MOTIVATORS_BY_CATEGORY[categoryId];
  const [index, setIndex] = useState(0);
  
  if (!pool || pool.length === 0) return null;
  const motivator = pool[index % pool.length];

  return (
    <div className={`transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <p className="text-xs italic text-[var(--text-dim)]">
        «{motivator.text}»
        {motivator.source && <span className="not-italic"> — {motivator.source}</span>}
      </p>
    </div>
  );
}
