const CACHE_NAME = 'ab-control-hub-v11';
const urlsToCache = [
  '/',
  '/index.html',
  
  // Pages
  '/terms/index.html',
  '/privacy/index.html',
  '/support/index.html',
  '/guide/index.html',
  '/blog/index.html',
  '/blog/fake-controller-detection.html',
  '/blog/stick-drift-science.html',
  '/blog/dualsense-battery-optimization.html',
  '/blog/webhid-technology.html',

  // Styles
  '/css/main.css',
  '/css/finetune.css',
  '/fa.min.css',

  // Core Scripts
  '/js/core.js',
  '/js/utils.js',
  '/js/translations.js',
  '/js/template-loader.js',
  '/js/stick-renderer.js',
  '/js/ui-renderer.js',
  '/js/android-bridge.js',
  '/js/controller-manager.js',

  // Controllers Logic
  '/js/controllers/base-controller.js',
  '/js/controllers/ds4-controller.js',
  '/js/controllers/ds5-controller.js',
  '/js/controllers/ds5-edge-controller.js',
  '/js/controllers/controller-factory.js',

  // Modals Logic
  '/js/modals/calib-center-modal.js',
  '/js/modals/calib-range-modal.js',
  '/js/modals/finetune-modal.js',

  // Languages
  '/lang/en_us.json',
  '/lang/ar_ar.json',

  // Assets & Icons
  '/assets/dualsense-controller.svg',
  '/assets/dualshock-controller.svg',
  '/assets/icons.svg',
  '/background.webp',
  '/favicon.svg',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/favicon-96x96.png',
  '/site.webmanifest',

  // Blog Images
  '/assets/simple1.webp',
  '/assets/simple2.webp',
  '/assets/simple3.webp',
  '/assets/simple4.webp',
  '/assets/blog_images/circularity-test-comparison.webp',
  '/assets/blog_images/deadzone-vs-calibration-graph.webp',
  '/assets/blog_images/dualsense-power-consumption.webp',
  '/assets/blog_images/potentiometer-wear-diagram.webp',
  '/assets/blog_images/webhid-api-architecture.webp',

  // External Libraries (CDNs)
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
  'https://code.jquery.com/jquery-3.7.1.min.js',
  'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.6.0/css/all.min.css',

  // Templates
  '/templates/calib-center-modal.html',
  '/templates/auto-calib-center-modal.html',
  '/templates/range-modal.html',
  '/templates/finetune-modal.html',
  '/templates/popup-modal.html',
  '/templates/edge-modal.html',
  '/templates/edge-progress-modal.html',
  '/templates/donate-modal.html'
];

// Install Event
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        urlsToCache.map(url => {
          const request = new Request(url, { cache: 'reload' });
          return fetch(request).then(response => {
            if (!response.ok) throw new Error(`Failed to fetch ${url}`);
            return cache.put(url, response);
          }).catch(err => console.warn("Failed to cache:", url, err));
        })
      );
    })
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  if (!event.request.url.startsWith('http')) return;

  const url = new URL(event.request.url);

  // Ignore Google Ads & Analytics
  if (url.hostname.includes('google') || 
      url.hostname.includes('doubleclick') || 
      url.hostname.includes('adtrafficquality') ||
      url.hostname.includes('googlesyndication')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // 1. لو الملف في الكاش، هاته
      if (cachedResponse) return cachedResponse;
      
      // 2. لو مش في الكاش، حاول تجيبه من النت
      return fetch(event.request).catch(() => {
          // 3. لو النت قطع أو الرابط باظ (شبكة الأمان الجديدة)
          
          // لو المستخدم بيحاول يفتح صفحة HTML (زي Guide أو Blog) والنت قاطع
          if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
          }

          // لأي حاجة تانية (صور، سكربتات)، رجع رد فاضي بدل ما تضرب Error أحمر
          return new Response('', { status: 408, statusText: 'Request Timed Out' });
      });
    })
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});