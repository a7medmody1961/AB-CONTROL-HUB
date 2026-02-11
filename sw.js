const CACHE_NAME = 'ab-control-hub-v7'; // Updated to V7
const urlsToCache = [
  './',
  './index.html',
  
  // Pages
  './terms/index.html',
  './privacy/index.html',
  './support/index.html',
  './guide/index.html',
  './blog/index.html',
  './blog/fake-controller-detection.html',      // New
  './blog/stick-drift-science.html',            // New
  './blog/dualsense-battery-optimization.html', // New
  './blog/webhid-technology.html',              // New

  // Styles
  './css/main.css',
  './css/finetune.css',
  './fa.min.css',

  // Core Scripts
  './js/core.js',
  './js/utils.js',
  './js/translations.js',
  './js/template-loader.js',
  './js/stick-renderer.js',
  './js/ui-renderer.js',        // Missing in V6
  './js/android-bridge.js',     // Missing in V6
  './js/controller-manager.js',

  // Controllers Logic
  './js/controllers/base-controller.js',
  './js/controllers/ds4-controller.js',
  './js/controllers/ds5-controller.js',
  './js/controllers/ds5-edge-controller.js',
  './js/controllers/controller-factory.js',

  // Modals Logic
  './js/modals/calib-center-modal.js',
  './js/modals/calib-range-modal.js',
  './js/modals/finetune-modal.js',

  // Languages
  './lang/en_us.json',
  './lang/ar_ar.json',

  // Assets & Icons
  './assets/dualsense-controller.svg',
  './assets/dualshock-controller.svg',
  './assets/icons.svg',
  './background.webp',
  './favicon.svg',
  './favicon.ico',
  './apple-touch-icon.png',
  './favicon-16x16.png', // Added
  './favicon-32x32.png', // Added
  './favicon-96x96.png', // Added
  './site.webmanifest',

  // Blog & Guide Images (Critical for offline reading)
  './assets/simple1.webp',
  './assets/simple2.webp',
  './assets/simple3.webp',
  './assets/simple4.webp',
  './assets/blog_images/circularity-test-comparison.webp',
  './assets/blog_images/deadzone-vs-calibration-graph.webp',
  './assets/blog_images/dualsense-power-consumption.webp',
  './assets/blog_images/potentiometer-wear-diagram.webp',
  './assets/blog_images/webhid-api-architecture.webp',

  // External Libraries (CDNs)
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
  'https://code.jquery.com/jquery-3.7.1.min.js',
  'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.6.0/css/all.min.css',

  // HTML Templates
  './templates/calib-center-modal.html',
  './templates/auto-calib-center-modal.html',
  './templates/range-modal.html',
  './templates/finetune-modal.html',
  './templates/popup-modal.html',
  './templates/edge-modal.html',
  './templates/edge-progress-modal.html',
  './templates/donate-modal.html' // Missing in V6
];

// Install Event: Cache all files
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use simple addAll for stricter caching, or map/catch for resilience
      return Promise.all(
        urlsToCache.map(url => {
          return cache.add(url).catch(err => {
             console.warn("Failed to cache:", url, err);
          });
        })
      );
    })
  );
});

// Fetch Event: Network First, Fallback to Cache
self.addEventListener('fetch', (event) => {
  // Ignore non-http requests (like chrome-extension://)
  if (!event.request.url.startsWith('http')) return;
  
  // NOTE: We REMOVED the check that ignores cross-origin requests
  // so that CDN files (Bootstrap/jQuery) can be served from cache when offline.

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // If network fetch is successful, return it and update cache
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
          return networkResponse;
        }

        // Clone response to put in cache
        const responseToCache = networkResponse.clone();
        
        caches.open(CACHE_NAME).then((cache) => {
           // Put in cache only if it matches our list or is same origin
           // (Optional: You can cache everything visited, but here we keep it safe)
           if (event.request.method === 'GET') {
               cache.put(event.request, responseToCache);
           }
        });

        return networkResponse;
      })
      .catch(() => {
        // Network failed (Offline) -> Try Cache
        return caches.match(event.request).then(response => {
           if (response) return response;
           
           // Fallback for Navigation (HTML pages)
           if (event.request.mode === 'navigate') {
               return caches.match('./index.html');
           }
        });
      })
  );
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});