#!/usr/bin/env bash
# Only the cm-notices codebase is retired. No database, rules, storage, login, or billing changes.
set -euo pipefail
notice_project='cheongmyeong-tabletennis'
notice_region='asia-northeast3'
notice_job='firebase-schedule-cmTeamNoticeDispatch-asia-northeast3'
notice_backend_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
notice_cli_version='15.31.0'
notice_work_dir="$(mktemp -d -t cm-notice-retire.XXXXXX)"
on_exit() {
  notice_result=$?
  if [ "$notice_result" -ne 0 ]; then
    printf '\n알림장 서버 종료가 완료되지 않았습니다. 위 오류를 확인해주세요.\n' >&2
  fi
}
trap on_exit EXIT
for notice_command in gcloud node npm curl; do
  command -v "$notice_command" >/dev/null 2>&1 || { printf '%s 명령이 필요합니다. Google Cloud Shell에서 실행해주세요.\n' "$notice_command" >&2; exit 1; }
done
node -e 'if(Number(process.versions.node.split(".")[0])<22)process.exit(1)'
printf '청명 알림장 API·발송 함수·예약 작업을 종료합니다.\n홈페이지·경기기록·DB·로그인은 변경하지 않습니다.\n'
# Failed authorization is never interpreted as an empty project.
gcloud projects describe "$notice_project" --format='value(projectId)' >/dev/null
gcloud functions list --project="$notice_project" --format=json > "$notice_work_dir/functions.json"
node --input-type=module - "$notice_work_dir/functions.json" <<'JS'
import fs from 'node:fs';
const functions=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const expected=new Set(['cmTeamNotices','cmTeamNoticeQueued','cmTeamNoticeDispatch']);
if(!Array.isArray(functions))throw new Error('함수 목록을 확인하지 못했습니다.');
for(const fn of functions){
  const name=fn.name?.split('/').pop();
  if(fn.labels?.['firebase-functions-codebase']==='cm-notices'&&!expected.has(name))throw new Error('알림장 코드베이스에 다른 함수가 있습니다. 중단합니다.');
}
for(const name of expected){
  const fn=functions.find(fn=>fn.name?.endsWith('/locations/asia-northeast3/functions/'+name));
  if(!fn||fn.labels?.['firebase-functions-codebase']!=='cm-notices')throw new Error('대상 함수 또는 코드베이스를 확인하지 못했습니다: '+name);
}
console.log('알림장 전용 함수 3개 확인');
JS
pause_notice_job(){
  local notice_state
  notice_state="$(gcloud scheduler jobs describe "$notice_job" --project="$notice_project" --location="$notice_region" --format='value(state)')"
  case "$notice_state" in
    ENABLED) gcloud scheduler jobs pause "$notice_job" --project="$notice_project" --location="$notice_region" --quiet ;;
    PAUSED) ;;
    *) printf '예약 작업 상태가 예상과 다릅니다: %s\n' "$notice_state" >&2; return 1 ;;
  esac
}
pause_notice_job
cd "$notice_backend_dir/functions"
npm ci --ignore-scripts
npm test
cd "$notice_backend_dir"
# Keep all three exports. No other codebase or Firestore rules are deployed.
npm exec --yes --package="firebase-tools@$notice_cli_version" -- firebase deploy \
  --project "$notice_project" --config "$notice_backend_dir/firebase.json" --only functions:cm-notices --non-interactive
# Deployment can update this job. Pause it again and verify.
pause_notice_job
notice_http_status="$(curl --silent --show-error --max-time 45 \
  -H 'Content-Type: application/json' --data '{"action":"status"}' \
  -o "$notice_work_dir/status.json" -w '%{http_code}' \
  'https://asia-northeast3-cheongmyeong-tabletennis.cloudfunctions.net/cmTeamNotices')"
test "$notice_http_status" = '410' || { printf '알림장 API가 종료 응답을 반환하지 않습니다: %s\n' "$notice_http_status" >&2; exit 1; }
node "$notice_backend_dir/verify-deployment.mjs" < "$notice_work_dir/status.json"
test "$(gcloud scheduler jobs describe "$notice_job" --project="$notice_project" --location="$notice_region" --format='value(state)')" = 'PAUSED'
printf '\n청명 알림장 서버 종료 완료 · API 사용 중지 · 예약 발송 중지\n'
