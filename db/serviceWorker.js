// Choose a cache name
const cacheName = 'cache-v1';

// When the service worker is installing, open the cache and add the precache resources to it
self.addEventListener('install', (event) => {
  console.log('Service worker install event!');
  event.waitUntil((async () => {
    try {
      const assetManifest = await (await fetch('./asset-manifest.json')).json();
      const precacheResources = [
        './',
        './favicon.ico',
        './logo192.png',
        './logo512.png'
      ].concat(Object.values(assetManifest.files))
      await caches.open(cacheName).then((cache) => cache.addAll(precacheResources))
      console.log(`Cached:`, precacheResources);
    } catch (err) {
      console.log('Could not find ./asset-manifest.json');
    }
  })())
});

self.addEventListener('activate', (event) => {
  console.log('Service worker activate event!');
});

// When there's an incoming fetch request, try and respond with a precached resource, otherwise fall back to the network
self.addEventListener('fetch', (event) => {
  console.log('Fetch intercepted for:', event.request.url);
  event.respondWith(
    caches.match(event.request).then(async (cachedResponse) => {
      if (cachedResponse) {
        console.log('From cache:', event.request.url);
        return cachedResponse;
      }
      console.log('Caching:', event.request.url);
      await caches.open(cacheName).then((cache) => cache.add(event.request.url));
      return caches.match(event.request)
    }),
  );
});
