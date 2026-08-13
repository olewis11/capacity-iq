import {DEFAULT_DISC_META} from '../constants.js';
import {DiscCtx} from '../context.js';
import {getDemand} from '../utils/demand.js';
import {getSupply} from '../utils/supply.js';
import {fmtMonthShort,ratioToBarColor} from '../utils/months.js';

export function DiscSparkline({project,disc,months,assignments,engineers,activeMonth}){
  const DISC_META=React.useContext(DiscCtx)||DEFAULT_DISC_META;
  const demands=months.map(m=>getDemand(project,disc,m,DISC_META));
  const maxDemand=Math.max(...demands,0.1);
  return(
    <div style={{padding:'10px 16px 10px',borderBottom:'1px solid var(--border)',background:'var(--bg)',flexShrink:0}}>
      <div style={{fontSize:'.72rem',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:'6px'}}>
        {disc} staffing · 12-month view
      </div>
      <div style={{display:'flex',gap:'2px',alignItems:'flex-end',height:'52px'}}>
        {months.map((m,i)=>{
          const d=demands[i];
          const s=getSupply(assignments,engineers,project.id,disc,m);
          const isActive=m===activeMonth;
          const demandH=d>0?(d/maxDemand)*100:0;
          const supplyH=d>0?Math.min(s/maxDemand,1.25)*100:0;
          const barColor=d>0?ratioToBarColor(s/d):'var(--border)';
          return(
            <div key={m} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'stretch',gap:'2px'}}>
              <div style={{height:'42px',position:'relative'}}>
                {d>0&&<div style={{
                  position:'absolute',bottom:0,left:0,right:0,
                  height:`${demandH}%`,
                  background:'rgba(0,0,0,0.07)',borderRadius:'2px 2px 0 0',
                }}/>}
                {d>0&&<div style={{
                  position:'absolute',bottom:0,left:0,right:0,
                  height:`${supplyH}%`,
                  background:barColor,opacity:0.75,borderRadius:'2px 2px 0 0',
                }}/>}
                {isActive&&<div style={{
                  position:'absolute',inset:0,
                  border:'2px solid var(--primary)',borderRadius:'2px',
                  pointerEvents:'none',
                }}/>}
              </div>
              <div style={{fontSize:'.53rem',color:isActive?'var(--primary)':'var(--text-3)',fontWeight:isActive?700:400,textAlign:'center',lineHeight:1,whiteSpace:'nowrap',overflow:'hidden'}}>
                {fmtMonthShort(m)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
