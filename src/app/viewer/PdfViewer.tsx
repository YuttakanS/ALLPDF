import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { PdfDocument } from '../../engine';
import { PageListModel } from '../../engine/page-model';
import { executeSplit, downloadFile, type SplitGroup } from '../../engine/split';
import { saveOrDownloadPdf } from '../../engine/export';
import type { ExportWarning, PageExportSpec, PageSize } from '../../shared/protocol';
import { useI18n } from '../i18n';
import {
  DEFAULT_ZOOM,
  FIT_PAGE_MARGIN,
  FIT_WIDTH_MARGIN,
  MAX_ZOOM,
  MIN_ZOOM,
  PAGE_GAP,
  VIEWPORT_MARGIN,
  ZOOM_STEP,
} from './constants';
import { HelpDialog } from './HelpDialog';
import { PageView } from './PageView';
import { ProgressIndicator } from './ProgressIndicator';
import { SplitDialog } from './SplitDialog';
import { ThumbnailSidebar } from './ThumbnailSidebar';
import { TileCache } from './tile-cache';
import { ToastContainer, type ToastItem } from './ToastContainer';

export interface PdfViewerProps {
  doc: PdfDocument;
  initialZoom?: number;
  initialPageModel?: PageListModel;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  doc,
  initialZoom = DEFAULT_ZOOM,
  initialPageModel,
}) => {
  const { t, locale, toggleLocale } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [zoom, setZoom] = useState<number>(initialZoom);
  const [docs, setDocs] = useState<Map<string, PdfDocument>>(() => new Map([[doc.docId, doc]]));
  const [docMetaMap, setDocMetaMap] = useState<Record<string, { name: string; pageCount: number }>>(() => ({
    [doc.docId]: { name: t('sidebar.primaryDoc'), pageCount: doc.pageCount },
  }));
  const [pageSizes, setPageSizes] = useState<Map<string, PageSize>>(new Map());
  const [scrollTop, setScrollTop] = useState<number>(0);
  const [viewportHeight, setViewportHeight] = useState<number>(800);
  const [viewportWidth, setViewportWidth] = useState<number>(1000);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [pageInput, setPageInput] = useState<string>('1');
  const [generation, setGeneration] = useState<number>(1);
  const [tileRenderCount, setTileRenderCount] = useState<number>(0);
  const [showSidebar, setShowSidebar] = useState<boolean>(true);
  const [showSplitDialog, setShowSplitDialog] = useState<boolean>(false);
  const [showHelpDialog, setShowHelpDialog] = useState<boolean>(false);
  const [exportWarnings, setExportWarnings] = useState<ExportWarning[] | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [busyMessage, setBusyMessage] = useState<string>('');

  // Mobile detection
  const isMobile = viewportWidth <= 768;

  // Auto-collapse sidebar on initial mobile load
  useEffect(() => {
    if (viewportWidth > 0 && viewportWidth <= 768) {
      setShowSidebar(false);
    }
  }, [viewportWidth]);

  // Non-destructive page list model & command manager
  const [pageModel] = useState<PageListModel>(
    () => initialPageModel ?? PageListModel.fromDocument(doc.docId, doc.pageCount)
  );
  const [, setModelVersion] = useState<number>(0);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const tileCache = useMemo(() => new TileCache(128 * 1024 * 1024), []);
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  const showToast = useCallback((message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Subscribe to model changes (rotations, deletions, reordering, undo/redo, merges)
  useEffect(() => {
    return pageModel.subscribe(() => {
      setModelVersion((v) => v + 1);
      setGeneration((g) => g + 1);
    });
  }, [pageModel]);

  // Load dimensions for a specific document
  const loadDocSizes = useCallback(async (targetDoc: PdfDocument) => {
    const loaded = new Map<string, PageSize>();
    for (let i = 0; i < targetDoc.pageCount; i++) {
      const s = await targetDoc.pageSize(i);
      loaded.set(`${targetDoc.docId}:${i}`, s);
    }
    setPageSizes((prev) => {
      const next = new Map(prev);
      for (const [k, v] of loaded.entries()) {
        next.set(k, v);
      }
      return next;
    });
  }, []);

  // Load initial document sizes on mount
  useEffect(() => {
    loadDocSizes(doc);
    return () => {
      tileCache.clear();
    };
  }, [doc, loadDocSizes, tileCache]);

  // Track viewport container dimensions with ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewportHeight(entry.contentRect.height);
        setViewportWidth(entry.contentRect.width);
      }
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const activePages = pageModel.getActivePages();

  // Compute cumulative vertical layout considering mixed page sizes & rotation dimensions
  const pageLayouts = useMemo(() => {
    let top = 0;
    return activePages.map((entry, index) => {
      const sizeKey = `${entry.sourceDocId}:${entry.sourcePageIndex}`;
      const size = pageSizes.get(sizeKey) || { width: 612, height: 792, rotate: 0 };
      const isRotatedQuarter = entry.rotationDelta === 90 || entry.rotationDelta === 270;
      const width = (isRotatedQuarter ? size.height : size.width) * zoom;
      const height = (isRotatedQuarter ? size.width : size.height) * zoom;

      const layout = { index, entry, top, width, height, size };
      top += height + PAGE_GAP;
      return layout;
    });
  }, [activePages, pageSizes, zoom]);

  const totalHeight = useMemo(() => {
    if (pageLayouts.length === 0) return 0;
    const last = pageLayouts[pageLayouts.length - 1];
    return last ? last.top + last.height : 0;
  }, [pageLayouts]);

  // Set initial active page ID
  useEffect(() => {
    if (!currentPageId && activePages[0]) {
      setCurrentPageId(activePages[0].id);
    }
  }, [activePages, currentPageId]);

  // Compute viewport bounds (including 1-viewport margin buffer)
  const marginPx = viewportHeight * VIEWPORT_MARGIN;
  const bufferTop = Math.max(0, scrollTop - marginPx);
  const bufferBottom = scrollTop + viewportHeight + marginPx;

  // Determine virtualized visible pages
  const visiblePages = useMemo(() => {
    return pageLayouts.filter((layout) => {
      const pageBottom = layout.top + layout.height;
      return pageBottom >= bufferTop && layout.top <= bufferBottom;
    });
  }, [pageLayouts, bufferTop, bufferBottom]);

  // Handle scroll and update current active page ID
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const currentScrollTop = container.scrollTop;
    setScrollTop(currentScrollTop);

    // Identify active page near the viewport center
    const center = currentScrollTop + container.clientHeight / 2;
    const active = pageLayouts.find((l) => center >= l.top && center <= l.top + l.height);
    if (active) {
      setCurrentPageId(active.entry.id);
      setPageInput(String(active.index + 1));
    }
  }, [pageLayouts]);

  const applyZoom = useCallback((newZoom: number) => {
    setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(newZoom * 100) / 100)));
    setGeneration((g) => g + 1);
  }, []);

  const zoomIn = useCallback(() => applyZoom(zoom + ZOOM_STEP), [applyZoom, zoom]);
  const zoomOut = useCallback(() => applyZoom(zoom - ZOOM_STEP), [applyZoom, zoom]);

  const fitWidth = useCallback(() => {
    const active = pageLayouts.find((l) => l.entry.id === currentPageId) || pageLayouts[0];
    const width = active ? active.size.width : 612;
    if (width > 0 && viewportWidth > 0) {
      const targetZoom = (viewportWidth - FIT_WIDTH_MARGIN) / width;
      applyZoom(targetZoom);
    }
  }, [pageLayouts, currentPageId, viewportWidth, applyZoom]);

  const fitPage = useCallback(() => {
    const active = pageLayouts.find((l) => l.entry.id === currentPageId) || pageLayouts[0];
    const height = active ? active.size.height : 792;
    if (height > 0 && viewportHeight > 0) {
      const targetZoom = (viewportHeight - FIT_PAGE_MARGIN) / height;
      applyZoom(targetZoom);
    }
  }, [pageLayouts, currentPageId, viewportHeight, applyZoom]);

  // Scroll main viewport to target page entry ID
  const scrollToPageId = useCallback(
    (pageId: string) => {
      const layout = pageLayouts.find((l) => l.entry.id === pageId);
      if (layout && containerRef.current) {
        containerRef.current.scrollTo({ top: layout.top, behavior: 'smooth' });
        setCurrentPageId(pageId);
        setPageInput(String(layout.index + 1));
      }
    },
    [pageLayouts]
  );

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(pageInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= activePages.length) {
      const targetEntry = activePages[pageNum - 1];
      if (targetEntry) {
        scrollToPageId(targetEntry.id);
      }
    } else {
      const currentIdx = activePages.findIndex((p) => p.id === currentPageId);
      setPageInput(String(currentIdx >= 0 ? currentIdx + 1 : 1));
    }
  };

  // Multi-selection handlers
  const handleToggleSelect = useCallback(
    (pageId: string, isShift: boolean, isCtrl: boolean) => {
      setSelectedPageIds((prev) => {
        const next = new Set(prev);

        if (isShift && lastSelectedId) {
          const fromIdx = activePages.findIndex((p) => p.id === lastSelectedId);
          const toIdx = activePages.findIndex((p) => p.id === pageId);
          if (fromIdx !== -1 && toIdx !== -1) {
            const min = Math.min(fromIdx, toIdx);
            const max = Math.max(fromIdx, toIdx);
            for (let i = min; i <= max; i++) {
              const p = activePages[i];
              if (p) next.add(p.id);
            }
          }
        } else if (isCtrl) {
          if (next.has(pageId)) {
            next.delete(pageId);
          } else {
            next.add(pageId);
          }
          setLastSelectedId(pageId);
        } else {
          next.clear();
          next.add(pageId);
          setLastSelectedId(pageId);
        }

        return next;
      });
    },
    [activePages, lastSelectedId]
  );

  const selectAll = useCallback(() => {
    setSelectedPageIds(new Set(activePages.map((p) => p.id)));
  }, [activePages]);

  const clearSelection = useCallback(() => {
    setSelectedPageIds(new Set());
  }, []);

  const getTargetPageIds = useCallback(() => {
    if (selectedPageIds.size > 0) {
      return Array.from(selectedPageIds);
    }
    return currentPageId ? [currentPageId] : [];
  }, [selectedPageIds, currentPageId]);

  // Page Operations handlers
  const handleRotate = useCallback(
    (degrees: 90 | -90 | 180) => {
      const targets = getTargetPageIds();
      pageModel.rotatePages(targets, degrees);
      showToast(t('toast.rotateSuccess'), 'success');
    },
    [pageModel, getTargetPageIds, showToast, t]
  );

  const handleDelete = useCallback(() => {
    const targets = getTargetPageIds();
    pageModel.deletePages(targets);
    setSelectedPageIds(new Set());
    showToast(t('toast.deleteSuccess'), 'info');
  }, [pageModel, getTargetPageIds, showToast, t]);

  const handleMoveUp = useCallback(() => {
    const targets = getTargetPageIds();
    pageModel.movePagesRelative(targets, 'up');
    showToast(t('toast.moveSuccess'), 'info');
  }, [pageModel, getTargetPageIds, showToast, t]);

  const handleMoveDown = useCallback(() => {
    const targets = getTargetPageIds();
    pageModel.movePagesRelative(targets, 'down');
    showToast(t('toast.moveSuccess'), 'info');
  }, [pageModel, getTargetPageIds, showToast, t]);

  // File Merge Handlers
  const handleAddFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      setIsBusy(true);
      setBusyMessage(t('progress.loading'));
      try {
        for (const file of list) {
          if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
            continue;
          }
          const buffer = await file.arrayBuffer();
          const newDoc = await (doc.constructor as typeof PdfDocument).open(buffer, {
            client: doc.client,
          });

          setDocs((prev) => new Map(prev).set(newDoc.docId, newDoc));
          setDocMetaMap((prev) => ({
            ...prev,
            [newDoc.docId]: { name: file.name, pageCount: newDoc.pageCount },
          }));

          await loadDocSizes(newDoc);
          pageModel.addDocumentPages(newDoc.docId, newDoc.pageCount);
          showToast(t('toast.mergeSuccess', { count: newDoc.pageCount }), 'success');
        }
      } catch (err) {
        console.error('Failed to open PDF for merge:', err);
      } finally {
        setIsBusy(false);
      }
    },
    [doc, loadDocSizes, pageModel, showToast, t]
  );

  const handleRemoveDoc = useCallback(
    (targetDocId: string) => {
      pageModel.removeDocument(targetDocId);
      showToast(t('toast.removeDocSuccess'), 'info');
    },
    [pageModel, showToast, t]
  );

  // Split Handler
  const handleExecuteSplit = useCallback(
    async (groups: SplitGroup[]) => {
      setIsBusy(true);
      setBusyMessage(t('progress.loading'));
      try {
        const active = pageModel.getActivePages();
        const output = await executeSplit(
          active,
          groups,
          (specs) => doc.client.exportPages(specs),
          'split_document'
        );
        downloadFile(output);
        showToast(t('toast.splitSuccess'), 'success');
      } finally {
        setIsBusy(false);
      }
    },
    [doc.client, pageModel, showToast, t]
  );

  const handleExport = useCallback(async () => {
    const active = pageModel.getActivePages();
    if (active.length === 0) return;

    setIsBusy(true);
    setBusyMessage(t('progress.loading'));

    const specs: PageExportSpec[] = active.map((p) => ({
      sourceDocId: p.sourceDocId,
      sourcePageIndex: p.sourcePageIndex,
      rotationDelta: p.rotationDelta,
    }));

    try {
      const result = await doc.client.exportPages(specs);
      if (result.warnings && result.warnings.length > 0) {
        setExportWarnings(result.warnings);
      } else {
        setExportWarnings(null);
      }
      await saveOrDownloadPdf(result.buffer, 'เอกสาร_ส่งออก.pdf');
      showToast(t('toast.exportSuccess'), 'success');
    } catch (err) {
      console.error('Failed to export PDF:', err);
    } finally {
      setIsBusy(false);
    }
  }, [doc.client, pageModel, showToast, t]);

  const selectedActiveIndices = useMemo(() => {
    const active = pageModel.getActivePages();
    const indices: number[] = [];
    active.forEach((p, idx) => {
      if (selectedPageIds.has(p.id)) indices.push(idx);
    });
    return indices;
  }, [pageModel, selectedPageIds]);

  // Drag and drop onto container for Merge
  const handleContainerDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleContainerDrop = (e: React.DragEvent) => {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      e.preventDefault();
      handleAddFiles(e.dataTransfer.files);
    }
  };

  // Touch Pinch-to-Zoom handling on viewport container
  const touchDistanceRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && e.touches[0] && e.touches[1]) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchDistanceRef.current = Math.hypot(dx, dy);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && e.touches[0] && e.touches[1] && touchDistanceRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDistance = Math.hypot(dx, dy);
      const ratio = newDistance / touchDistanceRef.current;
      if (Math.abs(ratio - 1) > 0.05) {
        applyZoom(zoom * ratio);
        touchDistanceRef.current = newDistance;
      }
    }
  };

  const handleTouchEnd = () => {
    touchDistanceRef.current = null;
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'F1' || (e.key === '?' && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault();
        setShowHelpDialog((prev) => !prev);
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          if (pageModel.undo()) showToast(t('toast.undoSuccess'), 'info');
        } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          if (pageModel.redo()) showToast(t('toast.redoSuccess'), 'info');
        } else if (e.key === 'a') {
          e.preventDefault();
          selectAll();
        } else if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          zoomIn();
        } else if (e.key === '-') {
          e.preventDefault();
          zoomOut();
        } else if (e.key === '0') {
          e.preventDefault();
          fitWidth();
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'Escape') {
        clearSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pageModel, zoomIn, zoomOut, fitWidth, handleDelete, selectAll, clearSelection, showToast, t]);

  return (
    <div
      data-testid="pdf-viewer"
      onDragOver={handleContainerDragOver}
      onDrop={handleContainerDrop}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100vh',
        backgroundColor: '#f1f3f4',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Progress Indicator for long operations */}
      <ProgressIndicator isLoading={isBusy} message={busyMessage} />

      {/* Help Dialog Modal */}
      <HelpDialog isOpen={showHelpDialog} onClose={() => setShowHelpDialog(false)} />

      {/* Hidden File Input for Merge */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,application/pdf"
        data-testid="file-merge-input"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files) {
            handleAddFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {/* Split Modal Dialog */}
      <SplitDialog
        isOpen={showSplitDialog}
        onClose={() => setShowSplitDialog(false)}
        totalActivePages={activePages.length}
        selectedActiveIndices={selectedActiveIndices}
        onExecuteSplit={handleExecuteSplit}
      />

      {/* Top Application Toolbar */}
      <header
        data-testid="viewer-toolbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #dadce0',
          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          zIndex: 10,
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={() => setShowSidebar((s) => !s)}
          data-testid="toggle-sidebar-btn"
          title={t('toolbar.toggleSidebar')}
          style={{
            padding: '4px 8px',
            backgroundColor: showSidebar ? '#e8f0fe' : '#f1f3f4',
            color: showSidebar ? '#1a73e8' : '#3c4043',
            border: '1px solid #dadce0',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          ☰ {t('toolbar.toggleSidebar')}
        </button>

        {/* Zoom controls */}
        <button onClick={zoomOut} data-testid="zoom-out-btn" title={t('toolbar.zoomOut')}>
          -
        </button>
        <span data-testid="zoom-display" style={{ minWidth: '44px', textAlign: 'center' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button onClick={zoomIn} data-testid="zoom-in-btn" title={t('toolbar.zoomIn')}>
          +
        </button>
        <button onClick={fitWidth} data-testid="fit-width-btn" title={t('toolbar.fitWidth')}>
          {t('toolbar.fitWidth')}
        </button>
        <button onClick={fitPage} data-testid="fit-page-btn" title={t('toolbar.fitPage')}>
          {t('toolbar.fitPage')}
        </button>

        {/* Undo / Redo controls */}
        <div style={{ display: 'flex', gap: '4px', marginLeft: '6px', borderLeft: '1px solid #dadce0', paddingLeft: '6px' }}>
          <button
            onClick={() => {
              if (pageModel.undo()) showToast(t('toast.undoSuccess'), 'info');
            }}
            disabled={!pageModel.canUndo}
            data-testid="undo-btn"
            title={t('toolbar.undo')}
            style={{
              padding: '4px 8px',
              cursor: pageModel.canUndo ? 'pointer' : 'not-allowed',
              opacity: pageModel.canUndo ? 1 : 0.5,
            }}
          >
            ↶ {t('toolbar.undo')}
          </button>
          <button
            onClick={() => {
              if (pageModel.redo()) showToast(t('toast.redoSuccess'), 'info');
            }}
            disabled={!pageModel.canRedo}
            data-testid="redo-btn"
            title={t('toolbar.redo')}
            style={{
              padding: '4px 8px',
              cursor: pageModel.canRedo ? 'pointer' : 'not-allowed',
              opacity: pageModel.canRedo ? 1 : 0.5,
            }}
          >
            ↷ {t('toolbar.redo')}
          </button>
        </div>

        {/* Page Operations Actions */}
        <div style={{ display: 'flex', gap: '4px', marginLeft: '6px', borderLeft: '1px solid #dadce0', paddingLeft: '6px' }}>
          <button onClick={() => handleRotate(90)} data-testid="rotate-cw-btn" title={t('toolbar.rotateCw')}>
            ↻ 90°
          </button>
          <button onClick={() => handleRotate(-90)} data-testid="rotate-ccw-btn" title={t('toolbar.rotateCcw')}>
            ↺ -90°
          </button>
          <button onClick={() => handleRotate(180)} data-testid="rotate-180-btn" title={t('toolbar.rotate180')}>
            180°
          </button>
          <button
            onClick={handleDelete}
            data-testid="delete-page-btn"
            title={t('toolbar.delete')}
            style={{ color: '#d93025' }}
          >
            🗑 {t('toolbar.delete')}
          </button>
          <button onClick={handleMoveUp} data-testid="move-up-btn" title={t('toolbar.moveUp')}>
            ↑ {t('toolbar.moveUp')}
          </button>
          <button onClick={handleMoveDown} data-testid="move-down-btn" title={t('toolbar.moveDown')}>
            ↓ {t('toolbar.moveDown')}
          </button>
        </div>

        {/* Merge, Split and Export Actions */}
        <div style={{ display: 'flex', gap: '4px', marginLeft: '6px', borderLeft: '1px solid #dadce0', paddingLeft: '6px' }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            data-testid="merge-file-btn"
            title={t('toolbar.merge')}
            style={{
              padding: '4px 8px',
              backgroundColor: '#e8f0fe',
              color: '#1a73e8',
              border: '1px solid #c2e7ff',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            ➕ {t('toolbar.merge')}
          </button>
          <button
            onClick={() => setShowSplitDialog(true)}
            data-testid="open-split-btn"
            title={t('toolbar.split')}
            style={{
              padding: '4px 8px',
              backgroundColor: '#fef7e0',
              color: '#b06000',
              border: '1px solid #fce8b2',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            ✂ {t('toolbar.split')}
          </button>
          <button
            onClick={handleExport}
            data-testid="export-pdf-btn"
            title={t('toolbar.export')}
            style={{
              padding: '4px 8px',
              backgroundColor: '#188038',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            💾 {t('toolbar.export')}
          </button>
        </div>

        {/* Utilities: Help & Language Switcher */}
        <div style={{ display: 'flex', gap: '4px', marginLeft: '6px', borderLeft: '1px solid #dadce0', paddingLeft: '6px' }}>
          <button
            onClick={() => setShowHelpDialog(true)}
            data-testid="help-btn"
            title={t('toolbar.help')}
            style={{
              padding: '4px 8px',
              backgroundColor: '#f1f3f4',
              color: '#3c4043',
              border: '1px solid #dadce0',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            ? {t('toolbar.help')}
          </button>
          <button
            onClick={toggleLocale}
            data-testid="language-toggle-btn"
            title={t('toolbar.language')}
            style={{
              padding: '4px 8px',
              backgroundColor: '#ffffff',
              color: '#1a73e8',
              border: '1px solid #1a73e8',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            🌐 {locale.toUpperCase()}
          </button>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <form onSubmit={handlePageInputSubmit} style={{ display: 'inline' }}>
            <span>{t('toolbar.page')} </span>
            <input
              type="text"
              data-testid="page-number-input"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              style={{ width: '42px', textAlign: 'center' }}
            />
            <span> {t('toolbar.of')} {activePages.length}</span>
          </form>
          <span
            data-testid="live-tile-count"
            style={{ fontSize: '0.8rem', color: '#666', marginLeft: '12px' }}
          >
            {t('toolbar.renderedTiles')}: {tileRenderCount} | {t('toolbar.cached')}: {tileCache.size}
          </span>
        </div>
      </header>

      {/* Export Warnings Banner */}
      {exportWarnings && (
        <div
          data-testid="export-warnings-banner"
          style={{
            backgroundColor: '#fef7e0',
            borderBottom: '1px solid #fce8b2',
            color: '#b06000',
            padding: '6px 16px',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 9,
          }}
        >
          <span>
            {t('warning.prefix')}{' '}
            {exportWarnings
              .map((w) => (locale === 'en' ? w.messageEn : `${w.messageTh} (${w.messageEn})`))
              .join(' | ')}
          </span>
          <button
            onClick={() => setExportWarnings(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#b06000',
              fontWeight: 600,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Body: Sidebar + Virtualized Page Viewport */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Desktop Sidebar OR Mobile Bottom Sheet */}
        {isMobile ? (
          showSidebar && (
            <div
              data-testid="mobile-bottom-sheet"
              style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                height: '50vh',
                backgroundColor: '#ffffff',
                borderTop: '2px solid #dadce0',
                boxShadow: '0 -4px 16px rgba(0,0,0,0.2)',
                zIndex: 500,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  borderBottom: '1px solid #e0e0e0',
                  backgroundColor: '#f8f9fa',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{t('toolbar.toggleSidebar')}</span>
                <button
                  data-testid="close-mobile-sheet-btn"
                  onClick={() => setShowSidebar(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}
                >
                  ✕
                </button>
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <ThumbnailSidebar
                  doc={doc}
                  docs={docs}
                  docMetaMap={docMetaMap}
                  pageModel={pageModel}
                  currentPageId={currentPageId}
                  selectedPageIds={selectedPageIds}
                  onSelectPage={(id) => {
                    scrollToPageId(id);
                    setShowSidebar(false);
                  }}
                  onToggleSelect={handleToggleSelect}
                  onRemoveDoc={handleRemoveDoc}
                  isOpen={true}
                />
              </div>
            </div>
          )
        ) : (
          <ThumbnailSidebar
            doc={doc}
            docs={docs}
            docMetaMap={docMetaMap}
            pageModel={pageModel}
            currentPageId={currentPageId}
            selectedPageIds={selectedPageIds}
            onSelectPage={scrollToPageId}
            onToggleSelect={handleToggleSelect}
            onRemoveDoc={handleRemoveDoc}
            isOpen={showSidebar}
          />
        )}

        {/* Virtualized Vertical Page Container with Touch Pinch-to-Zoom */}
        <main
          ref={containerRef}
          data-testid="viewer-container"
          onScroll={handleScroll}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'auto',
            position: 'relative',
            padding: '24px 0',
            touchAction: 'pan-x pan-y',
          }}
        >
          {/* Full scroll height spacer */}
          <div
            style={{
              height: `${totalHeight}px`,
              position: 'relative',
              width: '100%',
            }}
          >
            {visiblePages.map((layout) => {
              const pageDoc = docs.get(layout.entry.sourceDocId) || doc;
              return (
                <div
                  key={layout.entry.id}
                  style={{
                    position: 'absolute',
                    top: `${layout.top}px`,
                    left: '50%',
                    transform: 'translateX(-50%)',
                  }}
                >
                  <PageView
                    doc={pageDoc}
                    pageEntry={layout.entry}
                    pageSize={layout.size}
                    scale={zoom}
                    dpr={dpr}
                    generation={generation}
                    tileCache={tileCache}
                    viewportTop={bufferTop}
                    viewportBottom={bufferBottom}
                    pageTop={layout.top}
                    onTileRendered={() => setTileRenderCount((c) => c + 1)}
                  />
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
};
