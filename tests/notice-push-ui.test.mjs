import test from 'node:test';
import assert from 'node:assert/strict';
import {notificationView} from '../team-notices/push-ui.js';
const linked={ready:true,member:true,supported:true};
test('허용 권한만 있거나 서버 저장에 실패한 기기를 알림 켜짐으로 표시하지 않는다',()=>{
 assert.equal(notificationView({...linked,permission:'granted'}).action,'enable');
 assert.equal(notificationView({...linked,permission:'granted',error:'연결 실패'}).key,'error');
 assert.equal(notificationView({...linked,permission:'granted',connected:true}).key,'on');
 assert.equal(notificationView({...linked,permission:'denied',connected:true}).key,'blocked');
});
test('아이폰 브라우저에서는 설치 안내, 홈 화면 앱에서는 알림 켜기로 이어진다',()=>{
 assert.equal(notificationView({...linked,ios:true}).key,'install');
 assert.equal(notificationView({...linked,ios:true,standalone:true}).action,'enable');
 assert.equal(notificationView({...linked,supported:false}).action,'guide');
});
test('초대 전·서버 장애·확인 중에는 알림 권한 요청 대신 필요한 단계를 안내한다',()=>{
 assert.equal(notificationView({ready:true}).action,'join');
 assert.equal(notificationView({ready:false}).action,'reconnect');
 for(const flag of ['busy','checking','connecting']){
  const view=notificationView({...linked,[flag]:true});assert.equal(view.disabled,true);assert.equal(view.action,'none');
 }
});
