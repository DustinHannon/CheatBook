import React, { createContext, useState, useCallback, useContext, useEffect, useRef, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  timestamp: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
});

let toastCounter = 0;

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `toast-${++toastCounter}`;
    const toast: Toast = { id, message, type, timestamp: Date.now() };

    setToasts(prev => {
      const next = [...prev, toast];
      if (next.length > 5) {
        const removed = next.shift();
        if (removed) {
          const timer = timersRef.current.get(removed.id);
          if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(removed.id);
          }
        }
      }
      return next;
    });

    const timer = setTimeout(() => {
      removeToast(id);
    }, 3000);
    timersRef.current.set(id, timer);
  }, [removeToast]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(timer => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const borderColorMap: Record<ToastType, string> = {
    success: 'border-l-status-success',
    error: 'border-l-status-error',
    info: 'border-l-accent',
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`
              pointer-events-auto
              bg-bg-surface border border-border-default rounded-lg shadow-lg
              px-4 py-3 text-sm text-text-body
              border-l-2 ${borderColorMap[toast.type]}
              animate-slide-in-right
              max-w-sm w-80
            `}
            role="alert"
          >
            <div className="flex items-center justify-between gap-2">
              <span>{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-text-tertiary hover:text-text-secondary flex-shrink-0 ml-2"
                aria-label="Dismiss"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M3 3l8 8M11 3l-8 8" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
      <style jsx global>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
      `}</style>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);

export default ToastContext;
