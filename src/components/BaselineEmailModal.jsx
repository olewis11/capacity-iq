const {useState,useMemo}=React;
import {fmtMonthShort,fmtMonthLong,currentMonth} from '../utils/months.js';

function activeAssignments(assignments,projects,engId,month){
  return (assignments||[])
    .filter(a=>a.engineerId===engId&&a.startMonth<=month&&a.endMonth>=month)
    .map(a=>({...a,project:(projects||[]).find(p=>p.id===a.projectId)}));
}

function buildEmailBody(userEmail,engineers,assignments,projects,month,senderName){
  const local=userEmail.split('@')[0];
  const firstName=(local.split('.')?.[0]||local).replace(/[^a-zA-Z]/g,'');
  const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
  let body=`Hi ${cap(firstName)},\n\n`;
  body+=`Before we launch the monthly assignment review in Google Chat, I want to make sure CapacityIQ has the right baseline for your team.\n\n`;
  body+=`Please review the ${fmtMonthLong(month)} assignments below and reply with any corrections. Once everyone has confirmed we'll enable the monthly review.\n\n`;
  for(const eng of engineers){
    body+=`${eng.name}\n`;
    const aa=activeAssignments(assignments,projects,eng.id,month);
    if(!aa.length){
      body+=`  (no current assignments)\n`;
    }else{
      for(const a of aa){
        const proj=a.project?.name||'(unknown project)';
        body+=`  • ${proj} — ${a.allocation}% — ${fmtMonthShort(a.startMonth)} to ${fmtMonthShort(a.endMonth)}\n`;
      }
    }
    body+='\n';
  }
  body+=`Reply "Looks good" to confirm, or let me know what needs to change.\n\nThanks,\n${senderName||'Oliver'}`;
  return body;
}

export function BaselineEmailModal({onClose,engineers=[],assignments=[],projects=[],senderName='Oliver',userRegistry=[]}){
  const [expanded,setExpanded]=useState(new Set());
  const month=useMemo(()=>currentMonth(),[]);

  React.useEffect(()=>{
    const h=e=>{if(e.key==='Escape')onClose();};
    document.addEventListener('keydown',h);
    return()=>document.removeEventListener('keydown',h);
  },[onClose]);

  const fmUsers=useMemo(()=>
    (userRegistry||[]).filter(u=>u.role==='fm'&&(u.managedDiscs||[]).length>0)
      .sort((a,b)=>(a.name||a.email).localeCompare(b.name||b.email))
  ,[userRegistry]);

  function getEngineersForUser(user){
    return engineers.filter(e=>!e.inactive&&(user.managedDiscs||[]).includes(e.discipline));
  }

  const coveredDiscs=useMemo(()=>new Set(fmUsers.flatMap(u=>u.managedDiscs||[])),[fmUsers]);
  const uncovered=useMemo(()=>engineers.filter(e=>!e.inactive&&!coveredDiscs.has(e.discipline)),[engineers,coveredDiscs]);

  const subject=`CapacityIQ — Please review your team's current assignments (${fmtMonthLong(month)})`;

  function mailtoHref(user){
    const engs=getEngineersForUser(user);
    const body=buildEmailBody(user.email,engs,assignments,projects,month,senderName);
    return`mailto:${user.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function copyAll(){
    const lines=fmUsers.map(user=>{
      const engs=getEngineersForUser(user);
      const body=buildEmailBody(user.email,engs,assignments,projects,month,senderName);
      return`TO: ${user.email}\nSUBJECT: ${subject}\n\n${body}\n\n${'─'.repeat(60)}`;
    });
    navigator.clipboard.writeText(lines.join('\n\n')).catch(()=>{});
  }

  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-modal"
        style={{width:'min(700px,96vw)',maxHeight:'88vh',overflow:'hidden',display:'flex',flexDirection:'column',padding:'20px 24px'}}
        onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px',flexShrink:0}}>
          <h2 style={{margin:0,fontSize:'1rem',fontWeight:700}}>Send Baseline Emails</h2>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',fontSize:'1.2rem',color:'var(--text-2)',lineHeight:1,padding:'2px 6px'}}>✕</button>
        </div>

        {/* Summary bar */}
        <div style={{fontSize:'.8rem',color:'var(--text-2)',marginBottom:'12px',flexShrink:0,display:'flex',gap:'16px',alignItems:'center'}}>
          <span><strong style={{color:'var(--text-1)'}}>{fmUsers.length}</strong> managers</span>
          <span><strong style={{color:'var(--text-1)'}}>{engineers.filter(e=>!e.inactive&&coveredDiscs.has(e.discipline)).length}</strong> engineers covered</span>
          {uncovered.length>0&&(
            <span style={{color:'#B45309',fontWeight:500}}>⚠ {uncovered.length} not covered by any FM</span>
          )}
          <div style={{flex:1}}/>
          {fmUsers.length>0&&(
            <button onClick={copyAll}
              style={{fontSize:'.75rem',padding:'3px 10px',borderRadius:'5px',border:'1px solid var(--border)',background:'none',color:'var(--text-2)',cursor:'pointer',flexShrink:0}}>
              Copy all drafts
            </button>
          )}
        </div>

        {/* Intro blurb */}
        <div style={{fontSize:'.81rem',color:'var(--text-2)',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'8px',padding:'10px 14px',marginBottom:'12px',flexShrink:0,lineHeight:1.5}}>
          Each email asks the manager to review their team's <strong>{fmtMonthLong(month)}</strong> assignments and reply with corrections. Click <em>Open email</em> to open a pre-filled draft in your mail client.
        </div>

        {/* FM user list */}
        <div style={{overflowY:'auto',flex:1,display:'flex',flexDirection:'column',gap:'6px'}}>
          {fmUsers.length===0&&(
            <div style={{color:'var(--text-3)',fontStyle:'italic',fontSize:'.85rem',padding:'20px 0',textAlign:'center'}}>
              No FM users have disciplines assigned. Run Import Org Chart to populate manager assignments.
            </div>
          )}
          {fmUsers.map(user=>{
            const engs=getEngineersForUser(user);
            const isExpanded=expanded.has(user.email);
            const totalActive=engs.reduce((s,e)=>s+activeAssignments(assignments,projects,e.id,month).length,0);
            return(
              <div key={user.email} style={{border:'1px solid var(--border)',borderRadius:'8px',overflow:'hidden'}}>
                {/* Row header */}
                <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 12px',background:'var(--surface)',cursor:'pointer'}}
                  onClick={()=>setExpanded(s=>{const n=new Set(s);n.has(user.email)?n.delete(user.email):n.add(user.email);return n;})}>
                  <span style={{fontSize:'.7rem',color:'var(--text-3)',transition:'transform .15s',display:'inline-block',transform:isExpanded?'rotate(90deg)':'none'}}>▶</span>
                  <span style={{fontWeight:600,fontSize:'.83rem',color:'var(--text-1)',flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user.name||user.email}</span>
                  <span style={{fontSize:'.75rem',color:'var(--text-3)',flexShrink:0}}>{engs.length} {engs.length===1?'engineer':'engineers'} · {totalActive} active {totalActive===1?'assignment':'assignments'}</span>
                  <a href={mailtoHref(user)}
                    onClick={e=>e.stopPropagation()}
                    style={{fontSize:'.75rem',padding:'3px 10px',borderRadius:'5px',border:'1px solid #3B82F6',background:'#EFF6FF',color:'#1D4ED8',cursor:'pointer',textDecoration:'none',flexShrink:0,fontWeight:500}}>
                    Open email
                  </a>
                </div>
                {/* Expanded preview */}
                {isExpanded&&(
                  <div style={{padding:'10px 14px',borderTop:'1px solid var(--border)',display:'flex',flexDirection:'column',gap:'8px'}}>
                    {engs.length===0&&(
                      <div style={{fontSize:'.78rem',color:'var(--text-3)',fontStyle:'italic'}}>No active engineers in managed disciplines.</div>
                    )}
                    {engs.map(eng=>{
                      const aa=activeAssignments(assignments,projects,eng.id,month);
                      return(
                        <div key={eng.id}>
                          <div style={{fontSize:'.82rem',fontWeight:600,color:'var(--text-1)',marginBottom:'2px'}}>{eng.name}</div>
                          {aa.length===0?(
                            <div style={{fontSize:'.78rem',color:'var(--text-3)',fontStyle:'italic',paddingLeft:'12px'}}>No current assignments</div>
                          ):(
                            aa.map(a=>(
                              <div key={a.id} style={{fontSize:'.78rem',color:'var(--text-2)',paddingLeft:'12px',lineHeight:1.6}}>
                                {a.project?.name||'(unknown)'} — {a.allocation}% — {fmtMonthShort(a.startMonth)} to {fmtMonthShort(a.endMonth)}
                              </div>
                            ))
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Engineers not covered by any FM */}
          {uncovered.length>0&&(()=>{
            const uncoveredDiscs=[...new Set(uncovered.map(e=>e.discipline))];
            return(
              <div style={{marginTop:'8px',padding:'10px 14px',background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:'8px',fontSize:'.8rem',color:'#92400E'}}>
                <strong>{uncovered.length} {uncovered.length===1?'engineer':'engineers'} in {uncoveredDiscs.length} {uncoveredDiscs.length===1?'discipline':'disciplines'} not covered by any FM</strong> — run Import Org Chart to assign managers.
              </div>
            );
          })()}
        </div>

        <div style={{marginTop:'14px',paddingTop:'12px',borderTop:'1px solid var(--border)',display:'flex',justifyContent:'flex-end',flexShrink:0}}>
          <button onClick={onClose}
            style={{padding:'6px 18px',borderRadius:'6px',border:'1px solid var(--border)',background:'none',cursor:'pointer',fontSize:'.83rem',color:'var(--text-2)'}}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
