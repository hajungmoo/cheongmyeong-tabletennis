export function showPopupAtTop(dialog) {
  if (dialog.open) return;
  const view = dialog.ownerDocument.defaultView;
  const controller = new AbortController();
  const {signal} = controller;
  const pagePosition = {left: view.scrollX, top: view.scrollY, behavior: 'instant'};
  let untouched = true;
  const resetTop = () => {
    if (dialog.open && untouched && !signal.aborted) {
      dialog.scrollTo({left: 0, top: 0, behavior: 'instant'});
    }
  };

  for (const event of ['pointerdown', 'touchstart', 'wheel', 'keydown']) {
    dialog.addEventListener(event, () => { untouched = false; }, {capture: true, passive: true, signal});
  }
  dialog.querySelector('.popupImageWrap img')?.addEventListener('load', resetTop, {once: true, signal});
  dialog.addEventListener('close', () => controller.abort(), {once: true, signal});

  dialog.showModal();
  dialog.querySelector('[autofocus]')?.focus({preventScroll: true});
  resetTop();
  // Opening a notice must not move the page behind it to the footer.
  view.scrollTo(pagePosition);
  view.requestAnimationFrame(resetTop);
}
