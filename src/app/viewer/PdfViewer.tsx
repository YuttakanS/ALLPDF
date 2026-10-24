import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PdfDocument } from '../../engine';
import { PageListModel } from '../../engine/page-model';
import type { PageSize } from '../../shared/protocol';
import {
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  PAGE_GAP,
  VIEWPORT_MARGIN,
  ZOOM_STEP,
} from './constants';
import { PageView } from './PageView';
import { ThumbnailSidebar } from './ThumbnailSidebar';
import { TileCache } from './tile-cache';

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState<number>(initialZoom);
  const [pageSizes, setPageSizes] = useState<PageSize[]>([]);
  const [scrollTop, setScrollTop] = useState<number>(0);
  const [viewportHeight, setViewportHeight] = useState<number>(800);
  const [viewportWidth, setViewportWidth] = useState<number>(1000);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [pageInput, setPageInput] = useState<string>('1');
  const [generation, setGeneration] = useState<number>(1);
  const [tileRenderCount, setTileRenderCount] = useState<number>(0);
  const [showSidebar, setShowSidebar] = useState<boolean>(true);

  // Non-destructive page list model & command manager
  const [pageModel] = useState<PageListModel>(
    () => initialPageModel ?? PageListModel.fromDocument(doc.docId, doc.pageCount)
  );
  const [, setModelVersion] = useState<number>(0);
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const tileCache = useMemo(() => new TileCache(128 * 1024 * 1024), []);
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  // Subscribe to model changes (rotations, deletions, reordering, undo/redo)
  useEffect(() => {
    return pageModel.subscribe(() => {
      setModelVersion((v) => v + 1);
      setGeneration((g) => g + 1);
    });
  }, [pageModel]);

  // Load all base page dimensions on mount
  useEffect(() => {
    let active = true;

    async function loadSizes() {
      const sizes: PageSize[] = [];
      for (let i = 0; i < doc.pageCount; i++) {
        const s = await doc.pageSize(i);
        sizes.push(s);
      }
      if (active) {
        setPageSizes(sizes);
      }
    }

    loadSizes();

    return () => {
      active = false;
      tileCache.clear();
    };
  }, [doc, tileCache]);

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

  // Compute cumulative vertical layout considering rotation dimensions
  const pageLayouts = useMemo(() => {
    let top = 0;
    return activePages.map((entry, index) => {
      const size = pageSizes[entry.sourcePageIndex] || { width: 612, height: 792, rotate: 0 };
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
    if (pageLayouts.length === 0 || !pageLayouts[0]) return;
    const availableWidth = viewportWidth - (showSidebar ? 180 : 0) - 64;
    const targetZoom = availableWidth / (pageLayouts[0].size.width || 612);
    applyZoom(targetZoom);
  }, [pageLayouts, viewportWidth, showSidebar, applyZoom]);

  const fitPage = useCallback(() => {
    if (pageLayouts.length === 0 || !pageLayouts[0]) return;
    const availableHeight = viewportHeight - 64;
    const targetZoom = availableHeight / (pageLayouts[0].size.height || 792);
    applyZoom(targetZoom);
  }, [pageLayouts, viewportHeight, applyZoom]);

  // Jump to page by ID or number
  const scrollToPageId = useCallback(
    (pageId: string) => {
      const target = pageLayouts.find((l) => l.entry.id === pageId);
      if (target && containerRef.current) {
        containerRef.current.scrollTo({ top: target.top, behavior: 'smooth' });
        setCurrentPageId(pageId);
        setPageInput(String(target.index + 1));
      }
    },
    [pageLayouts]
  );

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(pageInput, 10);
    if (!isNaN(num) && num >= 1 && num <= activePages.length) {
      const target = pageLayouts[num - 1];
      if (target) {
        scrollToPageId(target.entry.id);
      }
    } else {
      const currentIdx = activePages.findIndex((p) => p.id === currentPageId);
      setPageInput(String(currentIdx >= 0 ? currentIdx + 1 : 1));
    }
  };

  // Multi-selection management (Click, Ctrl-Click, Shift-Click)
  const handleToggleSelect = useCallback(
    (pageId: string, isShift: boolean, isCtrl: boolean) => {
      setSelectedPageIds((prev) => {
        const next = new Set(prev);

        if (isShift && lastSelectedId) {
          // Range selection between lastSelectedId and pageId
          const startIdx = activePages.findIndex((p) => p.id === lastSelectedId);
          const endIdx = activePages.findIndex((p) => p.id === pageId);
          if (startIdx !== -1 && endIdx !== -1) {
            const min = Math.min(startIdx, endIdx);
            const max = Math.max(startIdx, endIdx);
            for (let i = min; i <= max; i++) {
              const p = activePages[i];
              if (p) next.add(p.id);
            }
          }
        } else if (isCtrl) {
          // Toggle selection
          if (next.has(pageId)) {
            next.delete(pageId);
          } else {
            next.add(pageId);
          }
          setLastSelectedId(pageId);
        } else {
          // Single selection
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

  // Operations handlers
  const handleRotate = useCallback(
    (degrees: 90 | -90 | 180) => {
      const targets = getTargetPageIds();
      pageModel.rotatePages(targets, degrees);
    },
    [pageModel, getTargetPageIds]
  );

  const handleDelete = useCallback(() => {
    const targets = getTargetPageIds();
    pageModel.deletePages(targets);
    setSelectedPageIds(new Set());
  }, [pageModel, getTargetPageIds]);

  const handleMoveUp = useCallback(() => {
    const targets = getTargetPageIds();
    pageModel.movePagesRelative(targets, 'up');
  }, [pageModel, getTargetPageIds]);

  const handleMoveDown = useCallback(() => {
    const targets = getTargetPageIds();
    pageModel.movePagesRelative(targets, 'down');
  }, [pageModel, getTargetPageIds]);

  // Keyboard navigation & operations shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          pageModel.redo();
        } else {
          pageModel.undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        pageModel.redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selectAll();
      } else if (e.key === 'Escape') {
        clearSelection();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedPageIds.size > 0) {
          e.preventDefault();
          handleDelete();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        zoomIn();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        zoomOut();
      } else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        fitWidth();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pageModel, selectedPageIds, selectAll, clearSelection, handleDelete, zoomIn, zoomOut, fitWidth]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: '#f1f3f4',
      }}
    >
      {/* Primary Toolbar: Zoom & Navigation */}
      <div
        data-testid="viewer-toolbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e0e0e0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          zIndex: 10,
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={() => setShowSidebar((s) => !s)}
          data-testid="toggle-sidebar-btn"
          title="Toggle Sidebar"
          style={{
            padding: '4px 8px',
            backgroundColor: showSidebar ? '#e8f0fe' : '#f1f3f4',
            color: showSidebar ? '#1a73e8' : '#3c4043',
            border: '1px solid #dadce0',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          ☰ หน้าตัวอย่าง
        </button>

        <button onClick={zoomOut} data-testid="zoom-out-btn" title="Zoom Out (-)">
          -
        </button>
        <span data-testid="zoom-display" style={{ minWidth: '44px', textAlign: 'center' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button onClick={zoomIn} data-testid="zoom-in-btn" title="Zoom In (+)">
          +
        </button>
        <button onClick={fitWidth} data-testid="fit-width-btn" title="Fit Width (Ctrl+0)">
          พอดีความกว้าง
        </button>
        <button onClick={fitPage} data-testid="fit-page-btn" title="Fit Page">
          พอดีหน้า
        </button>

        {/* Undo / Redo controls */}
        <div style={{ display: 'flex', gap: '4px', marginLeft: '8px', borderLeft: '1px solid #dadce0', paddingLeft: '8px' }}>
          <button
            onClick={() => pageModel.undo()}
            disabled={!pageModel.canUndo}
            data-testid="undo-btn"
            title="Undo (Ctrl+Z)"
            style={{
              padding: '4px 8px',
              cursor: pageModel.canUndo ? 'pointer' : 'not-allowed',
              opacity: pageModel.canUndo ? 1 : 0.5,
            }}
          >
            ↶ ย้อนกลับ (Undo)
          </button>
          <button
            onClick={() => pageModel.redo()}
            disabled={!pageModel.canRedo}
            data-testid="redo-btn"
            title="Redo (Ctrl+Y)"
            style={{
              padding: '4px 8px',
              cursor: pageModel.canRedo ? 'pointer' : 'not-allowed',
              opacity: pageModel.canRedo ? 1 : 0.5,
            }}
          >
            ↷ ทำซ้ำ (Redo)
          </button>
        </div>

        {/* Page Operations Actions */}
        <div style={{ display: 'flex', gap: '4px', marginLeft: '8px', borderLeft: '1px solid #dadce0', paddingLeft: '8px' }}>
          <button onClick={() => handleRotate(90)} data-testid="rotate-cw-btn" title="Rotate 90° Clockwise">
            ↻ หมุนขวา 90°
          </button>
          <button onClick={() => handleRotate(-90)} data-testid="rotate-ccw-btn" title="Rotate 90° Counter-Clockwise">
            ↺ หมุนซ้าย 90°
          </button>
          <button onClick={() => handleRotate(180)} data-testid="rotate-180-btn" title="Rotate 180°">
            180°
          </button>
          <button
            onClick={handleDelete}
            data-testid="delete-page-btn"
            title="Delete Selected Page(s)"
            style={{ color: '#d93025' }}
          >
            🗑 ลบหน้า
          </button>
          <button onClick={handleMoveUp} data-testid="move-up-btn" title="Move Up">
            ↑ เลื่อนขึ้น
          </button>
          <button onClick={handleMoveDown} data-testid="move-down-btn" title="Move Down">
            ↓ เลื่อนลง
          </button>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <form onSubmit={handlePageInputSubmit} style={{ display: 'inline' }}>
            <span>หน้า </span>
            <input
              type="text"
              data-testid="page-number-input"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              style={{ width: '42px', textAlign: 'center' }}
            />
            <span> / {activePages.length}</span>
          </form>
          <span
            data-testid="live-tile-count"
            style={{ fontSize: '0.8rem', color: '#666', marginLeft: '12px' }}
          >
            Rendered tiles: {tileRenderCount} | Cached: {tileCache.size}
          </span>
        </div>
      </div>

      {/* Main Body: Sidebar + Virtualized Page Viewport */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        <ThumbnailSidebar
          doc={doc}
          pageModel={pageModel}
          currentPageId={currentPageId}
          selectedPageIds={selectedPageIds}
          onSelectPage={scrollToPageId}
          onToggleSelect={handleToggleSelect}
          isOpen={showSidebar}
        />

        {/* Virtualized Vertical Page Container */}
        <div
          ref={containerRef}
          data-testid="viewer-container"
          onScroll={handleScroll}
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'auto',
            position: 'relative',
            padding: '24px 0',
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
            {visiblePages.map((layout) => (
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
                  doc={doc}
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
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
