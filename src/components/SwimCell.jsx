import {ratioToBarColor} from '../utils/months.js';

export function SwimCell({project,disc,month,supply,demand,isCurrentMonth,isPast=false,onHover,onLeave,onClick,editMode,onDemandEdit,heatmapMax=0}){
  const inactive=demand===0;
  const ratio=demand>0?supply/demand:0;
  const fillPct=Math.min(ratio,1)*100;
  const barColor=ratioToBarColor(ratio);
  const gapColor=ratio>=1.05?'#15803D':ratio>=1?'#1D4ED8':ratio>=.7?'#92400E':'#B91C1C';
  const gapText=supply<demand?`−${(demand-supply).toFixed(1)}`:supply>demand*1.05?`+${(supply-demand).toFixed(1)}`:'✓';
  const pastCls=isPast&&!isCurrentMonth?' is-past':'';
  const cls='swim-cell'+(inactive?' inactive':'')+(isCurrentMonth?' is-current':'')+pastCls;
  if(editMode==='demand'){
    const inRange=month>=project.startMonth&&month<=project.endMonth;
    /* Out-of-range cells are inactive and unclickable */
    if(!inRange){
      const dmCls='swim-cell inactive'+(isCurrentMonth?' is-current':'')+pastCls+' demand-mode';
      return<div className={dmCls} style={{'--dm-heat':'transparent'}}/>;
    }
    /* All in-range cells are clickable — even if demand is currently 0 */
    const dmCls='swim-cell'+(isCurrentMonth?' is-current':'')+pastCls+' demand-mode';
    const intensity=heatmapMax>0?Math.min(demand/heatmapMax,1):0;
    const heatBg=`rgba(239,68,68,${intensity.toFixed(2)})`;
    const useDarkText=intensity<0.55;
    return(
      <div className={dmCls}
        style={{'--dm-heat':demand>0?heatBg:'transparent','--dm-text':useDarkText?'var(--text-1)':'#fff'}}
        onClick={e=>{onDemandEdit&&onDemandEdit(e,project,disc,month);}}
        title="Click +1 FTE · Shift-click −1 FTE">
        {demand>0&&<span className="dm-value">{demand%1===0?demand.toFixed(0):demand.toFixed(1)}</span>}
      </div>
    );
  }
  if(inactive){return <div className={cls}/>;}
  return(
    <div
      className={cls}
      onMouseEnter={onHover?e=>onHover(e,project,disc,month):undefined}
      onMouseLeave={onLeave||undefined}
      onClick={onClick?()=>onClick(project,disc,month):undefined}
    >
      <span className="cell-gap-text" style={{color:gapColor}}>{gapText}</span>
      <div className="cell-bar-track">
        {barColor&&<div className="cell-bar-fill" style={{width:`${fillPct}%`,background:barColor,opacity:0.8}}/>}
      </div>
    </div>
  );
}
