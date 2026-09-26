/* Meu Fluxo — Service Worker
   Objetivos:
   - Tornar o app instalável (PWA) e abrível offline (casca do app).
   - NUNCA armazenar em cache os dados privados (chamadas à API do Supabase).
   - Buscar sempre a versão nova quando houver rede, com queda para o cache.
   Ao publicar uma nova versão do app, altere VERSION para forçar a atualização. */
const VERSION = 'v1.0.0';
const CACHE = 'meufluxo-' + VERSION;

/* Casca essencial (mesma origem). start_url "." resolve para a pasta do app. */
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png'
];

/* Bibliotecas/fontes externas seguras de cachear (estáticas e versionadas). */
const CDN = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com', 'code.jquery.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(CORE))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // POST/PUT (ex.: dados no Supabase) passam direto

  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  // Navegações: rede primeiro (pega atualizações), cai no index em cache se offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
          return r;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  const mesmaOrigem = url.origin === self.location.origin;
  const ehCDN = CDN.indexOf(url.hostname) !== -1;

  // Estáticos da app e bibliotecas: stale-while-revalidate.
  if (mesmaOrigem || ehCDN) {
    e.respondWith(
      caches.open(CACHE).then(async (c) => {
        const cached = await c.match(req);
        const net = fetch(req)
          .then((r) => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; })
          .catch(() => null);
        return cached || net || fetch(req);
      })
    );
    return;
  }

  // Demais destinos (ex.: *.supabase.co, realtime) — sem interceptar: rede direta,
  // garantindo que dados privados nunca sejam gravados em cache.
});
