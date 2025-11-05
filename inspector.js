import { drawAll } from "./canvas.js";

export function renderInspector(root, store){
  const st = store.state;
  const sel = st.blocks.find(b=>b.id===st.selectedId) || st.zones.find(z=>z.id===st.selectedId);
  if(!sel){ root.innerHTML = `<div class="palette-title">Inspecteur</div><div class="palette-group small">Sélectionne une zone ou un bloc.</div>`; return; }

  if(sel.w!==undefined){ // Zone
    root.innerHTML = `
      <div class="palette-title">Zone</div>
      <div class="palette-group">
        <div class="field"><label>Nom</label><input id="f-name" type="text" value="${sel.name}"></div>
      </div>`;
    root.querySelector("#f-name").oninput = (e)=>{ sel.name = e.target.value; drawAll(document.getElementById("stage"), store); };
    return;
  }

  // Bloc
  const link = st.techLinks.find(t=>t.blockId===sel.id);
  root.innerHTML = `
    <div class="palette-title">Bloc</div>
    <div class="palette-group">
      <div class="field"><label>Nom</label><input id="b-name" type="text" value="${sel.name}"></div>
      <div class="field"><label>Puissance (kW)</label><input id="b-pwr" type="number" step="0.1" value="${sel.props?.puissance ?? ""}"></div>
      <div class="field"><button id="b-del">Supprimer</button></div>
    </div>
    <div class="palette-title">Zones desservies</div>
    <div class="palette-group" id="zones"></div>
  `;
  root.querySelector("#b-name").oninput = (e)=>{ store.updateBlock(sel.id,{name:e.target.value}); drawAll(stage,store); };
  root.querySelector("#b-pwr").oninput = (e)=>{ sel.props = sel.props||{}; sel.props.puissance = Number(e.target.value||0); };
  root.querySelector("#b-del").onclick = ()=>{ store.deleteBlock(sel.id); renderInspector(root,store); drawAll(stage,store); };

  const zonesWrap = root.querySelector("#zones");
  store.state.zones.forEach(z=>{
    const row = document.createElement("label");
    row.style.display="flex"; row.style.alignItems="center"; row.style.gap="8px"; row.style.margin="4px 0";
    const chk = document.createElement("input"); chk.type="checkbox";
    const selected = !!(link && link.zones.includes(z.id));
    chk.checked = selected;
    chk.onchange = ()=>{
      const set = new Set(link?.zones ?? []);
      chk.checked ? set.add(z.id) : set.delete(z.id);
      store.linkTech(sel.id, Array.from(set));
      drawAll(stage,store);
    };
    row.appendChild(chk);
    const span = document.createElement("span"); span.textContent = z.name;
    row.appendChild(span);
    zonesWrap.appendChild(row);
  });
}

export function bindInspector(){ /* réservé si besoin plus tard */ }
