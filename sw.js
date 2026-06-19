const CACHE_NAME = "jk-order-helper-shell-v1";
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icon.svg"
];
const CACHEABLE_API = [
  "/api/address/places",
  "/api/ocr/tesseract.min.js",
  "/api/ocr/worker.min.js",
  "/api/ocr/core/tesseract-core-simd.wasm.js",
  "/api/ocr/core/tesseract-core-simd.wasm",
  "/api/ocr/core/tesseract-core.wasm.js",
  "/api/ocr/core/tesseract-core.wasm",
  "/api/ocr/lang/chi_tra.traineddata.gz",
  "/api/ocr/lang/eng.traineddata.gz"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (CACHEABLE_API.includes(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/index.html"));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, fallbackPath) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return caches.match(fallbackPath);
  }
}
