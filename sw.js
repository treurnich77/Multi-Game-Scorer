const CACHE_NAME = "multi-game-scorer-v35";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=21",
  "./mvp.css?v=1",
  "./mobile-fix.css?v=3",
  "./polish.css?v=1",
  "./favourites.css?v=2",
  "./app.js?v=24",
  "./post-mvp.js?v=1",
  "./setup-fix.js?v=1",
  "./polish-pack.js?v=1",
  "./settings-label.js?v=2",
  "./favourites.js?v=1",
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
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();

    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    await Promise.all(windows.map(async (client) => {
      try {
        await client.navigate(client.url);
      } catch {}
    }));
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request, { cache: "no-store" });
        const cache = await caches.open(CACHE_NAME);
        cache.put("./index.html", response.clone()).catch(() => {});
        return response;
      } catch {
        return (await caches.match("./index.html")) || (await caches.match("./"));
      }
    })());
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
