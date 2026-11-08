// 블로그 찾기: 아이디 칸에 아이디나 블로그 이름·별명을 치면 칸 바로 아래에 블로그 목록을 보여 줌 (인스타 검색처럼)
// 쓰는 법: BlogSuggest.attach(입력칸, { onPick: function (아이디) { ... }, recent: true })
//          보내기 전에 BlogSuggest.ask(입력칸) 이 true 면 (블로그 이름을 친 경우) 목록에서 고르게 하고 멈춤
// 검색어는 저장하지 않음. 최근 본 블로그는 이 기기 브라우저에만 있음 (히스토리 페이지가 남기는 목록)
(function () {
  var W = "https://green-sunset-edd6.risingsk123.workers.dev/";
  var RKEY = "chmoa-recent-blogs";
  var cache = new Map(), n = 0;
  var KO = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  // 주소·아이디처럼 생겼으면 목록 없이 바로 보내도 됨
  var direct = function (v) { v = String(v || "").trim(); return /[./:]/.test(v) || /^@?[A-Za-z0-9_-]{3,30}$/.test(v); };
  var okId = function (x) { return x && /^[a-z0-9_-]{3,30}$/.test(x.id); };
  function recent() { try { return (JSON.parse(localStorage.getItem(RKEY) || "[]") || []).filter(okId).slice(0, 5); } catch (e) { return []; } }
  function addCss() {
    if (document.getElementById("bsCss")) return;
    var s = document.createElement("style");
    s.id = "bsCss";
    s.textContent =
      ".bs-wrap{position:relative}" +
      ".bs-box{position:absolute;z-index:40;box-sizing:border-box;background:var(--card,#fff);color:var(--text,#0e1a2b);border:1px solid var(--line,#e3e8ee);border-radius:14px;box-shadow:0 14px 34px rgba(8,16,28,.22);padding:6px;max-height:min(372px,62vh);overflow:auto;text-align:left;font-size:14px;line-height:1.35}" +
      ".bs-head{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 10px 4px;font-size:12px;color:var(--sub,#4a5a70);font-weight:600;letter-spacing:.02em}" +
      ".bs-head button{border:0;background:none;color:var(--sub,#4a5a70);font:inherit;font-weight:500;text-decoration:underline;cursor:pointer;padding:2px}" +
      ".bs-it{display:flex;align-items:center;gap:11px;padding:8px 10px;border-radius:10px;cursor:pointer}" +
      ".bs-it:hover,.bs-it[aria-selected=true]{background:var(--chip,#e8f4ee)}" +
      ".bs-av{position:relative;flex:0 0 40px;width:40px;height:40px;border-radius:50%;background:var(--navy,#0e1a2b);color:var(--mint,#2bd48a);display:grid;place-items:center;font-weight:700;font-size:16px;overflow:hidden;box-shadow:inset 0 0 0 1px var(--line,#e3e8ee)}" +
      ".bs-av img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}" +
      ".bs-tx{min-width:0;display:flex;flex-direction:column}" +
      ".bs-tx b{font-weight:600;color:var(--text,#0e1a2b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".bs-tx span{font-size:12.5px;color:var(--sub,#4a5a70);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".bs-tx em{font-style:normal;font-weight:600;color:var(--green,#0a7a52);margin-left:4px}" +
      ".bs-msg{padding:10px 12px;color:var(--sub,#4a5a70);font-size:13px;line-height:1.5}" +
      ".bs-dot{display:inline-block;width:12px;height:12px;margin-right:7px;vertical-align:-1px;border:2px solid var(--line,#e3e8ee);border-top-color:var(--green,#0a7a52);border-radius:50%;animation:bsspin .8s linear infinite}" +
      "@keyframes bsspin{to{transform:rotate(360deg)}}" +
      "@media (prefers-reduced-motion:reduce){.bs-dot{animation:none}}" +
      ".bs-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}";
    document.head.appendChild(s);
  }

  function attach(inp, opt) {
    if (!inp || inp.dataset.bs) return;
    opt = opt || {};
    addCss();
    var bid = "bs" + ++n;
    inp.dataset.bs = bid;
    var wrap = inp.parentElement;
    wrap.classList.add("bs-wrap");
    var box = document.createElement("div");
    box.className = "bs-box"; box.id = bid; box.hidden = true;
    box.setAttribute("role", "listbox"); box.setAttribute("aria-label", "찾은 블로그");
    var sr = document.createElement("span");
    sr.className = "bs-sr"; sr.setAttribute("role", "status"); sr.setAttribute("aria-live", "polite");
    wrap.appendChild(box); wrap.appendChild(sr);
    inp.setAttribute("role", "combobox");
    inp.setAttribute("aria-autocomplete", "list");
    inp.setAttribute("aria-expanded", "false");
    inp.setAttribute("aria-controls", bid);

    var items = [], act = -1, timer = 0, ctl = null, seq = 0, wantPick = false, pickedAt = 0;
    function place() {
      var w = Math.max(inp.offsetWidth, Math.min(320, wrap.clientWidth));
      box.style.left = Math.max(0, Math.min(inp.offsetLeft, wrap.clientWidth - w)) + "px";
      box.style.top = inp.offsetTop + inp.offsetHeight + 6 + "px";
      box.style.width = w + "px";
    }
    function show(on) {
      if (on) place();
      box.hidden = !on;
      inp.setAttribute("aria-expanded", on ? "true" : "false");
      if (!on) { inp.removeAttribute("aria-activedescendant"); act = -1; }
    }
    function close() { show(false); items = []; wantPick = false; }
    function setAct(i) {
      act = i;
      Array.prototype.forEach.call(box.querySelectorAll(".bs-it"), function (el, k) {
        el.setAttribute("aria-selected", k === i ? "true" : "false");
        if (k === i) { inp.setAttribute("aria-activedescendant", el.id); el.scrollIntoView({ block: "nearest" }); }
      });
    }
    function initial(t) { var c = String(t || "").trim().charAt(0); return c ? c.toUpperCase() : "B"; }
    // head: 목록 위 작은 제목, msg: 목록이 없을 때 문구
    function draw(list, head, msg, clear) {
      items = list; act = -1;
      var h = head ? '<div class="bs-head"><span>' + esc(head) + "</span>" + (clear ? '<button type="button" data-clear="1">지우기</button>' : "") + "</div>" : "";
      list.forEach(function (it, i) {
        var title = it.name || it.nick || it.id;
        var sub = "@" + it.id + (it.nick && it.nick !== title ? " · " + it.nick : "");
        h += '<div class="bs-it" role="option" aria-selected="false" id="' + bid + "-" + i + '" data-i="' + i + '">' +
          '<span class="bs-av" aria-hidden="true">' + esc(initial(title)) + (it.img ? '<img src="' + esc(it.img) + '" alt="" referrerpolicy="no-referrer" loading="lazy">' : "") + "</span>" +
          '<span class="bs-tx"><b>' + esc(title) + "</b><span>" + esc(sub) + (it.typo ? "<em>영어로 바꿔 찾았어요</em>" : "") + "</span></span></div>";
      });
      if (!list.length && msg) h += '<div class="bs-msg">' + msg + "</div>";
      box.innerHTML = h;
      Array.prototype.forEach.call(box.querySelectorAll("img"), function (im) { im.addEventListener("error", function () { im.remove(); }); });
      show(!!h);
    }
    function showRecent() {
      if (opt.recent === false) { close(); return; }
      var a = recent();
      if (!a.length) { close(); return; }
      draw(a.map(function (x) { return { id: x.id, name: x.title && x.title !== x.id ? x.title : "", nick: "" }; }), "최근 본 블로그", "", true);
    }
    function pick(it) {
      if (!it) return;
      inp.value = it.id;
      pickedAt = Date.now();
      close();
      sr.textContent = "";
      if (opt.onPick) opt.onPick(it.id);
    }
    function result(v, list) {
      if (inp.value.trim() !== v) return; // 그 사이에 더 쳤으면 버림
      var ko = KO.test(v) || /\s/.test(v);
      if (wantPick) {
        wantPick = false;
        if (list.length === 1) { pick(list[0]); return; }
        if (list.length) { draw(list, "블로그를 골라 주세요"); setAct(0); sr.textContent = "블로그 " + list.length + "개를 찾았어요. 위아래 화살표로 고르고 Enter를 누르세요."; return; }
      }
      if (document.activeElement !== inp && !box.contains(document.activeElement)) return;
      if (!list.length) {
        if (ko) draw([], "", "‘" + esc(v) + "’(으)로 찾은 블로그가 없어요. 블로그 아이디나 주소로 넣어 주세요.");
        else close();
        return;
      }
      draw(list, "");
      sr.textContent = "블로그 " + list.length + "개를 찾았어요.";
    }
    function ask(v) {
      var my = ++seq;
      if (ctl) { try { ctl.abort(); } catch (e) {} }
      ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
      if (KO.test(v) && !items.length) { box.innerHTML = '<div class="bs-msg"><span class="bs-dot"></span>블로그를 찾는 중이에요…</div>'; items = []; show(true); }
      fetch(W + "?mode=bsearch&q=" + encodeURIComponent(v), ctl ? { signal: ctl.signal } : {})
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (my !== seq) return;
          if (!j || !j.ok || !Array.isArray(j.items)) throw new Error("no");
          var list = j.items.filter(okId).map(function (x) { return { id: x.id, name: x.name || "", nick: x.nick || "", img: x.img || "", typo: !!(j.typo && x.id === j.typo) }; });
          cache.set(v.toLowerCase(), list);
          result(v, list);
        })
        .catch(function (e) {
          if (my !== seq || (e && e.name === "AbortError")) return;
          // 서버가 아직 이 기능을 모르거나 연결이 안 되면: 이름을 친 경우만 알려 주고 아니면 조용히 닫음
          if (KO.test(v) && inp.value.trim() === v) draw([], "", "지금은 블로그 이름으로 찾지 못했어요. 블로그 아이디나 주소로 넣어 주세요.");
          else close();
          wantPick = false;
        });
    }
    function onInput(now) {
      var v = inp.value.trim();
      clearTimeout(timer);
      if (!v) { showRecent(); return; }
      if (v.replace(/\s/g, "").length < 2 || /[./:]/.test(v)) { close(); return; } // 주소를 붙여 넣으면 목록은 필요 없음
      var c = cache.get(v.toLowerCase());
      if (c) { result(v, c); return; }
      if (now) ask(v); else timer = setTimeout(function () { ask(v); }, 220);
    }
    inp.addEventListener("input", function (e) { if (!e.isComposing) onInput(); });
    inp.addEventListener("compositionupdate", function () { setTimeout(onInput, 0); }); // 한글을 치는 중에도 바로바로
    inp.addEventListener("compositionend", function () { setTimeout(onInput, 0); });
    inp.addEventListener("focus", function () { if (!inp.value.trim()) showRecent(); else if (!direct(inp.value)) onInput(); });
    inp.addEventListener("blur", function () { setTimeout(function () { if (document.activeElement !== inp && !box.contains(document.activeElement)) { show(false); wantPick = false; } }, 160); });
    window.addEventListener("resize", function () { if (!box.hidden) place(); });
    // 목록을 눌러도 칸이 포커스를 잃지 않게
    box.addEventListener("mousedown", function (e) { e.preventDefault(); });
    box.addEventListener("click", function (e) {
      if (e.target.closest("[data-clear]")) { try { localStorage.removeItem(RKEY); } catch (er) {} var rc = document.getElementById("recent"); if (rc) { rc.hidden = true; rc.innerHTML = ""; } close(); inp.focus(); return; }
      var el = e.target.closest(".bs-it");
      if (el) pick(items[+el.dataset.i]);
    });
    // 페이지의 Enter 처리보다 먼저 받음 (목록에서 고른 경우, 블로그 이름을 친 경우)
    document.addEventListener("keydown", function (e) {
      if (e.target !== inp) return;
      var open = !box.hidden && items.length > 0, k = e.key;
      var stop = function () { e.preventDefault(); e.stopImmediatePropagation(); };
      if ((k === "ArrowDown" || k === "ArrowUp") && open) {
        stop();
        var d = k === "ArrowDown" ? 1 : -1;
        setAct(act < 0 ? (d > 0 ? 0 : items.length - 1) : (act + d + items.length) % items.length);
      } else if (k === "Enter" || e.keyCode === 13) {
        if (Date.now() - pickedAt < 400) { stop(); return; } // 한글 입력 중 Enter가 두 번 오는 경우 (맥 크롬)
        if (open && act >= 0) { stop(); pick(items[act]); }
        else if (needPick()) stop();
        else show(false);
      } else if (k === "Escape" && !box.hidden) { stop(); close(); }
      else if (k === "Tab") show(false);
    }, true);
    // 블로그 이름(한글 등)을 친 채로 보내려 하면: 목록에서 고르게 함. 하나뿐이면 그걸로 바로 진행
    function needPick() {
      var v = inp.value.trim();
      // 아이디·주소 모양이거나 영어·숫자만 친 경우는 페이지가 그대로 처리 (짧으면 페이지가 안내)
      if (!v || direct(v) || /^[A-Za-z0-9_@-]+$/.test(v) || v.replace(/\s/g, "").length < 2) return false;
      clearTimeout(timer);
      if (document.activeElement !== inp) inp.focus();
      var c = cache.get(v.toLowerCase());
      if (c && c.length === 1) { pick(c[0]); return true; }
      if (c && c.length) { draw(c, "블로그를 골라 주세요"); setAct(0); sr.textContent = "블로그 " + c.length + "개 중에서 골라 주세요."; return true; }
      if (c) { result(v, c); return true; }
      wantPick = true;
      ask(v);
      return true;
    }
    inp._bsNeedPick = needPick;
  }
  window.BlogSuggest = {
    attach: attach,
    // 보내기 버튼을 눌렀을 때: 블로그 이름을 친 경우면 true (목록에서 고르게 하고 멈춤)
    ask: function (inp) { return !!(inp && inp._bsNeedPick && inp._bsNeedPick()); }
  };
})();
