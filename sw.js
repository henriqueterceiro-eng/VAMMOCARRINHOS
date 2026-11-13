// Service worker do app de carrinhos (13/11/2026).
// Antes o SW era registrado por URL blob: — o Chrome recusa esse protocolo, então NUNCA houve cache
// offline: se o Android matava a aba (câmera) e a página recarregava sem sinal, o app não abria.
// Regras (dado velho servido como novo é pior que erro):
//  1) página do check-in = REDE PRIMEIRO; o cache só entra se a rede falhar;
//  2) jsQR da CDN (URL com versão fixa, imutável) = cache primeiro;
//  3) todo o resto (gestor, encarregado, Apps Script) passa direto, sem SW.
const CACHE = 'vammo-cart-sw-v1';
const JSQR = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => fetch(new Request(JSQR, { mode: 'no-cors' })).then((r) => c.put(JSQR, r)))
      .catch(() => {})
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.href === JSQR) {
    e.respondWith(
      caches.match(JSQR).then((hit) => hit || fetch(req).then((resp) => {
        const cp = resp.clone();
        caches.open(CACHE).then((c) => c.put(JSQR, cp)).catch(() => {});
        return resp;
      }))
    );
    return;
  }
  if (u.origin === self.location.origin && /vammo_cart_checkin\.html$/.test(u.pathname)) {
    e.respondWith(
      fetch(req).then((resp) => {
        if (resp && resp.ok) {
          const cp = resp.clone();
          caches.open(CACHE).then((c) => c.put(u.pathname, cp)).catch(() => {});
        }
        return resp;
      }).catch(() => caches.match(u.pathname).then((hit) => hit || Response.error()))
    );
  }
});
