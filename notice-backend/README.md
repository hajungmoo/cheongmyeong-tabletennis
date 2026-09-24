# 청명 알림장 서버

홈페이지·경기 관리 서비스와 같은 Firebase 프로젝트를 사용하되, **`cm-notices`라는 별도 데이터베이스**에만 알림장 데이터를 저장합니다. 기존 `(default)` 데이터베이스, Storage 규칙, 관리자 계정, 선수·경기 기록은 배포 대상에 포함되지 않습니다.

## 구현된 기능

- 관리자: 기존 Firebase 관리자 계정으로 로그인, 공지·JPEG 사진 3장, 전체/선택 선수, 한국시간 예약, 예약 변경·취소, 선수별 초대, 확인 현황.
- 선수: 개인 초대코드, 최대 3대 기기 연결, 본인에게 발행된 공지만 열람, 확인 표시, 홈 화면 설치, Apple/Chrome/Firefox Web Push.
- 즉시 공지는 Firestore 이벤트로 전달을 시작하고, 1분 간격 예약 작업이 예약·재시도를 처리합니다. 단말 수신 시각·소리는 OS/네트워크 설정에 따릅니다.
- 푸시 서비스의 수신 승인은 단말 열람 확인이 아닙니다. 선수의 확인 버튼 기록을 따로 저장합니다.
- 예시 화면 `?demo=1`은 실제 서버 저장·발송을 하지 않습니다. 서버 배포 전 라이브 화면은 연결 준비 상태로 표시됩니다.

## 최초 서버 연결

Firebase/Google Cloud 프로젝트 관리 권한으로 로그인한 Cloud Shell 또는 개발 환경에서 진행합니다. 비밀번호·서비스 계정 키를 소스나 채팅에 넣지 않습니다.

1. 저장소를 받아 `notice-backend` 폴더로 이동합니다.
2. `cm-notices` 데이터베이스가 없으면 다음 명령으로 서울 리전에 생성합니다. 기존 데이터베이스는 삭제하거나 대체하지 않습니다.

```bash
gcloud firestore databases list --project=cheongmyeong-tabletennis
gcloud firestore databases create --project=cheongmyeong-tabletennis --database=cm-notices --location=asia-northeast3 --type=firestore-native
```

3. `functions` 폴더에서 `npm ci`와 `npm test`를 실행합니다. Node.js 22가 배포 런타임입니다.
4. 이 폴더의 `firebase.json`을 사용해 **아래 대상만** 배포합니다. 일반 `firebase deploy`로 다른 서비스까지 배포하지 않습니다.

```bash
firebase deploy --project cheongmyeong-tabletennis --only firestore:cm-notices,functions:cm-notices
```

서버 배포는 Blaze에서 Functions, Cloud Build, Eventarc, Scheduler 등의 API 활성화·프로젝트 IAM 권한이 필요할 수 있습니다. CLI가 요구하는 API·권한이 이 세 함수 배포에 필요한지 확인하고 진행합니다. 개발·미리보기만으로는 실제 휴대폰 알림이 작동하지 않습니다.

5. `/team-notices/admin.html`에서 기존 관리자로 로그인하면 최초 알림 서명키가 비공개 데이터베이스에서 생성됩니다. 키를 클라이언트로 보내거나 커밋하지 않습니다.
6. 코치 본인의 시험용 이름으로 초대코드를 만들고 본인 휴대폰 1대로 설치·알림 허용·즉시 및 예약 알림을 검증한 뒤 선수들을 초대합니다. 실제 아이들에게 시험 공지를 발송하지 않습니다.

## 배포 범위와 보안

배포 함수: `cmTeamNotices`, `cmTeamNoticeQueued`, `cmTeamNoticeDispatch`. API는 검증된 관리자 Firebase 토큰 또는 만료 기한이 있는 기기별 무작위 토큰을 확인합니다. 초대코드·기기 토큰의 원문은 서버에 저장하지 않습니다. 별도 DB 규칙은 모든 직접 클라이언트 읽기·쓰기를 거절합니다.

관리자 UID 기본값은 기존 관리자로 확인된 `RwknxZw7wRgtG8Ca5WJu6yXlHNE3`입니다. 관리자 변경 시 `NOTICES_ADMIN_UID` 배포 매개변수를 수정합니다. CORS는 운영 도메인만 허용합니다.

사진은 브라우저에서 JPEG로 다시 인코딩해 위치 메타데이터를 제거하고 축소합니다. 공지 이미지도 API의 수신 대상 권한 검사를 거쳐 읽습니다. 공개 홈페이지 Storage에 공지 사진을 올리지 않습니다.

예약 발송은 한 번에 한 작업만 처리하도록 잠금을 사용하며 기기별 발송 결과를 기록합니다. 푸시 전송 성공 직후 프로세스가 종료되는 극단적인 경우 재전송될 수 있으므로 알림 tag/topic도 공지 ID로 고정합니다. 이는 운영체제 차원의 정확히 한 번 도착을 보장하는 방식은 아닙니다.

## 비용과 상태

기존 Blaze 프로젝트의 사용량 과금이 적용됩니다. Functions·추가 DB·Scheduler 비용은 사용량과 현재 요금에 따라 달라지므로 무료라고 가정하지 않습니다. 콘솔 예산 알림 설정을 유지하세요. Vercel 배포 성공은 Firebase 서버 배포 성공을 의미하지 않습니다.
