const CACHE_NAME = 'rfu-cache-v2';
const OFFLINE_URL = '/';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        'https://richfarmunity.com/icon-192.png'
      ]).catch(() => {
        // si un fichier manque, on continue quand même l'installation
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Jamais de cache pour les appels à Supabase (données, authentification, stockage) :
  // toujours du réseau frais, pour que les nouvelles annonces/formations apparaissent
  // immédiatement, même après un simple rafraîchissement.
  if (url.hostname.endsWith('supabase.co')) {
    event.respondWith(fetch(req));
    return;
  }

  // Navigation (ouverture d'une page) : réseau en priorité, page mise en cache si hors-ligne
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/', resClone));
          return res;
        })
        .catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Autres ressources statiques (images, polices, icônes du site) : cache si dispo, sinon réseau
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const resClone = res.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
      return res;
    }).catch(() => cached))
  );
});

self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Rĩch Farm Unity';
  const options = {
    body: data.body || '',
    icon: 'https://richfarmunity.com/icon-192.png',
    badge: 'https://richfarmunity.com/icon-192.png',
    data: { url: data.url || 'https://richfarmunity.com' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
