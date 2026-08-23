/* แคชเปลือกแอปไว้ให้เปิดได้ตอนเน็ตหลุด — ถ้าออนไลน์จะเอาของใหม่ก่อนเสมอ */
const CACHE = "ttt-advance-v1";
const SHELL = ["./", "./index.html", "./icon.png", "./manifest.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;                        /* POST ไป Apps Script ปล่อยผ่าน */
  if (new URL(req.url).origin !== location.origin) return; /* ฟอนต์ Google ปล่อยผ่าน */
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
  );
});
