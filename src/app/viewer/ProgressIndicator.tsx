import React, { useEffect, useState } from 'react';

export interface ProgressIndicatorProps {
  isLoading: boolean;
  message?: string;
  delayMs?: number; // default 500ms
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  isLoading,
  message = 'กำลังประมวลผล...',
  delayMs = 500,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer: number | null = null;
    if (isLoading) {
      timer = window.setTimeout(() => {
        setVisible(true);
      }, delayMs);
    } else {
      setVisible(false);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isLoading, delayMs]);

  if (!visible) return null;

  return (
    <div
      data-testid="global-progress-indicator"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.65)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3000,
        gap: '12px',
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          border: '3px solid #e8eaed',
          borderTop: '3px solid #1a73e8',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <span style={{ fontSize: '0.9rem', color: '#202124', fontWeight: 500 }}>{message}</span>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
