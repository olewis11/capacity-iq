const {useState}=React;

export function TierOrderModal({discMeta,tierOrder,onSave,onClose}){
  const TIERS=[
    {key:'bus',label:'BU',full:'Business Unit'},
    {key:'depts',label:'Dept',full:'Department'},
    {key:'disciplines',label:'Disc',full:'Discipline'},
    {key:'subdiscs',label:'Subdisc',full:'Subdiscipline'},
  ];
  const discovered=React.useMemo(()=>{
    const r={bus:[],depts:[],disciplines:[],subdiscs:[]};
    Object.values(discMeta||{}).forEach(m=>{
      const g=m.bu||'Other',sg=m.dept||g,ssg=m.discipline,sssg=m.subdisc;
      if(!r.bus.includes(g))r.bus.push(g);
      if(!r.depts.includes(sg))r.depts.push(sg);
      if(ssg&&!r.disciplines.includes(ssg))r.disciplines.push(ssg);
      if(sssg&&!r.subdiscs.includes(sssg))r.subdiscs.push(sssg);
    });
    return r;
  },[discMeta]);
  const merge=(saved,disc)=>{const res=(saved||[]).filter(s=>disc.includes(s));disc.forEach(d=>{if(!res.includes(d))res.push(d);});return res;};
  const[local,setLocal]=useState(()=>({
    bus:merge(tierOrder?.bus,discovered.bus),
    depts:merge(tierOrder?.depts,discovered.depts),
    disciplines:merge(tierOrder?.disciplines,discovered.disciplines),
    subdiscs:merge(tierOrder?.subdiscs,discovered.subdiscs),
  }));
  const[drag,setDrag]=useState(null);
  const[dragOver,setDragOver]=useState(null);
  function drop(tier,toIdx){
    if(!drag||drag.tier!==tier)return;
    const arr=[...local[tier]];const[item]=arr.splice(drag.idx,1);arr.splice(toIdx,0,item);
    setLocal(p=>({...p,[tier]:arr}));setDrag(null);setDragOver(null);
  }
  return(
    <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className="settings-modal" style={{width:'min(520px,95vw)'}}>
        <div className="modal-hdr">
          <div className="modal-title">Tier Order</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p style={{fontSize:'.82rem',color:'var(--text-2)',margin:0}}>Drag items within each tier to set their global display order across all views.</p>
          {TIERS.map(({key,label,full})=>(
            <div key={key} className="field">
              <label>{label} <span style={{fontWeight:400,color:'var(--text-3)'}}>— {full}</span></label>
              {local[key].length===0
                ?<div style={{fontSize:'.8rem',color:'var(--text-3)',padding:'8px 12px',border:'1px solid var(--border)',borderRadius:'8px'}}>No {full} nodes in current data</div>
                :<div style={{border:'1px solid var(--border)',borderRadius:'8px',overflow:'hidden'}}>
                  {local[key].map((item,idx)=>(
                    <div key={item} draggable
                      onDragStart={()=>setDrag({tier:key,idx})}
                      onDragOver={e=>{e.preventDefault();setDragOver({tier:key,idx});}}
                      onDrop={()=>drop(key,idx)}
                      onDragEnd={()=>{setDrag(null);setDragOver(null);}}
                      style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 12px',
                        borderBottom:idx<local[key].length-1?'1px solid var(--border)':'none',
                        background:dragOver?.tier===key&&dragOver?.idx===idx?'var(--bg)':'var(--surface)',
                        cursor:'grab',userSelect:'none',transition:'background .1s'}}>
                      <span style={{color:'var(--text-3)',fontSize:'1rem',lineHeight:1}}>⠿</span>
                      <span style={{fontSize:'.85rem',color:'var(--text-1)'}}>{item}</span>
                    </div>
                  ))}
                </div>
              }
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={()=>onSave(local)}>Save Order</button>
        </div>
      </div>
    </div>
  );
}
