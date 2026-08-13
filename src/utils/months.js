/* ═══════════════════════════════════════════════════════════════
   MONTH UTILITIES
═══════════════════════════════════════════════════════════════ */
export function addMonths(m,n){
  const[y,mo]=m.split('-').map(Number);
  const d=new Date(y,mo-1+n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
export function monthDiff(a,b){
  const[ay,am]=a.split('-').map(Number);
  const[by,bm]=b.split('-').map(Number);
  return(by-ay)*12+(bm-am);
}
export function fmtMonth(m){
  const[y,mo]=m.split('-').map(Number);
  const mon=new Date(y,mo-1).toLocaleDateString('en-US',{month:'short'});
  return`${mon} '${String(y).slice(2)}`;
}
export function fmtMonthLong(m){
  const[y,mo]=m.split('-').map(Number);
  return new Date(y,mo-1).toLocaleDateString('en-US',{month:'long',year:'numeric'});
}
export function fmtMonthShort(m){
  const[y,mo]=m.split('-').map(Number);
  return new Date(y,mo-1).toLocaleDateString('en-US',{month:'short'});
}
export function ratioToBarColor(ratio){
  if(ratio<0)return null;
  if(ratio<0.7)return'#EF4444';   // red   — big gap
  if(ratio<1.0)return'#F59E0B';   // amber — small gap
  if(ratio<1.05)return'#3B82F6';  // blue  — at demand (shows ✓)
  return'#22C55E';                 // green — surplus
}
export function currentMonth(){
  const n=new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
}
export function formatRelTime(ts){
  const s=(Date.now()-ts)/1000;
  if(s<60)return'just now';
  if(s<3600)return`${Math.floor(s/60)}m ago`;
  if(s<86400)return`${Math.floor(s/3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}
