import { initStore, loadFromStorage, saveToStorage } from "./js/store.js";
import { initCanvas, drawAll, attachCanvasEvents } from "./js/canvas.js";
import { renderPalette } from "./js/palette.js";
import { renderInspector, bindInspector } from "./js/inspector.js";

const stage = document.getElementById("stage");
const palette = document.getElementById("palette");
const inspector = document.getElementById("inspector");
const status = document.getElementById("status");

const store = initStore();
loadFromStorage(store);
renderPalette(palette, store);
renderInspector(inspector, store);
initCanvas(stage, store);
attachCanvasEvents(stage, store);
drawAll(stage, store);
bindTopbar();
autoSave();

function bindTopbar(){
  document.getElementById("btn-add-zone").onclick = () => {
    const z = store.addZone({ name:"Zone", x:60+Math.random()*80, y:60+Math.random()*60, w:320, h:220 });
    status.textContent = `Zone ajoutée: ${z.name}`;
    drawAll(stage, store);
    renderInspector(inspector, store);
  };
  document.getElementById("btn-export").onclick = () => {
    const blob = new Blob([JSON.stringify(store.snapshot(), null, 2)], {type:"application/json"});
    const a = Object.assign(document.createElement("a"), {href:URL.createObjectURL(blob), download:"building.json"});
    a.click(); URL.revokeObjectURL(a.href);
  };
  document.getElementById("btn-import").onclick = async () => {
    const input = Object.assign(document.createElement("input"), {type:"file", accept:".json"});
    input.onchange = async () => {
      const txt = await input.files[0].text();
      store.replace(JSON.parse(txt));
      drawAll(stage, store); renderInspector(inspector, store); status.textContent="Import OK";
    };
    input.click();
  };
}

function autoSave(){
  setInterval(()=> saveToStorage(store), 1000);
}
