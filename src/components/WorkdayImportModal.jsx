const {useState,useRef,useEffect,useMemo}=React;
import {DISC_PALETTE_SW,DISC_PALETTE_HW,DISC_PALETTE_OTHER,DEPT_PALETTE,tierBlend,stripParentPrefix} from '../constants.js';

export function WorkdayImportModal({onClose,onImport,existingEngineers=[]}){
  const[step,setStep]=useState('upload');
  const[confirmReplace,setConfirmReplace]=useState(false);
  const[importMode,setImportMode]=useState(()=>existingEngineers.some(e=>e.id.startsWith('wd_'))?'merge':'replace');
  const[markDeparted,setMarkDeparted]=useState(false);
  const[rawParsed,setRawParsed]=useState(null);
  const[excluded,setExcluded]=useState(new Set());
  const[collapsed,setCollapsed]=useState(new Set());
  const[customTree,setCustomTree]=useState([]);
  const[dragging,setDragging]=useState(null);   // {srcIdx}
  const[chartDrop,setChartDrop]=useState(null); // {id} — highlighted drop target in chart
  const[chartTooltip,setChartTooltip]=useState(null); // {nodeId,name,displayName,subteams,directPeople,x,y}
  const[tierMap,setTierMap]=useState(null);
  const[detectedBU,setDetectedBU]=useState(null);
  const[error,setError]=useState(null);
  const fileRef=useRef(null);
  useEffect(()=>{
    const h=e=>{if(e.key==='Escape')onClose();};
    document.addEventListener('keydown',h);
    return()=>document.removeEventListener('keydown',h);
  },[onClose]);
  function parseCSVRow(line){
    const v=[];let c='',q=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='"'){if(q&&line[i+1]==='"'){c+='"';i++;}else q=!q;}
      else if(ch===','&&!q){v.push(c);c='';}
      else c+=ch;
    }
    v.push(c);return v;
  }
  function detectBU(people){
    const counts={};
    people.forEach(p=>{
      if(!p.orgName)return;
      const m=p.orgName.match(/^([^:]{2,40}):/);
      if(m){const bu=m[1].trim();counts[bu]=(counts[bu]||0)+1;}
    });
    const entries=Object.entries(counts);
    if(!entries.length)return null;
    return entries.sort((a,b)=>b[1]-a[1])[0][0];
  }
  function buildDepths(people){
    const roots=people.filter(p=>!p.reportsTo);
    if(!roots.length)return{};
    const depths={},queue=roots.map(r=>({uid:r.uid,d:0}));
    while(queue.length){
      const{uid,d}=queue.shift();
      if(uid in depths)continue; // skip already-visited (handles cycles and multi-root forests)
      depths[uid]=d;
      people.filter(p=>p.reportsTo===uid).forEach(c=>queue.push({uid:c.uid,d:d+1}));
    }
    return depths;
  }

  function shortName(orgName){
    if(!orgName)return'Unresolved';
    // Strip any "BU:" prefix (word/space chars before a colon) — e.g. "Stretch:", "Atlas:"
    let s=orgName.replace(/^[^:]{2,40}:\s*/,'').replace(/\s*\([^)]+\)\s*$/,'').trim();
    s=s.replace(/^Software\s*-\s*/i,'SW - ').replace(/^Hardware\s*-\s*/i,'HW - ')
       .replace(/^Hardware$/i,'HW').replace(/^Software$/i,'SW')
       .replace(/\bElectrical Engineering\b/g,'Electrical')
       .replace(/\bMechanical Engineering\b/g,'Mechanical')
       .replace(/\bSystems Engineering, Integration & Test\b/g,'SEIT')
       .replace(/\bProduct Management\b/g,'PM');
    // If substitutions reduced the name to nothing, return the trimmed original minus any parenthetical
    if(!s)s=orgName.replace(/\s*\([^)]+\)\s*$/,'').trim();
    return s||'Unresolved';
  }
  function makeAbbr(name){
    if(['SEIT','PM','HW','SW'].includes(name))return name;
    const m=name.match(/^(?:SW|HW)\s*-\s*(.+)/i);
    if(m)return m[1].trim().slice(0,2).toUpperCase();
    return name.replace(/\s/g,'').slice(0,2).toUpperCase();
  }
  function parsePeople(hdrs,rows){
    if(!hdrs.includes('Unique Identifier'))
      throw new Error('Missing "Unique Identifier" column — is this a Workday org chart export?');
    const idx=h=>hdrs.indexOf(h);
    const people=rows.map(v=>{
      const raw=String(v[idx('Name')]||'').trim();
      return{
        uid:String(v[idx('Unique Identifier')]||'').trim(),
        name:raw.replace(/\s*\[C\]\s*$/,'').trim(),
        isContractor:/\[C\]/.test(raw),
        reportsTo:String(v[idx('Reports To')]||'').trim()||null,
        title:String(v[idx('Line Detail 1')]||'').trim(),
        orgName:String(v[idx('Organization Name')]||'').trim(),
      };
    }).filter(p=>p.uid&&p.name);
    const idMap={};people.forEach(p=>idMap[p.uid]=p);
    const depths=buildDepths(people);
    setDetectedBU(detectBU(people));
    setRawParsed({people,idMap,depths});
    setStep('preview');
  }
  function handleFile(file){
    if(!file)return;
    setError(null);
    const isXlsx=file.name.toLowerCase().endsWith('.xlsx')||
      file.type==='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if(isXlsx){
      if(!window.XLSX){setError('XLSX parser not loaded — please refresh the page and try again.');return;}
      const reader=new FileReader();
      reader.onload=e=>{
        try{
          const wb=window.XLSX.read(new Uint8Array(e.target.result),{type:'array'});
          const ws=wb.Sheets[wb.SheetNames[0]];
          const all=window.XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
          if(!all.length)throw new Error('Empty spreadsheet');
          parsePeople(all[0].map(h=>String(h||'').trim()),all.slice(1));
        }catch(err){setError(err.message);}
      };
      reader.readAsArrayBuffer(file);
    }else{
      const reader=new FileReader();
      reader.onload=e=>{
        try{
          const lines=e.target.result.replace(/\r/g,'').trim().split('\n');
          parsePeople(parseCSVRow(lines[0]).map(h=>h.trim()),lines.slice(1).map(l=>parseCSVRow(l)));
        }catch(err){setError(err.message);}
      };
      reader.readAsText(file);
    }
  }
  /* Collect unique depth levels and sample org names for the tier config UI */
  const depthSamples=useMemo(()=>{
    if(!rawParsed)return{allDepths:[],samples:{}};
    const{people,depths}=rawParsed;
    const s={};
    people.forEach(p=>{
      const d=depths[p.uid];
      if(d!==undefined&&p.orgName){if(!s[d])s[d]=new Set();s[d].add(shortName(p.orgName)||p.orgName);}
    });
    const allDepths=Object.keys(s).map(Number).sort((a,b)=>a-b);
    return{allDepths,samples:Object.fromEntries(allDepths.map(d=>[d,[...s[d]].sort().slice(0,2)]))};
  },[rawParsed]);
  /* Auto-init tierMap when file is first parsed — skip depths where shortName returns empty */
  useEffect(()=>{
    if(!rawParsed)return;
    // Filter to depths that produce at least one meaningful (non-empty, non-Unresolved) short name.
    // When detectedBU is set, depth 0 is the BU root itself — skip it so tiers shift up correctly.
    const useful=depthSamples.allDepths.filter(d=>{
      if(detectedBU&&d===0)return false;
      const samples=depthSamples.samples[d]||[];
      return samples.some(name=>{const v=shortName(name);return v&&v!=='Unresolved';});
    });
    const n=useful.length;
    if(detectedBU){
      // BU occupies the bu slot synthetically; shift depth tiers down one
      setTierMap({
        bu:         null,
        dept:       n>=1?useful[0]:null,
        discipline: n>=3?useful[1]:null,
        subdisc:    n>=4?useful[2]:null,
        disc:       n>=1?useful[n-1]:null,
      });
    }else{
      setTierMap({
        bu:         n>=1?useful[0]:null,
        dept:       n>=3?useful[1]:null,
        discipline: n>=4?useful[2]:null,
        subdisc:    n>=5?useful[3]:null,
        disc:       n>=1?useful[n-1]:null,
      });
    }
  // eslint-disable-next-line
  },[rawParsed,detectedBU]);
  /* Resolve all org tiers for a person using the configured tierMap (or auto-detect).
     When buName is supplied it becomes the group tier and is prepended to the disc key
     so disc keys are globally unique across BUs. */
  function resolveAllTiers(person,idMap,depths,tm,buName){
    let cur=person;
    const seen=new Set();
    const byDepth={};
    while(cur&&!seen.has(cur.uid)){
      seen.add(cur.uid);
      const d=depths[cur.uid];
      if(d!==undefined&&cur.orgName&&!(d in byDepth))byDepth[d]=cur.orgName;
      cur=cur.reportsTo?idMap[cur.reportsTo]:null;
    }
    // When detectedBU is set (colon format), extract this person's actual BU from their
    // depth-0 ancestor's orgName rather than using the global detectedBU for everyone.
    let effectiveBU=buName;
    if(buName&&(0 in byDepth)){
      const m=byDepth[0].match(/^([^:]{2,40}):/);
      if(m)effectiveBU=m[1].trim();
    }
    // sn: get shortName at depth d; treat empty string as null (depth exists but name is meaningless)
    const sn=d=>{
      if(d==null)return null;
      const v=shortName(byDepth[d]);
      return(v&&v!=='Unresolved')?v:null;
    };
    const ds=Object.keys(byDepth).map(Number).sort((a,b)=>a-b);
    if(tm){
      // Disc fallback: if configured depth isn't in this person's chain, use their deepest valid depth
      let disc=sn(tm.disc);
      if(!disc){for(let i=ds.length-1;i>=0;i--){disc=sn(ds[i]);if(disc)break;}}
      const rawDisc=disc||'Unresolved';
      const buVal=effectiveBU||sn(tm.bu);
      const deptVal=sn(tm.dept);
      return{
        bu:             buVal,
        dept:           deptVal===buVal?null:deptVal,
        discipline:     sn(tm.discipline),
        subdisc:        sn(tm.subdisc),
        disc:           effectiveBU?(effectiveBU+' - '+rawDisc):rawDisc,
      };
    }
    const n=ds.length;
    const rawDisc=n>=1?(()=>{for(let i=n-1;i>=0;i--){const v=sn(ds[i]);if(v)return v;}return'Unresolved';})():'Unresolved';
    const buVal=effectiveBU||(n>=1?sn(ds[0]):null);
    const deptVal=n>=3?sn(ds[1]):null;
    return{
      bu:             buVal,
      dept:           deptVal===buVal?null:deptVal,
      discipline:     n>=4?sn(ds[2]):null,
      subdisc:        n>=5?sn(ds[n-2]):null,
      disc:           effectiveBU?(effectiveBU+' - '+rawDisc):rawDisc,
    };
  }
  /* Recompute groups (leaf→people) and teamMeta (leaf→{group,subgroup,subsubgroup}) */
  const{groups,teamMeta}=useMemo(()=>{
    if(!rawParsed||!tierMap)return{groups:{},teamMeta:{}};
    const{people,idMap,depths}=rawParsed;
    const g={},m={};
    people.forEach(p=>{
      const tiers=resolveAllTiers(p,idMap,depths,tierMap,detectedBU);
      const key=tiers.disc;
      if(!g[key]){g[key]=[];m[key]={bu:tiers.bu,dept:tiers.dept,discipline:tiers.discipline,subdisc:tiers.subdisc};}
      g[key].push(p);
    });
    return{groups:g,teamMeta:m};
  // eslint-disable-next-line
  },[rawParsed,tierMap,detectedBU]);
  /* Reset exclusions: only exclude Unresolved by default */
  const groupsKey=Object.keys(groups).sort().join(',');
  useEffect(()=>{
    setExcluded(new Set(Object.keys(groups).filter(k=>!k||k==='Unresolved')));
  // eslint-disable-next-line
  },[groupsKey]);
  function getDiscGroup(team){
    if(team.startsWith('SW'))return'SW';
    if(team.startsWith('HW'))return'HW';
    if(team==='SEIT')return'SEIT';
    if(team==='PM')return'PM';
    return'Other';
  }
  function fmtChange({field,from,to}){
    const tr=s=>(s||'').length>32?(s||'').slice(0,32)+'…':s||'';
    if(field==='contractor')return to?'contractor [C] added':'contractor [C] removed';
    if(field==='discipline')return`team: ${tr(from)} → ${tr(to)}`;
    if(field==='title')return`title: "${tr(from)}" → "${tr(to)}"`;
    if(field==='name')return`name: "${tr(from)}" → "${tr(to)}"`;
    return field;
  }
  function deriveEmail(name){
    const parts=name.trim().split(/\s+/);
    if(parts.length<2)return'';
    return(parts[0][0]+parts[parts.length-1]).toLowerCase()+'@example.com';
  }
  function doImport(){
    function getHierarchy(flat,li){
      const leaf=flat[li];
      const r={bu:null,dept:null,discipline:null,subdisc:null};
      const dk={0:'bu',1:'dept',2:'discipline',3:'subdisc'};
      for(let i=li-1;i>=0;i--){
        const n=flat[i];
        if(n.type==='header'&&n.depth<leaf.depth){const k=dk[n.depth];if(k&&!r[k])r[k]=n.name;}
        if(n.depth===0&&r.bu)break;
      }
      return r;
    }
    const discMeta={};let swI=0,hwI=0,otI=0;
    customTree.forEach((node,idx)=>{
      if(node.type!=='leaf'||excluded.has(node.name))return;
      const team=node.name;
      const hier=getHierarchy(customTree,idx);
      const group=hier.bu||getDiscGroup(team);
      const{dept,discipline,subdisc}=hier;
      // Use dept (SW/HW) for palette when BU is the group; otherwise use group itself
      const palSrc=dept||group;
      const palUp=(palSrc||'').toUpperCase();
      let pal,i;
      if(palUp==='SW'||palUp.startsWith('SW')){pal=DISC_PALETTE_SW;i=swI++;}
      else if(palUp==='HW'||palUp.startsWith('HW')){pal=DISC_PALETTE_HW;i=hwI++;}
      else{pal=DISC_PALETTE_OTHER;i=otI++;}
      // Strip BU prefix for abbreviation so "Stretch - SW - Autonomy - X" → makeAbbr("SW - Autonomy - X")
      const teamForAbbr=detectedBU&&team.startsWith(detectedBU+' - ')?team.slice(detectedBU.length+3):team;
      // BU-prefix dept/discipline/subdisc so hierarchy keys are unique across BUs
      // (e.g. "Hardware" → "Spot - Hardware") preventing cross-BU tier collisions in discGroupMap
      const pref=detectedBU&&group&&group!=='Other'?group+' - ':'';
      discMeta[team]={
        ...pal[i%pal.length],abbr:makeAbbr(teamForAbbr),bu:group||'Other',
        ...(dept?{dept:pref+dept}:{}),
        ...(discipline?{discipline:pref+discipline}:{}),
        ...(subdisc?{subdisc:pref+subdisc}:{}),
      };
    });
    const engineers=customTree
      .filter(n=>n.type==='leaf'&&!excluded.has(n.name))
      .flatMap(n=>(groups[n.name]||[]).map(p=>({
        id:`wd_${p.uid}`,name:p.name,discipline:n.name,
        title:p.title||'',isContractor:p.isContractor||false,email:deriveEmail(p.name),
      })));
    const{idMap}=rawParsed;
    const managerMap={};
    customTree.filter(n=>n.type==='leaf'&&!excluded.has(n.name)).forEach(n=>{
      const disc=n.name;
      (groups[disc]||[]).forEach(p=>{
        if(!p.reportsTo)return;
        const mgr=idMap[p.reportsTo];if(!mgr)return;
        const email=deriveEmail(mgr.name);if(!email)return;
        if(!managerMap[email])managerMap[email]={email,name:mgr.name,managedDiscs:new Set()};
        managerMap[email].managedDiscs.add(disc);
      });
    });
    const managerUsers=Object.values(managerMap).map(u=>({...u,managedDiscs:[...u.managedDiscs]}));
    const departedIds=markDeparted&&importDiff?.departed?new Set(importDiff.departed.map(e=>e.id)):new Set();
    onImport(engineers,discMeta,importMode,departedIds,detectedBU,managerUsers);
  }
  /* Build 5-tier tree: group→subgroup→subsubgroup→subsubsubgroup→[leafTeams] */
  const{tree,groupOrder}=useMemo(()=>{
    const t={};
    Object.keys(groups).forEach(team=>{
      const meta=teamMeta[team]||{};
      const grp=meta.bu||'(Unresolved)';
      const sg=meta.dept||'_root';
      const ssg=meta.discipline||'_root';
      const sssg=meta.subdisc||'_root';
      if(!t[grp])t[grp]={};
      if(!t[grp][sg])t[grp][sg]={};
      if(!t[grp][sg][ssg])t[grp][sg][ssg]={};
      if(!t[grp][sg][ssg][sssg])t[grp][sg][ssg][sssg]=[];
      t[grp][sg][ssg][sssg].push(team);
    });
    const order=Object.keys(t).sort((a,b)=>{
      if(a==='(Unresolved)')return 1;if(b==='(Unresolved)')return-1;return a.localeCompare(b);
    });
    return{tree:t,groupOrder:order};
  },[groups,teamMeta]);
  /* Convert nested 5-tier tree → flat array for reorder/collapse/indent UI */
  function treeToFlat(t,gOrder){
    const flat=[];
    const sf=(a,b)=>a==='_root'?-1:b==='_root'?1:a.localeCompare(b);
    gOrder.forEach(grp=>{
      flat.push({id:`h0:${grp}`,type:'header',depth:0,name:grp});
      Object.keys(t[grp]||{}).sort(sf).forEach(sg=>{
        const h1=sg!=='_root';
        if(h1)flat.push({id:`h1:${grp}/${sg}`,type:'header',depth:1,name:sg});
        const pd1=h1?1:0;
        Object.keys(t[grp][sg]||{}).sort(sf).forEach(ssg=>{
          const h2=ssg!=='_root';
          if(h2)flat.push({id:`h2:${grp}/${sg}/${ssg}`,type:'header',depth:2,name:ssg});
          const pd2=h2?2:pd1;
          Object.keys(t[grp][sg][ssg]||{}).sort(sf).forEach(sssg=>{
            const h3=sssg!=='_root';
            if(h3)flat.push({id:`h3:${grp}/${sg}/${ssg}/${sssg}`,type:'header',depth:3,name:sssg});
            const pd3=h3?3:pd2;
            (t[grp][sg][ssg][sssg]||[]).slice().sort((a,b)=>a.localeCompare(b)).forEach(team=>{
              flat.push({id:`leaf:${team}`,type:'leaf',depth:pd3+1,name:team});
            });
          });
        });
      });
    });
    return flat;
  }
  /* Rebuild customTree when tier config changes; reset collapse state */
  useEffect(()=>{
    if(!rawParsed||!tierMap)return;
    setCustomTree(treeToFlat(tree,groupOrder));
    setCollapsed(new Set());
  // eslint-disable-next-line
  },[tree,groupOrder]);
  /* Flat-tree manipulation helpers */
  function subtreeEnd(flat,i){
    const d=flat[i].depth;let j=i+1;
    while(j<flat.length&&flat[j].depth>d)j++;
    return j;
  }
  /* Reparent srcIdx subtree as last child of targetParentIdx */
  function performDropOnParent(srcIdx,targetParentIdx){
    setCustomTree(flat=>{
      const src=flat[srcIdx];
      if(src.type!=='header')return flat;
      const end=subtreeEnd(flat,srcIdx);
      if(targetParentIdx>=srcIdx&&targetParentIdx<end)return flat; // self/descendant
      const tgt=flat[targetParentIdx];
      const dd=(tgt.depth+1)-src.depth;
      // Prevent pushing any header node beyond depth 3 (the deepest supported tier)
      const maxSubHeaderDepth=flat.slice(srcIdx,end).filter(n=>n.type==='header').reduce((mx,n)=>Math.max(mx,n.depth),src.depth);
      if((tgt.depth+1)+(maxSubHeaderDepth-src.depth)>3)return flat;
      const sub=flat.slice(srcIdx,end).map(n=>({...n,depth:n.depth+dd}));
      const without=[...flat.slice(0,srcIdx),...flat.slice(end)];
      const tgtEnd=subtreeEnd(flat,targetParentIdx);
      let ai=tgtEnd>srcIdx?Math.max(0,tgtEnd-(end-srcIdx)):tgtEnd;
      ai=Math.max(0,Math.min(without.length,ai));
      return[...without.slice(0,ai),...sub,...without.slice(ai)];
    });
    setDragging(null);setChartDrop(null);
  }
  const includedKeys=useMemo(()=>
    customTree.filter(n=>n.type==='leaf'&&!excluded.has(n.name)).map(n=>n.name)
  ,[customTree,excluded]);
  const totalImport=useMemo(()=>
    includedKeys.reduce((s,k)=>s+(groups[k]?.length||0),0)
  ,[includedKeys,groups]);
  const importDiff=useMemo(()=>{
    if(!rawParsed||!tierMap||importMode!=='merge'||!existingEngineers.length)return null;
    const newEngs=customTree
      .filter(n=>n.type==='leaf'&&!excluded.has(n.name))
      .flatMap(n=>(groups[n.name]||[]).map(p=>({id:`wd_${p.uid}`,name:p.name,discipline:n.name,title:p.title||'',isContractor:p.isContractor||false})));
    const newIds=new Set(newEngs.map(e=>e.id));
    const exById=new Map(existingEngineers.map(e=>[e.id,e]));
    const exWd=existingEngineers.filter(e=>e.id.startsWith('wd_'));
    const added=newEngs.filter(e=>!exById.has(e.id));
    const updated=newEngs
      .filter(e=>exById.has(e.id))
      .map(e=>{
        const ex=exById.get(e.id);
        const changes=[];
        if(ex.discipline!==e.discipline)changes.push({field:'discipline',from:ex.discipline,to:e.discipline});
        if((ex.title||'')!==(e.title||''))changes.push({field:'title',from:ex.title||'',to:e.title||''});
        if(!!ex.isContractor!==!!e.isContractor)changes.push({field:'contractor',from:!!ex.isContractor,to:!!e.isContractor});
        if(ex.name!==e.name)changes.push({field:'name',from:ex.name,to:e.name});
        return{eng:e,changes};
      })
      .filter(x=>x.changes.length>0);
    // Scope departures to teams in this import — engineers in other BUs are unaffected
    const importedDiscs=new Set(includedKeys);
    const departed=exWd.filter(e=>importedDiscs.has(e.discipline)&&!newIds.has(e.id));
    return{added,updated,departed,scopeCount:importedDiscs.size};
  },[rawParsed,tierMap,importMode,customTree,excluded,groups,existingEngineers]);
  /* ── Org chart: build proper tree from flat array ── */
  const orgRoots=useMemo(()=>{
    const roots=[],ps=[];
    customTree.forEach((node,idx)=>{
      if(node.type==='header'){
        while(ps.length&&ps[ps.length-1].depth>=node.depth)ps.pop();
        const tn={id:node.id,name:node.name,depth:node.depth,idx,children:[],teams:[]};
        if(!ps.length)roots.push(tn);else ps[ps.length-1].children.push(tn);
        ps.push(tn);
      }else if(ps.length){
        ps[ps.length-1].teams.push(node.name);
      }
    });
    function fill(n){
      n.allTeams=[...n.teams];
      n.children.forEach(c=>{fill(c);n.allTeams=n.allTeams.concat(c.allTeams);});
    }
    roots.forEach(fill);
    return roots;
  },[customTree]);
  /* ── Org chart: compute box positions + bezier paths ── */
  const orgLayout=useMemo(()=>{
    const NW=132,NH=48,VG=10,HG=64;
    if(!orgRoots.length)return{pos:{},lines:[],W:200,H:100,NW,NH,HG,maxD:0};
    const pos={},lines=[];
    // span: collapsed nodes count as 1 leaf regardless of children
    function span(n){return(collapsed.has(n.id)||!n.children.length)?1:n.children.reduce((s,c)=>s+span(c),0);}
    function placeLR(nodes,y0){
      let y=y0;
      nodes.forEach(n=>{
        const s=span(n);
        pos[n.id]={x:n.depth*(NW+HG),y:y};
        if(!collapsed.has(n.id))placeLR(n.children,y);
        y+=s*(NH+VG);
      });
    }
    placeLR(orgRoots,10);
    function mkLinesLR(n){
      if(!n.children.length||collapsed.has(n.id))return;
      const np=pos[n.id];if(!np)return;
      const px=np.x+NW,py=np.y+NH/2,mx=px+HG/2;
      n.children.forEach(c=>{
        const cp=pos[c.id];if(!cp)return;
        const cy=cp.y+NH/2;
        lines.push({id:`${n.id}→${c.id}`,d:`M${px},${py} C${mx},${py} ${mx},${cy} ${cp.x},${cy}`});
      });
      n.children.forEach(mkLinesLR);
    }
    orgRoots.forEach(mkLinesLR);
    let maxD=0,leafCt=0;
    function measureLR(n){
      maxD=Math.max(maxD,n.depth);
      if(!n.children.length||collapsed.has(n.id))leafCt++;
      else n.children.forEach(measureLR);
    }
    orgRoots.forEach(measureLR);
    return{pos,lines,W:(maxD+1)*(NW+HG)-HG+24,H:Math.max(leafCt*(NH+VG)+20,80),NW,NH,HG,maxD};
  },[orgRoots,collapsed]);
  /* ── Org chart: dept-color map (depth-1 nodes get distinct bold colors) ── */
  const deptColorMap={};
  (()=>{
    let di=0;
    const fill=(n,pi)=>{const mi=n.depth===1?di++%DEPT_PALETTE.length:pi;deptColorMap[n.id]=mi;n.children.forEach(c=>fill(c,mi));};
    orgRoots.forEach(r=>fill(r,-1));
  })();
  /* ── Org chart: recursively render node boxes ── */
  function renderOrgNodes(nodes,parentName=''){
    const{NW,NH}=orgLayout;
    return nodes.flatMap(node=>{
      const np=orgLayout.pos[node.id];if(!np)return[];
      const isCollapsed=collapsed.has(node.id);
      const hasChildren=node.children.length>0;
      const pc=node.allTeams.reduce((s,t)=>s+(groups[t]?.length||0),0);
      const incl=node.allTeams.filter(t=>!excluded.has(t));
      const allOn=incl.length===node.allTeams.length&&node.allTeams.length>0;
      const someOn=incl.length>0&&!allOn;
      const isSrc=dragging?.srcIdx===node.idx;
      const isTgt=chartDrop?.id===node.id;
      const deptIdx=deptColorMap[node.id]??-1;
      let bg,bd,textColor,subTextColor;
      if(node.depth===0){bg='#F1F5F9';bd=isTgt?'#3B82F6':'#CBD5E1';textColor='#1E293B';subTextColor='#475569';}
      else if(deptIdx<0){bg='#F3F4F6';bd=isTgt?'#3B82F6':'#D1D5DB';textColor='#374151';subTextColor='#6B7280';}
      else{
        const p=DEPT_PALETTE[deptIdx%DEPT_PALETTE.length];
        const tb=tierBlend(p,node.depth);
        bg=tb.bg;bd=isTgt?'#3B82F6':tb.bd;textColor=tb.textColor;subTextColor=tb.subTextColor;
      }
      const displayName=node.name==='(Unresolved)'?'Unresolved':stripParentPrefix(node.name,parentName);
      return[
        <div key={node.id} draggable
          onDragStart={e=>{setDragging({srcIdx:node.idx});e.dataTransfer.effectAllowed='move';}}
          onDragOver={e=>{e.preventDefault();e.stopPropagation();if(dragging&&dragging.srcIdx!==node.idx)setChartDrop({id:node.id});}}
          onDrop={e=>{e.preventDefault();if(dragging&&dragging.srcIdx!==node.idx)performDropOnParent(dragging.srcIdx,node.idx);setDragging(null);setChartDrop(null);}}
          onDragEnd={()=>{setDragging(null);setChartDrop(null);}}
          onClick={e=>{
            e.stopPropagation();
            if(!hasChildren)return;
            if(chartTooltip?.nodeId===node.id){setChartTooltip(null);return;}
            const subteams=node.children.map(c=>({name:c.name,display:stripParentPrefix(c.name,node.name),count:c.allTeams.length}));
            const directPeople=node.teams.flatMap(t=>groups[t]||[]);
            setChartTooltip({nodeId:node.id,name:node.name,displayName,subteams,directPeople,x:e.clientX+14,y:e.clientY-8});
          }}
          style={{position:'absolute',left:np.x,top:np.y,width:NW,height:NH,
            background:bg,border:`${isTgt?2:1}px solid ${bd}`,borderRadius:'8px',
            padding:'4px 8px',boxSizing:'border-box',
            display:'flex',flexDirection:'column',justifyContent:'center',
            cursor:'grab',opacity:isSrc?.25:1,
            boxShadow:isTgt?'0 0 0 3px #3B82F640,0 2px 6px rgba(0,0,0,.1)':'0 1px 3px rgba(0,0,0,.08)',
            userSelect:'none',zIndex:2,transition:'box-shadow .1s,opacity .1s'}}>
          <div style={{display:'flex',alignItems:'center',gap:'3px',minWidth:0}}>
            {hasChildren&&(
              <span onClick={e=>{e.stopPropagation();setCollapsed(s=>{const n=new Set(s);n.has(node.id)?n.delete(node.id):n.add(node.id);return n;});}}
                draggable={false}
                style={{fontSize:'.6rem',lineHeight:1,cursor:'pointer',color:node.depth===1?'rgba(255,255,255,.8)':'#475569',flexShrink:0,
                  width:'14px',textAlign:'center',userSelect:'none'}}>
                {isCollapsed?'▶':'▼'}
              </span>
            )}
            <div style={{fontSize:'.76rem',fontWeight:node.depth===0?700:600,color:textColor,
              whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',lineHeight:1.3,flex:1,minWidth:0}}>
              {displayName}
            </div>
          </div>
          <div style={{fontSize:'.67rem',color:subTextColor,display:'flex',alignItems:'center',gap:'4px',marginTop:'3px'}}>
            <span style={{flex:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
              {pc} {pc===1?'person':'people'} · {node.allTeams.length} {node.allTeams.length===1?'team':'teams'}
            </span>
            <input type="checkbox" checked={allOn}
              ref={el=>{if(el)el.indeterminate=someOn;}}
              onChange={()=>setExcluded(ex=>{const s=new Set(ex);node.allTeams.forEach(t=>allOn?s.add(t):s.delete(t));return s;})}
              onClick={e=>e.stopPropagation()}
              draggable={false}
              style={{width:'11px',height:'11px',cursor:'pointer',flexShrink:0}}/>
          </div>
        </div>,
        ...(!isCollapsed?renderOrgNodes(node.children,node.name):[]),
      ];
    });
  }
  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-modal"
        style={{width:'min(1200px,96vw)',maxWidth:'96vw',maxHeight:'88vh',overflow:'hidden',display:'flex',flexDirection:'column',padding:'20px 24px'}}
        onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px',flexShrink:0}}>
          <h2 style={{margin:0,fontSize:'1rem',fontWeight:700}}>Import Org Chart</h2>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.2rem',color:'var(--text-2)',lineHeight:1,padding:'2px 6px'}}>✕</button>
        </div>
        {step==='upload'&&(
          <div style={{display:'flex',flexDirection:'column',gap:'18px'}}>
            {/* How-to export instructions */}
            <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'10px',padding:'16px 18px'}}>
              <div style={{fontSize:'.8rem',fontWeight:700,color:'var(--text-1)',marginBottom:'12px',letterSpacing:'.02em',textTransform:'uppercase'}}>How to export from Workday</div>
              <ol style={{margin:0,padding:'0 0 0 18px',display:'flex',flexDirection:'column',gap:'7px'}}>
                {[
                  'In Workday, navigate to your org using the search bar (e.g. search your VP or Director\'s name).',
                  'Open the org chart view and click Actions → Export to Spreadsheet → Org Chart.',
                  'In the export dialog, choose "Include all subordinate levels". CSV or XLSX format both work.',
                  'Make sure the export includes these columns: Name, Unique Identifier, Reports To, Line Detail 1 (title), Organization Name.',
                  'Download the file and upload it below.',
                ].map((step,i)=>(
                  <li key={i} style={{fontSize:'.82rem',color:'var(--text-2)',lineHeight:1.5}}>{step}</li>
                ))}
              </ol>
              <div style={{marginTop:'12px',fontSize:'.78rem',color:'var(--text-3)',display:'flex',alignItems:'flex-start',gap:'6px'}}>
                <span style={{fontSize:'1rem',lineHeight:1.3}}>💡</span>
                <span>If you don't have access to export, ask your Workday admin or HR business partner. The file is usually called something like <em>Org_Chart_Export.xlsx</em> or <em>Org_Chart_Export.csv</em>.</span>
              </div>
            </div>
            {error&&(
              <div style={{color:'#B91C1C',fontSize:'.82rem',padding:'8px 12px',background:'#FEF2F2',borderRadius:'6px',border:'1px solid #FECACA'}}>
                {error}
              </div>
            )}
            <div style={{border:'2px dashed var(--border)',borderRadius:'10px',padding:'40px 24px',textAlign:'center',cursor:'pointer'}}
              onClick={()=>fileRef.current?.click()}
              onDragOver={e=>e.preventDefault()}
              onDrop={e=>{e.preventDefault();handleFile(e.dataTransfer.files[0]);}}>
              <div style={{fontSize:'2rem',marginBottom:'8px'}}>📂</div>
              <div style={{fontSize:'.85rem',color:'var(--text-2)'}}>Click to select or drag &amp; drop</div>
              <div style={{fontSize:'.78rem',color:'var(--text-3)',marginTop:'4px'}}>Workday org chart export — CSV or XLSX</div>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.txt" style={{display:'none'}}
              onChange={e=>handleFile(e.target.files[0])}/>
          </div>
        )}
        {step==='preview'&&rawParsed&&tierMap&&(
          <div style={{display:'flex',flexDirection:'column',flex:1,minHeight:0}}>
            {/* Stats bar + controls */}
            <div style={{fontSize:'.81rem',color:'var(--text-2)',marginBottom:'8px',flexShrink:0,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span>{Object.keys(groups).length} teams · {rawParsed.people.length} people · <em style={{fontStyle:'normal',color:'var(--text-3)',fontSize:'.76rem'}}>drag nodes to reparent · click ▼/▶ to collapse</em></span>
              <div style={{display:'flex',gap:'6px'}}>
                <button onClick={()=>setCollapsed(new Set(customTree.filter(n=>n.type==='header').map(n=>n.id)))}
                  style={{fontSize:'.75rem',padding:'2px 8px',borderRadius:'4px',border:'1px solid var(--border)',background:'none',color:'var(--text-2)',cursor:'pointer'}}>Collapse all</button>
                <button onClick={()=>setCollapsed(new Set())}
                  style={{fontSize:'.75rem',padding:'2px 8px',borderRadius:'4px',border:'1px solid var(--border)',background:'none',color:'var(--text-2)',cursor:'pointer'}}>Expand all</button>
              </div>
            </div>
            {/* ── Main row: org chart + diff panel side by side ── */}
            <div style={{display:'flex',flex:1,minHeight:0,gap:'12px'}}>
              {(()=>{
                const{NW:oNW,NH:oNH,HG:oHG,maxD:oMaxD,W:oW,H:oH,lines:oLines}=orgLayout;
                const TIER_NAMES=['Business Unit','Department','Discipline','Subdiscipline','Team'];
                const tierCols=Array.from({length:oMaxD+1},(_,i)=>i);
                return(
                  <div style={{overflowY:'auto',overflowX:'auto',flex:1,minWidth:0,border:'1px solid var(--border)',borderRadius:'8px',background:'var(--bg)',padding:'10px'}}
                    onDragOver={e=>e.preventDefault()}
                    onClick={()=>setChartTooltip(null)}>
                    {orgRoots.length===0?(
                      <div style={{padding:'24px',textAlign:'center',color:'var(--text-3)',fontSize:'.84rem'}}>No groups to display</div>
                    ):(
                      <>
                        {/* Tier column headers */}
                        <div style={{display:'flex',marginBottom:'8px',width:oW,minWidth:'100%',position:'relative'}}>
                          {tierCols.map(d=>(
                            <div key={d} style={{width:oNW,marginRight:d<oMaxD?oHG:0,flexShrink:0,
                              textAlign:'center',fontSize:'.68rem',fontWeight:600,letterSpacing:'.04em',
                              color:'#1E293B',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                              {TIER_NAMES[d]||`Level ${d}`}
                            </div>
                          ))}
                        </div>
                        <div style={{position:'relative',width:oW,height:oH,minWidth:'100%'}}>
                          <svg style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',pointerEvents:'none'}}>
                            {tierCols.slice(0,-1).map(d=>{
                              const sepX=d*(oNW+oHG)+oNW+oHG/2;
                              return<line key={`sep${d}`} x1={sepX} y1={0} x2={sepX} y2={oH} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 3"/>;
                            })}
                            {oLines.map(l=>(
                              <path key={l.id} d={l.d} fill="none" stroke="var(--border)" strokeWidth="1.5" strokeLinecap="round"/>
                            ))}
                          </svg>
                          {renderOrgNodes(orgRoots)}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
              {importMode==='merge'&&importDiff&&(()=>{
                const{added,updated,departed,scopeCount}=importDiff;
                const hasAny=added.length>0||updated.length>0||departed.length>0;
                const ROW={display:'flex',gap:'8px',alignItems:'baseline',padding:'2px 0'};
                const NAME={color:'#111827',fontWeight:500,minWidth:0,flexShrink:0};
                const DETAIL={color:'#4B5563',fontSize:'.75rem',minWidth:0};
                const SECHEAD=(color)=>({fontSize:'.7rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.05em',color,marginBottom:'3px'});
                return(
                  <div style={{width:'272px',flexShrink:0,overflowY:'auto',background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:'8px',padding:'12px 14px',fontSize:'.82rem',display:'flex',flexDirection:'column',gap:'10px'}}>
                    <div style={{fontSize:'.72rem',color:'#3B82F6',fontWeight:600,borderBottom:'1px solid #BFDBFE',paddingBottom:'6px',marginBottom:'-2px'}}>
                      BU scope · {scopeCount} team{scopeCount===1?'':'s'} · other BUs unaffected
                    </div>
                    {!hasAny&&(
                      <span style={{color:'#1E40AF',fontStyle:'italic'}}>No changes detected — roster matches current data.</span>
                    )}
                    {added.length>0&&(
                      <div>
                        <div style={SECHEAD('#166534')}>+{added.length} new</div>
                        <div style={{display:'flex',flexDirection:'column'}}>
                          {added.map(e=>(
                            <div key={e.id} style={ROW}>
                              <span style={NAME}>{e.name}</span>
                              <span style={DETAIL}>{e.discipline}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {updated.length>0&&(
                      <div>
                        <div style={SECHEAD('#1D4ED8')}>{updated.length} updated</div>
                        <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
                          {updated.map(({eng,changes})=>(
                            <div key={eng.id} style={{display:'flex',flexDirection:'column'}}>
                              <span style={NAME}>{eng.name}</span>
                              {changes.map((c,i)=>(
                                <span key={i} style={{...DETAIL,paddingLeft:'10px'}}>{fmtChange(c)}</span>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {departed.length>0&&(
                      <div>
                        <div style={SECHEAD('#92400E')}>{departed.length} not in this BU export</div>
                        <div style={{display:'flex',flexDirection:'column',marginBottom:'6px'}}>
                          {departed.map(e=>(
                            <div key={e.id} style={ROW}>
                              <span style={NAME}>{e.name}</span>
                              <span style={DETAIL}>{e.discipline}</span>
                            </div>
                          ))}
                        </div>
                        <label style={{display:'flex',alignItems:'center',gap:'6px',cursor:'pointer',color:'#374151',userSelect:'none',fontSize:'.8rem'}}>
                          <input type="checkbox" checked={markDeparted} onChange={e=>setMarkDeparted(e.target.checked)} style={{cursor:'pointer'}}/>
                          Mark {departed.length} departure{departed.length===1?'':'s'} as inactive
                        </label>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
            <div style={{marginTop:'14px',paddingTop:'14px',borderTop:'1px solid var(--border)',display:'flex',flexDirection:'column',gap:'8px',flexShrink:0}}>
              {/* Replace-all confirmation warning */}
              {importMode==='replace'&&confirmReplace&&existingEngineers.length>0&&(
                <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:'8px',padding:'10px 14px',fontSize:'.82rem',color:'#7F1D1D',display:'flex',flexDirection:'column',gap:'6px'}}>
                  <strong style={{color:'#991B1B'}}>This will replace all existing data.</strong>
                  <span>All {existingEngineers.length} existing engineers, their assignments, and all project demand data will be permanently erased. This cannot be undone.</span>
                  <div style={{display:'flex',gap:'8px',marginTop:'2px'}}>
                    <button onClick={()=>setConfirmReplace(false)}
                      style={{padding:'4px 12px',borderRadius:'5px',border:'1px solid #FECACA',background:'#fff',cursor:'pointer',fontSize:'.8rem',color:'#7F1D1D'}}>
                      Cancel
                    </button>
                    <button onClick={doImport}
                      style={{padding:'4px 12px',borderRadius:'5px',background:'#DC2626',color:'#fff',border:'none',cursor:'pointer',fontWeight:600,fontSize:'.8rem'}}>
                      Replace all data
                    </button>
                  </div>
                </div>
              )}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:'.81rem',color:'var(--text-2)'}}>
                  <strong style={{color:'var(--text-1)'}}>{totalImport}</strong> engineers across <strong style={{color:'var(--text-1)'}}>{includedKeys.length}</strong> disciplines
                  {importMode==='replace'?<> · project demand reset to 0</>:<> · assignments preserved · other BUs unaffected</>}
                </span>
                <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                  {importMode==='replace'&&existingEngineers.some(e=>e.id.startsWith('wd_'))&&(
                    <button onClick={()=>{setImportMode('merge');setConfirmReplace(false);}}
                      style={{background:'none',border:'none',cursor:'pointer',fontSize:'.78rem',color:'var(--text-3)',padding:'2px 4px'}}>
                      ← Merge instead
                    </button>
                  )}
                  <button onClick={()=>{setStep('upload');setConfirmReplace(false);}}
                    style={{padding:'6px 14px',borderRadius:'6px',border:'1px solid var(--border)',background:'none',cursor:'pointer',fontSize:'.83rem',color:'var(--text-2)'}}>
                    ← Back
                  </button>
                  <button onClick={()=>{if(importMode==='replace'&&existingEngineers.length>0&&!confirmReplace){setConfirmReplace(true);}else{doImport();}}} disabled={totalImport===0}
                    style={{padding:'6px 18px',borderRadius:'6px',background:totalImport>0?'#3B82F6':'var(--border)',color:totalImport>0?'#fff':'var(--text-3)',border:'none',cursor:totalImport>0?'pointer':'not-allowed',fontWeight:600,fontSize:'.83rem'}}>
                    {importMode==='merge'?'Merge update':`Import ${totalImport} engineers`}
                  </button>
                </div>
              </div>
              {importMode==='merge'&&existingEngineers.some(e=>e.id.startsWith('wd_'))&&(
                <div style={{textAlign:'right'}}>
                  <button onClick={()=>setImportMode('replace')}
                    style={{background:'none',border:'none',cursor:'pointer',fontSize:'.75rem',color:'var(--text-3)',padding:0}}>
                    Replace all data instead →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {/* ── Org chart node tooltip ── */}
        {chartTooltip&&(
          <div style={{position:'fixed',left:Math.min(chartTooltip.x,window.innerWidth-224),top:Math.min(chartTooltip.y,window.innerHeight-340),
            width:'210px',background:'var(--bg)',border:'1px solid var(--border)',borderRadius:'10px',
            boxShadow:'0 6px 24px rgba(0,0,0,.15)',padding:'10px 12px',zIndex:9999,fontSize:'.78rem'}}
            onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'6px',marginBottom:'7px'}}>
              <div style={{fontWeight:700,color:'var(--text-1)',lineHeight:1.3,wordBreak:'break-word'}}>{chartTooltip.displayName}</div>
              <button onClick={()=>setChartTooltip(null)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',fontSize:'.85rem',padding:0,lineHeight:1,flexShrink:0}}>✕</button>
            </div>
            {chartTooltip.subteams.length>0&&(
              <>
                <div style={{fontSize:'.63rem',color:'var(--text-3)',marginBottom:'3px',letterSpacing:'.05em',textTransform:'uppercase',fontWeight:600}}>Subteams</div>
                {chartTooltip.subteams.map(s=>(
                  <div key={s.name} style={{padding:'2px 0',color:'var(--text-2)',display:'flex',justifyContent:'space-between',gap:'6px'}}>
                    <span style={{minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.display}</span>
                    <span style={{color:'var(--text-3)',flexShrink:0}}>{s.count} {s.count===1?'team':'teams'}</span>
                  </div>
                ))}
              </>
            )}
            {chartTooltip.directPeople.length>0&&(
              <>
                <div style={{fontSize:'.63rem',color:'var(--text-3)',margin:`${chartTooltip.subteams.length>0?'8px':'0'} 0 3px`,letterSpacing:'.05em',textTransform:'uppercase',fontWeight:600}}>Direct reports ({chartTooltip.directPeople.length})</div>
                <div style={{maxHeight:'160px',overflowY:'auto'}}>
                  {chartTooltip.directPeople.map((p,i)=>(
                    <div key={i} style={{padding:'2px 0',color:'var(--text-2)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.name||String(p)}</div>
                  ))}
                </div>
              </>
            )}
            {chartTooltip.subteams.length===0&&chartTooltip.directPeople.length===0&&(
              <div style={{color:'var(--text-3)',fontStyle:'italic',fontSize:'.76rem'}}>No direct reports</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
