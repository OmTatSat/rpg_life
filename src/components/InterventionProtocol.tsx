import React, { useState, useEffect, useRef } from 'react';
import { AppState, reduceSomaticLoad } from '../store';

interface Props {
  state: AppState;
  setState: (fn: (prev: AppState) => AppState) => void;
}

type ProtocolState = 'IDLE' | 'GAS_PHASE' | 'BRAKE_PHASE' | 'COMPLETED';
type ProtocolType = 'vegetative' | 'co2' | 'somatic';

export default function InterventionProtocol({ state, setState }: Props) {
  const [protocolState, setProtocolState] = useState<ProtocolState>('IDLE');
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolType>('vegetative');
  const [timeLeft, setTimeLeft] = useState(0);
  const [breathPhase, setBreathPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
  const [metronomeActive, setMetronomeActive] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Очистка интервалов при размонтировании
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Логика таймеров
  useEffect(() => {
    if (protocolState === 'IDLE' || protocolState === 'COMPLETED') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Переход между фазами
          if (protocolState === 'GAS_PHASE') {
            if (selectedProtocol === 'vegetative') {
              setProtocolState('BRAKE_PHASE');
              return 120; // 2 минуты дыхания
            } else if (selectedProtocol === 'co2') {
              // Углекислотный якорь завершен успешно
              setProtocolState('COMPLETED');
              return 0;
            }
          } else if (protocolState === 'BRAKE_PHASE') {
            setProtocolState('COMPLETED');
            return 0;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [protocolState, selectedProtocol]);

  // Дыхательный цикл 4-7-8 для BRAKE_PHASE
  useEffect(() => {
    if (protocolState !== 'BRAKE_PHASE' || selectedProtocol !== 'vegetative') return;

    const breathInterval = setInterval(() => {
      setBreathPhase(prev => {
        if (prev === 'inhale') return 'hold';
        if (prev === 'hold') return 'exhale';
        return 'inhale';
      });
    }, 4000); // Меняем фазу каждые 4 секунды (упрощённо)

    return () => clearInterval(breathInterval);
  }, [protocolState, selectedProtocol]);

  // Аудио метроном для соматического сброса
  useEffect(() => {
    if (protocolState !== 'BRAKE_PHASE' || selectedProtocol !== 'somatic') {
      setMetronomeActive(false);
      return;
    }

    setMetronomeActive(true);
    
    // Создаём AudioContext
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const playClick = () => {
      if (!audioContextRef.current) return;
      
      const oscillator = audioContextRef.current.createOscillator();
      const gainNode = audioContextRef.current.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + 0.1);
      
      oscillator.start(audioContextRef.current.currentTime);
      oscillator.stop(audioContextRef.current.currentTime + 0.1);
    };

    // Метроном каждые 4 секунды (медленное дыхание)
    const metronomeInterval = setInterval(playClick, 4000);
    playClick(); // Первый клик сразу

    return () => {
      clearInterval(metronomeInterval);
      setMetronomeActive(false);
    };
  }, [protocolState, selectedProtocol]);

  // Завершение протокола
  useEffect(() => {
    if (protocolState === 'COMPLETED') {
      // Уменьшаем соматическую нагрузку на 30
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

  const startProtocol = () => {
    if (selectedProtocol === 'vegetative') {
      setProtocolState('GAS_PHASE');
      setTimeLeft(15); // 15 секунд напряжения
    } else if (selectedProtocol === 'co2') {
      setProtocolState('GAS_PHASE');
      setTimeLeft(0); // Обратный отсчёт начинается по клику
    } else if (selectedProtocol === 'somatic') {
      setProtocolState('BRAKE_PHASE');
      setTimeLeft(300); // 5 минут
    }
  };

  const surrender = () => {
    setProtocolState('IDLE');
    setTimeLeft(0);
  };

  const reset = () => {
    setProtocolState('IDLE');
    setTimeLeft(0);
    setBreathPhase('inhale');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="glass-panel p-6">
      <h3 className="text-lg font-semibold mb-4">🧘 Протокол вмешательства</h3>
      
      {/* Выбор протокола */}
      {protocolState === 'IDLE' && (
        <div className="space-y-4">
          <div className="text-sm text-[var(--text-dim)] mb-2">
            Выбери протокол для сброса соматической нагрузки:
          </div>
          
          <div className="space-y-2">
            <label className="flex items-start gap-3 p-3 bg-[var(--panel-2)] rounded-lg cursor-pointer hover:bg-[var(--panel)] transition-colors">
              <input
                type="radio"
                name="protocol"
                value="vegetative"
                checked={selectedProtocol === 'vegetative'}
                onChange={() => setSelectedProtocol('vegetative')}
                className="mt-1"
              />
              <div>
                <div className="font-semibold text-sm">Вегетативные качели</div>
                <div className="text-xs text-[var(--text-dim)] mt-1">
                  15 сек изометрического напряжения → 2 мин диафрагменного дыхания (4-7-8)
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 bg-[var(--panel-2)] rounded-lg cursor-pointer hover:bg-[var(--panel)] transition-colors">
              <input
                type="radio"
                name="protocol"
                value="co2"
                checked={selectedProtocol === 'co2'}
                onChange={() => setSelectedProtocol('co2')}
                className="mt-1"
              />
              <div>
                <div className="font-semibold text-sm">Углекислотный якорь</div>
                <div className="text-xs text-[var(--text-dim)] mt-1">
                  Задержка дыхания на максимум. Задача — не нажать "Сдаться"
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 bg-[var(--panel-2)] rounded-lg cursor-pointer hover:bg-[var(--panel)] transition-colors">
              <input
                type="radio"
                name="protocol"
                value="somatic"
                checked={selectedProtocol === 'somatic'}
                onChange={() => setSelectedProtocol('somatic')}
                className="mt-1"
              />
              <div>
                <div className="font-semibold text-sm">Соматический сброс</div>
                <div className="text-xs text-[var(--text-dim)] mt-1">
                  5 минут медленного дыхания с аудио-визуальным метрономом
                </div>
              </div>
            </label>
          </div>

          <button
            onClick={startProtocol}
            className="w-full bg-[var(--accent)] text-white rounded-lg py-3 font-semibold hover:opacity-90 transition-opacity"
          >
            Начать протокол
          </button>
        </div>
      )}

      {/* GAS_PHASE - Напряжение */}
      {protocolState === 'GAS_PHASE' && selectedProtocol === 'vegetative' && (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">💪</div>
          <div className="text-2xl font-bold mb-2">ИЗОМЕТРИЧЕСКОЕ НАПРЯЖЕНИЕ</div>
          <div className="text-4xl font-mono text-[var(--warn)] mb-4">
            {formatTime(timeLeft)}
          </div>
          <p className="text-sm text-[var(--text-dim)]">
            Напряги все мышцы тела. Держи напряжение до конца таймера.
          </p>
          <button
            onClick={surrender}
            className="mt-6 text-sm text-[var(--text-dim)] hover:text-[var(--text)] underline"
          >
            Прервать
          </button>
        </div>
      )}

      {/* GAS_PHASE - Углекислотный якорь */}
      {protocolState === 'GAS_PHASE' && selectedProtocol === 'co2' && (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">🫁</div>
          <div className="text-2xl font-bold mb-2">ЗАДЕРЖКА ДЫХАНИЯ</div>
          <div className="text-4xl font-mono text-[var(--accent)] mb-4">
            {formatTime(timeLeft)}
          </div>
          <p className="text-sm text-[var(--text-dim)] mb-6">
            Сделай глубокий вдох и задержи дыхание. Держись как можно дольше!
          </p>
          <button
            onClick={surrender}
            className="px-6 py-3 bg-[var(--danger)] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            Сдаться
          </button>
        </div>
      )}

      {/* BRAKE_PHASE - Вегетативные качели (дыхание 4-7-8) */}
      {protocolState === 'BRAKE_PHASE' && selectedProtocol === 'vegetative' && (
        <div className="text-center py-8">
          <div className="text-6xl mb-4 animate-pulse">
            {breathPhase === 'inhale' ? '🌬️' : breathPhase === 'hold' ? '⏸️' : '💨'}
          </div>
          <div className="text-2xl font-bold mb-2">ДИАФРАГМЕНАЛЬНОЕ ДЫХАНИЕ</div>
          <div className="text-lg font-semibold mb-2" style={{ color: 'var(--good)' }}>
            {breathPhase === 'inhale' ? 'ВДОХ (4 сек)' : breathPhase === 'hold' ? 'ЗАДЕРЖКА (7 сек)' : 'ВЫДОХ (8 сек)'}
          </div>
          <div className="text-4xl font-mono text-[var(--good)] mb-4">
            {formatTime(timeLeft)}
          </div>
          <p className="text-sm text-[var(--text-dim)]">
            Расслабься и следуй ритму дыхания
          </p>
        </div>
      )}

      {/* BRAKE_PHASE - Соматический сброс (5 мин с метрономом) */}
      {protocolState === 'BRAKE_PHASE' && selectedProtocol === 'somatic' && (
        <div className="text-center py-8">
          <div className={`text-6xl mb-4 ${metronomeActive ? 'animate-pulse' : ''}`}>
            🧘
          </div>
          <div className="text-2xl font-bold mb-2">СОМАТИЧЕСКИЙ СБРОС</div>
          <div className="text-4xl font-mono text-[var(--accent)] mb-4">
            {formatTime(timeLeft)}
          </div>
          <p className="text-sm text-[var(--text-dim)] mb-4">
            Медленное дыхание под метроном (1 клик каждые 4 секунды)
          </p>
          {metronomeActive && (
            <div className="text-xs text-[var(--good)]">🔊 Метроном активен</div>
          )}
          <button
            onClick={surrender}
            className="mt-6 text-sm text-[var(--text-dim)] hover:text-[var(--text)] underline"
          >
            Прервать
          </button>
        </div>
      )}

      {/* COMPLETED */}
      {protocolState === 'COMPLETED' && (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">✅</div>
          <div className="text-2xl font-bold mb-2 text-[var(--good)]">ПРОТОКОЛ ЗАВЕРШЁН</div>
          <p className="text-sm text-[var(--text-dim)] mb-6">
            Соматический груз снижен на 30 единиц. Буфер ЦНС стабилизирован.
          </p>
          <button
            onClick={reset}
            className="px-6 py-3 bg-[var(--accent)] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            Завершить
          </button>
        </div>
      )}
    </div>
  );
}
