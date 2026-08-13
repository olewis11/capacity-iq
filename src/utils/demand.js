/* ═══════════════════════════════════════════════════════════════
   DEMAND CURVE
═══════════════════════════════════════════════════════════════ */
import {monthDiff} from './months.js';

export function roundHalf(v){return Math.round(v*2)/2;}
/* Strip parent path segments from a disc name for compact display */
export function leafName(n){const p=n.split(' - ');return p[p.length-1];}
export function getDemand(project,disc,month,activeMeta){
  if(month<project.startMonth||month>project.endMonth)return 0;
  /* Monthly override at disc level takes priority — even when peak baseline is 0 */
  if(project.monthlyDemand?.[disc]?.[month]!==undefined)return project.monthlyDemand[disc][month];
  /* Try raw disc key first; fall back to demand key (subsubgroup→subgroup→group) for SettingsModal compat */
  let peak=(project.demand||{})[disc];
  if(peak===undefined&&activeMeta){
    const m=activeMeta[disc]||{};
    const dk=m.discipline||m.dept||m.bu||disc;
    if(dk!==disc)peak=(project.demand||{})[dk];
  }
  peak=peak||0;
  if(peak===0)return 0;
  let value=peak;
  const idx=monthDiff(project.startMonth,month);
  const total=monthDiff(project.startMonth,project.endMonth)+1;
  if(project.rampUp?.enabled&&(project.rampUp.months||0)>0){const r=project.rampUp.months;if(idx<r)value=roundHalf(peak*((idx+1)/r));}
  if(project.rampDown?.enabled&&(project.rampDown.months||0)>0){const r=project.rampDown.months;const fromEnd=total-1-idx;if(fromEnd<r)value=Math.min(value,roundHalf(peak*((fromEnd+1)/r)));}
  return value;
}
/* Demand at the discipline-group level (SW / HW / SEIT / PM).
   project.demand keys are group names; ramp logic is identical to getDemand. */
export function getGroupDemand(project,group,month){
  const peak=project.demand[group]||0;
  if(peak===0)return 0;
  if(month<project.startMonth||month>project.endMonth)return 0;
  if(project.monthlyDemand?.[group]?.[month]!==undefined)return project.monthlyDemand[group][month];
  let value=peak;
  const idx=monthDiff(project.startMonth,month);
  const total=monthDiff(project.startMonth,project.endMonth)+1;
  if(project.rampUp?.enabled&&(project.rampUp.months||0)>0){const r=project.rampUp.months;if(idx<r)value=roundHalf(peak*((idx+1)/r));}
  if(project.rampDown?.enabled&&(project.rampDown.months||0)>0){const r=project.rampDown.months;const fromEnd=total-1-idx;if(fromEnd<r)value=Math.min(value,roundHalf(peak*((fromEnd+1)/r)));}
  return value;
}
