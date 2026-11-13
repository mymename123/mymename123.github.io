// 블로랩 사진 초안: 🖼 썸네일의 ✂ 누끼 (사진에서 물건 영역 찾기). AI 아님, 이 기기에서 색으로 계산
// 확장 프로그램 naver-ai-tag 의 photo-deco.js 에 있는 계산 함수와 같은 것 (고치면 양쪽을 같이 고칠 것)
(function () {
  "use strict";
  if (window.BLSeg) return;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  function toLab(data, n) {
    const L = new Float32Array(n), A = new Float32Array(n), B = new Float32Array(n);
    const lin = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const c = i / 255;
      lin[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    for (let i = 0; i < n; i++) {
      const r = lin[data[i * 4]], g = lin[data[i * 4 + 1]], b = lin[data[i * 4 + 2]];
      const fx = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047);
      const fy = f(r * 0.2126 + g * 0.7152 + b * 0.0722);
      const fz = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
      L[i] = 116 * fy - 16;
      A[i] = 500 * (fx - fy);
      B[i] = 200 * (fy - fz);
    }
    return { L, A, B };
  }

  function sampleIdx(list, max) {
    if (list.length <= max) return list;
    const out = [];
    const step = list.length / max;
    for (let k = 0; k < max; k++) out.push(list[Math.floor(k * step)]);
    return out;
  }

  // 색 무리 나누기 (k-means). 돌려주는 값: [[L,a,b], ...]
  function kmeans(lab, list, k, iters) {
    const { L, A, B } = lab;
    const S = sampleIdx(list, 5000);
    if (!S.length) return [];
    const d2 = (i, c) => {
      const x = L[i] - c[0], y = A[i] - c[1], z = B[i] - c[2];
      return x * x + y * y + z * z;
    };
    let C = [[L[S[0]], A[S[0]], B[S[0]]]];
    const dmin = new Float32Array(S.length).fill(Infinity);
    while (C.length < k) {
      const c = C[C.length - 1];
      let best = -1, bi = 0;
      for (let j = 0; j < S.length; j++) {
        const d = d2(S[j], c);
        if (d < dmin[j]) dmin[j] = d;
        if (dmin[j] > best) {
          best = dmin[j];
          bi = j;
        }
      }
      if (best < 4) break;
      C.push([L[S[bi]], A[S[bi]], B[S[bi]]]);
    }
    for (let it = 0; it < iters; it++) {
      const sum = C.map(() => [0, 0, 0, 0]);
      for (const p of S) {
        let bj = 0, bd = Infinity;
        for (let j = 0; j < C.length; j++) {
          const d = d2(p, C[j]);
          if (d < bd) {
            bd = d;
            bj = j;
          }
        }
        const s = sum[bj];
        s[0] += L[p];
        s[1] += A[p];
        s[2] += B[p];
        s[3]++;
      }
      C = sum.filter((s) => s[3] > 0).map((s) => [s[0] / s[3], s[1] / s[3], s[2] / s[3]]);
    }
    return C;
  }

  function nearD(lab, i, C) {
    let bd = Infinity;
    for (let j = 0; j < C.length; j++) {
      const c = C[j];
      const x = lab.L[i] - c[0], y = lab.A[i] - c[1], z = lab.B[i] - c[2];
      const d = x * x + y * y + z * z;
      if (d < bd) bd = d;
    }
    return Math.sqrt(bd);
  }

  function boxBlur(a, w, h, r) {
    if (r < 1) return a;
    const t = new Float32Array(w * h), o = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      let s = 0, cnt = 0;
      for (let x = -r; x < w; x++) {
        if (x + r < w) {
          s += a[y * w + x + r];
          cnt++;
        }
        if (x - r - 1 >= 0) {
          s -= a[y * w + x - r - 1];
          cnt--;
        }
        if (x >= 0) t[y * w + x] = s / cnt;
      }
    }
    for (let x = 0; x < w; x++) {
      let s = 0, cnt = 0;
      for (let y = -r; y < h; y++) {
        if (y + r < h) {
          s += t[(y + r) * w + x];
          cnt++;
        }
        if (y - r - 1 >= 0) {
          s -= t[(y - r - 1) * w + x];
          cnt--;
        }
        if (y >= 0) o[y * w + x] = s / cnt;
      }
    }
    return o;
  }

  // 4방향 한 칸 늘리기/줄이기를 r번
  function morph(m, w, h, r, grow) {
    let a = m;
    for (let k = 0; k < r; k++) {
      const b = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const v = a[i];
          const l = x > 0 ? a[i - 1] : v, rr = x < w - 1 ? a[i + 1] : v, u = y > 0 ? a[i - w] : v, d = y < h - 1 ? a[i + w] : v;
          b[i] = grow ? (v | l | rr | u | d) : (v & l & rr & u & d);
        }
      }
      a = b;
    }
    return a;
  }

  // 덩어리 나누기 → 큰 덩어리만 남김
  function keepMain(m, w, h, ratio) {
    const lab = new Int32Array(w * h);
    const sizes = [0];
    const st = [];
    for (let i = 0; i < w * h; i++) {
      if (!m[i] || lab[i]) continue;
      const id = sizes.length;
      let n = 0;
      lab[i] = id;
      st.push(i);
      while (st.length) {
        const p = st.pop();
        n++;
        const x = p % w;
        if (x > 0 && m[p - 1] && !lab[p - 1]) (lab[p - 1] = id), st.push(p - 1);
        if (x < w - 1 && m[p + 1] && !lab[p + 1]) (lab[p + 1] = id), st.push(p + 1);
        if (p >= w && m[p - w] && !lab[p - w]) (lab[p - w] = id), st.push(p - w);
        if (p < w * (h - 1) && m[p + w] && !lab[p + w]) (lab[p + w] = id), st.push(p + w);
      }
      sizes.push(n);
    }
    const mx = Math.max.apply(null, sizes);
    const out = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) if (lab[i] && sizes[lab[i]] >= mx * ratio) out[i] = 1;
    return out;
  }

  // 안쪽 구멍 메우기 (가장자리에서 닿지 않는 빈칸 = 구멍)
  function fillHoles(m, w, h) {
    const seen = new Uint8Array(w * h);
    const st = [];
    const push = (i) => {
      if (!m[i] && !seen[i]) {
        seen[i] = 1;
        st.push(i);
      }
    };
    for (let x = 0; x < w; x++) push(x), push((h - 1) * w + x);
    for (let y = 0; y < h; y++) push(y * w), push(y * w + w - 1);
    while (st.length) {
      const p = st.pop();
      const x = p % w;
      if (x > 0) push(p - 1);
      if (x < w - 1) push(p + 1);
      if (p >= w) push(p - w);
      if (p < w * (h - 1)) push(p + w);
    }
    const out = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) out[i] = m[i] || !seen[i] ? 1 : 0;
    return out;
  }

  function cleanMask(m, w, h, ratio) {
    let a = keepMain(m, w, h, ratio);
    const r = Math.max(1, Math.round(Math.min(w, h) / 220));
    a = morph(morph(a, w, h, r, true), w, h, r, false); // 틈 메우기
    a = morph(morph(a, w, h, r, false), w, h, r, true); // 잔가시 없애기
    a = fillHoles(a, w, h);
    return keepMain(a, w, h, ratio);
  }

  // 상자 안 물건 점수 계산 (GrabCut 비슷한 색 모델, AI 아님). 점수 > 0 이면 물건 쪽
  function rectScore(im, rc) {
    const { w, h } = im;
    const lab = im.lab || (im.lab = toLab(im.data, w * h));
    const x0 = clamp(Math.round(Math.min(rc.x0, rc.x1)), 0, w - 1), x1 = clamp(Math.round(Math.max(rc.x0, rc.x1)), x0 + 1, w);
    const y0 = clamp(Math.round(Math.min(rc.y0, rc.y1)), 0, h - 1), y1 = clamp(Math.round(Math.max(rc.y0, rc.y1)), y0 + 1, h);
    const rw = x1 - x0, rh = y1 - y0;
    const mg = Math.max(4, Math.round(Math.min(rw, rh) * 0.18));
    const bgIdx = [], inIdx = [];
    for (let y = Math.max(0, y0 - mg); y < Math.min(h, y1 + mg); y++) {
      for (let x = Math.max(0, x0 - mg); x < Math.min(w, x1 + mg); x++) {
        const i = y * w + x;
        if (x >= x0 && x < x1 && y >= y0 && y < y1) inIdx.push(i);
        else bgIdx.push(i);
      }
    }
    // 상자가 사진 끝까지 닿아 바깥 배경이 거의 없으면 상자 안쪽 가장자리 2칸을 배경으로 봄
    if (bgIdx.length < 300) {
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          if (x < x0 + 2 || x >= x1 - 2 || y < y0 + 2 || y >= y1 - 2) bgIdx.push(y * w + x);
        }
      }
    }
    let fgC = kmeans(lab, inIdx, 6, 5);
    let bgC = kmeans(lab, bgIdx, 8, 5);
    const sc = new Float32Array(rw * rh);
    for (let it = 0; it < 4; it++) {
      const fgL = [], bgIn = [];
      const margin = it === 0 ? 4 : 0;
      for (let y = 0; y < rh; y++) {
        for (let x = 0; x < rw; x++) {
          const i = (y0 + y) * w + x0 + x;
          const s = nearD(lab, i, bgC) - nearD(lab, i, fgC);
          sc[y * rw + x] = s;
          if (s > margin) fgL.push(i);
          else bgIn.push(i);
        }
      }
      if (it === 3 || fgL.length < 30) break;
      fgC = kmeans(lab, fgL, 6, 5);
      bgC = kmeans(lab, bgIdx.concat(sampleIdx(bgIn, 4000)), 8, 5);
    }
    // 가장자리 쪽 약한 감점 (상자 가운데일수록 물건일 가능성이 큼)
    for (let y = 0; y < rh; y++) {
      for (let x = 0; x < rw; x++) {
        const ex = Math.min(x, rw - 1 - x) / rw, ey = Math.min(y, rh - 1 - y) / rh;
        const e = Math.min(ex, ey);
        if (e < 0.06) sc[y * rw + x] -= (0.06 - e) * 60;
      }
    }
    const r = Math.max(1, Math.round(Math.min(rw, rh) / 70));
    return { x0, y0, rw, rh, score: boxBlur(boxBlur(sc, rw, rh, r), rw, rh, r) };
  }

  // 점수 → 영역. adj: -10(좁게) ~ +10(넓게)
  function maskFromScore(im, S, adj) {
    const { w, h } = im;
    const m = new Uint8Array(w * h);
    const thr = -adj * 1.6;
    for (let y = 0; y < S.rh; y++) {
      for (let x = 0; x < S.rw; x++) if (S.score[y * S.rw + x] > thr) m[(S.y0 + y) * w + S.x0 + x] = 1;
    }
    return cleanMask(m, w, h, 0.12);
  }

  function maskInfo(m, w, h) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1, n = 0;
    const bnd = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!m[i]) continue;
        n++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || !m[i - 1] || !m[i + 1] || !m[i - w] || !m[i + w]) bnd.push(x, y);
      }
    }
    // 화살표 끝 후보는 많을 필요 없음
    const step = Math.max(1, Math.floor(bnd.length / 2 / 1500));
    const pts = [];
    for (let k = 0; k < bnd.length; k += 2 * step) pts.push([bnd[k], bnd[k + 1]]);
    return { n, box: n ? { x0, y0, x1: x1 + 1, y1: y1 + 1 } : null, pts };
  }

  window.BLSeg = { rectScore: rectScore, maskFromScore: maskFromScore, maskInfo: maskInfo };
})();
