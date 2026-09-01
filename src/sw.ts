/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Supabase Storage — never cache
registerRoute(
  ({ url }) => url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/storage'),
  new NetworkOnly()
);

// Supabase Auth — never cache
registerRoute(
  ({ url }) => url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/auth'),
  new NetworkOnly()
);

// Supabase Edge Functions — never cache
registerRoute(
  ({ url }) => url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/functions'),
  new NetworkOnly()
);

// Supabase REST API — network first with 24h cache
registerRoute(
  ({ url }) => url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest'),
  new NetworkFirst({
    cacheName: 'supabase-data',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }),
    ],
    networkTimeoutSeconds: 5,
  })
);

// ── Push Notifications ───────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const { title, body, icon, badge, tag, url, data } = payload;

    event.waitUntil(
      self.registration.showNotification(title || 'Nautium', {
        body: body || '',
        icon: icon || '/icon-192.png',
        badge: badge || '/icon-192.png',
        tag: tag || 'nautium-alert',
        data: { url: url || '/', ...data },
        vibrate: [200, 100, 200],
        requireInteraction: true,
      })
    );
  } catch {
    event.waitUntil(
      self.registration.showNotification('Nautium', {
        body: event.data.text(),
        icon: '/icon-192.png',
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
