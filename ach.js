// 블로랩 업적 공통 도구: 업적 아이콘·단계 색·배지 그림·공유 이미지 (widget.html, blog/ 공개 프로필에서 씀)
// 업적 계산은 서버(워커)가 하고, 여기는 그리기만 함. 아이콘·색은 워커의 위젯 그림과 같게 맞춤
(function (G) {
  var ICON = {
    pen: "M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4",
    cake: "M4 20h16M5 20v-6h14v6M8 14v-3h8v3M12 11V8M12 4.5v1",
    eye: "M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
    users: "M15 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-4A3.5 3.5 0 0 0 4 18.5V20M9.5 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 20v-1.5a3.5 3.5 0 0 0-2.5-3.4M15 5.6a3 3 0 0 1 0 5.8",
    flame: "M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 2 1.3 3 2.5 3 0-3-1-5.5 0-8z",
    rocket: "M3 17l6-6 4 4 8-8M15 7h6v6",
    heart: "M12 20s-7.5-4.5-7.5-10A4 4 0 0 1 12 7.5 4 4 0 0 1 19.5 10C19.5 15.5 12 20 12 20z",
    chat: "M4 5h16v11H9l-5 4V5z",
    receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6",
    award: "M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 13.5 7 21l5-3 5 3-1.5-7.5",
    trophy: "M7 4h10v4a5 5 0 0 1-10 0V4zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8",
    star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"
  };
  // 단계 색: 동 · 은 · 금 · 최고 단계(초록). 아직 못 한 업적은 회색 실루엣
  function tier(a) {
    if (!a || !a.lv) return "#c3cbd5";
    if (a.special || a.lv >= a.max) return "#0a7a52";
    var p = a.lv / a.max;
    return p > 2 / 3 ? "#b88a00" : p > 1 / 3 ? "#6b7a8c" : "#9a5b2e";
  }
  var tierName = function (a) { return !a || !a.lv ? "도전 중" : a.special || a.lv >= a.max ? "최고 단계" : a.lv / a.max > 2 / 3 ? "골드" : a.lv / a.max > 1 / 3 ? "실버" : "브론즈"; };
  var esc = function (t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var fmt = function (n) { return n == null ? "-" : Number(n).toLocaleString("ko-KR"); };
  var ymd = function (ms) { if (!ms) return ""; var d = new Date(ms + 9 * 3600000); return d.getUTCFullYear() + "." + String(d.getUTCMonth() + 1).padStart(2, "0") + "." + String(d.getUTCDate()).padStart(2, "0"); };
  var ymdKo = function (ms) { if (!ms) return ""; var d = new Date(ms + 9 * 3600000); return d.getUTCFullYear() + "년 " + (d.getUTCMonth() + 1) + "월 " + d.getUTCDate() + "일"; };
  // 원 배지 (HTML 안에 넣는 SVG)
  function badge(a, px) {
    px = px || 44;
    var c = tier(a);
    return '<svg class="achb" width="' + px + '" height="' + px + '" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="' + c + '"/>' +
      '<g transform="translate(10.5 10.5) scale(1.125)"><path d="' + (ICON[a.icon] || ICON.star) + '" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></g></svg>';
  }
  // 달성 날짜 문구: 정확한 날 / 블로랩이 확인한 날 / 등록 전에 이미 달성(날짜 모름)
  function when(st) {
    if (!st || !st.on) return "";
    if (st.x === 1 && st.d) return ymd(st.d);
    if (st.x === 0 && st.d) return ymd(st.d) + " 확인";
    if (st.x === -1) return "등록 전 달성";
    return "";
  }
  // 새로 달성한 업적: 정확한 날짜가 30일 안이거나, 블로랩이 14일 안에 확인한 것
  function fresh(list, now) {
    now = now || Date.now();
    var out = [];
    (list || []).forEach(function (a) {
      (a.steps || []).forEach(function (st, i) {
        if (!st.on || !st.d) return;
        var age = now - st.d;
        if ((st.x === 1 && age < 30 * 864e5 && age >= 0) || (st.x === 0 && age < 14 * 864e5)) out.push({ a: a, i: i, st: st });
      });
    });
    return out.sort(function (p, q) { return q.st.d - p.st.d; });
  }

  // ---- 공유 이미지 (캔버스) ----
  function wrap(ctx, text, maxW) {
    var words = String(text).split(" "), lines = [], cur = "";
    words.forEach(function (w) { var t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur);
    return lines;
  }
  // opt: { a: 업적, step: 단계 번호(0부터), blog: 이름, level, count, ratio: "1:1" | "4:5" | "9:16" }
  async function shareImage(opt) {
    var W = 1080, H = opt.ratio === "9:16" ? 1920 : opt.ratio === "4:5" ? 1350 : 1080;
    var cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    var x = cv.getContext("2d");
    var FF = '"IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
    try { await Promise.all([document.fonts.load("700 64px \"IBM Plex Sans KR\""), document.fonts.load("500 32px \"IBM Plex Sans KR\"")]); } catch (e) {}
    var a = opt.a, st = (a.steps || [])[opt.step] || {};
    var headline = (opt.step === a.lv - 1 && a.share) ? a.share : (st.label ? st.label + (a.special ? "" : " 달성!") : a.title);
    // 바탕
    x.fillStyle = "#0e1a2b"; x.fillRect(0, 0, W, H);
    x.strokeStyle = "rgba(255,255,255,.06)"; x.lineWidth = 2;
    for (var r = 260; r < 900; r += 120) { x.beginPath(); x.arc(W / 2, H * 0.4, r, 0, Math.PI * 2); x.stroke(); }
    // 위: 브랜드
    var my = 96;
    x.lineWidth = 8; x.strokeStyle = "#2bd48a"; x.beginPath(); x.arc(92, my, 22, 0, Math.PI * 2); x.stroke();
    x.fillStyle = "#2bd48a"; x.beginPath(); x.arc(92, my, 9, 0, Math.PI * 2); x.fill();
    x.fillStyle = "#ffffff"; x.font = "700 36px " + FF; x.textBaseline = "middle"; x.fillText("블로랩", 130, my + 2);
    x.font = "500 28px " + FF; x.fillStyle = "#b4c0cf"; x.textAlign = "right"; x.fillText("블로그 업적", W - 72, my + 2); x.textAlign = "left";
    // 가운데: 배지
    var cy = H * 0.4, R = 170;
    x.fillStyle = tier({ lv: (opt.step || 0) + 1, max: a.max, special: a.special }); x.beginPath(); x.arc(W / 2, cy, R, 0, Math.PI * 2); x.fill();
    x.strokeStyle = "rgba(255,255,255,.18)"; x.lineWidth = 10; x.beginPath(); x.arc(W / 2, cy, R + 22, 0, Math.PI * 2); x.stroke();
    x.save(); var sc = (R * 1.1) / 24; x.translate(W / 2 - 12 * sc, cy - 12 * sc); x.scale(sc, sc);
    x.strokeStyle = "#ffffff"; x.lineWidth = 1.7; x.lineCap = "round"; x.lineJoin = "round"; x.stroke(new Path2D(ICON[a.icon] || ICON.star)); x.restore();
    // 문구
    x.textAlign = "center"; x.textBaseline = "alphabetic";
    var ty = cy + R + 140;
    x.font = "700 76px " + FF; x.fillStyle = "#ffffff";
    var lines = wrap(x, headline, W - 160);
    lines.forEach(function (l, i) { x.fillText(l, W / 2, ty + i * 92); });
    ty += (lines.length - 1) * 92 + 70;
    x.font = "600 38px " + FF; x.fillStyle = "#2bd48a"; x.fillText(String(opt.blog || ""), W / 2, ty);
    var dt = st.x === 1 && st.d ? ymdKo(st.d) : st.x === 0 && st.d ? ymdKo(st.d) : "";
    if (dt) { x.font = "500 30px " + FF; x.fillStyle = "#b4c0cf"; x.fillText(dt, W / 2, ty + 54); }
    // 아래: 레벨 · 사이트
    var by = H - 96;
    x.font = "700 28px " + FF;
    var pill = "LEVEL " + (opt.level || 1) + (opt.count ? "  ·  업적 " + opt.count + "개" : "");
    var pw = x.measureText(pill).width + 56;
    x.fillStyle = "rgba(43,212,138,.14)"; roundRect(x, W / 2 - pw / 2, by - 92, pw, 56, 28); x.fill();
    x.fillStyle = "#2bd48a"; x.fillText(pill, W / 2, by - 54);
    x.font = "500 26px " + FF; x.fillStyle = "#8d9bb0"; x.fillText("mymename123.github.io", W / 2, by + 6);
    return cv.toDataURL("image/png");
  }
  function roundRect(x, l, t, w, h, r) { x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r); x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath(); }

  G.CMAch = { ICON: ICON, tier: tier, tierName: tierName, badge: badge, when: when, fresh: fresh, esc: esc, fmt: fmt, ymd: ymd, ymdKo: ymdKo, shareImage: shareImage,
    WORKER: "https://green-sunset-edd6.risingsk123.workers.dev/", SITE: "https://mymename123.github.io/" };
})(window);
