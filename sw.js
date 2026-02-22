// The version of the cache.
const VERSION = "v2.1";

let APP_PREFIX = 'index';
// The name of the cache
const CACHE_NAME = APP_PREFIX + VERSION

let GHPATH = '/index';

// The static resources that the app needs to function.
const URLS = [
  `${GHPATH}/`,
  `${GHPATH}/index.html`,
  `${GHPATH}/style.css`,
  `${GHPATH}/icons/indexIcon.png`,
  `${GHPATH}/app.js`
];

self.addEventListener("fetch", (event) => {
  if (event.request.url.includes("wikipedia.org/w/api.php")) {
    event.respondWith(networkFirst(event.request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const networkResponse = await fetch(request);

    // Update cache
    cache.put(request, networkResponse.clone());

    return networkResponse;

  } catch (error) {
    // If offline, return cached version
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    return new Response(
      JSON.stringify({ error: "Offline and no cached data" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      cache.addAll(URLS);
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('Deleting cache : ');
            return caches.delete(name);
          }
          return undefined;
        }),
      );
      await clients.claim();
    })(),
  );
});