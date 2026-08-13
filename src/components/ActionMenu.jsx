const {useState,useRef}=React;
import {ROLE_LABELS} from '../constants.js';

export function ActionMenu({onAddProject,onSnapshots,onWorkday,onBaselineEmails,onDataFiles,onManageUsers,onManageEngineers,isAdmin=false,isRealAdmin=false,testRole=null,onTestRole,userName=null,userRole='viewer',userEmail=null}){
  const[open,setOpen]=useState(false);
  const wrapRef=useRef(null);
  React.useEffect(()=>{
    if(!open)return;
    const handler=(e)=>{if(wrapRef.current&&!wrapRef.current.contains(e.target))setOpen(false);};
    document.addEventListener('mousedown',handler);
    return()=>document.removeEventListener('mousedown',handler);
  },[open]);
  const close=()=>setOpen(false);
  const roleLabel=ROLE_LABELS[userRole]||'Viewer';
  return(
    <div className="action-menu-wrap" ref={wrapRef}>
      {/* Combined user + menu trigger */}
      <button className={`action-menu-btn${open?' open':''}`}
        onClick={()=>setOpen(o=>!o)}
        style={{width:'auto',padding:'0 10px',gap:'7px',fontWeight:400,fontSize:'.76rem',letterSpacing:0,whiteSpace:'nowrap'}}
        title={userEmail||'Actions'}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{flexShrink:0,opacity:.8}}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
        {userName&&<span>{userName}</span>}
        {userName&&<span style={{fontSize:'.6rem',padding:'1px 6px',borderRadius:'4px',background:'rgba(255,255,255,.22)',fontWeight:700,letterSpacing:'.04em',flexShrink:0}}>{roleLabel}</span>}
        {!userName&&<span>⋯</span>}
      </button>
      {open&&(
        <div className="action-menu-dropdown">
          {/* User identity header */}
          {userEmail&&(
            <div style={{padding:'8px 12px 6px',borderBottom:'1px solid var(--border)',marginBottom:4}}>
              <div style={{fontSize:'.78rem',fontWeight:600,color:'var(--text-1)',marginBottom:2}}>{userName||userEmail}</div>
              <div style={{fontSize:'.7rem',color:'var(--text-3)'}}>{userEmail}</div>
            </div>
          )}
          {isAdmin&&<button className="action-menu-item" onClick={()=>{close();onAddProject();}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Project
          </button>}
          <div className="action-menu-sep"/>
          <button className="action-menu-item" onClick={()=>{close();onSnapshots();}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
            Snapshots
          </button>
          {isRealAdmin&&<><div className="action-menu-sep"/>
          <button className="action-menu-item" onClick={()=>{close();onWorkday();}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6"/><path d="M16 11l2 2 4-4"/></svg>
            Import Org Chart
          </button>
          <button className="action-menu-item" onClick={()=>{close();onBaselineEmails();}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/></svg>
            Send Baseline Emails
          </button>
          <button className="action-menu-item" onClick={()=>{close();onDataFiles();}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v4c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 9v4c0 1.66 4.03 3 9 3s9-1.34 9-3V9"/><path d="M3 13v4c0 1.66 4.03 3 9 3s9-1.34 9-3v-4"/></svg>
            Manage Data Sources
          </button>
          <button className="action-menu-item" onClick={()=>{close();onManageUsers();}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/><circle cx="19" cy="8" r="2"/><path d="M22 13h-6m3-3v6"/></svg>
            Manage Users
          </button>
          <button className="action-menu-item" onClick={()=>{close();onManageEngineers();}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/></svg>
            Manage Engineers
          </button>
          <div className="action-menu-sep"/>
          <div style={{padding:'4px 12px 2px',fontSize:'.7rem',fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.06em'}}>Test as role</div>
          {['pm','fm'].map(r=>{
            const active=testRole===r;
            const label=r==='pm'?'Program Manager':'Functional Manager';
            return(
              <button key={r} className="action-menu-item"
                onClick={()=>{onTestRole(active?null:r);close();}}
                style={{color:active?'#1D4ED8':'var(--text-1)'}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{color:active?'#3B82F6':'currentColor'}}>
                  {active
                    ?<><polyline points="20 6 9 17 4 12"/></>
                    :<><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></>}
                </svg>
                {label}
              </button>
            );
          })}</>}
        </div>
      )}
    </div>
  );
}
