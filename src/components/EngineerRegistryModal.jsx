const {useState,useMemo}=React;
import {EngBadges} from './EngBadges.jsx';

export function EngineerRegistryModal({onClose,engineers,discMeta,dispatch}){
  const[search,setSearch]=useState('');
  const[confirmDelete,setConfirmDelete]=useState(null);
  const[movingId,setMovingId]=useState(null);
  const discKeys=Object.keys(discMeta||{}).sort();
  const filtered=useMemo(()=>{
    const q=search.trim().toLowerCase();
    if(!q)return engineers;
    return engineers.filter(e=>
      e.name.toLowerCase().includes(q)||
      e.discipline.toLowerCase().includes(q)||
      (e.title||'').toLowerCase().includes(q)
    );
  },[engineers,search]);
  const sorted=useMemo(()=>
    [...filtered].sort((a,b)=>a.discipline.localeCompare(b.discipline)||a.name.localeCompare(b.name))
  ,[filtered]);
  React.useEffect(()=>{
    const h=e=>{if(e.key==='Escape'){if(confirmDelete)setConfirmDelete(null);else if(movingId)setMovingId(null);else onClose();}};
    document.addEventListener('keydown',h);
    return()=>document.removeEventListener('keydown',h);
  },[onClose,confirmDelete,movingId]);
  function doDelete(id){
    dispatch({type:'DELETE_ENGINEER',id});
    setConfirmDelete(null);
  }
  function doMove(id,newDisc){
    dispatch({type:'UPDATE_ENGINEER',id,updates:{discipline:newDisc}});
    setMovingId(null);
  }
  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-modal"
        style={{width:'900px',maxWidth:'96vw',maxHeight:'88vh',overflow:'hidden',display:'flex',flexDirection:'column',padding:'20px 24px'}}
        onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px',flexShrink:0}}>
          <h2 style={{margin:0,fontSize:'1rem',fontWeight:700}}>Engineer Registry</h2>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.2rem',color:'var(--text-2)',lineHeight:1,padding:'2px 6px'}}>✕</button>
        </div>
        <div style={{marginBottom:'12px',flexShrink:0}}>
          <input
            type="text" placeholder="Search by name, discipline, or title…"
            value={search} onChange={e=>setSearch(e.target.value)}
            style={{width:'100%',boxSizing:'border-box',padding:'7px 12px',borderRadius:'7px',border:'1px solid var(--border)',fontSize:'.85rem',background:'var(--bg)',color:'var(--text-1)'}}/>
        </div>
        <div style={{fontSize:'.78rem',color:'var(--text-3)',marginBottom:'8px',flexShrink:0}}>
          {sorted.length} of {engineers.length} engineers
        </div>
        <div style={{overflowY:'auto',flex:1}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.83rem'}}>
            <thead style={{position:'sticky',top:0,background:'var(--bg)',zIndex:1}}>
              <tr style={{borderBottom:'2px solid var(--border)'}}>
                <th style={{textAlign:'left',padding:'6px 10px',color:'var(--text-2)',fontWeight:600}}>Name</th>
                <th style={{textAlign:'left',padding:'6px 8px',color:'var(--text-2)',fontWeight:600}}>Discipline</th>
                <th style={{textAlign:'left',padding:'6px 8px',color:'var(--text-2)',fontWeight:600}}>Title</th>
                <th style={{textAlign:'center',padding:'6px 10px',color:'var(--text-2)',fontWeight:600}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(eng=>{
                const isMoving=movingId===eng.id;
                const isDeleting=confirmDelete===eng.id;
                return(
                  <tr key={eng.id} style={{borderBottom:'1px solid var(--border)',background:isDeleting?'#FEF2F2':isMoving?'#EFF6FF':'transparent'}}>
                    <td style={{padding:'7px 10px',fontWeight:500,color:'var(--text-1)'}}><span style={{display:'flex',alignItems:'center',gap:'4px'}}>{eng.name}<EngBadges eng={eng} size=".66rem"/></span></td>
                    <td style={{padding:'7px 8px'}}>
                      {isMoving?(
                        <select autoFocus defaultValue={eng.discipline}
                          onChange={e=>doMove(eng.id,e.target.value)}
                          onBlur={()=>setMovingId(null)}
                          style={{fontSize:'.82rem',padding:'3px 6px',borderRadius:'5px',border:'1px solid #3B82F6',background:'var(--bg)',color:'var(--text-1)',cursor:'pointer'}}>
                          {discKeys.map(d=><option key={d} value={d}>{d}</option>)}
                        </select>
                      ):(
                        <span style={{fontSize:'.82rem',color:'var(--text-2)'}}>{eng.discipline}</span>
                      )}
                    </td>
                    <td style={{padding:'7px 8px',color:'var(--text-3)',fontSize:'.8rem'}}>{eng.title||'—'}</td>
                    <td style={{padding:'7px 10px',textAlign:'center',whiteSpace:'nowrap'}}>
                      {isDeleting?(
                        <span>
                          <span style={{fontSize:'.78rem',color:'#B91C1C',marginRight:'6px'}}>Delete?</span>
                          <button onClick={()=>doDelete(eng.id)}
                            style={{fontSize:'.78rem',padding:'2px 8px',borderRadius:'4px',background:'#B91C1C',color:'#fff',border:'none',cursor:'pointer',marginRight:'4px',fontWeight:600}}>Yes</button>
                          <button onClick={()=>setConfirmDelete(null)}
                            style={{fontSize:'.78rem',padding:'2px 8px',borderRadius:'4px',background:'none',color:'var(--text-2)',border:'1px solid var(--border)',cursor:'pointer'}}>No</button>
                        </span>
                      ):(
                        <span style={{display:'flex',gap:'6px',justifyContent:'center'}}>
                          <button onClick={()=>{setMovingId(eng.id);setConfirmDelete(null);}}
                            title="Move to different discipline"
                            style={{fontSize:'.78rem',padding:'2px 10px',borderRadius:'4px',background:'none',color:'#2563EB',border:'1px solid #BFDBFE',cursor:'pointer'}}>Move</button>
                          <button onClick={()=>{setConfirmDelete(eng.id);setMovingId(null);}}
                            title="Delete engineer"
                            style={{fontSize:'.78rem',padding:'2px 10px',borderRadius:'4px',background:'none',color:'#B91C1C',border:'1px solid #FECACA',cursor:'pointer'}}>Delete</button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sorted.length===0&&(
                <tr><td colSpan={3} style={{padding:'20px',textAlign:'center',color:'var(--text-3)',fontSize:'.85rem'}}>No engineers match your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
