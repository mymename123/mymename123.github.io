// 블로랩 사진 초안: 🖼 썸네일의 ✂ 누끼를 AI로 따기 (2026-11-15)
// 모델: SlimSAM (Segment Anything 가벼운 판, Apache-2.0) 을 transformers.js 로 이 기기 브라우저 안에서 돌림. 사진은 서버로 안 보냄.
// 처음 한 번 모델(약 15MB)과 실행 파일을 받고, 그 뒤로는 브라우저가 저장해 둔 것을 씀.
// 못 쓰면(옛 브라우저, 받기 실패) 부르는 쪽이 seg.js(색으로 찾기)로 넘어감.
(function () {
  "use strict";
  if (window.BLSegAI) return;
  var TF = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2";
  var MID = "Xenova/slimsam-77-uniform";
  var P = null;
  function load() {
    if (!P) P = (async function () {
      var T = await import(TF);
      T.env.allowLocalModels = false;
      var r = await Promise.all([T.SamModel.from_pretrained(MID), T.AutoProcessor.from_pretrained(MID)]);
      return { T: T, model: r[0], proc: r[1] };
    })().catch(function (e) { P = null; throw e; });
    return P;
  }
  // 사진(캔버스) → 그림 특징(한 번만 계산, 점을 바꿔 다시 딸 때는 이것을 다시 씀)
  async function embed(cv) {
    var M = await load(), w = cv.width, h = cv.height;
    var px = cv.getContext("2d").getImageData(0, 0, w, h).data;
    var im = new M.T.RawImage(new Uint8ClampedArray(px), w, h, 4).rgb();
    var inputs = await M.proc(im);
    var emb = await M.model.get_image_embeddings(inputs);
    return { inputs: inputs, emb: emb, w: w, h: h };
  }
  // 점들(label 1 = 넣기, 0 = 빼기) → 후보 3개 중 하나. want: "big"(가운데 점 하나로 자동: 접시까지 크게) | "best"(누른 곳 기준 가장 확실한 것)
  // 돌려주는 값 { logit: Float32Array(w*h), w, h, score }  (logit > 기준값 이면 물건)
  async function cut(E, pts, want) {
    var M = await load(), T = M.T, rs = E.inputs.reshaped_input_sizes[0]; // [높이, 너비]
    var xy = []; pts.forEach(function (p) { xy.push(p.x / E.w * rs[1], p.y / E.h * rs[0]); });
    var ip = new T.Tensor("float32", new Float32Array(xy), [1, 1, pts.length, 2]);
    var il = new T.Tensor("int64", BigInt64Array.from(pts.map(function (p) { return BigInt(p.label ? 1 : 0); })), [1, 1, pts.length]);
    var out = await M.model(Object.assign({}, E.emb, { input_points: ip, input_labels: il }));
    var ms = await M.proc.post_process_masks(out.pred_masks, E.inputs.original_sizes, E.inputs.reshaped_input_sizes, { binarize: false });
    var t = ms[0], d = t.dims, H = d[d.length - 2], W = d[d.length - 1], K = d[d.length - 3] || 1, N = W * H, all = t.data;
    var sc = Array.from(out.iou_scores.data), cand = [];
    for (var k = 0; k < K; k++) {
      var a = 0, off = k * N;
      for (var i = 0; i < N; i++) if (all[off + i] > 0) a++;
      cand.push({ k: k, area: a / N, score: sc[k] || 0 });
    }
    if (want === "all") return { w: W, h: H, list: cand.map(function (c) { return { logit: all.subarray(c.k * N, c.k * N + N), score: c.score, area: c.area }; }) };
    var okc = cand.filter(function (c) { return c.area > 0.02 && c.area < 0.9; });
    if (!okc.length) okc = cand;
    var top = Math.max.apply(null, okc.map(function (c) { return c.score; })), pick;
    if (want === "big") pick = okc.filter(function (c) { return c.score >= top - 0.12 && c.area < 0.8; }).sort(function (a, b) { return b.area - a.area; })[0];
    pick = pick || okc.sort(function (a, b) { return b.score - a.score; })[0];
    return { logit: Float32Array.from(all.subarray(pick.k * N, pick.k * N + N)), w: W, h: H, score: pick.score };
  }
  // 자동(가운데 물건): 가운데 점 하나로만 하면 그릇 속 음식만 잡히는 일이 많아서, 가운데 둘레 점 몇 개로도 따 본 뒤
  // '가운데를 품은' 결과 중 AI 확신(score)이 가장 높은 것을 고름 (비슷하면 더 큰 것 = 그릇까지)
  async function auto(E) {
    var w = E.w, h = E.h, cx = Math.round(w / 2), cy = Math.round(h / 2), best = null;
    var seeds = [[0, 0], [-0.1, 0], [0.1, 0], [0, -0.1], [0, 0.1], [-0.17, 0.03], [0.17, 0.03]];
    for (var i = 0; i < seeds.length; i++) {
      var p = { x: w * (0.5 + seeds[i][0]), y: h * (0.5 + seeds[i][1]), label: 1 };
      var R = await cut(E, [p], "all");
      R.list.forEach(function (c) {
        if (c.logit[cy * R.w + cx] <= 0 || c.area < 0.02 || c.area > 0.85) return;
        var better = !best || c.score > best.score + 0.03 || (c.score > best.score - 0.03 && c.area > best.area);
        if (better) best = { logit: c.logit, w: R.w, h: R.h, score: c.score, area: c.area, pts: [p] };
      });
    }
    return best || Object.assign(await cut(E, [{ x: cx, y: cy, label: 1 }], "big"), { pts: [{ x: cx, y: cy, label: 1 }] });
  }
  // logit → 0/1 영역. adj: -10(좁게) ~ +10(넓게)
  function mask(R, adj) {
    var thr = -(adj || 0) * 0.6, w = R.w, h = R.h, m = new Uint8Array(w * h), L = R.logit;
    for (var i = 0; i < m.length; i++) if (L[i] > thr) m[i] = 1;
    // 떨어져 있는 작은 조각은 버림 (가장 큰 덩어리의 15%보다 작은 것)
    var lab = new Int32Array(w * h), sizes = [0], st = new Int32Array(w * h);
    for (var s = 0; s < m.length; s++) {
      if (!m[s] || lab[s]) continue;
      var id = sizes.length, n = 0, top = 0; st[top++] = s; lab[s] = id;
      while (top) {
        var q = st[--top], x = q % w; n++;
        if (x > 0 && m[q - 1] && !lab[q - 1]) { lab[q - 1] = id; st[top++] = q - 1; }
        if (x < w - 1 && m[q + 1] && !lab[q + 1]) { lab[q + 1] = id; st[top++] = q + 1; }
        if (q >= w && m[q - w] && !lab[q - w]) { lab[q - w] = id; st[top++] = q - w; }
        if (q < m.length - w && m[q + w] && !lab[q + w]) { lab[q + w] = id; st[top++] = q + w; }
      }
      sizes.push(n);
    }
    var big = 0; for (var z = 1; z < sizes.length; z++) if (sizes[z] > big) big = sizes[z];
    for (var j = 0; j < m.length; j++) if (m[j] && sizes[lab[j]] < big * 0.15) m[j] = 0;
    return m;
  }
  window.BLSegAI = { load: load, embed: embed, cut: cut, auto: auto, mask: mask };
})();
