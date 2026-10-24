import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { PdfDocument } from '../../engine';
import type { PageEntry, PageListModel } from '../../engine/page-model';

export const THUMBNAIL_ITEM_HEIGHT = 170;
export const THUMBNAIL_WIDTH = 120;
export const THUMBNAIL_HEIGHT = 140;

export interface ThumbnailSidebarProps {
  doc: PdfDocument;
  pageModel: PageListModel;
  currentPageId: string | null;
  selectedPageIds: Set<string>;
  onSelectPage: (pageId: string) => void;
  onToggleSelect: (pageId: string, isShift: boolean, isCtrl: boolean) => void;
  isOpen?: boolean;
}

const thumbnailCache = new Map<string, ImageBitmap>();

interface ThumbnailItemProps {
  doc: PdfDocument;
  entry: PageEntry;
  displayIndex: number;
  isActive: boolean;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
}

const ThumbnailItem: React.FC<ThumbnailItemProps> = ({
  doc,
  entry,
  displayIndex,
  isActive,
  isSelected,
  onClick,
  onDragStart,
  onDragOver,
  onDrop,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isSubscribed = true;
    const cacheKey = `${doc.docId}_thumb_${entry.sourcePageIndex}`;
    const cached = thumbnailCache.get(cacheKey);

    if (cached) {
      canvas.width = cached.width;
      canvas.height = cached.height;
      ctx.drawImage(cached, 0, 0);
    } else {
      ctx.fillStyle = '#e8eaed';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const scheduleTask =
        typeof window !== 'undefined' && 'requestIdleCallback' in window
          ? window.requestIdleCallback
          : (cb: () => void) => setTimeout(cb, 40);

      const cancelTask =
        typeof window !== 'undefined' && 'cancelIdleCallback' in window
          ? window.cancelIdleCallback
          : clearTimeout;

      const handle = scheduleTask(() => {
        if (!isSubscribed) return;

        doc
          .renderThumbnail(entry.sourcePageIndex, THUMBNAIL_HEIGHT)
          .then((res) => {
            if (!isSubscribed) {
              if (res.bitmap) res.bitmap.close();
              return;
            }

            if (res.bitmap) {
              thumbnailCache.set(cacheKey, res.bitmap);
              canvas.width = res.bitmap.width;
              canvas.height = res.bitmap.height;
              ctx.drawImage(res.bitmap, 0, 0);
            }
          })
          .catch(() => {});
      });

      return () => {
        isSubscribed = false;
        cancelTask(handle as number);
      };
    }

    return () => {
      isSubscribed = false;
    };
  }, [doc, entry.sourcePageIndex]);

  return (
    <div
      data-testid="thumbnail-item"
      data-page-id={entry.id}
      data-page-index={displayIndex}
      draggable
      onDragStart={(e) => onDragStart(e, entry.id)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, entry.id)}
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '8px',
        cursor: 'grab',
        boxSizing: 'border-box',
        height: `${THUMBNAIL_ITEM_HEIGHT}px`,
        backgroundColor: isSelected ? '#e8f0fe' : 'transparent',
        borderRadius: '4px',
        position: 'relative',
      }}
    >
      <div
        style={{
          border:
            isSelected || isActive
              ? '2px solid #1a73e8'
              : '1px solid #dadce0',
          borderRadius: '4px',
          overflow: 'hidden',
          backgroundColor: '#ffffff',
          boxShadow: isSelected || isActive ? '0 0 0 2px rgba(26,115,232,0.3)' : '0 1px 3px rgba(0,0,0,0.1)',
          transition: 'all 0.15s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: `${THUMBNAIL_WIDTH}px`,
          height: `${THUMBNAIL_HEIGHT}px`,
        }}
      >
        <canvas
          ref={canvasRef}
          width={THUMBNAIL_WIDTH}
          height={THUMBNAIL_HEIGHT}
          style={{
            maxWidth: `${THUMBNAIL_WIDTH}px`,
            maxHeight: `${THUMBNAIL_HEIGHT}px`,
            display: 'block',
            transform: entry.rotationDelta ? `rotate(${entry.rotationDelta}deg)` : undefined,
            transition: 'transform 0.2s ease',
          }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}} // Handled by parent div onClick
          style={{ cursor: 'pointer' }}
        />
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: isActive || isSelected ? 600 : 400,
            color: isSelected ? '#1a73e8' : '#5f6368',
          }}
        >
          หน้า {displayIndex + 1}
        </span>
      </div>
    </div>
  );
};

export const ThumbnailSidebar: React.FC<ThumbnailSidebarProps> = ({
  doc,
  pageModel,
  currentPageId,
  selectedPageIds,
  onSelectPage,
  onToggleSelect,
  isOpen = true,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(800);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const activePages = pageModel.getActivePages();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setViewportHeight(entry.contentRect.height);
      }
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }, []);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = draggedId || e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetId) return;

    // If multiple pages are selected and dragged, move all selected
    const pagesToMove = selectedPageIds.has(sourceId) ? Array.from(selectedPageIds) : [sourceId];
    pageModel.movePages(pagesToMove, targetId, 'before');
    setDraggedId(null);
  };

  if (!isOpen) return null;

  const totalHeight = activePages.length * THUMBNAIL_ITEM_HEIGHT;

  // Virtualization bounds
  const startIndex = Math.max(0, Math.floor(scrollTop / THUMBNAIL_ITEM_HEIGHT) - 2);
  const endIndex = Math.min(
    activePages.length - 1,
    Math.ceil((scrollTop + viewportHeight) / THUMBNAIL_ITEM_HEIGHT) + 2
  );

  const visibleItems = [];
  for (let i = startIndex; i <= endIndex; i++) {
    const item = activePages[i];
    if (item) {
      visibleItems.push({ entry: item, displayIndex: i });
    }
  }

  return (
    <aside
      data-testid="thumbnail-sidebar"
      style={{
        width: '180px',
        height: '100%',
        backgroundColor: '#f8f9fa',
        borderRight: '1px solid #e0e0e0',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #e0e0e0',
          fontWeight: 600,
          fontSize: '0.85rem',
          color: '#3c4043',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>หน้า ({activePages.length})</span>
        <span style={{ fontSize: '0.75rem', color: '#70757a' }}>
          {selectedPageIds.size > 0 ? `เลือก ${selectedPageIds.size}` : ''}
        </span>
      </div>

      <div
        ref={containerRef}
        data-testid="thumbnail-container"
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          position: 'relative',
        }}
      >
        <div style={{ height: `${totalHeight}px`, position: 'relative', width: '100%' }}>
          {visibleItems.map(({ entry, displayIndex }) => (
            <div
              key={entry.id}
              style={{
                position: 'absolute',
                top: `${displayIndex * THUMBNAIL_ITEM_HEIGHT}px`,
                left: 0,
                right: 0,
              }}
            >
              <ThumbnailItem
                doc={doc}
                entry={entry}
                displayIndex={displayIndex}
                isActive={entry.id === currentPageId}
                isSelected={selectedPageIds.has(entry.id)}
                onClick={(e) => {
                  onToggleSelect(entry.id, e.shiftKey, e.ctrlKey || e.metaKey);
                  onSelectPage(entry.id);
                }}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              />
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};
