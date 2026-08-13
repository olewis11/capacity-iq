import {GROUP_META,isDirectorEng,isManagerEng} from '../constants.js';
import {leafName} from '../utils/demand.js';
import {getDemand} from '../utils/demand.js';
import {getSupply} from '../utils/supply.js';
import {roundHalf} from '../utils/demand.js';
import {ViewCtx} from '../context.js';
import {SwimCell} from './SwimCell.jsx';
import {SummaryCell} from './SummaryCell.jsx';

/* ProjectRows — renders the expanded discipline swimlane rows for a single project.
   The rowBandRef is a {current: number} object so the mutable band counter is shared
   correctly across JSX renders without triggering re-renders. */
export function ProjectRows({
  project,projIdx,months,assignments,engineers,activeMeta,
  visibleDiscs,
  discGroupOrder,discGroupMap,discSubgroupMap,discSsgMap,discSubsubgroupMap,discSgLeaves,
  expandedProjSubgroups,expandedProjSubsubgroups,expandedProjSssgs,
  toggleProjSubgroup,toggleProjSubsubgroup,toggleProjSssg,
  handleDemandCellClick,handleCellClick,handleHover,handleLeave,
  discDemandKey,discPaletteColor,
  sortByOrder,tierOrder,
}){
  const{editMode,showHeatmap,discHeatmapMax,TODAY}=React.useContext(ViewCtx)||{};
  /* O(1) engineer lookup — avoids repeated linear scan across all grid cells */
  const engById=React.useMemo(()=>new Map(engineers.map(e=>[e.id,e])),[engineers]);

  /* O(1) discipline→lead lookup — avoids per-row engineers.find scans */
  const discLeadMap=React.useMemo(()=>{
    const m=new Map();
    engineers.forEach(e=>{
      const ex=m.get(e.discipline);
      if(isDirectorEng(e))m.set(e.discipline,{name:e.name,title:'Director'});
      else if(isManagerEng(e)&&ex?.title!=='Director')m.set(e.discipline,{name:e.name,title:'Manager'});
    });
    return m;
  },[engineers]);

  // mutable row-band counter (not state — mutated per render)
  let rowBand=(projIdx+1)%2;
  const IB=12,IS=14; // base left padding, indent step (px)

  const dn=(key,parentKey)=>{const n=leafName(key),p=leafName(parentKey);return n===p?'↪ Direct':n;};

  const getRowLead=discs=>{
    if(!discs?.length)return null;
    const dir=discs.find(d=>discLeadMap.get(d)?.title==='Director');
    if(dir)return discLeadMap.get(dir);
    const mgr=discs.find(d=>discLeadMap.has(d));
    return mgr?discLeadMap.get(mgr):null;
  };

  const sgLeadDiscs=sg=>discSubgroupMap[sg]||[];
  const ssgLeadDiscs=ssg=>discSubsubgroupMap[ssg]||[];
  const leadLine=discs=>{const l=getRowLead(discs);return l?<span style={{fontSize:'.63rem',color:'var(--text-3)',lineHeight:1.2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'block',marginTop:'1px'}}>{l.name} · {l.title}</span>:null;};

  /* Demand aggregation that deduplicates shared group/subgroup demand keys — prevents
     N leaf discs that all fall back to the same key from multiplying that value N times */
  const sumDemand=(discs,m)=>{
    const seen=new Set();
    return roundHalf(discs.reduce((s,d)=>{
      const hasOwn=(project.demand||{})[d]!==undefined||project.monthlyDemand?.[d]?.[m]!==undefined;
      const k=hasOwn?d:discDemandKey(d,activeMeta);
      if(seen.has(k))return s;
      seen.add(k);
      return s+getDemand(project,d,m,activeMeta);
    },0));
  };

  return discGroupOrder.map((group)=>{
    const subgroups=discGroupMap[group]||[];
    const allGroupVisible=subgroups.flatMap(sg=>(discSubgroupMap[sg]||[]).filter(d=>visibleDiscs.includes(d)));
    if(!allGroupVisible.length)return null;
    const gm=GROUP_META[group]||GROUP_META.Other;
    return(
      <React.Fragment key={group}>
        {subgroups.map((sg)=>{
          if(sg===group)return null;
          const sgDiscs=(discSubgroupMap[sg]||[]).filter(d=>visibleDiscs.includes(d));
          if(!sgDiscs.length)return null;
          const sgColor=discPaletteColor(sgDiscs[0])||gm.color;
          const showSubgroupRow=sg!==group&&!(sgDiscs.length===1&&leafName(sgDiscs[0])===leafName(sg));
          const sgKey=`${project.id}::${sg}`;
          const sgExpanded=expandedProjSubgroups.has(sgKey);
          const thisSsgs=discSsgMap[sg]||[];
          const thisSgLeaves=(discSgLeaves[sg]||[]).filter(d=>visibleDiscs.includes(d));
          const ssgBasePad=showSubgroupRow?IB+2*IS:IB+IS;
          const ssgHeaderPad=IB+2*IS;
          return(
            <React.Fragment key={sg}>
              {showSubgroupRow&&(
                <div className={`disc-subgroup-row${rowBand++%2!==0?' row-alt':''}`} style={{'--row-accent':project.color}}>
                  <div className="disc-subgroup-label"
                    style={{borderLeft:`4px solid ${project.color}`,paddingLeft:`${IB+IS}px`}}
                    onClick={()=>toggleProjSubgroup(project.id,sg)}>
                    <span style={{fontSize:'.5rem',opacity:.5,display:'inline-block',transition:'transform .15s',transform:sgExpanded?'rotate(90deg)':'rotate(0deg)',flexShrink:0}}>›</span>
                    <div style={{display:'flex',flexDirection:'column',minWidth:0,flex:1}}>
                      <span className="disc-subgroup-name" style={{color:sgColor}}>{dn(sg,group)}</span>
                      {leadLine(sgLeadDiscs(sg))}
                    </div>
                  </div>
                  {months.map(m=>{
                    const sgDemand=sumDemand(sgDiscs,m);
                    const sgSupply=roundHalf(sgDiscs.reduce((s,d)=>s+getSupply(assignments,engById,project.id,d,m),0));
                    return(
                      <SummaryCell key={m} month={m}
                        demand={sgDemand} supply={sgSupply}
                        onClick={()=>toggleProjSubgroup(project.id,sg)}/>
                    );
                  })}
                </div>
              )}
              {(sgExpanded||!showSubgroupRow)&&(()=>{
                const rows=[];
                const leafHasSiblings=thisSsgs.length>0||thisSgLeaves.some(d=>leafName(d)!==leafName(sg));
                thisSgLeaves.forEach(disc=>{
                  const discColor=discPaletteColor(disc);
                  const leafLabel=leafHasSiblings?dn(disc,sg):leafName(disc);
                  if(!showSubgroupRow){
                    rows.push(
                      <div key={`leaf-${disc}`} className={`disc-subgroup-row${rowBand++%2!==0?' row-alt':''}`} style={{'--row-accent':project.color}}>
                        <div className="disc-subgroup-label" style={{borderLeft:`4px solid ${project.color}`,paddingLeft:`${ssgBasePad}px`}}>
                          <span style={{width:'8px',flexShrink:0}}/>
                          <div style={{display:'flex',flexDirection:'column',minWidth:0,flex:1}}>
                            <span className="disc-subgroup-name" style={{color:discColor}}>{leafLabel}</span>
                            {leadLine([disc])}
                          </div>
                        </div>
                        {months.map(m=>{
                          const demand=getDemand(project,disc,m,activeMeta);
                          const supply=getSupply(assignments,engById,project.id,disc,m);
                          const leafHeat=showHeatmap&&editMode==='demand'&&discHeatmapMax>0?Math.min(demand/discHeatmapMax,1):0;
                          return(
                            <div key={m} className={`disc-subgroup-cell${m===TODAY?' is-current':''}`}
                              style={leafHeat>0?{background:`rgba(239,68,68,${leafHeat.toFixed(2)})`}:undefined}
                              onClick={editMode==='demand'?e=>handleDemandCellClick(e,project,disc,m):undefined}
                              title={editMode==='demand'?'Click +1 FTE · Shift-click −1 FTE':undefined}>
                              {editMode==='demand'
                                ?(demand>0&&<span style={{color:leafHeat>0.55?'#fff':'var(--text-2)',fontSize:'.8rem'}}>{demand%1===0?demand.toFixed(0):demand.toFixed(1)}</span>)
                                :((supply>0||demand>0)&&<span style={{color:'var(--text-2)',fontSize:'.8rem'}}>{supply.toFixed(1)}</span>)
                              }
                            </div>
                          );
                        })}
                      </div>
                    );
                  } else {
                    rows.push(
                      <div key={`leaf-${disc}`} className={`disc-row${rowBand++%2!==0?' row-alt':''}`} style={{'--row-accent':project.color}}>
                        <div className="disc-label" style={{borderLeft:`4px solid ${project.color}`,paddingLeft:`${ssgBasePad}px`}}>
                          <div style={{display:'flex',flexDirection:'column',minWidth:0,flex:1}}>
                            <span className="disc-name" style={{color:discColor}}>{leafLabel}</span>
                            {leadLine([disc])}
                          </div>
                        </div>
                        {months.map(m=>{
                          const demand=getDemand(project,disc,m,activeMeta);
                          const supply=getSupply(assignments,engById,project.id,disc,m);
                          return(
                            <SwimCell key={m} project={project} disc={disc} month={m}
                              supply={supply} demand={demand}
                              isCurrentMonth={m===TODAY} isPast={m<TODAY}
                              onHover={editMode==='supply'?handleHover:null}
                              onLeave={editMode==='supply'?handleLeave:null}
                              onClick={editMode==='supply'?handleCellClick:null}
                              editMode={editMode} onDemandEdit={handleDemandCellClick}
                              heatmapMax={0}/>
                          );
                        })}
                      </div>
                    );
                  }
                });
                thisSsgs.forEach(ssg=>{
                  const ssgDiscs=(discSubsubgroupMap[ssg]||[]).filter(d=>visibleDiscs.includes(d));
                  if(!ssgDiscs.length)return;
                  const ssgColor=discPaletteColor(ssgDiscs[0])||sgColor;
                  const ssgKey=`${project.id}::${ssg}`;
                  const ssgExpanded=expandedProjSubsubgroups.has(ssgKey);
                  const showSsgRow=ssg!==sg&&!(ssgDiscs.length===1&&leafName(ssgDiscs[0])===leafName(ssg));
                  const teamPad=showSsgRow?IB+3*IS:ssgBasePad;
                  if(showSsgRow){
                    rows.push(
                      <div key={`ssg-${ssg}`} className={`disc-subgroup-row${rowBand++%2!==0?' row-alt':''}`} style={{'--row-accent':project.color}}>
                        <div className="disc-subgroup-label"
                          style={{borderLeft:`4px solid ${project.color}`,paddingLeft:`${ssgHeaderPad}px`}}
                          onClick={()=>toggleProjSubsubgroup(project.id,ssg)}>
                          <span style={{fontSize:'.5rem',opacity:.5,display:'inline-block',transition:'transform .15s',transform:ssgExpanded?'rotate(90deg)':'rotate(0deg)',flexShrink:0}}>›</span>
                          <div style={{display:'flex',flexDirection:'column',minWidth:0,flex:1}}>
                            <span className="disc-subgroup-name" style={{color:ssgColor}}>{dn(ssg,sg)}</span>
                            {leadLine(ssgLeadDiscs(ssg))}
                          </div>
                        </div>
                        {months.map(m=>{
                          const ssgDemand=sumDemand(ssgDiscs,m);
                          const ssgSupply=roundHalf(ssgDiscs.reduce((s,d)=>s+getSupply(assignments,engById,project.id,d,m),0));
                          return(
                            <SummaryCell key={m} month={m}
                              demand={ssgDemand} supply={ssgSupply}
                              onClick={()=>toggleProjSubsubgroup(project.id,ssg)}/>
                          );
                        })}
                      </div>
                    );
                  }
                  if(ssgExpanded||!showSsgRow){
                    const sssgBuckets={};
                    const sssgLeaves=[];
                    ssgDiscs.forEach(d=>{
                      const sssg=activeMeta[d]?.subdisc;
                      if(sssg){if(!sssgBuckets[sssg])sssgBuckets[sssg]=[];sssgBuckets[sssg].push(d);}
                      else sssgLeaves.push(d);
                    });
                    const teamInSubdiscPad=teamPad+IS;
                    const teamRow=(disc,pad,parentKey=ssg,hasSiblings=true)=>{
                      const discColor=discPaletteColor(disc);
                      return(
                        <div key={`team-${disc}`} className={`disc-row${rowBand++%2!==0?' row-alt':''}`} style={{'--row-accent':project.color}}>
                          <div className="disc-label" style={{borderLeft:`4px solid ${project.color}`,paddingLeft:`${pad}px`}}>
                            <div style={{display:'flex',flexDirection:'column',minWidth:0,flex:1}}>
                              <span className="disc-name" style={{color:discColor}}>{hasSiblings?dn(disc,parentKey):leafName(disc)}</span>
                              {leadLine([disc])}
                            </div>
                          </div>
                          {months.map(m=>{
                            const demand=getDemand(project,disc,m,activeMeta);
                            const supply=getSupply(assignments,engById,project.id,disc,m);
                            return(
                              <SwimCell key={m} project={project} disc={disc} month={m}
                                supply={supply} demand={demand}
                                isCurrentMonth={m===TODAY} isPast={m<TODAY}
                                onHover={editMode==='supply'?handleHover:null}
                                onLeave={editMode==='supply'?handleLeave:null}
                                onClick={editMode==='supply'?handleCellClick:null}
                                editMode={editMode} onDemandEdit={handleDemandCellClick}
                                heatmapMax={0}/>
                            );
                          })}
                        </div>
                      );
                    };
                    const leafTeamHasSiblings=Object.keys(sssgBuckets).length>0||sssgLeaves.some(d=>leafName(d)!==leafName(ssg));
                    sssgLeaves.forEach(disc=>rows.push(teamRow(disc,teamPad,ssg,leafTeamHasSiblings)));
                    const sortedSssgs=sortByOrder(Object.keys(sssgBuckets),(tierOrder||{}).subdiscs);
                    sortedSssgs.forEach(sssg=>{const sssgDiscs=sssgBuckets[sssg];
                      const sssgColor=discPaletteColor(sssgDiscs[0])||ssgColor;
                      const sssgKey=`${project.id}::${sssg}`;
                      const sssgExpanded=expandedProjSssgs.has(sssgKey);
                      const showSssgRow=!(sssgDiscs.length===1&&leafName(sssgDiscs[0])===leafName(sssg));
                      if(showSssgRow)rows.push(
                        <div key={`sssg-${sssg}`} className={`disc-subgroup-row${rowBand++%2!==0?' row-alt':''}`} style={{'--row-accent':project.color}}>
                          <div className="disc-subgroup-label"
                            style={{borderLeft:`4px solid ${project.color}`,paddingLeft:`${teamPad}px`}}
                            onClick={()=>toggleProjSssg(project.id,sssg)}>
                            <span style={{fontSize:'.5rem',opacity:.5,display:'inline-block',transition:'transform .15s',transform:sssgExpanded?'rotate(90deg)':'rotate(0deg)',flexShrink:0}}>›</span>
                            <div style={{display:'flex',flexDirection:'column',minWidth:0,flex:1}}>
                              <span className="disc-subgroup-name" style={{color:sssgColor}}>{dn(sssg,ssg)}</span>
                              {leadLine(sssgBuckets[sssg]||[])}
                            </div>
                          </div>
                          {months.map(m=>{
                            const sssgDemand=sumDemand(sssgDiscs,m);
                            const sssgSupply=roundHalf(sssgDiscs.reduce((s,d)=>s+getSupply(assignments,engById,project.id,d,m),0));
                            return(
                              <SummaryCell key={m} month={m}
                                demand={sssgDemand} supply={sssgSupply}
                                onClick={()=>toggleProjSssg(project.id,sssg)}/>
                            );
                          })}
                        </div>
                      );
                      if(sssgExpanded||!showSssgRow)sssgDiscs.forEach(disc=>rows.push(teamRow(disc,showSssgRow?teamInSubdiscPad:teamPad,sssg,sssgDiscs.some(d=>leafName(d)!==leafName(sssg)))));
                    });
                  }
                });
                return rows;
              })()}
            </React.Fragment>
          );
        })}
      </React.Fragment>
    );
  });
}
