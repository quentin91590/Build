export const clamp = (v,min,max)=> Math.min(max, Math.max(min, v));
export function pointInRect(px,py, rx,ry,rw,rh){
  return px>=rx && py>=ry && px<=rx+rw && py<=ry+rh;
}
