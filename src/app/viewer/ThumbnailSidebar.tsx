import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { PdfDocument } from '../../engine';

export const THUMBNAIL_ITEM_HEIGHT = 170; // 140px canvas + 20px label + 10px padding
export const THUMBNAIL_WIDTH = 120;
export const THUMBNAIL_HEIGHT = 140;

export interface ThumbnailSidebarProps {
  doc: PdfDocument;
  pageCount: number;
  currentPage: number;
  onSelectPage: (pageNumber: number) => void;
  isOpen?: boolean;
}

const thumbnailCache = new Map<string, ImageBitmap>();

interface ThumbnailItemProps {
  doc: PdfDocument;
  pageIndex: number;
  isActive: boolean;
  onClick: () => void;
}

const ThumbnailItem: React.FC<ThumbnailItemProps> = ({ doc, pageIndex, isActive, onClick }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isSubscribed = true;
    const cacheKey = `${doc.docId}_thumb_${pageIndex}`;
    const cached = thumbnailCache.get(cacheKey);

    if (cached) {
      canvas.width = cached.width;
      canvas.height = cached.height;
      ctx.drawImage(cached, 0, 0);
    } else {
      // Clear with placeholder color
      ctx.fillStyle = '#e8eaed';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Schedule at low priority using requestIdleCallback / setTimeout
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
          .renderThumbnail(pageIndex, THUMBNAIL_HEIGHT)
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
          .catch(() => {
            // Ignore cancelled render
          });
      });

      return () => {
        isSubscribed = false;
        cancelTask(handle as number);
      };
    }

    return () => {
      isSubscribed = false;
    };
  }, [doc, pageIndex]);

  return (
    <div
      data-testid="thumbnail-item"
      data-page-index={pageIndex}
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '8px',
        cursor: 'pointer',
        boxSizing: 'border-box',
        height: `${THUMBNAIL_ITEM_HEIGHT}px`,
      }}
    >
      <div
        style={{
          border: isActive ? '2px solid #1a73e8' : '1px solid #dadce0',
          borderRadius: '4px',
          overflow: 'hidden',
          backgroundColor: '#ffffff',
          boxShadow: isActive ? '0 0 0 2px rgba(26,115,232,0.3)' : '0 1px 3px rgba(0,0,0,0.1)',
          transition: 'all 0.15s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
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
          }}
        />
      </div>
      <span
        style={{
          marginTop: '6px',
          fontSize: '0.75rem',
          fontWeight: isActive ? 600 : 400,
          color: isActive ? '#1a73e8' : '#5f6368',
        }}
      >
        หน้า {pageIndex + 1}
      </span>
    </div>
  );
};

export const ThumbnailSidebar: React.FC<ThumbnailSidebarProps> = ({
  doc,
  pageCount,
  currentPage,
  onSelectPage,
  isOpen = true,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(800);

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

  if (!isOpen) return null;

  const totalHeight = pageCount * THUMBNAIL_ITEM_HEIGHT;

  // Virtualization bounds: compute visible range + 2 buffer items above and below
  const startIndex = Math.max(0, Math.floor(scrollTop / THUMBNAIL_ITEM_HEIGHT) - 2);
  const endIndex = Math.min(
    pageCount - 1,
    Math.ceil((scrollTop + viewportHeight) / THUMBNAIL_ITEM_HEIGHT) + 2
  );

  const visibleItems = [];
  for (let i = startIndex; i <= endIndex; i++) {
    visibleItems.push(i);
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
        }}
      >
        หน้าเอกสาร (Thumbnails)
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
          {visibleItems.map((pageIndex) => (
            <div
              key={pageIndex}
              style={{
                position: 'absolute',
                top: `${pageIndex * THUMBNAIL_ITEM_HEIGHT}px`,
                left: 0,
                right: 0,
              }}
            >
              <ThumbnailItem
                doc={doc}
                pageIndex={pageIndex}
                isActive={pageIndex + 1 === currentPage}
                onClick={() => onSelectPage(pageIndex + 1)}
              />
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};
