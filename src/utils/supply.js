/* ═══════════════════════════════════════════════════════════════
   SUPPLY HELPERS
═══════════════════════════════════════════════════════════════ */
import {roundHalf} from './demand.js';

/* Accept engineers as an Array (O(n) find) or Map<id,engineer> (O(1) get) */
function lookupEng(engineers,id){return engineers instanceof Map?engineers.get(id):engineers.find(x=>x.id===id);}

export function getSupply(assignments,engineers,projectId,disc,month){
  return roundHalf(assignments
    .filter(a=>a.projectId===projectId&&a.startMonth<=month&&a.endMonth>=month)
    .reduce((sum,a)=>{
      const e=lookupEng(engineers,a.engineerId);
      return e&&!e.inactive&&e.discipline===disc?sum+a.allocation/100:sum;
    },0));
}
export function getAssigned(assignments,engineers,projectId,disc,month){
  return assignments
    .filter(a=>a.projectId===projectId&&a.startMonth<=month&&a.endMonth>=month)
    .reduce((acc,a)=>{
      const e=lookupEng(engineers,a.engineerId);
      if(e&&!e.inactive&&e.discipline===disc)acc.push({eng:e,assignment:a});
      return acc;
    },[]);
}
export function getEngineerTotalAlloc(assignments,month,engineerId){
  return assignments
    .filter(a=>a.engineerId===engineerId&&a.startMonth<=month&&a.endMonth>=month)
    .reduce((s,a)=>s+a.allocation,0);
}
export function getOrgSupply(assignments,engineers,disc,month){
  return roundHalf(assignments
    .filter(a=>a.startMonth<=month&&a.endMonth>=month)
    .reduce((sum,a)=>{
      const e=lookupEng(engineers,a.engineerId);
      return e&&!e.inactive&&e.discipline===disc?sum+a.allocation/100:sum;
    },0));
}
