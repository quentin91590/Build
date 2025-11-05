// Petit store maison (pas de lib)
export function initStore(){
  const state = {
    zones: [],
    blocks: [], // {id,name,cat,x,y,w,h,zoneId,props:{}}
    techLinks: [], // {blockId,zones:[zoneId]}
    selectedId: null,
    seq: 0
  };
  const api = {
    _id(){ return "id_"+(++state.seq); },
    snapshot(){ return { zones:state.zones, blocks:state.blocks, techLinks:state.techLinks }; },
    replace(snap){ state.zones=[...snap.zones]; state.blocks=[...snap.blocks]; state.techLinks=[...snap.techLinks]; },
    select(id){ state.selectedId = id; },
    // Zones
    addZone(partial){
      const z = Object.assign({id:api._id(),name:"Zone",x:50,y:50,w:300,h:200}, partial);
      state.zones.push(z); return z;
    },
    moveZone(id,x,y){ const z = state.zones.find(z=>z.id===id); if(z){ z.x=x; z.y=y; } },
    resizeZone(id,w,h){ const z = state.zones.find(z=>z.id===id); if(z){ z.w=w; z.h=h; } },
    // Blocks
    addBlock(b){ const nb = Object.assign({id:api._id(),name:"Bloc",cat:"enveloppe",x:80,y:80,w:120,h:60,props:{}}, b); state.blocks.push(nb); return nb; },
    moveBlock(id,x,y){ const b = state.blocks.find(b=>b.id===id); if(b){ b.x=x; b.y=y; } },
    updateBlock(id,patch){ const b = state.blocks.find(b=>b.id===id); if(b){ Object.assign(b,patch); } },
    deleteBlock(id){ state.blocks = state.blocks.filter(b=>b.id!==id); state.techLinks = state.techLinks.filter(t=>t.blockId!==id); },
    linkTech(blockId, zones){ const others = state.techLinks.filter(t=>t.blockId!==blockId); state.techLinks = [...others, {blockId, zones:[...zones]}]; },
    get state(){ return state; }
  };
  return api;
}

export function saveToStorage(store){
  try{ localStorage.setItem("bm-state", JSON.stringify(store.snapshot())); }catch(e){}
}

export function loadFromStorage(store){
  try{
    const raw = localStorage.getItem("bm-state");
    if(raw){ store.replace(JSON.parse(raw)); }
  }catch(e){}
}
