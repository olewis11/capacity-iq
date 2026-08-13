const {useState,useRef}=React;
import {fmtMonth} from '../utils/months.js';

export function MasterDurationBar({uncommitted,months,onSetAll}){
  const containerRef=useRef(null);
  const[previewStart,setPreviewStart]=useState(null);
  const[previewEnd,setPreviewEnd]=useState(null);
  const previewStartRef=useRef(null);
  const previewEndRef=useRef(null);

  const totalMonths=months.length;
  const allStarts=uncommitted.map(x=>x.assignment.startMonth);
  const allEnds=uncommitted.map(x=>x.assignment.endMonth);
  const masterStart=previewStart||allStarts.reduce((a,b)=>a<b?a:b);
  const masterEnd=previewEnd||allEnds.reduce((a,b)=>a>b?a:b);

  const startIdx=months.findIndex(m=>m>=masterStart);
  const effectiveStart=startIdx<0?0:startIdx;
  const endIdxExcl=months.findIndex(m=>m>masterEnd);
  const effectiveEnd=endIdxExcl<0?totalMonths:endIdxExcl;
  const leftPct=(effectiveStart/totalMonths)*100;
  const widthPct=Math.max((effectiveEnd-effectiveStart)/totalMonths*100,100/totalMonths);
  const dragging=!!(previewStart||previewEnd);

  const handleResizeStartDown=(e)=>{
    e.stopPropagation();e.preventDefault();
    const container=containerRef.current;if(!container)return;
    const rect=container.getBoundingClientRect();
    const move=(e)=>{
      const relX=Math.max(0,Math.min(e.clientX-rect.left,rect.width));
      const idx=Math.min(Math.floor((relX/rect.width)*totalMonths),totalMonths-1);
      const clamped=Math.min(idx,effectiveEnd-1);
      previewStartRef.current=months[clamped];setPreviewStart(months[clamped]);
    };
    const up=()=>{
      if(previewStartRef.current)onSetAll(previewStartRef.current,masterEnd);
      previewStartRef.current=null;setPreviewStart(null);
      document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);
    };
    document.addEventListener('mousemove',move);document.addEventListener('mouseup',up);
  };

  const handleResizeEndDown=(e)=>{
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
      if(previewEndRef.current)onSetAll(masterStart,previewEndRef.current);
      previewEndRef.current=null;setPreviewEnd(null);
      document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);
    };
    document.addEventListener('mousemove',move);document.addEventListener('mouseup',up);
  };

  return(
    <div style={{
      padding:'8px 14px 12px',flexShrink:0,
      borderTop:'2px solid #BBF7D0',background:'rgba(16,185,129,0.06)',
    }}>
      <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'6px'}}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2.5" strokeLinecap="round"><line x1="8" y1="12" x2="16" y2="12"/><line x1="12" y1="8" x2="12" y2="16"/><rect x="3" y="3" width="18" height="18" rx="3"/></svg>
        <span style={{fontSize:'.7rem',fontWeight:700,color:'#15803D',textTransform:'uppercase',letterSpacing:'.3px'}}>
          Set duration · all {uncommitted.length} new assignments
        </span>
        <span style={{marginLeft:'auto',fontSize:'.72rem',color:'#15803D',fontWeight:500}}>
          {fmtMonth(masterStart)} – {fmtMonth(masterEnd)}
        </span>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
        <div style={{width:'130px',flexShrink:0}}/>
        <div style={{width:'46px',flexShrink:0}}/>
        <div ref={containerRef} style={{flex:1,height:'26px',position:'relative',background:'var(--bg)',borderRadius:'3px',overflow:'hidden'}}>
          {months.map((_,i)=>(
            <div key={i} style={{position:'absolute',top:0,bottom:0,left:`${(i/totalMonths)*100}%`,width:'1px',background:'var(--border)',pointerEvents:'none'}}/>
          ))}
          <div style={{
            position:'absolute',top:'3px',bottom:'3px',
            left:`${leftPct}%`,width:`${widthPct}%`,
            background:'#10B981',borderRadius:'3px',opacity:dragging?.6:1,
          }}>
            <div onMouseDown={handleResizeStartDown} style={{position:'absolute',left:0,top:0,bottom:0,width:'10px',cursor:'ew-resize',background:'rgba(255,255,255,0.4)',borderRadius:'3px 0 0 3px'}}/>
            <div onMouseDown={handleResizeEndDown} style={{position:'absolute',right:0,top:0,bottom:0,width:'10px',cursor:'ew-resize',background:'rgba(255,255,255,0.4)',borderRadius:'0 3px 3px 0'}}/>
          </div>
        </div>
        <div style={{width:'22px',flexShrink:0}}/>
      </div>
    </div>
  );
}
