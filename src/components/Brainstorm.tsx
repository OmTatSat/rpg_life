import React, { useState, useRef, useEffect } from 'react';
import { AppState } from '../store';
import { callBrainstorm } from '../api';

interface Props {
  state: AppState;
  setState: (fn: (prev: AppState) => AppState) => void;
}

interface Message {
  role: 'user' | 'model';
  text: string;
  suggestions?: { text: string; category_id: string; rationale: string }[];
}

export default function Brainstorm({ state }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: 'user', text: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setStatus('Думаю...');

    try {
      const result = await callBrainstorm(state, messages, input.trim());
      const modelMsg: Message = {
        role: 'model',
        text: result.message || '',
        suggestions: result.suggested_quests || [],
      };
      setMessages(prev => [...prev, modelMsg]);
      setStatus('');
    } catch (e: any) {
      setStatus(e.message);
      setMessages(prev => prev.slice(0, -1)); // remove stuck user message
    }
  };

  const reset = () => {
    setMessages([]);
    setStatus('');
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="glass-panel p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold">💭 Брейншторм</h3>
          <button
            onClick={reset}
            className="text-xs px-3 py-1.5 rounded-lg bg-[var(--panel-2)] border border-[var(--line)] text-[var(--text-dim)] hover:text-[var(--accent)]"
          >
            Сначала
          </button>
        </div>

        {/* Chat Log */}
        <div ref={logRef} className="max-h-[400px] overflow-y-auto space-y-3 mb-3">
          {messages.length === 0 ? (
            <p className="text-sm text-[var(--text-dim)]">
              Спроси что-то вроде «что сейчас важнее подтянуть?» — увидит статы, историю и активные цели.
            </p>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 ${
                  m.role === 'user'
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--panel-2)] border border-[var(--line)]'
                }`}>
                  <p className="text-sm">{m.text}</p>
                  {m.suggestions && m.suggestions.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {m.suggestions.map((s, j) => (
                        <div key={j} className="bg-[var(--panel)] rounded-lg p-2 border border-[var(--line)]">
                          <div className="text-xs font-semibold">{s.text}</div>
                          <div className="text-xs text-[var(--text-dim)] mt-0.5">{s.rationale}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }}
            placeholder="Спроси, что сейчас целесообразно..."
            className="flex-1 min-h-[50px] bg-[var(--panel-2)] border border-[var(--line)] rounded-lg p-3 text-sm text-[var(--text)] resize-y focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <button
          onClick={send}
          disabled={!input.trim() || status === 'Думаю...'}
          className="w-full mt-2 bg-[var(--accent)] text-white rounded-lg py-2.5 font-semibold text-sm disabled:opacity-50"
        >
          {status === 'Думаю...' ? '⏳ Думаю...' : 'Спросить'}
        </button>
        {status && status !== 'Думаю...' && (
          <p className="text-sm text-[var(--danger)] mt-2">{status}</p>
        )}
        <p className="text-xs text-[var(--text-dim)] mt-2">Ctrl+Enter для быстрой отправки</p>
      </div>
    </div>
  );
}
