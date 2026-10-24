import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PdfDocument } from '../../engine';
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
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ doc, initialZoom = DEFAULT_ZOOM }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState<number>(initialZoom);
  const [pageSizes, setPageSizes] = useState<PageSize[]>([]);
  const [scrollTop, setScrollTop] = useState<number>(0);
  const [viewportHeight, setViewportHeight] = useState<number>(800);
  const [viewportWidth, setViewportWidth] = useState<number>(1000);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageInput, setPageInput] = useState<string>('1');
  const [generation, setGeneration] = useState<number>(1);
  const [tileRenderCount, setTileRenderCount] = useState<number>(0);
  const [showSidebar, setShowSidebar] = useState<boolean>(true);

  const tileCache = useMemo(() => new TileCache(128 * 1024 * 1024), []);
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

  // Load all page dimensions on mount
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

  // Compute cumulative vertical layout
  const pageLayouts = useMemo(() => {
    let top = 0;
    return pageSizes.map((size, index) => {
      const width = size.width * zoom;
      const height = size.height * zoom;
      const layout = { index, top, width, height, size };
      top += height + PAGE_GAP;
      return layout;
    });
  }, [pageSizes, zoom]);

  const totalHeight = useMemo(() => {
    if (pageLayouts.length === 0) return 0;
    const last = pageLayouts[pageLayouts.length - 1];
    return last ? last.top + last.height : 0;
  }, [pageLayouts]);

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

  // Handle scroll and update current active page index
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const currentScrollTop = container.scrollTop;
    setScrollTop(currentScrollTop);

    // Identify active page near the viewport center
    const center = currentScrollTop + container.clientHeight / 2;
    const active = pageLayouts.find((l) => center >= l.top && center <= l.top + l.height);
    if (active) {
      const pageNum = active.index + 1;
      setCurrentPage(pageNum);
      setPageInput(String(pageNum));
    }
  }, [pageLayouts]);

  // Invalidate render generation on zoom change
  const applyZoom = useCallback((newZoom: number) => {
    setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(newZoom * 100) / 100)));
    setGeneration((g) => g + 1);
  }, []);

  const zoomIn = useCallback(() => applyZoom(zoom + ZOOM_STEP), [applyZoom, zoom]);
  const zoomOut = useCallback(() => applyZoom(zoom - ZOOM_STEP), [applyZoom, zoom]);

  const fitWidth = useCallback(() => {
    if (pageSizes.length === 0 || !pageSizes[0]) return;
    const availableWidth = viewportWidth - (showSidebar ? 180 : 0) - 64; // account for sidebar & padding
    const targetZoom = availableWidth / pageSizes[0].width;
    applyZoom(targetZoom);
  }, [pageSizes, viewportWidth, showSidebar, applyZoom]);

  const fitPage = useCallback(() => {
    if (pageSizes.length === 0 || !pageSizes[0]) return;
    const availableHeight = viewportHeight - 64;
    const targetZoom = availableHeight / pageSizes[0].height;
    applyZoom(targetZoom);
  }, [pageSizes, viewportHeight, applyZoom]);

  // Jump to page
  const scrollToPage = useCallback(
    (pageNumber: number) => {
      const target = pageLayouts[pageNumber - 1];
      if (target && containerRef.current) {
        containerRef.current.scrollTo({ top: target.top, behavior: 'smooth' });
      }
    },
    [pageLayouts]
  );

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(pageInput, 10);
    if (!isNaN(num) && num >= 1 && num <= doc.pageCount) {
      scrollToPage(num);
    } else {
      setPageInput(String(currentPage));
    }
  };

  // Keyboard navigation & zoom shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
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
  }, [zoomIn, zoomOut, fitWidth]);

  // Pinch / Wheel zoom with ctrlKey
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.005;
        applyZoom(zoom + delta);
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [zoom, applyZoom]);

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
      {/* Viewer Toolbar */}
      <div
        data-testid="viewer-toolbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '8px 16px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e0e0e0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          zIndex: 10,
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
        <span data-testid="zoom-display" style={{ minWidth: '48px', textAlign: 'center' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button onClick={zoomIn} data-testid="zoom-in-btn" title="Zoom In (+)">
          +
        </button>
        <button onClick={fitWidth} data-testid="fit-width-btn" title="Fit Width (Ctrl+0)">
          พอดีความกว้าง (Fit Width)
        </button>
        <button onClick={fitPage} data-testid="fit-page-btn" title="Fit Page">
          พอดีหน้า (Fit Page)
        </button>

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
            <span> / {doc.pageCount}</span>
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
          pageCount={doc.pageCount}
          currentPage={currentPage}
          onSelectPage={scrollToPage}
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
                key={layout.index}
                style={{
                  position: 'absolute',
                  top: `${layout.top}px`,
                  left: '50%',
                  transform: 'translateX(-50%)',
                }}
              >
                <PageView
                  doc={doc}
                  pageIndex={layout.index}
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
