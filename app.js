import { initStore, loadFromStorage, saveToStorage } from "./store.js";
import { initCanvas, drawAll, attachCanvasEvents } from "./canvas.js";
import { renderPalette } from "./palette.js";
import { renderInspector } from "./inspector.js";

const stage = document.getElementById("stage");
const palette = document.getElementById("palette");
const inspector = document.getElementById("inspector");
const status = document.getElementById("status");

const store = initStore();
loadFromStorage(store);
renderPalette(palette, store);
renderInspector(inspector, store);
initCanvas(stage, store);
attachCanvasEvents(stage, store, inspector);
drawAll(stage, store);
bindTopbar();
autoSave();

function bindTopbar() {
  document.getElementById("btn-add-zone").onclick = () => {
    const z = store.addZone({
      name: `Zone ${store.state.zones.length + 1}`,
      x: 60,
      y: 60,
      w: 320,
      h: 220
    });
    store.select(z.id);
    drawAll(stage, store);
    renderInspector(inspector, store);
    status.textContent = `Zone ajoutée : ${z.name}`;
  };

  document.getElementById("btn-export").onclick = () => {
    const blob = new Blob([JSON.stringify(store.snapshot(), null, 2)], {
      type: "application/json"
    });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: "app-2d.json"
    });
    a.click();
    URL.revokeObjectURL(a.href);
    status.textContent = "Export réalisé";
  };

  document.getElementById("btn-import").onclick = () => {
    const input = Object.assign(document.createElement("input"), {
      type: "file",
      accept: ".json"
    });
    input.onchange = async () => {
      try {
        const txt = await input.files[0].text();
        const snapshot = JSON.parse(txt);
        store.replace(snapshot);
        drawAll(stage, store);
        renderPalette(palette, store);
        renderInspector(inspector, store);
        status.textContent = "Import réussi";
      } catch (err) {
        console.error(err);
        status.textContent = "Import impossible";
      }
    };
    input.click();
  };
}

function autoSave() {
  setInterval(() => saveToStorage(store), 1000);
}
