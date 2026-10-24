import React, { useMemo, useState } from 'react';
import {
  parsePageRanges,
  splitEveryNPages,
  splitSelectedPages,
  type SplitGroup,
} from '../../engine/split/range-parser';
import { useI18n } from '../i18n';

export interface SplitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  totalActivePages: number;
  selectedActiveIndices: number[];
  onExecuteSplit: (groups: SplitGroup[]) => Promise<void>;
}

export type SplitMode = 'ranges' | 'everyN' | 'selected';

export const SplitDialog: React.FC<SplitDialogProps> = ({
  isOpen,
  onClose,
  totalActivePages,
  selectedActiveIndices,
  onExecuteSplit,
}) => {
  const { t, locale } = useI18n();
  const [mode, setMode] = useState<SplitMode>('ranges');
  const [rangeInput, setRangeInput] = useState<string>('');
  const [everyNInput, setEveryNInput] = useState<number>(2);
  const [selectedMode, setSelectedMode] = useState<'individual' | 'combined'>('individual');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Compute live validation result based on active mode
  const validationResult = useMemo(() => {
    if (mode === 'ranges') {
      if (!rangeInput.trim()) {
        return null;
      }
      return parsePageRanges(rangeInput, totalActivePages);
    }
    if (mode === 'everyN') {
      return splitEveryNPages(totalActivePages, everyNInput);
    }
    if (mode === 'selected') {
      return splitSelectedPages(selectedActiveIndices, totalActivePages, selectedMode);
    }
    return null;
  }, [mode, rangeInput, everyNInput, selectedActiveIndices, selectedMode, totalActivePages]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!validationResult || !validationResult.success) return;
    setIsProcessing(true);
    try {
      await onExecuteSplit(validationResult.groups);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const isConfirmDisabled =
    isProcessing ||
    !validationResult ||
    !validationResult.success ||
    validationResult.groups.length === 0;

  return (
    <div
      data-testid="split-dialog-backdrop"
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
        data-testid="split-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="split-dialog-title"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          padding: '24px',
          width: '460px',
          maxWidth: '90vw',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 id="split-dialog-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
            {t('split.title')}
          </h2>
          <button
            onClick={onClose}
            aria-label={t('split.cancel')}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.2rem',
              cursor: 'pointer',
              color: '#5f6368',
            }}
          >
            ✕
          </button>
        </div>

        {/* Mode Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #dadce0', gap: '8px' }}>
          <button
            data-testid="tab-ranges"
            onClick={() => setMode('ranges')}
            style={{
              padding: '8px 12px',
              border: 'none',
              background: 'none',
              borderBottom: mode === 'ranges' ? '2px solid #1a73e8' : '2px solid transparent',
              color: mode === 'ranges' ? '#1a73e8' : '#5f6368',
              fontWeight: mode === 'ranges' ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {t('split.tabRanges')}
          </button>
          <button
            data-testid="tab-every-n"
            onClick={() => setMode('everyN')}
            style={{
              padding: '8px 12px',
              border: 'none',
              background: 'none',
              borderBottom: mode === 'everyN' ? '2px solid #1a73e8' : '2px solid transparent',
              color: mode === 'everyN' ? '#1a73e8' : '#5f6368',
              fontWeight: mode === 'everyN' ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {t('split.tabEveryN')}
          </button>
          <button
            data-testid="tab-selected"
            onClick={() => setMode('selected')}
            style={{
              padding: '8px 12px',
              border: 'none',
              background: 'none',
              borderBottom: mode === 'selected' ? '2px solid #1a73e8' : '2px solid transparent',
              color: mode === 'selected' ? '#1a73e8' : '#5f6368',
              fontWeight: mode === 'selected' ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {t('split.tabSelected', { count: selectedActiveIndices.length })}
          </button>
        </div>

        {/* Mode Content */}
        {mode === 'ranges' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.875rem', color: '#3c4043' }}>
              {t('split.rangeLabel')}
            </label>
            <input
              type="text"
              data-testid="split-range-input"
              value={rangeInput}
              onChange={(e) => setRangeInput(e.target.value)}
              placeholder={`1-${Math.min(3, totalActivePages)}, ${Math.min(4, totalActivePages)}`}
              style={{
                padding: '8px 12px',
                border: '1px solid #dadce0',
                borderRadius: '4px',
                fontSize: '0.9rem',
              }}
            />
            <span style={{ fontSize: '0.75rem', color: '#70757a' }}>
              {t('split.rangeHelp')}
            </span>
          </div>
        )}

        {mode === 'everyN' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.875rem', color: '#3c4043' }}>
              {t('split.intervalLabel')}
            </label>
            <input
              type="number"
              data-testid="split-n-input"
              min={1}
              max={Math.max(1, totalActivePages)}
              value={everyNInput}
              onChange={(e) => setEveryNInput(parseInt(e.target.value, 10) || 1)}
              style={{
                padding: '8px 12px',
                border: '1px solid #dadce0',
                borderRadius: '4px',
                width: '100px',
                fontSize: '0.9rem',
              }}
            />
          </div>
        )}

        {mode === 'selected' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#3c4043' }}>
              {t('split.selectedSummary', {
                count: selectedActiveIndices.length,
                total: totalActivePages,
              })}
            </p>
            <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="selectedMode"
                  checked={selectedMode === 'individual'}
                  onChange={() => setSelectedMode('individual')}
                />
                <span style={{ fontSize: '0.875rem' }}>{t('split.selectedIndividual')}</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="selectedMode"
                  checked={selectedMode === 'combined'}
                  onChange={() => setSelectedMode('combined')}
                />
                <span style={{ fontSize: '0.875rem' }}>{t('split.selectedCombined')}</span>
              </label>
            </div>
          </div>
        )}

        {/* Validation Error Feedback */}
        {validationResult && !validationResult.success && (
          <div
            data-testid="split-range-error"
            style={{
              padding: '8px 12px',
              backgroundColor: '#fce8e6',
              border: '1px solid #fad2cf',
              borderRadius: '4px',
              color: '#c5221f',
              fontSize: '0.825rem',
            }}
          >
            {locale === 'en'
              ? `${validationResult.error.messageEn} (${validationResult.error.messageTh})`
              : `${validationResult.error.messageTh} (${validationResult.error.messageEn})`}
          </div>
        )}

        {/* Valid Groups Preview */}
        {validationResult && validationResult.success && (
          <div
            data-testid="split-preview"
            style={{
              padding: '8px 12px',
              backgroundColor: '#e6f4ea',
              border: '1px solid #ceead6',
              borderRadius: '4px',
              color: '#137333',
              fontSize: '0.825rem',
            }}
          >
            {validationResult.groups.length === 1
              ? t('split.previewSingle', { filename: validationResult.groups[0]?.name ?? '' })
              : t('split.previewZip', {
                  count: validationResult.groups.length,
                  names: validationResult.groups.map((g) => g.name).join(', '),
                })}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
          <button
            data-testid="cancel-split-btn"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              border: '1px solid #dadce0',
              backgroundColor: '#ffffff',
              borderRadius: '4px',
              cursor: 'pointer',
              color: '#3c4043',
            }}
          >
            {t('split.cancel')}
          </button>
          <button
            data-testid="confirm-split-btn"
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            style={{
              padding: '8px 16px',
              border: 'none',
              backgroundColor: isConfirmDisabled ? '#dadce0' : '#1a73e8',
              color: isConfirmDisabled ? '#80868b' : '#ffffff',
              borderRadius: '4px',
              cursor: isConfirmDisabled ? 'not-allowed' : 'pointer',
              fontWeight: 500,
            }}
          >
            {isProcessing ? t('split.processing') : t('split.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
