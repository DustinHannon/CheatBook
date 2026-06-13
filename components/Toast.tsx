import React, { createContext, useState, useCallback, useContext, useEffect, useRef, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem { id: string; message: string; type: ToastType }

interface ToastContextType { showToast: (message: string, type?: ToastType) => void }

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

let counter = 0;
const ACCENT: Record<ToastType, string> = { success: '#5eead4', error: '#fb87a4', info: '#6ea8fe' };

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) { clearTimeout(t); timers.current.delete(id); }
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `t-${++counter}`;
    setToasts((prev) => [...prev, { id, message, type }].slice(-5));
    timers.current.set(id, setTimeout(() => remove(id), 3200));
  }, [remove]);

  useEffect(() => {
    const map = timers.current;
    return () => { map.forEach((t) => clearTimeout(t)); map.clear(); };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[120] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id} role="alert"
            className="cb-panel pointer-events-auto flex w-80 max-w-[90vw] items-center justify-between gap-3 rounded-xl px-4 py-3 text-[13px] text-text-2 animate-cb-up"
            style={{ borderLeft: `2px solid ${ACCENT[t.type]}` }}
          >
            <span>{t.message}</span>
            <button onClick={() => remove(t.id)} aria-label="Dismiss" className="flex-none text-text-4 hover:text-text">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 3l8 8M11 3l-8 8" /></svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
export default ToastContext;
