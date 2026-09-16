# Интеграция биометрических метрик в Action Logger

## Обзор

Добавлена интеграция биометрических метрик (somaticImpact и nscModifier) в систему парсинга действий через AI. Теперь при записи действия AI оценивает его влияние на нервную систему и соматический груз.

## Изменения в системном промпте

### Новые поля в JSON-схеме ответа AI

В `src/api.ts` обновлён `SYSTEM_PROMPT`. Теперь AI возвращает два дополнительных поля для каждого действия:

```typescript
{
  "matches": [
    {
      "matched_category_id": "...",
      "new_quest_text": "...",
      "quest_type": "...",
      "contribution_factor": 0.5,
      "base_xp": 30,
      "somaticImpact": 30,      // НОВОЕ: от -50 до +50
      "nscModifier": -2          // НОВОЕ: от -5 до +5
    }
  ]
}
```

### Оценка somaticImpact (Соматический груз)

Диапазон: **-50 до +50**

**Положительные значения (нагрузка):**
- **+30 до +50**: тяжёлые тренировки, переработка, токсичный контент (порно, рилсы, эскапизм)
- **+10 до +29**: умеренная нагрузка, стресс

**Нейтральные:**
- **0**: нейтральные действия

**Отрицательные значения (восстановление):**
- **-10 до -29**: лёгкое восстановление, прогулка, медитация
- **-30 до -50**: глубокое восстановление (йога-нидра, сон, природа)

### Оценка nscModifier (Ёмкость нервной системы)

Диапазон: **-5 до +5**

**Отрицательные значения (сужение):**
- **-5 до -2**: эскапизм, токсичные привычки, избегание
- **-1**: лёгкое снижение (усталость, рутина)

**Нейтральные:**
- **0**: нейтрально

**Положительные значения (расширение):**
- **+1 до +2**: осознанное преодоление стресса, обучение
- **+3 до +5**: значительное развитие, прорыв, адаптация к сложному

## Обработка в Action Logger

### Суммирование значений

В `src/components/ActionLogger.tsx` при обработке ответа AI:

```typescript
let totalSomaticImpact = 0;
let totalNscModifier = 0;

matches.forEach((m: any) => {
  if (typeof m.somaticImpact === 'number') {
    totalSomaticImpact += m.somaticImpact;
  }
  if (typeof m.nscModifier === 'number') {
    totalNscModifier += m.nscModifier;
  }
});
```

### Применение к состоянию

После суммирования значения применяются к глобальному состоянию:

```typescript
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
```

**Ограничения:**
- `nervousSystemCapacity`: минимум 50, максимум 150
- `currentSomaticLoad`: автоматически ограничивается 0-100 через `addSomaticLoad`

## UI индикаторы

### Отображение после записи действия

После успешной записи действия отображаются индикаторы влияния на нервную систему:

#### 1. Положительный somaticImpact (> 0)

```
⚠️ +30 Соматический груз
   Нагрузка на нервную систему увеличена
```

**Стиль:** красный фон с прозрачностью, красная граница

#### 2. Отрицательный somaticImpact (< 0)

```
✨ -20 Соматический груз
   Восстановление нервной системы
```

**Стиль:** зелёный фон с прозрачностью, зелёная граница

#### 3. Отрицательный nscModifier (< 0)

```
🧠 Зафиксировано сужение Емкости ЦНС
   -2 к ёмкости нервной системы
```

**Стиль:** жёлтый фон с прозрачностью, жёлтая граница

#### 4. Положительный nscModifier (> 0)

```
💪 Расширение Емкости ЦНС
   +2 к ёмкости нервной системы
```

**Стиль:** синий фон с прозрачностью, синяя граница

### Автоматическая очистка

Индикаторы автоматически очищаются при начале нового ввода текста:

```typescript
<textarea
  onChange={e => {
    setText(e.target.value);
    if (nervousSystemImpact) {
      setNervousSystemImpact(null);
    }
  }}
/>
```

## Интеграция с Intervention Protocol

Эти метрики интегрируются с компонентом `InterventionProtocol`:

- При высоком `currentSomaticLoad` (> 70) пользователь видит предупреждение в `Biometrics`
- Компонент `InterventionProtocol` позволяет снизить нагрузку через протоколы восстановления
- При завершении протокола вызывается `reduceSomaticLoad(state, 30)`

## Примеры использования

### Пример 1: Тяжёлая тренировка

**Ввод:** "Сделал тяжёлую тренировку 2 часа, сильно устал"

**AI ответ:**
```json
{
  "matches": [{
    "matched_category_id": "sport",
    "new_quest_text": "Тяжёлая тренировка 2 часа",
    "quest_type": "medium",
    "contribution_factor": 0.8,
    "base_xp": 60,
    "somaticImpact": 35,
    "nscModifier": 0
  }]
}
```

**Результат:**
- XP: +48 (60 × 0.8 × 1.0)
- Соматический груз: +35
- Ёмкость ЦНС: без изменений
- UI: красный индикатор "+35 Соматический груз"

### Пример 2: Эскапизм

**Ввод:** "Залипал в рилсы 2 часа"

**AI ответ:**
```json
{
  "matches": [{
    "matched_category_id": "health",
    "new_quest_text": "Залипал в рилсы 2 часа",
    "quest_type": "repeating",
    "contribution_factor": 0.3,
    "base_xp": 5,
    "somaticImpact": 40,
    "nscModifier": -2
  }]
}
```

**Результат:**
- XP: +1.5 (5 × 0.3 × 1.0)
- Соматический груз: +40
- Ёмкость ЦНС: -2
- UI: красный индикатор "+40 Соматический груз" + жёлтое предупреждение "Зафиксировано сужение Емкости ЦНС"

### Пример 3: Йога-нидра

**Ввод:** "Практиковал йога-нидру 30 минут"

**AI ответ:**
```json
{
  "matches": [{
    "matched_category_id": "health",
    "new_quest_text": "Практиковал йога-нидру 30 минут",
    "quest_type": "medium",
    "contribution_factor": 0.7,
    "base_xp": 30,
    "somaticImpact": -40,
    "nscModifier": 2
  }]
}
```

**Результат:**
- XP: +21 (30 × 0.7 × 1.0)
- Соматический груз: -40 (восстановление)
- Ёмкость ЦНС: +2
- UI: зелёный индикатор "-40 Соматический груз" + синий индикатор "Расширение Емкости ЦНС +2"

## Тестирование

### Проверка работы

1. Запишите действие с высокой нагрузкой (например, "Тяжёлая тренировка")
2. Убедитесь, что появился красный индикатор somaticImpact
3. Проверьте в компоненте `Biometrics`, что `currentSomaticLoad` увеличился
4. Запишите действие с восстановлением (например, "Прогулка на природе")
5. Убедитесь, что появился зелёный индикатор и `currentSomaticLoad` снизился

### Проверка эскапизма

1. Запишите действие типа "Сидел в соцсетях 3 часа"
2. Убедитесь, что появились оба индикатора:
   - Красный: "+40 Соматический груз"
   - Жёлтый: "Зафиксировано сужение Емкости ЦНС"
3. Проверьте, что `nervousSystemCapacity` уменьшился

## Ограничения и будущие улучшения

### Текущие ограничения

1. **AI может ошибаться** в оценке somaticImpact и nscModifier
2. **Нет валидации** значений от AI (может вернуть значения вне диапазона)
3. **Нет истории** изменений биометрических метрик

### Будущие улучшения

1. **Валидация значений**: ограничить somaticImpact и nscModifier в обработчике
2. **Графики изменений**: показать историю изменений биометрики
3. **Рекомендации**: если somaticImpact > 70, предложить Intervention Protocol
4. **Адаптивные подсказки**: AI может учитывать текущее состояние при оценке
5. **Ручная корректировка**: позволить пользователю вручную изменять оценки AI

## Связанные компоненты

- `Biometrics` — отображает текущее состояние биометрики
- `InterventionProtocol` — протоколы восстановления
- `store.ts` — функции `addSomaticLoad` и `reduceSomaticLoad`
- `api.ts` — системный промпт для AI

## Технические детали

### Типы данных

```typescript
interface AppState {
  // ... другие поля
  nervousSystemCapacity: number; // 50-150
  currentSomaticLoad: number;    // 0-100
  baselineShift: 'optimal' | 'hyperaroused' | 'hypoaroused';
  isBurnoutRisk: boolean;        // true если currentSomaticLoad > 85
}
```

### Функции из store.ts

```typescript
// Добавляет/убавляет соматический груз
export function addSomaticLoad(state: AppState, amount: number): AppState

// Уменьшает соматический груз (используется в InterventionProtocol)
export function reduceSomaticLoad(state: AppState, amount: number): AppState
```

### Обработка в ActionLogger

```typescript
// Суммирование значений из всех matches
let totalSomaticImpact = 0;
let totalNscModifier = 0;

matches.forEach((m: any) => {
  if (typeof m.somaticImpact === 'number') {
    totalSomaticImpact += m.somaticImpact;
  }
  if (typeof m.nscModifier === 'number') {
    totalNscModifier += m.nscModifier;
  }
});

// Применение к состоянию
if (totalSomaticImpact !== 0) {
  const updated = addSomaticLoad(newState, totalSomaticImpact);
  newState.currentSomaticLoad = updated.currentSomaticLoad;
  newState.isBurnoutRisk = updated.isBurnoutRisk;
}

if (totalNscModifier !== 0) {
  const newCapacity = Math.max(50, Math.min(150, newState.nervousSystemCapacity + totalNscModifier));
  newState.nervousSystemCapacity = newCapacity;
}
```

## Заключение

Интеграция биометрических метрик позволяет отслеживать влияние действий на нервную систему и соматический груз. Это даёт пользователю обратную связь о том, как его действия влияют на состояние, и мотивирует к балансу между нагрузкой и восстановлением.
