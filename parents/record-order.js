// Keep older published reports usable until the manager republishes them.
export function recordSource(record){
  return record.source==='competition'||record.source==='match'&&String(record.category||record.title||'').trim()==='대회'?'competition':record.source;
}
export const recordGroup=record=>recordSource(record)==='competition'?'competition':'general';

export function recordEnteredAt(record){
  for(const value of [record.enteredAt,record.createdAt]){
    const milliseconds=typeof value==='number'?value:typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(value)?Date.parse(value):0;
    if(Number.isFinite(milliseconds)&&milliseconds>0)return milliseconds;
  }
  // Existing manual records encode their original entry time in their ID.
  // Match dates and edit times are deliberately not used as entry times.
  const match=/(?:^|:)(?:m|comp|league)_(\d{13})(?=$|_|:)/.exec(String(record.id||''));
  return match?Number(match[1]):0;
}
function sequence(record){
  const id=String(record.id||''),legacy=/^match:m_(\d{1,12})$/.exec(id),nested=/^(competition|league):(.+):(\d+)$/.exec(id);
  return legacy?{group:'legacy-match',order:Number(legacy[1])}:nested?{group:nested[1]+':'+nested[2],order:Number(nested[3])}:null;
}
export function sortLatestEntries(records){
  const groups=new Map();for(const record of records){const group=sequence(record)?.group||record.id;if(!groups.has(group))groups.set(group,groups.size);}
  return records.slice().sort((a,b)=>{
    const time=recordEnteredAt(b)-recordEnteredAt(a);if(time)return time;
    const first=sequence(a),second=sequence(b);
    // Batch imports have one entry time; retain their stored entry sequence.
    return first&&second&&first.group===second.group?second.order-first.order:groups.get(first?.group||a.id)-groups.get(second?.group||b.id);
  });
}
export function recordsForView(records,{group='general',source='all',from='',to='',result='all'}={}){
  return sortLatestEntries(records.filter(record=>recordGroup(record)===group&&(source==='all'||recordSource(record)===source)&&(!from||(record.dateEnd||record.date)>=from)&&(!to||record.date<=to)&&(result==='all'||record.result===result))).map(record=>({...record,source:recordSource(record)}));
}
