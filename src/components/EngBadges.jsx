import {isDirectorEng,isManagerEng} from '../constants.js';

export function EngBadges({eng,size='.65rem'}){
  const isDir=isDirectorEng(eng);
  const isMgr=isManagerEng(eng);
  return(<>
    {isDir&&<span style={{fontSize:size,background:'#FEE2E2',color:'#991B1B',padding:'1px 5px',borderRadius:'3px',fontWeight:700,lineHeight:1.4,flexShrink:0}}>D</span>}
    {!isDir&&isMgr&&<span style={{fontSize:size,background:'#EDE9FE',color:'#4C1D95',padding:'1px 5px',borderRadius:'3px',fontWeight:700,lineHeight:1.4,flexShrink:0}}>M</span>}
    {eng.isContractor&&<span style={{fontSize:size,background:'#FEF3C7',color:'#92400E',padding:'1px 5px',borderRadius:'3px',fontWeight:700,lineHeight:1.4,flexShrink:0}}>C</span>}
  </>);
}
