// اسم الكيش بتاعنا - تم التحديث للإصدار التاسع لضمان تحميل إصلاحات الدراع
const CACHE_NAME = 'ab-control-hub-v9-force-fix';

// الملفات الأساسية اللي عاوزينها تشتغل أوفلاين
// تم إضافة المسارات المهمة (./) لضمان العمل داخل مجلدات GitHub
const urlsToCache = [
  './',
  './index.html',
  './site.webmanifest',
  './favicon.ico',
  './background.png',
  // نحدد ملفات الـ JS والـ CSS الأساسية عشان نضمن تحديثها
  './js/core.js',
  './js/utils.js',
  './js/controller-manager.js',
  './css/main.css'
];

// 1. حدث التثبيت (Install) - بيخزن الملفات الأساسية
self.addEventListener('install', (event) => {
  // Force the waiting service worker to become the active service worker.
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache: ' + CACHE_NAME);
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. حدث الجلب (Fetch) - بيجيب الملفات من الكيش لو موجودة
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // لو الملف موجود في الكيش، رجّعه
        if (response) {
          return response;
        }

        // لو مش موجود، روح هاته من النت
        return fetch(event.request).then(
          (networkResponse) => {
            // تأكد إن الاستجابة سليمة (مش 404 مثلاً) قبل التخزين
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // لو جبته، خزنه في الكيش للمرة الجاية ورجّعه
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        );
      })
  );
});

// 3. حدث التفعيل (Activate) - بيمسح الكيش القديم لو عملنا إصدار جديد
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // تجعل الـ Service Worker الجديد يتحكم في الصفحة فوراً
      return self.clients.claim();
    })
  );
});
