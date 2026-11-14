// 블로랩 서비스 워커: 홈 화면 추가(앱처럼 설치), '공유하기로 받기', 예약 발행 알림(푸시)을 위해서만 있어요.
// 아무것도 저장(캐시)하지 않아서 사이트를 고치면 바로 최신 내용이 보여요.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
// 예약 발행 알림: 서버가 보낸 푸시를 알림으로 띄움
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) {}
  e.waitUntil(self.registration.showNotification(d.title || "블로랩", { body: d.body || "", icon: "/icon-192.png", badge: "/icon-192.png", tag: d.tag || "bloglab", data: { url: d.url || "/draft.html" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/draft.html", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if (c.url.split("#")[0].split("?")[0] === url && "focus" in c) return c.focus();
    return self.clients.openWindow(url);
  }));
});
