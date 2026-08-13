import {fmtMonthLong,fmtMonth} from '../utils/months.js';

export function Tooltip({data}){
  if(!data)return null;
  const{project,disc,month,assigned,supply,demand,x,y}=data;
  const gap=demand-supply;
  const style={
    top:y+16,left:x+10,
    transform:x>window.innerWidth-280?'translateX(-110%)':'none',
  };
  return(
    <div className="tooltip" style={style}>
      <div className="tooltip-title">{fmtMonthLong(month)} — {disc}</div>
      {assigned.length===0?(
        <div className="tooltip-empty">No engineers assigned</div>
      ):(
        <div>
          {assigned.map(({eng,assignment})=>(
            <div key={eng.id} className="tooltip-row">
              <span className="tooltip-eng">{eng.name}</span>
              <span className="tooltip-alloc">{assignment.allocation}%&nbsp;({fmtMonth(assignment.startMonth)}–{fmtMonth(assignment.endMonth)})</span>
            </div>
          ))}
        </div>
      )}
      <div className="tooltip-summary">
        {demand.toFixed(1)} − {supply.toFixed(1)} FTE = {
          gap>0.05
            ?<span style={{color:'#FCA5A5'}}>−{gap.toFixed(1)}</span>
            :gap<-0.05
              ?<span style={{color:'#86EFAC'}}>+{(-gap).toFixed(1)}</span>
              :<span style={{color:'#86EFAC'}}>✓</span>
        }
      </div>
    </div>
  );
}
