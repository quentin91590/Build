export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export function pointInRect(px, py, rx, ry, rw, rh) {
  return px >= rx && py >= ry && px <= rx + rw && py <= ry + rh;
}

export function rectIntersectionArea(ax, ay, aw, ah, bx, by, bw, bh) {
  const ix = Math.max(ax, bx);
  const iy = Math.max(ay, by);
  const iw = Math.min(ax + aw, bx + bw) - ix;
  const ih = Math.min(ay + ah, by + bh) - iy;
  if (iw <= 0 || ih <= 0) return 0;
  return iw * ih;
}

export function distancePointToRect(px, py, rx, ry, rw, rh) {
  const dx = px < rx ? rx - px : px > rx + rw ? px - (rx + rw) : 0;
  const dy = py < ry ? ry - py : py > ry + rh ? py - (ry + rh) : 0;
  return Math.sqrt(dx * dx + dy * dy);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}
