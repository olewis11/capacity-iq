const {useState,useCallback,useMemo}=React;
import {DEFAULT_DISC_META} from '../constants.js';
import {DiscCtx,UserCtx} from '../context.js';
import {fmtMonthLong,fmtMonthShort,ratioToBarColor} from '../utils/months.js';
import {getDemand} from '../utils/demand.js';
import {getSupply,getAssigned,getEngineerTotalAlloc} from '../utils/supply.js';
import {EngBadges} from './EngBadges.jsx';
import {AssignmentBarRow} from './AssignmentBarRow.jsx';
import {MasterDurationBar} from './MasterDurationBar.jsx';

export function AssignPanel({ctx,assignments,engineers,months,onAdd,onRemove,onExtend,onMoveStart,onChangeAlloc,onClose,onLog}){
  const DISC_META=React.useContext(DiscCtx)||DEFAULT_DISC_META;
  const{canEditSupply=true}=React.useContext(UserCtx)||{};
  const[query,setQuery]=useState('');
  const[addedThisSession,setAddedThisSession]=useState(new Set());
  const[hideFullyAssigned,setHideFullyAssigned]=useState(false);
  const[broaderOpen,setBroaderOpen]=useState(false);
  const{project,disc,month}=ctx;
  const meta=DISC_META[disc]||{color:'#6B7280',bg:'#F3F4F6',border:'#D1D5DB',abbr:disc.slice(0,2)};
  const discGroup=DISC_META[disc]?.bu||null;

  const existing=getAssigned(assignments,engineers,project.id,disc,month);
  const assignedIds=new Set(existing.map(x=>x.eng.id));

  const filterEng=(e)=>{
    if(e.inactive)return false;
    if(assignedIds.has(e.id))return false;
    if(query&&!e.name.toLowerCase().includes(query.toLowerCase()))return false;
    if(hideFullyAssigned&&getEngineerTotalAlloc(assignments,month,e.id)>=100)return false;
    return true;
  };
  const sortEng=(a,b)=>{
    const aFree=100-getEngineerTotalAlloc(assignments,month,a.id);
    const bFree=100-getEngineerTotalAlloc(assignments,month,b.id);
    return bFree-aFree;
  };
  const discEngineers=engineers.filter(e=>e.discipline===disc);
  const filtered=discEngineers.filter(filterEng).sort(sortEng);

  /* Broader team: all other disciplines in the same org group, grouped by discipline */
  const broaderByDisc=useMemo(()=>{
    if(!discGroup)return[];
    const map={};
    engineers.filter(e=>e.discipline!==disc&&(DISC_META[e.discipline]?.bu||null)===discGroup).forEach(e=>{
      (map[e.discipline]=map[e.discipline]||[]).push(e);
    });
    return Object.keys(map).sort((a,b)=>a.localeCompare(b)).map(d=>({disc:d,engs:map[d].filter(filterEng).sort(sortEng)}));
  // eslint-disable-next-line
  },[engineers,disc,discGroup,assignedIds,query,hideFullyAssigned,assignments,month]);

  const doAdd=(eng)=>{
    const id=`a-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    onAdd({id,engineerId:eng.id,projectId:project.id,startMonth:month,endMonth:month,allocation:100});
    setAddedThisSession(s=>new Set([...s,eng.id]));
    onLog?.(`Added ${eng.name} to "${project.name}" · ${disc}`,'add');
  };

  const committed=existing.filter(x=>!addedThisSession.has(x.eng.id));
  const uncommitted=existing.filter(x=>addedThisSession.has(x.eng.id));

  const handleMasterSetAll=(newStart,newEnd)=>{
    uncommitted.forEach(({assignment})=>{
      onMoveStart(assignment.id,newStart);
      onExtend(assignment.id,newEnd);
    });
  };

  const demand=getDemand(project,disc,month,DISC_META);
  const supply=getSupply(assignments,engineers,project.id,disc,month);
  const gap=demand-supply;
  const healthColor=supply>=demand*1.05?'#22C55E':supply>=demand?'#3B82F6':supply>=demand*.7?'#F59E0B':'#EF4444';
  const sparkDemands=months.map(m=>getDemand(project,disc,m,DISC_META));
  const sparkMax=Math.max(...sparkDemands,0.1);

  return(
    <>
      <div className="panel-overlay" onClick={onClose}/>
      <div className="assign-panel assign-panel-wide" style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)'}}>

        {/* ── Header ── */}
        <div className="panel-hdr" style={{borderBottom:`3px solid ${project.color}`}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <div style={{width:'12px',height:'12px',borderRadius:'50%',background:project.color,flexShrink:0}}/>
            <div>
              <div className="panel-title">{project.name} — {disc}</div>
              <div className="panel-subtitle">Staffing for {fmtMonthLong(month)}</div>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
            <span style={{fontSize:'.88rem',color:healthColor,fontWeight:700}}>
              {supply.toFixed(1)} / {demand.toFixed(1)} FTE
              {gap>0.05?` (−${gap.toFixed(1)} gap)`:gap<-0.05?` (+${(-gap).toFixed(1)} surplus)`:' ✓'}
            </span>
            <button className="panel-close" onClick={onClose}>×</button>
          </div>
        </div>

        {/* ── Permission notice ── */}
        {!canEditSupply&&(
          <div className="perm-notice" style={{margin:'0 16px 0',borderRadius:0,borderLeft:'none',borderRight:'none',borderTop:'none',background:'#FFF7ED',borderColor:'#FED7AA'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C2410C" strokeWidth="2.2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span style={{color:'#C2410C'}}>View only — supply editing requires Functional Manager access</span>
          </div>
        )}
        {/* ── 2-column body, 1/3 + 2/3 ── */}
        <div className="panel-2col">

          {/* LEFT: available engineers */}
          <div className="panel-left">
            <div className="panel-col-hdr" style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span>Available — {filtered.length} {disc}</span>
              <label style={{display:'flex',alignItems:'center',gap:'5px',fontSize:'.75rem',color:'var(--text-2)',fontWeight:400,cursor:'pointer',textTransform:'none',letterSpacing:0}}>
                <input type="checkbox" checked={hideFullyAssigned} onChange={e=>setHideFullyAssigned(e.target.checked)} style={{margin:0,cursor:'pointer'}}/>
                Hide full
              </label>
            </div>
            <div className="panel-col-body">
              {filtered.length===0&&<div className="no-results">No available engineers match</div>}
              {filtered.map(eng=>{
                const busy=getEngineerTotalAlloc(assignments,month,eng.id);
                return(
                  <div key={eng.id} className="eng-option" onClick={canEditSupply?()=>doAdd(eng):undefined}
                    style={canEditSupply?{}:{cursor:'default',opacity:.55,pointerEvents:'none'}}>
                    <span style={{fontSize:'.88rem',fontWeight:500,flex:1,display:'flex',alignItems:'center',gap:'4px',minWidth:0}}>
                      <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{eng.name}</span>
                      <EngBadges eng={eng} size=".62rem"/>
                    </span>
                    <span className={`eng-avail ${busy>=100?'busy':''}`}>
                      {busy>=100?'Full':`${100-busy}% free`}
                    </span>
                  </div>
                );
              })}

              {/* ── Broader team: other disciplines in same org group ── */}
              {broaderByDisc.length>0&&(
                <div style={{marginTop:'6px',borderTop:'1px solid var(--border)'}}>
                  <div onClick={()=>setBroaderOpen(v=>!v)}
                    style={{display:'flex',alignItems:'center',gap:'6px',padding:'6px 10px',cursor:'pointer',userSelect:'none',background:'var(--bg)'}}>
                    <span style={{fontSize:'.6rem',color:'var(--text-3)',display:'inline-block',transition:'transform .15s',transform:broaderOpen?'rotate(90deg)':'rotate(0deg)'}}>▶</span>
                    <span style={{fontSize:'.75rem',fontWeight:600,color:'var(--text-2)',flex:1}}>Also in {discGroup}</span>
                    <span style={{fontSize:'.72rem',color:'var(--text-3)'}}>{broaderByDisc.reduce((s,g)=>s+g.engs.length,0)} available</span>
                  </div>
                  {broaderOpen&&broaderByDisc.map(({disc:d,engs})=>(
                    <div key={d}>
                      <div style={{padding:'4px 10px 2px',fontSize:'.72rem',fontWeight:600,color:DISC_META[d]?.color||'var(--text-3)',background:'var(--surface)',borderTop:'1px solid var(--border)'}}>
                        {d}
                      </div>
                      {engs.length===0?(
                        <div style={{padding:'4px 10px 5px',fontSize:'.75rem',color:'var(--text-3)',fontStyle:'italic'}}>None available</div>
                      ):engs.map(eng=>{
                        const busy=getEngineerTotalAlloc(assignments,month,eng.id);
                        return(
                          <div key={eng.id} className="eng-option" onClick={canEditSupply?()=>doAdd(eng):undefined}
                            style={canEditSupply?{}:{cursor:'default',opacity:.55,pointerEvents:'none'}}>
                            <span style={{fontSize:'.88rem',fontWeight:500,flex:1,display:'flex',alignItems:'center',gap:'4px',minWidth:0}}>
                              <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{eng.name}</span>
                              <EngBadges eng={eng} size=".62rem"/>
                            </span>
                            <span className={`eng-avail ${busy>=100?'busy':''}`}>
                              {busy>=100?'Full':`${100-busy}% free`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="panel-controls">
              <input className="panel-search" placeholder={`Search ${disc} engineers…`}
                value={query} onChange={e=>setQuery(e.target.value)} autoFocus/>
            </div>
          </div>

          {/* RIGHT: assigned engineers with draggable timeline bars */}
          <div className="panel-right">
            <div className="panel-col-hdr">Assigned this month ({existing.length})</div>

            {/* ── Sparkline — sits between header and body, outside scroll area ── */}
            <div style={{flexShrink:0,padding:'8px 14px 0',borderBottom:'1px solid var(--border)',background:'var(--bg)'}}>
              {/* Row: name spacer | alloc spacer | bars | remove spacer */}
              <div style={{display:'flex',gap:'8px',alignItems:'flex-end'}}>
                <div style={{width:'130px',flexShrink:0,fontSize:'.62rem',color:'var(--text-3)',paddingBottom:'4px',lineHeight:1.2}}>
                  <span style={{fontWeight:700,textTransform:'uppercase',letterSpacing:'.3px'}}>{disc}</span>
                  <span style={{opacity:.7}}> · 12 mo</span>
                </div>
                <div style={{width:'46px',flexShrink:0}}/>
                {/* Sparkline bars */}
                <div style={{flex:1,display:'flex',gap:'1px'}}>
                  {months.map((m,i)=>{
                    const d=sparkDemands[i];
                    const s=getSupply(assignments,engineers,project.id,disc,m);
                    const isAct=m===month;
                    const dH=d>0?(d/sparkMax)*100:0;
                    const sH=d>0?Math.min(s/sparkMax,1)*100:0;
                    const bc=d>0?ratioToBarColor(s/d):null;
                    return(
                      <div key={m} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'stretch',gap:'1px'}}>
                        {/* Bar area — explicit height so absolute-positioned fills render */}
                        <div style={{height:'36px',position:'relative'}}>
                          {d>0&&<div style={{position:'absolute',bottom:0,left:0,right:0,height:`${dH}%`,background:'rgba(0,0,0,0.08)',borderRadius:'1px 1px 0 0'}}/>}
                          {d>0&&<div style={{position:'absolute',bottom:0,left:0,right:0,height:`${sH}%`,background:bc,opacity:.7,borderRadius:'1px 1px 0 0'}}/>}
                          {isAct&&<div style={{position:'absolute',inset:0,border:'2px solid var(--primary)',borderRadius:'2px',pointerEvents:'none'}}/>}
                        </div>
                        <div style={{fontSize:'.5rem',color:isAct?'var(--primary)':'var(--text-3)',fontWeight:isAct?700:400,textAlign:'center',lineHeight:1.4,flexShrink:0,whiteSpace:'nowrap',overflow:'hidden'}}>
                          {fmtMonthShort(m)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{width:'22px',flexShrink:0}}/>
              </div>
            </div>

            {/* ── Scrollable assignment list ── */}
            <div className="panel-col-body">
              {committed.length===0&&uncommitted.length===0&&(
                <div className="no-results">No one assigned yet</div>
              )}
              {committed.map(({eng,assignment})=>(
                <AssignmentBarRow
                  key={eng.id}
                  eng={eng}
                  assignment={assignment}
                  months={months}
                  isNew={false}
                  readOnly={!canEditSupply}
                  onRemove={()=>{onRemove(assignment.id);onLog?.(`Removed ${eng.name} from "${project.name}" · ${disc}`,'remove');}}
                  onExtend={(newEnd)=>onExtend(assignment.id,newEnd)}
                  onMoveStart={(newStart)=>onMoveStart(assignment.id,newStart)}
                  onChangeAlloc={()=>onChangeAlloc(assignment.id,assignment.allocation)}
                />
              ))}
              {uncommitted.length>0&&(
                <>
                  <div style={{
                    fontSize:'.72rem',fontWeight:700,color:'#15803D',
                    textTransform:'uppercase',letterSpacing:'.4px',
                    padding:'6px 0 2px',
                    borderTop:committed.length>0?'1px solid #BBF7D0':'none',
                    marginTop:committed.length>0?'4px':0,
                  }}>
                    New Assignments ({uncommitted.length})
                  </div>
                  {uncommitted.map(({eng,assignment})=>(
                    <AssignmentBarRow
                      key={eng.id}
                      eng={eng}
                      assignment={assignment}
                      months={months}
                      isNew={true}
                      readOnly={!canEditSupply}
                      onRemove={()=>{onRemove(assignment.id);onLog?.(`Removed ${eng.name} from "${project.name}" · ${disc}`,'remove');}}
                      onExtend={(newEnd)=>onExtend(assignment.id,newEnd)}
                      onMoveStart={(newStart)=>onMoveStart(assignment.id,newStart)}
                      onChangeAlloc={()=>onChangeAlloc(assignment.id,assignment.allocation)}
                    />
                  ))}
                </>
              )}
            </div>

            {/* ── Master duration bar (shown when 2+ new assignments) ── */}
            {uncommitted.length>1&&(
              <MasterDurationBar
                uncommitted={uncommitted}
                months={months}
                onSetAll={handleMasterSetAll}
              />
            )}
          </div>

        </div>

        {/* ── Full-width Done button ── */}
        <div style={{padding:'12px 16px',borderTop:'1px solid var(--border)',flexShrink:0}}>
          <button className="btn btn-primary" style={{width:'100%'}} onClick={onClose}>
            {canEditSupply?'Done':'Close'}
          </button>
        </div>
      </div>
    </>
  );
}
