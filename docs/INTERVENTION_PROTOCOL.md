# Intervention Protocol Component

## Обзор

`InterventionProtocol` — это независимый компонент "мини-игры" для сброса соматической нагрузки (`currentSomaticLoad`). Компонент не зависит от логики XP и работает как отдельная система вмешательства.

## Архитектура (State Machine)

Компонент реализует конечный автомат с четырьмя состояниями:

```
IDLE → GAS_PHASE → BRAKE_PHASE → COMPLETED → IDLE
         ↓              ↓
      (surrender)    (surrender)
         ↓              ↓
        IDLE           IDLE
```

### Состояния

- **IDLE** — начальное состояние, выбор протокола
- **GAS_PHASE** — фаза напряжения/нагрузки
- **BRAKE_PHASE** — фаза расслабления/восстановления
- **COMPLETED** — протокол завершён, вызывается `reduceSomaticLoad(30)`

## Протоколы

### 1. Вегетативные качели (`vegetative`)

**Полный цикл:**
- **GAS_PHASE** (15 сек): Изометрическое напряжение всех мышц тела
- **BRAKE_PHASE** (120 сек): Диафрагменное дыхание по технике 4-7-8
  - Вдох (4 сек) → Задержка (7 сек) → Выдох (8 сек)
- Автоматический переход между фазами
- Визуальная индикация текущей фазы дыхания

**Переходы:**
```
IDLE → GAS_PHASE (15 сек) → BRAKE_PHASE (120 сек) → COMPLETED
```

### 2. Углекислотный якорь (`co2`)

**Полный цикл:**
- **GAS_PHASE**: Задержка дыхания на максимум
- Пользователь нажимает "Начать задержку"
- Таймер обратного отсчёта (не отображается, чтобы не демотивировать)
- Задача — не нажать "Сдаться"
- При нажатии "Сдаться" → возврат в IDLE без снижения нагрузки

**Переходы:**
```
IDLE → GAS_PHASE (пока пользователь не сдастся) → COMPLETED
                ↓
           (surrender) → IDLE
```

### 3. Соматический сброс (`somatic`)

**Полный цикл:**
- **BRAKE_PHASE** (300 сек / 5 мин): Медленное дыхание с аудио-визуальным метрономом
- Метроном: 1 клик каждые 4 секунды (Web Audio API)
- Визуальная пульсация в такт метроному
- Можно прервать в любой момент

**Переходы:**
```
IDLE → BRAKE_PHASE (300 сек) → COMPLETED
              ↓
         (surrender) → IDLE
```

## Интеграция

### Вызов reduceSomaticLoad

При достижении состояния **COMPLETED** компонент автоматически:

```typescript
useEffect(() => {
  if (protocolState === 'COMPLETED') {
    setState(prev => reduceSomaticLoad(prev, 30));
    
    // Показываем уведомление
    const event = new CustomEvent('showToast', {
      detail: {
        message: 'Соматический груз интегрирован. Буфер ЦНС стабилизирован',
        type: 'success',
      },
    });
    window.dispatchEvent(event);
  }
}, [protocolState, setState]);
```

### Система уведомлений (Toast)

Компонент использует глобальную систему уведомлений через CustomEvent:

```typescript
// Отправка уведомления
const event = new CustomEvent('showToast', {
  detail: {
    message: 'Текст уведомления',
    type: 'success' | 'error' | 'info',
  },
});
window.dispatchEvent(event);
```

Компонент `Toast` слушает эти события и отображает уведомления в правом верхнем углу с автоматическим исчезновением через 5 секунд.

## Использование

### В Dashboard

```typescript
import InterventionProtocol from './InterventionProtocol';

// В JSX
<InterventionProtocol state={state} setState={setState} />
```

### Props

```typescript
interface Props {
  state: AppState;
  setState: (fn: (prev: AppState) => AppState) => void;
}
```

## Технические детали

### Таймеры

- Используются `setInterval` с автоматической очисткой при размонтировании
- Ref `intervalRef` хранит ID интервала для корректной очистки

### Аудио (Web Audio API)

```typescript
const audioContextRef = useRef<AudioContext | null>(null);

// Создание аудио-контекста
if (!audioContextRef.current) {
  audioContextRef.current = new AudioContext();
}

// Генерация клика метронома
const oscillator = audioContextRef.current.createOscillator();
const gainNode = audioContextRef.current.createGain();
// ... настройка и воспроизведение
```

### Дыхательный цикл (4-7-8)

Упрощённая реализация с переключением фаз каждые 4 секунды:
- Вдох → Задержка → Выдох → Вдох → ...

В полной версии можно реализовать точные тайминги 4-7-8.

## Безопасность и ограничения

### Браузерные ограничения

- **Web Audio API** требует пользовательского взаимодействия для активации
- Метроном запускается только после клика "Начать протокол"
- AudioContext создаётся лениво при первом использовании

### Производительность

- Интервалы автоматически очищаются при размонтировании
- Нет утечек памяти
- Минимальная нагрузка на CPU

### Доступность

- Семантическая разметка (button, label)
- Визуальная индикация состояния
- Возможность прервать протокол в любой момент

## Расширение

### Добавление новых протоколов

1. Добавить тип в `ProtocolType`:
```typescript
type ProtocolType = 'vegetative' | 'co2' | 'somatic' | 'new_protocol';
```

2. Добавить UI для выбора в секции IDLE:
```typescript
<label className="...">
  <input type="radio" value="new_protocol" ... />
  <div>
    <div className="font-semibold">Новый протокол</div>
    <div className="text-xs">Описание</div>
  </div>
</label>
```

3. Реализовать логику в `startProtocol`:
```typescript
else if (selectedProtocol === 'new_protocol') {
  setProtocolState('GAS_PHASE'); // или BRAKE_PHASE
  setTimeLeft(duration);
}
```

4. Добавить визуализацию в соответствующей фазе.

### Кастомизация параметров

Можно вынести параметры в настройки:
- Длительность фаз
- Количество снижения нагрузки (сейчас фиксировано 30)
- Частота метронома
- Техника дыхания

## Тестирование

### Ручное тестирование

1. **Вегетативные качели**: проверить переходы GAS → BRAKE → COMPLETED
2. **Углекислотный якорь**: проверить "Сдаться" → IDLE без снижения нагрузки
3. **Соматический сброс**: проверить аудио-метроном и таймер 5 минут
4. **Toast уведомления**: проверить появление и исчезновение
5. **Снижение нагрузки**: проверить изменение `currentSomaticLoad` в Biometrics

### Проверка state machine

```typescript
// В консоли браузера
console.log(state.currentSomaticLoad); // до протокола
// ... выполнить протокол ...
console.log(state.currentSomaticLoad); // должно быть на 30 меньше
```

## Зависимости

- React (hooks: useState, useEffect, useRef)
- Web Audio API (для метронома)
- CustomEvent API (для уведомлений)
- Биометрические метрики из `store.ts`

## Связанные компоненты

- `Biometrics` — отображает текущее состояние `currentSomaticLoad`
- `Toast` — система уведомлений
- `Dashboard` — родительский компонент

## Будущие улучшения

1. **Сохранение истории протоколов** — когда и какие протоколы выполнялись
2. **Адаптивная длительность** — на основе текущего уровня нагрузки
3. **Голосовые инструкции** — TTS для фаз дыхания
4. **Вибрация** (мобильные) — тактильная обратная связь для метронома
5. **Графики эффективности** — как менялась нагрузка после протоколов
6. **Рекомендации** — какой протокол выбрать на основе текущего состояния
