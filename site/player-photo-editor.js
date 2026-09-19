import { createPlayerPhotoDraft } from './player-photo-state.js?v=3.3.0';
import { photoUploadError } from './photo-upload.js?v=3.1.1';
import { playerImageFor } from './player-portraits.js?v=3.3.0';

export function initPlayerPhotoEditor({ uploadPhoto, isSignedIn, getPlayer, getRoster }) {
  const $ = id => document.getElementById(id);
  const root = $('playerPhotoEditor'), input = $('players_photoFile'), value = $('players_photoUrl');
  const image = $('playerPhotoPreview'), empty = $('playerPhotoEmpty'), status = $('playerPhotoStatus');
  const choose = $('choosePlayerPhoto'), remove = $('removePlayerPhoto'), cancel = $('cancelPlayerPhoto');
  let localFile = null, localUrl = '';

  function render(state) {
    if (localFile !== state.file) {
      if (localUrl) URL.revokeObjectURL(localUrl);
      localFile = state.file;
      localUrl = state.file ? URL.createObjectURL(state.file) : '';
    }
    value.value = state.url;
    const artwork = playerImageFor({ ...getPlayer(), photoUrl: state.url }, getRoster());
    const src = localUrl || artwork.src;
    if (src && image.getAttribute('src') !== src) image.src = src;
    image.hidden = !src;
    empty.hidden = !!src;
    image.alt = '홈페이지에 표시할 선수 사진 미리보기';
    $('playerPhotoCaption').textContent = state.uploading ? '선택한 사진 · 업로드 중' : state.url ? '선택한 선수 사진' : artwork.src ? '현재 기본 일러스트' : '사진을 선택하면 이곳에 미리보기가 표시됩니다.';
    const busy = state.uploading || state.saving;
    choose.disabled = busy;
    input.disabled = busy;
    remove.disabled = busy || !state.url;
    cancel.disabled = busy;
    cancel.hidden = !state.dirty && !state.error;
    choose.textContent = state.url ? '사진 변경' : '선수 사진 선택';
    $('savePlayer').disabled = busy || !!state.error;
    $('newPlayer').disabled = busy;
    root.setAttribute('aria-busy', String(busy));
    status.dataset.state = state.error ? 'error' : state.dirty ? 'success' : '';
    status.textContent = state.error ? photoUploadError(state.error) + ' 다시 선택하거나 ‘변경 취소’를 눌러주세요.'
      : state.uploading ? `사진 업로드 중 · ${state.progress}% · 완료될 때까지 기다려주세요.`
      : state.saving ? '선수 정보를 저장하고 있습니다.'
      : state.dirty ? state.url ? '사진 업로드 완료. 아래 ‘선수 저장’을 누르면 홈페이지에 적용됩니다.' : '사진 삭제를 선택했습니다. 아래 ‘선수 저장’을 누르면 기본 그림으로 돌아갑니다.'
      : '사진 선택 → 업로드 완료 → 아래 ‘선수 저장’';
  }

  const draft = createPlayerPhotoDraft({ uploadPhoto, isSignedIn, onChange: render });
  choose.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    input.value = '';
    if (file) void draft.select(file);
  });
  remove.addEventListener('click', () => draft.remove());
  cancel.addEventListener('click', () => draft.cancel());
  $('players_name').addEventListener('input', () => render(draft.snapshot()));
  image.addEventListener('error', () => {
    image.hidden = true;
    empty.hidden = false;
    $('playerPhotoCaption').textContent = '사진 미리보기를 불러오지 못했습니다. 다른 사진을 선택할 수 있습니다.';
  });
  window.addEventListener('beforeunload', event => {
    const state = draft.snapshot();
    if (!state.dirty && !state.uploading) return;
    event.preventDefault();
    event.returnValue = '';
  });
  draft.load();
  return {
    ...draft,
    get busy() { const state = draft.snapshot(); return state.uploading || state.saving; },
  };
}
