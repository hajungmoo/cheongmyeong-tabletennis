// Run in the head, before the browser can restore a previous page position.
(() => {
  let awaitingInteraction = true;

  function startFromHome() {
    try {
      history.scrollRestoration = 'manual';
      // A saved section fragment must not reopen the homepage halfway down.
      if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
    } catch {}
  }

  function resetTop() {
    if (!awaitingInteraction) return;
    window.scrollTo({top: 0, left: 0, behavior: 'instant'});
  }

  function resetAfterLayout() {
    resetTop();
    window.requestAnimationFrame(() => {
      resetTop();
      window.requestAnimationFrame(resetTop);
    });
  }

  // Late images, iframe loads and data must not interrupt someone already browsing.
  const letVisitorNavigate = () => { awaitingInteraction = false; };
  for (const event of ['pointerdown', 'touchstart', 'wheel', 'keydown']) {
    window.addEventListener(event, letVisitorNavigate, {capture: true, passive: true});
  }
  window.addEventListener('hashchange', letVisitorNavigate);
  window.addEventListener('pagehide', letVisitorNavigate);
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      awaitingInteraction = true;
      startFromHome();
    }
    resetAfterLayout();
  });
  document.addEventListener('DOMContentLoaded', resetAfterLayout, {once: true});
  window.addEventListener('load', resetAfterLayout, {once: true});
  document.addEventListener('cm-home-ready', resetAfterLayout, {once: true});

  startFromHome();
  resetTop();
})();
