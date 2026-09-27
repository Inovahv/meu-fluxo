/* Meu Fluxo — Service Worker
   Objetivos:
   - Tornar o app instalável (PWA) e abrível offline (casca do app).
   - NUNCA armazenar em cache os dados privados (chamadas à API do Supabase).
   - Buscar sempre a versão nova quando houver rede, com queda para o cache.
   Ao publicar uma nova versão do app, altere VERSION para forçar a atualização. */
const VERSION = 'v1.1.0';
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
  './icons/apple-touch-icon.png',
  './icons/badge-72.png'
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

/* =========================================================================
   Web Push — notificações do sistema (funcionam com o app fechado)
   O corpo do push é um JSON: {titulo, corpo, rota, tag, tipo}. O envio é
   feito pelo servidor (Supabase Edge Function); aqui apenas exibimos a
   notificação e tratamos o toque nela.
   ========================================================================= */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; }
  catch (_) { d = { corpo: e.data ? e.data.text() : '' }; }
  const titulo = d.titulo || 'Meu Fluxo';
  const rota = d.rota || 'visao-geral';
  const tag = d.tag || ('mf:' + Date.now());
  const opts = {
    body: d.corpo || '',
    icon: './icons/icon-192.png',
    badge: './icons/badge-72.png',
    tag: tag,
    renotify: true,
    lang: 'pt-BR',
    data: { rota: rota, tipo: d.tipo || '', tag: tag }
  };
  e.waitUntil(self.registration.showNotification(titulo, opts));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const rota = (e.notification.data && e.notification.data.rota) || 'visao-geral';
  const destino = new URL('./', self.registration.scope);
  destino.hash = '#/' + rota;
  const href = destino.href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of wins) {
      // Já existe uma janela do app aberta: foca e navega para a área do aviso.
      if ('focus' in c) {
        try { await c.focus(); } catch (_) {}
        try { c.postMessage({ tipo: 'abrir-rota', rota: rota }); } catch (_) {}
        if ('navigate' in c) { try { await c.navigate(href); } catch (_) {} }
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(href);
  })());
});

/* Se o navegador trocar a inscrição, tenta reinscrever e pede à página que
   ressincronize o registro no servidor (vinculando ao usuário atual). */
self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil((async () => {
    try {
      const antiga = e.oldSubscription;
      const appKey = antiga && antiga.options && antiga.options.applicationServerKey;
      if (self.registration.pushManager && appKey) {
        await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
      }
    } catch (_) {}
    const wins = await self.clients.matchAll({ includeUncontrolled: true });
    wins.forEach((c) => { try { c.postMessage({ tipo: 'resync-push' }); } catch (_) {} });
  })());
});
