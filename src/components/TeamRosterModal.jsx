const {useState}=React;
import {DEFAULT_DISC_META} from '../constants.js';
import {DiscCtx} from '../context.js';
import {fmtMonthLong} from '../utils/months.js';
import {getSupply} from '../utils/supply.js';
import {EngBadges} from './EngBadges.jsx';
import {
  sortEngs,getColorForAlloc,
} from '../constants.js';

export function TeamRosterModal({target,engineers,assignments,projects,activeMeta,today,onClose,dispatch,onLog}){
  // target: {label, discs:[], color}
  const DISC_META=React.useContext(DiscCtx)||DEFAULT_DISC_META;
  const members=engineers.filter(e=>target.discs.includes(e.discipline));
  const showSubDisc=target.discs.length>1;

  // Compute each member's current allocations
  const rows=members.map(eng=>{
    const active=assignments.filter(a=>a.engineerId===eng.id&&a.startMonth<=today&&a.endMonth>=today);
    const totalAlloc=active.reduce((s,a)=>s+a.allocation,0);
    return{eng,active,totalAlloc};
  }).sort((a,b)=>sortEngs(a.eng,b.eng));

  const assigned=rows.filter(r=>r.active.length>0).length;
  const unassigned=rows.length-assigned;

  // Assignment inline form state
  const[expandedEngId,setExpandedEngId]=useState(null);
  const todayNext3=(()=>{
    const[y,m]=today.split('-').map(Number);
    const d=new Date(y,m-1+3);
    return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  })();
  const[assignForm,setAssignForm]=useState({
    projectId:projects[0]?.id||'',startMonth:today,endMonth:todayNext3,allocation:100
  });

  const handleAssignSave=(engId)=>{
    if(!assignForm.projectId||!assignForm.startMonth||!assignForm.endMonth)return;
    dispatch({type:'ADD_ASSIGNMENT',assignment:{
      id:`assign-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      engineerId:engId,
      projectId:assignForm.projectId,
      startMonth:assignForm.startMonth,
      endMonth:assignForm.endMonth,
      allocation:Math.max(1,Math.min(200,Number(assignForm.allocation)||100)),
    }});
    const eng=engineers.find(e=>e.id===engId);
    const proj=projects.find(p=>p.id===assignForm.projectId);
    if(eng&&proj)onLog?.(`Added ${eng.name} to "${proj.name}" · ${eng.discipline}`,'add');
    setExpandedEngId(null);
  };

  return(
    <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={{background:'var(--surface)',borderRadius:'14px',boxShadow:'0 16px 48px rgba(0,0,0,.22)',
        width:'min(760px,96vw)',maxHeight:'82vh',display:'flex',flexDirection:'column',
        animation:'pop-in .16s ease-out',overflow:'hidden'}}>
        {/* Header */}
        <div className="modal-hdr" style={{gap:'12px',borderBottom:'3px solid '+target.color}}>
          <div style={{flex:1,minWidth:0}}>
            <span style={{fontWeight:800,fontSize:'1rem',color:target.color,letterSpacing:'.02em'}}>{target.label}</span>
            <span style={{color:'var(--text-3)',fontSize:'.82rem',marginLeft:'12px'}}>
              {members.length} engineers &nbsp;·&nbsp;
              <span style={{color:'#15803D'}}>{assigned} assigned</span>
              {unassigned>0&&<span style={{color:'#D97706'}}> · {unassigned} unassigned</span>}
            </span>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* Table */}
        <div style={{overflowY:'auto',flex:1}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.84rem'}}>
            <thead style={{position:'sticky',top:0,zIndex:1,background:'var(--surface)'}}>
              <tr style={{borderBottom:'2px solid var(--border)'}}>
                <th style={{padding:'9px 16px',textAlign:'left',fontWeight:600,color:'var(--text-3)',fontSize:'.75rem',textTransform:'uppercase',letterSpacing:'.04em'}}>Engineer</th>
                {showSubDisc&&<th style={{padding:'9px 12px',textAlign:'left',fontWeight:600,color:'var(--text-3)',fontSize:'.75rem',textTransform:'uppercase',letterSpacing:'.04em',whiteSpace:'nowrap'}}>Team</th>}
                <th style={{padding:'9px 16px',textAlign:'left',fontWeight:600,color:'var(--text-3)',fontSize:'.75rem',textTransform:'uppercase',letterSpacing:'.04em'}}>Current Projects</th>
                <th style={{padding:'9px 14px',textAlign:'center',fontWeight:600,color:'var(--text-3)',fontSize:'.75rem',textTransform:'uppercase',letterSpacing:'.04em',whiteSpace:'nowrap'}}>Alloc</th>
                <th style={{padding:'9px 14px',width:'72px',textAlign:'center'}}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({eng,active,totalAlloc},i)=>{
                const discMeta=DISC_META[eng.discipline]||{color:'#6B7280',abbr:eng.discipline.slice(0,2)};
                const allocColor=getColorForAlloc(totalAlloc);
                const isExpanded=expandedEngId===eng.id;
                const rowBg=i%2===0?'transparent':'var(--bg)';
                return(
                  <React.Fragment key={eng.id}>
                    <tr style={{borderBottom:isExpanded?'none':'1px solid var(--border)',background:rowBg}}>
                      <td style={{padding:'9px 16px',verticalAlign:'middle'}}>
                        <div style={{fontWeight:500,color:'var(--text-1)',display:'flex',alignItems:'center',gap:'4px'}}>
                          {eng.name}
                          <EngBadges eng={eng} size=".67rem"/>
                        </div>
                        {eng.title&&<div style={{fontSize:'.74rem',color:'var(--text-3)',marginTop:'1px'}}>{eng.title}</div>}
                      </td>
                      {showSubDisc&&(
                        <td style={{padding:'9px 12px',verticalAlign:'middle'}}>
                          <span style={{fontSize:'.75rem',fontWeight:700,color:discMeta.color,background:discMeta.bg,border:'1px solid '+discMeta.border,padding:'2px 7px',borderRadius:'4px',whiteSpace:'nowrap'}}>{discMeta.abbr}</span>
                        </td>
                      )}
                      <td style={{padding:'9px 16px',verticalAlign:'middle'}}>
                        {active.length===0?(
                          <span style={{color:'var(--text-3)',fontSize:'.8rem',fontStyle:'italic'}}>Unassigned</span>
                        ):(
                          <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
                            {active.map(a=>{
                              const proj=projects.find(p=>p.id===a.projectId);
                              return(
                                <div key={a.id} style={{display:'flex',alignItems:'center',gap:'7px'}}>
                                  <span style={{width:'9px',height:'9px',borderRadius:'50%',background:proj?.color||'#CBD5E1',flexShrink:0,display:'inline-block'}}/>
                                  <span style={{color:'var(--text-1)'}}>{proj?.name||'Unknown'}</span>
                                  {a.allocation!==100&&<span style={{fontSize:'.75rem',color:'var(--text-3)'}}>{a.allocation}%</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td style={{padding:'9px 14px',textAlign:'center',verticalAlign:'middle'}}>
                        <span style={{fontWeight:700,fontSize:'.88rem',color:allocColor}}>{totalAlloc>0?totalAlloc+'%':'—'}</span>
                      </td>
                      <td style={{padding:'9px 10px',textAlign:'center',verticalAlign:'middle'}}>
                        <button onClick={()=>setExpandedEngId(isExpanded?null:eng.id)}
                          style={{fontSize:'.71rem',fontWeight:600,padding:'3px 7px',borderRadius:'5px',
                            border:'1px solid var(--border)',cursor:'pointer',whiteSpace:'nowrap',
                            background:isExpanded?'var(--primary)':'transparent',
                            color:isExpanded?'#fff':'var(--text-3)',transition:'all .12s'}}>
                          {isExpanded?'✕':'+ Assign'}
                        </button>
                      </td>
                    </tr>
                    {isExpanded&&(
                      <tr style={{borderBottom:'1px solid var(--border)',background:rowBg}}>
                        <td colSpan={showSubDisc?5:4} style={{padding:'8px 16px 12px',background:'var(--bg)'}}>
                          <div style={{display:'flex',flexWrap:'wrap',gap:'8px',alignItems:'center'}}>
                            <select value={assignForm.projectId}
                              onChange={e=>setAssignForm(f=>({...f,projectId:e.target.value}))}
                              style={{border:'1px solid var(--border)',borderRadius:'5px',background:'var(--surface)',
                                color:'var(--text-1)',fontSize:'.78rem',padding:'3px 8px',height:'28px'}}>
                              <option value="">Select project…</option>
                              {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <input type="month" value={assignForm.startMonth}
                              onChange={e=>setAssignForm(f=>({...f,startMonth:e.target.value}))}
                              style={{border:'1px solid var(--border)',borderRadius:'5px',background:'var(--surface)',
                                color:'var(--text-1)',fontSize:'.78rem',padding:'3px 8px',height:'28px'}}/>
                            <span style={{fontSize:'.75rem',color:'var(--text-3)'}}>→</span>
                            <input type="month" value={assignForm.endMonth}
                              onChange={e=>setAssignForm(f=>({...f,endMonth:e.target.value}))}
                              style={{border:'1px solid var(--border)',borderRadius:'5px',background:'var(--surface)',
                                color:'var(--text-1)',fontSize:'.78rem',padding:'3px 8px',height:'28px'}}/>
                            <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
                              <input type="number" value={assignForm.allocation} min={1} max={200}
                                onChange={e=>setAssignForm(f=>({...f,allocation:e.target.value}))}
                                style={{border:'1px solid var(--border)',borderRadius:'5px',background:'var(--surface)',
                                  color:'var(--text-1)',fontSize:'.78rem',padding:'3px 6px',height:'28px',
                                  width:'58px',textAlign:'right'}}/>
                              <span style={{fontSize:'.78rem',color:'var(--text-3)'}}>%</span>
                            </div>
                            <button onClick={()=>handleAssignSave(eng.id)}
                              disabled={!assignForm.projectId}
                              style={{padding:'4px 12px',borderRadius:'5px',fontSize:'.78rem',fontWeight:600,
                                background:'var(--primary)',color:'#fff',border:'none',height:'28px',
                                cursor:assignForm.projectId?'pointer':'not-allowed',
                                opacity:assignForm.projectId?1:.45}}>
                              Add
                            </button>
                            <button onClick={()=>setExpandedEngId(null)}
                              style={{padding:'4px 8px',borderRadius:'5px',fontSize:'.78rem',fontWeight:600,
                                background:'transparent',color:'var(--text-3)',border:'1px solid var(--border)',
                                cursor:'pointer',height:'28px'}}>
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
