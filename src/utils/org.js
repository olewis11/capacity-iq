/* ═══════════════════════════════════════════════════════════════
   ORG-TREE HELPERS
═══════════════════════════════════════════════════════════════ */
import {DEPT_PALETTE} from '../constants.js';

/* Sort helper: order arr by a saved order array; unordered items fall to the end */
export function sortByOrder(arr,orderArr){
  if(!orderArr?.length)return arr;
  return[...arr].sort((a,b)=>{
    const ai=orderArr.indexOf(a),bi=orderArr.indexOf(b);
    if(ai===-1&&bi===-1)return 0;if(ai===-1)return 1;if(bi===-1)return-1;return ai-bi;
  });
}

/* Discipline-level demand key for a disc: discipline → dept → bu → disc */
export function discDemandKey(d,activeMeta){
  const m=activeMeta[d]||{};
  return m.discipline||m.dept||m.bu||d;
}

/* DEPT_PALETTE bold color for a disc — matches People tab color scheme.
   Pure function; callers must pass activeMeta and sgPaletteIdx explicitly. */
export function discPaletteColor(disc,activeMeta,sgPaletteIdx){
  const sg=activeMeta[disc]?.dept||activeMeta[disc]?.bu||disc;
  const idx=sgPaletteIdx[sg];
  return idx!==undefined?DEPT_PALETTE[idx].bold:(activeMeta[disc]?.color||'#94A3B8');
}
