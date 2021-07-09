// Choose a cache name
const ignore = [
  'manifest.json'
]
const cacheName = 'cache-v1';
const precache = [
  './',
  './favicon.ico',
  './logo192.png',
  './logo512.png'
];
let cached = [].concat(precache);
// When the service worker is installing, open the cache and add the precache resources to it
self.addEventListener('install', (event) => {
  console.log('Service worker install event!');
  event.waitUntil((async () => {
    try {
      const assetManifest = await (await fetch('./asset-manifest.json')).json();
      cached = precache.concat(Object.values(assetManifest.files))
      await caches.open(cacheName).then((cache) => cache.addAll(cached))
      console.log(`Cached:`, cached);
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
  const url = event.request.url;
  console.log('Fetch intercepted for:', url);
  if (ignore.find(ig => url.includes(ig))) {
    return fetch(url, {cache: "reload"});
  }
  event.respondWith(
    caches.match(event.request).then(async (cachedResponse) => {
      cached.push(url);
      if (cachedResponse) {
        console.log('From cache:', url);
        return cachedResponse;
      }
      console.log('Caching:', url);
      await caches.open(cacheName).then((cache) => cache.add(url));
      return caches.match(event.request)
    }),
  );
});

// in the service worker
self.addEventListener('message', async (event) => {
  // event is an ExtendableMessageEvent object
  console.log(`The client sent me a message: ${event.data}`);
  switch (event.data) {
    case "hi":
      event.source.postMessage("hi");
      return;
    case "update": {
      await caches.open(cacheName).then((cache) => {
        for (const url of cached) {
          cache.delete(url);
        }
      })
      event.source.postMessage("refresh");
      return;
    }
    default:
      return;
  }

});
