/* ═══════════════════════════════════════════════════════════════
   CONSTANTS & PURE HELPERS
═══════════════════════════════════════════════════════════════ */
export const DEFAULT_DISC_META={
  Software:  {color:'#3B82F6',bg:'#DBEAFE',border:'#93C5FD',abbr:'SW',bu:'SW'},
  Electrical:{color:'#8B5CF6',bg:'#EDE9FE',border:'#C4B5FD',abbr:'EE',bu:'HW'},
  Mechanical:{color:'#10B981',bg:'#D1FAE5',border:'#6EE7B7',abbr:'ME',bu:'HW'},
  Firmware:  {color:'#F59E0B',bg:'#FEF3C7',border:'#FCD34D',abbr:'FW',bu:'SW'},
};
/* Palette for dynamically-imported disciplines */
export const DISC_PALETTE_SW=[
  {color:'#3B82F6',bg:'#DBEAFE',border:'#93C5FD'},
  {color:'#0EA5E9',bg:'#E0F2FE',border:'#7DD3FC'},
  {color:'#6366F1',bg:'#EEF2FF',border:'#A5B4FC'},
  {color:'#8B5CF6',bg:'#EDE9FE',border:'#C4B5FD'},
];
export const DISC_PALETTE_HW=[
  {color:'#10B981',bg:'#D1FAE5',border:'#6EE7B7'},
  {color:'#14B8A6',bg:'#CCFBF1',border:'#5EEAD4'},
];
export const DISC_PALETTE_OTHER=[
  {color:'#F59E0B',bg:'#FEF3C7',border:'#FCD34D'},
  {color:'#F97316',bg:'#FFF7ED',border:'#FED7AA'},
  {color:'#EF4444',bg:'#FEE2E2',border:'#FCA5A5'},
  {color:'#EC4899',bg:'#FCE7F3',border:'#F9A8D4'},
];
/* Group-level metadata (HW / SW / SEIT) */
export const GROUP_META={
  SW:   {color:'#2563EB',label:'Software'},
  HW:   {color:'#059669',label:'Hardware'},
  SEIT: {color:'#B45309',label:'Sys Eng & Test'},
  PM:   {color:'#7C3AED',label:'Product Mgmt'},
  Other:{color:'#6B7280',label:'Other'},
};
export const SUPERADMIN_EMAIL='admin@example.com';
export const ROLE_LABELS={admin:'Admin',pm:'Program Manager',fm:'Functional Manager',viewer:'Viewer'};
export const PROJECT_COLORS=['#3B82F6','#10B981','#8B5CF6','#F59E0B','#EF4444','#EC4899','#06B6D4','#84CC16'];
/* Department-based org chart color palette */
export const DEPT_PALETTE=[
  {bold:'#1D4ED8',boldBd:'#1E40AF',light:'#DBEAFE',lightBd:'#93C5FD',textLight:'#1E40AF'},  // Blue
  {bold:'#7C3AED',boldBd:'#6D28D9',light:'#EDE9FE',lightBd:'#C4B5FD',textLight:'#5B21B6'},  // Violet
  {bold:'#A21CAF',boldBd:'#86198F',light:'#FAE8FF',lightBd:'#F0ABFC',textLight:'#86198F'},  // Fuchsia
  {bold:'#BE123C',boldBd:'#9F1239',light:'#FFE4E6',lightBd:'#FDA4AF',textLight:'#9F1239'},  // Rose
  {bold:'#EA580C',boldBd:'#C2410C',light:'#FFEDD5',lightBd:'#FDBA74',textLight:'#9A3412'},  // Orange
  {bold:'#D97706',boldBd:'#B45309',light:'#FEF3C7',lightBd:'#FCD34D',textLight:'#92400E'},  // Amber
  {bold:'#059669',boldBd:'#047857',light:'#D1FAE5',lightBd:'#6EE7B7',textLight:'#065F46'},  // Emerald
  {bold:'#0F766E',boldBd:'#115E59',light:'#CCFBF1',lightBd:'#5EEAD4',textLight:'#115E59'},  // Teal
];

export function stripParentPrefix(name,parentName){
  if(!parentName)return name;
  const prefix=parentName+' - ';
  return name.startsWith(prefix)?name.slice(prefix.length):name;
}
/* Blend two hex colors: t=0 → c1, t=1 → c2 */
export function blendHex(c1,c2,t){
  const h=(s,i)=>parseInt(s.slice(i,i+2),16);
  const mix=(a,b)=>Math.round(a+(b-a)*t).toString(16).padStart(2,'0');
  return`#${mix(h(c1,1),h(c2,1))}${mix(h(c1,3),h(c2,3))}${mix(h(c1,5),h(c2,5))}`;
}
/* Returns bg/border/text colors for a dept palette entry at a given depth (1=boldest) */
export function tierBlend(p,depth){
  const t=Math.min(1,(depth-1)/3);
  return{
    bg:blendHex(p.bold,p.light,t),
    bd:blendHex(p.boldBd,p.lightBd,t),
    textColor:t<0.5?'#fff':p.textLight,
    subTextColor:t<0.5?'rgba(255,255,255,.75)':p.textLight,
  };
}
/* Engineer role helpers — used in all views */
export const isDirectorEng=e=>/director|\bVP\b/i.test(e.title||'');
export const isManagerEng=e=>/manager|director|supervisor|\bVP\b/i.test(e.title||'');
/* Sort key: directors first, managers second, regulars third, contractors last */
export function engSortKey(eng){
  if(eng.isContractor)return 3;
  if(isDirectorEng(eng))return 0;
  if(isManagerEng(eng))return 1;
  return 2;
}
export function sortEngs(a,b){
  const d=engSortKey(a)-engSortKey(b);
  return d!==0?d:a.name.localeCompare(b.name);
}
/* Allocation percentage → indicator colour (fully staffed/partial/unassigned) */
export function getColorForAlloc(pct){return pct>=100?'#15803D':pct>0?'#1D4ED8':'#D97706';}
