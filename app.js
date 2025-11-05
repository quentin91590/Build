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
    status.textContent = `
