# 청명 알림장 서버

홈페이지·경기 관리 서비스와 같은 Firebase 프로젝트를 사용하되, **`cm-notices`라는 별도 데이터베이스**에만 알림장 데이터를 저장합니다. 기존 `(default)` 데이터베이스, Storage 규칙, 관리자 계정, 선수·경기 기록은 배포 대상에 포함되지 않습니다.

## 구현된 기능

- 관리자: 기존 Firebase 관리자 계정으로 로그인, 공지·JPEG 사진 3장, 전체/선택 선수, 한국시간 예약, 예약 변경·취소, 공지 삭제, 선수별 초대, 확인 현황.
- 선수: 개인 초대코드, 최대 3대 기기 연결, 본인에게 발행된 공지만 열람, 확인 표시, 홈 화면 설치, Apple/Chrome/Firefox Web Push.
- 즉시 공지는 Firestore 이벤트로 전달을 시작하고, 1분 간격 예약 작업이 예약·재시도를 처리합니다. 단말 수신 시각·소리는 OS/네트워크 설정에 따릅니다.
- 푸시 서비스의 수신 승인은 단말 열람 확인이 아닙니다. 선수의 확인 버튼 기록을 따로 저장합니다.
- 예시 화면 `?demo=1`은 실제 서버 저장·발송을 하지 않습니다. 서버 배포 전 라이브 화면은 연결 준비 상태로 표시됩니다.

## 운영 서버 업데이트

### 이미 운영 중인 서버에 공지 삭제 기능 업데이트

프로젝트 관리 계정으로 로그인한 Cloud Shell에서 아래 명령을 실행합니다. 기존 공지 함수 3개만 업데이트하며 데이터베이스와 규칙은 배포하지 않습니다.

```bash
notice_delete_workspace="$(mktemp -d -t cm-notice-delete.XXXXXX)"
git clone --depth 1 https://github.com/hajungmoo/cheongmyeong-tabletennis.git "$notice_delete_workspace" &&
bash "$notice_delete_workspace/notice-backend/deploy.sh" --functions-only
```

마지막에 **`서버 1.1.0 확인 · 공지 삭제 기능 배포 완료`**가 나와야 완료입니다. 코치 페이지를 새로고침하면 공지별 `공지 삭제` 버튼이 표시됩니다. 배포 전에는 버튼이 숨겨집니다. HTTP 서버 응답이 구버전이거나 삭제 기능을 지원하지 않으면 스크립트는 성공 처리하지 않습니다.

삭제하면 본문·사진·확인 기록·알림 전달 기록·예약 작업이 제거됩니다. 이미 도착한 휴대폰 알림은 회수할 수 없습니다. 전송 중에는 잠시 후 다시 삭제하도록 안내합니다. 삭제한 내용을 복구할 수 없으며, 지연된 저장 요청으로 되살아나는 것을 막는 **내용 없는 공지 ID·삭제 시각**만 `cm-notices`에 남습니다. 정리 중 실패한 공지는 선수에게 보이지 않으며 코치 화면에서 삭제를 다시 눌러 정리를 마칠 수 있습니다.

로컬 Firestore 검증은 운영 프로젝트와 연결하지 않는 `demo-cm-notices` 에뮬레이터에서만 실행합니다. 이 테스트에는 Java 21 이상이 필요합니다.

```bash
npm exec --yes --package=firebase-tools@15.31.0 -- firebase emulators:exec \
  --project demo-cm-notices --config firebase.test.json --only firestore \
  'npm --prefix functions run test:firestore'
```

## 최초 서버 연결

Firebase/Google Cloud 프로젝트 관리 권한으로 로그인한 Cloud Shell 또는 개발 환경에서 진행합니다. 비밀번호·서비스 계정 키를 소스나 채팅에 넣지 않습니다.

### 자동 설정

프로젝트에 접근할 수 있는 Google 계정으로 Cloud Shell을 연 다음 실행합니다. 이미 코드를 받았다면 `notice-backend` 폴더에서 `bash deploy.sh`만 실행합니다.

```bash
notice_workspace="$(mktemp -d -t cm-notices.XXXXXX)"
git clone --depth 1 https://github.com/hajungmoo/cheongmyeong-tabletennis.git "$notice_workspace"
bash "$notice_workspace/notice-backend/deploy.sh"
```

이 스크립트는 접근 권한·기존 DB 설정 확인 → 의존성 설치·검사 → 필요한 경우에만 공지 DB 생성 → 지정 함수와 규칙 배포 → 서버 응답 확인 순서로 진행합니다. 기존 DB가 예상과 다르거나 인증·배포가 실패하면 즉시 멈춥니다. 자체 IAM 역할 부여·비밀번호 입력·다른 DB 변경은 포함하지 않습니다. Firebase CLI의 인증·필수 API 설정 안내는 화면에서 확인합니다. Node.js 22 이상이 필요합니다.

서버 응답 확인은 휴대폰 수신 검증을 대신하지 않습니다. 관리자 첫 로그인과 본인 기기 알림 확인이 남아 있습니다.

관리자 UID는 `prepare-config.mjs`가 프로젝트 전용 `.env` 파일에 미리 채워 터미널 입력 단계를 줄입니다. 이미 저장된 관리자 값과 다른 환경 변수는 보존합니다. 생성된 `.env` 파일은 Git에 올리지 않습니다.

### 설정 입력 단계에서 배포가 중단된 경우

이미 받은 저장소에서 `git pull --ff-only`로 수정본을 받은 뒤 `bash notice-backend/deploy.sh`를 실행합니다. 이미 만들어진 `cm-notices` DB는 그대로 사용합니다. `Enter a string value for NOTICES_ADMIN_UID`에서 발생한 오류의 상세 원인은 추가 오류 기록이 있어야 확정할 수 있으며, 이 수정은 해당 대화형 입력 자체를 없애는 방식입니다.

### 수동 설정

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
