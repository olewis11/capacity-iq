const {useState,useRef,useReducer,useCallback,useEffect,useMemo}=React;

import {
  DEFAULT_DISC_META,
  GROUP_META,SUPERADMIN_EMAIL,ROLE_LABELS,PROJECT_COLORS,DEPT_PALETTE,
  stripParentPrefix,blendHex,tierBlend,
  isDirectorEng,isManagerEng,engSortKey,sortEngs,getColorForAlloc,
} from './constants.js';
import {DiscCtx,UserCtx,ViewCtx} from './context.js';
import {addMonths,monthDiff,fmtMonth,fmtMonthLong,fmtMonthShort,ratioToBarColor,currentMonth} from './utils/months.js';
import {roundHalf,leafName,getDemand,getGroupDemand} from './utils/demand.js';
import {getSupply,getAssigned,getEngineerTotalAlloc,getOrgSupply} from './utils/supply.js';
import {csvEsc,parseCSVLine} from './utils/csv.js';
import {sortByOrder as _sortByOrder,discDemandKey as _discDemandKey,discPaletteColor as _discPaletteColor} from './utils/org.js';
import {reducer} from './reducer.js';
import {EngBadges} from './components/EngBadges.jsx';
import {SwimCell} from './components/SwimCell.jsx';
import {SummaryCell} from './components/SummaryCell.jsx';
import {Tooltip} from './components/Tooltip.jsx';
import {AssignmentBarRow} from './components/AssignmentBarRow.jsx';
import {MasterDurationBar} from './components/MasterDurationBar.jsx';
import {DiscSparkline} from './components/DiscSparkline.jsx';
import {TeamRosterModal} from './components/TeamRosterModal.jsx';
import {OrgAnalytics,AnalyticsModal} from './components/AnalyticsModal.jsx';
import {applyLogFilters,LogMessage,ChangeLogEntries,ChangeLog} from './components/ChangeLog.jsx';
import {AssignPanel} from './components/AssignPanel.jsx';
import {SettingsModal} from './components/SettingsModal.jsx';
import {HelpModal} from './components/HelpModal.jsx';
import {SnapshotsModal} from './components/SnapshotsModal.jsx';
import {WorkdayImportModal} from './components/WorkdayImportModal.jsx';
import {EngineerRegistryModal} from './components/EngineerRegistryModal.jsx';
import {TierOrderModal} from './components/TierOrderModal.jsx';
import {StoreDataModal} from './components/StoreDataModal.jsx';
import {UserRegistryModal} from './components/UserRegistryModal.jsx';
import {BaselineEmailModal} from './components/BaselineEmailModal.jsx';
import {ActionMenu} from './components/ActionMenu.jsx';
import {useUndoableReducer} from './hooks/useUndoableReducer.js';
import {ProjectRows} from './components/ProjectRows.jsx';


const ORG_DISC_META={};
const ORG_PROJECTS=[];
const ORG_ENGINEERS=[];

/* ═══════════════════════════════════════════════════════════════
   FETCH IAP EMAIL
═══════════════════════════════════════════════════════════════ */
async function fetchIAPEmail(){
  // This personal copy has no IAP/backend to identify against — on localhost
  // the caller falls back to SUPERADMIN_EMAIL, which is what we want for a demo.
  return null;
}

/* Migrate discMeta and tierOrder saved with old field names (group/subgroup/…) to new names (bu/dept/…) */
function migrateDiscMeta(dm){
  if(!dm)return dm;
  const out={};
  Object.entries(dm).forEach(([k,v])=>{
    if(!v||typeof v!=='object'){out[k]=v;return;}
    const m={...v};
    if('group' in m&&!('bu' in m)){m.bu=m.group;delete m.group;}
    if('subgroup' in m&&!('dept' in m)){m.dept=m.subgroup;delete m.subgroup;}
    if('subsubgroup' in m&&!('discipline' in m)){m.discipline=m.subsubgroup;delete m.subsubgroup;}
    if('subsubsubgroup' in m&&!('subdisc' in m)){m.subdisc=m.subsubsubgroup;delete m.subsubsubgroup;}
    out[k]=m;
  });
  return out;
}
function migrateTierOrder(to){
  if(!to)return to;
  const m={...to};
  if('groups' in m&&!('bus' in m)){m.bus=m.groups;delete m.groups;}
  if('subgroups' in m&&!('depts' in m)){m.depts=m.subgroups;delete m.subgroups;}
  if('subsubgroups' in m&&!('disciplines' in m)){m.disciplines=m.subsubgroups;delete m.subsubgroups;}
  if('subsubsubgroups' in m&&!('subdiscs' in m)){m.subdiscs=m.subsubsubgroups;delete m.subsubsubgroups;}
  return m;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════ */
const TODAY=currentMonth();
const DEFAULT_VIEW_START=addMonths(TODAY,-1);

/* ═══════════════════════════════════════════════════════════════
   DEMO SEED DATA
   This personal copy has no backend (see README) — on a brand-new
   browser (nothing in localStorage yet) we seed a small fictional
   org so the app isn't just an empty state.
═══════════════════════════════════════════════════════════════ */
function buildDemoSeed(){
  const discMeta={
    'SW-FE-Web-Growth':    {color:'#3B82F6',bg:'#DBEAFE',border:'#93C5FD',abbr:'GRO',bu:'SW',dept:'Frontend',discipline:'Web Platform',subdisc:'Growth'},
    'SW-FE-Web-Core':      {color:'#0EA5E9',bg:'#E0F2FE',border:'#7DD3FC',abbr:'COR',bu:'SW',dept:'Frontend',discipline:'Web Platform',subdisc:'Core'},
    'SW-FE-Mobile-iOS':    {color:'#6366F1',bg:'#EEF2FF',border:'#A5B4FC',abbr:'iOS',bu:'SW',dept:'Frontend',discipline:'Mobile',subdisc:'iOS'},
    'SW-FE-Mobile-Android':{color:'#8B5CF6',bg:'#EDE9FE',border:'#C4B5FD',abbr:'AND',bu:'SW',dept:'Frontend',discipline:'Mobile',subdisc:'Android'},
    'SW-BE-Infra-Services':{color:'#F59E0B',bg:'#FEF3C7',border:'#FCD34D',abbr:'SVC',bu:'SW',dept:'Backend',discipline:'Infrastructure',subdisc:'Services'},
    'SW-BE-Infra-Data':    {color:'#F97316',bg:'#FFF7ED',border:'#FED7AA',abbr:'DAT',bu:'SW',dept:'Backend',discipline:'Infrastructure',subdisc:'Data'},
    'SW-QA-Testing-Auto':  {color:'#EC4899',bg:'#FCE7F3',border:'#F9A8D4',abbr:'AUT',bu:'SW',dept:'QA',discipline:'Testing',subdisc:'Automation'},
    'HW-EE-Power-Battery': {color:'#10B981',bg:'#D1FAE5',border:'#6EE7B7',abbr:'BAT',bu:'HW',dept:'Electrical',discipline:'Power Systems',subdisc:'Battery'},
    'HW-EE-Power-Charging':{color:'#14B8A6',bg:'#CCFBF1',border:'#5EEAD4',abbr:'CHG',bu:'HW',dept:'Electrical',discipline:'Power Systems',subdisc:'Charging'},
    'HW-ME-Struct-Chassis':{color:'#059669',bg:'#D1FAE5',border:'#6EE7B7',abbr:'CHS',bu:'HW',dept:'Mechanical',discipline:'Structures',subdisc:'Chassis'},
  };
  const tierOrder={
    bus:['SW','HW'],
    depts:['Frontend','Backend','QA','Electrical','Mechanical'],
    disciplines:['Web Platform','Mobile','Infrastructure','Testing','Power Systems','Structures'],
    subdiscs:['Growth','Core','iOS','Android','Services','Data','Automation','Battery','Charging','Chassis'],
  };
  const engineers=[
    {id:'eng-1', name:'Alex Rivera',     discipline:'SW-FE-Web-Growth',     title:'Senior Software Engineer'},
    {id:'eng-2', name:'Priya Nair',      discipline:'SW-FE-Web-Growth',     title:'Software Engineer'},
    {id:'eng-3', name:'Jordan Kim',      discipline:'SW-FE-Web-Core',       title:'Staff Software Engineer'},
    {id:'eng-4', name:'Sam Okafor',      discipline:'SW-FE-Web-Core',       title:'Software Engineer'},
    {id:'eng-5', name:'Taylor Brooks',   discipline:'SW-FE-Mobile-iOS',     title:'Senior Software Engineer'},
    {id:'eng-6', name:'Morgan Chase',    discipline:'SW-FE-Mobile-Android', title:'Software Engineer'},
    {id:'eng-7', name:'Casey Lindgren',  discipline:'SW-BE-Infra-Services', title:'Senior Software Engineer'},
    {id:'eng-8', name:'Devon Park',      discipline:'SW-BE-Infra-Services', title:'Software Engineer'},
    {id:'eng-9', name:'Riley Thompson',  discipline:'SW-BE-Infra-Data',     title:'Data Engineer'},
    {id:'eng-10',name:'Jamie Ferreira',  discipline:'SW-QA-Testing-Auto',   title:'QA Engineer', isContractor:true},
    {id:'eng-11',name:'Avery Santos',    discipline:'HW-EE-Power-Battery',  title:'Electrical Engineer'},
    {id:'eng-12',name:'Quinn Delacroix', discipline:'HW-EE-Power-Charging', title:'Senior Electrical Engineer'},
    {id:'eng-13',name:'Harper Osei',     discipline:'HW-ME-Struct-Chassis', title:'Mechanical Engineer'},
    {id:'eng-14',name:'Reese Whitfield', discipline:'HW-ME-Struct-Chassis', title:'Senior Mechanical Engineer'},
    {id:'eng-15',name:'Skyler Novak',    discipline:'SW-FE-Mobile-iOS',     title:'Software Engineer', isContractor:true},
    {id:'eng-16',name:'Elliot Vance',    discipline:'SW-BE-Infra-Services', title:'Principal Engineer', inactive:true},
  ];
  const projects=[
    {id:'proj-1',name:'Aurora Platform Rebuild',color:PROJECT_COLORS[0],
      startMonth:addMonths(TODAY,-2),endMonth:addMonths(TODAY,9),
      demand:{'Web Platform':2,'Mobile':1.5,'Infrastructure':2,'Testing':1},
      rampUp:{enabled:true,months:2},rampDown:{enabled:false,months:2}},
    {id:'proj-2',name:'Falcon Hardware Refresh',color:PROJECT_COLORS[1],
      startMonth:addMonths(TODAY,-2),endMonth:addMonths(TODAY,8),
      demand:{'Power Systems':1.5,'Structures':1},
      rampUp:{enabled:false,months:2},rampDown:{enabled:true,months:2}},
    {id:'proj-3',name:'Nimbus Mobile Expansion',color:PROJECT_COLORS[2],
      startMonth:addMonths(TODAY,-1),endMonth:addMonths(TODAY,7),
      demand:{'Mobile':2,'Web Platform':1},
      rampUp:{enabled:true,months:1},rampDown:{enabled:false,months:2}},
    {id:'proj-4',name:'Internal Tools Cleanup',color:PROJECT_COLORS[3],
      startMonth:TODAY,endMonth:addMonths(TODAY,3),
      demand:{'Infrastructure':0.5,'Testing':0.5},
      rampUp:{enabled:false,months:2},rampDown:{enabled:false,months:2}},
  ];
  const asn=(id,engineerId,projectId,fromOffset,toOffset,allocation)=>
    ({id,engineerId,projectId,startMonth:addMonths(TODAY,fromOffset),endMonth:addMonths(TODAY,toOffset),allocation});
  const assignments=[
    asn('a1', 'eng-1','proj-1', -2,9,100),
    asn('a2', 'eng-2','proj-1',  0,6,75),
    asn('a3', 'eng-3','proj-1', -2,9,100),
    asn('a4', 'eng-5','proj-3', -1,7,100),
    asn('a5', 'eng-6','proj-3', -1,7,100),
    asn('a6', 'eng-15','proj-3', 1,7,50),
    asn('a7', 'eng-7','proj-1', -2,9,100),
    asn('a8', 'eng-8','proj-4',  0,3,50),
    asn('a9', 'eng-9','proj-1', -1,9,75),
    asn('a10','eng-10','proj-4', 0,3,100),
    asn('a11','eng-11','proj-2',-2,8,100),
    asn('a12','eng-12','proj-2',-2,8,75),
    asn('a13','eng-13','proj-2',-2,8,100),
    asn('a14','eng-14','proj-2', 2,8,50),
  ];
  return{discMeta,tierOrder,engineers,projects,assignments};
}

function App(){
  // var hoisting eliminates TDZ for peopleOrgRoots captured in closures defined before its useMemo
  var peopleOrgRoots;
  const[state,dispatch,undo,redo,canUndo,canRedo]=useUndoableReducer(reducer,{
    projects:ORG_PROJECTS,
    engineers:ORG_ENGINEERS,
    assignments:[],
    viewStart:DEFAULT_VIEW_START,
    discMeta:null,
    tierOrder:{bus:[],depts:[],disciplines:[],subdiscs:[]},
  });
  /* Dynamic discipline config — derived from imported state, never shadows globals */
  const activeMeta=state.discMeta||{};
  const activeDiscs=Object.keys(activeMeta);
  /* Sort helper: order arr by a saved order array; unordered items fall to the end */
  const sortByOrder=(arr,orderArr)=>_sortByOrder(arr,orderArr);
  /* 3-tier hierarchy: group → subgroup → disc (leaf)
     discGroupMap:    group    → [subgroups]
     discSubgroupMap: subgroup → [leaf discs]
     When a disc has no .subgroup field, its subgroup defaults to its group. */
  /* 3-tier hierarchy maps — memoised; only recompute when discMeta or tierOrder changes */
  const{discGroupMap,discGroupOrder,discSubgroupMap,sgPaletteIdx,discSsgMap,discSubsubgroupMap,discSgLeaves}=useMemo(()=>{
    const to=state.tierOrder||{};
    const sbo=(arr,key)=>sortByOrder(arr,to[key]);
    const map={},order=[],subMap={},sgIdx={},ssgMap={},subsubMap={},sgLeaves={};
    let si=0;
    Object.keys(state.discMeta||{}).forEach(d=>{
      const m=(state.discMeta||{})[d]||{};
      const g=m.bu||'Other';
      const sg=m.dept||g;
      const ssg=m.discipline||null;
      if(!map[g]){map[g]=[];order.push(g);}
      if(!map[g].includes(sg))map[g].push(sg);
      if(!subMap[sg])subMap[sg]=[];
      subMap[sg].push(d); // ALL leaf discs under sg — used by filter logic
      if(!(sg in sgIdx))sgIdx[sg]=si++%DEPT_PALETTE.length;
      if(ssg){
        if(!ssgMap[sg])ssgMap[sg]=[];
        if(!ssgMap[sg].includes(ssg))ssgMap[sg].push(ssg);
        if(!subsubMap[ssg])subsubMap[ssg]=[];
        subsubMap[ssg].push(d);
      } else {
        if(!sgLeaves[sg])sgLeaves[sg]=[];
        sgLeaves[sg].push(d); // discs with no subsubgroup, sit directly under sg
      }
    });
    // Apply custom tier ordering
    const sortedOrder=sbo(order,'bus');
    Object.keys(map).forEach(g=>{map[g]=sbo(map[g],'depts');});
    Object.keys(ssgMap).forEach(sg=>{ssgMap[sg]=sbo(ssgMap[sg],'disciplines');});
    Object.keys(subsubMap).forEach(ssg=>{subsubMap[ssg]=sbo(subsubMap[ssg],'subdiscs');});
    return{discGroupMap:map,discGroupOrder:sortedOrder,discSubgroupMap:subMap,sgPaletteIdx:sgIdx,discSsgMap:ssgMap,discSubsubgroupMap:subsubMap,discSgLeaves:sgLeaves};
  },[state.discMeta,state.tierOrder]);
  /* Helper: all leaf discs in a group (flattening subgroups) */
  const getGroupDiscs=g=>(discGroupMap[g]||[]).flatMap(sg=>discSubgroupMap[sg]||[]);
  /* Discipline-level demand key for a disc: subsubgroup → subgroup → group → disc */
  const discDemandKey=d=>_discDemandKey(d,activeMeta);
  /* DEPT_PALETTE bold color for a disc — matches People tab color scheme */
  const discPaletteColor=d=>_discPaletteColor(d,activeMeta,sgPaletteIdx);
  const[changeLog,setChangeLog]=useState([]);
  const addLog=useCallback((message,type='info',groupKey=null)=>{
    const now=Date.now();
    setChangeLog(prev=>{
      if(groupKey&&prev.length>0&&prev[0].groupKey===groupKey){
        const top=prev[0];
        const updated={...top,message,timestamp:now,
          history:[...(top.history||[{message:top.message,timestamp:top.timestamp}]),{message,timestamp:now}]};
        return[updated,...prev.slice(1)].slice(0,50);
      }
      return[{
        id:`log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp:now,message,type,groupKey,
        history:[{message,timestamp:now}]
      },...prev].slice(0,50);
    });
  },[]);
  const[tooltip,setTooltip]=useState(null);
  const[assignCtx,setAssignCtx]=useState(null);
  const[settingsProject,setSettingsProject]=useState(null);
  const[draggedProjId,setDraggedProjId]=useState(null);
  const[dragOverProjId,setDragOverProjId]=useState(null);
  const[dragOverAfter,setDragOverAfter]=useState(false);
  const[disciplineFilter,setDisciplineFilter]=useState(()=>new Set(activeDiscs));
  /* Reset filter whenever the disc list changes (e.g. after org chart import) */
  const discsKey=activeDiscs.join(',');
  useEffect(()=>setDisciplineFilter(new Set(activeDiscs)),[discsKey]);
  const getPageFromHash=()=>{const h=window.location.hash;if(h.startsWith('#/discipline'))return'discipline';if(h.startsWith('#/changelog'))return'changelog';return'project';};
  const[currentPage,setCurrentPage]=useState(getPageFromHash);
  const navigate=(page)=>{window.location.hash=page==='discipline'?'#/discipline-view':page==='changelog'?'#/changelog':'#/project-view';setCurrentPage(page);};
  React.useEffect(()=>{const handler=()=>setCurrentPage(getPageFromHash());window.addEventListener('hashchange',handler);return()=>window.removeEventListener('hashchange',handler);},[]);
  const[editMode,setEditMode]=useState('supply');
  const[showHeatmap,setShowHeatmap]=useState(false);
  const[helpOpen,setHelpOpen]=useState(false);
  const[logFilters,setLogFilters]=useState({project:'',discipline:'',resource:'',date:''});
  const setLogFilter=(k,v)=>setLogFilters(f=>({...f,[k]:v}));
  const[analyticsModalOpen,setAnalyticsModalOpen]=useState(false);
  const[snapshotsOpen,setSnapshotsOpen]=useState(false);
  const[snapsPeople,setSnapsPeople]=useState([]);
  const[snapsProjects,setSnapsProjects]=useState([]);
  const[snapsChangelog,setSnapsChangelog]=useState([]);
  const[snapsUsers,setSnapsUsers]=useState([]);
  const[storeLoaded,setStoreLoaded]=useState(false);
  const[workdayImportOpen,setWorkdayImportOpen]=useState(false);
  const[baselineEmailOpen,setBaselineEmailOpen]=useState(false);
  const[dataFilesOpen,setDataFilesOpen]=useState(false);
  const[usersOpen,setUsersOpen]=useState(false);
  const[engineerRegistryOpen,setEngineerRegistryOpen]=useState(false);
  const[tierOrderOpen,setTierOrderOpen]=useState(false);
  const[testRole,setTestRole]=useState(null); // null | 'pm' | 'fm'
  const[currentUserEmail,setCurrentUserEmail]=useState(null);
  const[userRegistry,setUserRegistry]=useState([]);
  const STORE_USERS_URL='capacityiq-demo:users';
  const[rosterTarget,setRosterTarget]=useState(null);
  const[rosterModal,setRosterModal]=useState(null); // {label,discs,color} — TeamRosterModal overlay
  const[peopleView,setPeopleView]=useState('lr'); // 'list'|'lr'
  const[peoplePanelLayout,setPeoplePanelLayout]=useState('side'); // always side
  const[peopleCollapsed,setPeopleCollapsed]=useState(new Set());
  const[peopleSearch,setPeopleSearch]=useState('');
  const[peopleDragging,setPeopleDragging]=useState(null); // {id,type,discs,group,subgroup}
  const[peopleChartDrop,setPeopleChartDrop]=useState(null); // {id}
  const[collapsedGroups,setCollapsedGroups]=useState(new Set());
  const[expandedProjects,setExpandedProjects]=useState(new Set());
  const toggleGroupCollapse=g=>setCollapsedGroups(prev=>{const s=new Set(prev);s.has(g)?s.delete(g):s.add(g);return s;});
  const toggleSubgroupFilter=(sg,sgDiscs)=>setDisciplineFilter(prev=>{
    const s=new Set(prev);
    const allOn=sgDiscs.every(d=>s.has(d));
    if(allOn){sgDiscs.forEach(d=>s.delete(d));}else{sgDiscs.forEach(d=>s.add(d));}
    return s;
  });
  /* project-grid group/subgroup collapse — key: "projId::name", absent = collapsed */
  const[expandedProjGroups,setExpandedProjGroups]=useState(new Set());
  const toggleProjGroup=(pid,g)=>setExpandedProjGroups(prev=>{const s=new Set(prev);const k=`${pid}::${g}`;s.has(k)?s.delete(k):s.add(k);return s;});
  const[expandedProjSubgroups,setExpandedProjSubgroups]=useState(new Set());
  const toggleProjSubgroup=(pid,sg)=>setExpandedProjSubgroups(prev=>{const s=new Set(prev);const k=`${pid}::${sg}`;s.has(k)?s.delete(k):s.add(k);return s;});
  const[expandedProjSubsubgroups,setExpandedProjSubsubgroups]=useState(new Set());
  const toggleProjSubsubgroup=(pid,ssg)=>setExpandedProjSubsubgroups(prev=>{const s=new Set(prev);const k=`${pid}::${ssg}`;s.has(k)?s.delete(k):s.add(k);return s;});
  const[expandedProjSssgs,setExpandedProjSssgs]=useState(new Set());
  const toggleProjSssg=(pid,sssg)=>setExpandedProjSssgs(prev=>{const s=new Set(prev);const k=`${pid}::${sssg}`;s.has(k)?s.delete(k):s.add(k);return s;});
  /* ── People tab: org chart tree (uses all tier levels from discMeta) ── */
  peopleOrgRoots=useMemo(()=>{
    if(!activeDiscs.length)return[];
    /* Build ordered multi-tier array tree: group→sg→ssg→sssg→disc */
    function getOrAdd(arr,key){let e=arr.find(x=>x.key===key);if(!e){e={key,childArr:[],discArr:[],allDiscArr:[]};arr.push(e);}return e;}
    const rootArr=[];
    activeDiscs.forEach(d=>{
      const meta=activeMeta[d];if(!meta)return;
      const g=meta.bu||'Other',sg=meta.dept,ssg=meta.discipline,sssg=meta.subdisc;
      const tiers=[sg,ssg,sssg].filter(Boolean);
      const gEntry=getOrAdd(rootArr,g);gEntry.allDiscArr.push(d);
      let cur=gEntry;
      tiers.forEach(tier=>{const c=getOrAdd(cur.childArr,tier);c.allDiscArr.push(d);cur=c;});
      cur.discArr.push(d);
    });
    /* Sort each tier's childArr by tierOrder before building nodes */
    const toKeys=['bus','depts','disciplines','subdiscs'];
    function sortTreeArr(arr,depth){
      const sorted=sortByOrder(arr.map(e=>e.key),toKeys[depth]||'');
      const byKey=Object.fromEntries(arr.map(e=>[e.key,e]));
      const result=sorted.map(k=>byKey[k]).filter(Boolean);
      result.forEach(e=>{if(e.childArr.length)e.childArr=sortTreeArr(e.childArr,depth+1);});
      return result;
    }
    const sortedRootArr=sortTreeArr(rootArr,0);
    /* Convert to tree nodes; each gets tierPath for reparenting */
    function toNodes(arr,parentKey,depth,groupName,tierPath){
      const gm=GROUP_META[groupName]||GROUP_META.Other;
      return arr.map(entry=>{
        const firstDisc=entry.discArr[0]||entry.allDiscArr[0];
        const color=activeMeta[firstDisc]?.color||gm.color;
        const displayName=depth===0?entry.key:(entry.key===parentKey||leafName(entry.key)===leafName(parentKey))?'↪ Direct':leafName(entry.key);
        const myTP={...tierPath};
        if(depth===0)myTP.bu=entry.key;
        else{const k=['dept','discipline','subdisc'][depth-1];if(k)myTP[k]=entry.key;}
        const gName=depth===0?entry.key:groupName;
        const discChildren=entry.discArr
          .filter(d=>leafName(d)!==leafName(entry.key)) // skip "Direct" discs — they belong to parent
          .map(d=>({
            id:`disc:${d}`,name:leafName(d),depth:depth+1,type:'disc',
            disc:d,discs:[d],allDiscs:[d],bu:gName,sg:entry.key,
            tierPath:{...myTP},color:activeMeta[d]?.color||color,children:[],
          }));
        const subNodes=toNodes(entry.childArr,entry.key,depth+1,gName,myTP);
        return{id:`node:${depth}:${entry.key}`,name:displayName,depth,type:depth===0?'bu':'dept',
          discs:entry.discArr,allDiscs:entry.allDiscArr,bu:gName,sg:entry.key,
          dept:myTP.dept||entry.key,color,children:[...subNodes,...discChildren],tierPath:myTP};
      });
    }
    return toNodes(sortedRootArr,null,0,null,{});
  },[activeDiscs,activeMeta,state.tierOrder]);
  /* People tab tier expand/collapse — declared AFTER peopleOrgRoots to avoid TDZ */
  const handlePeopleTierBU=()=>{const ids=[];const walk=(n)=>{if(n.type==='disc')return;ids.push(n.id);n.children.forEach(walk);};peopleOrgRoots.forEach(walk);setCollapsedGroups(new Set(ids));};
  const handlePeopleTierDept=()=>{const ids=[];const walk=(n)=>{if(n.type==='disc')return;if(n.depth>=1)ids.push(n.id);n.children.forEach(walk);};peopleOrgRoots.forEach(walk);setCollapsedGroups(new Set(ids));};
  const handlePeopleTierDisc=()=>{const ids=[];const walk=(n)=>{if(n.type==='disc')return;if(n.depth>=2)ids.push(n.id);n.children.forEach(walk);};peopleOrgRoots.forEach(walk);setCollapsedGroups(new Set(ids));};
  const handlePeopleTierSubdisc=()=>{const ids=[];const walk=(n)=>{if(n.type==='disc')return;if(n.depth>=3)ids.push(n.id);n.children.forEach(walk);};peopleOrgRoots.forEach(walk);setCollapsedGroups(new Set(ids));};
  const handlePeopleTierAll=()=>setCollapsedGroups(new Set());
  /* ── Simplified org roots: compress single-child intermediate nodes ── */
  const simplifiedOrgRoots=useMemo(()=>{
    function adjustDepth(node,delta){
      if(delta===0)return node;
      return{...node,depth:node.depth+delta,children:node.children.map(c=>adjustDepth(c,delta))};
    }
    function compress(node){
      if(node.type==='disc')return node;
      const compressedChildren=node.children.map(c=>compress(c));
      const grpKids=compressedChildren.filter(k=>k.type!=='disc');
      const discKids=compressedChildren.filter(k=>k.type==='disc');
      if(grpKids.length===1&&discKids.length===0&&node.discs.length===0){
        const child=grpKids[0];
        const delta=node.depth-child.depth;
        return{...node,children:child.children.map(c=>adjustDepth(c,delta)),discs:child.discs};
      }
      return{...node,children:compressedChildren};
    }
    return peopleOrgRoots.map(compress);
  },[peopleOrgRoots]);
  /* ── People tab: org chart layout ── */
  const peopleOrgLayout=useMemo(()=>{
    const NW=140,NH=50,VG=10,HG=60;
    if(!simplifiedOrgRoots.length)return{pos:{},lines:[],W:200,H:100,NW,NH,HG,maxD:0};
    const pos={},lines=[];
    function span(n){return(peopleCollapsed.has(n.id)||!n.children.length)?1:n.children.reduce((s,c)=>s+span(c),0);}
    function placeLR(nodes,y0){let y=y0;nodes.forEach(n=>{const s=span(n);pos[n.id]={x:n.depth*(NW+HG),y:y};if(!peopleCollapsed.has(n.id))placeLR(n.children,y);y+=s*(NH+VG);});}
    placeLR(simplifiedOrgRoots,10);
    function mkLinesLR(n){if(!n.children.length||peopleCollapsed.has(n.id))return;const np=pos[n.id];if(!np)return;const px=np.x+NW,py=np.y+NH/2,mx=px+HG/2;n.children.forEach(c=>{const cp=pos[c.id];if(!cp)return;const cy=cp.y+NH/2;lines.push({id:`${n.id}→${c.id}`,d:`M${px},${py} C${mx},${py} ${mx},${cy} ${cp.x},${cy}`});});n.children.forEach(mkLinesLR);}
    simplifiedOrgRoots.forEach(mkLinesLR);
    let maxD=0,leafCt=0;
    function measureLR(n){maxD=Math.max(maxD,n.depth);if(!n.children.length||peopleCollapsed.has(n.id))leafCt++;else n.children.forEach(measureLR);}
    simplifiedOrgRoots.forEach(measureLR);
    return{pos,lines,W:(maxD+1)*(NW+HG)-HG+24,H:Math.max(leafCt*(NH+VG)+20,80),NW,NH,HG,maxD};
  },[simplifiedOrgRoots,peopleCollapsed]);
  /* ── List view tier active states ── */
  const peopleTierBUActive=peopleOrgRoots.length>0&&peopleOrgRoots.every(n=>collapsedGroups.has(n.id));
  const peopleTierAllActive=collapsedGroups.size===0;
  const peopleTierDeptActive=!peopleTierBUActive&&!peopleTierAllActive&&(()=>{let ok=true;const w=(n)=>{if(n.type==='disc')return;if(n.depth===1){if(!collapsedGroups.has(n.id))ok=false;return;}if(!collapsedGroups.has(n.id))n.children.forEach(w);};peopleOrgRoots.forEach(w);return ok;})();
  const peopleTierDiscActive=!peopleTierBUActive&&!peopleTierDeptActive&&!peopleTierAllActive&&(()=>{let ok=true;const w=(n)=>{if(n.type==='disc')return;if(n.depth===2){if(!collapsedGroups.has(n.id))ok=false;return;}if(!collapsedGroups.has(n.id))n.children.forEach(w);};peopleOrgRoots.forEach(w);return ok;})();
  const peopleTierSubdiscActive=!peopleTierBUActive&&!peopleTierDeptActive&&!peopleTierDiscActive&&!peopleTierAllActive;
  /* ── Org chart tier collapse handlers ── */
  const handleOrgTierBU=()=>{const ids=[];const walk=(n)=>{if(n.type==='disc')return;ids.push(n.id);n.children.forEach(walk);};simplifiedOrgRoots.forEach(walk);setPeopleCollapsed(new Set(ids));};
  const handleOrgTierDept=()=>{const ids=[];const walk=(n)=>{if(n.type==='disc')return;if(n.depth>=1)ids.push(n.id);n.children.forEach(walk);};simplifiedOrgRoots.forEach(walk);setPeopleCollapsed(new Set(ids));};
  const handleOrgTierDisc=()=>{const ids=[];const walk=(n)=>{if(n.type==='disc')return;if(n.depth>=2)ids.push(n.id);n.children.forEach(walk);};simplifiedOrgRoots.forEach(walk);setPeopleCollapsed(new Set(ids));};
  const handleOrgTierSubdisc=()=>{const ids=[];const walk=(n)=>{if(n.type==='disc')return;if(n.depth>=3)ids.push(n.id);n.children.forEach(walk);};simplifiedOrgRoots.forEach(walk);setPeopleCollapsed(new Set(ids));};
  const handleOrgTierAll=()=>setPeopleCollapsed(new Set());
  /* ── Org chart tier active states ── */
  const orgTierBUActive=simplifiedOrgRoots.length>0&&simplifiedOrgRoots.every(n=>peopleCollapsed.has(n.id));
  const orgTierAllActive=peopleCollapsed.size===0;
  const orgTierDeptActive=!orgTierBUActive&&!orgTierAllActive&&(()=>{let ok=true;const w=(n)=>{if(n.type==='disc')return;if(n.depth===1){if(!peopleCollapsed.has(n.id))ok=false;return;}if(!peopleCollapsed.has(n.id))n.children.forEach(w);};simplifiedOrgRoots.forEach(w);return ok;})();
  const orgTierDiscActive=!orgTierBUActive&&!orgTierDeptActive&&!orgTierAllActive&&(()=>{let ok=true;const w=(n)=>{if(n.type==='disc')return;if(n.depth===2){if(!peopleCollapsed.has(n.id))ok=false;return;}if(!peopleCollapsed.has(n.id))n.children.forEach(w);};simplifiedOrgRoots.forEach(w);return ok;})();
  const orgTierSubdiscActive=!orgTierBUActive&&!orgTierDeptActive&&!orgTierDiscActive&&!orgTierAllActive;
  const tooltipTimer=useRef(null);
  const searchAutoOpened=useRef(false);

  React.useEffect(()=>{
    return()=>{clearTimeout(tooltipTimer.current);};
  },[]);

  const handleUndo=useCallback(()=>{if(canUndo){undo();addLog('Undid last change','info');}},[undo,canUndo,addLog]);
  const handleRedo=useCallback(()=>{if(canRedo){redo();addLog('Redid last change','info');}},[redo,canRedo,addLog]);
  React.useEffect(()=>{
    const h=e=>{
      if(!(e.ctrlKey||e.metaKey))return;
      if(e.key==='z'&&!e.shiftKey){e.preventDefault();handleUndo();}
      else if((e.key==='z'&&e.shiftKey)||(e.key==='y')){e.preventDefault();handleRedo();}
    };
    document.addEventListener('keydown',h);
    return()=>document.removeEventListener('keydown',h);
  },[handleUndo,handleRedo]);

  // ── Local-storage persistence ────────────────────────────────
  // This personal copy has no backend (see README) — everything below persists
  // to the browser's localStorage instead of a Vibes store, keyed under these names.
  const STORE_PEOPLE_URL='capacityiq-demo:people';
  const STORE_PROJECTS_URL='capacityiq-demo:projects';
  const STORE_LOG_URL='capacityiq-demo:changelog';
  const STORE_SNAPS_PEOPLE_URL='capacityiq-demo:snapshots-people';
  const STORE_SNAPS_PROJECTS_URL='capacityiq-demo:snapshots-projects';
  const STORE_SNAPS_CHANGELOG_URL='capacityiq-demo:snapshots-changelog';
  const STORE_SNAPS_USERS_URL='capacityiq-demo:snapshots-users';
  const STORE_VERSION=2;
  const loadLS=key=>{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):null;}catch(e){return null;}};
  const saveLS=(key,data)=>{try{localStorage.setItem(key,JSON.stringify(data));}catch(e){}};
  const saveTimerRef=useRef(null);
  const saveProjectsTimerRef=useRef(null);
  const saveLogTimerRef=useRef(null);
  const saveUsersTimerRef=useRef(null);
  const[saveStatus,setSaveStatus]=useState(null); // null|'saving'|'saved'|'error'

  // Load state, changelog, per-store snapshots, and users on mount; auto-snapshot if needed
  React.useEffect(()=>{
    const load=loadLS;
    const loadSnaps=data=>data?.version===STORE_VERSION&&Array.isArray(data?.snapshots)?data.snapshots:[];
    Promise.all([
      load(STORE_PEOPLE_URL),load(STORE_PROJECTS_URL),load(STORE_LOG_URL),load(STORE_USERS_URL),
      load(STORE_SNAPS_PEOPLE_URL),load(STORE_SNAPS_PROJECTS_URL),load(STORE_SNAPS_CHANGELOG_URL),load(STORE_SNAPS_USERS_URL),
      fetchIAPEmail(),
    ]).then(([peopleData,projectsData,logData,usersData,snapsPeopleData,snapsProjectsData,snapsChangelogData,snapsUsersData,iapEmail])=>{
      const isLocal=window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1';
      setCurrentUserEmail(isLocal&&!iapEmail?SUPERADMIN_EMAIL:iapEmail);
      if(usersData?.version===STORE_VERSION&&Array.isArray(usersData?.users)){
        setUserRegistry(usersData.users);
      }
      let hasPeople=peopleData?.version===STORE_VERSION&&Array.isArray(peopleData?.engineers);
      let hasProjects=projectsData?.version===STORE_VERSION&&Array.isArray(projectsData?.projects);
      let engineers=hasPeople?peopleData.engineers:[];
      let discMeta=migrateDiscMeta(hasPeople?(peopleData.discMeta||null):null);
      let tierOrder=migrateTierOrder(hasPeople?(peopleData.tierOrder||undefined):undefined);
      let projects=hasProjects?projectsData.projects:[];
      let assignments=hasProjects?projectsData.assignments:[];
      // Brand-new browser (nothing saved yet) — seed with demo data instead of an empty state
      if(!hasPeople&&!hasProjects){
        const seed=buildDemoSeed();
        engineers=seed.engineers;discMeta=seed.discMeta;tierOrder=seed.tierOrder;
        projects=seed.projects;assignments=seed.assignments;
        hasPeople=true;hasProjects=true;
      }
      const stateLoaded=hasPeople||hasProjects;
      if(stateLoaded){
        dispatch({type:'LOAD_STATE',projects,engineers,assignments,discMeta,tierOrder});
        setExpandedProjects(new Set());
      }
      if(Array.isArray(logData?.entries)&&logData.entries.length>0){
        setChangeLog(logData.entries);
      }
      // Load per-store snapshots
      const existingSnapsPeople=loadSnaps(snapsPeopleData);
      const existingSnapsProjects=loadSnaps(snapsProjectsData);
      const existingSnapsChangelog=loadSnaps(snapsChangelogData);
      const existingSnapsUsers=loadSnaps(snapsUsersData);
      setSnapsPeople(existingSnapsPeople);
      setSnapsProjects(existingSnapsProjects);
      setSnapsChangelog(existingSnapsChangelog);
      setSnapsUsers(existingSnapsUsers);
      // Auto daily snapshot for each store — only if real data loaded
      if(stateLoaded){
        const todayStr=new Date().toISOString().slice(0,10);
        const ts=Date.now();
        const autoSnap=(label,extra)=>({id:`snap-${todayStr}-auto`,date:todayStr,label,timestamp:ts,auto:true,...extra});
        const putSnap=(key,snaps)=>saveLS(key,{version:STORE_VERSION,snapshots:snaps});
        if(!existingSnapsPeople.some(s=>s.date===todayStr&&s.auto)){
          const updated=[autoSnap('Daily auto-snapshot',{engineers,discMeta,tierOrder}),...existingSnapsPeople].slice(0,10);
          setSnapsPeople(updated);putSnap(STORE_SNAPS_PEOPLE_URL,updated);
        }
        if(!existingSnapsProjects.some(s=>s.date===todayStr&&s.auto)){
          const updated=[autoSnap('Daily auto-snapshot',{projects,assignments}),...existingSnapsProjects].slice(0,10);
          setSnapsProjects(updated);putSnap(STORE_SNAPS_PROJECTS_URL,updated);
        }
      }
      setStoreLoaded(true);
    });
  },[]);

  // Save people data (engineers + discipline hierarchy) on change (debounced 1.5s)
  React.useEffect(()=>{
    if(!storeLoaded)return; // don't overwrite server data before initial load completes
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current=setTimeout(()=>{
      setSaveStatus('saving');
      saveLS(STORE_PEOPLE_URL,{version:STORE_VERSION,engineers:state.engineers,discMeta:state.discMeta,tierOrder:state.tierOrder});
      setSaveStatus('saved');setTimeout(()=>setSaveStatus(null),2000);
    },1500);
    return()=>clearTimeout(saveTimerRef.current);
  },[storeLoaded,state.engineers,state.discMeta,state.tierOrder]);

  // Save project data (projects + assignments) on change (debounced 1.5s)
  React.useEffect(()=>{
    if(!storeLoaded)return; // don't overwrite server data before initial load completes
    clearTimeout(saveProjectsTimerRef.current);
    saveProjectsTimerRef.current=setTimeout(()=>{
      setSaveStatus('saving');
      saveLS(STORE_PROJECTS_URL,{version:STORE_VERSION,projects:state.projects,assignments:state.assignments});
      setSaveStatus('saved');setTimeout(()=>setSaveStatus(null),2000);
    },1500);
    return()=>clearTimeout(saveProjectsTimerRef.current);
  },[storeLoaded,state.projects,state.assignments]);

  // Take manual snapshot of all 4 stores
  const handleTakeSnapshot=useCallback(()=>{
    const now=new Date();
    const todayStr=now.toISOString().slice(0,10);
    const ts=Date.now();
    const base={id:`snap-${ts}-manual`,date:todayStr,label:'Manual snapshot',timestamp:ts,auto:false};
    const put=(key,snaps)=>saveLS(key,{version:STORE_VERSION,snapshots:snaps});
    setSnapsPeople(prev=>{const u=[{...base,engineers:state.engineers,discMeta:state.discMeta,tierOrder:state.tierOrder},...prev].slice(0,10);put(STORE_SNAPS_PEOPLE_URL,u);return u;});
    setSnapsProjects(prev=>{const u=[{...base,projects:state.projects,assignments:state.assignments,tierOrder:state.tierOrder},...prev].slice(0,10);put(STORE_SNAPS_PROJECTS_URL,u);return u;});
    setSnapsChangelog(prev=>{
      const entries=[...changeLog].slice(0,500);
      const u=[{...base,entries},...prev].slice(0,10);put(STORE_SNAPS_CHANGELOG_URL,u);return u;
    });
    setSnapsUsers(prev=>{const u=[{...base,users:userRegistry},...prev].slice(0,10);put(STORE_SNAPS_USERS_URL,u);return u;});
    addLog('Took manual snapshot','info');
  },[state.projects,state.engineers,state.assignments,state.discMeta,changeLog,userRegistry,addLog]);

  // Per-store restore handlers
  const fmtSnapLabel=ts=>new Date(ts).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  const handleRestorePeople=useCallback((snap)=>{
    dispatch({type:'LOAD_STATE',projects:state.projects,engineers:snap.engineers||[],assignments:state.assignments,discMeta:migrateDiscMeta(snap.discMeta||null),tierOrder:migrateTierOrder(snap.tierOrder||state.tierOrder)});
    setExpandedProjects(new Set());
    addLog(`Restored People from ${fmtSnapLabel(snap.timestamp)}`,'info');
  },[dispatch,state.projects,state.assignments,addLog]);
  const handleRestoreProjects=useCallback((snap)=>{
    dispatch({type:'LOAD_STATE',projects:snap.projects||[],engineers:state.engineers,assignments:snap.assignments||[],discMeta:state.discMeta,tierOrder:migrateTierOrder(snap.tierOrder||state.tierOrder)});
    setExpandedProjects(new Set());
    addLog(`Restored Projects from ${fmtSnapLabel(snap.timestamp)}`,'info');
  },[dispatch,state.engineers,state.discMeta,addLog]);
  const handleRestoreChangelog=useCallback((snap)=>{
    setChangeLog(snap.entries||[]);
    addLog(`Restored Change Log from ${fmtSnapLabel(snap.timestamp)}`,'info');
  },[addLog]);
  const handleRestoreUsers=useCallback((snap)=>{
    if(Array.isArray(snap.users)){
      setUserRegistry(snap.users);
      saveLS(STORE_USERS_URL,{version:STORE_VERSION,users:snap.users});
    }
    addLog(`Restored Users from ${fmtSnapLabel(snap.timestamp)}`,'info');
  },[addLog]);

  // Save changelog on change (debounced 1.5s)
  React.useEffect(()=>{
    if(!storeLoaded)return; // don't overwrite server data before initial load completes
    clearTimeout(saveLogTimerRef.current);
    saveLogTimerRef.current=setTimeout(()=>{
      saveLS(STORE_LOG_URL,{version:STORE_VERSION,entries:changeLog});
    },1500);
    return()=>clearTimeout(saveLogTimerRef.current);
  },[storeLoaded,changeLog]);

  // Save user registry on change (debounced 1.5s)
  React.useEffect(()=>{
    if(!storeLoaded)return; // don't overwrite server data before initial load completes
    clearTimeout(saveUsersTimerRef.current);
    saveUsersTimerRef.current=setTimeout(()=>{
      saveLS(STORE_USERS_URL,{version:STORE_VERSION,users:userRegistry});
    },1500);
    return()=>clearTimeout(saveUsersTimerRef.current);
  },[storeLoaded,userRegistry]);

  // Compute permissions for the current user
  const userPerms=useMemo(()=>{
    const isLocal=window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1';
    const email=isLocal&&!currentUserEmail?SUPERADMIN_EMAIL:currentUserEmail;
    if(!email)return{isAdmin:false,canEditSupply:false,canEditProject:()=>false,canDeleteProject:false,role:'viewer',email:null,userName:null,_isRealAdmin:false};
    let base;
    if(email.toLowerCase()===SUPERADMIN_EMAIL.toLowerCase())
      base={isAdmin:true,canEditSupply:true,canEditProject:()=>true,canDeleteProject:true,role:'admin',email,userName:'Oliver Lewis',_isRealAdmin:true};
    else{
      const u=userRegistry.find(x=>x.email===email);
      if(!u)base={isAdmin:false,canEditSupply:false,canEditProject:()=>false,canDeleteProject:false,role:'viewer',email,userName:null,_isRealAdmin:false};
      else base={
        isAdmin:u.role==='admin',
        canEditSupply:u.role==='admin'||u.role==='fm',
        canEditProject:(id)=>u.role==='admin'||(u.role==='pm'&&(u.projects||[]).includes(id)),
        canDeleteProject:u.role==='admin',
        role:u.role,email,userName:u.name,_isRealAdmin:u.role==='admin',
      };
    }
    // Admin can impersonate a role for testing
    if(testRole&&base._isRealAdmin){
      return{
        ...base,
        isAdmin:false,
        canEditSupply:testRole==='fm',
        canEditProject:()=>testRole==='pm',
        canDeleteProject:false,
        role:testRole,
      };
    }
    return base;
  },[currentUserEmail,userRegistry,testRole]);

  const {projects,engineers,assignments,viewStart}=state;

  useEffect(()=>{
    const q=peopleSearch.toLowerCase().trim();
    if(!q){if(searchAutoOpened.current){setRosterTarget(null);searchAutoOpened.current=false;}return;}
    function findDeepestNode(nodes,disc){for(const n of nodes){if((n.allDiscs||[]).includes(disc)){const deeper=findDeepestNode(n.children,disc);return deeper||n;}}return null;}
    const matches=engineers.filter(e=>!e.inactive&&e.name.toLowerCase().includes(q));
    if(matches.length===1){
      const eng=matches[0];
      const node=findDeepestNode(simplifiedOrgRoots,eng.discipline);
      if(node){setRosterTarget({label:node.name,discs:node.allDiscs,color:node.color,searchHighlight:eng.id});searchAutoOpened.current=true;}
    }else{
      if(searchAutoOpened.current){setRosterTarget(null);searchAutoOpened.current=false;}
    }
  },[peopleSearch,engineers,simplifiedOrgRoots]);

  const months=useMemo(()=>Array.from({length:12},(_,i)=>addMonths(viewStart,i)),[viewStart]);
  const viewLabel=`${fmtMonth(viewStart)} – ${fmtMonth(addMonths(viewStart,11))}`;
  const yearGroups=useMemo(()=>{
    const groups=[];
    months.forEach(m=>{
      const yr=m.split('-')[0];
      if(!groups.length||groups[groups.length-1].year!==yr)groups.push({year:yr,count:1});
      else groups[groups.length-1].count++;
    });
    return groups;
  },[months]);
  const handleHover=(e,project,disc,month)=>{
    clearTimeout(tooltipTimer.current);
    tooltipTimer.current=setTimeout(()=>{
      const assigned=getAssigned(assignments,engineers,project.id,disc,month);
      const supply=getSupply(assignments,engineers,project.id,disc,month);
      const demand=getDemand(project,disc,month,activeMeta);
      setTooltip({project,disc,month,assigned,supply,demand,x:e.clientX,y:e.clientY});
    },120);
  };
  const handleLeave=()=>{clearTimeout(tooltipTimer.current);setTooltip(null);};

  const handleCellClick=(project,disc,month)=>{
    setTooltip(null);
    setAssignCtx({project,disc,month});
  };
  /* Demand is at Discipline tier (subsubgroup → subgroup → group).
     Any cell click in demand mode routes to the discipline key. */
  const handleDemandCellClick=(e,project,disc,month)=>{
    /* Store at disc's own key — each row owns its demand independently */
    const delta=e.shiftKey?-1:1;
    const current=getDemand(project,disc,month,activeMeta);
    const newVal=Math.max(0,current+delta);
    const monthlyDemand={...(project.monthlyDemand||{}),[disc]:{...(project.monthlyDemand?.[disc]||{}),[month]:newVal}};
    dispatch({type:'UPDATE_PROJECT',project:{...project,monthlyDemand}});
    addLog(`Set ${disc} demand for "${project.name}" in ${fmtMonth(month)} to ${newVal} FTE`,'edit',`demand:${project.id}:${disc}:${month}`);
  };
  const handleAddAssignment=(assignment)=>{
    dispatch({type:'ADD_ASSIGNMENT',assignment});
  };
  const handleRemoveAssignment=(id)=>{
    dispatch({type:'REMOVE_ASSIGNMENT',id});
  };
  const handleExtendAssignment=(id,endMonth)=>{
    dispatch({type:'EXTEND_ASSIGNMENT',id,endMonth});
  };
  const handleMoveStartAssignment=(id,startMonth)=>{
    dispatch({type:'UPDATE_ASSIGNMENT',id,updates:{startMonth}});
  };
  const ALLOC_CYCLE=[100,75,50,25];
  const handleChangeAllocAssignment=(id,currentAlloc)=>{
    const _ci=ALLOC_CYCLE.indexOf(currentAlloc);
    const next=ALLOC_CYCLE[_ci===-1?0:(_ci+1)%ALLOC_CYCLE.length];
    dispatch({type:'UPDATE_ASSIGNMENT',id,updates:{allocation:next}});
  };

  const handleSaveProject=(proj)=>{
    const{_isNew,...cleanProj}=proj;
    if(_isNew){
      dispatch({type:'ADD_PROJECT',project:cleanProj});
      addLog(`Created project "${cleanProj.name}"`,'add');
    }else{
      dispatch({type:'UPDATE_PROJECT',project:cleanProj});
      addLog(`Updated project "${cleanProj.name}"`,'edit');
    }
    setSettingsProject(null);
  };
  const handleDeleteProject=(id)=>{
    const pName=projects.find(p=>p.id===id)?.name||id;
    addLog(`Deleted project "${pName}"`,'remove');
    dispatch({type:'DELETE_PROJECT',id});
    setExpandedProjects(s=>{const n=new Set(s);n.delete(id);return n;});
    setSettingsProject(null);
  };
  const handleAddProject=()=>{
    const id=`proj-${Date.now()}`;
    const usedColors=new Set(projects.map(p=>p.color));
    const autoColor=PROJECT_COLORS.find(c=>!usedColors.has(c))||PROJECT_COLORS[projects.length%PROJECT_COLORS.length];
    const zeroDemand=Object.fromEntries([...new Set(Object.keys(activeMeta).map(d=>discDemandKey(d)))].map(k=>[k,0]));
    const newProj={
      _isNew:true,
      id,name:'New Project',color:autoColor,
      startMonth:TODAY,endMonth:addMonths(TODAY,11),
      demand:zeroDemand,
      rampUp:{enabled:false,months:2},
      rampDown:{enabled:false,months:2},
    };
    setSettingsProject(newProj);
  };

  // Project-level heatmap: max total demand (sum of all leaf discs) per project per month
  const projHeatmapMax=useMemo(()=>{
    if(editMode!=='demand')return 0;
    const vals=projects.flatMap(p=>months.map(m=>roundHalf(activeDiscs.reduce((s,d)=>s+getDemand(p,d,m,activeMeta),0))));
    return Math.max(...vals,0.01);
  },[editMode,projects,months,activeDiscs]);
  // Discipline-level heatmap: max demand for any single leaf disc across all projects/months
  const discHeatmapMax=useMemo(()=>{
    if(editMode!=='demand')return 0;
    const vals=projects.flatMap(p=>activeDiscs.flatMap(d=>months.map(m=>getDemand(p,d,m,activeMeta))));
    return Math.max(...vals,0.01);
  },[editMode,projects,months,activeDiscs]);
  const allExpanded=projects.length>0&&projects.every(p=>expandedProjects.has(p.id));
  /* When only one top-level group exists, the tier-2 (expandedProjGroups) expand has no visible
     effect — disc sub-rows are rendered unconditionally by the !hasMultipleGroups fallback.
     In that case we skip tier-2 and map: Dept→tier3, Disc→tier4. */
  const hasMultipleGroups=discGroupOrder.length>1;
  /* Projects — collapse everything */
  const handleCollapseAll=()=>{setExpandedProjects(new Set());setExpandedProjGroups(new Set());setExpandedProjSubgroups(new Set());setExpandedProjSubsubgroups(new Set());setExpandedProjSssgs(new Set());};
  /* Departments — expand project rows only */
  const handleExpandAll=()=>{setExpandedProjects(new Set(projects.map(p=>p.id)));setExpandedProjGroups(new Set());setExpandedProjSubgroups(new Set());setExpandedProjSubsubgroups(new Set());setExpandedProjSssgs(new Set());};
  const tier2Active=expandedProjGroups.size>0;
  /* Disciplines — expand dept group headers (reveals discipline rows collapsed) */
  const handleExpandTier2=()=>{
    setExpandedProjects(new Set(projects.map(p=>p.id)));
    const s=new Set();projects.forEach(p=>discGroupOrder.forEach(g=>s.add(`${p.id}::${g}`)));setExpandedProjGroups(s);
    setExpandedProjSubgroups(new Set());setExpandedProjSubsubgroups(new Set());setExpandedProjSssgs(new Set());
  };
  const handleCollapseTier2=()=>{setExpandedProjGroups(new Set());setExpandedProjSubgroups(new Set());setExpandedProjSubsubgroups(new Set());setExpandedProjSssgs(new Set());};
  const tier3Active=expandedProjSubgroups.size>0;
  /* Subdisciplines — expand discipline rows (reveals subdiscipline rows collapsed, teams hidden) */
  const handleExpandTier3=()=>{
    setExpandedProjects(new Set(projects.map(p=>p.id)));
    const s2=new Set();projects.forEach(p=>discGroupOrder.forEach(g=>s2.add(`${p.id}::${g}`)));setExpandedProjGroups(s2);
    const s3=new Set();projects.forEach(p=>discGroupOrder.forEach(g=>(discGroupMap[g]||[]).filter(sg=>sg!==g).forEach(sg=>s3.add(`${p.id}::${sg}`))));setExpandedProjSubgroups(s3);
    setExpandedProjSubsubgroups(new Set());setExpandedProjSssgs(new Set());
  };
  const handleCollapseTier3=()=>{setExpandedProjSubgroups(new Set());setExpandedProjSubsubgroups(new Set());setExpandedProjSssgs(new Set());};
  const tier4Active=expandedProjSubsubgroups.size>0;
  /* Subdisc — expand SSG headers (reveals subdisc rows, teams hidden) */
  const handleExpandTier4=()=>{
    setExpandedProjects(new Set(projects.map(p=>p.id)));
    const s2=new Set();projects.forEach(p=>discGroupOrder.forEach(g=>s2.add(`${p.id}::${g}`)));setExpandedProjGroups(s2);
    const s3=new Set();projects.forEach(p=>discGroupOrder.forEach(g=>(discGroupMap[g]||[]).filter(sg=>sg!==g).forEach(sg=>s3.add(`${p.id}::${sg}`))));setExpandedProjSubgroups(s3);
    const s4=new Set();projects.forEach(p=>discGroupOrder.forEach(g=>(discGroupMap[g]||[]).forEach(sg=>(discSsgMap[sg]||[]).filter(ssg=>ssg!==sg).forEach(ssg=>s4.add(`${p.id}::${ssg}`)))));setExpandedProjSubsubgroups(s4);
    setExpandedProjSssgs(new Set());
  };
  const handleCollapseTier4=()=>{setExpandedProjSubsubgroups(new Set());setExpandedProjSssgs(new Set());};
  const tier5Active=expandedProjSssgs.size>0;
  /* All — expand everything including subdisc (team) rows */
  const handleExpandTier5=()=>{
    setExpandedProjects(new Set(projects.map(p=>p.id)));
    const s2=new Set();projects.forEach(p=>discGroupOrder.forEach(g=>s2.add(`${p.id}::${g}`)));setExpandedProjGroups(s2);
    const s3=new Set();projects.forEach(p=>discGroupOrder.forEach(g=>(discGroupMap[g]||[]).filter(sg=>sg!==g).forEach(sg=>s3.add(`${p.id}::${sg}`))));setExpandedProjSubgroups(s3);
    const s4=new Set();projects.forEach(p=>discGroupOrder.forEach(g=>(discGroupMap[g]||[]).forEach(sg=>(discSsgMap[sg]||[]).filter(ssg=>ssg!==sg).forEach(ssg=>s4.add(`${p.id}::${ssg}`)))));setExpandedProjSubsubgroups(s4);
    const s5=new Set();projects.forEach(p=>Object.keys(activeMeta).forEach(d=>{const sssg=activeMeta[d]?.subdisc;if(sssg)s5.add(`${p.id}::${sssg}`);}));setExpandedProjSssgs(s5);
  };
  const handleCollapseTier5=()=>setExpandedProjSssgs(new Set());

  // ── drag-to-reorder helpers ────────────────────────────────
  const handleProjDragStart=(e,id)=>{
    e.stopPropagation();
    setDraggedProjId(id);
    e.dataTransfer.effectAllowed='move';
  };
  const handleProjDragOver=(e,id)=>{
    e.preventDefault();
    e.stopPropagation();
    const rect=e.currentTarget.getBoundingClientRect();
    const after=(e.clientY-rect.top)>rect.height/2;
    setDragOverProjId(id);
    setDragOverAfter(after);
  };
  const handleProjDrop=(e,toId)=>{
    e.preventDefault();
    e.stopPropagation();
    if(draggedProjId&&draggedProjId!==toId){
      dispatch({type:'REORDER_PROJECTS',fromId:draggedProjId,toId,after:dragOverAfter});
    }
    setDraggedProjId(null);setDragOverProjId(null);
  };
  const handleProjDragEnd=()=>{setDraggedProjId(null);setDragOverProjId(null);};

  return(
    <UserCtx.Provider value={{...userPerms,userRegistry,setUserRegistry}}>
    <DiscCtx.Provider value={activeMeta}>
    <div style={{display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden'}}>
      <div style={{flexShrink:0,background:'#fefce8',borderBottom:'1px solid #f5c800',display:'flex',alignItems:'stretch'}}>
        <div style={{width:8,flexShrink:0,background:'repeating-linear-gradient(45deg,#f5c800,#f5c800 5px,#1a1a1a 5px,#1a1a1a 10px)'}}/>
        <div style={{padding:'6px 14px',fontSize:13,color:'#1a1a1a',lineHeight:1.4,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
          <span>🚧 <strong>Demo Mode</strong> — sample data, changes save to this browser only.</span>
        </div>
      </div>
      {testRole&&(
        <div style={{background:'#FEF3C7',borderBottom:'1px solid #FCD34D',padding:'6px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px',fontSize:'.8rem',flexShrink:0}}>
          <span style={{display:'flex',alignItems:'center',gap:'8px',color:'#92400E',fontWeight:500}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
            Viewing as <strong style={{marginLeft:'2px'}}>{testRole==='pm'?'Program Manager':'Functional Manager'}</strong> — {testRole==='pm'?'can edit Demand, read-only Supply':'can edit Supply, read-only Demand'}
          </span>
          <button onClick={()=>setTestRole(null)}
            style={{background:'#D97706',color:'#fff',border:'none',borderRadius:'5px',padding:'3px 10px',fontSize:'.78rem',fontWeight:600,cursor:'pointer',whiteSpace:'nowrap'}}>
            Exit test mode
          </button>
        </div>
      )}
      {helpOpen&&<HelpModal onClose={()=>setHelpOpen(false)}/>}
      {dataFilesOpen&&<StoreDataModal onClose={()=>setDataFilesOpen(false)}/>}
      {tierOrderOpen&&<TierOrderModal discMeta={state.discMeta||{}} tierOrder={state.tierOrder||{}} onClose={()=>setTierOrderOpen(false)} onSave={o=>{dispatch({type:'SET_TIER_ORDER',tierOrder:o});setTierOrderOpen(false);}}/>}
      {usersOpen&&<UserRegistryModal projects={projects} onClose={()=>setUsersOpen(false)} userRegistry={userRegistry} setUserRegistry={setUserRegistry} currentEmail={userPerms.email}/>}
      {engineerRegistryOpen&&<EngineerRegistryModal onClose={()=>setEngineerRegistryOpen(false)} engineers={engineers} discMeta={state.discMeta||{}} dispatch={dispatch}/>}
      {snapshotsOpen&&<SnapshotsModal
        snapsPeople={snapsPeople} snapsProjects={snapsProjects}
        snapsChangelog={snapsChangelog} snapsUsers={snapsUsers}
        onRestorePeople={handleRestorePeople} onRestoreProjects={handleRestoreProjects}
        onRestoreChangelog={handleRestoreChangelog} onRestoreUsers={handleRestoreUsers}
        onTakeSnapshot={handleTakeSnapshot} onClose={()=>setSnapshotsOpen(false)}/>}
      {baselineEmailOpen&&<BaselineEmailModal onClose={()=>setBaselineEmailOpen(false)} engineers={engineers} assignments={state.assignments||[]} projects={projects} senderName={userPerms.userName||'Oliver'} userRegistry={userRegistry}/>}
      {workdayImportOpen&&<WorkdayImportModal existingEngineers={engineers} onClose={()=>setWorkdayImportOpen(false)} onImport={(newEngineers,discMeta,mode,departedIds,buName,managerUsers)=>{
        if(mode==='replace'){
          const newProjects=state.projects.map(p=>({
            ...p,
            demand:Object.fromEntries(Object.keys(discMeta).map(d=>[d,0])),
            monthlyDemand:{},rampUp:{},rampDown:{},
          }));
          dispatch({type:'IMPORT_DATA',projects:newProjects,engineers:newEngineers,assignments:[],discMeta});
          setExpandedProjects(new Set());
        }else{
          // Build remap: old unprefixed disc key → new BU-prefixed key (e.g. "SW - X" → "Stretch - SW - X")
          // Only remap old-style group keys (HW/SW/etc.) — never remap keys that belong to a different product BU
          const discKeyRemap={};
          if(buName){
            const OLD_STYLE_BUS=new Set(['HW','SW','SEIT','PM','Other']);
            Object.keys(discMeta).forEach(newKey=>{
              if(newKey.startsWith(buName+' - ')){
                const oldKey=newKey.slice(buName.length+3);
                const oldMeta=state.discMeta[oldKey];
                if(oldMeta){
                  const ob=oldMeta.bu||'';
                  if(!ob||ob===buName||OLD_STYLE_BUS.has(ob))discKeyRemap[oldKey]=newKey;
                }
              }
            });
          }
          const exById=new Map(engineers.map(e=>[e.id,e]));
          newEngineers.forEach(e=>{
            const ex=exById.get(e.id);
            if(!ex){
              addLog(`Added ${e.name} to roster · ${e.discipline}`,'add');
            }else{
              const changes=[];
              if(ex.discipline!==e.discipline)changes.push(`team: ${ex.discipline} → ${e.discipline}`);
              if((ex.title||'')!==(e.title||''))changes.push('title updated');
              if(!!ex.isContractor!==!!e.isContractor)changes.push(e.isContractor?'contractor [C] added':'contractor [C] removed');
              if(ex.name!==e.name)changes.push(`renamed: "${ex.name}" → "${e.name}"`);
              if(changes.length)addLog(`Updated ${e.name} · ${changes.join(', ')}`,'edit');
            }
          });
          const deps=departedIds||new Set();
          engineers.filter(e=>deps.has(e.id)).forEach(e=>addLog(`Marked ${e.name} inactive · ${e.discipline}`,'remove'));
          dispatch({type:'MERGE_IMPORT',engineers:newEngineers,discMeta,departedIds:deps,discKeyRemap});
        }
        if(managerUsers&&managerUsers.length){
          setUserRegistry(prev=>{
            const next=[...prev];
            for(const mu of managerUsers){
              const idx=next.findIndex(u=>u.email===mu.email);
              if(idx>=0){
                const existing=new Set(next[idx].managedDiscs||[]);
                mu.managedDiscs.forEach(d=>existing.add(d));
                next[idx]={...next[idx],name:next[idx].name||mu.name,managedDiscs:[...existing]};
              }else{
                next.push({email:mu.email,name:mu.name,role:'fm',projects:[],managedDiscs:mu.managedDiscs});
              }
            }
            return next;
          });
        }
        setWorkdayImportOpen(false);
      }}/>}
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="app-header">
        <div style={{display:'flex',flexDirection:'column',gap:'1px'}}>
          <div className="logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect x="2"  y="3"  width="8" height="8" rx="1.5" fill="#3B82F6"/>
              <rect x="14" y="3"  width="8" height="8" rx="1.5" fill="#10B981"/>
              <rect x="2"  y="15" width="8" height="8" rx="1.5" fill="#8B5CF6"/>
              <rect x="14" y="15" width="8" height="8" rx="1.5" fill="#F59E0B"/>
            </svg>
            CapacityIQ
          </div>
          <div style={{fontSize:'.7rem',color:'#fff',paddingLeft:'2px',display:'flex',alignItems:'center',gap:'4px'}}>
            Created by Oliver Lewis +&nbsp;<svg width="11" height="11" viewBox="0 0 248 248" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M52.4285 162.873L98.7844 136.879L99.5485 134.602L98.7844 133.334H96.4921L88.7237 132.862L62.2346 132.153L39.3113 131.207L17.0249 130.026L11.4214 128.844L6.2 121.873L6.7094 118.447L11.4214 115.257L18.171 115.847L33.0711 116.911L55.485 118.447L71.6586 119.392L95.728 121.873H99.5485L100.058 120.337L98.7844 119.392L97.7656 118.447L74.5877 102.732L49.4995 86.1905L36.3823 76.62L29.3779 71.7757L25.8121 67.2858L24.2839 57.3608L30.6515 50.2716L39.3113 50.8623L41.4763 51.4531L50.2636 58.1879L68.9842 72.7209L93.4357 90.6804L97.0015 93.6343L98.4374 92.6652L98.6571 91.9801L97.0015 89.2625L83.757 65.2772L69.621 40.8192L63.2534 30.6579L61.5978 24.632C60.9565 22.1032 60.579 20.0111 60.579 17.4246L67.8381 7.49965L71.9133 6.19995L81.7193 7.49965L85.7946 11.0443L91.9074 24.9865L101.714 46.8451L116.996 76.62L121.453 85.4816L123.873 93.6343L124.764 96.1155H126.292V94.6976L127.566 77.9197L129.858 57.3608L132.15 30.8942L132.915 23.4505L136.608 14.4708L143.994 9.62643L149.725 12.344L154.437 19.0788L153.8 23.4505L150.998 41.6463L145.522 70.1215L141.957 89.2625H143.994L146.414 86.7813L156.093 74.0206L172.266 53.698L179.398 45.6635L187.803 36.802L193.152 32.5484H203.34L210.726 43.6549L207.415 55.1159L196.972 68.3492L188.312 79.5739L175.896 96.2095L168.191 109.585L168.882 110.689L170.738 110.53L198.755 104.504L213.91 101.787L231.994 98.7149L240.144 102.496L241.036 106.395L237.852 114.311L218.495 119.037L195.826 123.645L162.07 131.592L161.696 131.893L162.137 132.547L177.36 133.925L183.855 134.279H199.774L229.447 136.524L237.215 141.605L241.8 147.867L241.036 152.711L229.065 158.737L213.019 154.956L175.45 145.977L162.587 142.787H160.805V143.85L171.502 154.366L191.242 172.089L215.82 195.011L217.094 200.682L213.91 205.172L210.599 204.699L188.949 188.394L180.544 181.069L161.696 165.118H160.422V166.772L164.752 173.152L187.803 207.771L188.949 218.405L187.294 221.832L181.308 223.959L174.813 222.777L161.187 203.754L147.305 182.486L136.098 163.345L134.745 164.2L128.075 235.42L125.019 239.082L117.887 241.8L111.902 237.31L108.718 229.984L111.902 215.452L115.722 196.547L118.779 181.541L121.58 162.873L123.291 156.636L123.14 156.219L121.773 156.449L107.699 175.752L86.304 204.699L69.3663 222.777L65.291 224.431L58.2867 220.768L58.9235 214.27L62.8713 208.48L86.304 178.705L100.44 160.155L109.551 149.507L109.462 147.967L108.959 147.924L46.6977 188.512L35.6182 189.93L30.7788 185.44L31.4156 178.115L33.7079 175.752L52.4285 162.873Z" fill="#D97757"/></svg>
          </div>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:'4px',marginLeft:'8px'}}>
          <div style={{fontSize:'.88rem',color:'#fff'}}>
            {engineers.length} engineers · {projects.length} projects · {assignments.length} assignments
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
            <span style={{fontSize:'.76rem',color:'#fff',letterSpacing:'.1px'}}>demand − supply = diff</span>
            <div className="legend-anchor">
              <span className="legend-icon-btn">?</span>
              <div className="legend-popup">
                <div className="legend-popup-title">How to read each cell</div>
                <div className="legend-cell-demo">
                  <div className="legend-demo-box">
                    <span className="legend-demo-gap">−2.5</span>
                    <div className="legend-demo-track">
                      <div className="legend-demo-fill"/>
                    </div>
                  </div>
                  <div style={{fontSize:'.8rem',color:'var(--text-2)',lineHeight:1.6}}>
                    <div><strong style={{color:'var(--text-1)'}}>difference</strong> = demand − supply</div>
                    <div><strong style={{color:'var(--text-1)'}}>bar outline</strong> = demand</div>
                    <div><strong style={{color:'var(--text-1)'}}>colored bar</strong> = supply</div>
                  </div>
                </div>
                <div className="legend-colors">
                  <div className="legend-color-row"><div className="legend-dot" style={{background:'#EF4444'}}/><span>{'< 70%'} staffed</span></div>
                  <div className="legend-color-row"><div className="legend-dot" style={{background:'#F59E0B'}}/><span>70 – 99% staffed</span></div>
                  <div className="legend-color-row"><div className="legend-dot" style={{background:'#3B82F6'}}/><span>100 – 105% staffed</span></div>
                  <div className="legend-color-row"><div className="legend-dot" style={{background:'#10B981'}}/><span>{'> 105%'} staffed (over)</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Undo / Redo ── */}
        <div style={{display:'flex',gap:'3px',flexShrink:0,marginLeft:'auto',alignItems:'center'}}>
          {saveStatus&&(
            <span style={{fontSize:'.72rem',color:saveStatus==='saved'?'#15803D':saveStatus==='error'?'#B91C1C':'var(--text-3)',marginRight:'4px',transition:'opacity .2s'}}>
              {saveStatus==='saving'?'Saving…':saveStatus==='saved'?'✓ Saved':'⚠ Save failed'}
            </span>
          )}
          <button className="undo-btn" onClick={handleUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">↩</button>
          <button className="undo-btn" onClick={handleRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">↪</button>
        </div>

        {/* ── Help button ── */}
        <button className="undo-btn" onClick={()=>setHelpOpen(true)} title="How to use CapacityIQ" style={{fontSize:'.85rem',fontWeight:700}}>?</button>

        {/* ── Action menu (with embedded user identity) ── */}
        <ActionMenu
          onAddProject={handleAddProject}
          onSnapshots={()=>setSnapshotsOpen(true)}
          onWorkday={()=>setWorkdayImportOpen(true)}
          onBaselineEmails={()=>setBaselineEmailOpen(true)}
          onDataFiles={()=>setDataFilesOpen(true)}
          onManageUsers={()=>setUsersOpen(true)}
          onManageEngineers={()=>setEngineerRegistryOpen(true)}
          isAdmin={userPerms.isAdmin}
          isRealAdmin={userPerms._isRealAdmin||false}
          testRole={testRole}
          onTestRole={setTestRole}
          userName={userPerms.userName||userPerms.email?.split('@')[0]||null}
          userRole={userPerms.role}
          userEmail={userPerms.email}
        />
      </header>

      {/* ── Page navigation tabs ─────────────────────────────────── */}
      <nav className="page-nav">
        <button className={`page-nav-tab${currentPage==='project'?' active':''}`} onClick={()=>navigate('project')}>Projects</button>
        <button className={`page-nav-tab${currentPage==='discipline'?' active':''}`} onClick={()=>navigate('discipline')}>People</button>
        <button className={`page-nav-tab${currentPage==='changelog'?' active':''}`} onClick={()=>navigate('changelog')}>
          Change Log{changeLog.length>0&&<span style={{marginLeft:'6px',fontSize:'.7rem',background:'var(--bg)',padding:'1px 6px',borderRadius:'999px',border:'1px solid var(--border)',color:'var(--text-3)',fontWeight:400}}>{changeLog.length}</span>}
        </button>
      </nav>

      {/* ── Empty state welcome screen ── */}
      {storeLoaded&&engineers.length===0&&projects.length===0&&(
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'24px',padding:'48px 24px',background:'var(--bg)'}}>
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="3" width="8" height="8" rx="1.5" fill="#3B82F6" opacity=".3"/>
            <rect x="14" y="3" width="8" height="8" rx="1.5" fill="#10B981" opacity=".3"/>
            <rect x="2" y="15" width="8" height="8" rx="1.5" fill="#8B5CF6" opacity=".3"/>
            <rect x="14" y="15" width="8" height="8" rx="1.5" fill="#F59E0B" opacity=".3"/>
          </svg>
          <div style={{textAlign:'center',maxWidth:'420px'}}>
            <div style={{fontSize:'1.25rem',fontWeight:700,color:'var(--text-1)',marginBottom:'8px'}}>Welcome to CapacityIQ</div>
            <div style={{fontSize:'.92rem',color:'var(--text-2)',lineHeight:1.6}}>Import your org chart to get started. Use a Workday CSV export to load your team structure, or import a previously saved CapacityIQ file.</div>
          </div>
          <div style={{display:'flex',gap:'12px',flexWrap:'wrap',justifyContent:'center'}}>
            {userPerms._isRealAdmin&&<button onClick={()=>setWorkdayImportOpen(true)} style={{display:'flex',alignItems:'center',gap:'8px',padding:'10px 20px',background:'var(--primary)',color:'#fff',border:'none',borderRadius:'8px',fontSize:'.9rem',fontWeight:600,cursor:'pointer'}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6"/><path d="M16 11l2 2 4-4"/></svg>
              Import Org Chart
            </button>}
          </div>
        </div>
      )}

      {/* ── No-projects welcome screen ── */}
      {currentPage==='project'&&storeLoaded&&engineers.length>0&&projects.length===0&&(
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'28px',padding:'48px 24px',background:'var(--bg)'}}>
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2"/>
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
            <line x1="12" y1="12" x2="12" y2="16"/>
            <line x1="10" y1="14" x2="14" y2="14"/>
          </svg>
          <div style={{textAlign:'center',maxWidth:'380px'}}>
            <div style={{fontSize:'1.2rem',fontWeight:700,color:'var(--text-1)',marginBottom:'10px'}}>Create your first project</div>
            <div style={{fontSize:'.88rem',color:'var(--text-2)',lineHeight:1.65}}>Your org chart is loaded with <strong style={{color:'var(--text-1)'}}>{engineers.length} engineers</strong>. Add a project to start tracking demand and assignments across your team.</div>
          </div>
          <button onClick={handleAddProject} style={{display:'flex',alignItems:'center',gap:'8px',padding:'11px 24px',background:'#3B82F6',color:'#fff',border:'none',borderRadius:'8px',fontSize:'.9rem',fontWeight:600,cursor:'pointer',boxShadow:'0 1px 4px rgba(59,130,246,.35)'}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Project
          </button>
          <div style={{fontSize:'.78rem',color:'var(--text-3)',textAlign:'center',maxWidth:'340px',lineHeight:1.55}}>
            Each project has a name, date range, color, and per-discipline FTE targets. You can add as many projects as needed and reorder them by dragging.
          </div>
        </div>
      )}

      {/* ── Projects toolbar (date nav + mode toggle) ───────────── */}
      {currentPage==='project'&&storeLoaded&&projects.length>0&&(
        <div className="projects-toolbar">
          {/* left cell — demand hint */}
          <div>
            {editMode==='demand'&&(
              <span style={{fontSize:'.72rem',color:'var(--text-3)',fontStyle:'italic',letterSpacing:'.01em',whiteSpace:'nowrap'}}>
                ↑ click &nbsp;·&nbsp; ↓ shift‑click
              </span>
            )}
          </div>
          {/* center cell — date navigator */}
          <div className="month-nav">
            <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
              <button className="nav-btn" onClick={()=>dispatch({type:'SET_VIEW_START',month:addMonths(viewStart,-1)})}>‹</button>
              <span className="month-nav-label" onClick={()=>dispatch({type:'SET_VIEW_START',month:DEFAULT_VIEW_START})} title="Jump to today">{viewLabel}</span>
              <button className="nav-btn" onClick={()=>dispatch({type:'SET_VIEW_START',month:addMonths(viewStart,1)})}>›</button>
            </div>
            {viewStart!==DEFAULT_VIEW_START&&(
              <div style={{fontSize:'.68rem',color:'var(--text-3)',fontStyle:'italic',textAlign:'center',cursor:'pointer'}}
                onClick={()=>dispatch({type:'SET_VIEW_START',month:DEFAULT_VIEW_START})}>
                click to snap to today
              </div>
            )}
          </div>
          {/* right cell — Heatmap toggle + Demand/Supply toggle, right-aligned */}
          <div style={{display:'flex',justifyContent:'flex-end',alignItems:'center',gap:'8px'}}>
            {editMode==='demand'&&(
              <div className="mode-toggle">
                <button className={`mode-btn${showHeatmap?' active':''}`} onClick={()=>setShowHeatmap(h=>!h)} title="Toggle demand heatmap">Heatmap</button>
              </div>
            )}
            <div className="mode-toggle">
              <button className={`mode-btn demand${editMode==='demand'?' active':''}`} onClick={()=>setEditMode('demand')} title="Edit demand">Demand</button>
              <button className={`mode-btn${editMode==='supply'?' active':''}`} onClick={()=>setEditMode('supply')} title="Edit supply">Supply</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Project View page ────────────────────────────────────── */}
      {currentPage==='project'&&storeLoaded&&projects.length>0&&<ViewCtx.Provider value={{editMode,showHeatmap,discHeatmapMax,TODAY}}><div className="grid-wrap">
        <div className="grid">
          {/* Year header row */}
          <div className="year-header-row">
            <div className="year-label-spacer">
              <span className="col-hdr-title">Project / Discipline</span>
            </div>
            {yearGroups.map((g,i)=>(
              <div key={g.year} className="year-cell-hdr"
                style={{flex:g.count,minWidth:`calc(var(--cell-w) * ${g.count})`}}>
                {g.year}
              </div>
            ))}
          </div>
          {/* Month header row */}
          <div className="month-header-row">
            <div className="row-label-hdr">
              <div style={{display:'flex',flexDirection:'column',gap:'4px',alignSelf:'stretch'}}>
              {/* ── Discipline visibility bar ── */}
              <div style={{display:'flex',alignItems:'center',gap:'5px'}}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{color:'var(--text-3)',flexShrink:0,opacity:.65}}>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <div className="tier-btns" style={{flex:1}}>
                  {discGroupOrder.flatMap(g=>discGroupMap[g]||[]).filter(sg=>leafName(sg)!=='Stretch').map(sg=>{
                    const sgDiscs=discSubgroupMap[sg]||[];
                    const allOn=sgDiscs.length>0&&sgDiscs.every(d=>disciplineFilter.has(d));
                    const pIdx=sgPaletteIdx[sg]??-1;
                    const onStyle=pIdx>=0?{background:DEPT_PALETTE[pIdx].bold,color:'#fff'}:{background:'var(--primary)',color:'#fff'};
                    return(
                      <button key={sg} className="tier-btn"
                        style={{...(allOn?onStyle:{}),flex:1}}
                        title={`${allOn?'Hide':'Show'} ${leafName(sg)}`}
                        onClick={()=>toggleSubgroupFilter(sg,sgDiscs)}>
                        {leafName(sg)}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* ── Expand level buttons ── */}
              <div style={{display:'flex',alignItems:'center',gap:'5px'}}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{color:'var(--text-3)',flexShrink:0,opacity:.65}}>
                  <polyline points="6 4 12 10 18 4"/>
                  <polyline points="6 14 12 20 18 14"/>
                </svg>
                {(()=>{
                  /* Map logical tiers to physical expand sets.
                     hasMultipleGroups=true:  Proj→t1, Dept→t2, Disc→t3, Subdisc→t4, All→t5
                     hasMultipleGroups=false: Proj→t1, Dept→t3, Disc→t4, Subdisc→t5, All→t5 */
                  const projActive=allExpanded&&!(hasMultipleGroups?tier2Active:tier3Active);
                  const deptActive=hasMultipleGroups?(tier2Active&&!tier3Active):(tier3Active&&!tier4Active);
                  const discActive=hasMultipleGroups?(tier3Active&&!tier4Active):(tier4Active&&!tier5Active);
                  const subdiscActive=hasMultipleGroups?(tier4Active&&!tier5Active):tier5Active;
                  const onDept=deptActive
                    ?(hasMultipleGroups?handleCollapseTier2:handleCollapseTier3)
                    :(hasMultipleGroups?handleExpandTier2:handleExpandTier3);
                  const onDisc=discActive
                    ?(hasMultipleGroups?handleCollapseTier3:handleCollapseTier4)
                    :(hasMultipleGroups?handleExpandTier3:handleExpandTier4);
                  const onSubdisc=subdiscActive
                    ?(hasMultipleGroups?handleCollapseTier4:handleCollapseTier5)
                    :(hasMultipleGroups?handleExpandTier4:handleExpandTier5);
                  return(
                    <div className="tier-btns" style={{flex:1}}>
                      <button className={`tier-btn${projActive?' t-on':''}`} style={{flex:1}}
                        title="Expand project rows" onClick={projActive?handleCollapseAll:handleExpandAll}>Proj</button>
                      <button className={`tier-btn${deptActive?' t-on':''}`} style={{flex:1}}
                        title="Expand department rows" onClick={onDept}>Dept</button>
                      <button className={`tier-btn${discActive?' t-on':''}`} style={{flex:1}}
                        title="Expand discipline rows" onClick={onDisc}>Disc</button>
                      <button className={`tier-btn${subdiscActive?' t-on':''}`} style={{flex:1}}
                        title="Expand subdiscipline rows" onClick={onSubdisc}>Subdisc</button>
                      <button className={`tier-btn${tier5Active?' t-on':''}`} style={{flex:1}}
                        title="Expand all rows to team level" onClick={tier5Active?handleCollapseTier5:handleExpandTier5}>All</button>
                    </div>
                  );
                })()}
                <button title="Set tier sort order" onClick={()=>setTierOrderOpen(true)}
                  style={{background:'none',border:'1px solid var(--border)',borderRadius:'5px',padding:'2px 6px',cursor:'pointer',fontSize:'.72rem',color:'var(--text-3)',flexShrink:0,lineHeight:1.4}}>⇅</button>
              </div>
              </div>{/* end column flex */}
            </div>
            {months.map(m=>(
              <div key={m} className={`month-cell-hdr ${m===TODAY?'is-current':m<TODAY?'is-past':''}`}>
                {fmtMonthShort(m)}
              </div>
            ))}
          </div>

          {/* ── Global demand summary row (demand mode only) ──── */}
          {editMode==='demand'&&(()=>{
            const allCollapsed=expandedProjects.size===0;
            return(
              <div className="global-demand-row">
                <div className="global-demand-label">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 3h18v18H3z"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18" strokeWidth="1.5"/></svg>
                  Total
                </div>
                {months.map(m=>{
                  const total=roundHalf(projects.reduce((sum,p)=>sum+activeDiscs.reduce((s,d)=>s+getDemand(p,d,m,activeMeta),0),0));
                  return(
                    <div key={m} className={`global-demand-cell${m===TODAY?' is-current':''}`}
                      style={{color:'var(--text-2)'}}>
                      {total>0?(total%1===0?total.toFixed(0):total.toFixed(1)):''}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Project rows */}
          {projects.map((project,projIdx)=>{
            const isLastProject=projIdx===projects.length-1;
            const expanded=expandedProjects.has(project.id);
            const anyExpanded=expandedProjects.size>0;
            // Active discipline-level demand keys; discs covered by those keys
            const activeDemandKeys=new Set(Object.keys(project.demand).filter(k=>project.demand[k]>0||Object.keys(project.monthlyDemand?.[k]||{}).length>0));
            const activeDemandDiscs=activeDiscs.filter(d=>activeDemandKeys.has(discDemandKey(d)));
            /* Show all departments regardless of demand — only the visibility filter applies */
            const visibleDiscs=activeDiscs.filter(d=>disciplineFilter.has(d));
            const isDragging=draggedProjId===project.id;
            const isDragOver=dragOverProjId===project.id&&draggedProjId!==project.id;

            // overall health per month — sum demand across all visible leaf discs
            const getMonthHealth=(m)=>{
              if(m<project.startMonth||m>project.endMonth)return null;
              const totalDemand=roundHalf(visibleDiscs.reduce((s,d)=>s+getDemand(project,d,m,activeMeta),0));
              if(totalDemand===0)return null;
              const totalSupply=roundHalf(visibleDiscs.reduce((s,d)=>s+getSupply(assignments,engineers,project.id,d,m),0));
              return{ratio:totalSupply/totalDemand,supply:totalSupply,demand:totalDemand};
            };

            return(
              <div className={`project-group${anyExpanded&&!expanded?' is-dimmed':''}${isLastProject?' is-last-group':''}`} key={project.id}
                style={expanded?{borderBottom:`3px solid ${project.color}`,borderRight:`3px solid ${project.color}`}:{}}>
                {/* Project header — entire row is clickable + draggable */}
                <div
                  className={[
                    'project-hdr-row',
                    projIdx%2!==0?'row-alt':'',
                    expanded?'is-expanded':'',
                    isDragging?'is-dragging':'',
                    isDragOver&&!dragOverAfter?'drag-over-top':'',
                    isDragOver&&dragOverAfter?'drag-over-bot':'',
                  ].filter(Boolean).join(' ')}
                  onClick={()=>setExpandedProjects(s=>{const n=new Set(s);n.has(project.id)?n.delete(project.id):n.add(project.id);return n;})}
                  draggable
                  onDragStart={e=>handleProjDragStart(e,project.id)}
                  onDragOver={e=>handleProjDragOver(e,project.id)}
                  onDrop={e=>handleProjDrop(e,project.id)}
                  onDragEnd={handleProjDragEnd}
                  style={{cursor:'pointer',...(expanded?{borderTop:`3px solid ${project.color}`}:{})}}
                >
                  <div className="project-hdr-label" style={{borderLeft:`4px solid ${project.color}`}}>
                    <span className="drag-handle-proj" title="Drag to reorder" onClick={e=>e.stopPropagation()}>⠿</span>
                    <div className={`expand-btn${expanded?' is-open':''}`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                    <span className="project-hdr-name">{project.name}</span>
                    <button className="gear-btn" onClick={e=>{e.stopPropagation();setSettingsProject(project)}} title="Project settings">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                      </svg>
                    </button>
                  </div>

                  {/* Project span cells — always show overall health bar */}
                  {months.map(m=>{
                    const active=m>=project.startMonth&&m<=project.endMonth;
                    const health=getMonthHealth(m);
                    const barColor=active&&health!==null?ratioToBarColor(health.ratio):null;
                    const fillPct=health!==null?Math.min(health.ratio,1)*100:0;
                    const healthTxt=health===null?'':
                      health.ratio>=1.05?'#15803D':health.ratio>=1?'#1D4ED8':health.ratio>=.7?'#92400E':'#B91C1C';
                    const isCur=m===TODAY;
                    const gapLabel=health===null?'':
                      health.supply<health.demand
                        ?`−${(health.demand-health.supply).toFixed(1)}`
                        :health.supply>health.demand*1.05
                          ?`+${(health.supply-health.demand).toFixed(1)}`
                          :'✓';
                    // Heatmap for collapsed rows in demand mode (only when showHeatmap is on)
                    const totalDem=active&&editMode==='demand'?roundHalf(visibleDiscs.reduce((s,d)=>s+getDemand(project,d,m,activeMeta),0)):0;
                    const noneExpanded=expandedProjects.size===0;
                    const heatIntensity=showHeatmap&&noneExpanded&&editMode==='demand'&&projHeatmapMax>0?Math.min(totalDem/projHeatmapMax,1):0;
                    const heatAlpha=heatIntensity;
                    const heatBg=showHeatmap&&noneExpanded&&editMode==='demand'&&totalDem>0?`rgba(239,68,68,${heatAlpha.toFixed(2)})`:'';
                    const heatText=heatIntensity>0.55?'#fff':'var(--text-2)';
                    return(
                      <div key={m}
                        className={`project-span-cell${isCur?' is-current':m<TODAY?' is-past':''}`}
                        style={{
                          ...(heatBg?{'--cell-cur-bg':heatBg,'--cell-cur-bg-alt':heatBg,background:heatBg}:{}),
                          transition:'background .2s,opacity .15s,filter .15s'
                        }}
                      >
                        {active&&editMode==='demand'&&totalDem>0&&(
                          <span className="span-health-label" style={{zIndex:1,color:heatBg?heatText:'var(--text-2)',fontWeight:700,fontSize:'.8rem'}}>
                            {totalDem%1===0?totalDem.toFixed(0):totalDem.toFixed(1)}
                          </span>
                        )}
                        {active&&editMode==='supply'&&health!==null&&(
                          <span className="span-health-label" style={{zIndex:1,color:healthTxt}}>{gapLabel}</span>
                        )}
                        {active&&editMode==='supply'&&health!==null&&(
                          <div className="cell-bar-track" style={{position:'absolute',bottom:'3px',left:'8px',right:'8px',height:'7px',background:'rgba(0,0,0,0.09)',borderRadius:'3px',overflow:'hidden'}}>
                            {barColor&&<div className="cell-bar-fill" style={{position:'absolute',top:0,bottom:0,left:0,width:`${fillPct}%`,background:barColor,opacity:0.8,borderRadius:'3px'}}/>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Discipline swimlanes — extracted to ProjectRows component */}
                {expanded&&<ProjectRows
                  project={project} projIdx={projIdx}
                  months={months} assignments={assignments} engineers={engineers}
                  activeMeta={activeMeta} visibleDiscs={visibleDiscs}
                  discGroupOrder={discGroupOrder} discGroupMap={discGroupMap}
                  discSubgroupMap={discSubgroupMap} discSsgMap={discSsgMap}
                  discSubsubgroupMap={discSubsubgroupMap} discSgLeaves={discSgLeaves}
                  expandedProjSubgroups={expandedProjSubgroups}
                  expandedProjSubsubgroups={expandedProjSubsubgroups}
                  expandedProjSssgs={expandedProjSssgs}
                  toggleProjSubgroup={toggleProjSubgroup}
                  toggleProjSubsubgroup={toggleProjSubsubgroup}
                  toggleProjSssg={toggleProjSssg}
                  handleDemandCellClick={handleDemandCellClick}
                  handleCellClick={handleCellClick}
                  handleHover={handleHover} handleLeave={handleLeave}
                  discDemandKey={discDemandKey} discPaletteColor={discPaletteColor}
                  sortByOrder={sortByOrder} tierOrder={state.tierOrder}
                />}
              </div>
            );
          })}

          {/* Bottom padding */}
          <div style={{height:'40px'}}/>
        </div>

      </div></ViewCtx.Provider>}{/* ── end grid-wrap / project page ── */}

      {/* ── Discipline View page ─────────────────────────────────── */}
      {currentPage==='discipline'&&storeLoaded&&(engineers.length>0||projects.length>0)&&<div className="analytics-wrap" style={rosterTarget?{flexDirection:'row'}:{}}>
        <div className="analytics-scroll">
        <div className="disc-page-hdr">
          <span className="disc-page-hdr-notes"><strong>X.X / X.X FTE</strong> = supply / demand this month &nbsp;·&nbsp; <strong>Bar</strong> = % of demand covered &nbsp;·&nbsp; <strong>GAP</strong> = demand − supply &nbsp;<span style={{color:'#B91C1C'}}>−deficit</span> / <span style={{color:'#15803D'}}>+surplus</span></span>
          {peopleView==='list'&&(
            <div style={{marginLeft:'auto',marginRight:'8px',display:'flex',alignItems:'center',gap:'6px'}}>
              <span style={{fontSize:'.7rem',color:'var(--text-3)',whiteSpace:'nowrap'}}>Show:</span>
              <div className="tier-btns">
                <button className={`tier-btn${peopleTierBUActive?' t-on':''}`} onClick={handlePeopleTierBU} title="Show Business Units only">Business Units</button>
                <button className={`tier-btn${peopleTierDeptActive?' t-on':''}`} onClick={handlePeopleTierDept} title="Show Departments">Departments</button>
                <button className={`tier-btn${peopleTierDiscActive?' t-on':''}`} onClick={handlePeopleTierDisc} title="Show Disciplines">Disciplines</button>
                <button className={`tier-btn${peopleTierSubdiscActive?' t-on':''}`} onClick={handlePeopleTierSubdisc} title="Show Subdisciplines">Subdisciplines</button>
                <button className={`tier-btn${peopleTierAllActive?' t-on':''}`} onClick={handlePeopleTierAll} title="Expand all levels">All</button>
              </div>
            </div>
          )}
          {peopleView==='lr'&&(
            <div style={{marginLeft:'auto',marginRight:'8px',display:'flex',alignItems:'center',gap:'6px'}}>
              <span style={{fontSize:'.7rem',color:'var(--text-3)',whiteSpace:'nowrap'}}>Show:</span>
              <div className="tier-btns">
                <button className={`tier-btn${orgTierBUActive?' t-on':''}`} onClick={handleOrgTierBU} title="Show Business Units only">Business Units</button>
                <button className={`tier-btn${orgTierDeptActive?' t-on':''}`} onClick={handleOrgTierDept} title="Show Departments">Departments</button>
                <button className={`tier-btn${orgTierDiscActive?' t-on':''}`} onClick={handleOrgTierDisc} title="Show Disciplines">Disciplines</button>
                <button className={`tier-btn${orgTierSubdiscActive?' t-on':''}`} onClick={handleOrgTierSubdisc} title="Show Subdisciplines">Subdisciplines</button>
                <button className={`tier-btn${orgTierAllActive?' t-on':''}`} onClick={handleOrgTierAll} title="Expand all levels">All</button>
              </div>
            </div>
          )}
          <div style={{position:'relative',display:'flex',alignItems:'center',marginRight:'8px'}}>
            <svg style={{position:'absolute',left:'8px',pointerEvents:'none',color:peopleSearch?'#3B82F6':'var(--text-3)',flexShrink:0}} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input type="text" value={peopleSearch} onChange={e=>setPeopleSearch(e.target.value)}
              placeholder="Search people…"
              style={{fontSize:'.8rem',padding:'5px 8px 5px 27px',borderRadius:'6px',
                border:`1.5px solid ${peopleSearch?'#3B82F6':'var(--border)'}`,
                background:peopleSearch?'#EFF6FF':'var(--bg)',
                color:'var(--text-1)',width:'168px',outline:'none',transition:'border-color .15s,background .15s'}}/>
            {peopleSearch&&<button onClick={()=>setPeopleSearch('')}
              style={{position:'absolute',right:'6px',background:'none',border:'none',cursor:'pointer',fontSize:'.8rem',color:'var(--text-3)',lineHeight:1,padding:'1px',display:'flex',alignItems:'center'}}>✕</button>}
          </div>
          <div className="tier-btns" style={{marginRight:'8px'}}>
            <button className={`tier-btn${peopleView==='lr'?' t-on':''}`} onClick={()=>setPeopleView('lr')} title="Org chart">⊞ Chart</button>
            <button className={`tier-btn${peopleView==='list'?' t-on':''}`} onClick={()=>setPeopleView('list')} title="List view">≡ List</button>
          </div>
          <button className="section-hdr-action" onClick={()=>setAnalyticsModalOpen(true)}>By month →</button>
        </div>
        {(()=>{
            /* Helper to get all node IDs in people org chart */
            function getAllPeopleOrgIds(nodes){const ids=[];nodes.forEach(n=>{ids.push(n.id);if(n.children.length)getAllPeopleOrgIds(n.children).forEach(id=>ids.push(id));});return ids;}
            /* ── Org chart view ── */
            if(peopleView!=='list'){
              const{NW,NH,HG,pos,lines,W,H,maxD}=peopleOrgLayout;
              const canDrag=userPerms.isAdmin;
              /* Dept color map for people org chart */
              const peopDeptColorMap={};
              (()=>{
                let di=0;
                const fill=(n,pi)=>{const mi=n.depth===1?di++%DEPT_PALETTE.length:pi;peopDeptColorMap[n.id]=mi;n.children.forEach(c=>fill(c,mi));};
                simplifiedOrgRoots.forEach(r=>fill(r,-1));
              })();
              function renderPeopleOrgNodes(nodes,parentName=''){
                return nodes.flatMap(node=>{
                  const np=pos[node.id];if(!np)return[];
                  const isCollapsed=peopleCollapsed.has(node.id);
                  const hasChildren=node.children.length>0;
                  const isSrc=peopleDragging?.id===node.id;
                  const isTgt=peopleChartDrop?.id===node.id;
                  const headcount=node.allDiscs.reduce((s,d)=>s+(engineers.filter(e=>e.discipline===d&&!e.inactive).length),0);
                  const psq=peopleSearch.toLowerCase().trim();
                  const matchCount=psq?node.allDiscs.reduce((s,d)=>s+(engineers.filter(e=>e.discipline===d&&!e.inactive&&e.name.toLowerCase().includes(psq)).length),0):0;
                  const directOrphanMatch=psq&&(node.discs||[]).some(d=>{
                    const hasChildNode=node.children.some(c=>c.type==='disc'&&c.disc===d);
                    return !hasChildNode&&engineers.some(e=>e.discipline===d&&!e.inactive&&e.name.toLowerCase().includes(psq));
                  });
                  const isMatch=psq&&matchCount>0&&(node.type==='disc'||isCollapsed||directOrphanMatch);
                  const isAncestorMatch=psq&&matchCount>0&&!isMatch;
                  const isDimmed=psq&&matchCount===0;
                  const deptIdx=peopDeptColorMap[node.id]??-1;
                  let bg,bd,textColor,subTextColor;
                  if(node.depth===0){bg='#F1F5F9';bd=isTgt?'#3B82F6':'#CBD5E1';textColor='#1E293B';subTextColor='#475569';}
                  else if(deptIdx<0){bg='#F3F4F6';bd=isTgt?'#3B82F6':'#D1D5DB';textColor='#374151';subTextColor='#6B7280';}
                  else{
                    const p=DEPT_PALETTE[deptIdx%DEPT_PALETTE.length];
                    const tb=tierBlend(p,node.depth);
                    bg=tb.bg;bd=isTgt?'#3B82F6':tb.bd;textColor=tb.textColor;subTextColor=tb.subTextColor;
                  }
                  const isRosterOpen=rosterTarget&&(rosterTarget.nodeId===node.id||(rosterTarget.discs&&node.discs.some(d=>rosterTarget.discs.includes(d))));
                  const displayName=stripParentPrefix(node.name,parentName);
                  return[
                    <div key={node.id}
                      draggable={canDrag}
                      onDragStart={e=>{if(!canDrag)return;setPeopleDragging({id:node.id,type:node.type,discs:node.allDiscs,depth:node.depth,sg:node.sg});e.dataTransfer.effectAllowed='move';}}
                      onDragOver={e=>{e.preventDefault();e.stopPropagation();if(peopleDragging&&peopleDragging.id!==node.id)setPeopleChartDrop({id:node.id});}}
                      onDrop={e=>{
                        e.preventDefault();
                        if(peopleDragging&&peopleDragging.id!==node.id&&canDrag){
                          const tp=node.tierPath||{};
                          if(peopleDragging.type!=='disc'){
                            // Structural reparent — preserves internal hierarchy
                            dispatch({type:'REPARENT_DISC',discs:peopleDragging.discs,
                              nDepth:peopleDragging.depth,nKey:peopleDragging.sg,
                              tDepth:node.depth,tPath:tp});
                          }else{
                            // Flat reparent for leaf disc nodes
                            dispatch({type:'REPARENT_DISC',discs:peopleDragging.discs,
                              newBU:tp.bu,newDept:tp.dept??null,
                              newDiscipline:tp.discipline||null,newSubdisc:tp.subdisc||null});
                          }
                        }
                        setPeopleDragging(null);setPeopleChartDrop(null);
                      }}
                      onDragEnd={()=>{setPeopleDragging(null);setPeopleChartDrop(null);}}
                      onClick={e=>{
                        e.stopPropagation();
                        if(hasChildren){
                          const subteams=node.children.map(c=>({
                            name:c.name,display:stripParentPrefix(c.name,node.name),
                            headcount:c.allDiscs.reduce((s,d)=>s+(engineers.filter(e=>e.discipline===d&&!e.inactive).length),0),
                            color:c.color,deptIdx:peopDeptColorMap[c.id]??-1,depth:c.depth,nodeRef:c,
                          }));
                          setRosterTarget({nodeId:node.id,label:node.name,color:node.color,
                            subteams,directDiscs:node.discs||[],totalHeadcount:headcount});
                        }else{
                          setRosterTarget({label:node.name,discs:node.allDiscs,color:node.color});
                        }
                      }}
                      style={{position:'absolute',left:np.x,top:np.y,width:NW,height:NH,
                        background:bg,border:isMatch?'2.5px solid #2563EB':`${isTgt?2:1}px solid ${isRosterOpen?node.color:bd}`,borderRadius:'8px',
                        padding:'4px 8px',boxSizing:'border-box',
                        display:'flex',flexDirection:'column',justifyContent:'center',
                        cursor:canDrag?'grab':'pointer',opacity:isSrc?.25:isDimmed?.28:isAncestorMatch?.5:1,
                        boxShadow:isMatch?'0 0 0 4px #93C5FDB0,0 4px 14px rgba(37,99,235,.45)':isTgt?'0 0 0 3px #3B82F640,0 2px 6px rgba(0,0,0,.1)':isRosterOpen?`0 0 0 2px ${node.color}40`:'0 1px 3px rgba(0,0,0,.08)',
                        userSelect:'none',zIndex:isMatch?3:2,transition:'box-shadow .15s,opacity .15s'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'3px',minWidth:0}}>
                        {hasChildren&&(
                          <span onClick={e=>{e.stopPropagation();setPeopleCollapsed(s=>{const n=new Set(s);n.has(node.id)?n.delete(node.id):n.add(node.id);return n;});}}
                            draggable={false}
                            style={{fontSize:'.58rem',lineHeight:1,cursor:'pointer',color:node.depth===1?'rgba(255,255,255,.8)':'#475569',flexShrink:0,width:'12px',textAlign:'center',userSelect:'none'}}>
                            {isCollapsed?'▶':'▼'}
                          </span>
                        )}
                        <div style={{fontSize:'.74rem',fontWeight:node.depth===0?700:600,color:textColor,
                          whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',lineHeight:1.3,flex:1,minWidth:0}}>
                          {displayName}
                        </div>
                      </div>
                      <div style={{fontSize:'.65rem',color:subTextColor,marginTop:'3px',display:'flex',alignItems:'center',gap:'3px',minWidth:0}}>
                        <span style={{flex:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                          {headcount} {headcount===1?'person':'people'}{node.type!=='disc'?` · ${node.allDiscs.length} ${node.allDiscs.length===1?'team':'teams'}`:''}
                        </span>
                        {isMatch&&<span style={{background:'#3B82F6',color:'#fff',borderRadius:'999px',padding:'0 4px',fontSize:'.6rem',fontWeight:700,flexShrink:0}}>{matchCount}</span>}
                        {canDrag&&<span style={{opacity:.5,fontSize:'.6rem',flexShrink:0}}>⠿</span>}
                      </div>
                    </div>,
                    ...(!isCollapsed?renderPeopleOrgNodes(node.children,node.name):[]),
                  ];
                });
              }
              const TIER_NAMES=['Business Unit','Department','Discipline','Subdiscipline','Team'];
              const tierCols=Array.from({length:maxD+1},(_,i)=>i);
              return(
                <div style={{flex:1,overflowY:'auto',overflowX:'auto',padding:'12px 12px 12px 12px'}}>
                  {canDrag&&<div style={{fontSize:'.73rem',color:'var(--text-3)',marginBottom:'4px'}}>Drag nodes to reparent (admin only)</div>}
                  {/* Tier column headers */}
                  <div style={{display:'flex',marginBottom:'8px',width:W,minWidth:'100%',position:'relative'}}>
                    {tierCols.map(d=>(
                      <div key={d} style={{width:NW,marginRight:d<maxD?HG:0,flexShrink:0,
                        textAlign:'center',fontSize:'.68rem',fontWeight:600,letterSpacing:'.04em',
                        color:'#1E293B',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                        {TIER_NAMES[d]||`Level ${d}`}
                      </div>
                    ))}
                  </div>
                  <div style={{position:'relative',width:W,height:H,minWidth:'100%'}}>
                    <svg style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',pointerEvents:'none'}}>
                      {/* Vertical column separators */}
                      {tierCols.slice(0,-1).map(d=>{
                        const sepX=d*(NW+HG)+NW+HG/2;
                        return<line key={`sep${d}`} x1={sepX} y1={0} x2={sepX} y2={H} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 3"/>;
                      })}
                      {lines.map(l=><path key={l.id} d={l.d} fill="none" stroke="var(--border)" strokeWidth="1.5" strokeLinecap="round"/>)}
                    </svg>
                    {renderPeopleOrgNodes(simplifiedOrgRoots)}
                  </div>
                </div>
              );
            }
            const today=TODAY;
            const totalDemand=roundHalf(activeDiscs.reduce((sum,disc)=>sum+projects.reduce((s2,p)=>s2+getDemand(p,disc,today,activeMeta),0),0));
            const totalSupply=roundHalf(activeDiscs.reduce((sum,disc)=>sum+getOrgSupply(assignments,engineers,disc,today),0));
            const netGap=roundHalf(totalDemand-totalSupply);
            const netGapColor=netGap>0.05?'#B91C1C':netGap<-0.05?'#15803D':'#1D4ED8';
            const netGapText=netGap>0.05?`−${netGap.toFixed(1)}`:netGap<-0.05?`+${Math.abs(netGap).toFixed(1)}`:'✓';

            const discData=activeDiscs.map(disc=>{
              const meta=activeMeta[disc];
              const headcount=engineers.filter(e=>e.discipline===disc&&!e.inactive).length;
              const curSupply=getOrgSupply(assignments,engineers,disc,today);
              const curDemand=roundHalf(projects.reduce((s,p)=>s+getDemand(p,disc,today,activeMeta),0));
              const ratio=curDemand>0?curSupply/curDemand:0;
              const fillPct=Math.min(ratio,1)*100;
              const barColor=curDemand>0?ratioToBarColor(ratio):'var(--border)';
              const fteColor=curDemand>0?(ratio>=1.05?'#15803D':ratio>=1?'#1D4ED8':ratio>=.7?'#92400E':'#B91C1C'):'var(--text-3)';
              return{disc,meta,headcount,curSupply,curDemand,fillPct,barColor,fteColor};
            });

            const overallRatio=totalDemand>0?totalSupply/totalDemand:0;
            const overallFillPct=Math.min(overallRatio,1)*100;
            const overallBarColor=totalDemand>0?ratioToBarColor(overallRatio):'var(--border)';
            const overallFteColor=totalDemand>0?(overallRatio>=1.05?'#15803D':overallRatio>=1?'#1D4ED8':overallRatio>=.7?'#92400E':'#B91C1C'):'var(--text-3)';
            return(
              <>
                <div className="disc-table">
                  {/* Column headers */}
                  <div className="disc-col-hdr">
                    <span style={{flex:1,minWidth:0}}/>
                    <span className="disc-col-hdr-cell" style={{width:'46px',minWidth:'46px',textAlign:'right'}}>HC</span>
                    <span className="disc-col-hdr-cell" style={{width:'120px',minWidth:'80px',maxWidth:'160px',margin:'0 10px',textAlign:'center'}}>coverage</span>
                    <span className="disc-col-hdr-cell" style={{width:'128px',minWidth:'128px',textAlign:'right'}}>supply / demand</span>
                    <span className="disc-col-hdr-cell" style={{width:'52px',minWidth:'52px',textAlign:'right'}}>gap</span>
                  </div>

                  {/* Overall row */}
                  <div className="disc-trow is-overall">
                    <span className="disc-trow-dot" style={{width:'10px',height:'10px',background:'#64748B',flexShrink:0}}/>
                    <span className="disc-trow-name">Overall</span>
                    <span className="disc-trow-count">{engineers.length} eng</span>
                    <div className="disc-trow-bar">
                      <div className="disc-trow-bar-fill" style={{width:`${overallFillPct}%`,background:overallBarColor}}/>
                    </div>
                    <span className="disc-trow-fte" style={{color:overallFteColor}}>{totalSupply.toFixed(1)} / {totalDemand.toFixed(1)} FTE</span>
                    <span className="disc-trow-gap" style={{color:netGapColor,fontSize:'.88rem'}}>{netGapText}</span>
                  </div>

                  {/* Per-group rows — recursive, all tiers from peopleOrgRoots */}
                  {(()=>{
                    /* Dept color map matching org chart — depth=1 nodes get sequential palette index */
                    const listDeptColorMap={};
                    (()=>{let di=0;const fill=(n,pi)=>{const mi=n.depth===1?di++%DEPT_PALETTE.length:pi;listDeptColorMap[n.id]=mi;n.children.forEach(c=>fill(c,mi));};peopleOrgRoots.forEach(r=>fill(r,-1));})();
                    function getRowBg(node,deptIdx){
                      if(deptIdx<0||node.depth===0)return'#F1F5F9';
                      const p=DEPT_PALETTE[deptIdx%DEPT_PALETTE.length];
                      return blendHex(p.bold,p.light,Math.min(1,(node.depth-1)/3));
                    }
                    function getNameColor(node,deptIdx){
                      if(deptIdx<0||node.depth===0)return'#0F172A';
                      const t=Math.min(1,(node.depth-1)/3);
                      return t<0.5?'#FFFFFF':DEPT_PALETTE[deptIdx%DEPT_PALETTE.length].textLight;
                    }
                    /* Map dark text colors → light equivalents for dark-background rows */
                    const lightColorMap={'#15803D':'#86EFAC','#1D4ED8':'#93C5FD','#92400E':'#FCD34D','#B91C1C':'#FCA5A5'};
                    function onDarkColor(c){return lightColorMap[c]||'rgba(255,255,255,.8)';}
                    function renderListNode(node){
                      const psq=peopleSearch.toLowerCase().trim();
                      if(psq){
                        const hasMatch=node.type==='disc'
                          ?engineers.some(e=>e.discipline===node.disc&&!e.inactive&&e.name.toLowerCase().includes(psq))
                          :node.allDiscs.some(d=>engineers.some(e=>e.discipline===d&&!e.inactive&&e.name.toLowerCase().includes(psq)));
                        if(!hasMatch)return null;
                      }
                      const deptIdx=listDeptColorMap[node.id]??-1;
                      const rowBg=getRowBg(node,deptIdx);
                      const nameColor=getNameColor(node,deptIdx);
                      const t=deptIdx<0||node.depth===0?1:Math.min(1,(node.depth-1)/3);
                      const onDark=t<0.5;
                      const subTextColor=onDark?'rgba(255,255,255,.85)':'var(--text-3)';
                      const barTrackStyle=onDark?{background:'rgba(255,255,255,.25)'}:undefined;
                      const readableColor=c=>onDark?lightColorMap[c]||'rgba(255,255,255,.9)':c;
                      if(node.type==='disc'){
                        const dd=discData.find(x=>x.disc===node.disc);
                        if(!dd)return null;
                        const{meta,headcount,curSupply,curDemand,fillPct,barColor,fteColor}=dd;
                        const discGap=roundHalf(curDemand-curSupply);
                        const discGapColor=discGap>0.05?'#B91C1C':discGap<-0.05?'#15803D':'#1D4ED8';
                        const discGapText=discGap>0.05?`−${discGap.toFixed(1)}`:discGap<-0.05?`+${Math.abs(discGap).toFixed(1)}`:'✓';
                        return(
                          <div key={node.id} className="disc-trow is-clickable"
                            style={{paddingLeft:`${8+node.depth*20}px`,background:rowBg}}
                            title={node.disc}
                            onClick={()=>setRosterTarget({label:node.name,discs:[node.disc],color:meta.color})}>
                            <span className="disc-trow-name sub" style={{color:nameColor}}>{node.name}</span>
                            <span className="disc-trow-count" style={{color:subTextColor}}>{headcount} eng</span>
                            <div className="disc-trow-bar" style={barTrackStyle}>
                              <div className="disc-trow-bar-fill" style={{width:`${fillPct}%`,background:barColor}}/>
                            </div>
                            <span className="disc-trow-fte" style={{color:readableColor(fteColor)}}>{curSupply.toFixed(1)} / {curDemand.toFixed(1)} FTE</span>
                            <span className="disc-trow-gap" style={{color:readableColor(discGapColor)}}>{discGapText}</span>
                          </div>
                        );
                      }
                      /* Group / Subgroup node */
                      const nodeData=discData.filter(({disc})=>node.allDiscs.includes(disc));
                      if(!nodeData.length)return null;
                      const nSupply=roundHalf(nodeData.reduce((s,{curSupply})=>s+curSupply,0));
                      const nDemand=roundHalf(nodeData.reduce((s,{curDemand})=>s+curDemand,0));
                      const nHC=nodeData.reduce((s,{headcount})=>s+headcount,0);
                      const nRatio=nDemand>0?nSupply/nDemand:0;
                      const nFillPct=Math.min(nRatio,1)*100;
                      const nBarColor=nDemand>0?ratioToBarColor(nRatio):'var(--border)';
                      const nGap=roundHalf(nDemand-nSupply);
                      const nGapColor=nGap>0.05?'#B91C1C':nGap<-0.05?'#15803D':'#1D4ED8';
                      const nGapText=nGap>0.05?`−${nGap.toFixed(1)}`:nGap<-0.05?`+${Math.abs(nGap).toFixed(1)}`:'✓';
                      const nFteColor=nDemand>0?(nRatio>=1.05?'#15803D':nRatio>=1?'#1D4ED8':nRatio>=.7?'#92400E':'#B91C1C'):'var(--text-3)';
                      const isCollapsed=collapsedGroups.has(node.id);
                      const isGroup=node.depth===0;
                      const toggleCollapse=e=>{e.stopPropagation();setCollapsedGroups(prev=>{const s=new Set(prev);s.has(node.id)?s.delete(node.id):s.add(node.id);return s;});};
                      const rows=[
                        <div key={node.id} className={`disc-trow ${isGroup?'is-group':'is-subgroup'} is-clickable`}
                          style={{paddingLeft:`${8+node.depth*20}px`,background:rowBg}}
                          onClick={()=>{
                            if(node.children.length>0){
                              const subteams=node.children.map(c=>({
                                name:c.name,display:stripParentPrefix(c.name,node.name),
                                headcount:c.allDiscs.reduce((s,d)=>s+(engineers.filter(e=>e.discipline===d&&!e.inactive).length),0),
                                color:c.color,deptIdx:listDeptColorMap[c.id]??-1,depth:c.depth,nodeRef:c,
                              }));
                              setRosterTarget({nodeId:node.id,label:node.name,color:node.color,
                                subteams,directDiscs:node.discs||[],totalHeadcount:nHC});
                            }else{
                              setRosterTarget({label:node.name,discs:node.allDiscs,color:node.color});
                            }
                          }}>
                          <span onClick={toggleCollapse}
                            style={{width:isGroup?'18px':'16px',minWidth:isGroup?'18px':'16px',
                              height:isGroup?'18px':'16px',display:'flex',alignItems:'center',
                              justifyContent:'center',cursor:'pointer',fontSize:isGroup?'.7rem':'.65rem',
                              fontWeight:700,color:nameColor,flexShrink:0,lineHeight:1,
                              userSelect:'none',marginRight:isGroup?'0':'2px'}}
                            title={isCollapsed?'Expand':'Collapse'}>
                            {isCollapsed?'+':'−'}
                          </span>
                          <span className={`disc-trow-name ${isGroup?'grp':'subgrp'}`} style={{color:nameColor,paddingLeft:isGroup?'2px':undefined}}>{node.name}</span>
                          <span className="disc-trow-count" style={{color:subTextColor}}>{nHC} eng</span>
                          <div className="disc-trow-bar" style={barTrackStyle}>
                            <div className="disc-trow-bar-fill" style={{width:`${nFillPct}%`,background:nBarColor}}/>
                          </div>
                          <span className="disc-trow-fte" style={{color:readableColor(nFteColor)}}>{nSupply.toFixed(1)} / {nDemand.toFixed(1)} FTE</span>
                          <span className="disc-trow-gap" style={{color:readableColor(nGapColor)}}>{nGapText}</span>
                        </div>
                      ];
                      if(!isCollapsed)node.children.forEach(child=>{const r=renderListNode(child);if(r)rows.push(...(Array.isArray(r)?r:[r]));});
                      return rows;
                    }
                    return peopleOrgRoots.flatMap(n=>renderListNode(n)||[]);
                  })()}
                </div>
              </>
            );
          })()}
        </div>{/* end analytics-scroll */}
        {/* ── Inline roster panel — shown at bottom when a group/disc is selected ── */}
        {rosterTarget&&(()=>{
          /* ── Subteam-list mode (parent node clicked) ── */
          if(rosterTarget.subteams){
            const handleSubteamClick=s=>{
              const c=s.nodeRef;
              if(!c)return;
              if(c.children&&c.children.length>0){
                const childSubteams=c.children.map(gc=>({
                  name:gc.name,display:stripParentPrefix(gc.name,c.name),
                  headcount:gc.allDiscs.reduce((sum,d)=>sum+(engineers.filter(e=>e.discipline===d&&!e.inactive).length),0),
                  color:gc.color,deptIdx:s.deptIdx,depth:gc.depth,nodeRef:gc,
                }));
                setRosterTarget({nodeId:c.id,label:c.name,color:c.color,
                  subteams:childSubteams,directDiscs:c.discs||[],
                  totalHeadcount:s.headcount,parentTarget:rosterTarget});
              }else{
                setRosterTarget({label:c.name,discs:c.allDiscs,color:c.color,parentTarget:rosterTarget});
              }
            };
            const today=TODAY;
            const directRows=(rosterTarget.directDiscs||[])
              .flatMap(d=>engineers.filter(e=>e.discipline===d&&!e.inactive))
              .sort((a,b)=>sortEngs(a,b))
              .map(eng=>{
                const active=assignments.filter(a=>a.engineerId===eng.id&&a.startMonth<=today&&a.endMonth>=today);
                const totalAlloc=active.reduce((s,a)=>s+a.allocation,0);
                return{eng,active,totalAlloc};
              });
            const directDiscs=new Set(directRows.map(r=>r.eng.discipline));
            const showDirectSubDisc=directDiscs.size>1;
            const subteamCount=rosterTarget.subteams.length;
            const subteamTotal=rosterTarget.subteams.reduce((s,t)=>s+t.headcount,0);
            return(
              <div style={{flexShrink:0,width:'40%',minWidth:'280px',maxWidth:'560px',
                borderLeft:`3px solid ${rosterTarget.color}`,
                display:'flex',flexDirection:'column',background:'var(--surface)',overflow:'hidden'}}>
                {/* Header */}
                <div style={{display:'flex',alignItems:'center',gap:'8px',padding:'8px 18px',
                  borderBottom:'1px solid var(--border)',flexShrink:0}}>
                  {rosterTarget.parentTarget&&(
                    <button onClick={()=>setRosterTarget(rosterTarget.parentTarget)}
                      style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-3)',
                        fontSize:'.9rem',padding:'0 4px 0 0',lineHeight:1,flexShrink:0}}>←</button>
                  )}
                  <span style={{fontWeight:700,fontSize:'.92rem',color:rosterTarget.color}}>{rosterTarget.label}</span>
                  <span style={{color:'var(--text-3)',fontSize:'.8rem'}}>
                    {[directRows.length>0&&`${directRows.length} direct`,subteamCount>0&&`${subteamCount} ${subteamCount===1?'subteam':'subteams'}`].filter(Boolean).join(' · ')}
                  </span>
                  <button onClick={()=>{if(searchAutoOpened.current){setPeopleSearch('');searchAutoOpened.current=false;}setRosterTarget(null);}}
                    style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',
                      fontSize:'1rem',color:'var(--text-3)',lineHeight:1,padding:'2px 6px'}}>✕</button>
                </div>
                <div style={{overflowY:'auto',flex:1}}>
                  {/* ── Direct reports (same table as leaf-node view) ── */}
                  {directRows.length>0&&(
                    <>
                      {subteamCount>0&&(
                        <div style={{padding:'6px 18px 4px',fontSize:'.7rem',fontWeight:700,color:'var(--text-3)',letterSpacing:'.06em',textTransform:'uppercase',background:'var(--bg)',borderBottom:'1px solid var(--border)'}}>
                          Direct — {directRows.length}
                        </div>
                      )}
                      <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.83rem'}}>
                        <thead style={{position:'sticky',top:0,background:'var(--surface)',zIndex:1}}>
                          <tr style={{borderBottom:'2px solid var(--border)'}}>
                            <th style={{padding:'6px 16px',textAlign:'left',fontWeight:600,color:'var(--text-3)',fontSize:'.74rem',textTransform:'uppercase',letterSpacing:'.04em'}}>Engineer</th>
                            {showDirectSubDisc&&<th style={{padding:'6px 10px',textAlign:'left',fontWeight:600,color:'var(--text-3)',fontSize:'.74rem',textTransform:'uppercase',letterSpacing:'.04em',whiteSpace:'nowrap'}}>Team</th>}
                            <th style={{padding:'6px 16px',textAlign:'left',fontWeight:600,color:'var(--text-3)',fontSize:'.74rem',textTransform:'uppercase',letterSpacing:'.04em'}}>Current Projects</th>
                            <th style={{padding:'6px 12px',textAlign:'center',fontWeight:600,color:'var(--text-3)',fontSize:'.74rem',textTransform:'uppercase',letterSpacing:'.04em',whiteSpace:'nowrap'}}>Alloc</th>
                          </tr>
                        </thead>
                        <tbody>
                          {directRows.map(({eng,active,totalAlloc},i)=>{
                            const discMeta=activeMeta[eng.discipline]||{color:'#6B7280',abbr:eng.discipline.slice(0,2)};
                            const allocColor=getColorForAlloc(totalAlloc);
                            const rowBg=i%2===0?'transparent':'var(--bg)';
                            return(
                              <tr key={eng.id} style={{borderBottom:'1px solid var(--border)',background:rowBg,cursor:'pointer'}}
                                onClick={()=>setRosterModal({label:rosterTarget.label,discs:rosterTarget.directDiscs,color:rosterTarget.color})}
                                onMouseEnter={e=>e.currentTarget.style.background='var(--bg)'}
                                onMouseLeave={e=>e.currentTarget.style.background=rowBg}>
                                <td style={{padding:'6px 16px',verticalAlign:'middle'}}>
                                  <div style={{fontWeight:500,color:'var(--text-1)',display:'flex',alignItems:'center',gap:'4px',flexWrap:'wrap'}}>
                                    {(()=>{const psq2=peopleSearch.trim();if(!psq2||!eng.name.toLowerCase().includes(psq2.toLowerCase()))return<span>{eng.name}</span>;const idx=eng.name.toLowerCase().indexOf(psq2.toLowerCase());return<span>{eng.name.slice(0,idx)}<span style={{background:'#DBEAFE',borderRadius:'3px',padding:'0 2px',fontWeight:700,color:'#1E40AF'}}>{eng.name.slice(idx,idx+psq2.length)}</span>{eng.name.slice(idx+psq2.length)}</span>;})()}<EngBadges eng={eng}/>
                                  </div>
                                  {eng.title&&<div style={{fontSize:'.72rem',color:'var(--text-3)',marginTop:'1px'}}>{eng.title}</div>}
                                </td>
                                {showDirectSubDisc&&(
                                  <td style={{padding:'6px 10px',verticalAlign:'middle'}}>
                                    <span style={{fontSize:'.74rem',fontWeight:700,color:discMeta.color,background:discMeta.bg,border:'1px solid '+(discMeta.border||discMeta.color),padding:'2px 6px',borderRadius:'4px',whiteSpace:'nowrap'}}>{discMeta.abbr}</span>
                                  </td>
                                )}
                                <td style={{padding:'6px 16px',verticalAlign:'middle'}}>
                                  {active.length===0?(
                                    <span style={{color:'var(--text-3)',fontSize:'.79rem',fontStyle:'italic'}}>Unassigned</span>
                                  ):(
                                    <div style={{display:'flex',flexDirection:'column',gap:'3px'}}>
                                      {active.map(a=>{
                                        const proj=projects.find(p=>p.id===a.projectId);
                                        return(
                                          <div key={a.id} style={{display:'flex',alignItems:'center',gap:'6px'}}>
                                            <span style={{width:'8px',height:'8px',borderRadius:'50%',background:proj?.color||'#CBD5E1',flexShrink:0,display:'inline-block'}}/>
                                            <span style={{color:'var(--text-1)',fontSize:'.82rem'}}>{proj?.name||'Unknown'}</span>
                                            {a.allocation!==100&&<span style={{fontSize:'.74rem',color:'var(--text-3)'}}>{a.allocation}%</span>}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </td>
                                <td style={{padding:'6px 12px',textAlign:'center',verticalAlign:'middle'}}>
                                  <span style={{fontWeight:600,color:allocColor,fontSize:'.84rem'}}>{totalAlloc>0?`${totalAlloc}%`:'—'}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </>
                  )}
                  {/* ── Subteams ── */}
                  {subteamCount>0&&(
                    <>
                      {directRows.length>0&&(
                        <div style={{padding:'6px 18px 4px',fontSize:'.7rem',fontWeight:700,color:'var(--text-3)',letterSpacing:'.06em',textTransform:'uppercase',background:'var(--bg)',borderBottom:'1px solid var(--border)'}}>
                          Subteams — {subteamTotal} people
                        </div>
                      )}
                      {rosterTarget.subteams.map(s=>{
                        const pi=s.deptIdx>=0?DEPT_PALETTE[s.deptIdx%DEPT_PALETTE.length]:null;
                        const dotBg=pi?blendHex(pi.bold,pi.light,Math.min(1,(s.depth-1)/3)):'#CBD5E1';
                        const nameColor=pi?pi.textLight:'#475569';
                        const hasKids=s.nodeRef&&s.nodeRef.children&&s.nodeRef.children.length>0;
                        return(
                          <div key={s.name} style={{display:'flex',alignItems:'center',gap:'10px',
                            padding:'7px 18px',borderBottom:'1px solid var(--border)',cursor:'pointer'}}
                            onClick={()=>handleSubteamClick(s)}
                            onMouseEnter={e=>e.currentTarget.style.background='var(--bg)'}
                            onMouseLeave={e=>e.currentTarget.style.background=''}>
                            <div style={{width:'10px',height:'10px',borderRadius:'3px',background:dotBg,flexShrink:0}}/>
                            <span style={{flex:1,fontWeight:500,color:nameColor,fontSize:'.85rem',
                              whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.display}</span>
                            <span style={{color:'var(--text-3)',fontSize:'.78rem',flexShrink:0}}>{s.headcount} {s.headcount===1?'person':'people'}</span>
                            {hasKids&&<span style={{color:'var(--text-3)',fontSize:'.82rem',flexShrink:0,marginLeft:'2px'}}>›</span>}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            );
          }
          /* ── People-list mode (leaf node clicked) ── */
          const members=engineers.filter(e=>rosterTarget.discs.includes(e.discipline)&&!e.inactive);
          const showSubDisc=rosterTarget.discs.length>1;
          const today=TODAY;
          const rows=members.map(eng=>{
            const active=assignments.filter(a=>a.engineerId===eng.id&&a.startMonth<=today&&a.endMonth>=today);
            const totalAlloc=active.reduce((s,a)=>s+a.allocation,0);
            return{eng,active,totalAlloc};
          }).sort((a,b)=>sortEngs(a.eng,b.eng));
          const assigned=rows.filter(r=>r.active.length>0).length;
          const unassigned=rows.length-assigned;
          return(
            <div style={{flexShrink:0,width:'40%',minWidth:'280px',maxWidth:'560px',
              borderLeft:`3px solid ${rosterTarget.color}`,
              display:'flex',flexDirection:'column',background:'var(--surface)',overflow:'hidden'}}>
              {/* Panel header */}
              <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'8px 18px',
                borderBottom:'1px solid var(--border)',flexShrink:0}}>
                <span style={{fontWeight:700,fontSize:'.92rem',color:rosterTarget.color}}>{rosterTarget.label}</span>
                <span style={{color:'var(--text-3)',fontSize:'.8rem'}}>
                  {members.length} engineers
                  {assigned>0&&<> · <span style={{color:'#15803D'}}>{assigned} assigned</span></>}
                  {unassigned>0&&<> · <span style={{color:'#D97706'}}>{unassigned} unassigned</span></>}
                </span>
                <button onClick={()=>{if(searchAutoOpened.current){setPeopleSearch('');searchAutoOpened.current=false;}setRosterTarget(null);}}
                  style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',
                    fontSize:'1rem',color:'var(--text-3)',lineHeight:1,padding:'2px 6px'}}>✕</button>
              </div>
              {/* Scrollable table */}
              <div style={{overflowY:'auto',flex:1}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.83rem'}}>
                  <thead style={{position:'sticky',top:0,background:'var(--surface)',zIndex:1}}>
                    <tr style={{borderBottom:'2px solid var(--border)'}}>
                      <th style={{padding:'6px 16px',textAlign:'left',fontWeight:600,color:'var(--text-3)',fontSize:'.74rem',textTransform:'uppercase',letterSpacing:'.04em'}}>Engineer</th>
                      {showSubDisc&&<th style={{padding:'6px 10px',textAlign:'left',fontWeight:600,color:'var(--text-3)',fontSize:'.74rem',textTransform:'uppercase',letterSpacing:'.04em',whiteSpace:'nowrap'}}>Team</th>}
                      <th style={{padding:'6px 16px',textAlign:'left',fontWeight:600,color:'var(--text-3)',fontSize:'.74rem',textTransform:'uppercase',letterSpacing:'.04em'}}>Current Projects</th>
                      <th style={{padding:'6px 12px',textAlign:'center',fontWeight:600,color:'var(--text-3)',fontSize:'.74rem',textTransform:'uppercase',letterSpacing:'.04em',whiteSpace:'nowrap'}}>Alloc</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({eng,active,totalAlloc},i)=>{
                      const discMeta=activeMeta[eng.discipline]||{color:'#6B7280',abbr:eng.discipline.slice(0,2)};
                      const allocColor=getColorForAlloc(totalAlloc);
                      const isHighlighted=!!(peopleSearch.trim()&&eng.name.toLowerCase().includes(peopleSearch.toLowerCase().trim()));
                      const rowBg=i%2===0?'transparent':'var(--bg)';
                      return(
                        <tr key={eng.id} style={{borderBottom:'1px solid var(--border)',background:rowBg,cursor:'pointer',transition:'background .1s'}}
                          onClick={()=>setRosterModal({label:rosterTarget.label,discs:rosterTarget.discs,color:rosterTarget.color})}
                          onMouseEnter={e=>e.currentTarget.style.background='var(--bg)'}
                          onMouseLeave={e=>e.currentTarget.style.background=rowBg}>
                          <td style={{padding:'6px 16px',verticalAlign:'middle'}}>
                            <div style={{fontWeight:500,color:'var(--text-1)',display:'flex',alignItems:'center',gap:'4px',flexWrap:'wrap'}}>
                              {(()=>{
                                const psq2=peopleSearch.trim();
                                if(!isHighlighted||!psq2)return<span>{eng.name}</span>;
                                const idx=eng.name.toLowerCase().indexOf(psq2.toLowerCase());
                                if(idx===-1)return<span>{eng.name}</span>;
                                return<span>{eng.name.slice(0,idx)}<span style={{background:'#DBEAFE',borderRadius:'3px',padding:'0 2px',fontWeight:700,color:'#1E40AF'}}>{eng.name.slice(idx,idx+psq2.length)}</span>{eng.name.slice(idx+psq2.length)}</span>;
                              })()}
                              <EngBadges eng={eng}/>
                            </div>
                            {eng.title&&<div style={{fontSize:'.72rem',color:'var(--text-3)',marginTop:'1px'}}>{eng.title}</div>}
                          </td>
                          {showSubDisc&&(
                            <td style={{padding:'6px 10px',verticalAlign:'middle'}}>
                              <span style={{fontSize:'.74rem',fontWeight:700,color:discMeta.color,background:discMeta.bg,border:'1px solid '+(discMeta.border||discMeta.color),padding:'2px 6px',borderRadius:'4px',whiteSpace:'nowrap'}}>{discMeta.abbr}</span>
                            </td>
                          )}
                          <td style={{padding:'6px 16px',verticalAlign:'middle'}}>
                            {active.length===0?(
                              <span style={{color:'var(--text-3)',fontSize:'.79rem',fontStyle:'italic'}}>Unassigned</span>
                            ):(
                              <div style={{display:'flex',flexDirection:'column',gap:'3px'}}>
                                {active.map(a=>{
                                  const proj=projects.find(p=>p.id===a.projectId);
                                  return(
                                    <div key={a.id} style={{display:'flex',alignItems:'center',gap:'6px'}}>
                                      <span style={{width:'8px',height:'8px',borderRadius:'50%',background:proj?.color||'#CBD5E1',flexShrink:0,display:'inline-block'}}/>
                                      <span style={{color:'var(--text-1)',fontSize:'.82rem'}}>{proj?.name||'Unknown'}</span>
                                      {a.allocation!==100&&<span style={{fontSize:'.74rem',color:'var(--text-3)'}}>{a.allocation}%</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td style={{padding:'6px 12px',textAlign:'center',verticalAlign:'middle'}}>
                            <span style={{fontWeight:600,color:allocColor,fontSize:'.84rem'}}>{totalAlloc>0?`${totalAlloc}%`:'—'}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
        </div>}{/* ── end analytics-wrap / discipline page ── */}

      {/* ── Change Log page ──────────────────────────────────────── */}
      {currentPage==='changelog'&&storeLoaded&&(engineers.length>0||projects.length>0)&&(
        <div className="changelog-page">
          <div className="changelog-page-hdr">
            <select className="log-filter-select" value={logFilters.project} onChange={e=>setLogFilter('project',e.target.value)}>
              <option value="">All projects</option>
              {projects.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
            <select className="log-filter-select" value={logFilters.discipline} onChange={e=>setLogFilter('discipline',e.target.value)}>
              <option value="">All disciplines</option>
              {activeDiscs.map(d=><option key={d} value={d}>{leafName(d)}</option>)}
            </select>
            <input className="log-filter-input" placeholder="Resource…" value={logFilters.resource} onChange={e=>setLogFilter('resource',e.target.value)}/>
            <input className="log-filter-input" type="month" value={logFilters.date} onChange={e=>setLogFilter('date',e.target.value)}/>
            {(logFilters.project||logFilters.discipline||logFilters.resource||logFilters.date)&&(
              <button className="log-filter-clear" onClick={()=>['project','discipline','resource','date'].forEach(k=>setLogFilter(k,''))}>✕ Clear</button>
            )}
            <span style={{fontSize:'.72rem',color:'var(--text-3)',background:'var(--bg)',padding:'2px 8px',borderRadius:'999px',border:'1px solid var(--border)',marginLeft:'auto'}}>{changeLog.length} entries</span>
          </div>
          <div style={{flex:1,overflow:'auto',padding:'0 18px'}}>
            <ChangeLogEntries
              entries={applyLogFilters(changeLog,logFilters)}
              allEntries={changeLog}
              projectColorMap={Object.fromEntries(projects.map(p=>[p.name,p.color]))}
            />
          </div>
        </div>
      )}

      {/* ── Analytics full-view modal ──────────────────────────── */}
      {analyticsModalOpen&&(
        <AnalyticsModal
          projects={projects}
          engineers={engineers}
          assignments={assignments}
          months={months}
          today={TODAY}
          tierOrder={state.tierOrder}
          onClose={()=>setAnalyticsModalOpen(false)}
        />
      )}

      {/* ── Tooltip ────────────────────────────────────────────── */}
      <Tooltip data={tooltip}/>

{/* ── Assignment panel ───────────────────────────────────── */}
      {assignCtx&&(
        <AssignPanel
          ctx={assignCtx}
          assignments={assignments}
          engineers={engineers}
          months={months}
          onAdd={handleAddAssignment}
          onRemove={handleRemoveAssignment}
          onExtend={handleExtendAssignment}
          onMoveStart={handleMoveStartAssignment}
          onChangeAlloc={handleChangeAllocAssignment}
          onClose={()=>setAssignCtx(null)}
          onLog={addLog}
        />
      )}

      {/* ── Settings modal ─────────────────────────────────────── */}
      {settingsProject&&(
        <SettingsModal
          project={settingsProject}
          onSave={handleSaveProject}
          onDelete={handleDeleteProject}
          onClose={()=>setSettingsProject(null)}
          engineers={engineers}
        />
      )}
      {rosterModal&&(
        <TeamRosterModal
          target={rosterModal}
          engineers={engineers}
          assignments={assignments}
          projects={projects}
          activeMeta={activeMeta}
          today={TODAY}
          onClose={()=>setRosterModal(null)}
          dispatch={dispatch}
          onLog={addLog}
        />
      )}
    </div>
    </DiscCtx.Provider>
    </UserCtx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
