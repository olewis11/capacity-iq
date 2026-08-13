/* ═══════════════════════════════════════════════════════════════
   CSV IMPORT / EXPORT
═══════════════════════════════════════════════════════════════ */
export function csvEsc(v){
  const s=String(v??'');
  return(s.includes(',')||s.includes('"')||s.includes('\n'))?`"${s.replace(/"/g,'""')}"`:`${s}`;
}
export function parseCSVLine(line){
  const out=[];let cur='',inQ=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(inQ){if(c==='"'&&line[i+1]==='"'){cur+='"';i++;}else if(c==='"'){inQ=false;}else cur+=c;}
    else{if(c==='"'){inQ=true;}else if(c===','){out.push(cur);cur='';}else cur+=c;}
  }
  out.push(cur);return out;
}
