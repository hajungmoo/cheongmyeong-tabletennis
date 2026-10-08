import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MIGRATION,ROSTER,SCHOOL_SPECS,applyRoster,migrateRoster} from '../manager/womens-final-roster-2026.js';

const database=()=>({schools:[{id:'cm',name:'수원청명초등학교',ours:true,aliases:['청명초']},{id:'swd',name:'서대전초등학교',ours:false,aliases:['서대전초']}],players:[{id:'su-a',name:'임수아',gender:'여',grade:'1학년',schoolId:'cm',overallRank:7,rankPoints:{합계:100},current:true,status:'재학',memo:'Existing private note'}],matches:[{id:'existing-match',team1:['su-a'],team2:['opponent'],score1:3,score2:1,memo:'Original result'}],leagues:[{id:'existing-league'}],competitions:[{id:'existing-competition'}],rankImports:[{id:'ranking-import'}],migrations:{previous:{keep:true}}});
function verifyCatalog(db){
  for(const record of ROSTER){
    const target=db.schools.find(school=>school.name===record.school);
    assert.ok(target,'Missing school: '+record.school);
    const normalize=name=>String(name).replace(/\s+/g,'');
    const found=db.players.filter(player=>[player.name,...(player.aliases||[])].some(name=>normalize(name)===normalize(record.name))&&player.schoolId===target.id&&player.gender==='여');
    assert.equal(found.length,1,record.name+' / '+record.school);
  }
}
test('all five PDF pages yield 125 unique names and school pairs, including U7 and all middle-school entries',()=>{
  assert.equal(ROSTER.length,125);assert.equal(new Set(ROSTER.map(record=>record.name+'|'+record.school)).size,125);
  assert.equal(SCHOOL_SPECS.length,34);assert.equal(ROSTER.filter(record=>record.divisions.includes('U7')).length,11);
  assert.equal(ROSTER.filter(record=>record.school.endsWith('중학교')).length,15);
  for(const name of ['손유주','손유하','권사랑','이하늘','장여령','소진하','서지민','서채은'])assert.ok(ROSTER.some(record=>record.name===name));
});
test('additions retain every existing player field and all results, rankings and previous migration metadata',()=>{
  const db=database(),before=structuredClone(db),result=applyRoster(db);
  assert.equal(result.report.matchedPlayers,1);assert.equal(result.report.addedPlayers,124);
  assert.deepEqual(db.players[0],before.players[0]);
  for(const key of ['matches','leagues','competitions','rankImports'])assert.deepEqual(db[key],before[key]);
  assert.deepEqual(db.migrations.previous,before.migrations.previous);verifyCatalog(db);
  assert.equal(applyRoster(db).changed,false);assert.equal(db.players.length,125);
});
test('abbreviated schools expand in place, keep their IDs and prevent duplicate registrations',()=>{
  const db=database();db.schools[1].name='서대전';db.schools[1].aliases=[];
  db.schools.push({id:'cheongdae',name:'청대',aliases:[]});db.players.push({id:'sarang',name:'권사랑',schoolId:'swd',gender:'여',grade:'',current:false,status:'퇴단'},{id:'minseo',name:'최민서',gender:'여',schoolId:'cheongdae',grade:'6학년'});
  const before=structuredClone(db.players);applyRoster(db);
  assert.equal(db.schools.find(school=>school.id==='swd').name,'서대전초등학교');
  assert.equal(db.schools.find(school=>school.id==='cheongdae').name,'청대초등학교');
  assert.deepEqual(db.players.slice(0,before.length),before);
  assert.equal(db.players.filter(player=>player.name==='권사랑'&&player.schoolId==='swd').length,1);
});
test('school aliases and player name aliases identify existing people without merging namesakes',()=>{
  const db=database();db.schools.push({id:'jeongsan',name:'청양정산초등학교',aliases:['정산초']},{id:'other',name:'다른초등학교',aliases:[]});
  db.players.push({id:'seol',name:'이 설',gender:'여',schoolId:'jeongsan',grade:'2학년',aliases:['이설']},{id:'other-sarang',name:'권사랑',gender:'여',schoolId:'other',grade:'3학년'});
  applyRoster(db);
  assert.equal(db.players.filter(player=>player.name==='이설'&&player.schoolId==='jeongsan').length,0);
  assert.equal(db.players.filter(player=>player.name==='권사랑').length,2);
  assert.equal(db.players.find(player=>player.id==='other-sarang').schoolId,'other');
});
test('duplicate school rows do not create a second copy of an existing player',()=>{
  const db=database();db.schools.push({id:'swd-duplicate',name:'서대전초',aliases:['서대전초등학교']});
  db.players.push({id:'existing-sarang',name:'권사랑',gender:'여',schoolId:'swd-duplicate',grade:'1학년'});
  applyRoster(db);assert.equal(db.players.filter(player=>player.name==='권사랑').length,1);
});
test('an existing middle school incorrectly labeled as an elementary school is corrected in place',()=>{
  const db=database();db.schools.push({id:'gyeongsin',name:'광주경신중초등학교',aliases:['광주경신중']});
  const existing={id:'yueun',name:'나유은',gender:'여',schoolId:'gyeongsin',grade:'2학년',current:true,memo:'Preserve existing information'};
  db.players.push(existing);db.migrations.womensFinalBracket20261008V1={addedPlayers:30};
  const before=structuredClone(existing);applyRoster(db);
  assert.equal(db.schools.find(school=>school.id==='gyeongsin').name,'광주경신중학교');
  assert.ok(db.schools.find(school=>school.id==='gyeongsin').aliases.includes('광주경신중초등학교'));
  assert.deepEqual(db.players.find(player=>player.id==='yueun'),before);
  assert.equal(db.players.filter(player=>player.name==='나유은'&&player.schoolId==='gyeongsin').length,1);
  assert.deepEqual(db.migrations.womensFinalBracket20261008V1,{addedPlayers:30});
});
test('new records retain division evidence without inventing grades or renaming clubs as schools',()=>{
  const db=database();applyRoster(db);
  const newPlayers=db.players.filter(player=>player.source===MIGRATION);
  assert.ok(newPlayers.every(player=>player.grade===''&&player.overallRank===null));
  assert.deepEqual(newPlayers.find(player=>player.name==='손유주').divisionGroups,['U7','U8']);
  assert.ok(db.schools.some(school=>school.name==='부산탁구스포츠클럽'));
  assert.ok(db.schools.some(school=>school.name==='블랙핑퐁'));
});
function transactionHarness(db,overrides={}){
  const auth={currentUser:{uid:'coach'}},writes=[];
  const options={auth,fs:{},ref:{id:'main'},async runTransaction(fs,callback){return callback({async get(){return {exists:()=>true,data:()=>({encoding:'json',payload:JSON.stringify(db),revision:100,retainedMetadata:'keep',version:1})};},set(ref,data){writes.push(data);}});},decodePayload:async(encoding,payload)=>JSON.parse(payload),gzipEncode:async value=>({encoding:'json',payload:JSON.stringify(value)}),serverTimestamp:()=> 'SERVER_TIME',...overrides};
  return {options,writes,auth};
}
test('live import reads the current server document and preserves its records and metadata',async()=>{
  const db=database();db.matches.push({id:'latest-score-from-another-device'});
  const {options,writes}=transactionHarness(db),report=await migrateRoster(options);
  assert.equal(report.addedPlayers,124);assert.equal(writes.length,1);
  const saved=JSON.parse(writes[0].payload);verifyCatalog(saved);
  assert.deepEqual(saved.matches,db.matches);assert.equal(writes[0].retainedMetadata,'keep');assert.ok(writes[0].revision>100);
  assert.equal(writes[0].summary.matches,2);assert.equal(writes[0].summary.players,125);
});
test('transaction retries recompute additions from the newest document and preserve concurrently entered games',async()=>{
  const first=database(),second=database();second.players.push({id:'already-added',name:'손유주',gender:'여',grade:'1학년',schoolId:'busan'});second.schools.push({id:'busan',name:'부산탁구스포츠클럽',aliases:[]});second.matches.push({id:'concurrent-score'});
  const writes=[],harness=transactionHarness(first,{async runTransaction(fs,callback){let result;for(const db of [first,second])result=await callback({async get(){return {exists:()=>true,data:()=>({encoding:'json',payload:JSON.stringify(db),revision:200})};},set(ref,data){writes.push(data);}});return result;}});
  const report=await migrateRoster(harness.options),saved=JSON.parse(writes.at(-1).payload);
  assert.equal(report.addedPlayers,123);assert.equal(saved.players.find(player=>player.id==='already-added').grade,'1학년');
  assert.ok(saved.matches.some(match=>match.id==='concurrent-score'));verifyCatalog(saved);
});
test('signed-out, missing-source and already-completed cases never upload default or stale local data',async()=>{
  const signedOut=transactionHarness(database());signedOut.auth.currentUser=null;assert.equal(await migrateRoster(signedOut.options),null);assert.equal(signedOut.writes.length,0);
  const missing=transactionHarness(database(),{async runTransaction(fs,callback){return callback({get:async()=>({exists:()=>false}),set(){throw new Error('Unexpected write');}});}});assert.equal(await migrateRoster(missing.options),null);
  const db=database();applyRoster(db);const completed=transactionHarness(db);assert.equal(await migrateRoster(completed.options),null);assert.equal(completed.writes.length,0);
});
test('changing accounts during preparation cancels the write',async()=>{
  const harness=transactionHarness(database());harness.options.gzipEncode=async db=>{harness.auth.currentUser=null;return {encoding:'json',payload:JSON.stringify(db)};};
  await assert.rejects(()=>migrateRoster(harness.options),{message:'ROSTER_LOGIN_CHANGED'});assert.equal(harness.writes.length,0);
});
test('deployed default data contains the catalog while the authenticated path performs the same server merge',()=>{
  const html=readFileSync(new URL('../manager/index.html',import.meta.url),'utf8'),db=JSON.parse(/const SEED=(\{.*?\});/.exec(html)[1]);
  verifyCatalog(db);assert.ok(db.migrations[MIGRATION]);
  assert.match(html,/await migrateRoster\(\{auth,fs,ref,runTransaction,decodePayload,gzipEncode,serverTimestamp\}\)/);
});
