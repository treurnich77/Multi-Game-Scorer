const CACHE_NAME = "multi-game-scorer-v22";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=21",
  "./app.js?v=21",
  "./games/index.js?v=21",
  "./games/shared.js?v=12",
  "./games/fiveHundred.js?v=12",
  "./games/spades.js?v=12",
  "./games/hearts.js?v=12",
  "./games/canasta.js?v=14",
  "./games/golf.js?v=18",
  "./games/euchre.js?v=19",
  "./games/ohHell.js?v=19",
  "./games/phase10.js?v=19",
  "./games/general.js?v=19",
  "./games/cribbage.js?v=21",
  "./manifest.json?v=14",
  "./icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
