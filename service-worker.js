// Service worker do EnergyCalc — network-first pra tudo da própria origem
// (html/css/js/ícones), com fallback pro cache só quando offline. Chamada
// de API (outra origem/porta) nunca passa por aqui.
//
// Era cache-first antes (v1) — um bug real: uma vez que uma página entrava
// no cache, ela nunca mais era atualizada a partir do disco, mesmo depois
// de eu corrigir o código-fonte (o cache só é limpo quando CACHE_NAME muda,
// e cache-first nem tenta a rede se já existe uma entrada). Isso fazia
// telas antigas (login, links com .html, bugs já corrigidos) continuarem
// aparecendo indefinidamente pra quem já tinha visitado o app antes.
const CACHE_NAME = "energycalc-v4";

const APP_SHELL = [
  "./",
  "./manifest.json",
  "./css/tokens.css",
  "./css/base.css",
  "./css/componentes.css",
  "./css/layout.css",
  "./js/config.js",
  "./js/api.js",
  "./js/auth.js",
  "./js/layout.js",
  "./js/ui.js",
  "./partials/app-bar.html",
  "./partials/bottom-nav.html",
  "./partials/nav-publico.html",
  "./partials/modal-upgrade.html",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((c) => c !== CACHE_NAME).map((c) => caches.delete(c)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Só intercepta GET da própria origem — chamada de API (outra origem/porta)
  // e métodos de escrita passam direto pra rede, sem passar pelo cache.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((rede) => {
        const clone = rede.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return rede;
      })
      .catch(() => caches.match(request))
  );
});
