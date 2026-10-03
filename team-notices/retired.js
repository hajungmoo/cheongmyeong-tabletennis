/* Only this retired notice app's device state is removed. */
(async () => {
  const scope = new URL('/team-notices/', location.origin).href;
  try { localStorage.removeItem('cm-notices-member'); } catch {}
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(registrations.filter(reg => reg.scope === scope).map(async reg => {
        try { await reg.update(); } catch {}
        try { const subscription = await reg.pushManager.getSubscription(); await subscription?.unsubscribe(); } catch {}
        try { (await reg.getNotifications()).forEach(notification => notification.close()); } catch {}
        await reg.unregister();
      }));
    } catch {}
  }
  try {
    const names = await caches.keys();
    await Promise.allSettled(names.filter(name => name.startsWith('cm-notices-shell-')).map(name => caches.delete(name)));
  } catch {}
})();
