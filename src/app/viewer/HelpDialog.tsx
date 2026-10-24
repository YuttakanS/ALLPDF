import React, { useEffect } from 'react';
import { useI18n } from '../i18n';

export interface HelpDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpDialog: React.FC<HelpDialogProps> = ({ isOpen, onClose }) => {
  const { t } = useI18n();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcutSections = [
    {
      category: t('help.navigationCategory'),
      items: [
        { key: '+ / =', desc: t('help.zoomIn') },
        { key: '-', desc: t('help.zoomOut') },
        { key: 'Ctrl + 0', desc: t('help.fitWidth') },
      ],
    },
    {
      category: t('help.operationsCategory'),
      items: [
        { key: 'Ctrl + Z', desc: t('help.undo') },
        { key: 'Ctrl + Y', desc: t('help.redo') },
        { key: 'Delete / Backspace', desc: t('help.delete') },
        { key: 'Ctrl + A', desc: t('help.selectAll') },
        { key: 'Escape', desc: t('help.clearSelection') },
        { key: 'F1 / ?', desc: t('help.helpKey') },
      ],
    },
  ];

  return (
    <div
      data-testid="help-dialog-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        data-testid="help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-dialog-title"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          padding: '24px',
          width: '520px',
          maxWidth: '92vw',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 id="help-dialog-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
            {t('help.title')}
          </h2>
          <button
            data-testid="close-help-btn"
            onClick={onClose}
            aria-label={t('help.close')}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              color: '#5f6368',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {shortcutSections.map((sec) => (
            <div key={sec.category}>
              <h3
                style={{
                  margin: '0 0 8px 0',
                  fontSize: '0.9rem',
                  color: '#1a73e8',
                  fontWeight: 600,
                  borderBottom: '1px solid #e8eaed',
                  paddingBottom: '4px',
                }}
              >
                {sec.category}
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <tbody>
                  {sec.items.map((item) => (
                    <tr key={item.key} style={{ borderBottom: '1px solid #f1f3f4' }}>
                      <td style={{ padding: '6px 0', width: '40%' }}>
                        <kbd
                          style={{
                            padding: '3px 8px',
                            backgroundColor: '#f1f3f4',
                            border: '1px solid #dadce0',
                            borderRadius: '4px',
                            fontFamily: 'monospace',
                            fontSize: '0.8rem',
                            color: '#202124',
                          }}
                        >
                          {item.key}
                        </kbd>
                      </td>
                      <td style={{ padding: '6px 0', color: '#3c4043' }}>{item.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: '#1a73e8',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {t('help.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
