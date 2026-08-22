const CACHE_NAME = "aether-player-v7";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./app_icon.jpg"
];

// Install Service Worker
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Service Worker
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Interceptor (Network-First, falling back to Cache)
self.addEventListener("fetch", (e) => {
  // Let the browser handle external audio streams directly
  if (e.request.url.includes("soundhelix.com")) {
    return;
  }
  
  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        // If it's a valid response, clone it and update the cache
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // If network fails (e.g. offline), return cached asset
        return caches.match(e.request);
      })
  );
});
