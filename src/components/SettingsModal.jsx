const {useState}=React;
import {DEFAULT_DISC_META,PROJECT_COLORS,DEPT_PALETTE,blendHex} from '../constants.js';
import {DiscCtx,UserCtx} from '../context.js';
import {fmtMonth,fmtMonthLong,addMonths,monthDiff} from '../utils/months.js';
import {getDemand} from '../utils/demand.js';
import {EngBadges} from './EngBadges.jsx';

export function SettingsModal({project,onSave,onDelete,onClose,engineers=[]}){
  const DISC_META=React.useContext(DiscCtx)||DEFAULT_DISC_META;
  const DISCS=Object.keys(DISC_META);
  const{canEditProject=()=>true,canDeleteProject=true}=React.useContext(UserCtx)||{};
  const canEdit=canEditProject(project.id);
  const[form,setForm]=useState({
    ...project,
    demand:{...project.demand},
    rampUp:project.rampUp||{enabled:false,months:2},
    rampDown:project.rampDown||{enabled:false,months:2},
  });
  const[confirmDelete,setConfirmDelete]=useState(false);
  const[formError,setFormError]=useState(null);
  const[showAdvanced,setShowAdvanced]=useState(false);
  /* Pre-collapse at department level (depth 1: group/subgroup paths) */
  const[collapsedGroups,setCollapsedGroups]=useState(()=>{
    const s=new Set();
    DISCS.forEach(d=>{const m=DISC_META[d]||{};if(m.bu&&m.dept)s.add(`${m.bu}/${m.dept}`);});
    return s;
  });
  const toggleGroup=grp=>setCollapsedGroups(s=>{const n=new Set(s);n.has(grp)?n.delete(grp):n.add(grp);return n;});
  const[hoverInfo,setHoverInfo]=useState(null); // {engs}
  const hoverTimer=React.useRef(null);
  const modalRef=React.useRef(null);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const setDemand=(d,v)=>setForm(f=>({...f,demand:{...f.demand,[d]:Math.max(0,Number(v)||0)}}));
  const setColor=(c)=>setForm(f=>({...f,color:c}));
  const setRamp=(key,field,val)=>setForm(f=>({...f,[key]:{...(f[key]||{enabled:false,months:2}),[field]:val}}));

  return(
    <div className="modal-overlay" style={{alignItems:'flex-start',paddingTop:'24px'}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className="settings-modal" ref={modalRef} style={{width:'min(720px,95vw)'}}>
        <div className="modal-hdr">
          <div className="modal-title">{project._isNew?'New Project':`Edit Project — ${project.name}`}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {!canEdit&&(
            <div className="perm-notice" style={{background:'#FFF7ED',borderColor:'#FED7AA'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C2410C" strokeWidth="2.2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <span style={{color:'#C2410C'}}>View only — editing requires Program Manager access for this project</span>
            </div>
          )}
          <div className="field">
            <label>Project Name</label>
            <input value={form.name} onChange={e=>set('name',e.target.value)} disabled={!canEdit} autoFocus onFocus={e=>e.target.select()}/>
          </div>
          {/* ── Date range ── */}
          <div className="field">
            <label>Date Range</label>
            <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
              <input type="month" value={form.startMonth} onChange={e=>{set('startMonth',e.target.value);setFormError(null);}} disabled={!canEdit} style={{flex:1}}/>
              <span style={{color:'var(--text-3)',fontSize:'.85rem',flexShrink:0}}>→</span>
              <input type="month" value={form.endMonth} onChange={e=>{set('endMonth',e.target.value);setFormError(null);}} disabled={!canEdit} style={{flex:1}}/>
            </div>
            {formError&&<div style={{color:'#B91C1C',fontSize:'.78rem',marginTop:'4px'}}>{formError}</div>}
          </div>

          {/* ── Color (edit only — auto-assigned on create) ── */}
          {!project._isNew&&(
            <div className="field">
              <label>Color</label>
              <div className="color-row">
                {PROJECT_COLORS.map(c=>(
                  <div key={c} className={`color-swatch ${form.color===c?'selected':''}`}
                    style={{background:c,opacity:!canEdit?.5:1,cursor:!canEdit?'default':'pointer'}}
                    onClick={canEdit?()=>setColor(c):undefined}/>
                ))}
              </div>
            </div>
          )}

          {/* ── FTE demand tip (new project only) ── */}
          {project._isNew&&(
            <div style={{padding:'12px 14px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'8px',fontSize:'.82rem',color:'var(--text-3)',lineHeight:1.55}}>
              💡 FTE targets can be set after the project is created — open the project to edit them.
            </div>
          )}

          {/* ── Advanced options (edit only) — FTE demand + ramp, collapsed by default ── */}
          {!project._isNew&&<div className="field">
            <button type="button"
              onClick={()=>setShowAdvanced(v=>!v)}
              style={{display:'flex',alignItems:'center',gap:'6px',background:'none',border:'none',padding:0,cursor:'pointer',color:'var(--text-3)',fontSize:'.8rem',fontWeight:600,letterSpacing:'.02em'}}>
              <span style={{fontSize:'.65rem',display:'inline-block',transition:'transform .15s',transform:showAdvanced?'rotate(90deg)':'rotate(0deg)'}}>▶</span>
              Advanced options
            </button>
            {showAdvanced&&<>
            <div className="field" style={{marginTop:'12px'}}>
              <label>FTE Demand by Discipline</label>
              {hoverInfo&&(()=>{
                const engs=hoverInfo.engs;
                const cols=engs.length>16?3:engs.length>8?2:1;
                const modalRect=modalRef.current?.getBoundingClientRect()||{top:24,left:0,bottom:700,right:720,width:720,height:676};
                return(
                  <div style={{position:'fixed',left:modalRect.left,top:modalRect.bottom+8,
                    width:modalRect.width,maxHeight:'260px',overflowY:'auto',
                    zIndex:9999,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'8px',
                    boxShadow:'0 6px 20px rgba(0,0,0,.18)',padding:'10px 14px',pointerEvents:'none'}}>
                    <div style={{fontSize:'.75rem',fontWeight:700,color:'var(--text-1)',marginBottom:'6px',borderBottom:'1px solid var(--border)',paddingBottom:'4px'}}>
                      {engs.length} engineer{engs.length!==1?'s':''}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:`repeat(${cols},1fr)`,gap:'2px 8px'}}>
                      {engs.map(e=>(
                        <div key={e.id} style={{display:'flex',alignItems:'center',gap:'3px',minWidth:0,overflow:'hidden'}}>
                          <span style={{fontSize:'.79rem',color:'var(--text-1)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flexShrink:1,minWidth:0}}>{e.name}</span>
                          <EngBadges eng={e} size='.57rem'/>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              <div style={{border:'1px solid var(--border)',borderRadius:'8px',overflow:'hidden',maxHeight:'400px',overflowY:'auto'}}>
                {(()=>{
                  /* 3-tier tree: BU (group) → Department (subgroup) → Discipline (subsubgroup).
                     Controls at the Discipline leaf; demand key = subsubgroup || subgroup || group. */
                  const modalDemandKey=d=>{const m=DISC_META[d]||{};return m.discipline||m.dept||m.bu||d;};
                  const tree={};
                  DISCS.forEach(d=>{
                    const m=DISC_META[d]||{};
                    const tiers=[m.bu,m.dept,m.discipline].filter(Boolean);
                    if(!tiers.length)tiers.push('Other');
                    let node=tree;
                    tiers.forEach(t=>{node[t]=node[t]||{_keys:new Set()};node=node[t];});
                    node._keys.add(modalDemandKey(d));
                  });
                  /* ── helpers ── */
                  function allKeys(node){return[...(node._keys||new Set()),...Object.keys(node).filter(k=>k!=='_keys').flatMap(k=>allKeys(node[k]))];}
                  function allEngsForKeys(keys){return engineers.filter(e=>{const k=modalDemandKey(e.discipline);return keys.includes(k);});}
                  /* ── Palette index: assign by depth-1 (subgroup) traversal order ── */
                  const sgPaletteIdx={};
                  let _spi=0;
                  DISCS.forEach(d=>{const sg=DISC_META[d]?.subgroup;if(sg&&!(sg in sgPaletteIdx))sgPaletteIdx[sg]=_spi++%DEPT_PALETTE.length;});
                  function rowColors(depth,pIdx){
                    if(pIdx<0||depth===0){return{bg:'var(--bg)',text:'var(--text-1)',sub:'var(--text-3)',border:'var(--border)'};}
                    const p=DEPT_PALETTE[pIdx];
                    const t=Math.min(1,(depth-1)/3);
                    const bg=blendHex(p.bold,p.light,t);
                    const text=t<0.5?'#fff':p.textLight;
                    const sub=t<0.5?'rgba(255,255,255,.7)':p.textLight;
                    return{bg,text,sub,border:t<0.5?'rgba(255,255,255,.25)':p.lightBd};
                  }
                  function repPaletteIdx(node){
                    /* Walk tree to find the first subgroup-level name with a palette entry */
                    const walk=(n,nm)=>{
                      if(nm in sgPaletteIdx)return sgPaletteIdx[nm];
                      for(const k of Object.keys(n).filter(x=>x!=='_keys')){const r=walk(n[k],k);if(r>=0)return r;}
                      return-1;
                    };
                    for(const k of Object.keys(node).filter(x=>x!=='_keys')){const r=walk(node[k],k);if(r>=0)return r;}
                    return-1;
                  }
                  const GRP_ORDER=['SW','HW','SEIT','PM'];
                  function sortKeys(keys,depth){
                    if(depth===0)return keys.slice().sort((a,b)=>{
                      const ai=GRP_ORDER.indexOf(a),bi=GRP_ORDER.indexOf(b);
                      if(ai>=0&&bi>=0)return ai-bi;if(ai>=0)return-1;if(bi>=0)return 1;return a.localeCompare(b);
                    });
                    return keys.slice().sort((a,b)=>a.localeCompare(b));
                  }
                  function hoverProps(engs){
                    return{
                      onMouseEnter:()=>{
                        clearTimeout(hoverTimer.current);
                        hoverTimer.current=setTimeout(()=>setHoverInfo({engs}),220);
                      },
                      onMouseLeave:()=>{clearTimeout(hoverTimer.current);setHoverInfo(null);},
                    };
                  }
                  /* ── table header ── */
                  const COL='1fr 60px 136px';
                  const hdrRow=(
                    <div style={{display:'grid',gridTemplateColumns:COL,background:'var(--bg)',borderBottom:'2px solid var(--border)',position:'sticky',top:0,zIndex:2}}>
                      <div style={{padding:'5px 10px',fontSize:'.68rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.05em'}}>Discipline</div>
                      <div style={{padding:'5px 4px',fontSize:'.68rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.05em',textAlign:'center'}}>Engrs</div>
                      <div style={{padding:'5px 10px',fontSize:'.68rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.05em',textAlign:'center'}}>FTE Demand</div>
                    </div>
                  );
                  /* ── demand controls (reusable) ── */
                  function demandCtrl(key,isDark=false){
                    const val=form.demand[key]||0;
                    const btnColor=isDark?'rgba(255,255,255,.9)':'var(--text-2)';
                    const btnBorder=isDark?'1px solid rgba(255,255,255,.4)':'1px solid var(--border)';
                    const inputBg=isDark?'rgba(255,255,255,.15)':'var(--bg)';
                    const inputColor=isDark?'#fff':'var(--text-1)';
                    return(
                      <div onClick={e=>e.stopPropagation()} style={{display:'inline-flex',alignItems:'center',gap:'3px',justifyContent:'center'}}>
                        <button type="button" disabled={!canEdit||val===0} onClick={()=>setDemand(key,val-1)}
                          style={{width:'24px',height:'24px',borderRadius:'4px',border:btnBorder,background:'none',cursor:canEdit&&val>0?'pointer':'default',opacity:val===0?.3:1,fontSize:'1rem',lineHeight:1,display:'flex',alignItems:'center',justifyContent:'center',color:btnColor}}>−</button>
                        <input type="number" min="0" value={val} disabled={!canEdit}
                          onChange={e=>setDemand(key,e.target.value)}
                          onClick={e=>{e.stopPropagation();e.target.select();}}
                          style={{width:'40px',textAlign:'center',border:btnBorder,borderRadius:'4px',padding:'2px 4px',fontSize:'.88rem',fontWeight:700,color:inputColor,background:inputBg,outline:'none'}}/>
                        <button type="button" disabled={!canEdit} onClick={()=>setDemand(key,val+1)}
                          style={{width:'24px',height:'24px',borderRadius:'4px',border:btnBorder,background:'none',cursor:canEdit?'pointer':'default',fontSize:'1rem',lineHeight:1,display:'flex',alignItems:'center',justifyContent:'center',color:btnColor}}>+</button>
                      </div>
                    );
                  }
                  /* ── leaf row ── */
                  function renderLeaf(key,depth,showTopBorder=true,pIdx=-1,parentOrigKey=null){
                    const displayKey=parentOrigKey&&key===parentOrigKey?'↪ Direct':key;
                    const engs=allEngsForKeys([key]);
                    const rc=rowColors(depth,pIdx);
                    const isDark=pIdx>=0&&Math.min(1,(depth-1)/3)<0.5;
                    const borderCol=pIdx>=0?DEPT_PALETTE[pIdx].bold:'#CBD5E1';
                    return(
                      <div key={key} style={{display:'grid',gridTemplateColumns:COL,borderTop:showTopBorder?`1px solid ${rc.border}`:'none',background:rc.bg,borderLeft:`3px solid ${borderCol}`}} {...hoverProps(engs)}>
                        <div style={{padding:'5px 8px 5px '+(6+depth*14)+'px',display:'flex',alignItems:'center',gap:'6px',minWidth:0}}>
                          <span style={{width:'6px',height:'6px',borderRadius:'50%',background:isDark?'rgba(255,255,255,.7)':borderCol,flexShrink:0}}/>
                          <span style={{fontSize:'.8rem',color:rc.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{displayKey}</span>
                        </div>
                        <div style={{padding:'5px 4px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                          <span style={{fontSize:'.75rem',color:rc.sub}}>{engs.length||''}</span>
                        </div>
                        <div style={{padding:'4px 8px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                          {demandCtrl(key,isDark)}
                        </div>
                      </div>
                    );
                  }
                  /* ── header node ── */
                  function renderNode(node,name,path,depth,showTopBorder,inheritedPIdx=-1,origKey=name){
                    const childKeys=sortKeys(Object.keys(node).filter(k=>k!=='_keys'),depth);
                    const directKeys=[...(node._keys||new Set())];
                    const thisPIdx=depth===1?(sgPaletteIdx[origKey]??repPaletteIdx(node)):inheritedPIdx;
                    if(childKeys.length===0&&directKeys.length===1){return renderLeaf(directKeys[0],depth,showTopBorder,thisPIdx);}
                    const isOpen=!collapsedGroups.has(path);
                    const keys=allKeys(node);
                    const fte=keys.reduce((s,k)=>s+(form.demand[k]||0),0);
                    const engs=allEngsForKeys(keys);
                    const rc=rowColors(depth,thisPIdx);
                    const borderCol=thisPIdx>=0?DEPT_PALETTE[thisPIdx].bold:'var(--border)';
                    const mergedKey=childKeys.length>0&&directKeys.length===1?directKeys[0]:null;
                    const mergedVal=mergedKey?(form.demand[mergedKey]||0):0;
                    const isDark=thisPIdx>=0&&Math.min(1,(depth-1)/3)<0.5;
                    return(
                      <div key={path}>
                        <div style={{display:'grid',gridTemplateColumns:COL,borderTop:showTopBorder?`1px solid ${rc.border}`:'none',background:rc.bg,borderLeft:`3px solid ${borderCol}`,cursor:'pointer',userSelect:'none'}} {...hoverProps(engs)}>
                          <div style={{padding:depth===0?'7px 8px 7px 6px':'5px 8px 5px '+(6+depth*14)+'px',display:'flex',alignItems:'center',gap:'6px'}} onClick={()=>toggleGroup(path)}>
                            <span style={{fontSize:'.55rem',color:rc.sub,display:'inline-block',transition:'transform .15s',transform:isOpen?'rotate(90deg)':'rotate(0deg)',flexShrink:0}}>▶</span>
                            <span style={{fontSize:depth===0?'.82rem':'.8rem',fontWeight:depth===0?700:600,color:rc.text,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name}</span>
                          </div>
                          <div style={{padding:'5px 4px',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>toggleGroup(path)}>
                            <span style={{fontSize:'.75rem',color:rc.sub}}>{engs.length||''}</span>
                          </div>
                          <div style={{padding:'4px 8px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                            {mergedKey?demandCtrl(mergedKey,isDark):(
                              <span onClick={()=>toggleGroup(path)} style={{fontSize:'.75rem',color:fte>0?rc.text:rc.sub,fontWeight:fte>0?600:400}}>
                                {fte>0?`${fte} FTE`:'—'}
                              </span>
                            )}
                          </div>
                        </div>
                        {isOpen&&<>
                          {!mergedKey&&directKeys.map(k=>renderLeaf(k,depth+1,true,thisPIdx,origKey))}
                          {childKeys.map(k=>renderNode(node[k],k===origKey?'↪ Direct':k,`${path}/${k}`,depth+1,true,thisPIdx,k))}
                        </>}
                      </div>
                    );
                  }
                  const topKeys=sortKeys(Object.keys(tree),0);
                  return[hdrRow,...topKeys.map((k,i)=>renderNode(tree[k],k,k,0,i>0,-1))];
                })()}
              </div>
            </div>

            <div style={{marginTop:'14px'}}>
              <div style={{fontSize:'.77rem',fontWeight:600,color:'var(--text-2)',marginBottom:'8px'}}>Demand Ramp</div>
              <div className="ramp-options">
                {[['rampUp','Ramp up at start'],['rampDown','Ramp down at end']].map(([key,lbl])=>(
                  <div key={key} className="ramp-row">
                    <label className="ramp-toggle" style={!canEdit?{opacity:.55,cursor:'default'}:{}}>
                      <input type="checkbox" checked={!!form[key]?.enabled} disabled={!canEdit}
                        onChange={e=>setRamp(key,'enabled',e.target.checked)}/>
                      {lbl}{form[key]?.enabled&&<>
                        {' over '}
                        <input className="ramp-months-input" type="number" min="1" max="12"
                          disabled={!canEdit}
                          value={form[key]?.months||2}
                          onClick={e=>e.stopPropagation()}
                          onChange={e=>setRamp(key,'months',Math.max(1,parseInt(e.target.value)||1))}/>
                        {' months'}
                      </>}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            </>}
          </div>}
        </div>

        <div className="modal-footer">
          {confirmDelete?(
            <>
              <span style={{fontSize:'.88rem',color:'var(--text-2)',flex:1}}>Delete "{form.name}"?</span>
              <button className="btn btn-ghost" onClick={()=>setConfirmDelete(false)}>Keep</button>
              <button className="btn btn-danger" onClick={()=>onDelete(project.id)}>Yes, Delete</button>
            </>
          ):(
            <>
              {!project._isNew&&canDeleteProject&&<button className="btn btn-danger" onClick={()=>setConfirmDelete(true)}>Delete</button>}
              <button className="btn btn-ghost" onClick={onClose}>{canEdit?'Cancel':'Close'}</button>
              {canEdit&&<button className="btn btn-primary" onClick={()=>{
                if(form.startMonth>form.endMonth){setFormError('End month must be on or after start month');return;}
                onSave(form);
              }}>{project._isNew?'Create Project':'Save Changes'}</button>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
