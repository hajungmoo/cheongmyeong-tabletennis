/* One-set points are separate from set counts used by existing statistics. */
function isOneSetGame(match){return match?.matchFormat==='1set';}
function matchScoreValues(match,side=1){
 const a=isOneSetGame(match)?match.points1:match.score1,b=isOneSetGame(match)?match.points2:match.score2;
 return side===1?{a,b}:{a:b,b:a};
}
function matchScoreText(match,side=1){const {a,b}=matchScoreValues(match,side);return Number.isFinite(a)&&Number.isFinite(b)?`${a}:${b}`:'—';}
function oneSetNextTable(match,side=1){
 if(!isOneSetGame(match)||!Number.isInteger(match.tableNumber)||!Number.isInteger(match.tableCount)||match.tableNumber<1||match.tableNumber>match.tableCount)return null;
 const {a,b}=matchScoreValues(match,side);if(!Number.isFinite(a)||!Number.isFinite(b)||a===b)return null;
 return Math.max(1,Math.min(match.tableCount,match.tableNumber+(a>b?-1:1)));
}
function oneSetMovement(match,side=1){
 const next=oneSetNextTable(match,side);return next===null?'':`${match.tableNumber}탁 → ${next}탁${next===match.tableNumber?' (유지)':''}`;
}
function readOneSetEntry(prefix){
 const get=id=>document.getElementById(prefix+id),a=get('Points1').value.trim(),b=get('Points2').value.trim();
 if(!/^\d{1,2}$/.test(a)||!/^\d{1,2}$/.test(b))return {error:'양쪽 최종 득점을 0~99 사이의 정수로 입력해 주세요.'};
 if(Number(a)===Number(b))return {error:'동점으로 경기를 저장할 수 없습니다. 최종 득점을 확인해 주세요.'};
 let tableNumber=null,tableCount=null;
 if(get('Move').checked){
  const table=get('Table').value.trim(),count=get('TableCount').value.trim();
  if(!/^\d{1,2}$/.test(table)||!/^\d{1,2}$/.test(count)||Number(table)<1||Number(count)<1||Number(table)>Number(count))return {error:'경기한 탁 번호를 전체 탁 수 안에서 선택해 주세요. (1~99탁)'};
  tableNumber=Number(table);tableCount=Number(count);
 }
 return {matchFormat:'1set',category:'한세트게임',points1:Number(a),points2:Number(b),score1:Number(a)>Number(b)?1:0,score2:Number(b)>Number(a)?1:0,tableNumber,tableCount};
}
function previewOneSet(prefix='one'){
 const get=id=>document.getElementById(prefix+id),move=get('Move').checked;
 get('TableFields').hidden=!move;
 const data=readOneSetEntry(prefix),el=get('Preview');
 if(data.error){el.textContent=data.error;return;}
 const first=prefix==='one'?'우리 선수':'선수 1',second=prefix==='one'?'상대 선수':'선수 2';
 el.textContent=`${first} ${data.score1?'승리':'패배'} · ${data.points1}:${data.points2}`+(move?` / ${first} ${oneSetMovement(data,1)} · ${second} ${oneSetMovement(data,2)}`:'');
}
function setupOneSetEdit(match){
 const one=isOneSetGame(match),get=id=>document.getElementById(id);
 get('editSetScores').hidden=one;get('editOneSetEntry').hidden=!one;get('editMatchCategory').disabled=one;
 if(!one)return;
 get('editMatchSub').textContent='한세트게임 · 최종 득점과 탁 이동 수정';
 get('editOnePoints1').value=String(match.points1??'');get('editOnePoints2').value=String(match.points2??'');
 get('editOneMove').checked=oneSetNextTable(match)!==null;
 get('editOneTable').value=String(match.tableNumber||1);get('editOneTableCount').value=String(match.tableCount||5);previewOneSet('editOne');
}
function renderOneSetLast(match){
 const el=document.getElementById('oneLastResult');if(!el)return;
 el.hidden=!isOneSetGame(match);if(el.hidden){el.textContent='';return;}
 el.textContent=`최근 한세트게임 · ${teamNames(match.team1)} ${matchScoreText(match)} ${teamNames(match.team2)}`+(oneSetNextTable(match)!==null?` / 다음 탁: ${teamNames(match.team1)} ${oneSetNextTable(match,1)}탁 · ${teamNames(match.team2)} ${oneSetNextTable(match,2)}탁`:'');
}
