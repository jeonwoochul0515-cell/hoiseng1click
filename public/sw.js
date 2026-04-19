const CACHE_NAME = 'hoiseng1click-v7';
const STATIC_ASSETS = ['/manifest.json', '/icon-192.svg', '/icon-512.svg', '/offline.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
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
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // API 호출은 캐시하지 않음
  if (url.pathname.startsWith('/api') || url.hostname.includes('run.app') || url.hostname.includes('codef') || url.hostname.includes('workers.dev')) return;

  // HTML/JS: 네트워크 우선, 실패 시 오프라인 페이지
  if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('.js')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match('/offline.html'))
      )
    );
    return;
  }

  // 폰트, 이미지 등 정적 자산: 캐시 우선
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('/offline.html'));
    })
  );
});
