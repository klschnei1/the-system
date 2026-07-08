const CACHE = 'css-v11';
const STATIC = ['datastore.js','finance.js','forecast.js','intake.js','intellect.js','juice.js','sensei.js','sigils.js','strength.js','themes.js','icon.svg','manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    // Network-first for HTML — always get fresh version
    e.respondWith(
      fetch(e.request).then(r => {
        const clone = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return r;
      }).catch(() => caches.match(e.request))
    );
  } else {
    // Network-first for JS/SVG too. The loader cache-busts with ?v=Date.now(),
    // so a cache-first match never hit anyway (query never matches) and stale
    // code could linger while junk entries piled up per-timestamp. Cache under
    // the bare pathname; offline falls back to it ignoring the querystring.
    e.respondWith(
      fetch(e.request).then(r => {
        const clone = r.clone();
        caches.open(CACHE).then(c => c.put(url.pathname, clone));
        return r;
      }).catch(() => caches.match(e.request, { ignoreSearch: true }))
    );
  }
});
