import {DEFAULT_DISC_META,DEPT_PALETTE} from '../constants.js';
import {DiscCtx} from '../context.js';
import {ratioToBarColor,fmtMonthShort} from '../utils/months.js';
import {roundHalf,getDemand,leafName} from '../utils/demand.js';
import {getOrgSupply,getEngineerTotalAlloc} from '../utils/supply.js';

const IB=8,IS=14; // base left padding, indent step (px)

export function OrgAnalytics({projects,engineers,assignments,months,today,tierOrder}){
  const {useState,useMemo}=React;
  const DISC_META=React.useContext(DiscCtx)||DEFAULT_DISC_META;
  const DISCS=Object.keys(DISC_META);

  const [collapsed,setCollapsed]=useState(new Set());
  const toggle=path=>setCollapsed(prev=>{const s=new Set(prev);s.has(path)?s.delete(path):s.add(path);return s;});

  // ── Build flat ordered row list from tier hierarchy ──
  const treeRows=useMemo(()=>{
    const sbo=(arr,key)=>{
      const order=(tierOrder||{})[key]||[];
      if(!order.length)return arr;
      return[...arr].sort((a,b)=>{const ai=order.indexOf(a),bi=order.indexOf(b);if(ai===-1&&bi===-1)return 0;if(ai===-1)return 1;if(bi===-1)return-1;return ai-bi;});
    };
    // Build nested maps: bu → dept → discipline → subdisc → [discs]
    const buMap={};
    DISCS.forEach(disc=>{
      const m=DISC_META[disc]||{};
      const bu=m.bu||'Other';
      const dept=m.dept,discipline=m.discipline,subdisc=m.subdisc;
      if(!buMap[bu])buMap[bu]={depts:{},leaves:[]};
      if(!dept){buMap[bu].leaves.push(disc);return;}
      if(!buMap[bu].depts[dept])buMap[bu].depts[dept]={disciplines:{},leaves:[]};
      if(!discipline){buMap[bu].depts[dept].leaves.push(disc);return;}
      if(!buMap[bu].depts[dept].disciplines[discipline])buMap[bu].depts[dept].disciplines[discipline]={subdiscs:{},leaves:[]};
      if(!subdisc){buMap[bu].depts[dept].disciplines[discipline].leaves.push(disc);return;}
      if(!buMap[bu].depts[dept].disciplines[discipline].subdiscs[subdisc])buMap[bu].depts[dept].disciplines[discipline].subdiscs[subdisc]=[];
      buMap[bu].depts[dept].disciplines[discipline].subdiscs[subdisc].push(disc);
    });
    function allDiscs(node){
      if(Array.isArray(node))return node;
      const r=[...(node.leaves||[])];
      Object.values(node.depts||{}).forEach(n=>r.push(...allDiscs(n)));
      Object.values(node.disciplines||{}).forEach(n=>r.push(...allDiscs(n)));
      Object.values(node.subdiscs||{}).forEach(n=>r.push(...allDiscs(n)));
      return r;
    }
    const rows=[];
    sbo(Object.keys(buMap),'bus').forEach(bu=>{
      const bn=buMap[bu];
      const bd=allDiscs(bn);
      const buPath=bu;
      rows.push({type:'bu',depth:0,path:buPath,parentPath:null,label:bu,discs:bd});
      bn.leaves.forEach(disc=>rows.push({type:'disc',depth:1,path:`${buPath}||${disc}`,parentPath:buPath,label:leafName(disc),disc,discs:[disc]}));
      sbo(Object.keys(bn.depts),'depts').forEach(dept=>{
        const dn=bn.depts[dept];
        const deptPath=`${buPath}||${dept}`;
        rows.push({type:'dept',depth:1,path:deptPath,parentPath:buPath,label:dept,discs:allDiscs(dn)});
        dn.leaves.forEach(disc=>rows.push({type:'disc',depth:2,path:`${deptPath}||${disc}`,parentPath:deptPath,label:leafName(disc),disc,discs:[disc]}));
        sbo(Object.keys(dn.disciplines),'disciplines').forEach(discipline=>{
          const discn=dn.disciplines[discipline];
          const discPath=`${deptPath}||${discipline}`;
          rows.push({type:'discipline',depth:2,path:discPath,parentPath:deptPath,label:discipline,discs:allDiscs(discn)});
          discn.leaves.forEach(disc=>rows.push({type:'disc',depth:3,path:`${discPath}||${disc}`,parentPath:discPath,label:leafName(disc),disc,discs:[disc]}));
          sbo(Object.keys(discn.subdiscs),'subdiscs').forEach(subdisc=>{
            const sdn=discn.subdiscs[subdisc];
            const subdiscPath=`${discPath}||${subdisc}`;
            rows.push({type:'subdisc',depth:3,path:subdiscPath,parentPath:discPath,label:subdisc,discs:sdn});
            sdn.forEach(disc=>rows.push({type:'disc',depth:4,path:`${subdiscPath}||${disc}`,parentPath:subdiscPath,label:leafName(disc),disc,discs:[disc]}));
          });
        });
      });
    });
    return rows;
  },[DISC_META,tierOrder]);

  // Collapse helpers that reference treeRows
  const TIER_ORDER=['bu','dept','discipline','subdisc'];
  const collapseToLevel=type=>{
    const cutIdx=TIER_ORDER.indexOf(type);
    if(cutIdx===-1){setCollapsed(new Set());return;}
    setCollapsed(new Set(treeRows.filter(r=>TIER_ORDER.indexOf(r.type)>=cutIdx).map(r=>r.path)));
  };

  // ── Visibility: a row is visible if its parent path is not collapsed (and transitively) ──
  const visibleRows=useMemo(()=>{
    const visSet=new Set();
    treeRows.forEach(row=>{
      if(row.parentPath===null){visSet.add(row.path);return;}
      if(visSet.has(row.parentPath)&&!collapsed.has(row.parentPath))visSet.add(row.path);
    });
    return treeRows.filter(r=>visSet.has(r.path));
  },[treeRows,collapsed]);

  // ── Pre-compute per-disc per-month demand + supply ──
  const discMonthData=useMemo(()=>{
    const map={};
    DISCS.forEach(disc=>{
      map[disc]=months.map(m=>({
        d:roundHalf(projects.reduce((s,p)=>s+getDemand(p,disc,m,DISC_META),0)),
        s:roundHalf(getOrgSupply(assignments,engineers,disc,m)),
      }));
    });
    return map;
  },[DISC_META,projects,assignments,engineers,months]);

  const rowCells=row=>months.map((m,i)=>{
    let d=0,s=0;
    row.discs.forEach(disc=>{const dc=discMonthData[disc];if(dc){d+=dc[i].d;s+=dc[i].s;}});
    d=roundHalf(d);s=roundHalf(s);
    const ratio=d>0?s/d:0;
    return{m,d,s,ratio,fillPct:Math.min(ratio,1)*100,barColor:d>0?ratioToBarColor(ratio):null,isCur:m===today};
  });

  // ── Summary cards (today's month) ──
  const todayIdx=months.indexOf(today);
  const totalDemand=roundHalf(DISCS.reduce((sum,disc)=>{const dc=discMonthData[disc];return dc?sum+dc[todayIdx<0?0:todayIdx].d:sum;},0));
  const totalSupply=roundHalf(DISCS.reduce((sum,disc)=>{const dc=discMonthData[disc];return dc?sum+dc[todayIdx<0?0:todayIdx].s:sum;},0));
  const netGap=roundHalf(totalDemand-totalSupply);
  const atCapacity=engineers.filter(e=>getEngineerTotalAlloc(assignments,today,e.id)>=100).length;

  const gapColor=(d,s)=>{if(d===0)return'var(--text-3)';const r=s/d;return r>=1.05?'#15803D':r>=1?'#1D4ED8':r>=.7?'#92400E':'#B91C1C';};
  const gapText=(d,s)=>{if(d===0)return'—';if(s<d)return`−${(d-s).toFixed(1)}`;if(s>d*1.05)return`+${(s-d).toFixed(1)}`;return'✓';};

  const rowColor=row=>{const first=row.discs[0];return first?(DISC_META[first]?.color||'#94A3B8'):'#94A3B8';};

  const isTierActive=type=>{
    // A tier button is active when all tier nodes at >= that depth are collapsed
    const cutIdx=TIER_ORDER.indexOf(type);
    if(cutIdx===-1)return collapsed.size===0; // 'all'
    const tierNodes=treeRows.filter(r=>TIER_ORDER.includes(r.type));
    return tierNodes.every(r=>{
      const ri=TIER_ORDER.indexOf(r.type);
      return ri<cutIdx?!collapsed.has(r.path):collapsed.has(r.path);
    });
  };
  const allActive=collapsed.size===0;

  return(
    <div className="analytics-wrap">
      {/* Summary cards */}
      <div className="analytics-title-row">
        <div className="analytics-section-title">Org Staffing Analytics</div>
        <div className="analytics-section-sub">Demand vs supply across all projects</div>
      </div>
      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-card-label">FTE Demand</div>
          <div className="summary-card-value">{totalDemand.toFixed(1)}</div>
          <div className="summary-card-sub">this month</div>
        </div>
        <div className="summary-card">
          <div className="summary-card-label">FTE Supply</div>
          <div className="summary-card-value">{totalSupply.toFixed(1)}</div>
          <div className="summary-card-sub">active assignments</div>
        </div>
        <div className="summary-card">
          <div className="summary-card-label">Net Gap</div>
          <div className="summary-card-value" style={{color:netGap>0.05?'#B91C1C':netGap<-0.05?'#15803D':'#1D4ED8'}}>
            {netGap>0.05?`−${netGap.toFixed(1)}`:netGap<-0.05?`+${Math.abs(netGap).toFixed(1)}`:'✓'}
          </div>
          <div className="summary-card-sub">demand − supply</div>
        </div>
        <div className="summary-card">
          <div className="summary-card-label">At Capacity</div>
          <div className="summary-card-value">{atCapacity}</div>
          <div className="summary-card-sub">≥ 100% allocated</div>
        </div>
      </div>

      {/* Scrollable grid */}
      <div className="analytics-scroll">
        {/* Tier level buttons + month header row */}
        <div className="org-row" style={{position:'sticky',top:0,zIndex:14}}>
          <div className="org-label" style={{gap:'6px',paddingLeft:`${IB}px`}}>
            <div className="tier-btns">
              <button className={`tier-btn${isTierActive('bu')?' t-on':''}`} onClick={()=>collapseToLevel('bu')}>BU</button>
              <button className={`tier-btn${isTierActive('dept')?' t-on':''}`} onClick={()=>collapseToLevel('dept')}>Dept</button>
              <button className={`tier-btn${isTierActive('discipline')?' t-on':''}`} onClick={()=>collapseToLevel('discipline')}>Disc</button>
              <button className={`tier-btn${isTierActive('subdisc')?' t-on':''}`} onClick={()=>collapseToLevel('subdisc')}>Subdisc</button>
              <button className={`tier-btn${allActive?' t-on':''}`} onClick={()=>setCollapsed(new Set())}>All</button>
            </div>
          </div>
          {months.map(m=>(
            <div key={m} className="org-cell" style={{height:'38px',background:m===today?'#EFF6FF':'var(--surface)',borderLeft:m===today?'2px solid var(--primary)':'',borderRight:m===today?'2px solid var(--primary)':''}}>
              <span style={{fontSize:'.72rem',fontWeight:m===today?700:500,color:m===today?'var(--primary)':'var(--text-2)',whiteSpace:'nowrap'}}>{fmtMonthShort(m)}</span>
            </div>
          ))}
        </div>

        {/* Data rows */}
        {visibleRows.map(row=>{
          const isLeaf=row.type==='disc';
          const isCollapsed=collapsed.has(row.path);
          const canCollapse=!isLeaf;
          const cells=rowCells(row);
          const indent=IB+row.depth*IS;
          const headcount=engineers.filter(e=>!e.inactive&&row.discs.includes(e.discipline)).length;
          const color=rowColor(row);
          const rowBg=isLeaf?'var(--surface)':(row.depth===0?'var(--bg)':'var(--surface)');
          return(
            <div key={row.path} className="org-row" style={{background:rowBg}}>
              <div className="org-label"
                style={{paddingLeft:`${indent}px`,paddingRight:'10px',cursor:canCollapse?'pointer':'default',gap:'7px',
                  borderLeft: row.depth===0?`3px solid ${color}`:'none',
                  background:rowBg}}
                onClick={canCollapse?()=>toggle(row.path):undefined}>
                {canCollapse
                  ?<span style={{fontSize:'.65rem',color:'var(--text-3)',flexShrink:0,width:'10px',textAlign:'center',lineHeight:1}}>
                    {isCollapsed?'▶':'▼'}
                  </span>
                  :<span style={{width:'10px',flexShrink:0}}/>
                }
                <div style={{width:'8px',height:'8px',borderRadius:'2px',background:color,flexShrink:0}}/>
                <span style={{fontWeight:isLeaf?400:600,fontSize:'.85rem',color:'var(--text-1)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {row.label}
                </span>
                <span style={{fontSize:'.72rem',color:'var(--text-3)',whiteSpace:'nowrap',flexShrink:0}}>{headcount} eng</span>
              </div>
              {cells.map(({m,d,s,fillPct,barColor,isCur})=>(
                <div key={m} className={`org-cell${isCur?' is-current':''}`}>
                  <span style={{fontSize:'.76rem',fontWeight:isLeaf?600:700,color:gapColor(d,s)}}>{gapText(d,s)}</span>
                  <div style={{width:'100%',height:'6px',background:'rgba(0,0,0,0.09)',borderRadius:'3px',overflow:'hidden',position:'relative'}}>
                    {barColor&&<div style={{position:'absolute',top:0,bottom:0,left:0,width:`${fillPct}%`,background:barColor,opacity:.8,borderRadius:'3px'}}/>}
                  </div>
                  {d>0&&<span style={{fontSize:'.65rem',color:'var(--text-3)',whiteSpace:'nowrap'}}>{s.toFixed(1)} / {d.toFixed(1)}</span>}
                </div>
              ))}
            </div>
          );
        })}

        {/* Overall row */}
        <div className="org-row is-overall">
          <div className="org-label" style={{paddingLeft:`${IB}px`}}>
            <span style={{fontWeight:700,fontSize:'.88rem',color:'var(--text-1)',flex:1}}>Overall</span>
            <span style={{fontSize:'.72rem',color:'var(--text-3)',whiteSpace:'nowrap'}}>{engineers.filter(e=>!e.inactive).length} eng</span>
          </div>
          {months.map((m,i)=>{
            let d=0,s=0;
            DISCS.forEach(disc=>{const dc=discMonthData[disc];if(dc){d+=dc[i].d;s+=dc[i].s;}});
            d=roundHalf(d);s=roundHalf(s);
            const ratio=d>0?s/d:0;
            const fillPct=Math.min(ratio,1)*100;
            const barColor=d>0?ratioToBarColor(ratio):null;
            const isCur=m===today;
            return(
              <div key={m} className={`org-cell${isCur?' is-current':''}`}>
                <span style={{fontSize:'.76rem',fontWeight:700,color:gapColor(d,s)}}>{gapText(d,s)}</span>
                <div style={{width:'100%',height:'6px',background:'rgba(0,0,0,0.09)',borderRadius:'3px',overflow:'hidden',position:'relative'}}>
                  {barColor&&<div style={{position:'absolute',top:0,bottom:0,left:0,width:`${fillPct}%`,background:barColor,opacity:.8,borderRadius:'3px'}}/>}
                </div>
                {d>0&&<span style={{fontSize:'.65rem',color:'var(--text-3)',whiteSpace:'nowrap'}}>{s.toFixed(1)} / {d.toFixed(1)}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function AnalyticsModal({projects,engineers,assignments,months,today,tierOrder,onClose}){
  return(
    <div className="analytics-modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className="analytics-modal-inner">
        <div className="analytics-modal-hdr">
          <span className="analytics-modal-title">By Month — Org Staffing</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="analytics-modal-body">
          <OrgAnalytics projects={projects} engineers={engineers} assignments={assignments} months={months} today={today} tierOrder={tierOrder}/>
        </div>
      </div>
    </div>
  );
}
