import { drawAll } from "./canvas.js";
import { renderInspector } from "./inspector.js";
import { clamp } from "./utils.js";

const GROUPS = [
  {
    key: "enveloppe",
    label: "Enveloppe",
    color: "#8B5E3C",
    items: [
      { label: "Mur", w: 180, h: 28 },
      { label: "Fenêtre", w: 140, h: 30 },
      { label: "Porte", w: 90, h: 34 }
    ]
  },
  {
    key: "ventilation",
    label: "Ventilation",
    color: "#3B82F6",
    items: [
      { label: "CTA", w: 150, h: 80 },
      { label: "Monobloc", w: 130, h: 80 }
    ]
  },
  {
    key: "production",
    label: "Production",
    color: "#EF4444",
    items: [
      { label: "Chaudière", w: 140, h: 90 },
      { label: "PAC", w: 140, h: 90 }
    ]
  }
];

let dragContext = null;
let previewEl = null;
let suppressClick = false;

export function renderPalette(root, store) {
  root.innerHTML = `<div class="palette-title">Palette</div>`;
  const list = document.createElement("div");
  list.className = "palette-groups";
  root.appendChild(list);

  GROUPS.forEach((group) => {
    const section = document.createElement("section");
    section.className = "palette-section";
    section.innerHTML = `
      <header>${group.label}</header>
      <div class="palette-group" data-cat="${group.key}"></div>
    `;
    const container = section.querySelector(".palette-group");
    group.items.forEach((item) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "item";
      el.dataset.cat = group.key;
      el.textContent = item.label;
      el.style.setProperty("--color", group.color);
      el.onpointerdown = (ev) => startDrag(ev, store, { ...item, cat: group.key, color: group.color });
      el.onclick = () => {
        if (suppressClick) return;
        const canvas = document.getElementById("stage");
        const cx = (canvas.width - item.w) / 2;
        const cy = (canvas.height - item.h) / 2;
        spawnBlock(store, { ...item, cat: group.key, color: group.color }, cx, cy);
      };
      container.appendChild(el);
    });
    list.appendChild(section);
  });

  const info = document.createElement("div");
  info.className = "palette-info";
  info.innerHTML = `
    <strong>Astuce :</strong> faites glisser un élément sur le canevas pour le placer, puis déplacez-le librement.
  `;
  root.appendChild(info);
}

function startDrag(ev, store, item) {
  ev.preventDefault();
  const canvas = document.getElementById("stage");
  suppressClick = true;
  dragContext = {
    item,
    store,
    pointerId: ev.pointerId,
    canvas
  };

  previewEl = document.createElement("div");
  previewEl.className = "drag-preview";
  previewEl.style.background = item.color;
  previewEl.textContent = item.label;
  document.body.appendChild(previewEl);
  positionPreview(ev.clientX, ev.clientY);

  window.addEventListener("pointermove", onDragMove, { passive: false });
  window.addEventListener("pointerup", onDragEnd, { passive: false });
  window.addEventListener("pointercancel", onDragEnd, { passive: false });
}

function onDragMove(ev) {
  if (!dragContext || ev.pointerId !== dragContext.pointerId) return;
  ev.preventDefault();
  positionPreview(ev.clientX, ev.clientY);
}

function onDragEnd(ev) {
  if (!dragContext || ev.pointerId !== dragContext.pointerId) return;
  ev.preventDefault();
  positionPreview(ev.clientX, ev.clientY);

  const { canvas, store, item } = dragContext;
  const rect = canvas.getBoundingClientRect();
  if (ev.clientX >= rect.left && ev.clientX <= rect.right && ev.clientY >= rect.top && ev.clientY <= rect.bottom) {
    const x = ev.clientX - rect.left - item.w / 2;
    const y = ev.clientY - rect.top - item.h / 2;
    spawnBlock(store, item, x, y);
  }

  cleanupDrag();
}

function positionPreview(x, y) {
  if (!previewEl) return;
  previewEl.style.transform = `translate(${x + 8}px, ${y + 8}px)`;
}

function cleanupDrag() {
  window.removeEventListener("pointermove", onDragMove);
  window.removeEventListener("pointerup", onDragEnd);
  window.removeEventListener("pointercancel", onDragEnd);
  dragContext = null;
  setTimeout(() => {
    suppressClick = false;
  }, 0);
  if (previewEl) {
    previewEl.remove();
    previewEl = null;
  }
}

function spawnBlock(store, item, x, y) {
  const canvas = document.getElementById("stage");
  if (!canvas) return;
  const block = store.addBlock({
    name: item.label,
    cat: item.cat,
    x: clamp(x, 0, canvas.width - item.w),
    y: clamp(y, 0, canvas.height - item.h),
    w: item.w,
    h: item.h
  });
  store.select(block.id);
  drawAll(canvas, store);
  renderInspector(document.getElementById("inspector"), store);
}
