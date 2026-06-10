// Proxy push-only service worker.
//
// INTENTIONAL SCOPE: this SW exists ONLY to handle Web Push notifications
// and their click events. It does NOT cache any resources and does NOT
// intercept fetches. A previous version of this file cached Next.js chunks
// cache-first, which caused ChunkLoadError on every deploy. By avoiding
// caching entirely, we get push notifications without any risk of serving
// stale bundles.
//
// If we ever want offline support back (cached shell, offline page, etc.),
// do it via a separate cache name that is NOT in /sw-killswitch.js's
// OLD_CACHES list, and use Stale-While-Revalidate for HTML, Network-First
// for JS chunks (NEVER Cache-First on _next/static).

self.addEventListener("install", () => {
  // Activate immediately on install
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Claim existing clients so the push handler is active without a reload
  event.waitUntil(self.clients.claim());
});

// Intentionally NO fetch handler. Letting the browser handle all requests
// natively means we never cache stale bundles.

// Push notification received from the server
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Proxy", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "Proxy", {
      body: payload.body || "",
      icon: "/brand/app-icon-light-192.png",
      badge: "/brand/favicon-32.png",
      data: payload.data || { url: "/portal/messages" },
      tag: payload.tag || "proxy-message",
      renotify: true,
    }),
  );
});

// Notification clicked: focus existing portal tab or open a new one
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/portal/messages";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.includes("/portal") && "focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
