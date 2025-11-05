import { drawAll } from "./canvas.js";

export function renderInspector(root, store) {
  const state = store.state;
  const stage = document.getElementById("stage");
  const selection = state.blocks.find((b) => b.id === state.selectedId) || state.zones.find((z) => z.id === state.selectedId);

  if (!selection) {
    root.innerHTML = `
      <div class="palette-title">Inspecteur</div>
      <div class="palette-group small">Sélectionnez un bloc ou une zone pour en modifier les propriétés.</div>
    `;
    return;
  }

  if (selection.w !== undefined && selection.h !== undefined && selection.cat === undefined) {
    // Zone
    root.innerHTML = `
      <div class="palette-title">Zone</div>
      <div class="palette-group">
        <div class="field"><label for="zone-name">Nom</label><input id="zone-name" type="text" value="${selection.name}"></div>
        <div class="field actions-inline">
          <button id="zone-delete" class="danger">Supprimer</button>
        </div>
      </div>
    `;

    root.querySelector("#zone-name").oninput = (e) => {
      store.updateZone(selection.id, { name: e.target.value });
      drawAll(stage, store);
    };

    root.querySelector("#zone-delete").onclick = () => {
      store.deleteZone(selection.id);
      renderInspector(root, store);
      drawAll(stage, store);
    };
    return;
  }

  const link = state.techLinks.find((t) => t.blockId === selection.id);
  const isTechnical = selection.cat === "ventilation" || selection.cat === "production";

  root.innerHTML = `
    <div class="palette-title">Bloc</div>
    <div class="palette-group">
      <div class="field"><label for="block-name">Nom</label><input id="block-name" type="text" value="${selection.name}"></div>
      <div class="field"><label for="block-cat">Catégorie</label><input id="block-cat" type="text" value="${selection.cat}" disabled></div>
      <div class="field"><label for="block-power">Puissance (kW)</label><input id="block-power" type="number" step="0.1" value="${selection.props?.puissance ?? ""}"></div>
      <div class="field actions-inline">
        <button id="block-duplicate">Dupliquer</button>
        <button id="block-delete" class="danger">Supprimer</button>
      </div>
    </div>
    <div class="palette-title">Zones desservies</div>
    <div class="palette-group" id="zones-links">${
      isTechnical
        ? ""
        : '<div class="notice">Les liaisons ne sont disponibles que pour la ventilation ou la production.</div>'
    }</div>
  `;

  root.querySelector("#block-name").oninput = (e) => {
    store.updateBlock(selection.id, { name: e.target.value });
    drawAll(stage, store);
  };

  root.querySelector("#block-power").oninput = (e) => {
    const value = e.target.value === "" ? null : Number(e.target.value);
    const props = { ...(selection.props ?? {}) };
    if (value === null) {
      delete props.puissance;
    } else {
      props.puissance = value;
    }
    store.updateBlock(selection.id, { props });
  };

  root.querySelector("#block-delete").onclick = () => {
    store.deleteBlock(selection.id);
    renderInspector(root, store);
    drawAll(stage, store);
  };

  root.querySelector("#block-duplicate").onclick = () => {
    const copy = store.duplicateBlock(selection.id);
    if (copy) {
      store.select(copy.id);
      drawAll(stage, store);
      renderInspector(root, store);
    }
  };

  if (!isTechnical) {
    return;
  }

  const zonesWrap = root.querySelector("#zones-links");
  state.zones.forEach((zone) => {
    const row = document.createElement("label");
    row.className = "zone-link-row";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!(link && link.zones.includes(zone.id));
    checkbox.onchange = () => {
      const current = store.state.techLinks.find((t) => t.blockId === selection.id);
      const set = new Set(current?.zones ?? []);
      if (checkbox.checked) {
        set.add(zone.id);
      } else {
        set.delete(zone.id);
      }
      store.linkTech(selection.id, Array.from(set));
      drawAll(stage, store);
      renderInspector(root, store);
    };
    const span = document.createElement("span");
    span.textContent = zone.name;
    row.appendChild(checkbox);
    row.appendChild(span);
    zonesWrap.appendChild(row);
  });
}
