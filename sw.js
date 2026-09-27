// Service worker de la PWA del tacómetro.
//
// OJO con la estrategia de caché: la versión anterior era cache-first con un
// nombre fijo, y eso CONGELA la app. Una vez que el teléfono guardaba la
// copia, el caches.match() de abajo encontraba siempre esa misma copia vieja
// y la app instalada nunca volvía a pedir una versión nueva. Como el archivo
// del service worker tampoco cambiaba, el navegador ni siquiera reinstallaba
// el worker. En la práctica: desplegar una actualización no llegaba nunca al
// teléfono, sin dar ningún error visible.
//
// Ahora es stale-while-revalidate: se sirve la copia guardada al instante
// (arranca sin red) y en paralelo se pide la nueva al servidor, que queda
// para la próxima apertura. Además el nombre de caché lleva versión, para que
// al cambiar este archivo se limpien las copias viejas.
const CACHE = 'tacometro-v5';
const ASSETS = ['index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Solo lo nuestro: el resto (puente BLE, etc.) que pase de largo.
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    caches.open(CACHE).then((cache) => {
      const red = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null); // sin red: se sigue con lo guardado

      return cache.match(req).then((hit) => hit || red.then((r) => r || Response.error()));
    })
  );
});
