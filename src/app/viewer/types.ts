import type { PageSize } from '../../shared/protocol';

export interface PageLayoutInfo {
  index: number;
  width: number; // in CSS pixels at scale 1.0
  height: number; // in CSS pixels at scale 1.0
  top: number; // cumulative top offset in CSS pixels
  size: PageSize;
}

export interface TileCoordinates {
  col: number;
  row: number;
  tileX: number; // in points
  tileY: number; // in points
  tileW: number; // in pixels
  tileH: number; // in pixels
}
