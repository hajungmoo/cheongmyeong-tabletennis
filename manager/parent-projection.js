// Explicit result-only projection. Never spread source records or modify the manager DB.
const text=value=>String(value??'');
const norm=value=>text(value).normalize('NFC').replace(/\s+/g,'').toLocaleLowerCase('ko-KR');
const score=value=>Number.isInteger(value)&&value>=0&&value<=99;
const outcome=(a,b)=>a>b?'win':a<b?'loss':'draw';
export function shareablePlayers(db){
  const schools=new Map((db?.schools||[]).map(s=>[s.id,s]));
  return (db?.players||[]).filter(p=>schools.get(p.schoolId)?.ours&&p.current!==false&&!['졸업','퇴단'].includes(p.status)).sort((a,b)=>text(b.grade).localeCompare(text(a.grade),'ko')||text(a.name).localeCompare(text(b.name),'ko'));
}
export function projectPlayer(db,pid,sourceRevision){
  const child=shareablePlayers(db).find(p=>p.id===pid);if(!child)return null;
  const players=new Map((db.players||[]).map(p=>[p.id,p])),schools=new Map((db.schools||[]).map(s=>[s.id,s]));
  const names=ids=>ids.map(id=>text(players.get(id)?.name)||'등록 정보 없음');
  const schoolNames=(ids,snapshot)=>[...new Set(ids.map((id,i)=>text(snapshot?.[i]||schools.get(players.get(id)?.schoolId)?.name)).filter(Boolean))];
  const rows=[],linkedGames=new Set();
  for(const m of db.matches||[]){
    const t1=Array.isArray(m.team1)?m.team1:[],t2=Array.isArray(m.team2)?m.team2:[];
    const side=t1.includes(pid)?1:t2.includes(pid)?2:0;if(!side||!t1.length||!t2.length||t1.some(id=>t2.includes(id)))continue;
    if(m.status!=='완료'||!score(m.score1)||!score(m.score2))continue;
    const my=side===1?t1:t2,other=side===1?t2:t1,one=m.matchFormat==='1set';
    if(one&&(!score(m.points1)||!score(m.points2)||m.points1===m.points2||t1.length!==1||t2.length!==1))continue;
    const first=one?m.points1:m.score1,second=one?m.points2:m.score2,a=side===1?first:second,b=side===1?second:first;
    const row={id:'match:'+text(m.id),source:one?'one-set':'match',date:text(m.date),title:one?'한세트게임':text(m.category)||'일반 경기',format:one?'한세트게임':my.length>1||other.length>1?'복식':'단식',partner:names(my.filter(id=>id!==pid)),opponents:names(other),opponentSchools:schoolNames(other,side===1?m.team2SchoolSnapshot:m.team1SchoolSnapshot),a,b,result:outcome(a,b),forfeit:false};
    if(one){
      row.scoreUnit='points';
      if(Number.isInteger(m.tableNumber)&&Number.isInteger(m.tableCount)&&m.tableNumber>=1&&m.tableNumber<=m.tableCount&&m.tableCount<=99){
        row.tableNumber=m.tableNumber;row.nextTable=Math.max(1,Math.min(m.tableCount,m.tableNumber+(a>b?-1:1)));
      }
    }
    rows.push(row);
    if(m.leagueId&&m.leagueGameNo!=null)linkedGames.add(text(m.leagueId)+':'+text(m.leagueGameNo));
  }
  for(const league of db.leagues||[]){
    for(const game of league.games||[]){
      if(game.p1!==pid&&game.p2!==pid||!game.p1||!game.p2||game.p1===game.p2||!game.result||linkedGames.has(text(league.id)+':'+text(game.gameNo)))continue;
      const side=game.p1===pid?1:2,other=side===1?game.p2:game.p1;
      const target=league.matchFormat==='3set'?2:3,parsed=/^(\d+)\s*[:-]\s*(\d+)$/.exec(text(game.result).trim());
      let a=null,b=null,result='unscored',forfeit=game.result==='기권';
      if(parsed){const x=Number(parsed[1]),y=Number(parsed[2]);if(Math.max(x,y)!==target||Math.min(x,y)>=target)continue;a=side===1?x:y;b=side===1?y:x;result=outcome(a,b);}
      else if(forfeit&&[game.p1,game.p2].includes(game.forfeitPid)){a=game.forfeitPid===pid?0:target;b=game.forfeitPid===pid?target:0;result=outcome(a,b);}
      else if(!forfeit)continue;
      rows.push({id:'league:'+text(league.id)+':'+text(game.gameNo),source:'league',date:text(league.date),title:text(league.title)||'리그전',format:target===2?'3세트제':'5세트제',round:game.round?text(game.round)+'라운드':'',partner:[],opponents:names([other]),opponentSchools:schoolNames([other]),a,b,result,forfeit});
    }
  }
  // Imported competition records identify players by name, so ambiguous names are omitted.
  const sameName=shareablePlayers(db).filter(p=>norm(p.name)===norm(child.name)).length;
  if(sameName===1)for(const c of db.competitions||[]){
    if(c.needsReview)continue;
    for(const [index,m]of (c.matches||[]).entries()){
      const side=norm(m.player1)===norm(child.name)?1:norm(m.player2)===norm(child.name)?2:0;if(!side)continue;
      const rawA=side===1?m.score1:m.score2,rawB=side===1?m.score2:m.score1;
      const a=score(rawA)?rawA:null,b=score(rawB)?rawB:null,rawResult=text(side===1?m.result1:m.result2);
      let result=/패/.test(rawResult)?'loss':/승/.test(rawResult)?'win':a!==null&&b!==null?outcome(a,b):'unscored';
      if(result==='unscored'&&!/기권/.test(rawResult))continue;
      rows.push({id:'competition:'+text(c.id)+':'+index,source:'competition',date:text(m.date||c.startDate),dateEnd:m.date?'':text(c.endDate),dateLabel:m.date?'':'대회 기간',title:text(c.name),format:text(m.event),round:text(m.round),partner:[],opponents:[text(side===1?m.player2:m.player1)],opponentSchools:[text(side===1?m.school2:m.school1)].filter(Boolean),a,b,result,forfeit:/기권/.test(rawResult)});
    }
  }
  rows.sort((a,b)=>b.date.localeCompare(a.date)||a.source.localeCompare(b.source)||a.id.localeCompare(b.id,undefined,{numeric:true}));
  return {version:1,sourceRevision,player:{name:text(child.name),grade:text(child.grade),school:text(schools.get(child.schoolId)?.name)},matches:rows};
}
