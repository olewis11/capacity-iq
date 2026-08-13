const {useState}=React;
import {SUPERADMIN_EMAIL,ROLE_LABELS} from '../constants.js';

export function UserRegistryModal({projects,onClose,userRegistry,setUserRegistry,currentEmail}){
  const[newEmail,setNewEmail]=useState('');
  const[newName,setNewName]=useState('');
  const[newRole,setNewRole]=useState('fm');
  const[newProjects,setNewProjects]=useState([]);
  const[err,setErr]=useState('');

  const addUser=()=>{
    const email=newEmail.trim().toLowerCase();
    if(!email){setErr('Email is required');return;}
    if(!email.includes('@')){setErr('Enter a valid email address');return;}
    if(email===SUPERADMIN_EMAIL){setErr('That account is already the superadmin');return;}
    if(userRegistry.find(u=>u.email===email)){setErr('User already exists');return;}
    setUserRegistry(prev=>[...prev,{email,name:newName.trim()||email.split('@')[0],role:newRole,projects:newRole==='pm'?newProjects:[]}]);
    setNewEmail('');setNewName('');setNewRole('fm');setNewProjects([]);setErr('');
  };
  const removeUser=email=>setUserRegistry(prev=>prev.filter(u=>u.email!==email));
  const updateRole=(email,role)=>setUserRegistry(prev=>prev.map(u=>u.email===email?{...u,role,projects:role==='pm'?u.projects:[]}:u));
  const toggleProject=(email,pid)=>setUserRegistry(prev=>prev.map(u=>{
    if(u.email!==email)return u;
    const ps=u.projects||[];
    return{...u,projects:ps.includes(pid)?ps.filter(p=>p!==pid):[...ps,pid]};
  }));

  return(
    <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="settings-modal" style={{maxWidth:700,width:'94vw',maxHeight:'84vh',display:'flex',flexDirection:'column'}}>
        <div className="modal-hdr">
          <div className="modal-title">Manage Users</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{overflow:'auto',flex:1}}>

          {/* Current superadmin */}
          <div style={{marginBottom:18,padding:'10px 14px',background:'var(--bg)',borderRadius:8,border:'1px solid var(--border)',fontSize:'.82rem'}}>
            <div style={{fontWeight:700,marginBottom:4,fontSize:'.75rem',textTransform:'uppercase',letterSpacing:'.04em',color:'var(--text-3)'}}>Your account</div>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{color:'var(--text-1)',fontWeight:500}}>{currentEmail||'—'}</span>
              <span className="role-badge admin">Admin</span>
            </div>
          </div>

          {/* User table */}
          {userRegistry.length>0?(
            <table className="user-table" style={{marginBottom:20}}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Scope</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {userRegistry.map(u=>(
                  <tr key={u.email}>
                    <td>
                      <div style={{fontWeight:500,color:'var(--text-1)'}}>{u.name||u.email}</div>
                      {u.name&&<div style={{fontSize:'.7rem',color:'var(--text-3)'}}>{u.email}</div>}
                    </td>
                    <td style={{whiteSpace:'nowrap'}}>
                      <select style={{fontSize:'.78rem',padding:'3px 6px',borderRadius:4,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--text-1)'}}
                        value={u.role} onChange={e=>updateRole(u.email,e.target.value)}>
                        <option value="admin">Admin</option>
                        <option value="pm">Program Manager</option>
                        <option value="fm">Functional Manager</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </td>
                    <td style={{maxWidth:220}}>
                      {u.role==='pm'?(
                        <div style={{display:'flex',flexWrap:'wrap',gap:'4px 10px'}}>
                          {projects.map(p=>(
                            <label key={p.id} style={{display:'flex',alignItems:'center',gap:3,fontSize:'.75rem',cursor:'pointer',whiteSpace:'nowrap'}}>
                              <input type="checkbox" style={{margin:0,cursor:'pointer'}}
                                checked={(u.projects||[]).includes(p.id)}
                                onChange={()=>toggleProject(u.email,p.id)}/>
                              <span style={{color:'var(--text-2)'}}>{p.name}</span>
                            </label>
                          ))}
                          {projects.length===0&&<span style={{color:'var(--text-3)',fontSize:'.72rem',fontStyle:'italic'}}>No projects yet</span>}
                        </div>
                      ):u.role==='fm'&&(u.managedDiscs||[]).length>0?(
                        <span style={{color:'var(--text-3)',fontSize:'.78rem'}}>{u.managedDiscs.length} {u.managedDiscs.length===1?'discipline':'disciplines'}</span>
                      ):<span style={{color:'var(--text-3)',fontSize:'.78rem'}}>—</span>}
                    </td>
                    <td>
                      <button onClick={()=>removeUser(u.email)}
                        style={{width:22,height:22,border:'none',background:'none',cursor:'pointer',color:'var(--text-3)',fontSize:'1rem',borderRadius:3,padding:0,lineHeight:1}}
                        title="Remove user">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ):(
            <div style={{fontSize:'.82rem',color:'var(--text-3)',fontStyle:'italic',marginBottom:18}}>No additional users yet.</div>
          )}

          {/* Add user form */}
          <div style={{borderTop:'1px solid var(--border)',paddingTop:14}}>
            <div style={{fontWeight:600,fontSize:'.82rem',color:'var(--text-1)',marginBottom:10}}>Add User</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'flex-end'}}>
              <div style={{display:'flex',flexDirection:'column',gap:3}}>
                <label style={{fontSize:'.7rem',color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'.04em'}}>Email *</label>
                <input style={{fontSize:'.82rem',padding:'5px 8px',borderRadius:5,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--text-1)',width:210}}
                  placeholder="user@example.com"
                  value={newEmail} onChange={e=>{setNewEmail(e.target.value);setErr('');}}
                  onKeyDown={e=>{if(e.key==='Enter')addUser();}}/>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:3}}>
                <label style={{fontSize:'.7rem',color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'.04em'}}>Display Name</label>
                <input style={{fontSize:'.82rem',padding:'5px 8px',borderRadius:5,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--text-1)',width:150}}
                  placeholder="Jane Smith"
                  value={newName} onChange={e=>setNewName(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter')addUser();}}/>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:3}}>
                <label style={{fontSize:'.7rem',color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'.04em'}}>Role</label>
                <select style={{fontSize:'.82rem',padding:'5px 8px',borderRadius:5,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--text-1)'}}
                  value={newRole} onChange={e=>{setNewRole(e.target.value);setNewProjects([]);}}>
                  <option value="admin">Admin</option>
                  <option value="pm">Program Manager</option>
                  <option value="fm">Functional Manager</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <button className="btn btn-primary" onClick={addUser}>Add User</button>
            </div>
            {newRole==='pm'&&projects.length>0&&(
              <div style={{marginTop:10}}>
                <label style={{fontSize:'.7rem',color:'var(--text-3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'.04em',display:'block',marginBottom:5}}>Assign to Projects</label>
                <div style={{display:'flex',flexWrap:'wrap',gap:'4px 14px'}}>
                  {projects.map(p=>(
                    <label key={p.id} style={{display:'flex',alignItems:'center',gap:4,fontSize:'.82rem',cursor:'pointer'}}>
                      <input type="checkbox" style={{margin:0,cursor:'pointer'}}
                        checked={newProjects.includes(p.id)}
                        onChange={()=>setNewProjects(prev=>prev.includes(p.id)?prev.filter(x=>x!==p.id):[...prev,p.id])}/>
                      <span style={{color:'var(--text-2)'}}>{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {err&&<div style={{color:'#B91C1C',fontSize:'.78rem',marginTop:6}}>{err}</div>}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
