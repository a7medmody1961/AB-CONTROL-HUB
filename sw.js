// 1. اسم الكيش (غيرنا الرقم عشان نضمن التحديث)
const CACHE_NAME = 'ab-control-hub-v12-simple';

// 2. الملفات اللي هنخزنها
// شلنا './' المعقدة وخليناها بسيطة عشان تشتغل في أي فولدر
const urlsToCache = [
  'index.html',
  'js/core.js',
  'js/utils.js',
  'js/controller-manager.js',
  'css/main.css',
  'css/finetune.css'
];

// 3. حدث التثبيت (Install)
self.addEventListener('install', (event) => {
  self.skipWaiting(); // عشان التحديث يشتغل فوراً
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching files...');
      // هنا التريك: بنستخدم addAll بس لو فشل ملف واحد مش هيوقف الباقي
      return cache.addAll(urlsToCache).catch(err => {
          console.warn('Some files failed to cache, but continuing:', err);
      });
    })
  );
});

// 4. حدث الجلب (Fetch) - ده اللي بيجيب الملفات
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // لو الملف في الكيش، هاته
      if (response) {
        return response;
      }
      
      // لو مش في الكيش، هاته من النت
      return fetch(event.request).then((networkResponse) => {
          // لو الملف رجع سليم (200 OK)، خزنه في الكيش للمرة الجاية
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, responseToCache);
              });
          }
          return networkResponse;
      }).catch(() => {
          // لو النت فاصل والملف مش في الكيش، مش مشكلة، التطبيق لسه هيشتغل لو الملفات الأساسية موجودة
          // ممكن هنا نرجع صفحة "Offline" لو حبينا
      });
    })
  );
});

// 5. حدث التفعيل (Activate) - تنظيف الكيش القديم
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