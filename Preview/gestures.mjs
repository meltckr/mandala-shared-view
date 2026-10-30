// One pointer rotates; two pointers zoom without selecting or turning the world.
export function bindWorldGestures(surface, {rotate, zoom, pick}) {
  const pointers=new Map(); let separation=0, gesture=false, movement=0;
  const gap=()=>{const [a,b]=[...pointers.values()];return Math.hypot(a.x-b.x,a.y-b.y);};
  const down=event=>{
    if((event.button!==0&&event.button!==2)||pointers.size>=2)return;
    event.preventDefault();surface.focus({preventScroll:true});
    if(!pointers.size){gesture=false;movement=0;}
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    surface.setPointerCapture(event.pointerId);
    if(pointers.size===2){gesture=true;separation=gap();}
  };
  const move=event=>{
    const previous=pointers.get(event.pointerId);if(!previous)return;
    event.preventDefault();const next={x:event.clientX,y:event.clientY};
    pointers.set(event.pointerId,next);
    if(pointers.size===2){const current=gap();if(separation>1&&current>1)zoom(current/separation);separation=current;}
    else if(!gesture){const dx=next.x-previous.x,dy=next.y-previous.y;movement+=Math.abs(dx)+Math.abs(dy);rotate(dx,dy);}
  };
  const finish=(event,cancelled=false)=>{
    if(!pointers.has(event.pointerId))return;
    const tap=!cancelled&&!gesture&&pointers.size===1&&movement<5;
    pointers.delete(event.pointerId);separation=0;
    if(tap)pick(event.clientX,event.clientY);
    if(!pointers.size)gesture=false;
  };
  surface.addEventListener('pointerdown',down,{passive:false});
  surface.addEventListener('pointermove',move,{passive:false});
  surface.addEventListener('pointerup',event=>finish(event));
  surface.addEventListener('pointercancel',event=>finish(event,true));
  surface.addEventListener('lostpointercapture',event=>finish(event,true));
  return {get active(){return pointers.size>0;}};
}
