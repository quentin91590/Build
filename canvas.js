import { pointInRect, clamp } from "./utils.js";
import { renderInspector } from "./inspector.js";

let dragging = null; // {type:'zone'|'block', id, dx, dy}
let resizing = null; // coin de resize pour zone

export function initCanvas(canvas, store){
  const ctx = canvas.getContext("2d");
  ctx.font = "12px ui-sans-serif";
}

export function drawAll(canvas, store){
  const {zones,blocks,techLinks,selectedId} = store.state;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // zones
  zones.forEach(z=>{
    ctx.save();
    ctx.strokeStyle = "#cbd5e1"; ctx.setLineDash([6,4]); ctx.lineWidth=2;
    ctx.fillStyle = "rgba(148,163,184,.08)";
    roundRect(ctx,z.x,z.y,z.w,z.h,12,true,true);
    ctx.setLineDash([]); ctx.fillStyle="#6b7280"; ctx.fillText(z.name, z.x+8, z.y+16);
    if(selectedId===z.id){ ctx.strokeStyle="#0ea5e9"; ctx.lineWidth=2; roundRect(ctx,z.x-3,z.y-3,z.w+6,z.h+6,14,false,true); }
    // poignée simple (resize bottom-right)
    ctx.fillStyle="#94a3b8"; ctx.fillRect(z.x+z.w-8, z.y+z.h-8, 12,12);
    ctx.restore();
  });

  // liens technique -> zones
  techLinks.forEach(link=>{
    const b = blocks.find(bb=>bb.id===link.blockId);
    if(!b) return;
    link.zones.forEach(zid=>{
      const z = zones.find(zz=>zz.id===zid); if(!z) return;
      drawArrow(ctx, b.x+b.w/2, b.y+b.h/2, z.x+z.w/2, z.y+z.h/2, "#94a3b8");
    });
  });

  // blocks
  blocks.forEach(b=>{
    const color = b.cat==="enveloppe" ? "#8B5E3C" : b.cat==="ventilation" ? "#3B82F6" : "#EF4444";
    ctx.save();
    ctx.fillStyle = color; ctx.globalAlpha = .92;
    roundRect(ctx,b.x,b.y,b.w,b.h,8,true,false);
    ctx.fillStyle="#fff"; ctx.globalAlpha=1;
    ctx.textAlign="center"; ctx.fillText(b.name, b.x+b.w/2, b.y+b.h/2+4);
    if(selectedId===b.id){ ctx.strokeStyle="#0ea5e9"; ctx.lineWidth=2; roundRect(ctx,b.x-3,b.y-3,b.w+6,b.h+6,10,false,true); }
    ctx.restore();
  });
}

export function attachCanvasEvents(canvas, store){
  canvas.addEventListener("mousedown", (e)=>{
    const p = getMouse(canvas,e);
    const {zones,blocks} = store.state;

    // check zone resize
    for(const z of [...zones].reverse()){
      if(pointInRect(p.x,p.y, z.x+z.w-8, z.y+z.h-8, 12,12)){ resizing={id:z.id, ox:p.x, oy:p.y, w:z.w, h:z.h}; return; }
    }

    // pick block
    for(const b of [...blocks].reverse()){
      if(pointInRect(p.x,p.y,b.x,b.y,b.w,b.h)){
        store.select(b.id);
        dragging={type:"block",id:b.id, dx:p.x-b.x, dy:p.y-b.y}; redraw(); return;
      }
    }
    // pick zone
    for(const z of [...zones].reverse()){
      if(pointInRect(p.x,p.y,z.x,z.y,z.w,z.h)){
        store.select(z.id);
        dragging={type:"zone",id:z.id, dx:p.x-z.x, dy:p.y-z.y}; redraw(); return;
      }
    }
    store.select(null); redraw();

    function redraw(){ drawAll(canvas, store); renderInspector(document.getElementById("inspector"), store); }
  });

  canvas.addEventListener("mousemove", (e)=>{
    const p = getMouse(canvas,e);
    if(dragging){
      if(dragging.type==="block"){ store.moveBlock(dragging.id, clamp(p.x-dragging.dx,0,canvas.width-20), clamp(p.y-dragging.dy,0,canvas.height-20)); }
      if(dragging.type==="zone"){ store.moveZone(dragging.id, clamp(p.x-dragging.dx,0,canvas.width-40), clamp(p.y-dragging.dy,0,canvas.height-40)); }
      drawAll(canvas, store);
    } else if(resizing){
      const z = store.state.zones.find(zz=>zz.id===resizing.id);
      if(z){ store.resizeZone(z.id, Math.max(80, resizing.w + (p.x-resizing.ox)), Math.max(60, resizing.h + (p.y-resizing.oy))); drawAll(canvas,store); }
    }
  });

  window.addEventListener("mouseup", ()=>{ dragging=null; resizing=null; });
}

function getMouse(canvas, evt){
  const r = canvas.getBoundingClientRect();
  return { x: evt.clientX - r.left, y: evt.clientY - r.top };
}
function roundRect(ctx,x,y,w,h,r,fill,stroke){
  if(typeof r==="number") r={tl:r,tr:r,br:r,bl:r};
  ctx.beginPath();
  ctx.moveTo(x+r.tl,y); ctx.lineTo(x+w-r.tr,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r.tr);
  ctx.lineTo(x+w,y+h-r.br); ctx.quadraticCurveTo(x+w,y+h,x+w-r.br,y+h);
  ctx.lineTo(x+r.bl,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r.bl);
  ctx.lineTo(x,y+r.tl); ctx.quadraticCurveTo(x,y,x+r.tl,y);
  if(fill) ctx.fill(); if(stroke) ctx.stroke();
}
function drawArrow(ctx,x1,y1,x2,y2,color="#94a3b8"){
  const head=8, ang=Math.atan2(y2-y1,x2-x1);
  ctx.save(); ctx.strokeStyle=color; ctx.fillStyle=color; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2-head*Math.cos(ang-Math.PI/6), y2-head*Math.sin(ang-Math.PI/6));
  ctx.lineTo(x2-head*Math.cos(ang+Math.PI/6), y2-head*Math.sin(ang+Math.PI/6));
  ctx.closePath(); ctx.fill(); ctx.restore();
}
