const CACHE_NAME = 'ab-control-hub-v4';
const urlsToCache = [
  './',
  './terms/index.html',    
  './privacy/index.html',  
  './support/index.html',  
  './guide/index.html',    
  './blog/index.html',     
  './css/main.css',
  './css/finetune.css',
  './fa.min.css',
  './js/core.js',
  './js/utils.js',
  './js/translations.js',
  './js/template-loader.js',
  './js/stick-renderer.js',
  './js/controller-manager.js',
  './js/controllers/base-controller.js',
  './js/controllers/ds4-controller.js',
  './js/controllers/ds5-controller.js',
  './js/controllers/ds5-edge-controller.js',
  './js/controllers/controller-factory.js',
  './js/modals/calib-center-modal.js',
  './js/modals/calib-range-modal.js',
  './js/modals/finetune-modal.js',
  './lang/en_us.json',
  './lang/ar_ar.json',
  './assets/dualsense-controller.svg',
  './assets/dualshock-controller.svg',
  './assets/icons.svg',
  './background.webp',
  './favicon.svg',
  './favicon.ico',
  './apple-touch-icon.png',
  './site.webmanifest',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
  'https://code.jquery.com/jquery-3.7.1.min.js',
  'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.6.0/css/all.min.css',
  './templates/calib-center-modal.html',
  './templates/auto-calib-center-modal.html',
  './templates/range-modal.html',
  './templates/finetune-modal.html',
  './templates/popup-modal.html',
  './templates/edge-modal.html',
  './templates/edge-progress-modal.html'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache app shell immediately
      return Promise.all(
        urlsToCache.map(url => {
          return cache.add(url).catch(err => {
             console.warn("Failed to cache:", url, err);
             // Ignore individual file failures to not break install
          });
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Ignore non-http requests
  if (!event.request.url.startsWith('http')) return;
  
  // Only handle requests to our own origin (GitHub Pages) for caching
  // Let external requests (Google Ads, Analytics) go straight to network
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
     return; // Browser handles this as normal network request
  }

  // For our own files: Network First Strategy
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // If we got a valid response from network
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            // Clone it and update cache for next time we are offline
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
            });
        }
        return networkResponse;
      })
      .catch(() => {
        // Network failed (Offline mode) -> Fallback to Cache
        return caches.match(event.request).then(response => {
            if (response) return response;
            // Fallback for root path if exact match fails
            if (url.pathname.endsWith('/')) {
                return caches.match('index.html');
            }
        });
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            // Clean up old caches
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});
