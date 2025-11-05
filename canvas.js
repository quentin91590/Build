import { pointInRect, clamp, rectIntersectionArea, distancePointToRect, lerp } from "./utils.js";
import { renderInspector } from "./inspector.js";

let dragging = null; // {type, id, dx, dy, pointerId, origin}
let resizing = null; // {id, pointerId, w, h, ox, oy, origin}
let activePointerId = null;
let hoverZoneId = null;
let ghostZone = null;
let alignmentGuides = [];
let canvasRef = null;
let storeRef = null;
let animFrame = null;
let pendingImmediate = false;

const zoneVisuals = new Map();
let unsubscribeStore = null;
let cancelHandlerBound = null;

export function initCanvas(canvas, store) {
  canvasRef = canvas;
  storeRef = store;
  const ctx = canvas.getContext("2d");
  ctx.font = "12px 'Inter', ui-sans-serif";
  setupStoreSubscription(store);
}

export function drawAll(canvas, store) {
  canvasRef = canvas;
  storeRef = store;
  syncZoneVisuals(store.state.zones);
  updateZoneAnimations(performance.now());
  render(canvas, store);
}

export function attachCanvasEvents(canvas, store, inspectorRoot) {
  canvasRef = canvas;
  storeRef = store;
  setupStoreSubscription(store);

  canvas.addEventListener("pointerdown", (e) => {
    const p = getPointer(canvas, e);
    const { zones, blocks } = store.state;

    // check zone resize
    for (const z of [...zones].reverse()) {
      if (pointInRect(p.x, p.y, z.x + z.w - 10, z.y + z.h - 10, 16, 16)) {
        resizing = {
          id: z.id,
          pointerId: e.pointerId,
          w: z.w,
          h: z.h,
          ox: p.x,
          oy: p.y,
          origin: { w: z.w, h: z.h }
        };
        activePointerId = e.pointerId;
        canvas.setPointerCapture(e.pointerId);
        store.select(z.id);
        renderInspector(inspectorRoot, store);
        drawAll(canvas, store);
        requestAnimationLoop();
        return;
      }
    }

    // check block selection
    for (const b of [...blocks].reverse()) {
      if (pointInRect(p.x, p.y, b.x, b.y, b.w, b.h)) {
        dragging = {
          type: "block",
          id: b.id,
          dx: p.x - b.x,
          dy: p.y - b.y,
          pointerId: e.pointerId,
          origin: { x: b.x, y: b.y, zoneId: b.zoneId ?? null }
        };
        activePointerId = e.pointerId;
        canvas.setPointerCapture(e.pointerId);
        store.select(b.id);
        renderInspector(inspectorRoot, store);
        drawAll(canvas, store);
        requestAnimationLoop();
        return;
      }
    }

    // check zone selection
    for (const z of [...zones].reverse()) {
      if (pointInRect(p.x, p.y, z.x, z.y, z.w, z.h)) {
        dragging = {
          type: "zone",
          id: z.id,
          dx: p.x - z.x,
          dy: p.y - z.y,
          pointerId: e.pointerId,
          origin: { x: z.x, y: z.y, w: z.w, h: z.h }
        };
        activePointerId = e.pointerId;
        canvas.setPointerCapture(e.pointerId);
        store.select(z.id);
        renderInspector(inspectorRoot, store);
        drawAll(canvas, store);
        requestAnimationLoop();
        return;
      }
    }

    store.select(null);
    renderInspector(inspectorRoot, store);
    drawAll(canvas, store);
  });

  canvas.addEventListener("pointermove", (e) => {
    const p = getPointer(canvas, e);
    if (dragging && dragging.pointerId === e.pointerId) {
      e.preventDefault();
      if (dragging.type === "block") {
        handleBlockDrag(p, canvas, store);
      } else if (dragging.type === "zone") {
        handleZoneDrag(p, canvas, store);
      }
      drawAll(canvas, store);
    } else if (resizing && resizing.pointerId === e.pointerId) {
      e.preventDefault();
      handleZoneResize(p, store);
      drawAll(canvas, store);
    } else {
      hoverZoneId = computeHoverZone(p, null, store.state.zones);
      scheduleImmediateDraw();
    }
  });

  const resetPointer = (cancelled = false) => {
    if (activePointerId !== null) {
      try {
        canvas.releasePointerCapture(activePointerId);
      } catch (err) {
        /* ignore */
      }
    }
    activePointerId = null;
    const prevDrag = dragging;
    const prevResize = resizing;
    dragging = null;
    resizing = null;
    ghostZone = null;
    alignmentGuides = [];
    hoverZoneId = null;
    if (cancelled) {
      restoreFromCancel(prevDrag, prevResize, store);
    }
  };

  canvas.addEventListener("pointerup", () => {
    resetPointer();
    drawAll(canvas, store);
  });
  canvas.addEventListener("pointercancel", () => {
    resetPointer();
    drawAll(canvas, store);
  });

  if (!cancelHandlerBound) {
    cancelHandlerBound = (evt) => {
      if (evt.key === "Escape") {
        resetPointer(true);
        drawAll(canvas, store);
      }
    };
    window.addEventListener("keydown", cancelHandlerBound);
  }

  canvas.addEventListener("destroy", () => {
    if (cancelHandlerBound) {
      window.removeEventListener("keydown", cancelHandlerBound);
      cancelHandlerBound = null;
    }
    if (unsubscribeStore) {
      unsubscribeStore();
      unsubscribeStore = null;
    }
  });
}

function handleBlockDrag(p, canvas, store) {
  const block = store.state.blocks.find((b) => b.id === dragging.id);
  if (!block) return;
  const prevZone = block.zoneId ?? null;
  let nx = clamp(p.x - dragging.dx, 0, canvas.width - block.w);
  let ny = clamp(p.y - dragging.dy, 0, canvas.height - block.h);
  const rect = { x: nx, y: ny, w: block.w, h: block.h };
  const candidate = findBestZone(rect, store.state.zones);
  if (candidate) {
    nx = clamp(nx, candidate.x + 16, candidate.x + candidate.w - 16 - block.w);
    ny = clamp(ny, candidate.y + 16, candidate.y + candidate.h - 16 - block.h);
  }
  store.moveBlock(dragging.id, nx, ny);
  if (candidate) {
    if (prevZone !== candidate.id) {
      store.assignBlockZone(dragging.id, candidate.id, { fitNew: false });
    }
    store.fitZone(candidate.id);
  } else if (prevZone !== null) {
    store.assignBlockZone(dragging.id, null);
  }
  hoverZoneId = computeHoverZone(p, candidate, store.state.zones);
}

function handleZoneDrag(p, canvas, store) {
  const zone = store.state.zones.find((z) => z.id === dragging.id);
  if (!zone) return;
  const nx = clamp(p.x - dragging.dx, 0, canvas.width - zone.w);
  const ny = clamp(p.y - dragging.dy, 0, canvas.height - zone.h);
  ghostZone = { x: nx, y: ny, w: zone.w, h: zone.h };
  store.moveZone(dragging.id, nx, ny, { mode: "manual" });
  alignmentGuides = computeAlignmentGuides(ghostZone, store.state.zones, dragging.id);
  hoverZoneId = computeHoverZone(p, null, store.state.zones, dragging.id);
}

function handleZoneResize(p, store) {
  const zone = store.state.zones.find((z) => z.id === resizing.id);
  if (!zone) return;
  const deltaX = p.x - resizing.ox;
  const deltaY = p.y - resizing.oy;
  const w = Math.max(120, resizing.w + deltaX);
  const h = Math.max(80, resizing.h + deltaY);
  ghostZone = { x: zone.x, y: zone.y, w, h };
  store.resizeZone(resizing.id, w, h, { mode: "manual" });
  alignmentGuides = computeAlignmentGuides(ghostZone, store.state.zones, resizing.id);
}

function restoreFromCancel(prevDrag, prevResize, store) {
  if (prevDrag) {
    if (prevDrag.type === "block") {
      const origin = prevDrag.origin;
      store.moveBlock(prevDrag.id, origin.x, origin.y);
      store.assignBlockZone(prevDrag.id, origin.zoneId);
    } else if (prevDrag.type === "zone") {
      const origin = prevDrag.origin;
      store.moveZone(prevDrag.id, origin.x, origin.y, { mode: "manual" });
      store.resizeZone(prevDrag.id, origin.w, origin.h, { mode: "manual" });
    }
  }
  if (prevResize) {
    const origin = prevResize.origin;
    store.resizeZone(prevResize.id, origin.w, origin.h, { mode: "manual" });
  }
}

function setupStoreSubscription(store) {
  if (unsubscribeStore) return;
  unsubscribeStore = store.subscribe((event) => {
    if (!event) return;
    if (event.type === "zone:add") {
      animateZoneAppearance(event.zone);
    } else if (event.type === "zone:update") {
      if (event.mode === "auto") {
        animateZoneTo(event.zone, { duration: 200, opacity: 1, scale: 1 });
      } else {
        setZoneVisual(event.zone);
      }
      scheduleImmediateDraw();
    } else if (event.type === "zone:remove") {
      zoneVisuals.delete(event.id);
      scheduleImmediateDraw();
    }
  });
}

function syncZoneVisuals(zones) {
  const existing = new Set(zones.map((z) => z.id));
  [...zoneVisuals.keys()].forEach((id) => {
    if (!existing.has(id)) zoneVisuals.delete(id);
  });
  zones.forEach((z) => ensureZoneVisual(z));
}

function ensureZoneVisual(zone) {
  let vis = zoneVisuals.get(zone.id);
  if (!vis) {
    const base = { x: zone.x, y: zone.y, w: zone.w, h: zone.h, opacity: 1, scale: 1 };
    vis = {
      current: { ...base },
      target: { ...base },
      from: { ...base },
      start: performance.now(),
      duration: 0,
      animating: false
    };
    zoneVisuals.set(zone.id, vis);
  }
  return vis;
}

function setZoneVisual(zone) {
  const vis = ensureZoneVisual(zone);
  const base = { x: zone.x, y: zone.y, w: zone.w, h: zone.h, opacity: 1, scale: 1 };
  vis.current = { ...base };
  vis.target = { ...base };
  vis.from = { ...base };
  vis.duration = 0;
  vis.animating = false;
}

function animateZoneAppearance(zone) {
  const vis = ensureZoneVisual(zone);
  vis.current = { x: zone.x, y: zone.y, w: zone.w, h: zone.h, opacity: 0, scale: 0.85 };
  vis.target = { x: zone.x, y: zone.y, w: zone.w, h: zone.h, opacity: 1, scale: 1 };
  vis.from = { ...vis.current };
  vis.start = performance.now();
  vis.duration = 200;
  vis.animating = true;
  requestAnimationLoop();
}

function animateZoneTo(zone, options = {}) {
  const { duration = 200, opacity = 1, scale = 1 } = options;
  const vis = ensureZoneVisual(zone);
  vis.from = { ...vis.current };
  vis.target = { x: zone.x, y: zone.y, w: zone.w, h: zone.h, opacity, scale };
  vis.start = performance.now();
  vis.duration = duration;
  vis.animating = true;
  requestAnimationLoop();
}

function updateZoneAnimations(now) {
  let active = false;
  zoneVisuals.forEach((vis) => {
    if (!vis.animating) return;
    const t = vis.duration === 0 ? 1 : Math.min(1, (now - vis.start) / vis.duration);
    vis.current.x = lerp(vis.from.x, vis.target.x, t);
    vis.current.y = lerp(vis.from.y, vis.target.y, t);
    vis.current.w = lerp(vis.from.w, vis.target.w, t);
    vis.current.h = lerp(vis.from.h, vis.target.h, t);
    vis.current.opacity = lerp(vis.from.opacity, vis.target.opacity, t);
    vis.current.scale = lerp(vis.from.scale, vis.target.scale, t);
    if (t >= 1) {
      vis.animating = false;
      vis.current = { ...vis.target };
    } else {
      active = true;
    }
  });
  return active;
}

function requestAnimationLoop() {
  if (animFrame != null) return;
  animFrame = requestAnimationFrame(stepAnimation);
}

function stepAnimation(timestamp) {
  animFrame = null;
  if (!canvasRef || !storeRef) return;
  const animating = updateZoneAnimations(timestamp);
  render(canvasRef, storeRef);
  if (animating || dragging || resizing) {
    requestAnimationLoop();
  }
}

function scheduleImmediateDraw() {
  if (pendingImmediate || !canvasRef || !storeRef) return;
  pendingImmediate = true;
  requestAnimationFrame(() => {
    pendingImmediate = false;
    drawAll(canvasRef, storeRef);
  });
}

function render(canvas, store) {
  const { zones, blocks, techLinks, selectedId } = store.state;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = "12px 'Inter', ui-sans-serif";
  ctx.textBaseline = "alphabetic";

  zones.forEach((z) => {
    const vis = ensureZoneVisual(z);
    const { x, y, w, h, opacity, scale } = vis.current;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-(x + w / 2), -(y + h / 2));
    ctx.globalAlpha *= opacity;
    ctx.strokeStyle = hoverZoneId === z.id ? "#38bdf8" : "#cbd5e1";
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = hoverZoneId === z.id ? 3 : 2;
    ctx.fillStyle = hoverZoneId === z.id ? "rgba(14,165,233,0.12)" : "rgba(148,163,184,.08)";
    roundRect(ctx, x, y, w, h, 12, true, true);
    ctx.setLineDash([]);
    ctx.fillStyle = "#475569";
    ctx.textAlign = "left";
    ctx.fillText(z.name, x + 8, y + 18);
    if (selectedId === z.id) {
      ctx.strokeStyle = "#0ea5e9";
      ctx.lineWidth = 2;
      roundRect(ctx, x - 3, y - 3, w + 6, h + 6, 14, false, true);
    }
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(x + w - 10, y + h - 10, 16, 16);
    ctx.restore();
  });

  if (ghostZone) {
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(14,165,233,0.6)";
    ctx.lineWidth = 2;
    ctx.fillStyle = "rgba(14,165,233,0.08)";
    roundRect(ctx, ghostZone.x, ghostZone.y, ghostZone.w, ghostZone.h, 12, true, true);
    ctx.restore();
  }

  if (alignmentGuides.length) {
    ctx.save();
    ctx.strokeStyle = "rgba(14,165,233,0.5)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    alignmentGuides.forEach((guide) => {
      ctx.beginPath();
      ctx.moveTo(guide.x1, guide.y1);
      ctx.lineTo(guide.x2, guide.y2);
      ctx.stroke();
    });
    ctx.restore();
  }

  techLinks.forEach((link) => {
    const b = blocks.find((bb) => bb.id === link.blockId);
    if (!b || !isTechnical(b)) return;
    link.zones.forEach((zid) => {
      const z = zones.find((zz) => zz.id === zid);
      if (!z) return;
      const vis = ensureZoneVisual(z);
      drawArrow(ctx, b.x + b.w / 2, b.y + b.h / 2, vis.current.x + vis.current.w / 2, vis.current.y + vis.current.h / 2, "#475569");
    });
  });

  blocks.forEach((b) => {
    const color = b.cat === "enveloppe" ? "#8B5E3C" : b.cat === "ventilation" ? "#3B82F6" : "#EF4444";
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.92;
    roundRect(ctx, b.x, b.y, b.w, b.h, 8, true, false);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2);
    ctx.textBaseline = "alphabetic";
    if (store.state.selectedId === b.id) {
      ctx.strokeStyle = "#0ea5e9";
      ctx.lineWidth = 2;
      roundRect(ctx, b.x - 3, b.y - 3, b.w + 6, b.h + 6, 10, false, true);
    }
    ctx.restore();
  });
}

function getPointer(canvas, evt) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: evt.clientX - rect.left,
    y: evt.clientY - rect.top
  };
}

function computeHoverZone(point, candidate, zones, ignoreId = null) {
  if (candidate) return candidate.id;
  const zoneUnder = findZoneAt(point, zones, ignoreId);
  if (zoneUnder) return zoneUnder.id;
  let best = null;
  let bestDist = Infinity;
  zones.forEach((z) => {
    if (ignoreId && z.id === ignoreId) return;
    const dist = distancePointToRect(point.x, point.y, z.x, z.y, z.w, z.h);
    if (dist < bestDist && dist <= 48) {
      best = z;
      bestDist = dist;
    }
  });
  return best ? best.id : null;
}

function findZoneAt(point, zones, ignoreId = null) {
  for (const z of [...zones].reverse()) {
    if (ignoreId && z.id === ignoreId) continue;
    if (pointInRect(point.x, point.y, z.x, z.y, z.w, z.h)) {
      return z;
    }
  }
  return null;
}

function findBestZone(rect, zones, ignoreId = null) {
  let best = null;
  let bestArea = 0;
  zones.forEach((z) => {
    if (ignoreId && z.id === ignoreId) return;
    const area = rectIntersectionArea(rect.x, rect.y, rect.w, rect.h, z.x, z.y, z.w, z.h);
    if (area > bestArea) {
      best = z;
      bestArea = area;
    }
  });
  return best;
}

function computeAlignmentGuides(zoneRect, zones, ignoreId) {
  if (!zoneRect) return [];
  const guides = [];
  const tolerance = 6;
  zones.forEach((z) => {
    if (z.id === ignoreId) return;
    const overlap = rectIntersectionArea(zoneRect.x, zoneRect.y, zoneRect.w, zoneRect.h, z.x, z.y, z.w, z.h);
    if (overlap <= 0) return;
    const zoneArea = zoneRect.w * zoneRect.h;
    if (zoneArea === 0) return;
    if (overlap / zoneArea < 0.3) return;
    if (Math.abs(zoneRect.x - z.x) <= tolerance) {
      guides.push({ x1: z.x, y1: z.y, x2: z.x, y2: z.y + z.h });
    }
    if (Math.abs(zoneRect.x + zoneRect.w - (z.x + z.w)) <= tolerance) {
      guides.push({ x1: z.x + z.w, y1: z.y, x2: z.x + z.w, y2: z.y + z.h });
    }
    if (Math.abs(zoneRect.y - z.y) <= tolerance) {
      guides.push({ x1: z.x, y1: z.y, x2: z.x + z.w, y2: z.y });
    }
    if (Math.abs(zoneRect.y + zoneRect.h - (z.y + z.h)) <= tolerance) {
      guides.push({ x1: z.x, y1: z.y + z.h, x2: z.x + z.w, y2: z.y + z.h });
    }
  });
  return guides;
}

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  if (typeof r === "number") r = { tl: r, tr: r, br: r, bl: r };
  ctx.beginPath();
  ctx.moveTo(x + r.tl, y);
  ctx.lineTo(x + w - r.tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r.tr);
  ctx.lineTo(x + w, y + h - r.br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
  ctx.lineTo(x + r.bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r.bl);
  ctx.lineTo(x, y + r.tl);
  ctx.quadraticCurveTo(x, y, x + r.tl, y);
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function drawArrow(ctx, x1, y1, x2, y2, color = "#94a3b8") {
  const head = 10;
  const ang = Math.atan2(y2 - y1, x2 - x1);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(ang - Math.PI / 6), y2 - head * Math.sin(ang - Math.PI / 6));
  ctx.lineTo(x2 - head * Math.cos(ang + Math.PI / 6), y2 - head * Math.sin(ang + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function isTechnical(block) {
  return block.cat === "ventilation" || block.cat === "production";
}
