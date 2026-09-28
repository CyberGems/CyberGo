import type { Display } from 'electron';

export const MAIN_MIN_WIDTH = 900;
export const MAIN_MIN_HEIGHT = 600;

export interface SavedWindowBounds {
  x?: number | null;
  y?: number | null;
  width?: number | null;
  height?: number | null;
  maximized?: boolean;
  displayId?: number | null;
}

export interface ResolvedWindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  displayId: number;
  maximized: boolean;
}

function nearestDisplay(displays: Display[], primary: Display, x: number, y: number): Display {
  let best = primary;
  let bestDistance = Infinity;
  for (const display of displays) {
    const bounds = display.bounds;
    const nearestX = Math.min(Math.max(x, bounds.x), bounds.x + bounds.width);
    const nearestY = Math.min(Math.max(y, bounds.y), bounds.y + bounds.height);
    const distance = (x - nearestX) ** 2 + (y - nearestY) ** 2;
    if (distance < bestDistance) {
      best = display;
      bestDistance = distance;
    }
  }
  return best;
}

export function resolveWindowBounds(
  saved: SavedWindowBounds | null | undefined,
  displays: Display[],
  primary: Display,
): ResolvedWindowBounds {
  if (!primary) {
    return { x: 0, y: 0, width: 1180, height: 760, displayId: 0, maximized: !!saved?.maximized };
  }
  const available = displays.length ? displays : [primary];
  let display = saved?.displayId == null
    ? null
    : available.find((candidate) => candidate.id === saved.displayId) ?? null;
  const savedX = typeof saved?.x === 'number' ? saved.x : null;
  const savedY = typeof saved?.y === 'number' ? saved.y : null;
  if (!display && savedX != null && savedY != null) {
    display = nearestDisplay(available, primary, savedX + (Number(saved?.width) || 0) / 2, savedY + (Number(saved?.height) || 0) / 2);
  }
  display ??= primary;

  const area = display.workArea || display.bounds;
  const defaultWidth = Math.min(1180, Math.max(MAIN_MIN_WIDTH, Math.floor(area.width * 0.85)));
  const defaultHeight = Math.min(760, Math.max(MAIN_MIN_HEIGHT, Math.floor(area.height * 0.85)));
  let width = Number(saved?.width);
  let height = Number(saved?.height);
  if (!Number.isFinite(width) || width <= 0 || width > area.width) width = defaultWidth;
  if (!Number.isFinite(height) || height <= 0 || height > area.height) height = defaultHeight;
  width = Math.min(Math.max(Math.round(width), MAIN_MIN_WIDTH), Math.max(MAIN_MIN_WIDTH, area.width));
  height = Math.min(Math.max(Math.round(height), MAIN_MIN_HEIGHT), Math.max(MAIN_MIN_HEIGHT, area.height));

  let x = savedX == null ? NaN : Math.round(savedX);
  let y = savedY == null ? NaN : Math.round(savedY);
  const inside = Number.isFinite(x)
    && Number.isFinite(y)
    && x >= area.x - 8
    && y >= area.y - 8
    && x + width <= area.x + area.width + 8
    && y + height <= area.y + area.height + 8;
  if (!inside) {
    x = Math.round(area.x + (area.width - width) / 2);
    y = Math.round(area.y + (area.height - height) / 2);
  }
  x = Math.min(Math.max(x, area.x), area.x + Math.max(0, area.width - width));
  y = Math.min(Math.max(y, area.y), area.y + Math.max(0, area.height - height));

  return {
    x,
    y,
    width,
    height,
    displayId: display.id,
    maximized: saved?.maximized === true,
  };
}
