import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {recordSource,recordGroup,recordEnteredAt,sortLatestEntries,recordsForView} from '../parents/record-order.js';
import {projectPlayer} from '../manager/parent-projection.js';
import {packReports,unpackReports} from '../parents/report-data.js';

const old=Date.parse('2026-10-02T04:00:00Z'),recent=Date.parse('2026-10-08T04:00:00Z');
const match=(id,overrides={})=>({id:'match:m_'+id,source:'match',title:'연습경기',date:'2026-10-03',result:'win',a:3,b:1,opponents:['상대'],...overrides});

test('previously published tournament matches move out of general games without mutating reports',()=>{
  const records=[match(old),match(recent,{title:'대회'}),match(old+'_copy',{source:'competition',title:'제천오픈'}),match(old+'_one',{source:'one-set'}),match(old+'_league',{source:'league'})];
  const before=structuredClone(records),general=recordsForView(records),competition=recordsForView(records,{group:'competition'});
  assert.equal(general.length,3);assert.equal(competition.length,2);
  assert.ok(general.every(row=>recordGroup(row)==='general'));assert.ok(competition.every(row=>row.source==='competition'));
  assert.equal(recordSource(match(old,{title:'대회 준비 연습'})),'match');
  assert.deepEqual(records,before);
});
test('entry time outranks match date, including backdated games; editing does not reorder entry history',()=>{
  const earlier=match(old,{date:'2026-10-08',editedAt:'2026-10-09T04:00:00Z'}),later=match(recent+'_random',{date:'2026-09-01'});
  assert.deepEqual(sortLatestEntries([earlier,later]).map(row=>row.id),[later.id,earlier.id]);
  assert.equal(recordEnteredAt(earlier),old);
});
test('individual league entries and competition import IDs use their entry time',()=>{
  const league={id:'league:league_'+old+':1',source:'league',enteredAt:recent+100,date:'2026-08-01'},competition={id:'competition:comp_'+recent+'_random:0',source:'competition',date:'2026-07-01'};
  assert.deepEqual(sortLatestEntries([competition,match(old),league]).map(row=>row.id),[league.id,competition.id,'match:m_'+old]);
  assert.equal(recordEnteredAt({id:'league:league_sample_20260807:1'}),0);
  assert.equal(recordEnteredAt({id:'match:m_0001',enteredAt:'invalid',createdAt:Infinity}),0);
});
test('legacy sequential entries and batch records show the last stored entry first',()=>{
  assert.deepEqual(sortLatestEntries([match('0001',{date:'2026-10-08'}),match('0003',{date:'2026-08-01'}),match('0002')]).map(row=>row.id),['match:m_0003','match:m_0002','match:m_0001']);
  const batch=[0,1,2].map(index=>({id:'competition:comp_'+recent+':'+index,source:'competition'}));
  assert.deepEqual(sortLatestEntries(batch).map(row=>row.id),batch.slice().reverse().map(row=>row.id));
});
test('date ranges, wins and general subtypes filter only the selected group',()=>{
  const records=[match(old),match(recent,{title:'대회'}),match(recent+1,{source:'one-set',result:'loss'}),match(recent+2,{source:'league',date:'2026-09-01'})];
  assert.equal(recordsForView(records,{source:'one-set',result:'loss'}).length,1);
  assert.equal(recordsForView(records,{from:'2026-10-01',result:'win'}).length,1);
  const period=match(old,{source:'competition',date:'2026-10-02',dateEnd:'2026-10-05'});
  assert.equal(recordsForView([period],{group:'competition',from:'2026-10-04',to:'2026-10-08'}).length,1);
});
function database(){return {schools:[{id:'ours',name:'청명초',ours:true},{id:'other',name:'상대학교'}],players:[{id:'child',name:'임수아',grade:'1학년',schoolId:'ours'},{id:'opponent',name:'상대',schoolId:'other'}],matches:[{id:'m_'+recent,date:'2026-09-01',team1:['child'],team2:['opponent'],score1:3,score2:0,status:'완료',category:'대회',memo:'비공개 메모'},{id:'m_'+old,date:'2026-10-08',team1:['child'],team2:['opponent'],score1:3,score2:1,status:'완료',category:'연습경기'}],leagues:[],competitions:[]};}
test('projection separates directly entered tournaments, preserves entry time and never exposes notes',()=>{
  const db=database(),before=structuredClone(db),report=projectPlayer(db,'child',10);
  assert.equal(report.matches[0].source,'competition');assert.equal(report.matches[0].enteredAt,recent);
  assert.equal(report.matches[1].source,'match');assert.equal(report.matches[0].a,3);
  assert.deepEqual(report.matches[0].opponents,['상대']);assert.deepEqual(report.matches[0].opponentSchools,['상대학교']);
  assert.equal('memo' in report.matches[0],false);assert.deepEqual(db,before);
});
test('projection preserves one-set scores, omits linked league duplicates and uses result entry time',()=>{
  const db=database();db.matches.push({...db.matches[1],id:'m_'+(old+1),matchFormat:'1set',points1:11,points2:9});
  db.matches[1].leagueId='league_'+old;db.matches[1].leagueGameNo=1;
  db.leagues.push({id:'league_'+old,date:'2026-09-01',matchFormat:'3set',games:[{gameNo:1,p1:'child',p2:'opponent',result:'2-1'},{gameNo:2,p1:'child',p2:'opponent',result:'0-2',enteredAt:new Date(recent+10).toISOString()}]});
  const report=projectPlayer(db,'child',10),one=report.matches.find(row=>row.source==='one-set'),league=report.matches.filter(row=>row.source==='league');
  assert.equal(one.a,11);assert.equal(one.b,9);assert.equal(one.scoreUnit,'points');
  assert.equal(league.length,1);assert.equal(league[0].enteredAt,recent+10);assert.equal(report.matches[0].id,league[0].id);
});
test('confirmed imports sort by their registration time while ambiguous or unreviewed records stay hidden',()=>{
  const db=database();db.competitions.push({id:'comp_'+(recent+100),name:'소급 입력 대회',startDate:'2026-08-01',matches:[{player1:'임수아',player2:'상대',score1:3,score2:2}]},{id:'comp_'+(recent+200),needsReview:true,matches:[{player1:'임수아',player2:'상대',score1:3,score2:2}]});
  assert.equal(projectPlayer(db,'child',10).matches[0].title,'소급 입력 대회');
  db.players.push({id:'duplicate',name:'임수아',schoolId:'ours'});
  assert.equal(projectPlayer(db,'child',10).matches.filter(row=>row.id.startsWith('competition:')).length,0);
});
test('public report compression keeps new entry timestamps and remains compatible with version 2',async()=>{
  const report=projectPlayer(database(),'child',10);report.player.id='child';
  const packed=await packReports([report]);assert.deepEqual(await unpackReports({version:2,...packed}),[report]);
});
function uiHarness(records){
  const elements=new Map();
  const element=id=>{
    if(!elements.has(id)){const handlers={},attrs={},classes=new Set();elements.set(id,{id,value:['sourceFilter','resultFilter'].includes(id)?'all':'',textContent:'',innerHTML:'',hidden:false,disabled:false,handlers,attrs,classList:{toggle(name,value){if(value)classes.add(name);else classes.delete(name);}},setAttribute(name,value){attrs[name]=value;},replaceChildren(){this.innerHTML='';},focus(){},addEventListener(name,callback){handlers[name]=callback;}});}
    return elements.get(id);
  };
  const js=readFileSync(new URL('../parents/parents.js',import.meta.url),'utf8').replace(/^import .*$/gm,'');
  const context=vm.createContext({document:{getElementById:element,addEventListener(){}},window:{addEventListener(){}},location:{hash:'',pathname:'/parents/',search:''},history:{replaceState(){}},initializeApp:()=>({}),getFirestore:()=>({}),doc:()=>({}),recordGroup,recordsForView,normalizeName:value=>value,unpackReports,setTimeout,clearTimeout,URL,Intl,Number});
  vm.runInContext(js+'\nreport=seedReport;renderMatches();',Object.assign(context,{seedReport:{player:{name:'임수아'},matches:records}}));
  return {element,render:()=>vm.runInContext('renderMatches()',context)};
}
test('tab switches reset pagination and show independent counts, summaries and empty states',()=>{
  const records=Array.from({length:35},(_,index)=>match(old+index));records.push(match(recent,{title:'대회',result:'loss'}));
  const {element}=uiHarness(records);
  assert.equal(element('totalMatches').textContent,35);assert.equal(element('generalCount').textContent,35);assert.equal(element('competitionCount').textContent,1);
  assert.equal((element('matchList').innerHTML.match(/<article /g)||[]).length,30);
  element('moreMatches').handlers.click();assert.equal((element('matchList').innerHTML.match(/<article /g)||[]).length,35);
  element('competitionRecords').handlers.click();assert.equal(element('totalMatches').textContent,1);assert.equal(element('totalLosses').textContent,1);
  assert.equal(element('competitionRecords').attrs['aria-pressed'],'true');assert.equal(element('sourceFilterLabel').hidden,true);assert.equal(element('moreMatches').hidden,true);
  element('generalRecords').handlers.click();assert.equal((element('matchList').innerHTML.match(/<article /g)||[]).length,30);
  element('sourceFilter').value='one-set';element('recordFilters').handlers.change();assert.match(element('matchList').innerHTML,/선택한 조건/);
  element('resetFilters').handlers.click();assert.equal(element('sourceFilter').value,'all');assert.equal(element('totalMatches').textContent,35);
});
test('invalid date ranges never leave general matches visible under the competition selection',()=>{
  const {element}=uiHarness([match(old),match(recent,{title:'대회'})]);
  element('dateFrom').value='2026-10-10';element('dateTo').value='2026-10-01';element('competitionRecords').handlers.click();
  assert.equal(element('totalMatches').textContent,0);assert.ok(!element('matchList').innerHTML.includes('<article '));assert.match(element('filterStatus').textContent,/종료일/);
});
test('league entry times survive score edits, reset when cleared and include automatic forfeits',()=>{
  const html=readFileSync(new URL('../manager/index.html',import.meta.url),'utf8');
  const setResult=html.slice(html.lastIndexOf('function setLeagueResult('),html.indexOf('\nfunction renderSlots()',html.lastIndexOf('function setLeagueResult(')));
  const forfeit=html.slice(html.indexOf('function toggleLeagueForfeit('),html.indexOf('\nfunction leagueGameScore(',html.indexOf('function toggleLeagueForfeit(')));
  const league={games:[{gameNo:1,p1:'child',p2:'opponent',result:''}],forfeitedPlayers:[]};
  const context=vm.createContext({currentLeague:()=>league,save(){},renderLeagueViews(){},Date,confirm:()=>true,player:()=>({name:'임수아'}),leagueFormat:()=> '3set'});
  vm.runInContext(setResult+'\n'+forfeit,context);vm.runInContext("setLeagueResult(1,'2-1')",context);
  const entered=league.games[0].enteredAt;assert.ok(Number.isFinite(Date.parse(entered)));
  vm.runInContext("setLeagueResult(1,'2-0')",context);assert.equal(league.games[0].enteredAt,entered);
  vm.runInContext("setLeagueResult(1,'')",context);assert.equal(league.games[0].enteredAt,undefined);
  vm.runInContext("toggleLeagueForfeit('child')",context);assert.ok(league.games[0].enteredAt);
  vm.runInContext("toggleLeagueForfeit('child')",context);assert.equal(league.games[0].enteredAt,undefined);
});
