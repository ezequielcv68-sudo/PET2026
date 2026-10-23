// PetMatch — service worker mínimo.
// Siempre pide primero a internet (nunca te deja con una versión vieja de la página);
// solo usa la copia guardada si no hay conexión.
const CACHE = "petmatch-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(r)
      .then((res) => {
        if (res.ok && r.mode === "navigate") {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(r, copia));
        }
        return res;
      })
      .catch(() => caches.match(r).then((m) => m || caches.match("/index.html")))
  );
});
