// 블로랩 회원 로그인 (카카오·네이버·구글)
// 쓰는 법: <script src="auth.js"></script> 를 넣으면 머리말 오른쪽에 로그인 버튼이 생김
//          BLAuth.me() → 로그인한 회원 정보, BLAuth.fetch("/주소") → 로그인 토큰을 붙여 서버에 물음
// 로그인 토큰은 이 기기 브라우저(localStorage)에만 둠. 서버는 토큰 값 대신 해시만 저장
// 로그인을 모두에게 열기 전에는 login.html?preview=1 로 한 번 연 브라우저에만 버튼이 보임
(function () {
  var API = "https://green-sunset-edd6.risingsk123.workers.dev";
  var LIVE = false; // 로그인 공개하는 날 true 로 (그날 개인정보처리방침도 같이 고침)
  var TK = "bl-token", NK = "bl-nick", PV = "bl-login-preview", PK = "bl-plan", BK = "bl-tokens", VK = "bl-login-v";
  function b64u(a) { var t = ""; for (var i = 0; i < a.length; i++) t += String.fromCharCode(a[i]); return btoa(t).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function get(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }
  function put(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} }
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var meP = null;
  var A = {
    api: API,
    on: function () { return LIVE || get(PV) === "1"; },
    preview: function (on) { put(PV, on ? "1" : ""); },
    token: function () { return get(TK); },
    nick: function () { return get(NK); },
    save: function (token, user) { put(TK, token); put(NK, user && user.nick); meP = null; paint(); },
    clear: function () { put(TK, ""); put(NK, ""); put(PK, ""); put(BK, ""); meP = null; paint(); },
    live: LIVE,
    // 사이트 안 주소만 (다른 사이트로 돌아가지 않게)
    safeRet: function (r) { r = String(r || ""); return /^\/(?![\/\\])[A-Za-z0-9._~\/-]*(\?[A-Za-z0-9._~%=&+-]*)?$/.test(r) && r.length <= 200 ? r : "/"; },
    fetch: function (path, opt) {
      opt = opt || {};
      var h = new Headers(opt.headers || {});
      var t = get(TK);
      if (t) h.set("Authorization", "Bearer " + t);
      if (opt.body && !h.has("Content-Type")) h.set("Content-Type", "application/json");
      opt.headers = h;
      return fetch(API + path, opt);
    },
    me: function (fresh) {
      if (!get(TK)) return Promise.resolve({ ok: true, login: false });
      if (!meP || fresh) {
        meP = A.fetch("/auth/me").then(function (r) { return r.json(); }).then(function (j) {
          if (j && j.ok && !j.login) A.clear(); // 기간이 지났거나 다른 곳에서 로그아웃함
          else if (j && j.login && j.user) { put(NK, j.user.nick); put(PK, j.user.plan === "pro" ? "pro" : ""); put(BK, j.user.tokens > 0 ? String(j.user.tokens) : ""); }
          return j;
        }).catch(function () { meP = null; return { ok: false, login: false, offline: true }; });
      }
      return meP;
    },
    // 로그인·로그인 방법 추가 시작. 이 브라우저만 아는 비밀값을 만들어 두고 그 해시만 서버에 보냄
    // → 돌아올 때 받는 1회용 코드는 이 비밀값이 있어야 쓸 수 있어서, 남이 만든 코드가 든 주소를 눌러도 로그인·연결이 안 됨
    start: function (p, ret, link) {
      var a = new Uint8Array(32); crypto.getRandomValues(a);
      var v = b64u(a); put(VK, v);
      crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)).then(function (d) {
        location.href = API + "/auth/" + p + "/start?" + (link ? "link=1" : "r=" + encodeURIComponent(A.safeRet(ret))) + "&v=" + b64u(new Uint8Array(d));
      });
    },
    verifier: function () { return get(VK); },
    verifierDone: function () { put(VK, ""); },
    login: function (p, ret) { A.start(p, ret, false); },
    logout: function () {
      var t = get(TK);
      A.clear();
      if (!t) return Promise.resolve();
      return fetch(API + "/auth/logout", { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: "{}" }).catch(function () {});
    },
    withdraw: function () {
      return A.fetch("/auth/withdraw", { method: "POST", body: "{}" }).then(function (r) { return r.json(); }).then(function (j) { if (j && j.ok) A.clear(); return j; })
        .catch(function () { return { ok: false, error: "인터넷 연결을 확인하고 다시 해 주세요." }; });
    }
  };
  window.BLAuth = A;

  // ---- 머리말 로그인 버튼 ----
  var btn = null;
  function here() { return location.pathname + location.search; }
  function paint() {
    if (!btn) return;
    var nick = get(TK) ? (get(NK) || "내 정보") : "";
    if (nick) {
      btn.className = "sh-acct in";
      btn.href = "login.html";
      btn.setAttribute("aria-label", nick + "님, 내 정보 보기");
      var pro = get(PK) === "pro", tok = +get(BK) || 0;
      btn.setAttribute("aria-label", nick + "님" + (pro ? ", PRO" : "") + (tok ? ", 충전 토큰 " + tok + "개" : "") + ", 내 정보 보기");
      btn.innerHTML = '<span class="av' + (pro ? " pro" : "") + '" aria-hidden="true">' + esc(Array.from(nick)[0]) + '</span><span class="nm">' + esc(nick) + "</span>" +
        (pro ? '<span class="tg" aria-hidden="true">PRO</span>' : "") + (tok ? '<span class="tk" aria-hidden="true">' + tok.toLocaleString("ko-KR") + "</span>" : "");
    } else {
      btn.className = "sh-acct";
      btn.href = "login.html?r=" + encodeURIComponent(A.safeRet(here()));
      btn.removeAttribute("aria-label");
      btn.textContent = "로그인";
    }
  }
  function mount() {
    if (!A.on() || btn) return;
    var row = document.querySelector("header.sh .sh-in");
    if (!row || /\/login\.html$/.test(location.pathname)) return;
    btn = document.createElement("a");
    row.insertBefore(btn, row.querySelector(".menu"));
    paint();
    if (get(TK)) A.me().then(paint);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
