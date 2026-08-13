const {useState,useRef}=React;
import {EngBadges} from './EngBadges.jsx';

export function AssignmentBarRow({eng,assignment,months,isNew,onRemove,onExtend,onMoveStart,onChangeAlloc,readOnly=false}){
  const containerRef=useRef(null);
  const[previewEnd,setPreviewEnd]=useState(null);
  const[previewStart,setPreviewStart]=useState(null);
  const previewEndRef=useRef(null);
  const previewStartRef=useRef(null);

  const totalMonths=months.length;
  const displayStart=previewStart||assignment.startMonth;
  const displayEnd=previewEnd||assignment.endMonth;
  const startIdx=months.findIndex(m=>m>=displayStart);
  const effectiveStart=startIdx<0?0:startIdx;
  const endIdxExcl=months.findIndex(m=>m>displayEnd);
  const effectiveEnd=endIdxExcl<0?totalMonths:endIdxExcl;
  const leftPct=(effectiveStart/totalMonths)*100;
  const widthPct=Math.max((effectiveEnd-effectiveStart)/totalMonths*100,100/totalMonths);
  const dragging=!!(previewEnd||previewStart);

  /* ── Right handle: change end date ────────────────────────── */
  const handleResizeDown=(e)=>{
    e.stopPropagation();e.preventDefault();
    const container=containerRef.current;if(!container)return;
    const rect=container.getBoundingClientRect();
    const move=(e)=>{
      const relX=Math.max(0,Math.min(e.clientX-rect.left,rect.width));
      const idx=Math.min(Math.floor((relX/rect.width)*totalMonths),totalMonths-1);
      const clamped=Math.max(effectiveStart,idx);
      previewEndRef.current=months[clamped];setPreviewEnd(months[clamped]);
    };
    const up=()=>{
      if(previewEndRef.current)onExtend(previewEndRef.current);
      previewEndRef.current=null;setPreviewEnd(null);
      document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);
    };
    document.addEventListener('mousemove',move);document.addEventListener('mouseup',up);
  };

  /* ── Left handle: change start date ───────────────────────── */
  const handleResizeStartDown=(e)=>{
    e.stopPropagation();e.preventDefault();
    const container=containerRef.current;if(!container)return;
    const rect=container.getBoundingClientRect();
    const move=(e)=>{
      const relX=Math.max(0,Math.min(e.clientX-rect.left,rect.width));
      const idx=Math.min(Math.floor((relX/rect.width)*totalMonths),totalMonths-1);
      const clamped=Math.min(idx,effectiveEnd-1); // can't cross end
      previewStartRef.current=months[clamped];setPreviewStart(months[clamped]);
    };
    const up=()=>{
      if(previewStartRef.current)onMoveStart(previewStartRef.current);
      previewStartRef.current=null;setPreviewStart(null);
      document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);
    };
    document.addEventListener('mousemove',move);document.addEventListener('mouseup',up);
  };

  return(
    <div style={{display:'flex',alignItems:'center',gap:'8px',padding:'4px 0'}}>
      {/* Name — fixed width, truncates */}
      <div style={{width:'130px',flexShrink:0,display:'flex',alignItems:'center',gap:'3px',overflow:'hidden'}}>
        <span style={{fontSize:'.82rem',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',minWidth:0}}>
          {eng.name}
        </span>
        <EngBadges eng={eng} size=".6rem"/>
      </div>
      {/* Alloc cycling pill — between name and bar */}
      <button
        onClick={e=>{e.stopPropagation();if(!readOnly)onChangeAlloc();}}
        title={readOnly?'View only':'Click to cycle allocation'}
        disabled={readOnly}
        style={{flexShrink:0,width:'46px',padding:'2px 0',fontSize:'.68rem',fontWeight:700,
          background:isNew?'#DCFCE7':'#DBEAFE',color:isNew?'#15803D':'#1D4ED8',
          border:'none',borderRadius:'3px',cursor:readOnly?'default':'pointer',textAlign:'center',opacity:readOnly?.6:1}}
      >{assignment.allocation}%</button>
      {/* Duration bar */}
      <div ref={containerRef} style={{flex:1,height:'22px',position:'relative',background:'var(--bg)',borderRadius:'3px',overflow:'hidden'}}>
        {months.map((_,i)=>(
          <div key={i} style={{position:'absolute',top:0,bottom:0,left:`${(i/totalMonths)*100}%`,width:'1px',background:'var(--border)',pointerEvents:'none'}}/>
        ))}
        <div style={{
          position:'absolute',top:'3px',bottom:'3px',
          left:`${leftPct}%`,width:`${widthPct}%`,
          background:isNew?'#10B981':'#3B82F6',
          borderRadius:'3px',opacity:dragging?0.65:1,
        }}>
          {/* Left handle — drag to move start date */}
          {!readOnly&&<div onMouseDown={handleResizeStartDown} style={{
            position:'absolute',left:0,top:0,bottom:0,width:'8px',
            cursor:'ew-resize',background:'rgba(255,255,255,0.35)',
            borderRadius:'3px 0 0 3px',
          }}/>}
          {/* Right handle — drag to move end date */}
          {!readOnly&&<div onMouseDown={handleResizeDown} style={{
            position:'absolute',right:0,top:0,bottom:0,width:'8px',
            cursor:'ew-resize',background:'rgba(255,255,255,0.35)',
            borderRadius:'0 3px 3px 0',
          }}/>}
        </div>
      </div>
      {!readOnly&&<button className="existing-remove" onClick={onRemove} title="Remove" style={{flexShrink:0}}>×</button>}
      {readOnly&&<div style={{width:22,flexShrink:0}}/>}
    </div>
  );
}
