import React, { useState, useEffect } from 'react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function Toast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handleShowToast = (event: CustomEvent) => {
      const { message, type } = event.detail;
      const id = Date.now().toString();
      
      setToasts(prev => [...prev, { id, message, type }]);
      
      // Автоматически удаляем через 5 секунд
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 5000);
    };

    window.addEventListener('showToast', handleShowToast as EventListener);
    
    return () => {
      window.removeEventListener('showToast', handleShowToast as EventListener);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`glass-panel p-4 max-w-sm animate-slide-up ${
            toast.type === 'success' ? 'border-l-4 border-[var(--good)]' :
            toast.type === 'error' ? 'border-l-4 border-[var(--danger)]' :
            'border-l-4 border-[var(--accent)]'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="text-sm font-semibold mb-1">
                {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
              </div>
              <div className="text-sm">{toast.message}</div>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-[var(--text-dim)] hover:text-[var(--text)] text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
