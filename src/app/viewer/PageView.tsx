import React, { useEffect, useRef } from 'react';
import type { PdfDocument } from '../../engine';
import type { PageSize } from '../../shared/protocol';
import { TILE_SIZE } from './constants';
import type { TileCache } from './tile-cache';

export interface PageViewProps {
  doc: PdfDocument;
  pageIndex: number;
  pageSize: PageSize;
  scale: number;
  dpr: number;
  generation: number;
  tileCache: TileCache;
  viewportTop: number;
  viewportBottom: number;
  pageTop: number;
  onTileRendered?: () => void;
}

export const PageView: React.FC<PageViewProps> = ({
  doc,
  pageIndex,
  pageSize,
  scale,
  dpr,
  generation,
  tileCache,
  viewportTop,
  viewportBottom,
  pageTop,
  onTileRendered,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const scaledW = Math.round(pageSize.width * scale);
  const scaledH = Math.round(pageSize.height * scale);

  const canvasW = Math.round(scaledW * dpr);
  const canvasH = Math.round(scaledH * dpr);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let isSubscribed = true;
    const effectiveScale = scale * dpr;

    // Fill white background initially
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const cols = Math.ceil(canvasW / TILE_SIZE);
    const rows = Math.ceil(canvasH / TILE_SIZE);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const destX = c * TILE_SIZE;
        const destY = r * TILE_SIZE;
        const curTileW = Math.min(TILE_SIZE, canvasW - destX);
        const curTileH = Math.min(TILE_SIZE, canvasH - destY);

        // Convert tile viewport bounds to container CSS space
        const tileTopCss = pageTop + destY / dpr;
        const tileBottomCss = pageTop + (destY + curTileH) / dpr;

        // Skip tiles outside the active viewport window
        if (tileBottomCss < viewportTop || tileTopCss > viewportBottom) {
          continue;
        }

        const cacheKey = `${doc.docId}_p${pageIndex}_c${c}_r${r}_s${effectiveScale.toFixed(2)}`;
        const cached = tileCache.get(cacheKey);

        if (cached) {
          ctx.drawImage(cached, destX, destY, curTileW, curTileH);
        } else {
          // Convert tile pixel origin to document point coordinates
          const tileX = destX / effectiveScale;
          const tileY = destY / effectiveScale;

          doc
            .renderTile({
              pageIndex,
              tileX,
              tileY,
              tileW: curTileW,
              tileH: curTileH,
              scale: effectiveScale,
              generation,
            })
            .then((res) => {
              if (!isSubscribed || res.generation !== generation) {
                // Ignore stale render response (superseded by scroll/zoom)
                if (res.bitmap) res.bitmap.close();
                return;
              }

              if (res.bitmap) {
                tileCache.set(cacheKey, res.bitmap);
                ctx.drawImage(res.bitmap, destX, destY, curTileW, curTileH);
                onTileRendered?.();
              }
            })
            .catch(() => {
              // Ignore cancelled or aborted render requests
            });
        }
      }
    }

    return () => {
      isSubscribed = false;
    };
  }, [
    doc,
    pageIndex,
    canvasW,
    canvasH,
    scale,
    dpr,
    generation,
    tileCache,
    viewportTop,
    viewportBottom,
    pageTop,
    onTileRendered,
  ]);

  return (
    <div
      data-testid="page-container"
      data-page-index={pageIndex}
      style={{
        width: `${scaledW}px`,
        height: `${scaledH}px`,
        marginBottom: '16px',
        backgroundColor: '#ffffff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
        position: 'relative',
      }}
    >
      <canvas
        ref={canvasRef}
        width={canvasW}
        height={canvasH}
        style={{
          width: `${scaledW}px`,
          height: `${scaledH}px`,
          display: 'block',
        }}
      />
    </div>
  );
};
