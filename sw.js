// 체험단모아 서비스 워커: 홈 화면 추가(앱처럼 설치)와 '공유하기로 받기'를 위해서만 있어요.
// 아무것도 저장(캐시)하지 않아서 사이트를 고치면 바로 최신 내용이 보여요.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
