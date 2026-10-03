import {onRequest} from 'firebase-functions/v2/https';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {onDocumentWritten} from 'firebase-functions/v2/firestore';
import {noticeHttpHandler,ignoreRetiredNotice} from './retirement.js';
export {noticeHttpHandler} from './retirement.js';
// Preserve existing function names. No Admin SDK, DB access, or push sends remain.
const opts={region:'asia-northeast3',memory:'256MiB',maxInstances:1,timeoutSeconds:30};
export const cmTeamNotices=onRequest({...opts,cors:['https://cheongmyeong-tabletennis.vercel.app'],invoker:'public'},noticeHttpHandler);
export const cmTeamNoticeQueued=onDocumentWritten({...opts,database:'cm-notices',document:'outbox/{noticeId}',retry:false},ignoreRetiredNotice);
export const cmTeamNoticeDispatch=onSchedule({...opts,schedule:'every 1 minutes',timeZone:'Asia/Seoul',retryCount:0},ignoreRetiredNotice);
