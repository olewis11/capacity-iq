import {ViewCtx} from '../context.js';

/* SummaryCell — the aggregate heatmap cell used for sg/ssg/sssg/leaf summary rows.
   Renders a single month column in the discipline swimlane for parent-tier rows
   (subgroup, subsubgroup, subsubsubgroup). These rows show italic aggregated
   supply/demand numbers rather than the full SwimCell bar+gap UI.
   Props editMode, heatmapMax, today are read from ViewCtx when not passed explicitly. */
export function SummaryCell({month,today:todayProp,demand,supply,editMode:editModeProp,heatmapMax:heatmapMaxProp,onClick}){
  const ctx=React.useContext(ViewCtx)||{};
  const editMode=editModeProp!==undefined?editModeProp:ctx.editMode;
  const heatmapMax=heatmapMaxProp!==undefined?heatmapMaxProp:(ctx.showHeatmap&&editMode==='demand'?ctx.discHeatmapMax:0);
  const today=todayProp!==undefined?todayProp:ctx.TODAY;
  const heat=editMode==='demand'&&heatmapMax>0?Math.min(demand/heatmapMax,1):0;
  return(
    <div
      className={`disc-subgroup-cell${month===today?' is-current':''}`}
      style={heat>0?{background:`rgba(239,68,68,${heat.toFixed(2)})`}:undefined}
      onClick={onClick}>
      {editMode==='demand'
        ?(demand>0&&<span style={{color:heat>0.55?'#fff':'var(--text-2)',fontSize:'.8rem',fontStyle:'italic'}}>{demand%1===0?demand.toFixed(0):demand.toFixed(1)}</span>)
        :((supply>0||demand>0)&&<span style={{color:'var(--text-2)',fontSize:'.8rem',fontStyle:'italic'}}>{supply.toFixed(1)}</span>)
      }
    </div>
  );
}
