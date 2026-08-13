const {useState,useMemo}=React;
import {DEFAULT_DISC_META} from '../constants.js';
import {DiscCtx} from '../context.js';
import {formatRelTime} from '../utils/months.js';

const DOT_COLORS={add:'#22C55E',remove:'#EF4444',edit:'#3B82F6',info:'#94A3B8'};

export function applyLogFilters(entries,filters){
  return entries.filter(e=>{
    const msg=e.message.toLowerCase();
    if(filters.project&&!msg.includes(filters.project.toLowerCase()))return false;
    if(filters.discipline&&!e.message.includes(filters.discipline))return false;
    if(filters.resource&&!msg.includes(filters.resource.toLowerCase()))return false;
    if(filters.date){
      const d=new Date(e.timestamp);
      const em=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if(em!==filters.date)return false;
    }
    return true;
  });
}

export function LogMessage({message,type,projectColorMap,className='changelog-msg'}){
  const DISC_META=React.useContext(DiscCtx)||DEFAULT_DISC_META;
  const typeColor=DOT_COLORS[type]||DOT_COLORS.info;
  const spaceIdx=message.indexOf(' ');
  const firstWord=spaceIdx>-1?message.slice(0,spaceIdx):message;
  const rest=spaceIdx>-1?message.slice(spaceIdx):'';
  const DISC_NAMES=Object.keys(DISC_META);
  const escRe=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pattern=React.useMemo(()=>new RegExp(`(${DISC_NAMES.length?DISC_NAMES.map(escRe).join('|'):'(?!)'})|"([^"]+)"`, 'g'),[DISC_NAMES.join(',')]);
  pattern.lastIndex=0; // reset stateful lastIndex before each use
  const parts=[];
  let lastIdx=0,match;
  while((match=pattern.exec(rest))!==null){
    if(match.index>lastIdx)parts.push(<span key={`t${lastIdx}`}>{rest.slice(lastIdx,match.index)}</span>);
    if(match[1]){
      parts.push(<strong key={`d${match.index}`} style={{color:DISC_META[match[1]].color,fontWeight:600}}>{match[1]}</strong>);
    }else{
      const name=match[2];
      const color=projectColorMap?.[name];
      parts.push(<strong key={`p${match.index}`} style={{color:color||'var(--text-1)',fontWeight:600}}>"{name}"</strong>);
    }
    lastIdx=match.index+match[0].length;
  }
  if(lastIdx<rest.length)parts.push(<span key={`t${lastIdx}`}>{rest.slice(lastIdx)}</span>);
  return(
    <span className={className}>
      <strong style={{color:typeColor,fontWeight:600}}>{firstWord}</strong>
      {parts}
    </span>
  );
}

export function ChangeLogEntries({entries,allEntries,projectColorMap={}}){
  const[expandedIds,setExpandedIds]=useState(new Set());
  const[collapsedDays,setCollapsedDays]=useState(()=>{
    const now=new Date();
    const todayKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const s=new Set();
    entries.forEach(e=>{
      const d=new Date(e.timestamp);
      const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      if(key!==todayKey)s.add(key);
    });
    return s;
  });
  const toggle=id=>setExpandedIds(p=>{const s=new Set(p);s.has(id)?s.delete(id):s.add(id);return s;});
  const toggleDay=key=>setCollapsedDays(p=>{const s=new Set(p);s.has(key)?s.delete(key):s.add(key);return s;});
  // Auto-collapse any new past days that arrive (snapshot restore, new entries from a different day)
  React.useEffect(()=>{
    const now=new Date();
    const todayKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    setCollapsedDays(prev=>{
      let changed=false;const s=new Set(prev);
      entries.forEach(e=>{
        const d=new Date(e.timestamp);
        const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if(key!==todayKey&&!s.has(key)){s.add(key);changed=true;}
      });
      return changed?s:prev;
    });
  },[entries]);

  if(entries.length===0)return(
    <span className="changelog-empty">{allEntries.length===0?'No changes recorded yet':'No entries match filters'}</span>
  );

  // Group entries by calendar day key (YYYY-MM-DD local)
  const dayKeys=[];
  const dayMap={};
  entries.forEach(e=>{
    const d=new Date(e.timestamp);
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if(!dayMap[key]){dayMap[key]=[];dayKeys.push(key);}
    dayMap[key].push(e);
  });

  const formatDayLabel=key=>{
    const now=new Date();
    const todayKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const yest=new Date(now);yest.setDate(now.getDate()-1);
    const yestKey=`${yest.getFullYear()}-${String(yest.getMonth()+1).padStart(2,'0')}-${String(yest.getDate()).padStart(2,'0')}`;
    if(key===todayKey)return'Today';
    if(key===yestKey)return'Yesterday';
    const d=new Date(key+'T12:00:00');
    const diffDays=(now-d)/86400000;
    if(diffDays<7)return d.toLocaleDateString('en-US',{weekday:'long'});
    if(d.getFullYear()===now.getFullYear())return d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
    return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  };

  return dayKeys.map(dayKey=>{
    const dayEntries=dayMap[dayKey];
    const isCollapsed=collapsedDays.has(dayKey);
    return(
      <React.Fragment key={dayKey}>
        <div className="changelog-day-hdr" onClick={()=>toggleDay(dayKey)}>
          <span className="changelog-day-chevron">{isCollapsed?'▶':'▼'}</span>
          <span className="changelog-day-label">{formatDayLabel(dayKey)}</span>
          <span className="changelog-day-count">{dayEntries.length} {dayEntries.length===1?'entry':'entries'}</span>
        </div>
        {!isCollapsed&&dayEntries.map(e=>{
          const count=e.history?.length||1;
          const isExpanded=expandedIds.has(e.id);
          return(
            <React.Fragment key={e.id}>
              <div className="changelog-entry">
                <button className={`changelog-expand-btn${count>1?'':' invisible'}`}
                  style={{marginTop:1,flexShrink:0,width:24}}
                  onClick={count>1?()=>toggle(e.id):undefined}
                  tabIndex={count>1?0:-1}>
                  {count>1?(isExpanded?'▼':'▶'):' '}
                </button>
                <LogMessage message={e.message} type={e.type} projectColorMap={projectColorMap}/>
                {count>1&&<span style={{fontSize:'.7rem',color:'var(--text-3)',flexShrink:0,paddingTop:'2px'}}>{count}×</span>}
                <span className="changelog-time">{formatRelTime(e.timestamp)}</span>
              </div>
              {isExpanded&&count>1&&(
                <div className="changelog-sub-list">
                  {[...e.history].reverse().map((h,i)=>(
                    <div key={i} className="changelog-sub-entry">
                      <LogMessage message={h.message} type={e.type} projectColorMap={projectColorMap} className="changelog-sub-msg"/>
                      <span className="changelog-sub-time">{formatRelTime(h.timestamp)}</span>
                    </div>
                  ))}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </React.Fragment>
    );
  });
}

export function ChangeLog({entries,filters={},projects=[],onFilterChange,maxEntries=10}){
  const filtered=applyLogFilters(entries,filters);
  const visible=filtered.slice(0,maxEntries);
  const projectColorMap=useMemo(()=>Object.fromEntries(projects.map(p=>[p.name,p.color])),[projects]);
  return(
    <div className="changelog-wrap">
      <div className="changelog-list">
        <ChangeLogEntries entries={visible} allEntries={entries} projectColorMap={projectColorMap}/>
      </div>
    </div>
  );
}
