/* Service worker propio de Abrigo: avisos push y una página de respaldo sin conexión. */
const CACHE = "abrigo-shell-v1";
const SHELL = ["/", "/manifest.json", "/logo192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Navegación: red primero; sin conexión, la app desde caché (las líneas de crisis están en el bundle).
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/")));
    return;
  }
  if (url.pathname.startsWith("/_expo/") || url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
  }
});

// Avisos discretos: el contenido nunca incluye datos sensibles.
self.addEventListener("push", (event) => {
  let data = { title: "Abrigo", body: "Tenés un aviso nuevo", url: "/" };
  try {
    data = Object.assign(data, event.data ? event.data.json() : {});
  } catch (_) {
    /* payload inválido: se usa el texto genérico */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/logo192.png",
      badge: "/logo192.png",
      tag: "abrigo",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) {
          w.navigate(target);
          return w.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
