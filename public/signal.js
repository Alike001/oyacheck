// Original amplitude indicator. Seven marks share one measured RMS value;
// this is a visual envelope, not a frequency spectrum or recognition confidence.
export function signalHeights(state,level,reducedMotion=false){
  const value=state==='listening'&&!reducedMotion&&Number.isFinite(level)?Math.max(0,Math.min(1,level)):0;
  return [.35,.65,.85,1,.85,.65,.35].map(weight=>8+Math.round(value*76*weight));
}
export function renderSignal(root,state,level,reducedMotion=false){
  const heights=signalHeights(state,level,reducedMotion);
  for(const [index,bar] of [...root.querySelectorAll('[data-signal-bar]')].entries()){
    bar.setAttribute('height',String(heights[index]));
    bar.setAttribute('y',String((160-heights[index])/2));
  }
}
