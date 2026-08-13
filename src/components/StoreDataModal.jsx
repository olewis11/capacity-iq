const {useState}=React;

export function StoreDataModal({onClose}){
  const STORES=[
    {key:'people',      lsKey:'capacityiq-demo:people',              label:'People',              desc:'Engineers and discipline hierarchy'},
    {key:'projects',    lsKey:'capacityiq-demo:projects',            label:'Projects',            desc:'Projects and assignments'},
    {key:'changelog',   lsKey:'capacityiq-demo:changelog',           label:'Change Log',          desc:'History of edits'},
    {key:'users',       lsKey:'capacityiq-demo:users',               label:'Users',               desc:'User registry and permissions'},
    {key:'snaps-people',   lsKey:'capacityiq-demo:snapshots-people',   label:'Snapshots — People',   desc:'Point-in-time people backups'},
    {key:'snaps-projects', lsKey:'capacityiq-demo:snapshots-projects', label:'Snapshots — Projects', desc:'Point-in-time project backups'},
    {key:'snaps-changelog',lsKey:'capacityiq-demo:snapshots-changelog',label:'Snapshots — Change Log',desc:'Point-in-time changelog backups'},
    {key:'snaps-users',    lsKey:'capacityiq-demo:snapshots-users',    label:'Snapshots — Users',    desc:'Point-in-time user backups'},
  ];
  const[status,setStatus]=useState({});
  const[confirming,setConfirming]=useState(null);
  const[confirmingAll,setConfirmingAll]=useState(false);
  React.useEffect(()=>{
    const h=e=>{if(e.key==='Escape')onClose();};
    document.addEventListener('keydown',h);
    return()=>document.removeEventListener('keydown',h);
  },[onClose]);
  React.useEffect(()=>{
    const init={};
    STORES.forEach(s=>{
      let data=null,error=null;
      try{const raw=localStorage.getItem(s.lsKey);data=raw?JSON.parse(raw):null;}
      catch(e){error='Failed to load';}
      init[s.key]={loading:false,data,error,cleared:false};
    });
    setStatus(init);
  },[]);
  const clearStore=(key,lsKey)=>{
    try{
      localStorage.removeItem(lsKey);
      setStatus(prev=>({...prev,[key]:{loading:false,data:null,error:null,cleared:true}}));
    }catch(e){
      setStatus(prev=>({...prev,[key]:{...prev[key],error:'Failed to clear'}}));
    }
    setConfirming(null);
  };
  const clearAll=()=>{STORES.forEach(s=>clearStore(s.key,s.lsKey));setConfirmingAll(false);};
  const getSummary=(key,data)=>{
    if(!data)return null;
    if(key==='changelog')return data.entries?.length?`${data.entries.length} entries`:'empty';
    if(key.startsWith('snaps-'))return data.snapshots?.length?`${data.snapshots.length} snapshots`:'empty';
    return null;
  };
  return(
    <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="settings-modal" style={{maxWidth:'520px',width:'100%'}}>
        <div className="modal-hdr">
          <span className="modal-title">Local Demo Data</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{padding:'14px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'12px'}}>
          <span style={{fontSize:'.8rem',color:'var(--text-3)'}}>Stored in this browser's localStorage. Clearing is permanent.</span>
          {confirmingAll?(
            <div style={{display:'flex',alignItems:'center',gap:'6px',flexShrink:0}}>
              <span style={{fontSize:'.78rem',color:'var(--text-2)'}}>Clear all files?</span>
              <button className="btn btn-danger" style={{padding:'4px 10px',fontSize:'.78rem'}} onClick={clearAll}>Yes, clear all</button>
              <button className="btn btn-ghost" style={{padding:'4px 10px',fontSize:'.78rem'}} onClick={()=>setConfirmingAll(false)}>Cancel</button>
            </div>
          ):(
            <button className="btn btn-danger" style={{flexShrink:0,padding:'5px 12px',fontSize:'.8rem'}} onClick={()=>setConfirmingAll(true)}>Clear All</button>
          )}
        </div>
        <div>
          {STORES.map(s=>{
            const st=status[s.key]||{loading:true};
            const summary=!st.loading&&!st.cleared?getSummary(s.key,st.data):null;
            return(
              <div key={s.key} style={{padding:'12px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:'12px'}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:'.88rem',fontWeight:600,color:'var(--text-1)'}}>{s.label}</div>
                  <div style={{fontSize:'.75rem',color:'var(--text-3)',marginTop:'1px'}}>{s.desc}</div>
                  {st.loading&&<div style={{fontSize:'.75rem',color:'var(--text-3)',marginTop:'3px'}}>Loading…</div>}
                  {!st.loading&&!st.cleared&&st.data&&<div style={{fontSize:'.75rem',color:'var(--text-2)',marginTop:'3px'}}>version {st.data.version} · {summary}</div>}
                  {!st.loading&&!st.cleared&&!st.data&&!st.error&&<div style={{fontSize:'.75rem',color:'var(--text-3)',marginTop:'3px'}}>No data stored</div>}
                  {st.error&&<div style={{fontSize:'.75rem',color:'#EF4444',marginTop:'3px'}}>{st.error}</div>}
                  {st.cleared&&<div style={{fontSize:'.75rem',color:'#10B981',marginTop:'3px'}}>✓ Cleared</div>}
                </div>
                {!st.cleared&&!st.loading&&(
                  confirming===s.key?(
                    <div style={{display:'flex',alignItems:'center',gap:'6px',flexShrink:0}}>
                      <span style={{fontSize:'.78rem',color:'var(--text-2)'}}>Clear this file?</span>
                      <button className="btn btn-danger" style={{padding:'4px 10px',fontSize:'.78rem'}} onClick={()=>clearStore(s.key,s.lsKey)}>Yes</button>
                      <button className="btn btn-ghost" style={{padding:'4px 10px',fontSize:'.78rem'}} onClick={()=>setConfirming(null)}>No</button>
                    </div>
                  ):(
                    <button className="btn btn-ghost" style={{padding:'5px 12px',fontSize:'.8rem',flexShrink:0}}
                      onClick={()=>setConfirming(s.key)} disabled={!st.data}>Clear</button>
                  )
                )}
              </div>
            );
          })}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
