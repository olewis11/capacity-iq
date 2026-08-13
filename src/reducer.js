/* ═══════════════════════════════════════════════════════════════
   REDUCER
═══════════════════════════════════════════════════════════════ */
export function reducer(state,action){
  switch(action.type){
    case 'SET_VIEW_START':return{...state,viewStart:action.month};
    case 'ADD_ASSIGNMENT':return{...state,assignments:[...state.assignments,action.assignment]};
    case 'REMOVE_ASSIGNMENT':return{...state,assignments:state.assignments.filter(a=>a.id!==action.id)};
    case 'EXTEND_ASSIGNMENT':return{...state,assignments:state.assignments.map(a=>a.id===action.id?{...a,endMonth:action.endMonth}:a)};
    case 'UPDATE_ASSIGNMENT':return{...state,assignments:state.assignments.map(a=>a.id===action.id?{...a,...action.updates}:a)};
    case 'UPDATE_PROJECT':return{...state,projects:state.projects.map(p=>p.id===action.project.id?action.project:p)};
    case 'ADD_PROJECT':return{...state,projects:[...state.projects,action.project]};
    case 'REORDER_PROJECTS':{
      const{fromId,toId,after}=action;
      const arr=[...state.projects];
      const fromIdx=arr.findIndex(p=>p.id===fromId);
      const [moved]=arr.splice(fromIdx,1);
      const toIdx=arr.findIndex(p=>p.id===toId);
      arr.splice(after?toIdx+1:toIdx,0,moved);
      return{...state,projects:arr};
    }
    case 'DELETE_PROJECT':
      return{...state,
        projects:state.projects.filter(p=>p.id!==action.id),
        assignments:state.assignments.filter(a=>a.projectId!==action.id),
      };
    case 'IMPORT_DATA':
    case 'LOAD_STATE':{
      /* A4: filter orphaned assignments whose engineerId or projectId no longer exists */
      const eIds=new Set((action.engineers||[]).map(e=>e.id));
      const pIds=new Set((action.projects||[]).map(p=>p.id));
      const validAssignments=(action.assignments||[]).filter(a=>eIds.has(a.engineerId)&&pIds.has(a.projectId));
      return{...state,projects:action.projects,engineers:action.engineers,
        assignments:validAssignments,
        discMeta:action.discMeta!==undefined?action.discMeta:state.discMeta,
        tierOrder:action.tierOrder!==undefined?action.tierOrder:state.tierOrder};
    }
    case 'MERGE_IMPORT':{
      const newById=new Map(action.engineers.map(e=>[e.id,e]));
      const existingIds=new Set(state.engineers.map(e=>e.id));
      const remap=action.discKeyRemap||{};
      const merged=state.engineers.map(e=>{
        const fresh=newById.get(e.id);
        if(fresh)return{...e,...fresh,inactive:false};
        if(action.departedIds?.has(e.id))return{...e,inactive:true};
        // Apply disc key remap for engineers from other BUs not in this import
        const remappedDisc=remap[e.discipline];
        return remappedDisc?{...e,discipline:remappedDisc}:e;
      });
      action.engineers.forEach(e=>{if(!existingIds.has(e.id))merged.push(e);});
      const mergedDiscMeta={...state.discMeta,...(action.discMeta||{})};
      // Remove old disc keys that have been renamed to BU-prefixed keys
      Object.entries(remap).forEach(([oldKey,newKey])=>{
        if(action.discMeta?.[newKey])delete mergedDiscMeta[oldKey];
      });
      // Migrate project demand keys from old disc keys to new BU-prefixed keys
      const remapKeys=Object.keys(remap);
      const projects=remapKeys.length?state.projects.map(p=>{
        const d=p.demand||{};
        const md=p.monthlyDemand||{};
        if(!remapKeys.some(k=>k in d||Object.values(md).some(m=>k in m)))return p;
        const demand={...d};
        remapKeys.forEach(k=>{if(k in demand){demand[remap[k]]=demand[k];delete demand[k];}});
        const monthlyDemand={};
        Object.keys(md).forEach(m=>{
          const ms={...md[m]};
          remapKeys.forEach(k=>{if(k in ms){ms[remap[k]]=ms[k];delete ms[k];}});
          monthlyDemand[m]=ms;
        });
        return{...p,demand,monthlyDemand};
      }):state.projects;
      return{...state,engineers:merged,discMeta:mergedDiscMeta,projects};
    }
    case 'SET_TIER_ORDER':return{...state,tierOrder:action.tierOrder};
    case 'DELETE_ENGINEER':
      return{...state,
        engineers:state.engineers.filter(e=>e.id!==action.id),
        assignments:state.assignments.filter(a=>a.engineerId!==action.id)};
    case 'UPDATE_ENGINEER':
      return{...state,engineers:state.engineers.map(e=>e.id===action.id?{...e,...action.updates}:e)};
    case 'REPARENT_DISC':{
      const TKEYS=['bu','dept','discipline','subdisc'];
      const newMeta={...state.discMeta};
      if(action.nKey!==undefined){
        // Structural reparent: place node N (depth nDepth, key nKey) as a child of target T
        // (depth tDepth, path tPath), preserving N's internal hierarchy.
        const{nDepth,nKey,tDepth,tPath}=action;
        action.discs.forEach(disc=>{
          if(!newMeta[disc])return;
          const old=newMeta[disc];
          // Relative path of this disc below N's depth (tiers nDepth+1 … 3)
          const relPath=TKEYS.slice(nDepth+1).map(k=>old[k]??null);
          // Rebuild tier fields only; preserve non-tier meta (color, abbr, etc.)
          const tier={};
          TKEYS.forEach((k,i)=>{if(i<=tDepth&&tPath[k]!=null)tier[k]=tPath[k];});
          const nNewTier=tDepth+1;
          if(nNewTier<4)tier[TKEYS[nNewTier]]=nKey;
          relPath.forEach((v,i)=>{const t=tDepth+2+i;if(t<4&&v!=null)tier[TKEYS[t]]=v;});
          const nonTier=Object.fromEntries(Object.entries(old).filter(([k])=>!TKEYS.includes(k)));
          newMeta[disc]={...nonTier,...tier};
        });
      }else{
        // Flat reparent for leaf disc nodes
        action.discs.forEach(disc=>{
          if(!newMeta[disc])return;
          const m={...newMeta[disc],bu:action.newBU};
          if(action.newDept!=null){m.dept=action.newDept;}else{delete m.dept;}
          if(action.newDiscipline)m.discipline=action.newDiscipline;else delete m.discipline;
          if(action.newSubdisc)m.subdisc=action.newSubdisc;else delete m.subdisc;
          newMeta[disc]=m;
        });
      }
      return{...state,discMeta:newMeta};
    }
    default:return state;
  }
}
