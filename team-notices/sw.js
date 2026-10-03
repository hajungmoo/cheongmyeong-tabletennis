/* Keep this URL so previously installed notice apps can retire. */
const NOTICE_SCOPE = new URL('/team-notices/', self.location.origin).href;
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  try { const subscription = await self.registration.pushManager.getSubscription(); await subscription?.unsubscribe(); } catch {}
  try { (await self.registration.getNotifications()).forEach(notification => notification.close()); } catch {}
  try {
    const names = await caches.keys();
    await Promise.allSettled(names.filter(name => name.startsWith('cm-notices-shell-')).map(name => caches.delete(name)));
  } catch {}
  const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
  await self.registration.unregister();
  await Promise.allSettled(windows.filter(client => client.url.startsWith(NOTICE_SCOPE)).map(client => client.navigate(NOTICE_SCOPE)));
})()));
self.addEventListener('push', () => {});
self.addEventListener('notificationclick', event => event.notification.close());
