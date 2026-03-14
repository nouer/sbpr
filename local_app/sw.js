/**
 * sw.js - シンプル血圧記録 (sbpr) Service Worker
 * アセットキャッシュによる完全オフライン対応
 */

const CACHE_NAME = 'sbpr-v1.0.0-1773468396';

const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/bp.calc.js',
    '/version.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/icons/icon-maskable.png',
    '/icons/splash/splash-640x1136.png',
    '/icons/splash/splash-750x1334.png',
    '/icons/splash/splash-1125x2436.png',
    '/icons/splash/splash-828x1792.png',
    '/icons/splash/splash-1170x2532.png',
    '/icons/splash/splash-1179x2556.png',
    '/icons/splash/splash-1290x2796.png',
    '/icons/splash/splash-1320x2868.png',
    '/icons/splash/splash-1536x2048.png',
    '/icons/splash/splash-1668x2388.png',
    '/icons/splash/splash-2048x2732.png',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js',
    'https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE_ASSETS))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    if (url.pathname.startsWith('/openai/') || url.pathname.startsWith('/api/openai')) {
        return;
    }

    if (url.pathname === '/notify.html') {
        return;
    }

    if (url.pathname === '/manual.html' || url.pathname === '/promotion.html' || url.pathname === '/usecases_showcase.html') {
        return;
    }

    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cached) => {
                if (cached) {
                    return cached;
                }
                return fetch(event.request).then((response) => {
                    if (!response || response.status !== 200 || response.type === 'opaque') {
                        return response;
                    }
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                });
            })
            .catch(() => {
                if (event.request.destination === 'document') {
                    return caches.match('/index.html');
                }
            })
    );
});
