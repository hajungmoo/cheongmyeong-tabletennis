#!/usr/bin/env bash
# Run from Google Cloud Shell while signed in to the project's owner account.
# Scope: cm-notices database and the cm-notices Functions codebase only.
set -euo pipefail

notice_project='cheongmyeong-tabletennis'
notice_database='cm-notices'
notice_region='asia-northeast3'
notice_backend_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
notice_cli_version='15.31.0'

on_exit() {
  notice_exit_code=$?
  if [ "$notice_exit_code" -ne 0 ]; then
    printf '\n설정이 중단되었습니다. 위 오류를 확인해주세요. 배포 완료 상태가 아닙니다.\n' >&2
  fi
}
trap on_exit EXIT

for notice_command in gcloud node npm curl; do
  if ! command -v "$notice_command" >/dev/null 2>&1; then
    printf '%s 명령이 필요합니다. Google Cloud Shell에서 실행해주세요.\n' "$notice_command" >&2
    exit 1
  fi
done
node -e 'if(Number(process.versions.node.split(".")[0])<22){console.error("Node.js 22 이상이 필요합니다.");process.exit(1)}'

printf '청명 알림장 서버 설정을 시작합니다.\n대상 프로젝트: %s\n' "$notice_project"
printf '공지 전용 DB와 알림 함수 3개만 배포합니다.\n'

# A failed permission/auth request stops here; it is never mistaken for a missing DB.
notice_database_json="$(gcloud firestore databases list --project="$notice_project" --format=json)"
notice_database_state="$(printf '%s' "$notice_database_json" | node --input-type=module -e '
  import fs from "node:fs";
  const databases=JSON.parse(fs.readFileSync(0,"utf8"));
  if(!Array.isArray(databases))throw new Error("데이터베이스 목록을 확인할 수 없습니다.");
  const database=databases.find(item=>item.name?.endsWith("/databases/cm-notices"));
  console.log(database ? [database.type,database.locationId].join(":") : "missing");
')"
case "$notice_database_state" in
  missing|FIRESTORE_NATIVE:asia-northeast3) ;;
  *) printf '기존 cm-notices DB 설정이 예상과 다릅니다: %s\n' "$notice_database_state" >&2; exit 1 ;;
esac

printf '\n서버 코드를 설치하고 검사합니다.\n'
cd "$notice_backend_dir/functions"
npm ci --ignore-scripts
npm test
cd "$notice_backend_dir"

if [ "$notice_database_state" = 'missing' ]; then
  printf '\n서울 리전에 공지 전용 DB를 만듭니다.\n'
  gcloud firestore databases create \
    --project="$notice_project" \
    --database="$notice_database" \
    --location="$notice_region" \
    --type=firestore-native
else
  printf '\n기존 cm-notices DB를 사용합니다.\n'
fi

printf '\n공지 서버를 배포합니다. Google 인증·필수 서비스 설정 안내가 나오면 내용을 확인해주세요.\n'
# Do not add --force, a general firebase deploy, or changes to the default DB.
npm exec --yes --package="firebase-tools@$notice_cli_version" -- firebase deploy \
  --project "$notice_project" \
  --config "$notice_backend_dir/firebase.json" \
  --only 'firestore:cm-notices,functions:cm-notices'

printf '\n배포한 서버의 데이터베이스 연결을 확인합니다.\n'
notice_api_response="$(curl --fail --silent --show-error --max-time 45 \
  -H 'Content-Type: application/json' \
  --data '{"action":"status"}' \
  'https://asia-northeast3-cheongmyeong-tabletennis.cloudfunctions.net/cmTeamNotices')"
printf '%s' "$notice_api_response" | node --input-type=module -e '
  import fs from "node:fs";
  const response=JSON.parse(fs.readFileSync(0,"utf8"));
  if(typeof response.ready!=="boolean"||response.version!=="1.0.0")throw new Error("알림 서버 응답을 확인해주세요.");
  console.log(response.ready ? "서버 응답 정상 · 관리자 초기 설정 완료" : "서버 응답 정상 · 관리자 첫 로그인을 기다리고 있습니다.");
'

printf '\n서버 배포 완료. 아래 주소에서 기존 홈페이지 관리자 계정으로 로그인해주세요.\n'
printf 'https://cheongmyeong-tabletennis.vercel.app/team-notices/admin.html\n'
printf '선수 초대 전에 코치님 본인 휴대폰으로 즉시 알림과 예약 알림을 확인해주세요.\n'
