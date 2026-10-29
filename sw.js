const CACHE_NAME = 'tikko-player-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './jsmediatags.min.js',
  './manifest.json'
];

// Instalação do Service Worker e salvamento dos ficheiros em cache local
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Interceção de requisições: entrega do cache quando estiver sem internet
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});