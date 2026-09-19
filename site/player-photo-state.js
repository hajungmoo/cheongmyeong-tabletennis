// A photo stays a draft until the existing player-save action succeeds.
// Late upload callbacks must never change a different player's form.
export function createPlayerPhotoDraft({ uploadPhoto, isSignedIn, onChange = () => {} }) {
  let revision = 0;
  let state = { initialUrl: '', url: '', file: null, progress: 0, uploading: false, saving: false, error: null };
  const snapshot = () => ({ ...state, dirty: state.url !== state.initialUrl });
  const emit = () => onChange(snapshot());
  const busy = () => state.uploading || state.saving;

  function load(url = '') {
    revision++;
    state = { initialUrl: url, url, file: null, progress: 0, uploading: false, saving: false, error: null };
    emit();
  }

  async function select(file) {
    if (!file || busy()) return;
    if (!isSignedIn()) {
      state.error = new Error('관리자 로그인 후 사진을 선택해주세요.');
      emit();
      return;
    }
    const selectedRevision = ++revision;
    state = { ...state, file, progress: 0, uploading: true, error: null };
    emit();
    try {
      const url = await uploadPhoto(file, progress => {
        if (selectedRevision !== revision) return;
        state.progress = progress;
        emit();
      });
      if (selectedRevision !== revision) return;
      if (typeof url !== 'string' || !url.startsWith('https://')) throw new Error('사진 저장 주소를 받지 못했습니다. 다시 선택해주세요.');
      state.url = url;
    } catch (error) {
      if (selectedRevision !== revision) return;
      state.error = error;
    } finally {
      if (selectedRevision === revision) {
        state.uploading = false;
        state.file = null;
        emit();
      }
    }
  }

  return {
    snapshot, load, select,
    remove() {
      if (busy()) return;
      state.url = '';
      state.error = null;
      emit();
    },
    cancel() {
      if (busy()) return;
      state.url = state.initialUrl;
      state.error = null;
      emit();
    },
    setSaving(saving) { state.saving = saving; emit(); },
    markSaved() { state.initialUrl = state.url; state.error = null; emit(); },
    assertReady() {
      if (busy()) throw new Error('사진 업로드 또는 저장이 끝날 때까지 기다려주세요.');
      if (state.error) throw new Error('사진 업로드에 실패했습니다. 다시 선택하거나 ‘변경 취소’를 눌러주세요.');
    },
  };
}
