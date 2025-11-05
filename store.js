// Petit store maison (pas de lib)
export function initStore() {
  const state = {
    zones: [],
    blocks: [], // {id,name,cat,x,y,w,h,props:{}}
    techLinks: [], // {blockId,zones:[zoneId]}
    selectedId: null,
    seq: 0
  };
  const api = {
    _id() {
      return "id_" + (++state.seq);
    },
    snapshot() {
      return {
        zones: state.zones.map((z) => ({ ...z })),
        blocks: state.blocks.map((b) => ({ ...b, props: { ...(b.props ?? {}) } })),
        techLinks: state.techLinks.map((l) => ({ blockId: l.blockId, zones: [...l.zones] }))
      };
    },
    replace(snap) {
      state.zones = (snap.zones ?? []).map((z) => ({ ...z }));
      state.blocks = (snap.blocks ?? []).map((b) => ({ ...b, props: { ...(b.props ?? {}) } }));
      state.techLinks = (snap.techLinks ?? []).map((l) => ({ blockId: l.blockId, zones: [...(l.zones ?? [])] }));
      const maxZone = state.zones.reduce((m, z) => Math.max(m, parseSeq(z.id)), 0);
      const maxBlock = state.blocks.reduce((m, b) => Math.max(m, parseSeq(b.id)), 0);
      state.seq = Math.max(state.seq, maxZone, maxBlock);
      state.selectedId = null;
    },
    select(id) {
      state.selectedId = id;
    },
    // Zones
    addZone(partial) {
      const z = Object.assign({ id: api._id(), name: "Zone", x: 50, y: 50, w: 300, h: 200 }, partial);
      state.zones.push(z);
      return z;
    },
    moveZone(id, x, y) {
      const z = state.zones.find((zone) => zone.id === id);
      if (z) {
        z.x = x;
        z.y = y;
      }
    },
    resizeZone(id, w, h) {
      const z = state.zones.find((zone) => zone.id === id);
      if (z) {
        z.w = w;
        z.h = h;
      }
    },
    updateZone(id, patch) {
      const z = state.zones.find((zone) => zone.id === id);
      if (z) {
        Object.assign(z, patch);
      }
    },
    deleteZone(id) {
      state.zones = state.zones.filter((zone) => zone.id !== id);
      state.techLinks = state.techLinks
        .map((link) => ({ blockId: link.blockId, zones: link.zones.filter((zid) => zid !== id) }))
        .filter((link) => link.zones.length > 0);
      if (state.selectedId === id) {
        state.selectedId = null;
      }
    },
    // Blocks
    addBlock(b) {
      const nb = Object.assign({ id: api._id(), name: "Bloc", cat: "enveloppe", x: 80, y: 80, w: 120, h: 60, props: {} }, b);
      nb.props = { ...(nb.props ?? {}) };
      state.blocks.push(nb);
      return nb;
    },
    moveBlock(id, x, y) {
      const b = state.blocks.find((block) => block.id === id);
      if (b) {
        b.x = x;
        b.y = y;
      }
    },
    resizeBlock(id, w, h) {
      const b = state.blocks.find((block) => block.id === id);
      if (b) {
        b.w = w;
        b.h = h;
      }
    },
    updateBlock(id, patch) {
      const b = state.blocks.find((block) => block.id === id);
      if (b) {
        Object.assign(b, patch);
      }
    },
    deleteBlock(id) {
      state.blocks = state.blocks.filter((block) => block.id !== id);
      state.techLinks = state.techLinks.filter((t) => t.blockId !== id);
      if (state.selectedId === id) {
        state.selectedId = null;
      }
    },
    duplicateBlock(id) {
      const b = state.blocks.find((block) => block.id === id);
      if (!b) return null;
      const dup = api.addBlock({
        name: `${b.name} (copie)`,
        cat: b.cat,
        x: b.x + 24,
        y: b.y + 24,
        w: b.w,
        h: b.h,
        props: { ...(b.props ?? {}) }
      });
      return dup;
    },
    linkTech(blockId, zones) {
      const filtered = zones.filter((zid) => state.zones.some((z) => z.id === zid));
      const others = state.techLinks.filter((t) => t.blockId !== blockId);
      if (filtered.length === 0) {
        state.techLinks = [...others];
      } else {
        state.techLinks = [...others, { blockId, zones: [...new Set(filtered)] }];
      }
    },
    get state() {
      return state;
    }
  };
  return api;
}

function parseSeq(id) {
  if (!id) return 0;
  const match = /id_(\d+)/.exec(id);
  return match ? Number(match[1]) : 0;
}

export function saveToStorage(store) {
  try {
    localStorage.setItem("app-2d-state", JSON.stringify(store.snapshot()));
  } catch (e) {
    // stockage indisponible
  }
}

export function loadFromStorage(store) {
  try {
    const raw = localStorage.getItem("app-2d-state");
    if (raw) {
      store.replace(JSON.parse(raw));
    }
  } catch (e) {
    // stockage indisponible
  }
}
