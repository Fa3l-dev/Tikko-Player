const CACHE_NAME = 'tikko-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './jsmediatags.min.js',
  './manifest.json'
];

// Salva todos os arquivos na memória do celular na hora da instalação
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Responde sempre com os arquivos locais do celular, sem buscar na internet
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});