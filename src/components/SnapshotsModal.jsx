const {useState}=React;
import {formatRelTime} from '../utils/months.js';

export function SnapshotsModal({snapsPeople,snapsProjects,snapsChangelog,snapsUsers,
  onRestorePeople,onRestoreProjects,onRestoreChangelog,onRestoreUsers,
  onTakeSnapshot,onClose}){
  const[confirmKey,setConfirmKey]=useState(null); // "store:idx"
  const[openSection,setOpenSection]=useState('people');
  React.useEffect(()=>{
    const h=e=>{if(e.key==='Escape')onClose();};
    document.addEventListener('keydown',h);
    return()=>document.removeEventListener('keydown',h);
  },[onClose]);
  const fmtSnapDate=ts=>{
    const d=new Date(ts);
    return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
      +' · '+d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
  };
  const SECTIONS=[
    {key:'people',  label:'People',     snaps:snapsPeople,  onRestore:onRestorePeople,
      summary:s=>`${s.engineers?.length??0} engineers`},
    {key:'projects',label:'Projects',   snaps:snapsProjects,onRestore:onRestoreProjects,
      summary:s=>`${s.projects?.length??0} projects · ${s.assignments?.length??0} assignments`},
    {key:'changelog',label:'Change Log',snaps:snapsChangelog,onRestore:onRestoreChangelog,
      summary:s=>`${s.entries?.length??0} entries`},
    {key:'users',   label:'Users',      snaps:snapsUsers,   onRestore:onRestoreUsers,
      summary:s=>`${s.users?.length??0} users`},
  ];
  return(
    <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="settings-modal" style={{maxWidth:'600px',width:'100%',maxHeight:'84vh',display:'flex',flexDirection:'column'}}>
        <div className="modal-hdr">
          <span className="modal-title">Snapshots</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px',flexShrink:0}}>
          <span style={{fontSize:'.8rem',color:'var(--text-3)'}}>Each store is snapshotted independently. Auto-snapshot runs daily; up to 10 kept per store.</span>
          <button className="btn btn-primary" style={{flexShrink:0,padding:'6px 14px',fontSize:'.82rem'}} onClick={onTakeSnapshot}>📸 Snapshot all</button>
        </div>
        <div style={{overflowY:'auto',flex:1}}>
          {SECTIONS.map(sec=>{
            const isOpen=openSection===sec.key;
            return(
              <div key={sec.key} style={{borderBottom:'1px solid var(--border)'}}>
                {/* Section header */}
                <div onClick={()=>setOpenSection(isOpen?null:sec.key)}
                  style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 20px',cursor:'pointer',background:'var(--bg)',userSelect:'none'}}>
                  <span style={{fontSize:'.65rem',color:'var(--text-3)',display:'inline-block',transition:'transform .15s',transform:isOpen?'rotate(90deg)':'rotate(0deg)'}}>▶</span>
                  <span style={{fontWeight:700,fontSize:'.88rem',color:'var(--text-1)',flex:1}}>{sec.label}</span>
                  <span style={{fontSize:'.75rem',color:'var(--text-3)'}}>{sec.snaps.length} snapshot{sec.snaps.length!==1?'s':''}</span>
                </div>
                {/* Snapshot list */}
                {isOpen&&(
                  sec.snaps.length===0?(
                    <div style={{padding:'20px',textAlign:'center',color:'var(--text-3)',fontSize:'.85rem'}}>No {sec.label} snapshots yet.</div>
                  ):sec.snaps.map((snap,i)=>{
                    const ck=`${sec.key}:${i}`;
                    return(
                      <div key={snap.id} style={{padding:'10px 20px 10px 32px',borderTop:'1px solid var(--border)',display:'flex',alignItems:'center',gap:'12px',background:'var(--surface)'}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                            <span style={{fontSize:'.84rem',fontWeight:600,color:'var(--text-1)'}}>{fmtSnapDate(snap.timestamp)}</span>
                            <span style={{fontSize:'.68rem',fontWeight:700,padding:'1px 6px',borderRadius:'999px',
                              background:snap.auto?'var(--border)':'#DBEAFE',color:snap.auto?'var(--text-3)':'#1D4ED8'}}>
                              {snap.auto?'auto':'manual'}
                            </span>
                          </div>
                          <div style={{fontSize:'.73rem',color:'var(--text-3)',marginTop:'2px'}}>{sec.summary(snap)}</div>
                        </div>
                        {confirmKey===ck?(
                          <div style={{display:'flex',alignItems:'center',gap:'6px',flexShrink:0}}>
                            <span style={{fontSize:'.78rem',color:'var(--text-2)'}}>Restore?</span>
                            <button className="btn btn-danger" style={{padding:'4px 10px',fontSize:'.78rem'}}
                              onClick={()=>{sec.onRestore(snap);setConfirmKey(null);onClose();}}>Yes</button>
                            <button className="btn btn-ghost" style={{padding:'4px 10px',fontSize:'.78rem'}}
                              onClick={()=>setConfirmKey(null)}>Cancel</button>
                          </div>
                        ):(
                          <button className="btn btn-ghost" style={{padding:'4px 10px',fontSize:'.78rem',flexShrink:0}}
                            onClick={()=>setConfirmKey(ck)}>Restore</button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
