const CACHE_NAME = "png-snip-v0.1.5";

function appUrl(path = "") {
  return new URL(path, self.registration.scope).toString();
}

const APP_SHELL = [appUrl(), appUrl("manifest.webmanifest"), appUrl("icon.svg")];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then((cached) => cached || caches.match(appUrl()))));
});
