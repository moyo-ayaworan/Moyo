export type ImagePosition = { x: number; y: number };
export const centeredImagePosition: ImagePosition = { x: 50, y: 50 };
export function isImagePosition(value: unknown): value is ImagePosition {
  if (!value || typeof value !== 'object') return false;
  const { x, y } = value as Record<string, unknown>;
  return typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 100 && typeof y === 'number' && Number.isFinite(y) && y >= 0 && y <= 100;
}
export function normalizeImagePosition(value: unknown): ImagePosition {
  return isImagePosition(value) ? { x: value.x, y: value.y } : { ...centeredImagePosition };
}

export function dragImagePosition(start: ImagePosition, delta: ImagePosition, overflow: ImagePosition): ImagePosition {
  const move = (position: number, distance: number, extra: number) => extra > 0.5 ? Math.min(100, Math.max(0, Math.round(position - distance / extra * 100))) : position;
  return { x: move(start.x, delta.x, overflow.x), y: move(start.y, delta.y, overflow.y) };
}
