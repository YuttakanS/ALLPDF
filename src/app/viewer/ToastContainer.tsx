import React from 'react';

export interface ToastItem {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'warning';
}

export interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      data-testid="toast-container"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 2000,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => {
        const bgColor =
          toast.type === 'warning'
            ? '#323232'
            : toast.type === 'success'
              ? '#1e4620'
              : '#202124';

        return (
          <div
            key={toast.id}
            data-testid="toast-message"
            style={{
              backgroundColor: bgColor,
              color: '#ffffff',
              padding: '10px 16px',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
              fontSize: '0.875rem',
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              animation: 'fadeIn 0.2s ease',
              maxWidth: '360px',
            }}
          >
            <span>{toast.message}</span>
            <button
              onClick={() => onDismiss(toast.id)}
              style={{
                background: 'none',
                border: 'none',
                color: '#dadce0',
                cursor: 'pointer',
                fontSize: '1rem',
                padding: 0,
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
};
