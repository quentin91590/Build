// Petit store maison (pas de lib)
export function initStore() {
  const state = {
    zones: [],
    blocks: [], // {id,name,cat,x,y,w,h,props:{}}
    techLinks: [], // {blockId,zones:[zoneId]}
    selectedId: null,
    seq: 0
  };
  const listeners = new Set();
  const notify = (event) => {
    listeners.forEach((fn) => {
      try {
        fn(event, state);
      } catch (err) {
        console.error("store listener error", err);
      }
    });
  };

  const copyZone = (zone) => ({ ...zone });
  const copyBlock = (block) => ({ ...block, props: { ...(block.props ?? {}) } });

  const fitZone = (id, reason = "auto") => {
    const z = state.zones.find((zone) => zone.id === id);
    if (!z) return;
    const assigned = state.blocks.filter((b) => b.zoneId === id);
    if (assigned.length === 0) return;
    const padding = 24;
    const minX = Math.min(...assigned.map((b) => b.x));
    const minY = Math.min(...assigned.map((b) => b.y));
    const maxX = Math.max(...assigned.map((b) => b.x + b.w));
    const maxY = Math.max(...assigned.map((b) => b.y + b.h));
    const next = {
      x: Math.max(0, Math.floor(minX - padding)),
      y: Math.max(0, Math.floor(minY - padding)),
      w: Math.max(120, Math.ceil(maxX - minX + padding * 2)),
      h: Math.max(80, Math.ceil(maxY - minY + padding * 2))
    };
    if (next.x !== z.x || next.y !== z.y || next.w !== z.w || next.h !== z.h) {
      Object.assign(z, next);
      notify({ type: "zone:update", zone: copyZone(z), mode: reason });
    }
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
      const z = Object.assign({ id: api._id(), name: "Zone", x: 50, y: 50, w: 300, h: 200, parentZoneId: null }, partial);
      state.zones.push(z);
      notify({ type: "zone:add", zone: copyZone(z) });
      return z;
    },
    moveZone(id, x, y, options = {}) {
      const z = state.zones.find((zone) => zone.id === id);
      if (z) {
        z.x = x;
        z.y = y;
        notify({ type: "zone:update", zone: copyZone(z), mode: options.mode ?? "manual" });
      }
    },
    resizeZone(id, w, h, options = {}) {
      const z = state.zones.find((zone) => zone.id === id);
      if (z) {
        z.w = w;
        z.h = h;
        notify({ type: "zone:update", zone: copyZone(z), mode: options.mode ?? "manual" });
      }
    },
    updateZone(id, patch) {
      const z = state.zones.find((zone) => zone.id === id);
      if (z) {
        Object.assign(z, patch);
        notify({ type: "zone:update", zone: copyZone(z), mode: "manual" });
      }
    },
    deleteZone(id) {
      state.zones = state.zones.filter((zone) => zone.id !== id);
      state.techLinks = state.techLinks
        .map((link) => ({ blockId: link.blockId, zones: link.zones.filter((zid) => zid !== id) }))
        .filter((link) => link.zones.length > 0);
      state.blocks = state.blocks.map((block) => (block.zoneId === id ? { ...block, zoneId: null } : block));
      if (state.selectedId === id) {
        state.selectedId = null;
      }
      notify({ type: "zone:remove", id });
    },
    // Blocks
    addBlock(b) {
      const nb = Object.assign(
        { id: api._id(), name: "Bloc", cat: "enveloppe", x: 80, y: 80, w: 120, h: 60, props: {}, zoneId: null },
        b
      );
      nb.props = { ...(nb.props ?? {}) };
      state.blocks.push(nb);
      notify({ type: "block:add", block: copyBlock(nb) });
      return nb;
    },
    moveBlock(id, x, y) {
      const b = state.blocks.find((block) => block.id === id);
      if (b) {
        b.x = x;
        b.y = y;
        notify({ type: "block:update", block: copyBlock(b) });
        if (b.zoneId) {
          fitZone(b.zoneId, "auto");
        }
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
        notify({ type: "block:update", block: copyBlock(b) });
      }
    },
    deleteBlock(id) {
      state.blocks = state.blocks.filter((block) => block.id !== id);
      state.techLinks = state.techLinks.filter((t) => t.blockId !== id);
      state.zones.forEach((z) => {
        fitZone(z.id, "auto");
      });
      if (state.selectedId === id) {
        state.selectedId = null;
      }
      notify({ type: "block:remove", id });
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
    assignBlockZone(blockId, zoneId, options = {}) {
      const b = state.blocks.find((block) => block.id === blockId);
      if (!b) return;
      const prev = b.zoneId ?? null;
      if (prev === zoneId) return;
      b.zoneId = zoneId ?? null;
      if (prev) {
        fitZone(prev, "auto");
      }
      if (zoneId && options.fitNew !== false) {
        fitZone(zoneId, "auto");
      }
      notify({ type: "block:zone", block: copyBlock(b), previous: prev });
    },
    linkTech(blockId, zones) {
      const filtered = zones.filter((zid) => state.zones.some((z) => z.id === zid));
      const others = state.techLinks.filter((t) => t.blockId !== blockId);
      if (filtered.length === 0) {
        state.techLinks = [...others];
      } else {
        state.techLinks = [...others, { blockId, zones: [...new Set(filtered)] }];
      }
      notify({ type: "tech:link", blockId, zones: [...zones] });
    },
    fitZone(id) {
      fitZone(id, "auto");
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
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
