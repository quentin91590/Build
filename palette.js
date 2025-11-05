import { drawAll } from "./canvas.js";

const ITEMS = [
  {label:"Mur", cat:"enveloppe", w:160, h:26},
  {label:"Monobloc", cat:"ventilation", w:120, h:80},
  {label:"Chaudière", cat:"production", w:120, h:80},
];

export function renderPalette(root, store){
  root.innerHTML = `
    <div class="palette-title">Bibliothèque</div>
    <div class="palette-group" id="palette-items"></div>
    <div class="palette-title">Astuce</div>
    <div class="palette-group small">Clique sur un item pour l'ajouter, puis déplace-le dans le canvas.</div>
  `;
  const wrap = root.querySelector("#palette-items");
  ITEMS.forEach(item=>{
    const el = document.createElement("div");
    el.className = "item";
    el.dataset.cat = item.cat;
    el.textContent = item.label;
    el.onclick = ()=>{
      store.addBlock({ name:item.label, cat:item.cat, x:100+Math.random()*100, y:100+Math.random()*60, w:item.w, h:item.h, props:{} });
      drawAll(document.getElementById("stage"), store);
    };
    wrap.appendChild(el);
  });
}
