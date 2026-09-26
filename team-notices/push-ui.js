// Permission alone is not enough: show "on" only after the server saves the subscription.
export function notificationView({ios=false,standalone=false,supported=true,permission='default',ready=false,connecting=false,member=false,connected=false,busy=false,checking=false,error=''}={}){
 const view=(key,label,title,description,button,action,disabled=false)=>({key,label,title,description,button,action,disabled});
 if(busy)return view('checking','설정 중','휴대폰 알림을 연결하고 있어요','알림 허용 창이 뜨면 ‘허용’을 눌러주세요.','알림 연결 중…','none',true);
 if(ios&&!standalone)return view('install','아이폰 설치 필요','아이폰도 공지 알림을 받아요','먼저 홈 화면에 청명 알림장을 추가해주세요.','아이폰 알림 켜는 방법','guide');
 if(!supported)return view('unsupported','설정 안내','휴대폰 브라우저에서 열어주세요','아이폰은 Safari, 갤럭시는 Chrome에서 시작해요.','알림 설정 방법 보기','guide');
 if(permission==='denied')return view('blocked','알림 차단됨','알림이 차단되어 있어요','설정에서 알림을 허용하면 새 공지를 받을 수 있어요.','알림 차단 해제 방법','guide');
 if(connecting)return view('checking','연결 확인 중','코치님 공지, 바로 알림받기','알림장 연결을 확인하고 있어요.','연결 확인 중…','none',true);
 if(!ready)return view('offline','연결 확인 필요','알림장 연결을 확인해주세요','인터넷 연결을 확인한 뒤 다시 눌러주세요.','다시 연결하기','reconnect');
 if(!member)return view('join','처음 한 번 설정','코치님 공지, 바로 알림받기','초대코드로 연결한 다음 알림을 켤 수 있어요.','초대코드 연결하고 알림 켜기','join');
 if(checking)return view('checking','알림 확인 중','이 휴대폰의 알림을 확인해요','기존 알림 연결을 확인하고 있어요.','알림 확인 중…','none',true);
 if(permission==='granted'&&connected)return view('on','알림 켜짐','공지 알림 준비 완료!','이 휴대폰으로 코치님의 새 공지를 받아요.','알림 설정 확인하기','guide');
 if(error)return view('error','설정 다시 확인','알림 연결을 마쳐주세요','아래 버튼을 눌러 다시 연결할 수 있어요.','알림 다시 연결하기','enable');
 return view('off','알림 꺼짐','코치님 공지, 바로 알림받기','단체복과 훈련 공지를 놓치지 않도록 알림을 켜주세요.','알림 켜기','enable');
}
