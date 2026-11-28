(() => {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Language: the generated pages set window.I18N (lang, locale, t: English to translated strings,
// plurals); the English page has none and every t() returns its argument.
const I = window.I18N || {};
const LANG = I.lang || 'en', LOCALE = I.locale || 'en-GB';
const t = (s, vars) => { let r = (I.t && I.t[s]) || s; if (vars) for (const k in vars) r = r.split('{' + k + '}').join(vars[k]); return r; };
const PR = new Intl.PluralRules(LOCALE);
const plural = (n, w) => {
  const f = I.plurals && I.plurals[w];
  const form = f && (f[PR.select(n)] || f.other);
  return form ? form.split('{n}').join(n.toLocaleString(LOCALE)) : `${n} ${w}${n === 1 ? '' : 's'}`;
};
const RTL = document.documentElement.dir === 'rtl';
// in a right-to-left page the slides sit to the left of one another, so they move the other way
const isRtl = (el) => getComputedStyle(el).direction === 'rtl';

// In Arabic the numbers are written in the digits used in Arabic-speaking countries, also those the page writes
// later (counters, sliders, the map). A name written in Latin letters keeps its own digits (Building 8, C++)
if (LANG === 'ar') {
  const AR = '٠١٢٣٤٥٦٧٨٩', SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'NOSCRIPT']);
  const fix = (n) => {
    const s = n.data; if (!/[0-9]/.test(s) || (/[A-Za-z]/.test(s) && !/[\u0600-\u06FF]/.test(s))) return;
    const p = n.parentElement; if (!p || SKIP.has(p.tagName) || p.closest('[data-latin]')) return;
    const v = s.replace(/[0-9]/g, (d) => AR[d]).replace(/([٠-٩])\s?%/g, '$1٪');
    if (v !== s) n.data = v;
  };
  const walk = (root) => { if (root.nodeType === 3) return fix(root); const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); for (let n; (n = w.nextNode());) fix(n); };
  walk(document.body);
  new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'characterData') fix(m.target); else m.addedNodes.forEach(walk); } })
    .observe(document.body, { subtree: true, childList: true, characterData: true });
}

/* ================= categories: pills on top, panels slide sideways ================= */
const ORDER = ['about', 'architecture', 'design', 'writing', 'archive', 'apps'];
const ALIASES = { documentation: 'archive' };   // old links keep working
const DEFAULT = 'about';

// The header is two rows whose height depends on the font and the safe area; measure it.
const header = $('header');
new ResizeObserver(() => document.documentElement.style.setProperty('--hdr', header.offsetHeight + 'px')).observe(header);
const track = $('#track'), viewport = $('#viewport');
const panels = ORDER.map(id => document.getElementById(id));
const tabs = $$('.tab');
const firstShow = {};
let current = null;

function fitHeight() {
  const p = panels[ORDER.indexOf(current)];
  if (p) viewport.style.height = p.offsetHeight + 'px';
}
// An address ending in #archive (or any tab) makes the browser jump to that section after the page
// has loaded, scrolling the strip of tabs sideways inside its frame, and so does focusing something in
// a hidden tab. The transform alone moves the strip, so any such scroll is put straight back.
viewport.addEventListener('scroll', () => { if (viewport.scrollLeft || viewport.scrollTop) viewport.scrollLeft = viewport.scrollTop = 0; });
const ro = new ResizeObserver(fitHeight);
panels.forEach(p => ro.observe(p));

function go(id, { push = true } = {}) {
  id = ALIASES[id] || id;
  if (!ORDER.includes(id)) id = DEFAULT;
  const changed = current !== null && current !== id;
  const from = ORDER.indexOf(current);
  current = id;
  const i = ORDER.indexOf(id);
  track.style.transform = `translateX(${(RTL ? 1 : -1) * i * 100}%)`;
  panels.forEach((p, k) => p.setAttribute('aria-hidden', k === i ? 'false' : 'true'));
  // container tabs fill the screen exactly, so the page behind them must not scroll
  document.documentElement.classList.toggle('fit-tab', panels[i].classList.contains('fit'));
  if (panels[i].classList.contains('fit')) window.scrollTo(0, 0);
  tabs.forEach(t => {
    const on = t.dataset.tab === id;
    t.classList.toggle('on', on);
    t.setAttribute('aria-selected', on);
  });
  placePill(!changed);
  // Writing: the card comes in first, then turns to paper, crumpled differently each time
  const writing = $('#writing');
  if (writing && id === 'writing') {
    writing.dataset.seed = Math.floor(Math.random() * 1e9); writingSheet(); writing.classList.add('paper');
    writing.classList.remove('enter'); void writing.offsetWidth; writing.classList.add('enter');
  }
  // Archive: its title, then its map drawn from the bottom up, every time it is opened
  const archive = $('#archive');
  if (archive && id === 'archive') {
    archive.classList.remove('enter', 'drawn'); void archive.offsetWidth; archive.classList.add('enter');
    const map = $('.map', archive), done = () => archive.classList.add('drawn');
    if (reduced) done();
    else map.addEventListener('animationend', function f(e) { if (e.animationName === 'mapUp') { map.removeEventListener('animationend', f); done(); } });
  }
  panels[i].querySelectorAll('img[loading="lazy"]').forEach(img => { img.loading = 'eager'; });

  if (changed) countView(id);
  fitHeight();
  if (push && location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
  if (changed) window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  // Behind the greeting nothing animates yet; entering calls go() again.
  if (!firstShow[id] && entered) { firstShow[id] = true; (onFirstShow[id] || (() => {}))(); }
  playLogos(document, (from > i ? 1 : -1) * (RTL ? -1 : 1), !changed);
}
// Revitesse: a parallelogram of paper in three triangles, folded the way the logo was made. The big triangle is the R's
// body, the middle one lies between the stem and the slanted crease, the far one beyond the crease. The far triangle
// folds about the crease to behind the middle one, then both fold about the stem to behind the body, and the corners
// round. Each piece turns exactly in 3D and is drawn through a mild perspective; the shading stays where it is in the
// finished logo and comes in as the paper goes behind
const rvBuild = (() => {
  const U = 272 / 42, SY = 152 - 13.84 * U, px = ([x, y]) => [57 + x * U, SY + y * U], PAPER = [0x82, 0x99, 0x6d];
  const STEM = 57, TOP = 152, FOOT = 424, FAR = 329, K = [STEM - 17.41 * U, TOP], D = [STEM, FOOT], APEX = px([0, -3.53]);
  const l = Math.hypot(D[0] - K[0], D[1] - K[1]), ux = [(D[0] - K[0]) / l, (D[1] - K[1]) / l];
  const reflC = ([x, y]) => { const v = [x - K[0], y - K[1]], q = v[0] * ux[0] + v[1] * ux[1]; return [K[0] + 2 * q * ux[0] - v[0], K[1] + 2 * q * ux[1] - v[1]]; };
  const A = reflC(APEX), BODY = [[STEM, TOP], D, [FAR, FOOT]], STRIP = [K, [STEM, TOP], D], TRI = [A, K, D];
  const R_TOP = 6.08 * U, R_FAR = 6.08 * U, R_FOOT = 2.52 * U, GQ = 13.84 / 26.13, GY = SY + 26.13 * U;
  // a point turned about the axis through a (unit direction u in the page) by t radians
  function turn([x, y, z], a, u, t) {
    const v = [x - a[0], y - a[1], z], c = Math.cos(t), s = Math.sin(t), k = [u[0], u[1], 0];
    const cr = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]], dot = k[0] * v[0] + k[1] * v[1];
    return [0, 1, 2].map((i) => (i < 2 ? a[i] : 0) + v[i] * c + cr[i] * s + k[i] * dot * (1 - c));
  }
  const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const towards = (p, q, r) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; return [p[0] + (q[0] - p[0]) * r / d, p[1] + (q[1] - p[1]) * r / d]; };
  // a polygon's outline, each corner rounded by its own r
  const pathOf = (pts, rs = []) => {
    const n = pts.length, f = (p) => p[0].toFixed(2) + ' ' + p[1].toFixed(2);
    const seg = pts.map((p, i) => [towards(p, pts[(i + n - 1) % n], rs[i] || 0), p, towards(p, pts[(i + 1) % n], rs[i] || 0)]);
    return 'M' + f(seg[0][2]) + seg.slice(1).map(([a, p, b]) => 'L' + f(a) + 'Q' + f(p) + ' ' + f(b)).join('') + 'L' + f(seg[0][0]) + 'Q' + f(seg[0][1]) + ' ' + f(seg[0][2]) + 'Z';
  };
  const F = 1500, proj = ([x, y, z]) => { const s = F / (F - z); return [180 + (x - 180) * s, 288 + (y - 288) * s]; };
  // how squarely a piece faces the viewer: it darkens a little as it turns away
  const facing = ([a, b, c]) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    return Math.abs(n[2] / (Math.hypot(...n) || 1));
  };
  const colour = (f) => `rgb(${PAPER.map((c) => Math.round(c * (.9 + .1 * f))).join(',')})`;
  const S0 = 360 / 600, CX0 = (A[0] + FAR) / 2, CY0 = (TOP + FOOT) / 2;
  let n = 0;
  return (svg) => {
    const id = 'rvShade' + (++n);
    svg.innerHTML = `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${STEM}" y1="${SY}" x2="${STEM}" y2="${GY}">`
      + `<stop offset="${.23 * GQ}" stop-color="#82996d" stop-opacity=".0025"/><stop offset="${GQ}" stop-opacity=".25"/>`
      + `<stop offset="${GQ}" stop-color="#82996d" stop-opacity=".5"/><stop offset="1" stop-opacity=".5"/></linearGradient></defs>`
      + `<g>${'<g><path stroke-width=".8" stroke-linejoin="round"/><path/></g>'.repeat(3)}</g>`;
    const view = svg.lastElementChild, slots = [...view.children].map((g) => [...g.children]);
    return (ms) => {
      const t1 = ease((ms - 500) / 1300), t2 = ease((ms - 1950) / 1300), t3 = ease((ms - 3150) / 1100), tv = ease((ms - 1900) / 1700);
      const z0 = (p) => [p[0], p[1], 0], f2 = (p) => turn(p, [STEM, TOP], [0, 1], Math.PI * t2);
      const tri = TRI.map(z0).map((p) => turn(p, K, ux, -Math.PI * t1)).map(f2), strip = STRIP.map(z0).map(f2), body = BODY.map(z0);
      // the far triangle is behind the strip while the strip faces the viewer, in front of it once the strip has turned
      // its back (it lies on the strip's back); the body is in front of both
      const [sa, sb, sc] = strip, front = (sb[0] - sa[0]) * (sc[1] - sa[1]) - (sb[1] - sa[1]) * (sc[0] - sa[0]) > 0;
      const k = .5 * ease((t1 - .45) / .55) + .5 * ease((t2 - .45) / .55);
      const rounds = new Map([[strip, [0, 0, R_FOOT * t3]], [tri, [R_TOP * t3, 0, R_FOOT * t3]], [body, [0, R_FOOT * t3, R_FAR * t3]]]);
      (front ? [tri, strip, body] : [strip, tri, body]).forEach((pts, i) => {
        const [el, sh] = slots[i], d = pathOf(pts.map(proj), rounds.get(pts)), c = colour(facing(pts));
        el.setAttribute('d', d); el.setAttribute('fill', c); el.setAttribute('stroke', c);
        sh.setAttribute('d', pts === tri ? d : ''); sh.setAttribute('fill', `url(#${id})`); sh.setAttribute('opacity', k.toFixed(3));
      });
      // from the whole open sheet to the logo's own frame
      const s = S0 + (1 - S0) * tv, cx = CX0 + (180 - CX0) * tv, cy = CY0 + (230 - CY0) * tv;
      view.setAttribute('transform', `translate(180 230) scale(${s.toFixed(4)}) translate(${(-cx).toFixed(2)} ${(-cy).toFixed(2)})`);
    };
  };
})();
let ssFrames = null;
// Shuin's tile plays the app's launch splash (the app's src/lib/splashGlobe.js), cropped to the globe: a dotted gold
// globe turns at one steady speed, land dots turn red one by one as if visited, one journey's dashed routes draw and
// fade, then the seal comes down and presses. The seal is the tile's own logo picture, turned as the splash leaves it,
// so the splash ends on the logo. The dots and the journey (shuin-globe.json, 8 KB, written from the app's own scene)
// are fetched the first time the tile plays; the colours follow the page's theme, live. It draws only while the tile
// is on screen: a tile that leaves the screen stops at once and shows the seal
let shuinGlobe = null;
const SHUIN_COL = {
  light: { dot: '#EAB308', stroke: '#CA8A04', city: '#EF4444', ring: '#FFFFFF', route: '#3B82F6' },
  dark: { dot: '#C8A84B', stroke: '#9C7A34', city: '#EF4444', ring: '#9C7A34', route: '#A0A0B0' },
};
// the splash's clock, in seconds (the app's timeline); the tile shows the stage's square around the globe
const SH = { RATE: 100, LIGHT_AT: 35, FIRST: -74, T_FIRST: .3, T_DROP: 2.58, T_PRESS: 2.88, OUT0: 2.32, OUT1: 2.52, LEG: .25, BOX: 266.06 };
function shuinScene(G) {
  const R = Math.PI / 180, D = G.dots, n = D.length / 2, u = new Float64Array(n * 4);
  for (let i = 0; i < n; i++) { const lo = D[2 * i] / 4 * R, la = D[2 * i + 1] / 4 * R; u.set([Math.sin(lo), Math.cos(lo), Math.sin(la), Math.cos(la)], 4 * i); }
  const vec = (i) => { const lo = D[2 * i] / 4 * R, la = D[2 * i + 1] / 4 * R; return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]; };
  // each route a great circle in 28 steps, lifted a little off the globe in its middle
  const legs = G.legs.map(([a, b, t]) => {
    const A = vec(a), B = vec(b), w = Math.acos(Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])), N = 28;
    const pts = new Float64Array((N + 1) * 4), lift = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const f = i / N, s1 = Math.sin((1 - f) * w) / Math.sin(w), s2 = Math.sin(f * w) / Math.sin(w);
      const x = A[0] * s1 + B[0] * s2, y = A[1] * s1 + B[1] * s2, z = A[2] * s1 + B[2] * s2;
      const lo = Math.atan2(y, x), la = Math.asin(Math.max(-1, Math.min(1, z)));
      pts.set([Math.sin(lo), Math.cos(lo), Math.sin(la), Math.cos(la)], i * 4);
      lift[i] = 1 + .07 * (w / 1.2) * Math.sin(Math.PI * f);
    }
    return { pts, lift, N, t, a: 4 * a, b: 4 * b };
  });
  return { u, legs, visited: G.visited.map(([i, t]) => ({ i: 4 * i, t })) };
}
function shuinDraw(ctx, k, S, t, C) {
  const clamp = (v) => v < 0 ? 0 : v > 1 ? 1 : v, seg = (a, b) => clamp((t - a) / (b - a)), eo = (p) => 1 - Math.pow(1 - p, 3);
  const lon0 = (SH.FIRST - SH.LIGHT_AT + SH.RATE * (t - SH.T_FIRST)) * Math.PI / 180, lat0 = 20 * Math.PI / 180;
  const V = { sl: Math.sin(lon0), cl: Math.cos(lon0), sp: Math.sin(lat0), cp: Math.cos(lat0) };
  const proj = (a, i, o) => {
    const sinL = a[i], cosL = a[i + 1], sinP = a[i + 2], cosP = a[i + 3], sd = sinL * V.cl - cosL * V.sl, cd = cosL * V.cl + sinL * V.sl;
    o[0] = cosP * sd; o[1] = V.cp * sinP - V.sp * cosP * cd; o[2] = V.sp * sinP + V.cp * cosP * cd; return o;
  };
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const cx = 195, cy = 360, r = 122, h = SH.BOX / 2;
  ctx.setTransform(k, 0, 0, k, -(cx - h) * k, -(cy - h) * k);
  const ga = eo(seg(0, .4)) * (1 - seg(SH.T_PRESS - .14, SH.T_PRESS - .05));
  if (ga <= 0) return;
  const o = [0, 0, 0], P = [0, 0, 0], Q = [0, 0, 0];
  ctx.globalAlpha = ga * .75; ctx.strokeStyle = C.stroke; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(cx, cy, r + 4, 0, Math.PI * 2); ctx.stroke();
  // the stipple: one gold dot per land point, smaller and fainter toward the rim
  ctx.fillStyle = C.dot;
  for (let i = 0; i < S.u.length; i += 4) {
    proj(S.u, i, o); if (o[2] <= .02) continue;
    ctx.globalAlpha = ga * (.3 + .7 * o[2]);
    ctx.beginPath(); ctx.arc(cx + o[0] * r, cy - o[1] * r, .9 + 1.3 * o[2], 0, 6.2832); ctx.fill();
  }
  // the journey, dashed as the app's routes; every route has faded before the seal comes down
  const out = 1 - seg(SH.OUT0, SH.OUT1);
  if (out > 0) {
    ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.setLineDash([6, 6]); ctx.strokeStyle = C.route;
    for (const L of S.legs) {
      if (t < L.t) continue;
      proj(S.u, L.a, P); proj(S.u, L.b, Q);
      const vis = clamp((Math.min(P[2], Q[2]) - .03) / .22); if (vis <= 0) continue;
      const m = Math.round(L.N * eo(seg(L.t, L.t + SH.LEG)));
      ctx.globalAlpha = ga * out * vis * .95; ctx.beginPath(); let pen = false;
      for (let i = 0; i <= m; i++) {
        proj(L.pts, i * 4, o); if (o[2] <= 0) { pen = false; continue; }
        const X = cx + o[0] * r * L.lift[i], Y = cy - o[1] * r * L.lift[i];
        if (pen) ctx.lineTo(X, Y); else { ctx.moveTo(X, Y); pen = true; }
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  // visited dots: each turns red once, with a small pop and a soft ring, and stays red
  for (const v of S.visited) {
    if (t < v.t) continue;
    proj(S.u, v.i, o); if (o[2] <= .04) continue;
    const x = cx + o[0] * r, y = cy - o[1] * r, edge = clamp((o[2] - .04) / .25), p = seg(v.t, v.t + .42);
    const sc = p < .45 ? eo(p / .45) * 1.45 : 1.45 + (1 - 1.45) * eo((p - .45) / .55);
    if (p < 1) {
      ctx.globalAlpha = ga * edge * .7 * (1 - p); ctx.strokeStyle = C.city; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(x, y, 4.5 + 15 * eo(p), 0, 7); ctx.stroke();
    }
    ctx.globalAlpha = ga * edge; ctx.fillStyle = C.city; ctx.strokeStyle = C.ring; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(x, y, 4 * sc * (.75 + .25 * o[2]), 0, 7); ctx.fill(); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
// the seal: fades out as the globe comes in, then comes down from above (larger, turned further, its shadow
// tightening), a short firm squash and a small jolt, and it stays. s: tile pixels per stage pixel
function shuinSeal(imgs, t, s) {
  const clamp = (v) => v < 0 ? 0 : v > 1 ? 1 : v, seg = (a, b) => clamp((t - a) / (b - a));
  const eo = (p) => 1 - Math.pow(1 - p, 3), ei = (p) => p * p * p, lerp = (a, b, p) => a + (b - a) * p;
  let sc = 1, rot = 0, op, shd = 0;
  if (t < SH.T_DROP - .06) op = 1 - eo(seg(0, .4));
  else if (t < SH.T_PRESS) { const p = seg(SH.T_DROP, SH.T_PRESS), e = ei(p); sc = lerp(1.3, 1, e); rot = lerp(-7, 0, eo(p)); op = clamp((t - SH.T_DROP + .06) / .06); shd = 1 - e; }
  else { sc = 1 - .028 * Math.sin(seg(SH.T_PRESS, SH.T_PRESS + .07) * Math.PI); op = 1; }
  const j = seg(SH.T_PRESS, SH.T_PRESS + .12), jy = j > 0 && j < 1 ? Math.sin(j * Math.PI * 2.5) * (1 - j) * 1.6 * s : 0;
  const tf = `translate(${(jy * .35).toFixed(2)}px, ${jy.toFixed(2)}px) scale(${sc.toFixed(4)}) rotate(${rot.toFixed(2)}deg)`;
  const f = shd > .01 ? `drop-shadow(0 ${(shd * 24 * s).toFixed(2)}px ${((4 + shd * 14) * s).toFixed(2)}px rgba(0,0,0,${(.3 * shd * op).toFixed(3)}))` : 'none';
  imgs.forEach((img) => { img.style.transition = 'none'; img.style.opacity = op.toFixed(3); img.style.transform = tf; img.style.filter = f; });
}
// how long a logo takes to run back to its start in the About strip: a short one at its own speed, a longer one in
// 1.6 s, a long one at twice its speed
const backTime = (ms) => Math.max(ms / 2, Math.min(ms, 1600));
const PLAYERS = {
  shuin: {
    // rewind: from the seal back through the splash to its start, then forward (the About strip)
    play(el, still, rewind = false) {
      if (still) return;
      const run = ++el._run || (el._run = 1);
      shuinGlobe = shuinGlobe || fetch('/assets/img/logos/shuin-globe.json').then((r) => r.json()).then(shuinScene);
      shuinGlobe.then((S) => {
        if (run !== el._run || el.closest('[aria-hidden="true"]')) return;
        const box = el.querySelector('.shuin-splash'), size = box.clientWidth;
        if (!size) return;
        const cv = box.querySelector('canvas') || box.appendChild(document.createElement('canvas'));
        const px = Math.round(size * Math.min(devicePixelRatio || 1, 3));
        if (cv.width !== px) { cv.width = px; cv.height = px; }
        const ctx = cv.getContext('2d'), imgs = [...el.querySelectorAll(':scope > img')];
        // it starts once the tile is on screen (a tab or a slide may still be moving in), and ends if it leaves
        let t0 = 0;
        const io = new IntersectionObserver((es) => {
          const on = es[es.length - 1].isIntersecting;
          if (on && !t0) { t0 = performance.now(); el.classList.add('splashing'); el._raf = requestAnimationFrame(frame); } else if (!on && t0) end();
        });
        const end = () => {
          cancelAnimationFrame(el._raf); io.disconnect(); el._end = null;
          el.classList.remove('splashing');
          ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
          imgs.forEach((img) => { img.style.transition = img.style.opacity = img.style.transform = img.style.filter = ''; });
        };
        el._end = end;
        const T = SH.T_PRESS + .15;
        const frame = (now) => {
          const R = backTime(T * 1000) / 1000, e = (now - t0) / 1000, t = !rewind ? e : e < R ? T - e * T / R : e - R;
          if ((!rewind || e >= R) && t >= T) return end();
          shuinDraw(ctx, px / SH.BOX, S, t, SHUIN_COL[document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light']);
          shuinSeal(imgs, t, size / SH.BOX);
          el._raf = requestAnimationFrame(frame);
        };
        io.observe(el);
      }).catch(() => {});
    },
    reset(el) { el._run = (el._run || 0) + 1; if (el._end) el._end(); },
    loop(el) { this.reset(el); this.play(el, false, true); },
  },
  // Building 8: a grid of sensor cells over the trails; each wakes at its own moment and flickers the way a motion
  // sensor's readings jump, then settles at the strength of its area, a few spots of strong movement fading into
  // each other
  b8: {
    cells(el) {
      const g = el.querySelector('mask g'), N = 30, S = 300 / N;
      if (!g._cells) {
        g._cells = [];
        g.replaceChildren();
        for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
          const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          r.setAttribute('x', i * S); r.setAttribute('y', j * S); r.setAttribute('width', S + .4); r.setAttribute('height', S + .4);
          r.setAttribute('fill', '#fff'); r.setAttribute('shape-rendering', 'crispEdges');
          g.append(r); g._cells.push([r, (i + .5) * S, (j + .5) * S]);
        }
      }
      return g._cells;
    },
    play(el, still) {
      if (still) return;
      const cells = this.cells(el);
      const spots = Array.from({ length: 4 }, () => ({ x: 30 + Math.random() * 240, y: 30 + Math.random() * 240, s: 55 + Math.random() * 60, w: .6 + Math.random() * .4 }));
      const field = (x, y) => Math.min(1, spots.reduce((v, p) => v + p.w * Math.exp(-((x - p.x) ** 2 + (y - p.y) ** 2) / (2 * p.s * p.s)), 0));
      cells.forEach(([r, x, y]) => {
        const end = .22 + .78 * field(x, y), t0 = Math.random() * 900, total = 1500 + Math.random() * 700;
        const a = Math.random() * .9, b = Math.random() * .3, c = .2 + Math.random() * .8;
        r.animate([{ opacity: 0 }, { opacity: 0, offset: t0 / total }, { opacity: a, offset: (t0 + 120) / total }, { opacity: b, offset: (t0 + 260) / total },
          { opacity: c, offset: (t0 + 420) / total }, { opacity: c * .6, offset: Math.min(.95, (t0 + 600) / total) }, { opacity: end }],
        { duration: total, easing: 'steps(18, end)', fill: 'both' });
      });
    },
    reset(el) { clearTimeout(el._t); (el.querySelector('mask g')._cells || []).forEach(([r]) => r.getAnimations().forEach((x) => x.cancel())); },
    // the About strip: the cells flicker out from where they stand, then the sensor reads the trails again
    loop(el) {
      clearTimeout(el._t);
      this.cells(el).forEach(([r]) => {
        const now = +getComputedStyle(r).opacity;
        r.getAnimations().forEach((x) => x.cancel());
        r.animate([{ opacity: now }, { opacity: 0 }], { duration: 400 + Math.random() * 400, delay: Math.random() * 500, easing: 'steps(8, end)', fill: 'both' });
      });
      el._t = setTimeout(() => { this.reset(el); this.play(el, false); }, 1000);
    },
  },
  // the spiral staircase: lines of the model seen from the side; the climbing wall's top edge comes down step by step
  // from parallel to all the way open, as if the Opening slider were pulled, and settles back to about 60 % open
  ss: {
    play(el, still) {
      const run = ++el._run || (el._run = 1);
      if (still) return;
      ssFrames = ssFrames || fetch('/assets/img/logos/staircase-frames.json').then((r) => r.json());
      ssFrames.then((F) => {
        if (run !== el._run) return;
        const wall = el.querySelector('.ss-wall'), edge = el.querySelector('.ss-edge');
        const show = (k) => { wall.setAttribute('d', F[k].wall); edge.setAttribute('d', F[k].edge); };
        const N = F.length, REST = Math.round((N - 1) * .55), seq = [];
        for (let k = 1; k < N; k++) seq.push([k, 1100 / (N - 1)]);
        for (let k = N - 2; k >= REST; k--) seq.push([k, 120]);
        let i = 0;
        const next = () => { if (run !== el._run) return; show(seq[i][0]); i++; if (i < seq.length) el._t = setTimeout(next, seq[i][1]); };
        show(0); el._t = setTimeout(next, 600);
      }).catch(() => {});
    },
    reset(el) { el._run = (el._run || 0) + 1; clearTimeout(el._t); },
    // the About strip: the wall closes from where it rests, step by step, then opens as on the page
    loop(el) {
      this.reset(el);
      const run = el._run;
      ssFrames = ssFrames || fetch('/assets/img/logos/staircase-frames.json').then((r) => r.json());
      ssFrames.then((F) => {
        if (run !== el._run) return;
        const wall = el.querySelector('.ss-wall'), edge = el.querySelector('.ss-edge');
        let k = Math.round((F.length - 1) * .55);
        const back = () => {
          if (run !== el._run) return;
          wall.setAttribute('d', F[k].wall); edge.setAttribute('d', F[k].edge);
          if (k-- > 0) el._t = setTimeout(back, 1100 / (F.length - 1)); else this.play(el, false);
        };
        back();
      }).catch(() => {});
    },
  },
  // Revitesse: the sheet of paper folds into the logo, drawn frame by frame
  rv: {
    play(el, still) {
      const draw = el._draw || (el._draw = rvBuild(el));
      cancelAnimationFrame(el._raf);
      if (still) { draw(1e4); return; }
      const t0 = performance.now(), frame = (now) => { const ms = now - t0; draw(ms); if (ms < 4400) el._raf = requestAnimationFrame(frame); };
      draw(0); el._raf = requestAnimationFrame(frame);
    },
    reset(el) { cancelAnimationFrame(el._raf); },
    // the About strip: the logo unfolds back into the sheet, then folds as on the page
    loop(el) {
      const draw = el._draw || (el._draw = rvBuild(el));
      cancelAnimationFrame(el._raf);
      const B = backTime(4400), t0 = performance.now(), frame = (now) => { const ms = now - t0; draw(ms < B ? 4400 - ms * 4400 / B : ms - B); if (ms < B + 4400) el._raf = requestAnimationFrame(frame); };
      el._raf = requestAnimationFrame(frame);
    },
  },
  // RealStage: SMIL morphs, begun after a pause; removing a frozen morph puts its field back across
  plug: {
    play(el, still) {
      const run = () => { el._done = true; el.querySelectorAll('animate').forEach(a => a.beginElement()); };
      if (still) { run(); el.querySelectorAll('animate').forEach(a => a.endElement()); return; }
      el._t = setTimeout(run, 900);
    },
    reset(el) {
      clearTimeout(el._t);
      el._done = false;
      el.querySelectorAll('animate').forEach(a => a.replaceWith(a.cloneNode()));
    },
    // the About strip: once the fields have slid back, each morph runs in reverse before they slide back again
    loop(el) {
      clearTimeout(el._t);
      if (!el._done) { this.reset(el); this.play(el, false); return; }
      const back = [...el.querySelectorAll('animate')].map((a) => {
        const b = a.cloneNode();
        b.setAttribute('from', a.getAttribute('to')); b.setAttribute('to', a.parentNode.getAttribute('points')); b.setAttribute('dur', backTime(2600) + 'ms');
        a.parentNode.append(b); return b;
      });
      back.forEach((b) => b.beginElement());
      el._t = setTimeout(() => {
        back.forEach((b) => b.remove()); this.reset(el);
        el._done = true; el.querySelectorAll('animate').forEach((a) => a.beginElement());
      }, backTime(2600));
    },
  },
};
// Giraffe Diary: tap the giraffe and it swings its head, as in the app
document.addEventListener('click', (e) => {
  const svg = e.target.closest && e.target.closest('.gd-tile .gd-logo, .gd-tile');
  const logo = svg && (svg.matches('.gd-logo') ? svg : svg.querySelector('.gd-logo'));
  if (!logo || reduced) return;
  logo.classList.remove('play', 'wiggle'); void logo.getBoundingClientRect(); logo.classList.add('wiggle');
});
document.addEventListener('animationend', (e) => { if (e.animationName === 'gdHeadWiggle') e.target.closest('.gd-logo')?.classList.remove('wiggle'); });
// Project logos that play when their project comes into view: the labyrinth opens, the robot
// fires its laser. Each plays again whenever its project comes back into view.
function playLogos(root, dir = -1, landing = false) {
  if (!entered) return;
  root.querySelectorAll('.anim-logo').forEach(svg => {
    // a logo leaving the screen keeps its last frame; it starts over only when it comes back
    if (svg.closest('[aria-hidden="true"]') || svg.closest('[data-dex]')) return;
    // a building brakes because you moved to it; on the page you land on it simply stands
    if (landing && svg.querySelector('.jelly')) return;
    svg.classList.remove('play');
    const player = PLAYERS[svg.dataset.player];
    if (player) { player.reset(svg); player.play(svg, reduced); return; }
    svg.style.setProperty('--dir', dir);
    void svg.getBoundingClientRect();
    svg.classList.add('play');
  });
}
tabs.forEach(t => t.addEventListener('click', () => go(t.dataset.tab)));
// The bar of categories keeps one width whichever is open: each word is measured in bold, as it reads when open, and
// keeps that room (--bw); on a phone the open pill is as wide as the widest word (--lw)
function sizeTabs() {
  const ws = tabs.map((t) => {
    const l = t.querySelector('.lbl'), c = l.cloneNode(true);
    c.style.cssText = 'position:absolute; visibility:hidden; max-width:none; min-width:0; width:auto; font-weight:750';
    t.append(c); const w = Math.ceil(c.getBoundingClientRect().width); c.remove();
    l.style.setProperty('--bw', w + 'px');
    return w;
  });
  $('.tabs').style.setProperty('--lw', Math.max(...ws) + 'px');
}
// the pill under the open tab: it moves to the tab that opens and takes its size
const pill = document.createElement('span'); pill.className = 'tab-ind still'; pill.setAttribute('aria-hidden', 'true');
$('.tabs').prepend(pill);
function placePill(still) {
  const t = tabs.find((x) => x.classList.contains('on')); if (!t) return;
  pill.classList.toggle('still', !!still);
  pill.style.width = t.offsetWidth + 'px'; pill.style.height = t.offsetHeight + 'px';
  pill.style.transform = `translate(${t.offsetLeft}px, ${t.offsetTop}px)`;
}
addEventListener('resize', () => placePill(true));
// a sheet of paper that was crumpled and smoothed out again: soft wrinkles, a few facets a shade lighter or darker, and a
// fine grain; drawn at the sheet's own proportions (w by h) so nothing is stretched, and the same sheet for one seed
function paperImage(w = 1000, h = 1000, seed = Math.random() * 1e9) {
  let a = seed >>> 0;
  const R = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const f = (v) => v.toFixed(1), H = Math.round(1000 * h / w);
  let facets = '';
  for (let k = 0, n = Math.max(7, Math.round(7 * H / 1000)); k < n; k++) {
    const pts = Array.from({ length: 4 }, () => `${f(R() * 1100 - 50)},${f(R() * (H + 100) - 50)}`).join(' ');
    facets += `<polygon points='${pts}' fill='${R() < .5 ? '#fff' : '#000'}' fill-opacity='${(.008 + R() * .012).toFixed(3)}'/>`;
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1000' height='${H}' viewBox='0 0 1000 ${H}' preserveAspectRatio='none'>`
    + `<filter id='u' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='.004' numOctaves='2' seed='${Math.floor(R() * 1e4)}'/>`
    + `<feDiffuseLighting lighting-color='#fff' surfaceScale='3.2'><feDistantLight azimuth='225' elevation='46'/></feDiffuseLighting></filter>`
    + `<filter id='g' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='.6' numOctaves='1' seed='${Math.floor(R() * 1e4)}'/>`
    + `<feColorMatrix values='0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 -2.2 1.35'/></filter>`
    + `<rect width='100%' height='100%' filter='url(#u)' opacity='.27'/>${facets}`
    + `<rect width='100%' height='100%' filter='url(#g)' opacity='.08'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
// Writing is one sheet: as tall as the card plus the longest scroll of its pieces. As a piece scrolls, the sheet moves
// up with the text, so the wrinkles travel with the words
function writingSheet() {
  const writing = $('#writing'), card = writing && $('.glass.card', writing);
  if (!card || !writing.dataset.seed) return;
  const extra = Math.max(0, ...$$('.car-track > .slide', card).map((x) => x.scrollHeight - x.clientHeight));
  const w = card.clientWidth, ph = card.clientHeight + extra;
  if (!w || !ph || (writing._sheet === `${w}x${ph}x${writing.dataset.seed}`)) return;
  writing._sheet = `${w}x${ph}x${writing.dataset.seed}`;
  writing.style.setProperty('--paper', paperImage(w, ph, +writing.dataset.seed)); writing.style.setProperty('--ph', ph + 'px');
}
(() => {
  const writing = $('#writing'), card = writing && $('.glass.card', writing); if (!card) return;
  const slides = $$('.car-track > .slide', card);
  const follow = (x) => writing.style.setProperty('--sy', x.scrollTop + 'px');
  card.addEventListener('scroll', (e) => { if (e.target.matches && e.target.matches('.car-track > .slide') && e.target.getAttribute('aria-hidden') !== 'true') follow(e.target); }, { capture: true, passive: true });
  // another piece: the sheet stands where that piece is scrolled to
  new MutationObserver(() => { const on = slides.find((x) => x.getAttribute('aria-hidden') === 'false'); if (on) follow(on); })
    .observe(card, { subtree: true, attributes: true, attributeFilter: ['aria-hidden'] });
  let t = 0; const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(writingSheet, 150); });
  ro.observe(card); slides.forEach((x) => [...x.children].forEach((c) => ro.observe(c)));
})();
sizeTabs();
if (document.fonts) document.fonts.ready.then(() => { sizeTabs(); placePill(true); });

// A project with something to try says so with one round button, beside the arrows of the open card, while such a
// project is open. It scrolls the card (or on a phone, the page) down to the model, the story, the simulation or the
// limericks. Each time such a project comes into view the button wears the rainbow and the hand makes a peace sign, and
// again every six seconds, until the visitor has been down there; each new visit to the project starts it again
(() => {
  const btn = $('#try'); if (!btn) return;
  const all = $$('.slide').map((slide) => ({ slide, target: slide.querySelector('.b8-build, .vb-box, .ss-live, .limericks'), vis: 0, done: false, there: false })).filter((p) => p.target);
  let cur = null, timer = 0, moved = false;
  const hand = btn.querySelector('animate');
  // the visitor's own scrolling (the wheel, a finger, the keys), not the page's
  for (const ev of ['wheel', 'touchmove']) addEventListener(ev, () => { moved = true; }, { passive: true, capture: true });
  addEventListener('keydown', (e) => { if (/^(Arrow(Up|Down)|Page(Up|Down)| |Home|End)$/.test(e.key)) moved = true; }, true);
  // the hand moves (a nudge, and the middle finger rises into a peace sign) while the rainbow goes round
  let after = 0;
  const ring = () => {
    clearTimeout(after); btn.classList.remove('rainbow', 'wave'); void btn.offsetWidth; btn.classList.add('wave');
    try { hand.beginElement(); } catch (_) {}
    btn.classList.add('rainbow');   // at the same time as the hand
  };
  const cycle = () => { clearTimeout(timer); if (!cur || cur.done || reduced) return; if (entered) ring(); timer = setTimeout(cycle, 6000); };
  // into the row of arrows of the card the project is in, before the arrows
  const place = () => {
    const nav = cur && cur.slide.closest('.glass.card').querySelector(':scope > .card-head .nav');
    if (nav && btn.parentElement !== nav) nav.prepend(btn);
  };
  const update = () => {
    // the open project: the one of them most of whose width is on screen (a neighbour peeking in beside it does not count)
    const next = all.reduce((a, p) => (p.vis > .5 && (!a || p.vis > a.vis) ? p : a), null);
    if (next === cur) return;
    cur = next; clearTimeout(timer); clearTimeout(after); btn.classList.remove('rainbow', 'wave');
    if (cur) cur.done = false;   // a new visit: the light, the hand and the rainbow again
    moved = false;
    btn.classList.toggle('used', !!(cur && cur.done));   // its faint glow stops once it has been used
    btn.hidden = !cur;
    // placed again once a tab or the page has finished moving in
    if (cur) { place(); timer = setTimeout(cycle, 900); }
  };
  // Where each such project stands, measured from the screen itself (an IntersectionObserver misses slides inside the
  // sliding strips on narrow screens): how much of its width is on screen, and whether its interactive part is in view
  const measure = () => {
    for (const p of all) {
      const hidden = p.slide.closest('[aria-hidden="true"]'), r = p.slide.getBoundingClientRect();
      const across = r.width ? Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)) / r.width : 0;
      p.vis = !hidden && r.bottom > 0 && r.top < innerHeight ? across : 0;
      const t = p.target.getBoundingClientRect(), up = Math.max(0, Math.min(t.bottom, innerHeight) - Math.max(t.top, 0));
      p.there = p.vis > .5 && t.height > 0 && up >= Math.min(t.height, innerHeight) * .6;
      if (p.there && p === cur && !p.done && moved) { p.done = true; clearTimeout(timer); clearTimeout(after); btn.classList.remove('rainbow', 'wave'); btn.classList.add('used'); }
    }
    update();
  };
  setInterval(measure, 400);
  addEventListener('scroll', measure, { passive: true, capture: true });
  addEventListener('click', () => setTimeout(measure, 650), true);
  btn.addEventListener('click', () => {
    if (!cur) return;
    const { slide, target } = cur;
    cur.done = true; clearTimeout(timer); clearTimeout(after); btn.classList.remove('rainbow', 'wave'); btn.classList.add('used');
    // the nearest box that scrolls up and down: the card's slide on a computer, the page on a phone
    let box = slide;
    while (box && !(/(auto|scroll)/.test(getComputedStyle(box).overflowY) && box.scrollHeight > box.clientHeight)) box = box.parentElement;
    const behavior = reduced ? 'auto' : 'smooth';
    if (box && box !== document.body && box !== document.documentElement) {
      box.scrollTo({ top: box.scrollTop + target.getBoundingClientRect().top - box.getBoundingClientRect().top - 12, behavior });
    } else {
      scrollTo({ top: scrollY + target.getBoundingClientRect().top - $('header').offsetHeight - 12, behavior });
    }
  });
})();
$$('[data-go]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); go(a.dataset.go); }));
addEventListener('hashchange', () => go(location.hash.slice(1), { push: false }));

// Until the visitor touches a slider, it shows every five seconds that it moves: the handle glides through a few
// values and back to where it was, wearing the rainbow ring only while it moves, and the model follows. The moment
// the visitor touches the slider, it stops for good and the ring never comes back
function sliderHint(input, stops, { every = 5000, thumb = 24 } = {}) {
  if (reduced) return;
  let done = false, busy = false, seen = false, timer = 0;
  const stop = () => { done = true; clearTimeout(timer); };
  for (const t of ['pointerdown', 'keydown', 'input']) input.addEventListener(t, (e) => { if (e.isTrusted) stop(); }, { passive: true });
  const queue = (ms) => { clearTimeout(timer); if (!done) timer = setTimeout(cycle, ms); };
  new IntersectionObserver((es) => { seen = es.some((e) => e.isIntersecting); if (seen && !busy) queue(1200); }, { threshold: .9 }).observe(input);
  const span = () => (+input.max - +input.min) || 1, step = () => +input.step || 1;
  // the ring sits on the handle, wherever the handle is
  function ringAt(ring) {
    const host = input.parentElement, a = input.getBoundingClientRect(), b = host.getBoundingClientRect(), f = (input.value - input.min) / span();
    const x = isRtl(input) ? a.right - b.left - thumb / 2 - f * (a.width - thumb) : a.left - b.left + thumb / 2 + f * (a.width - thumb);   // a right-to-left slider starts on the right
    ring.style.left = x + 'px'; ring.style.top = (a.top - b.top + a.height / 2) + 'px';
  }
  const glide = (to, ring) => new Promise((res) => {
    const from = +input.value, T = 500 + 1200 * Math.abs(to - from) / span(), t0 = performance.now();
    const frame = (now) => {
      if (done) return res();
      const u = Math.min(1, (now - t0) / T), e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      const v = Math.round((from + (to - from) * e) / step()) * step();
      if (Math.abs(v - +input.value) > 1e-9) { input.value = v; input.dispatchEvent(new Event('input', { bubbles: true })); }
      ringAt(ring);
      if (u < 1) requestAnimationFrame(frame); else res();
    };
    requestAnimationFrame(frame);
  });
  async function cycle() {
    if (done || busy || !seen) return;
    // not while the greeting covers the page, nor in a tab out of sight
    if (document.getElementById('greet') || document.hidden) { queue(1000); return; }
    busy = true;
    const ring = document.createElement('span'); ring.className = 'rb-ring live'; input.parentElement.append(ring); ringAt(ring);
    const back = +input.value;
    for (const v of [...stops, back]) { if (done) break; await glide(v, ring); }
    ring.classList.add('out'); setTimeout(() => ring.remove(), 400);
    busy = false; queue(every);
  }
}
sliderHint($('#cityRange'), [10]);          // 1 % to 10 % and back
sliderHint($('#b8Range'), [3, 10]);         // 6 to 3 to 10 and back to 6 of 40 layers
sliderHint($('#ngRange'), [1]);             // the museum: step 1 to 2 and back

/* ================= project images and the viewer ================= */
// Each .thumbs lists its images as "file|caption;file|caption". Thumbnails load small;
// the click opens the full image. An entry with no file is an empty slot for a later image.
// A box marked data-dark has a "-dark" copy of each image, shown when the site is in dark mode.
const lb = $('#lightbox'), lbImg = $('#lbImg'), lbCap = $('#lbCap');
let lbSet = [], lbAt = 0, lbFrom = null;
const themed = (s) => s.f + (s.dark && document.documentElement.dataset.theme === 'dark' ? '-dark' : '');
$$('.thumbs').forEach(box => {
  const dark = box.hasAttribute('data-dark');
  const set = box.dataset.imgs.split(';').map(s => { const [f, c, ar] = s.split('|'); return { f: f.trim(), c: (c || '').trim(), ar: +ar || 0, dark }; });
  const row = box.classList.contains('row');
  // A row keeps each image's proportions; capped so two phone screenshots do not grow huge.
  if (row) box.style.maxWidth = Math.round(set.reduce((t, s) => t + (s.ar || 1), 0) * 420) + 'px';
  box.innerHTML = set.map((s, k) => s.f
    ? `<button class="thumb" type="button" data-k="${k}"${row ? ` style="flex:${s.ar || 1} 1 0"` : ''} aria-label="${t('Open image: {c}', { c: s.c })}"><img src="/assets/img/projects/thumbs/${themed(s)}.jpg"${dark ? ` data-f="${s.f}"` : ''} alt="${s.c}" loading="lazy" decoding="async"></button>`
    : `<div class="thumb" aria-hidden="true"><span class="slot">${t('Image to come')}</span></div>`).join('');
  box.addEventListener('click', e => {
    const b = e.target.closest('button.thumb'); if (!b) return;
    openLb(set.filter(s => s.f), set.filter(s => s.f).indexOf(set[+b.dataset.k]), b);
  });
});
let lbFlip = null;
function showLb(k) {
  lbAt = (k + lbSet.length) % lbSet.length;
  const s = lbSet[lbAt];
  clearTimeout(lbFlip);
  lb.classList.toggle('paper', !!s.paper);
  if (s.frames) {
    // a quarter of a second for each frame, then a pause on the last
    let n = 0;
    const step = () => { lbImg.src = s.frames[n]; lbFlip = setTimeout(step, n === s.frames.length - 1 ? 1450 : 250); n = (n + 1) % s.frames.length; };
    step();
  } else lbImg.src = s.src || `/assets/img/projects/${themed(s)}.jpg`;
  lbImg.alt = s.c;
  lbCap.innerHTML = `${s.c}${lbSet.length > 1 ? `<span>${lbAt + 1}/${lbSet.length}</span>` : ''}`;
  $('#lbPrev').hidden = $('#lbNext').hidden = lbSet.length < 2;
}
function openLb(set, k, from) {
  lbSet = set; lbFrom = from; showLb(k);
  lb.classList.add('open'); lb.setAttribute('aria-hidden', 'false');
  document.documentElement.classList.add('lb-lock');
  $('#lbClose').focus();
}
function closeLb() {
  clearTimeout(lbFlip);
  lb.classList.remove('open'); lb.setAttribute('aria-hidden', 'true');
  document.documentElement.classList.remove('lb-lock');
  if (lbFrom) lbFrom.focus({ preventScroll: true });
}
$('#lbClose').addEventListener('click', closeLb);
$('#lbPrev').addEventListener('click', e => { e.stopPropagation(); showLb(lbAt - 1); });
$('#lbNext').addEventListener('click', e => { e.stopPropagation(); showLb(lbAt + 1); });
lb.addEventListener('click', e => { if (e.target === lb || e.target.classList.contains('stage')) closeLb(); });
addEventListener('keydown', e => {
  if (!lb.classList.contains('open')) return;
  if (e.key === 'Escape') closeLb();
  else if (e.key === 'ArrowLeft') showLb(lbAt + (RTL ? 1 : -1));
  else if (e.key === 'ArrowRight') showLb(lbAt + (RTL ? -1 : 1));
});
// swipe between images on a phone
{
  let x0 = null;
  lb.addEventListener('pointerdown', e => { x0 = e.clientX; });
  lb.addEventListener('pointerup', e => {
    if (x0 === null || lbSet.length < 2) return;
    const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) showLb(lbAt + ((dx < 0) !== RTL ? 1 : -1));
  });
}

/* ================= the greeting ================= */
// Shown on every arrival. The first click, tap or key fades it out and the page rises in.
const greet = $('#greet');
let entered = false;
{
  const h = new Date().getHours();
  const hello = t(h >= 5 && h < 12 ? 'Good morning.' : h >= 12 && h < 18 ? 'Good afternoon.' : 'Good evening.');
  // One screen: the greeting for the visitor's time of day, word by word, then the name and the welcome under it.
  // A click at any moment still enters.
  const el = $('#greetHello');
  const words = (t) => t.split(' ').map((w, k) => `<span style="animation-delay:${.15 + k * .22}s">${w}</span>`).join(' ');
  // The greeting appears at its own slow pace; once all of it is there (and the page has loaded), it moves on.
  const loaded = new Promise(r => { if (document.readyState === 'complete') r(); else addEventListener('load', r, { once: true }); setTimeout(r, 3000); });
  const second = () => {
    el.classList.remove('out'); el.innerHTML = words(hello); greet.classList.add('p2');
    Promise.all([loaded, new Promise(r => setTimeout(r, reduced ? 0 : 1700))]).then(() => setTimeout(enter, 150));
  };
  second();
}
function enter() {
  if (entered) return;
  entered = true;
  greet.classList.add('leaving');
  document.documentElement.classList.remove('pre');
  setTimeout(() => { greet.remove(); go(current, { push: false }); }, reduced ? 0 : 900);
}
greet.addEventListener('click', enter);
addEventListener('keydown', e => { if (!entered && ['Enter', ' ', 'Escape'].includes(e.key)) { e.preventDefault(); enter(); } });
greet.focus();
try {
  if (sessionStorage.getItem('langSwitch')) {
    sessionStorage.removeItem('langSwitch');
    entered = true; greet.remove(); document.documentElement.classList.remove('pre');
  }
} catch (_) {}

/* ================= the pointer ================= */
// On a computer with a mouse, a soft round dot follows the pointer, as on an iPad: it grows a little over what can be
// clicked and shrinks while pressed. In text fields the usual text cursor comes back; on touch screens nothing changes
if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reduced) {
  const dot = document.createElement('div'); dot.className = 'dot-cursor'; dot.setAttribute('aria-hidden', 'true'); document.body.append(dot);
  let tx = -100, ty = -100, raf = 0;
  const move = () => { raf = 0; dot.style.setProperty('--x', tx + 'px'); dot.style.setProperty('--y', ty + 'px'); };
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    document.documentElement.classList.add('has-dot'); dot.classList.remove('gone');
    tx = e.clientX; ty = e.clientY; if (!raf) raf = requestAnimationFrame(move);
    const el = e.target.closest ? e.target : null;
    dot.classList.toggle('text', !!(el && el.closest('input, textarea, [contenteditable]')));
    dot.classList.toggle('over', !!(el && el.closest('a, button, [role="button"], [role="tab"], label, select, .thumb, .dex-item, input[type="range"]')));
  }, { passive: true });
  addEventListener('pointerdown', () => dot.classList.add('down'));
  addEventListener('pointerup', () => dot.classList.remove('down'));
  document.addEventListener('mouseleave', () => dot.classList.add('gone'));
}

/* ================= Building 8: the mouse is sensed ================= */
// While the Building 8 project is open, the mouse is watched the way the project watched the people in the hall: it
// draws one continuous path, faint and in the project's red, which fades from its tail within about a second and a half.
// It shows only once the mouse has gone a quarter of the screen's longer side in one unbroken movement.
// Over the animation of the motion and the 3D model of the bar it leaves nothing: those show the motion themselves
if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reduced) {
  const slide = ($('#desTrack .b8-logo') || {}).closest?.('.slide');
  if (slide) {
    const cv = document.createElement('canvas'); cv.className = 'sense-trail'; cv.setAttribute('aria-hidden', 'true'); document.body.append(cv);
    const ctx = cv.getContext('2d'), W = 18, LIFE = 1300, pts = [];   // as wide as the pointer's dot
    let raf = 0, open = false, checked = 0, brk = false;
    // the path only shows once the mouse has gone a quarter of the screen's longer side in one unbroken movement
    let run = 0, px = null, py = null, pt = 0;
    const size = () => { const k = devicePixelRatio || 1; cv.width = innerWidth * k; cv.height = innerHeight * k; ctx.setTransform(k, 0, 0, k, 0, 0); };
    size(); addEventListener('resize', size);
    // the project counts as open when most of it is across the screen and its tab is showing
    const isOpen = () => {
      const r = slide.getBoundingClientRect(), across = r.width ? Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)) / r.width : 0;
      return !slide.closest('[aria-hidden="true"]') && across > .5 && r.bottom > 0 && r.top < innerHeight;
    };
    // Each piece of the path fades with its age, so the tail thins out gradually. Pieces are drawn on a white sheet with
    // 'darken' (each pixel keeps the strongest piece over it, so nothing doubles where pieces meet), and the canvas is
    // multiplied onto the page, where white leaves the page as it is. In the dark theme the same on black, with 'lighten'
    // and 'screen'
    let last = 0;
    const draw = (now) => {
      while (pts.length && now - pts[0][2] > LIFE) pts.shift();
      const dark = document.documentElement.dataset.theme === 'dark';
      cv.style.mixBlendMode = dark ? 'screen' : 'multiply';
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = dark ? '#000' : '#fff'; ctx.fillRect(0, 0, innerWidth, innerHeight);
      if (pts.length) {
        const red = dark ? [255, 70, 60] : [227, 18, 11];
        const still = Math.min(1, Math.max(0, (now - last) / LIFE)), k = 1 - still * still * (3 - 2 * still);
        ctx.globalCompositeOperation = dark ? 'lighten' : 'darken';
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = W;
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i], q = i ? pts[i - 1] : null, age = Math.min(1, (now - p[2]) / LIFE);
          const a = .09 * k * (1 - age * age * (3 - 2 * age));
          if (a < .002) continue;
          // the colour that, multiplied onto the page, looks like the red at this strength
          const col = red.map((c) => Math.round(dark ? c * a : 255 - (255 - c) * a));
          ctx.strokeStyle = `rgb(${col.join(',')})`;
          ctx.beginPath();
          if (!q || p[3] || p[2] - q[2] > 300) { ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + .01, p[1]); }
          else { ctx.moveTo(q[0], q[1]); ctx.lineTo(p[0], p[1]); }
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      if (!pts.length) ctx.clearRect(0, 0, innerWidth, innerHeight);
      raf = pts.length ? requestAnimationFrame(draw) : 0;
    };
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const now = performance.now();
      if (now - checked > 250) { open = isOpen(); checked = now; }
      if (!open) return;
      // over the animation of the motion or the 3D model the path stops, and starts afresh beyond it
      if (e.target.closest && e.target.closest('.b8-stage, .b8-flip, .b8-build')) { brk = true; run = 0; px = null; return; }
      // a pause of more than 300 ms ends the movement; the distance starts again from nought
      if (px === null || now - pt > 300) run = 0; else run += Math.hypot(e.clientX - px, e.clientY - py);
      px = e.clientX; py = e.clientY; pt = now;
      if (run < Math.max(innerWidth, innerHeight) / 4) { brk = true; return; }
      pts.push([e.clientX, e.clientY, now, brk]); brk = false; last = now;
      if (!raf) raf = requestAnimationFrame(draw);
    }, { passive: true });
  }
}

/* ================= Writing: ink ================= */
// A mouse that rests on the paper for three seconds leaves an ink stain under it, each one of its own shape, spreading
// slowly; when the mouse moves away, the stain fades away over three seconds
if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reduced) {
  const card = $('#writing .glass.card');
  if (card) {
    let timer = 0, stain = null, ox = 0, oy = 0;
    const blob = () => {
      // a rough round outline: a ring of points at random distances, joined by smooth curves
      const n = 11, pts = Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2, r = 34 + Math.random() * 14; return [50 + r * Math.cos(a), 50 + r * Math.sin(a)]; });
      let d = '';
      for (let i = 0; i < n; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % n], mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        d += (i ? 'Q' : `M${((pts[n - 1][0] + x0) / 2).toFixed(1)} ${((pts[n - 1][1] + y0) / 2).toFixed(1)}Q`) + `${x0.toFixed(1)} ${y0.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
      }
      // a few drops thrown off round it
      let drops = '';
      for (let k = 0, m = 2 + Math.floor(Math.random() * 4); k < m; k++) {
        const a = Math.random() * Math.PI * 2, r = 46 + Math.random() * 14;
        drops += `<circle cx="${(50 + r * Math.cos(a)).toFixed(1)}" cy="${(50 + r * Math.sin(a)).toFixed(1)}" r="${(1.2 + Math.random() * 2.6).toFixed(1)}"/>`;
      }
      const id = 'ink' + Math.floor(Math.random() * 1e9);
      return `<svg viewBox="0 0 100 100" aria-hidden="true"><filter id="${id}"><feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="2" seed="${Math.floor(Math.random() * 999)}"/>`
        + `<feDisplacementMap in="SourceGraphic" scale="7"/></filter><g filter="url(#${id})"><path d="${d}Z"/>${drops}</g></svg>`;
    };
    const fade = () => {
      if (!stain) return;
      const s0 = stain; stain = null;
      s0.classList.add('gone');
      s0.animate([{ opacity: getComputedStyle(s0).opacity }, { opacity: 0 }], { duration: 3000, easing: 'ease-in-out', fill: 'forwards' }).finished.then(() => s0.remove(), () => s0.remove());
    };
    let rest = false;
    card.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      // a hand on a mouse is never quite still: within a few pixels of where it stopped, it is resting
      if (rest && Math.hypot(e.clientX - ox, e.clientY - oy) <= 5) return;
      fade();
      clearTimeout(timer);
      ox = e.clientX; oy = e.clientY; rest = true;
      timer = setTimeout(() => {
        if (stain) return;
        const r = card.getBoundingClientRect(), size = 70 + Math.random() * 60;
        stain = document.createElement('span'); stain.className = 'ink'; stain.innerHTML = blob();
        stain.style.cssText = `left:${ox - r.left - size / 2}px; top:${oy - r.top - size / 2}px; width:${size}px; height:${size}px; --rot:${Math.floor(Math.random() * 360)}deg`;
        card.append(stain);
      }, 3000);
    });
    card.addEventListener('pointerleave', () => { clearTimeout(timer); rest = false; fade(); });
  }
}

/* ================= the Museum of the 20th Century: open brickwork ================= */
// While the museum is open, a faint brick bond in grey lies on the page behind its card, like the museum's façade.
// Around the mouse the bond is laid again as a perforated wall: each brick narrows in its place, still resting on the
// two below it, so open joints appear in a chequer. Over the card the wall opens at the card's edge nearest the mouse.
// It stays open while the mouse stays; when it moves on, the bricks it has left grow back, and halfway through, the
// bricks at its new place begin to narrow
if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reduced) {
  const slide = ($('#archTrack .m20-logo') || {}).closest?.('.slide'), card = slide && slide.closest('.glass.card');
  if (slide && card) {
    const cv = document.createElement('canvas'); cv.className = 'bricks-bg'; cv.setAttribute('aria-hidden', 'true'); document.body.append(cv);
    const ctx = cv.getContext('2d'), BW = 26, BH = 9, GAP = 2.5, STEP = BW + GAP, HALF = STEP / 2, HEAD = HALF + 4;   // narrowed, a brick still rests 4px on each of the two below it
    const RX = 90, RY = 55, OPEN = 260, CLOSE = 420;
    const open = new Map();   // brick -> how open it is, 0 to 1
    let raf = 0, w = 0, h = 0, last = 0, mouse = null, shown = false;
    const size = () => {
      const k = devicePixelRatio || 1; w = innerWidth; h = innerHeight;
      cv.width = w * k; cv.height = h * k; ctx.setTransform(k, 0, 0, k, 0, 0); paint();
    };
    const key = (r, c) => r * 1000 + c, rc = (k) => { const r = Math.floor((k + 500) / 1000); return [r, k - r * 1000]; };
    // how open the wall wants to be at a brick: fully at the point, less towards the edge of an oval round it
    const want = (r, c) => {
      if (!mouse) return 0;
      const off = r % 2 ? HALF : 0, cx = c * STEP - off + BW / 2, cy = r * (BH + GAP) + BH / 2;
      const d = Math.hypot((cx - mouse[0]) / RX, (cy - mouse[1]) / RY);
      return d >= 1 ? 0 : Math.min(1, 1.35 * (1 - d * d));
    };
    const paint = () => {
      ctx.clearRect(0, 0, w, h);
      if (!shown && !open.size) return;
      const ink = document.documentElement.dataset.theme === 'dark' ? '232,232,238' : '40,40,46';
      ctx.fillStyle = `rgba(${ink},.06)`;
      for (let r = 0, y = 0; y < h; r++, y += BH + GAP) {
        const off = r % 2 ? HALF : 0;
        for (let c = 0, x = -off; x < w; c++, x += STEP) {
          const f = open.get(key(r, c)) || 0, e = f * f * (3 - 2 * f), fw = BW - (BW - HEAD) * e;
          ctx.fillRect(x + (BW - fw) / 2, y, fw, BH);
        }
      }
    };
    const tick = (now) => {
      const dt = last ? Math.min(64, now - last) : 16; last = now;
      let busy = false, leaving = false;
      if (mouse) {
        const r0 = Math.max(0, Math.floor((mouse[1] - RY) / (BH + GAP))), r1 = Math.ceil((mouse[1] + RY) / (BH + GAP));
        for (let r = r0; r <= r1; r++) {
          const off = r % 2 ? HALF : 0;
          for (let c = Math.max(0, Math.floor((mouse[0] - RX + off) / STEP) - 1); c <= Math.ceil((mouse[0] + RX + off) / STEP); c++)
            if (want(r, c) > 0 && !open.has(key(r, c))) open.set(key(r, c), 0);
        }
      }
      for (const [k, v] of open) {
        const t = want(...rc(k));
        if (t < v) {
          const n = Math.max(t, v - dt / CLOSE); busy = true;
          if (n > .5 && t < .02) leaving = true;
          if (n <= 0) open.delete(k); else open.set(k, n);
        }
      }
      for (const [k, v] of open) {
        const t = want(...rc(k));
        if (t > v) { busy = true; if (!leaving) open.set(k, Math.min(t, v + dt / OPEN)); }
        else if (t === 0 && v === 0) open.delete(k);
      }
      paint();
      raf = busy ? requestAnimationFrame(tick) : 0;
      if (!raf) last = 0;
    };
    const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };
    size(); addEventListener('resize', size);
    // shown while the museum is the project in front
    const isOpen = () => {
      const r = slide.getBoundingClientRect(), across = r.width ? Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)) / r.width : 0;
      return !slide.closest('[aria-hidden="true"]') && across > .5;
    };
    const check = () => {
      const on = isOpen();
      if (on !== shown) { shown = on; cv.classList.toggle('on', on); if (!on) { mouse = null; open.clear(); } paint(); }
    };
    setInterval(check, 300); check();
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || !shown) return;
      // over the card, the nearest point on its edge
      const b = card.getBoundingClientRect();
      let x = e.clientX, y = e.clientY;
      if (x > b.left && x < b.right && y > b.top && y < b.bottom) {
        const dl = x - b.left, dr = b.right - x, dtp = y - b.top, db = b.bottom - y, m = Math.min(dl, dr, dtp, db);
        if (m === dl) x = b.left; else if (m === dr) x = b.right; else if (m === dtp) y = b.top; else y = b.bottom;
      }
      mouse = [x, y]; wake();
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { mouse = null; wake(); });
    new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
}

/* ================= Wandering Wayfarer: footsteps ================= */
// While the map of the Archive rolls up, someone walks along its top from left to right, not in a straight line: footprints, left and right in
// turn, each fading over a few seconds. The mouse leaves none
if (!reduced) {
  const panel = $('#archive'), map = panel && $('.map', panel);
  if (map) {
    const cv = document.createElement('canvas'); cv.className = 'sense-trail'; cv.setAttribute('aria-hidden', 'true'); document.body.append(cv);
    const ctx = cv.getContext('2d'), STRIDE = 34, SIDE = 7, LIFE = 2000, WALK = 1200, steps = [];
    let raf = 0;
    const size = () => { const k = devicePixelRatio || 1; cv.width = innerWidth * k; cv.height = innerHeight * k; ctx.setTransform(k, 0, 0, k, 0, 0); };
    size(); addEventListener('resize', size);
    // one footprint: a sole and a heel, turned the way of walking
    const foot = (x, y, ang, alpha, ink) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang + Math.PI / 2); ctx.fillStyle = `rgba(${ink},${alpha.toFixed(3)})`;
      ctx.beginPath(); ctx.ellipse(0, -3.2, 3.4, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, 5.2, 2.6, 2.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };
    const draw = (now) => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      const ink = document.documentElement.dataset.theme === 'dark' ? '235,235,242' : '35,35,40';
      while (steps.length && now - steps[0][3] > LIFE) steps.shift();
      for (const [x, y, ang, t] of steps) if (now >= t) { const k = 1 - (now - t) / LIFE; foot(x, y, ang, .22 * k * k, ink); }
      raf = steps.length ? requestAnimationFrame(draw) : 0;
    };
    // the walk: along the top of the map, wandering up and down, from left to right; done in 1.2 seconds, well before the
    // rolling up of the map (2.6 seconds, slow at the end) reaches the top
    map.addEventListener('animationstart', (e) => {
      if (e.animationName !== 'mapUp') return;
      const r = map.getBoundingClientRect(), x0 = Math.max(16, r.left + 14), x1 = Math.min(innerWidth - 16, r.right - 14);
      const yc = r.top + Math.min(46, r.height * .12), p1 = Math.random() * 6, p2 = Math.random() * 6, L = x1 - x0;
      // a path that wanders: two waves of different lengths, gently up and down
      const path = (x) => yc + 16 * Math.sin(p1 + (x - x0) / L * Math.PI * 2.2) + 7 * Math.sin(p2 + (x - x0) / L * Math.PI * 6.5);
      // footprints at equal steps along it
      const pts = [];
      for (let x = x0, run = STRIDE, px = x0, py = path(x0); x <= x1; x += 2) {
        const y = path(x); run += Math.hypot(x - px, y - py); px = x; py = y;
        if (run >= STRIDE) { run = 0; pts.push([x, y, Math.atan2(path(x + 2) - y, 2)]); }
      }
      const t0 = performance.now(), n = pts.length;
      steps.length = 0;
      pts.forEach(([x, y, ang], i) => { const sd = i % 2 ? 1 : -1; steps.push([x + Math.cos(ang + Math.PI / 2) * SIDE * sd, y + Math.sin(ang + Math.PI / 2) * SIDE * sd, ang, t0 + WALK * i / Math.max(1, n - 1)]); });
      if (!raf) raf = requestAnimationFrame(draw);
    });
  }
}

/* ================= light and dark ================= */
// The OS decides until the visitor presses the button; that choice is then remembered.
const darkOS = matchMedia('(prefers-color-scheme: dark)');
const savedTheme = () => { try { return localStorage.getItem('theme'); } catch (_) { return null; } };
// the app screenshots that have a dark copy change with the theme, in the row and in the open viewer
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  $$('.thumbs img[data-f]').forEach(img => { img.src = `/assets/img/projects/thumbs/${themed({ f: img.dataset.f, dark: true })}.jpg`; });
  if (lb.classList.contains('open') && lbSet[lbAt]?.dark) lbImg.src = `/assets/img/projects/${themed(lbSet[lbAt])}.jpg`;
}
$('#themeBtn').addEventListener('click', () => {
  const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(t);
  try { localStorage.setItem('theme', t); } catch (_) {}
});
darkOS.addEventListener('change', e => { if (!['light', 'dark'].includes(savedTheme())) applyTheme(e.matches ? 'dark' : 'light'); });
// whatever sets the theme (the button, the system, the browser), the screenshots that have a dark copy follow it
{
  let was = document.documentElement.dataset.theme;
  new MutationObserver(() => { const now = document.documentElement.dataset.theme; if (now !== was) { was = now; applyTheme(now); } })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  applyTheme(document.documentElement.dataset.theme || 'light');
}

/* ================= contact, privacy and cookies: one popover open at a time ================= */
const pops = [[$('#contactBtn'), $('#contactPop')], [$('#cookieBtn'), $('#privacyPop')], [$('#langBtn'), $('#langPop')]];
// a flag keeps the tab you are on, and the next page skips the greeting: you are already here
$$('#langPop a').forEach(a => a.addEventListener('click', () => {
  a.href = a.getAttribute('href').split('#')[0] + (location.hash || '');
  try { sessionStorage.setItem('langSwitch', '1'); } catch (_) {}
}));
// Each menu drops from under its own button: right-aligned to the button where there is room,
// kept 12px inside the screen otherwise, opening from the button's centre.
function placePop(b, p) {
  const r = b.getBoundingClientRect(), w = p.offsetWidth, vw = document.documentElement.clientWidth;
  let left = Math.min(r.right + 6, vw - 12) - w;
  left = Math.max(12, Math.min(left, vw - 12 - w));
  p.style.top = (r.bottom + 12) + 'px';
  p.style.left = left + 'px';
  p.style.right = 'auto';
  p.style.setProperty('--ox', Math.round(r.left + r.width / 2 - left) + 'px');
}
const setPop = (which, open) => pops.forEach(([b, p], k) => {
  const on = open && k === which;
  if (on) placePop(b, p);
  p.classList.toggle('open', on); b.setAttribute('aria-expanded', on);
});
addEventListener('resize', () => pops.forEach(([b, p]) => { if (p.classList.contains('open')) placePop(b, p); }));
pops.forEach(([b, p], k) => b.addEventListener('click', e => { e.stopPropagation(); setPop(k, !p.classList.contains('open')); }));
document.addEventListener('click', e => { if (!pops.some(([, p]) => p.contains(e.target))) setPop(-1, false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') setPop(-1, false); });

/* ================= visitor counts (GoatCounter: no cookies, no personal data) ================= */
// Set GOATCOUNTER to the code chosen at goatcounter.com, e.g. 'ramymaher', to switch counting on.
// Each tab is counted as its own page (/about, /archive ...), so the dashboard shows which
// sections people open, how many visitors came and which countries they came from.
const GOATCOUNTER = 'ramymaher';
if (GOATCOUNTER && !/^(localhost|127\.)/.test(location.hostname)) {
  window.goatcounter = { no_onload: true };
  const gc = document.createElement('script');
  gc.async = true; gc.src = 'https://gc.zgo.at/count.js';
  gc.dataset.goatcounter = `https://${GOATCOUNTER}.goatcounter.com/count`;
  gc.onload = () => countView(current);
  document.head.appendChild(gc);
}
function countView(id) {
  if (window.goatcounter && window.goatcounter.count && id) window.goatcounter.count({ path: (LANG === 'en' ? '/' : '/' + LANG + '/') + id, title: id });
}

/* ================= carousel with swipe ================= */
function carousel({ car, trackEl, prev, next, count, dots, onChange }) {
  const slides = [...trackEl.children];
  const n = slides.length;
  const rtl = isRtl(car), S = rtl ? 1 : -1;
  let i = 0;
  dots.innerHTML = slides.map(() => '<i></i>').join('');
  function show(k, fromUser = true) {
    const old = i;
    i = Math.max(0, Math.min(n - 1, k));
    trackEl.style.transform = `translateX(${S * i * 100}%)`;
    count.textContent = `${i + 1}/${n}`;
    prev.disabled = i === 0; next.disabled = i === n - 1;
    [...dots.children].forEach((d, j) => d.classList.toggle('on', j === i));
    slides.forEach((s, j) => s.setAttribute('aria-hidden', j !== i));
    car.style.height = slides[i].offsetHeight + 'px';
    if (i !== old) playLogos(car, (i < old ? 1 : -1) * (rtl ? -1 : 1));
    onChange && onChange(i, old, fromUser);
  }
  prev.addEventListener('click', () => show(i - 1));
  next.addEventListener('click', () => show(i + 1));

  let x0 = 0, y0 = 0, dx = 0, down = false, dragging = false, moved = false;
  car.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('.car') !== car) return;
    // Sliders and the 3D models keep their own gestures.
    if (e.target.closest('input, .b8-build, .ss-live')) return;
    // A sideways-scrolling strip of screenshots (phones) keeps its own swipe.
    const strip = e.target.closest('.thumbs.phones, .thumbs.wide');
    if (strip && strip.scrollWidth > strip.clientWidth) return;
    down = true; dragging = false; moved = false; x0 = e.clientX; y0 = e.clientY; dx = 0;
  });
  car.addEventListener('pointermove', e => {
    if (!down) return;
    dx = e.clientX - x0;
    const dy = e.clientY - y0;
    if (!dragging) {
      if (Math.abs(dx) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) { down = false; return; }   // a vertical scroll, not a swipe
      dragging = true; moved = true; trackEl.classList.add('drag');
      try { car.setPointerCapture(e.pointerId); } catch (_) {}
    }
    const dn = rtl ? -dx : dx;   // as if left to right
    const edge = (i === 0 && dn > 0) || (i === n - 1 && dn < 0);
    trackEl.style.transform = `translateX(calc(${S * i * 100}% + ${edge ? dx / 3 : dx}px))`;
  });
  const end = () => {
    if (!down) return;
    down = false;
    if (!dragging) return;
    trackEl.classList.remove('drag');
    const w = car.clientWidth;
    const dn = rtl ? -dx : dx;
    if (dn < -Math.min(60, w * .18)) show(i + 1);
    else if (dn > Math.min(60, w * .18)) show(i - 1);
    else show(i, false);
  };
  car.addEventListener('pointerup', end);
  car.addEventListener('pointercancel', end);
  car.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  new ResizeObserver(() => { car.style.height = slides[i].offsetHeight + 'px'; }).observe(trackEl);
  slides.forEach(sl => new ResizeObserver(() => { if (sl === slides[i]) car.style.height = sl.offsetHeight + 'px'; }).observe(sl));
  show(0, false);
  return { show, get index() { return i; } };
}

/* ================= typewriter ================= */
// Types a limerick up to its last line, then waits: a click or tap on the poem types the fifth.
function typer(host, text, { speed = 30, lineGap = 240 } = {}) {
  host.innerHTML = ''; host.classList.add('tw');
  const stop = text.lastIndexOf('\n');   // the four lines end here; the fifth waits for a click
  const hint = document.createElement('button');
  hint.type = 'button'; hint.className = 'reveal';
  hint.textContent = t(matchMedia('(hover: none)').matches ? 'Tap for the punchline' : 'Click for the punchline');
  const ghost = document.createElement('div'); ghost.className = 'ghost'; ghost.textContent = text;
  const out = document.createElement('div'); out.className = 'typed';
  const txt = document.createTextNode(''); const caret = document.createElement('span'); caret.className = 'caret';
  out.append(txt, caret); host.append(ghost, out, hint);
  host.setAttribute('aria-label', text.slice(0, stop));
  let k = 0, timer = null, state = 'idle';
  const wait4 = () => { k = stop; txt.data = text.slice(0, stop); state = 'waiting'; host.classList.add('waiting'); };
  const run = (to, then) => {
    const step = () => {
      k++; txt.data = text.slice(0, k);
      if (k >= to) { then(); return; }
      const ch = text[k - 1];
      const wait = ch === '\n' ? lineGap : /[,.;]/.test(ch) ? speed * 4 : speed * (0.6 + Math.random() * 0.8);
      timer = setTimeout(step, wait);
    };
    timer = setTimeout(step, 250);
  };
  const tw = {
    get state() { return state; },
    start() {
      if (state !== 'idle') return;
      if (reduced) { wait4(); return; }
      state = 'typing';
      run(stop, wait4);
    },
    reveal() {
      if (state !== 'waiting') return;
      host.classList.remove('waiting'); host.setAttribute('aria-label', text);
      if (reduced) { tw.finish(); return; }
      state = 'revealing';
      run(text.length, () => { state = 'done'; host.classList.add('done'); });
    },
    // leaving a limerick: the four lines stay; a fifth already on its way is completed
    finish() {
      clearTimeout(timer);
      if (state === 'revealing') { txt.data = text; k = text.length; state = 'done'; host.classList.add('done'); }
      else if (state === 'typing') wait4();
    },
  };
  host.addEventListener('click', () => tw.reveal());
  return tw;
}

/* ================= writing ================= */
const LIMERICKS = [
`I took a myriad of endless trips,
searching for the taste of literary lips
in faraway places,
at slow and fast paces.
In the valley between your hips.`,
`I took the trait of being kind,
left my poetic soul behind.
I moved away,
but my ghost did stay
to give the world a piece of my mind.`,
`A limerick, sly and mysterious,
whispers prophecies, sounding serious.
Chants horribly dark lyrics,
then runs away in hysterics,
but they say I’m delirious.`,
`He found poetry too elusive,
its rhymes, too abusive.
He butchered every line,
until slogans align
with propaganda’s exclusive.`,
`I opened my mouth with no retort
when they asked to see my passport.
In the name of law and order,
I quoted Kafka at the border,
and checked the cleavage of my escort.`,
];
const poemTrack = $('#poemTrack');
poemTrack.innerHTML = LIMERICKS.map(() => '<div class="slide"><div class="poem"><div></div></div></div>').join('');
const poemTypers = $$('.poem > div', poemTrack).map((el, k) => typer(el, LIMERICKS[k], { speed: 34 }));
let poemsReady = false;   // set once the award card has appeared

const poems = carousel({
  car: $('#poemCar'), trackEl: poemTrack, prev: $('#poemPrev'), next: $('#poemNext'),
  count: $('#poemCount'), dots: $('#poemDots'),
  onChange(i, old) {
    if (old !== i && ['typing', 'revealing'].includes(poemTypers[old].state)) poemTypers[old].finish();
    if (poemsReady) poemTypers[i].start();
  },
});

/* ================= architecture and design ================= */
const CARS = {};
CARS.architecture = carousel({ car: $('#archCar'), trackEl: $('#archTrack'), prev: $('#archPrev'), next: $('#archNext'), count: $('#archCount'), dots: $('#archDots') });
CARS.design = carousel({ car: $('#desCar'), trackEl: $('#desTrack'), prev: $('#desPrev'), next: $('#desNext'), count: $('#desCount'), dots: $('#desDots') });
CARS.writing = carousel({ car: $('#writCar'), trackEl: $('#writTrack'), prev: $('#writPrev'), next: $('#writNext'), count: $('#writCount'), dots: $('#writDots') });

// Building 8: the button swaps the render for the animation of the motion (3.5 MB, loaded only
// when asked for) and back
$$('.b8-stage').forEach(st => {
  const btn = $('.b8-play', st), still = $('.b8-still', st), anim = $('.b8-anim', st);
  btn.addEventListener('click', () => {
    const on = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', on);
    if (on) { anim.src = '/assets/img/projects/b8-motion.gif?' + Date.now(); anim.hidden = false; still.hidden = true; }
    else { anim.hidden = true; anim.removeAttribute('src'); still.hidden = false; }
  });
  btn.addEventListener('click', e => e.stopPropagation());
  const flip = st.parentElement.querySelector('.b8-flip');
  const set = () => [
    anim.hidden ? { src: still.src, c: still.alt } : { src: anim.src, c: anim.alt },
    { frames: $$('img', flip).map(i => i.src), c: flip.getAttribute('aria-label') },
  ];
  st.addEventListener('click', () => openLb(set(), 0, st));
  flip.addEventListener('click', () => openLb(set(), 1, flip));
});

// A model zooms with the wheel only when the wheel starts on it. A scroll that began beside it goes on scrolling the
// page when the model slides under the pointer, instead of turning into a zoom (a pause of a third of a second ends one
// turn of the wheel, a trackpad's glide included)
const wheelOnly = (() => {
  let last = -1e9, owner = null;
  addEventListener('wheel', (e) => { if (e.timeStamp - last > 330) owner = e.target.closest ? e.target.closest('.b8-3d') : null; last = e.timeStamp; }, { capture: true, passive: true });
  return (box) => box.addEventListener('wheel', (e) => { if (owner !== box) e.stopPropagation(); }, { capture: true });
})();

const framed = matchMedia('(min-width: 901px)');   // the width from which the cards fill the screen (as in the CSS)
// On a computer a project card scrolls inside itself and the page around it does not; a wheel turned on the card's
// margins, beside a model, or on the page around the card scrolls the card's project too, instead of doing nothing
addEventListener('wheel', (e) => {
  if (e.ctrlKey || !document.documentElement.classList.contains('fit-tab') || !e.target.closest) return;
  if (!framed.matches) return;   // narrower, the page itself scrolls
  const panel = e.target.closest('.panel.fit'); if (!panel) return;
  if (e.target.closest('.slide, .card-scroll, .map, .b8-3d, iframe, .pop')) return;   // those scroll, or zoom, on their own
  const card = panel.querySelector('.wrap > .glass.card'); if (!card) return;
  const mid = card.getBoundingClientRect(), cx = mid.left + mid.width / 2;
  let best = null, dist = 1e9;
  for (const s of card.querySelectorAll('.car-track > .slide, .card-scroll')) { const r = s.getBoundingClientRect(); const d = Math.abs(r.left + r.width / 2 - cx); if (r.width && d < dist) { dist = d; best = s; } }
  if (!best) return;
  best.scrollBy(0, e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? best.clientHeight : 1)); e.preventDefault();
}, { passive: false });

// Building 8 in 3D: the hall and the bar's boards from the Rhino model (1 unit = 5 cm), drawn like the
// staircase: white faces, grey lines, colour only for the board being placed. The doors, the metal stair, the
// gallery, the bridge and the ramp's railings are added after the render. three.js and the model (60 kB) load
// only when it first comes into view; the slider places one board per step
$$('.b8-build:not(.city-build):not(.ng-build):not(.et-build)').forEach(fig => {
  const box = $('.b8-3d', fig), range = $('input', fig), out = $('output', fig);
  let started = false;
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting) && !started) { started = true; io.disconnect(); start(); } }, { rootMargin: '200px' });
  io.observe(box);
  async function start() {
    const [THREE, { OrbitControls }, data] = await Promise.all([
      import('https://cdn.jsdelivr.net/npm/three@0.160.0/+esm'),
      import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js/+esm'),
      fetch('/assets/data/b8-layers.json').then(r => r.json()),
    ]);
    const ren = new THREE.WebGLRenderer({ antialias: true });
    ren.setClearColor('#ffffff', 1); ren.setPixelRatio(Math.min(2, devicePixelRatio)); box.append(ren.domElement);
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, 1, 1, 3000);
    cam.position.set(-12, 40, -168);                                // on the ramp, looking at the glass front, as in the render
    const ctl = new OrbitControls(cam, ren.domElement);
    ctl.target.set(96, 11, -38); ctl.enablePan = false; ctl.minDistance = 25; ctl.maxDistance = 420; ctl.maxPolarAngle = Math.PI * .49; ctl.update();   // zooms in on the bar
    ren.domElement.style.touchAction = 'none';   // a drag that starts on the model turns it; outside it, the page scrolls
    wheelOnly(box);
    const WHITE = new THREE.MeshBasicMaterial({ color: '#fff', side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const EDGE = new THREE.LineBasicMaterial({ color: '#94a3b8' }), THIN = new THREE.LineBasicMaterial({ color: '#b6c0ce' });
    const P = (x, y, z) => [x, z, -y];                           // the model's plan x, y and height z, in three's axes
    const segs = [], thin = [];
    const edges = (g, ang = 30, into = segs) => { const p = new THREE.EdgesGeometry(g, ang).attributes.position.array; for (let i = 0; i < p.length; i++) into.push(p[i]); };
    const add = (g, ang) => { scene.add(new THREE.Mesh(g, WHITE)); edges(g, ang); };
    const solid = (parts) => parts.forEach(s => { const g = new THREE.BufferGeometry(), p = []; for (let i = 0; i < s.pos.length; i += 3) p.push(...P(s.pos[i], s.pos[i + 1], s.pos[i + 2])); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(s.idx); add(g, 30); });
    const blk = (x0, x1, y0, y1, z0, z1) => { const g = new THREE.BoxGeometry(x1 - x0, z1 - z0, y1 - y0); g.translate((x0 + x1) / 2, (z0 + z1) / 2, -(y0 + y1) / 2); add(g, 30); };
    const line = (a, b, into = thin) => into.push(...P(...a), ...P(...b));
    const S = data.solids;
    // the floor, out to the glass front and into the door openings; the low landing by the glass doors; the steps,
    // the upper level, the ramp, and the red wall with its two openings
    blk(-22.1, 141, -59.6, 164.8, -1, 0); blk(141, 146.7, 76.7, 111.2, -1, 0); blk(141, 146.7, -33.1, 1.4, -1, 0);
    // the four steps up to the entrance level: equal risers of 15 cm on 26 cm treads, one stepped piece
    { const pr = [[164.8, -1]]; for (let k = 0; k < 4; k++) pr.push([164.8 + 5.2 * k, 3 * (k + 1)], [164.8 + 5.2 * (k + 1), 3 * (k + 1)]); pr.push([185.6, -1]);
      const g = new THREE.ExtrudeGeometry(new THREE.Shape(pr.map(([u, v]) => new THREE.Vector2(u, v))), { depth: 140.6, bevelEnabled: false, curveSegments: 1 });
      g.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, .4, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1)); add(g, 30); }
    // the ramp, from the hall floor up to the entrance level
    { const g = new THREE.ExtrudeGeometry(new THREE.Shape([[-14.2, 0], [186, 12], [186, 0]].map(([u, v]) => new THREE.Vector2(u, v))), { depth: 22.5, bevelEnabled: false, curveSegments: 1 });   // solid down to the floor
      g.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, -22.1, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1)); add(g, 30); }
    const plate = (outline, holes, z0, z1) => {
      const s = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y))); for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
      const g = new THREE.ExtrudeGeometry(s, { depth: z1 - z0, bevelEnabled: false, curveSegments: 1 }); g.rotateX(-Math.PI / 2); g.translate(0, z0, 0); add(g, 30);
    };
    plate([[-80.4, -64], [-22.1, -64], [-22.1, 186], [189.4, 186], [189.4, 324.6], [-80.4, 324.6]], [], 11, 12);
    const XW = -86.1, ZT = 67;                                                     // the corridor wall, up to the floor above
    for (const [v0, v1, fl] of [[12, ZT, 12], [ZT, 140, 70]]) {                      // level 1, and its copy on level 2
      const s = new THREE.Shape([[-64, v0], [324.6, v0], [324.6, v1], [-64, v1]].map(([u, v]) => new THREE.Vector2(u, v)));
      const doors = [[40, 74.5], [120, 154.5]];
      for (const [u0, u1] of doors) s.holes.push(new THREE.Path([[u0, Math.max(fl, v0 + .01)], [u1, Math.max(fl, v0 + .01)], [u1, fl + 44], [u0, fl + 44]].map(([u, v]) => new THREE.Vector2(u, v))));
      const g = new THREE.ExtrudeGeometry(s, { depth: 5.7, bevelEnabled: false, curveSegments: 1 });
      g.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, XW, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1)); add(g, 30);
      for (const [u0, u1] of doors) { const um = (u0 + u1) / 2; blk(XW + 1.6, XW + 4.1, u0 + 1, um - .15, fl, fl + 44); blk(XW + 1.6, XW + 4.1, um + .15, u1 - 1, fl, fl + 44); }
    }
    // the red wall
    const RW = 141, RT = 140, LV2 = 70, BAND = 120, GAL = [[15, 60], [75, 115], [130, 170.6]];   // GAL: the openings between the piers
    { const s = new THREE.Shape([[-59.3, 0], [185.6, 0], [185.6, RT], [-59.3, RT], [-59.3, BAND], [0, BAND], [0, LV2], [-59.3, LV2]].map(([u, v]) => new THREE.Vector2(u, v)));
      for (const [u0, u1] of [[76.7, 111.2], [-33.1, 1.4]]) s.holes.push(new THREE.Path([[u0, .01], [u1, .01], [u1, 44], [u0, 44]].map(([u, v]) => new THREE.Vector2(u, v))));
      for (const [u0, u1] of GAL) s.holes.push(new THREE.Path([[u0, LV2], [u1, LV2], [u1, BAND], [u0, BAND]].map(([u, v]) => new THREE.Vector2(u, v))));
      const g = new THREE.ExtrudeGeometry(s, { depth: 5.7, bevelEnabled: false, curveSegments: 1 });
      g.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, RW, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1)); add(g, 30); }
    // the doors: 2.2 m double doors
    for (const [y0, y1] of [[76.7, 111.2], [-33.1, 1.4]]) {
      const ym = (y0 + y1) / 2; blk(142.6, 145.1, y0 + 1, ym - .15, 0, 44); blk(142.6, 145.1, ym + .15, y1 - 1, 0, 44);
      for (const [y, s] of [[ym - 2.5, 1], [ym + 2.5, -1]]) line([142.4, y, 21], [142.4, y + s * 3, 21], segs);
    }
    // the metal stair, a U against the red wall: the lower flight away from the wall rises from the hall to a landing,
    // the upper flight turns back along the wall, over the first door, to the gallery; 20 risers of 17.5 cm, 1.1 m wide
    const RISE = 3.625, GO = 5.6, W = 22, LAND = 26, XS = 141 - W;   // XS: the stair's wall side, one flight's width off the wall
    const flight = (x0, x1, yA, zA, dir, n) => {
      for (let k = 0; k < n; k++) { const y = yA + dir * k * GO, z = zA + (k + 1) * RISE; blk(x0, x1, Math.min(y, y + dir * GO), Math.max(y, y + dir * GO), z - .8, z); }
      const yB = yA + dir * n * GO, zB = zA + n * RISE;
      for (const x of [x0, x1]) { line([x, yA, zA], [x, yB, zB], segs); line([x, yA, zA - 3], [x, yB, zB - 3], segs); }
      return [yB, zB];
    };
    const yF = 185.6, [yL, zL] = flight(XS - 2 * W, XS - W, yF, 12, -1, 8);   // lower flight: from the entrance level, south
    blk(XS - 2 * W, XS, yL - LAND, yL, zL - .8, zL);                              // landing
    const [yT, zT] = flight(XS - W, XS, yL, zL, 1, 8);                            // upper flight: back north, to level 2
    // railings: posts and a handrail 1 m above the treads, on the stair's open sides
    const rail = (pts) => { for (let i = 1; i < pts.length; i++) line([pts[i - 1][0], pts[i - 1][1], pts[i - 1][2] + 20], [pts[i][0], pts[i][1], pts[i][2] + 20]); for (const [x, y, z] of pts) line([x, y, z], [x, y, z + 20]); };
    const along = (x, y0, z0, y1, z1, n) => Array.from({ length: n + 1 }, (_, i) => [x, y0 + (y1 - y0) * i / n, z0 + (z1 - z0) * i / n]);
    rail(along(XS - 2 * W, yF, 12, yL, zL, 8)); rail([[XS - 2 * W, yL, zL], [XS - 2 * W, yL - LAND, zL], [XS, yL - LAND, zL], [XS, yL, zL]]);
    rail(along(XS - W, yL, zL, yT, zT, 8)); rail(along(XS, yL, zL, yT, zT, 8));
    // the bridge across the glass front at gallery height: 1.8 m wide, with posts under its far end
    const zB = zT, by1 = -23;
    const XE = RW + 5.7 + 30;   // level 2 runs on through the red wall to a walkway 1.5 m wide outside it
    plate([[XW + 5.7, -59.6], [XE, -59.6], [XE, 250], [XW + 5.7, 250]], [[[0.4, by1], [141, by1], [141, yT], [0.4, yT]]], zB - 3, zB);
    const railLine = (a, b, n) => rail(Array.from({ length: n + 1 }, (_, i) => [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n, zB]));
    railLine([XW + 5.7, 250], [XE, 250], 26);  railLine([0.4, by1], [141, by1], 14); railLine([0.4, by1], [0.4, yT], 18); railLine([0.4, yT], [XS - W, yT], 9); railLine([XS, yT], [141, yT], 2);   // open where the stair arrives
    // the gallery behind the red wall, which the bridge leads to, and the railings in the wall's openings
    for (const [y0, y1] of [...GAL, [by1, 0]]) rail(Array.from({ length: 6 }, (_, k) => [RW + 2.85, y0 + (y1 - y0) * k / 5, LV2]));
    // curtain walls, their steel grids, closing both ends of the building
    const curtain = (a, b, z0, z1) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 21));
      for (let i = 0; i <= n; i++) { const f = i / n, x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f; line([x, y, z0], [x, y, z1], segs); }
      for (const z of [z0, ...[26, 46, 67, 100, 120].filter((z) => z > z0 + 2 && z < z1 - 2), z1]) line([a[0], a[1], z], [b[0], b[1], z], segs);
    };
    curtain([XW, -59.6], [146.7, -59.6], -1.1, RT);
    curtain([XW, 324.6], [146.7, 324.6], 12, RT);

    // the railings round the ramp, on both sides, 1 m above its slope
    const rz = (y) => 12 * (y + 14.2) / 200.2;
    for (const x of [0.4, -22.1]) rail(Array.from({ length: 26 }, (_, i) => { const y = -14.2 + 200.2 * i / 25; return [x, y, rz(y)]; }));
    const OPEN = [...GAL, [-59.3, 0]], inOpen = (ya, yb) => OPEN.some(([a, b]) => Math.min(ya, yb) >= a - .2 && Math.max(ya, yb) <= b + .2);
    const near = (v, t, e = .2) => v > t - e && v < t + e;
    const drop = (ax, ah, ay, bx, bh, by) => {
      if (near(ax, RW) && near(bx, RW) && ah > ZT - .2 && ah < 70.2 && bh > ZT - .2 && bh < 70.2) return !((near(ah, LV2) && near(bh, LV2) && inOpen(ay, by)) || (near(ah, ZT) && near(bh, ZT) && Math.max(ay, by) <= by1 + .2));   // inner face: only the openings' feet, and the bridge's underside
      if (near(ax, RW + 5.7) && near(bx, RW + 5.7) && near(ah, LV2) && near(bh, LV2)) return inOpen(ay, by);                                                    // far face: the openings' feet go
      return near(ax, XW, .3) || near(ax, XW + 5.7, .3) ? near(ah, ZT) && near(bh, ZT) && near(bx, ax, .3) : false;                                              // the two corridor walls: one
    };
    for (let i = segs.length - 6; i >= 0; i -= 6) if (drop(segs[i], segs[i + 1], -segs[i + 2], segs[i + 3], segs[i + 4], -segs[i + 5])) segs.splice(i, 6);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(segs, 3)); scene.add(new THREE.LineSegments(lg, EDGE));
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(thin, 3)); scene.add(new THREE.LineSegments(tg, THIN));
    // the boards, lowest first: a board is in the staircase's colours while it moves and white once it lands;
    // the boards above the slider's position are not there yet
    const A = new THREE.Color('#22c3a0'), B = new THREE.Color('#3b82f6');
    const boards = data.boards.slice().sort((p, q) => p.z - q.z || p.id - q.id).map((b, i, all) => {
      const shape = (L) => { const pts = []; for (let k = 0; k < L.length; k += 2) pts.push(new THREE.Vector2(L[k], L[k + 1])); return pts; };
      // the model's outlines run a little into the red wall: cut them at its face
      const clip = (L, xm = 141) => { const o = []; for (let k = 0; k < L.length; k += 2) { const a = [L[k], L[k + 1]], q = [L[(k + 2) % L.length], L[(k + 3) % L.length]];
        if (a[0] <= xm) o.push(a[0], a[1]); if ((a[0] <= xm) !== (q[0] <= xm)) { const f = (xm - a[0]) / (q[0] - a[0]); o.push(xm, a[1] + (q[1] - a[1]) * f); } } return o; };
      const s = new THREE.Shape(shape(clip(b.loops[0]))); for (const L of b.loops.slice(1)) s.holes.push(new THREE.Path(shape(L)));
      const g = new THREE.ExtrudeGeometry(s, { depth: b.h, bevelEnabled: false, curveSegments: 1 }); g.rotateX(-Math.PI / 2);
      for (const L of b.islands || []) { const gi = new THREE.ExtrudeGeometry(new THREE.Shape(shape(L)), { depth: b.h, bevelEnabled: false, curveSegments: 1 }); gi.rotateX(-Math.PI / 2); g.islands = (g.islands || []).concat(gi); }
      const c = A.clone().lerp(B, i / (all.length - 1));
      const lit = { face: new THREE.MeshBasicMaterial({ color: c.clone().lerp(new THREE.Color('#fff'), .35), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }), line: new THREE.LineBasicMaterial({ color: c }) };
      const grp = new THREE.Group(), meshes = [], lns = [];
      for (const geo of [g, ...(g.islands || [])]) { const m = new THREE.Mesh(geo, WHITE), l = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), EDGE); meshes.push(m); lns.push(l); grp.add(m, l); }
      grp.position.y = b.z; scene.add(grp);
      return { grp, meshes, lns, lit, z: b.z, off: 0, vis: true, leaving: false };
    });
    const DROP = 18;                                               // a board comes down from 90 cm above its place
    let shown = +range.value, raf = 0, held = true;   // the first boards stay coloured until the slider is first moved
    function paint() { out.value = out.textContent = shown + ' / ' + boards.length; }
    function tick() {
      let moving = false;
      boards.forEach((b, i) => {
        if (b.leaving) { b.off += (DROP - b.off) * .28; if (b.off > DROP - .5) { b.leaving = false; b.vis = false; b.off = 0; } else moving = true; }
        else if (b.off > .02) { b.off *= .75; moving = true; } else b.off = 0;
        const lit = b.off > .05 || (held && i < shown); b.meshes.forEach((m) => { m.material = lit ? b.lit.face : WHITE; }); b.lns.forEach((l) => { l.material = lit ? b.lit.line : EDGE; });
        b.grp.visible = b.vis; b.grp.position.y = b.z + b.off;
      });
      ren.render(scene, cam); raf = moving ? requestAnimationFrame(tick) : 0;
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
    function set(v) {
      if (v > shown) for (let i = shown; i < v; i++) { const b = boards[i]; b.vis = true; b.leaving = false; b.off = i === v - 1 ? DROP : 0; }
      else for (let i = v; i < shown; i++) boards[i].leaving = true;
      shown = v; paint(); kick();
    }
    boards.forEach((b, i) => { b.vis = i < shown; });
    function size() { const r = box.getBoundingClientRect(); if (!r.width) return; ren.setSize(r.width, r.height); cam.aspect = r.width / r.height; cam.fov = 50 * Math.pow(Math.max(1, 1.5 / cam.aspect), .7); cam.updateProjectionMatrix(); kick(); }
    ctl.addEventListener('change', kick);
    range.addEventListener('input', (e) => { if (e.isTrusted) held = false; set(+range.value); });   // the slider's own demonstration keeps the first boards coloured
    new ResizeObserver(size).observe(box);
    paint(); size();
  }
});

// Museum of the 20th Century in 3D: the Kulturforum as white massing (the museum from the HdM model 469_NG20, its
// neighbours and streets from OpenStreetMap), the floors and walls of its two public passages, the boulevard stair from
// the model (assets/data/ng20-stairs.json), and the two ways through it, drawn as a glow like the way through Layers
// of Egypt. three.js and the stair (80 kB) load only when the model first comes into view; the slider and Play step
// through the site, the museum, its floors and the two ways
$$('.ng-build').forEach(fig => {
  let started = false;
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting) && !started) { started = true; io.disconnect(); start(); } }, { rootMargin: '200px' });
  io.observe($('.ng-3d', fig));
  async function start() {
    const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/+esm');
    const { OrbitControls } = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js/+esm');

    const box = $('.ng-3d', fig), range = $('input', fig), out = $('output', fig), cap = $('.ng-cap', fig), playBtn = $('.b8-play', fig), hint = $('.ng-hint', fig);
    const CAPS = $$('.ng-caps p', fig).map(p => p.textContent.trim()), STEPS = $$('.ng-steps li', fig).map(li => li.textContent.trim());
    const NAMES = Object.fromEntries($$('.ng-names li', fig).map(li => [li.dataset.en, li.textContent.trim()])), N = (en) => NAMES[en] || en;

    /* ---------- renderer, camera ---------- */
    const ren = new THREE.WebGLRenderer({ antialias: true });
    ren.setPixelRatio(Math.min(2, devicePixelRatio)); box.prepend(ren.domElement);
    ren.domElement.style.touchAction = 'none';   // a drag that starts on the model turns it; outside it, the page scrolls
    wheelOnly(box);
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, 1.6, 2, 5000);
    const P = (x, y, z) => [x, z, -y];                       // plan x (east), y (north), height z → three's axes
    cam.position.set(...P(-70, -125, 150));
    const ctl = new OrbitControls(cam, ren.domElement);
    ctl.target.set(...P(66, 62, 0)); ctl.minDistance = 25; ctl.maxDistance = 1300; ctl.maxPolarAngle = Math.PI * .495; ctl.update();

    /* ---------- materials, coloured from the page's tokens so the model follows light and dark ---------- */
    const face = (o = {}) => new THREE.MeshBasicMaterial({ color: '#fff', side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, ...o });
    const M = {
      face: face(), edge: new THREE.LineBasicMaterial({ color: '#94a3b8' }),
      shell: face({ transparent: true }), shellEdge: new THREE.LineBasicMaterial({ color: '#64748b', transparent: true }),
      int: face({ transparent: true, opacity: 0 }), intEdge: new THREE.LineBasicMaterial({ color: '#64748b', transparent: true, opacity: 0 }),
      slab: face({ transparent: true, opacity: 0, depthWrite: false }),
      ghost: new THREE.LineDashedMaterial({ color: '#94a3b8', dashSize: 1.6, gapSize: 1.2 }),
      ground: new THREE.MeshBasicMaterial({ color: '#eef1f5', side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 }),
      lid: new THREE.MeshBasicMaterial({ color: '#eef1f5', side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 }),
      street: new THREE.MeshBasicMaterial({ color: '#dfe4eb', side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    };
    function theme() {
      // the site draws the model in its light colours; in dark mode the page inverts the canvas, as it does for Building 8
      const v = (n) => ({ '--stage': '#ffffff', '--face': '#ffffff', '--edge': '#94a3b8', '--edge-strong': '#64748b', '--ground': '#eef1f5', '--street': '#dfe4eb' })[n];
      ren.setClearColor(v('--stage'), 1);
      for (const k of ['face', 'shell', 'int', 'slab']) M[k].color.set(v('--face'));
      M.edge.color.set(v('--edge')); M.ghost.color.set(v('--edge'));
      M.shellEdge.color.set(v('--edge-strong')); M.intEdge.color.set(v('--edge-strong'));
      M.ground.color.set(v('--ground')); M.lid.color.set(v('--ground')); M.street.color.set(v('--street'));
      kick();
    }

    const groups = { context: new THREE.Group(), shell: new THREE.Group(), inside: new THREE.Group(), under: new THREE.Group() };
    Object.values(groups).forEach(g => scene.add(g));
    function finish(g, into, mf = M.face, me = M.edge, ang = 25) {
      into.add(new THREE.Mesh(g, mf));
      into.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, ang), me));
    }
    function ghost(g, into) { const l = new THREE.LineSegments(new THREE.EdgesGeometry(g, 25), M.ghost); l.computeLineDistances(); into.add(l); }
    const toThree = (g, f) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const [x, y, z] = f(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, ...P(x, y, z)); } p.needsUpdate = true; return g; };
    const V2 = ([x, y]) => new THREE.Vector2(x, y);

    // a polygon in plan (with holes: polygons or circles {c:[x,y], r}), extruded from z0 to z1
    function shapeOf(poly, holes = []) {
      const s = new THREE.Shape(poly.map(V2));
      for (const h of holes) { const p = new THREE.Path(); if (h.r) p.absarc(h.c[0], h.c[1], h.r, 0, Math.PI * 2, true); else p.setFromPoints(h.map(V2)); s.holes.push(p); }
      return s;
    }
    function prism(poly, z0, z1, holes = []) {
      const g = new THREE.ExtrudeGeometry(shapeOf(poly, holes), { depth: z1 - z0, bevelEnabled: false, curveSegments: 28 });
      return toThree(g, (x, y, z) => [x, y, z0 + z]);
    }
    // free triangles, each [[x,y,z],[x,y,z],[x,y,z]] in plan coordinates
    function tris(list) {
      const a = []; for (const t of list) for (const v of t) a.push(...P(...v));
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); return g;
    }
    const triangulate = (poly) => THREE.ShapeUtils.triangulateShape(poly.map(V2), []);
    function surfaceSolid(poly, zf, z0 = 0) {
      const t = [];
      for (const [i, j, k] of triangulate(poly)) t.push([[...poly[i], zf(...poly[i])], [...poly[j], zf(...poly[j])], [...poly[k], zf(...poly[k])]]);
      for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; t.push([[...a, z0], [...b, z0], [...b, zf(...b)]], [[...a, z0], [...b, zf(...b)], [...a, zf(...a)]]); }
      return tris(t);
    }
    function tent(poly, z0, zEdge, apex) {
      const t = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        t.push([[...a, z0], [...b, z0], [...b, zEdge]], [[...a, z0], [...b, zEdge], [...a, zEdge]], [[...a, zEdge], [...b, zEdge], apex]);
      }
      return tris(t);
    }
    // the six faces of a box given as four plan corners and two heights, as triangles
    function boxTris(q, z0, z1, t) {
      const lo = q.map(p => [...p, z0]), hi = q.map(p => [...p, z1]);
      t.push([lo[0], lo[1], lo[2]], [lo[0], lo[2], lo[3]], [hi[0], hi[1], hi[2]], [hi[0], hi[2], hi[3]]);
      for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; t.push([lo[i], lo[j], hi[j]], [lo[i], hi[j], hi[i]]); }
    }

    /* ---------- the museum, in its own axes: u across (west → east, 0–71.3), w along (south → north, 0–113) ---------- */
    const S = [0.9484, -0.31707], L = [0.31676, 0.94851];
    const W = (u, w) => [12.55 + S[0] * u + L[0] * w, 21.7 + S[1] * u + L[1] * w];   // HdM model axes → site plan (OSM metres)
    const WU = (poly) => poly.map(([u, w]) => W(u, w));
    const rectUV = (u0, w0, u1, w1) => WU([[u0, w0], [u1, w0], [u1, w1], [u0, w1]]);
    const RIDGE = 35.65, EAVE = 10.3, TOP = 18.3;
    const zRoof = (u) => EAVE + (TOP - EAVE) * (1 - Math.abs(u - RIDGE) / RIDGE);
    // walls and roof follow the outline with its notch round the plane tree (469_NG20 DA OKF); the roof runs on unbroken
    const WALLS = [[0, 0], [71.3, 0], [71.3, 113], [0, 113], [0, 100.4], [16.1, 100.3], [21.2, 85], [16.1, 69.7], [0, 69.7]];
    function clipU(poly, keepLeft) {
      const inside = ([u]) => keepLeft ? u <= RIDGE : u >= RIDGE, o = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        if (inside(a)) o.push(a);
        if (inside(a) !== inside(b)) { const f = (RIDGE - a[0]) / (b[0] - a[0]); o.push([RIDGE, a[1] + (b[1] - a[1]) * f]); }
      }
      return o;
    }
    {
      const t = [], up = (u, w) => [...W(u, w), zRoof(u)];
      for (const half of [clipU(WALLS, true), clipU(WALLS, false)]) for (const [i, j, k] of triangulate(half)) t.push([up(...half[i]), up(...half[j]), up(...half[k])]);
      for (let i = 0; i < WALLS.length; i++) {
        const a = WALLS[i], b = WALLS[(i + 1) % WALLS.length], pts = [a];
        if ((a[0] - RIDGE) * (b[0] - RIDGE) < 0) { const f = (RIDGE - a[0]) / (b[0] - a[0]); pts.push([RIDGE, a[1] + (b[1] - a[1]) * f]); }
        pts.push(b);
        for (let k = 1; k < pts.length; k++) { const p = pts[k - 1], q = pts[k]; t.push([[...W(...p), 0], [...W(...q), 0], up(...q)], [[...W(...p), 0], up(...q), up(...p)]); }
      }
      finish(tris(t), groups.shell, M.shell, M.shellEdge, 20);
    }

    const EG = .35, MEZ = 3.9, OG1 = 7.35, UG1 = -6.65;
    const UG = [[-2.9, -7.2], [71.3, -7.2], [71.2, 112], [0, 112], [0, 102.6], [17.8, 102.5], [23.7, 84.9], [17.9, 67.2], [0, 67.3], [0, .5], [-2.8, .5]];
    const TUNNEL = [[31.6, -7.2], [39.6, -7.2], [39.6, -40], [31.6, -40]];

    // the main stair, taken straight from the HdM model (469_NG20, 000-26.ifc), in site metres × 100: "Treppe Boulevard",
    // the full width of the north–south axis, down from the ground floor to the lower floor and on to the Neue Nationalgalerie
    const STAIRS = await fetch('/assets/data/ng20-stairs.json').then(r => r.json());
    for (const k of ['boulevard']) {
      const { v, i } = STAIRS[k], pos = new Float32Array(v.length);
      for (let n = 0; n < v.length; n += 3) { const [x, y, z] = P(v[n] / 100, v[n + 1] / 100, v[n + 2] / 100); pos[n] = x; pos[n + 1] = y; pos[n + 2] = z; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(i);
      finish(g, groups.inside, M.int, M.intEdge, 30);
    }

    // the floor slabs, 40 cm, with their openings: the stair voids, the multi-purpose hall, the entrance hall, the helix stairs
    const slab = (outline, holes, z) => finish(prism(outline, z - .4, z, holes), groups.inside, M.int, M.intEdge, 30);
    const hUV = (u0, w0, u1, w1) => rectUV(u0, w0, u1, w1);
    const circ = ([u, w], r) => ({ c: W(u, w), r });
    slab(WU(UG), [], UG1);
    slab(WU(WALLS), [hUV(27.5, 58.2, 43.7, 89.2), hUV(27.5, 34.7, 43.7, 45.5), hUV(27.6, 4.3, 43.7, 13.7)], EG);
    slab(WU(TUNNEL), [], UG1);

    // walls of the axes only: the north–south spine (16.2 m) and the east–west axis (12 m), open where they cross
    const wallU = (u, w0, w1, z0, z1, t = .4) => finish(prism(rectUV(u - t / 2, w0, u + t / 2, w1), z0, z1), groups.inside, M.int, M.intEdge);
    const wallW = (w, u0, u1, z0, z1, t = .4) => finish(prism(rectUV(u0, w - t / 2, u1, w + t / 2), z0, z1), groups.inside, M.int, M.intEdge);
    for (const u of [27.5, 43.7]) wallU(u, 58, 104.7, EG, OG1 - .4);
    // the east–west axis's south wall steps round the opening just south of the crossing: __|-|__
    for (const u of [27.5, 43.7]) wallU(u, 34.7, 45.9, EG, OG1 - .4);
    wallW(34.7, 27.3, 43.9, EG, OG1 - .4);
    // and the opening at the south end, walled all round
    for (const u of [27.6, 43.7]) wallU(u, 4.3, 13.7, EG, OG1 - .4);
    for (const w of [4.3, 13.7]) wallW(w, 27.4, 43.9, EG, OG1 - .4);   // south of the crossing the ground floor over the path is gallery, open to the galleries beside it
    for (const w of [45.9, 58]) { wallW(w, 0, 27.5, EG, OG1 - .4); wallW(w, 43.7, 71.3, EG, OG1 - .4); }
    for (const u of [27.5, 43.7]) { wallU(u, -7.2, 45.9, UG1, -.4); wallU(u, 58, 110.5, UG1, -.4); }
    for (const u of [31.6, 39.6]) wallU(u, -40, -7.2, UG1, -2.4);

    /* ---------- the neighbours (OpenStreetMap, metres east / north of 52.5075 N, 13.3675 E) ---------- */
    const C = groups.context;
    let NNG_LOW;
    { // Neue Nationalgalerie: the raised terrace, the glass hall under the 64.8 m roof on eight columns, the lower floor in the podium
      const c = [5.75, -58.25], e1 = [0.947, -0.321], e2 = [0.321, 0.947], T = 3.4;
      const N = (u, v) => [c[0] + e1[0] * u + e2[0] * v, c[1] + e1[1] * u + e2[1] * v];
      const rect = (u0, u1, v0, v1) => [N(u0, v0), N(u1, v0), N(u1, v1), N(u0, v1)];
      finish(prism(rect(-54, 54, -55, 51), 0, T), C);
      finish(prism(rect(-25.2, 25.2, -25.2, 25.2), T, T + 8.4), C);
      finish(prism(rect(-32.4, 32.4, -32.4, 32.4), T + 8.4, T + 10.2), C);
      for (const s of [-1, 1]) for (const k of [-16.2, 16.2]) for (const [u, v] of [[k, s * 31.6], [s * 31.6, k]]) finish(prism(rect(u - .35, u + .35, v - .35, v + .35), T, T + 8.4), C);
      ghost(prism(rect(-50, 50, -52, 48), UG1, 0), groups.under);
      NNG_LOW = N(14, 30);
    }
    { // St. Matthäus: three gabled bays, the tower with its spire, three apses
      const d = [0.267, 0.963], nv = [0.963, -0.267], X = (a, n) => [a * d[0] + n * nv[0], a * d[1] + n * nv[1]];
      const bay = (n0, n1, a0, a1, eave, ridge) => {
        const g = new THREE.ExtrudeGeometry(new THREE.Shape([[n0, 0], [n1, 0], [n1, eave], [(n0 + n1) / 2, ridge], [n0, eave]].map(V2)), { depth: a1 - a0, bevelEnabled: false, curveSegments: 1 });
        finish(toThree(g, (n, z, a) => [...X(a0 + a, n), z]), C);
      };
      for (const [n0, n1] of [[-27, -19.67], [-19.67, -12.33], [-12.33, -5]]) bay(n0, n1, 31, 57, 11, 14);
      bay(-19, -11, 57, 64.5, 27, 27);
      bay(-16.6, -13.4, 59.2, 62.3, 35, 35);
      const ap = X(60.75, -15);
      finish(tris([[-16.6, 59.2], [-13.4, 59.2], [-13.4, 62.3], [-16.6, 62.3]].map((p, i, A) => { const q = A[(i + 1) % 4]; return [[...X(p[1], p[0]), 35], [...X(q[1], q[0]), 35], [...ap, 45]]; })), C);
      for (const n of [-23.3, -16, -8.7]) {
        const g = new THREE.CylinderGeometry(3.2, 3.2, 9, 18, 1, false, Math.PI / 2, Math.PI);
        finish(toThree(g, (x, y, z) => [...X(31 + z, n + x), y + 4.5]), C, M.face, M.edge, 30);
      }
    }
    // Philharmonie: the foyers, and the hall under its tent; the Chamber Music Hall beside it
    finish(prism([[104, 247], [128, 245], [136, 244], [182, 231], [189, 253], [198, 298], [191, 306], [165, 317], [151, 324], [137, 318], [114, 297], [105, 264]], 0, 7), C);
    finish(tent([[128, 259], [169, 248], [189, 253], [192, 266], [190, 283], [166, 290], [148, 302], [141, 293], [133, 277], [127, 268]], 7, 22, [161, 273, 34]), C, M.face, M.edge, 4);
    finish(tent([[55, 192], [66, 178], [106, 166], [133, 176], [134, 190], [142, 209], [128, 219], [134, 237], [128, 245], [104, 247], [88, 244], [80, 239], [71, 210], [62, 201]], 0, 12, [103, 213, 22]), C, M.face, M.edge, 4);
    // Staatsbibliothek: the stack tower and the stepped reading halls (storeys × 3.4 m)
    for (const [lv, poly] of [
      [12, [[229, -70], [247, -74], [264, -39], [266, 18], [255, 22], [249, 18], [243, 4], [235, -19]]],
      [10, [[235, -19], [222, -54], [218, -71], [213, -96], [222, -99], [233, -103], [239, -105], [242, -97], [264, -39], [247, -74], [229, -70]]],
      [6, [[192, 9], [206, 6], [228, -2], [234, 9], [243, 4], [235, -19], [222, -54], [218, -71], [206, -67], [207, -62], [191, -55], [172, -48]]],
      [5, [[206, 6], [228, 44], [248, 32], [242, 22], [248, 18], [243, 4], [234, 9], [228, -2]]],
      [5, [[191, -55], [187, -99], [186, -118], [216, -122], [222, -99], [213, -96], [218, -71], [206, -67], [207, -62]]],
      [2, [[273, 65], [274, 2], [279, -2], [252, -98], [242, -97], [264, -39], [266, 18], [265, 65]]],
      [4, [[265, 19], [265, 69], [253, 69], [238, 38], [248, 32], [255, 22]]],
      [3, [[265, 65], [265, 69], [253, 69], [238, 38], [234, 40], [258, 81], [260, 88], [273, 88], [273, 65]]],
      [2, [[165, -58], [148, -55], [151, -44], [171, -32], [188, 15], [195, 15], [213, 28], [223, 43], [228, 44], [206, 6], [192, 9], [172, -48], [191, -55], [190, -67], [177, -66], [178, -58]]],
      [1, [[135, -100], [138, -68], [144, -61], [148, -55], [165, -58], [164, -66], [177, -68], [174, -98], [187, -99], [186, -118], [153, -115], [155, -97]]],
      [4, [[249, -99], [239, -105], [236, -118], [216, -122], [248, -130], [255, -104]]],
      [2, [[135, -100], [148, -101], [148, -97], [155, -97], [153, -115], [152, -125], [133, -123]]],
      [3, [[123, -53], [146, -61], [151, -44], [152, -30], [128, -30]]],
    ]) finish(prism(poly, 0, lv * 3.4), C);
    // Kulturforum: Kupferstichkabinett, the foyer and its round tower, the Gemäldegalerie, the Kunstgewerbemuseum, the sloping Piazzetta
    finish(prism([[-87, 82], [-67, 71], [-39, 65], [-27, 94], [-32, 123], [-77, 138]], 0, 13), C);
    finish(prism([[-127, 107], [-85, 106], [-82, 125], [-89, 129], [-103, 145], [-94, 177], [-81, 195], [-71, 212], [-83, 219], [-104, 210], [-118, 213], [-126, 182], [-121, 151], [-126, 131]], 0, 13), C);
    { const g = new THREE.CylinderGeometry(8, 8, 21, 32); finish(toThree(g, (x, y, z) => [-125 + x, 115 - z, y + 10.5]), C, M.face, M.edge, 30); }
    finish(prism([[-245, 94], [-149, 68], [-144, 78], [-135, 92], [-130, 109], [-126, 131], [-123, 143], [-197, 158], [-226, 166]], 0, 16), C);
    finish(prism([[-53, 230], [-29, 221], [4, 206], [9, 219], [18, 242], [26, 251], [34, 271], [14, 278], [-24, 285], [-33, 288], [-45, 255]], 0, 15), C);
    const rampZ = (x, y) => Math.max(0, Math.min(6, 6 * ((x + 23) * -0.942 + (y - 123) * 0.335) / 42.8));
    finish(surfaceSolid([[-23, 123], [4, 199], [2, 207], [-9, 211], [-36, 214], [-62, 141], [-28, 131]], rampZ), C);
    { // the plane tree the museum is carved round
      const at = [49, 104];
      finish(prism([[at[0] - .7, at[1] - .7], [at[0] + .7, at[1] - .7], [at[0] + .7, at[1] + .7], [at[0] - .7, at[1] + .7]], 0, 7.5), C);
      const g = new THREE.IcosahedronGeometry(9, 1); g.scale(1, .66, 1);
      finish(toThree(g, (x, y, z) => [at[0] + x, at[1] - z, 13.5 + y]), C, M.face, M.edge, 8);
    }

    /* ---------- the ground, open over the museum's lower floor once the floors are shown, and the streets ---------- */
    const HOLES = [WU(UG), WU(TUNNEL)];
    let LID;
    {
      const g = new THREE.ShapeGeometry(shapeOf([[-520, -470], [660, -470], [660, 560], [-520, 560]], HOLES));
      const m = new THREE.Mesh(toThree(g, (x, y) => [x, y, 0]), M.ground); m.renderOrder = 1; scene.add(m);
      LID = new THREE.Mesh(toThree(new THREE.ShapeGeometry(HOLES.map(h => new THREE.Shape(h.map(V2)))), (x, y) => [x, y, 0]), M.lid); LID.renderOrder = 1; scene.add(LID);
    }
    // street centrelines from OpenStreetMap: highway type, lanes, points
    const STREETS = `p3|58,-189 61,-182
    p3|112,-33 114,-22
    p4|58,-136 54,-146
    u|6,13 7,17 8,22 9,28
    u|-262,79 -254,77 -182,57 -139,45 -127,41
    u|-12,77 21,66
    s|170,112 150,122
    p3|61,-182 71,-152 72,-150
    p3|72,-150 76,-139
    p2|51,-155 46,-166 44,-172 42,-178
    p2|42,-178 39,-189
    l|150,122 143,126 141,127 122,137 110,143
    p3|170,112 172,114 178,118 179,120 216,149
    p2|138,106 135,101 133,96 130,89 129,85 105,16 100,3 97,-7 94,-16
    p3|-16,-325 -10,-317 -9,-315 8,-288 19,-271 29,-254
    s2|95,-196 105,-197 113,-200 126,-205 145,-213 160,-222 175,-231 218,-260 221,-263
    p3|46,-219 52,-203 54,-198
    s3|76,-139 58,-136
    s3|58,-189 64,-189 67,-189 70,-189 74,-189 76,-190 78,-190 84,-192 89,-194 95,-196
    s4|39,-189 49,-189 58,-189
    p2|56,-181 58,-189
    p3|54,-198 56,-195 58,-189
    s3|302,-260 290,-253 268,-238 251,-227 232,-216 216,-206 181,-185 170,-179
    p4|92,-27 90,-35 89,-39 86,-50 63,-121 62,-124 61,-127 58,-136
    p4|229,183 222,179 217,177 214,175 211,173 205,168
    s3|135,-160 119,-154
    s4|119,-154 88,-143 84,-142 82,-141 76,-139
    p5|237,162 241,164 263,167 268,167 273,168
    s3|170,-179 148,-167 135,-160
    p4|173,141 163,134 163,133 158,130 150,122
    s2|-226,-157 -240,-160 -268,-170 -284,-174 -297,-176 -315,-178 -319,-178 -324,-178 -333,-178
    u|92,-27 112,-33
    u2|66,317 53,277 37,229 32,213
    p2|51,-155 52,-162 53,-168 55,-175 56,-181
    p3|150,122 146,118 143,114
    p4|184,151 173,141
    p4|205,168 184,151
    p5|273,168 279,169 298,172
    l|106,145 98,149 79,159 74,161 62,168 23,188
    l|23,188 19,174 14,161 12,155
    u|-32,25 -34,19 -35,15
    u|114,-22 94,-16
    u|-196,71 -251,87 -252,87 -259,89
    u2|32,213 26,195
    l|12,155 64,138 133,117 135,116 143,114
    l|110,143 106,145
    u|11,149 10,147 5,133
    l|26,195 23,188
    u|5,133 -5,100 -12,77 -21,52 -25,38 -30,29 -32,25
    p3|162,104 166,108 170,112
    p3|76,-139 78,-131 79,-129 88,-103 105,-53
    p2|12,-251 5,-265 -1,-275 -8,-287 -14,-297 -21,-307 -22,-309 -27,-317 -32,-325
    u|-32,25 -39,27 -57,33 -96,44
    p4|54,-146 51,-155
    s2|38,-132 22,-131 13,-131 1,-132
    s2|1,-132 -13,-132 -103,-139 -129,-141 -153,-143 -176,-146 -196,-150 -217,-154 -226,-157
    l|12,155 11,149
    p3|216,149 228,159 232,161 237,162
    p3|105,-53 109,-42 112,-33
    p3|114,-22 117,-14 126,12 139,49 148,74 149,78 151,85 154,91 156,95 159,99 162,104
    p2|94,-16 92,-27
    s4|-3,-187 1,-188 5,-188 8,-188 23,-189 28,-189 31,-189 39,-189
    p2|39,-189 37,-196 36,-199 33,-207 27,-221 19,-237 16,-244 15,-246 12,-251
    u|-127,41 -60,23
    s2|58,-136 50,-134 47,-134 38,-132
    u|94,-16 88,-14 84,-13 3,3
    u|-60,23 -42,18 -35,15 3,3
    u|6,13 -32,25
    p2|143,114 139,108 138,106
    p3|29,-254 34,-245 42,-229 46,-219
    u|-179,66 -196,71
    u|-133,54 -179,66
    u|-96,44 -133,54
    r|-189,31 -198,1 -200,-9 -207,-32 -209,-40 -219,-72 -221,-79 -229,-106 -243,-152 -242,-156 -240,-160
    r|-179,66 -182,57 -183,52 -189,31
    s3|-277,-224 -257,-217 -227,-205 -210,-199 -191,-195 -179,-194 -160,-191 -129,-188 -106,-186 -94,-185 -70,-185 -56,-184 -38,-185 -17,-185 -3,-187
    u2|-264,71 -262,77 -262,79 -259,89 -257,95 -244,143 -230,195 -226,210 -219,238 -212,263 -211,267 -212,277
    u2|-333,-178 -331,-171 -328,-159 -308,-85 -304,-70 -289,-18 -278,22 -264,71
    s2|-212,277 -202,280 -198,281 -146,295 -103,307 -67,317 -42,324 65,354 88,362 131,373 146,377 165,382 200,391 229,399 243,402 254,405
    s4|306,417 294,414 290,414 276,411 266,408 254,405
    p4|272,257 275,240 280,210 281,205 282,198 283,192 288,181 298,172
    p4|243,402 245,395 246,387 250,374 254,357 257,335 261,316 264,300 267,285 272,257
    p4|347,200 314,196 304,195 298,194 295,194 283,192 275,191 269,191 266,190 259,189 244,187 237,185 229,183
    r|305,135 311,136 384,119
    r|324,32 320,43 316,65 312,85 307,115 304,128 305,135 304,143 301,154 300,165 298,172
    l|351,-14 354,3 354,13 351,19 345,24 336,27 327,29 324,32
    w|351,19 359,26 396,53 461,102 492,125 521,147 557,174
    w|29,182 19,154 132,119 137,126 105,143 29,182`;
    {
      const WIDTH = { p: 3.4, s: 3.2, u: 3.6, r: 3.6, l: 3.4, w: 3.2 }, DEF = { p: 14, s: 11, u: 8, r: 7, l: 7, w: 6 };
      const t = [], disc = (c, r) => { for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, b = (i + 1) / 12 * Math.PI * 2; t.push([[...c, .04], [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a), .04], [c[0] + r * Math.cos(b), c[1] + r * Math.sin(b), .04]]); } };
      for (const line of STREETS.split('\n')) {
        const [kind, pts] = line.trim().split('|'), ty = kind[0], lanes = +kind.slice(1);
        const wd = lanes ? lanes * WIDTH[ty] + 2 : DEF[ty], h = wd / 2;
        const p = pts.trim().split(' ').map(s => s.split(',').map(Number));
        for (let i = 1; i < p.length; i++) {
          const a = p[i - 1], b = p[i], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * h, ny = dx / l * h;
          const q = [[a[0] + nx, a[1] + ny, .04], [b[0] + nx, b[1] + ny, .04], [b[0] - nx, b[1] - ny, .04], [a[0] - nx, a[1] - ny, .04]];
          t.push([q[0], q[1], q[2]], [q[0], q[2], q[3]]);
        }
        for (const c of p) disc(c, h);
      }
      const m = new THREE.Mesh(tris(t), M.street); m.renderOrder = 0; scene.add(m);
    }

    /* ---------- the two axes, as in Layers of Egypt: a soft glow as wide as the axis runs along the way with a tail that
       fades behind it. The first run lights the way from its start to its end; after that the way stays faintly lit and
       the glow runs along it again and again. Floors and walls hide it where they are in front of it ---------- */
    const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches, SPEED = 26, BAND = 80, BASE = .5;
    function route(pts, color, width) {
      // resample the polyline every metre; each sample gets its distance along the way
      const pl = pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)), samples = [];
      for (let i = 1; i < pl.length; i++) { const a = pl[i - 1], b = pl[i], n = Math.max(1, Math.ceil(a.distanceTo(b))); for (let k = (i > 1 ? 1 : 0); k <= n; k++) samples.push(a.clone().lerp(b, k / n)); }
      const pos = [], sv = [], vv = [], idx = []; let s = 0;
      samples.forEach((p, i) => {
        if (i) s += p.distanceTo(samples[i - 1]);
        const q = samples[Math.min(i + 1, samples.length - 1)], r = samples[Math.max(i - 1, 0)], dx = q.x - r.x, dy = q.y - r.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l * width / 2, ny = dx / l * width / 2;
        pos.push(...P(p.x + nx, p.y + ny, p.z), ...P(p.x - nx, p.y - ny, p.z)); sv.push(s, s); vv.push(1, -1);
        if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('s', new THREE.Float32BufferAttribute(sv, 1)); g.setAttribute('v', new THREE.Float32BufferAttribute(vv, 1)); g.setIndex(idx);
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthTest: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
        uniforms: { color: { value: new THREE.Color(color) }, head: { value: -1 }, reached: { value: 0 }, cyc: { value: 1 }, fade: { value: 100 }, first: { value: 1 }, band: { value: BAND }, base: { value: BASE }, show: { value: 0 } },
        vertexShader: 'attribute float s; attribute float v; varying float vs; varying float vv; void main(){ vs = s; vv = v; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform vec3 color; uniform float head, reached, band, base, show, cyc, fade, first; varying float vs; varying float vv;
          void main(){
            float glow = (vs <= head && vs >= head - band) ? pow((vs - (head - band)) / band, 1.6) : 0.0;
            // what the glow has passed keeps a colour that fades the longer ago it passed, until the glow comes again
            float d = head - vs;
            if (d < 0.0) d = first > .5 ? -1.0 : d + cyc;
            float trail = (d >= 0.0 && vs <= reached) ? base * exp(-d / fade) : 0.0;
            float across = pow(1.0 - abs(vv), .55);           // soft edges, like the blurred band on the Egypt plan
            float a = max(glow * .85, trail) * across * show;
            if (a < .004) discard;
            gl_FragColor = vec4(color, a);
          }`,
      });
      const m = new THREE.Mesh(g, mat); m.renderOrder = 10; scene.add(m);
      return { mat, len: s, t0: 0, m };
    }
    function drawRoute(r, show, t) {
      const u = r.mat.uniforms; u.show.value = show; r.m.visible = show > .01;
      if (!r.m.visible) return;
      if (REDUCE) { u.head.value = r.len; u.reached.value = r.len; u.first.value = 1; u.fade.value = 1e6; u.base.value = .55; return; }
      const cycle = (r.len + BAND) / SPEED + .6, el = t - r.t0, h = (el % cycle) * SPEED;
      u.head.value = h; u.cyc.value = cycle * SPEED; u.fade.value = r.len * .45; u.first.value = el < cycle ? 1 : 0;
      u.reached.value = el < cycle ? Math.min(h, r.len) : r.len;   // first run: nothing ahead of the glow; after it, the faded wake of the run before
    }
    const F = .15;
    // both ways run straight along their axis, from the street outside on one side to the square on the other
    const EW = route([[...W(150, 51.9), F], [...W(71.3, 51.9), EG + F], [...W(0, 51.9), EG + F], [...W(-30, 51.9), F]], '#f97316', 10);
    const NS = route([[...W(35.6, 140), F], [...W(35.6, 113), EG + F], [...W(35.6, 89.2), EG + F], [...W(35.6, 70.8), UG1 + F], [...W(35.6, -40), UG1 + F]], '#2563eb', 14);

    /* ---------- labels: names appear once you come close to the museum ---------- */
    const labels = [], CENTRE = new THREE.Vector3(...P(...W(35.6, 56), 0));
    function label(text, x, y, z, minStep, cls = '', maxStep = 9) {
      const el = document.createElement('div'); el.className = 'lbl ' + cls; el.textContent = text; box.append(el);
      labels.push({ el, v: new THREE.Vector3(...P(x, y, z)), minStep, maxStep, near: cls.includes('zone') ? 210 : 300 });
    }
    label(N('Philharmonie'), 161, 273, 38, 0);
    label(N('Chamber Music Hall'), 103, 213, 25, 0);
    label(N('Staatsbibliothek'), 252, -40, 45, 0);
    label(N('Neue Nationalgalerie'), 5.75, -58.25, 17, 0);
    label(N('St. Matthäus'), -11, 50, 48, 0);
    label(N('Kulturforum'), -105, 160, 24, 0);
    label(N('Plane tree'), 49, 104, 23, 0, 'tree');
    label(N('Museum of the 20th Century'), ...W(35.6, 56), 24, 1, '', 1);
    label(N('Lower floor, Neue Nationalgalerie'), ...NNG_LOW, -3.5, 4, 'zone');
    const tmp = new THREE.Vector3();
    const namesOn = true;
    function placeLabels() {
      const r = box.getBoundingClientRect(), dist = cam.position.distanceTo(CENTRE);
      let any = false;
      for (const l of labels) {
        tmp.copy(l.v).project(cam);
        const on = namesOn && step >= l.minStep && step <= l.maxStep && dist < l.near && tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05;
        l.el.style.opacity = on ? 1 : 0; any ||= on;
        if (on) l.el.style.transform = `translate(${(tmp.x + 1) / 2 * r.width}px, ${(1 - tmp.y) / 2 * r.height}px) translate(-50%, -100%)`;
      }
      hint.hidden = any || !namesOn;
    }

    /* ---------- steps: each value eases toward its target, and the model draws only while something moves ---------- */
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cur = { rise: 0, open: 0, ew: 0, ns: 0 }, aim = { ...cur };
    let step = 0, raf = 0;
    function apply() {
      groups.shell.scale.y = Math.max(.001, cur.rise); groups.shell.visible = cur.rise > .002;
      M.shell.opacity = 1 - .93 * cur.open; M.shellEdge.opacity = 1 - .7 * cur.open; M.shell.depthWrite = cur.open < .5;
      M.int.opacity = cur.open; M.intEdge.opacity = cur.open; M.int.depthWrite = cur.open > .5; M.slab.opacity = .6 * cur.open;
      LID.visible = cur.open < .5;
      groups.inside.visible = cur.open > .01;
      const now = performance.now() / 1000;
      if (cur.ew > 0 && !EW.t0) EW.t0 = now; if (cur.ew === 0) EW.t0 = 0;
      if (cur.ns > 0 && !NS.t0) NS.t0 = now; if (cur.ns === 0) NS.t0 = 0;
      drawRoute(EW, cur.ew, now); drawRoute(NS, cur.ns, now);
    }
    function tick() {
      let moving = false;
      for (const k in cur) {
        const speed = k === 'ew' || k === 'ns' ? .05 : .035;
        if (reduce) cur[k] = aim[k];
        else if (Math.abs(aim[k] - cur[k]) > .001) { cur[k] += Math.sign(aim[k] - cur[k]) * Math.min(Math.abs(aim[k] - cur[k]), speed); moving = true; }
        else cur[k] = aim[k];
      }
      apply(); ren.render(scene, cam); placeLabels();
      raf = moving || cur.ew > 0 || cur.ns > 0 ? requestAnimationFrame(tick) : 0;   // the glows keep running
    }
    function kick() { if (!raf) raf = requestAnimationFrame(tick); }
    function set(s) {
      step = s; range.value = s; out.value = `${s + 1} / ${STEPS.length || 5}`; ($('.ng-name', out.parentElement) || {}).textContent = STEPS[s] || ''; out.textContent = out.value; cap.textContent = CAPS[s] || '';
      aim.rise = s >= 1 ? 1 : 0; aim.open = s >= 2 ? 1 : 0; aim.ew = s >= 3 ? 1 : 0; aim.ns = s >= 4 ? 1 : 0; kick();
    }
    range.addEventListener('input', () => { stop(); set(+range.value); });
    let timer = 0;
    function stop() { clearTimeout(timer); timer = 0; playBtn.setAttribute('aria-pressed', 'false'); }
    function play() {
      playBtn.setAttribute('aria-pressed', 'true');
      let s = step >= 4 ? 0 : step + 1;
      const next = () => { set(s); if (s < 4) { s++; timer = setTimeout(next, s === 4 ? 15000 : 3400); } else timer = setTimeout(stop, 18000); };
      next();
    }
    playBtn.addEventListener('click', (e) => { e.stopPropagation(); timer ? stop() : play(); });
    function size() {
      const r = box.getBoundingClientRect(); if (!r.width) return;
      ren.setSize(r.width, r.height); cam.aspect = r.width / r.height; cam.fov = 40 * Math.pow(Math.max(1, 1.4 / cam.aspect), .7); cam.updateProjectionMatrix(); kick();
    }
    ctl.addEventListener('change', kick);
    new ResizeObserver(size).observe(box);
    theme(); set(0); size();
  }
});

// Extended Threads: the Processing simulation RoverInActionIsosurfaces (2016), rebuilt with three.js: the 200 × 200 ground of
// loose points, the rolling robot (assets/data/et-rover.bin, 300 kB), its sintering laser and spray, and the isosurface
// that turns the fused particles into a solid. A demo runs until Drive or Aim laser is pressed; on a computer W A S D drive,
// a click aims, the space bar builds, the right button turns the view. It loads when it first comes into view and runs
// only while it is on screen
$$('.et-build').forEach(fig => {
  let started = false;
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting) && !started) { started = true; io.disconnect(); start(); } }, { rootMargin: '200px' });
  io.observe($('.et-3d', fig));
  async function start() {
    const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/+esm');
    const { OrbitControls } = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js/+esm');
    const { MarchingCubes } = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/objects/MarchingCubes.js/+esm');

    const box = $('.et-3d', fig), badge = $('.et-badge', fig);
    const WORDS = Object.fromEntries($$('.et-say li', fig).map(li => [li.dataset.k, li.textContent.trim()]));
    const ren = new THREE.WebGLRenderer({ antialias: true });
    ren.setPixelRatio(Math.min(2, devicePixelRatio)); box.prepend(ren.domElement);
    ren.domElement.style.touchAction = 'none'; wheelOnly(box);
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, 1.6, 5, 20000);
    // the sketch's world: ground x and y from 0 to 1000 (200 points, 5 apart), z up. In three: x, height, plan y
    const P = (x, y, z) => [x - 500, z, y - 500];
    cam.position.set(...P(-250, 1350, 900));
    const ctl = new OrbitControls(cam, ren.domElement);
    ctl.target.set(...P(520, 470, 40)); ctl.maxPolarAngle = Math.PI * .48; ctl.minDistance = 150; ctl.maxDistance = 3500; ctl.update();
    scene.add(new THREE.HemisphereLight('#ffffff', '#30343a', 1.6));
    const sun = new THREE.DirectionalLight('#ffffff', 1.6); sun.position.set(...P(-400, -300, 900)); scene.add(sun);

    /* ---------- the ground: 200 × 200 loose points ---------- */
    const R = 200, GAP = 5, N = R * R;
    const home = new Float32Array(N * 2), gp = new Float32Array(N * 3);
    function layGround() { for (let i = 0; i < R; i++) for (let j = 0; j < R; j++) { const k = i * R + j; home[k * 2] = i * GAP; home[k * 2 + 1] = j * GAP; gp.set(P(i * GAP, j * GAP, 0), k * 3); } }
    layGround();
    const gGeo = new THREE.BufferGeometry(); gGeo.setAttribute('position', new THREE.BufferAttribute(gp, 3));
    const groundMat = new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: .62 });
    scene.add(new THREE.Points(gGeo, groundMat));

    /* ---------- particles: the builders at the laser (red) and the spray from the rover, which lands on the laser and is gone ---------- */
    const MAXB = 24000, MAXS = 900, FLY = 48, G = .22, AWAY = -1e5;
    const bp = new Float32Array(MAXB * 3), sp = new Float32Array(MAXS * 3).fill(AWAY), sv = new Float32Array(MAXS * 3), sAge = new Int32Array(MAXS).fill(FLY);
    let nB = 0, sHead = 0;
    const bGeo = new THREE.BufferGeometry(); bGeo.setAttribute('position', new THREE.BufferAttribute(bp, 3)); bGeo.setDrawRange(0, 0);
    const sGeo = new THREE.BufferGeometry(); sGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const grainMat = new THREE.PointsMaterial({ color: '#64748b', size: 2.4, sizeAttenuation: false });   // loose material in grey: only the laser is red
scene.add(new THREE.Points(bGeo, grainMat));
    const sPts = new THREE.Points(sGeo, grainMat); sPts.frustumCulled = false; scene.add(sPts);

    /* ---------- the isosurface: every builder adds a round brush to a volume; marching cubes draws where it passes 0.5 ---------- */
    const RES = 88, HV = 250;                     // cells per side; the volume is the ground's 1000 × 1000 and 250 high
    const solidMat = new THREE.MeshLambertMaterial({ color: '#f4f4f2' });
    const iso = new MarchingCubes(RES, solidMat, false, false, 90000);
    iso.isolation = .5; iso.scale.set(500, HV / 2, 500); iso.position.set(0, HV / 2, 0); scene.add(iso);
    iso.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.8); iso.frustumCulled = false;   // the volume's own cube, so picking never works from a stale bound
    const F = iso.field, S2 = RES * RES;
    function splat(x, y, z) {
      // the brush is as round in metres as in cells allow: the volume's cells are 11 wide but only 3 high
      const cx = x / 1000 * RES, cy = z / HV * RES, cz = y / 1000 * RES, r = 2.2, rz = 4.2;
      for (let k = Math.max(1, Math.floor(cz - r)); k <= Math.min(RES - 2, Math.ceil(cz + r)); k++)
        for (let j = Math.max(1, Math.floor(cy - rz)); j <= Math.min(RES - 2, Math.ceil(cy + rz)); j++)
          for (let i = Math.max(1, Math.floor(cx - r)); i <= Math.min(RES - 2, Math.ceil(cx + r)); i++) {
            const d2 = ((i - cx) ** 2 + (k - cz) ** 2) / (r * r) + (j - cy) ** 2 / (rz * rz);
            if (d2 < 1) F[k * S2 + j * RES + i] += .34 * (1 - d2) ** 2;
          }
    }
    let isoDirty = false, isoClock = 0;

    /* ---------- the rover: the rolling robot from Unit1.obj, ten times its model size ---------- */
    const roverMat = new THREE.MeshStandardMaterial({ color: '#9aa0a8', metalness: .35, roughness: .55 });
    const rover = new THREE.Group(); scene.add(rover);
    const roll = new THREE.Group(); rover.add(roll);
    {
      const buf = await fetch('/assets/data/et-rover.bin').then(r => r.arrayBuffer()), h = new Uint32Array(buf, 0, 2);
      const q = new Int16Array(buf, 8, h[0] * 3), idx = new Uint16Array(buf, 8 + h[0] * 6, h[1]);
      const pos = new Float32Array(q.length); for (let i = 0; i < q.length; i++) pos[i] = q[i] / 3000 * 10;
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
      roll.add(new THREE.Mesh(g, roverMat));
    }
    const loc = new THREE.Vector3(200, 220, 0), vel = new THREE.Vector3(), dest = new THREE.Vector3(200, 220, 0);
    // Like a gecko, the rover holds its ground: it never passes through what has been built. What is under its middle it
    // climbs onto; what only touches its edge pushes it aside, so it rolls off rather than hanging on by one point.
    // lift is how high its wheel stands on the built form
    const BALL = 95;
    let lift = 0;
    const push = new THREE.Vector3();
    // the top of the built form in one column of the volume (0 where nothing is built)
    function columnTop(x, y) {
      const i = Math.round(x / 1000 * RES), k = Math.round(y / 1000 * RES);
      if (i < 1 || k < 1 || i > RES - 2 || k > RES - 2) return 0;
      for (let j = RES - 2; j >= 1; j--) if (F[k * S2 + j * RES + i] >= .5) return (j + .5) / RES * HV;
      return 0;
    }
    // where the ball's centre must be to rest on the form: the form's top under its middle (and close round it) plus the
    // height of the ball's curve there; the form under its outer edge does not lift it but pushes it away, into push
    function restLift(x, y) {
      push.set(0, 0, 0);
      if (!nB) return 0;
      const need = (h, r) => h - (BALL - Math.sqrt(BALL * BALL - r * r));   // how high the centre must be for that point
      let top = columnTop(x, y);
      for (let a = 0; a < 8; a++) {
        const c = Math.cos(a * Math.PI / 4), sn = Math.sin(a * Math.PI / 4);
        const hi = columnTop(x + 30 * c, y + 30 * sn); if (hi > 0) top = Math.max(top, need(hi, 30));
        const ho = columnTop(x + 72 * c, y + 72 * sn), over = need(ho, 72) - lift;
        if (ho > 0 && over > 0) { push.x -= c * over; push.y -= sn * over; }
      }
      push.multiplyScalar(.02).clampLength(0, 1.6);
      return Math.max(0, top);
    }
    const laser = new THREE.Vector3(560, 520, 0);
    // the six pads of the rolling robot (on its model's axes, 86 out from its centre): the laser leaves from the one that
    // faces the point it builds at, wherever the rolling has turned it
    const PADS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map((d) => new THREE.Vector3(...d)), PAD = 86;
    const toL = new THREE.Vector3(), padW = new THREE.Vector3(), padBest = new THREE.Vector3();
    function padToward(target) {
      toL.copy(target).sub(rover.position).normalize();
      let best = -2;
      for (const d of PADS) { padW.copy(d).applyQuaternion(roll.quaternion); const k = padW.dot(toL); if (k > best) { best = k; padBest.copy(padW); } }
      return padBest.multiplyScalar(PAD).add(rover.position);
    }
    const beamGeo = new THREE.BufferGeometry(); beamGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const beam = new THREE.Line(beamGeo, new THREE.LineBasicMaterial({ color: '#ff3b30' })); scene.add(beam);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 8), new THREE.MeshBasicMaterial({ color: '#ff3b30' })); scene.add(dot);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .5, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(14, 17, 40).rotateX(-Math.PI / 2), ringMat); scene.add(ring);
    // colours from the page's tokens, so the field follows light and dark
    function theme() {
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      const v = (n) => (dark ? { '--stage': '#000000', '--ground-pt': '#ffffff', '--solid': '#f4f4f2', '--rover': '#9aa0a8', '--ring': '#ffffff', '--grain': '#cbd5e1' }
                             : { '--stage': '#ffffff', '--ground-pt': '#334155', '--solid': '#e6e8ec', '--rover': '#8a929c', '--ring': '#0f172a', '--grain': '#64748b' })[n];
      ren.setClearColor(v('--stage'), 1); groundMat.color.set(v('--ground-pt')); groundMat.opacity = dark ? .62 : .5;
      solidMat.color.set(v('--solid')); roverMat.color.set(v('--rover')); ringMat.color.set(v('--ring')); grainMat.color.set(v('--grain'));
    }
    theme();
    new MutationObserver(theme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    /* ---------- where the laser may point: the ground, or the top of what is already built, never the air ---------- */
    const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), hitP = new THREE.Vector3();
    function topAt(x, y) {                       // the highest surface under a point: the built form if there is one, else the ground
      if (!nB) return 0;
      ray.set(new THREE.Vector3(...P(x, y, 600)), down);
      const h = ray.intersectObject(iso, false)[0];
      return h ? Math.max(0, h.point.y) : 0;
    }

    /* ---------- the sketch's rules, once a frame ---------- */
    let build = false, frame = 0, lastAim = 0;
    const RANGE = 100, POWER = .02;
    const rnd = (a, b) => a + Math.random() * (b - a);
    function step() {
      frame++;
      // the rover heads for its destination: it speeds up with the distance, at most 3 a frame, and rolls while it moves
      // on a computer the keys drive it straight, relative to the view
      // some momentum: the speed it wants is reached, and lost, over a second or so, so it rolls on a little before it rests
      const kd = keyDir();
      const dif = dest.clone().sub(loc), dist = dif.length(), want = new THREE.Vector3();
      if (kd) { want.set(kd[0] * 3, kd[1] * 3, 0); dest.copy(loc); }
      else if (dist > 2) want.copy(dif).normalize().multiplyScalar(Math.min(3, dist / 12));
      vel.lerp(want, .08); if (vel.lengthSq() < .0004) vel.set(0, 0, 0);
      loc.x = Math.max(0, Math.min(1000, loc.x + vel.x)); loc.y = Math.max(0, Math.min(1000, loc.y + vel.y));
      // it climbs onto the built form at its own pace and comes down the same way; it is never inside it
      const rest = restLift(loc.x, loc.y);
      vel.add(push);
      lift = rest > lift ? Math.min(rest, lift + 4) : Math.max(rest, lift - 4);
      // the wheel turns exactly as far as it rolls
      if (vel.lengthSq()) roll.rotateOnWorldAxis(new THREE.Vector3(vel.y, 0, -vel.x).normalize(), vel.length() / BALL);
      rover.position.set(...P(loc.x, loc.y, BALL + lift));
      // left alone for five seconds, the rover stops building
      if (build && !demo && performance.now() - lastAim > 5000) setBuild(false);
      if (build) {
        // the laser rests on whatever is under it, so the form grows upwards from where it was started
        if (frame % 8 === 0) laser.z = topAt(laser.x, laser.y);
        // the ground within reach of the laser is pushed away from it: the loose material gathers round the fused point
        for (let k = 0; k < N; k++) {
          const x = gp[k * 3] + 500, y = gp[k * 3 + 2] + 500, z = gp[k * 3 + 1];
          const dx = laser.x - x, dy = laser.y - y, dz = laser.z - z;
          if (dx * dx + dy * dy + dz * dz < RANGE * RANGE) { gp[k * 3] -= dx * POWER; gp[k * 3 + 2] -= dy * POWER; }
        }
        gGeo.attributes.position.needsUpdate = true;
        // a builder particle at the laser, fused into the volume
        for (let n = 0; n < 2 && nB < MAXB; n++) {
          const x = laser.x + rnd(-20, 20), y = laser.y + rnd(-20, 20), z = Math.max(0, laser.z + rnd(-6, 3));   // a little into what is below, so new material fuses with it
          bp.set(P(x, y, z), nB * 3); nB++; splat(x, y, z); isoDirty = true;
        }
        bGeo.setDrawRange(Math.max(0, nB - 16), Math.min(nB, 16));   // only the newest grains show: once fused into the surface they are gone bGeo.attributes.position.needsUpdate = true;
        // spray: from the top of the rover in an arc that comes down on the laser point
        for (let n = 0; n < 3; n++) {
          const k = sHead; sHead = (sHead + 1) % MAXS;
          const o = [loc.x + rnd(-25, 25), loc.y + rnd(-25, 25), 160 + lift + rnd(0, 15)], t = [laser.x + rnd(-14, 14), laser.y + rnd(-14, 14), laser.z], T = FLY + rnd(-8, 8);
          sp.set(P(...o), k * 3); sv.set([(t[0] - o[0]) / T, (t[1] - o[1]) / T, (t[2] - o[2]) / T + .5 * G * T], k * 3); sAge[k] = Math.round(FLY - T);
        }
      }
      if (!build) bGeo.setDrawRange(0, 0);
  for (let k = 0; k < MAXS; k++) {
        if (sAge[k] >= FLY) { sp[k * 3 + 1] = AWAY; continue; }   // landed: absorbed into the form, gone
        sAge[k]++; sv[k * 3 + 2] -= G;
        sp[k * 3] += sv[k * 3]; sp[k * 3 + 2] += sv[k * 3 + 1]; sp[k * 3 + 1] += sv[k * 3 + 2];
      }
      sGeo.attributes.position.needsUpdate = true;
      // the laser beam from the rover to its point
      const b = beamGeo.attributes.position.array, at = padToward(new THREE.Vector3(...P(laser.x, laser.y, laser.z))); b.set([at.x, at.y, at.z], 0); b.set(P(laser.x, laser.y, laser.z), 3); beamGeo.attributes.position.needsUpdate = true;
      beam.visible = build; dot.position.set(...P(laser.x, laser.y, laser.z)); dot.visible = build || mode === 'aim';
      ring.position.set(...P(dest.x, dest.y, .5)); ring.visible = dist > 6;
      // the surface is recomputed every few frames while it grows
      if (isoDirty && ++isoClock % 6 === 0) { iso.update(); isoDirty = false; }
      badge.textContent = (WORDS.fused || '{n} particles fused').replace('{n}', nB.toLocaleString(document.documentElement.lang || 'en'));
    }

    /* ---------- the demo: drive in, build a curved wall that rises, move on and build a second one ---------- */
    const DEMO = [
      { f: 0, dest: [400, 360], laser: [560, 520, 0], build: false },
      { f: 140, build: true, arc: { c: [560, 600], r: 110, a0: -2.4, a1: -.7 } },
      { f: 1000, build: false, dest: [700, 360] },
      { f: 1180, build: true, arc: { c: [760, 560], r: 70, a0: -3.0, a1: 0 } },
      { f: 1900, build: false, dest: [420, 260] },
    ];
    let demo = true, dFrame = 0, arc = null, arcT = 0;
    function demoStep() {
      dFrame++;
      for (const k of DEMO) if (k.f === dFrame) {
        if (k.dest) dest.set(k.dest[0], k.dest[1], 0);
        if (k.laser) laser.set(...k.laser);
        if ('build' in k) setBuild(k.build);
        arc = k.arc || null; arcT = 0;
      }
      if (arc && build) {
        arcT += .012;
        const a = arc.a0 + (arc.a1 - arc.a0) * (.5 - .5 * Math.cos(arcT));       // the laser sweeps back and forth along the arc
        laser.x = arc.c[0] + arc.r * Math.cos(a); laser.y = arc.c[1] + arc.r * Math.sin(a);
      }
      if (dFrame > 2200) { clearAll(); dFrame = 0; }   // the demo starts over until someone takes over
    }

    /* ---------- controls: the demo runs until Drive or Aim laser is pressed; then the field clears and the user is in charge ---------- */
    const demoBtn = document.getElementById('etDemo'), buildBtn = document.getElementById('etBuild'), status = document.getElementById('etStatus');
    const modeDrive = document.getElementById('etDrive'), modeAim = document.getElementById('etAim');
    let mode = 'demo';
    const SAY = { demo: WORDS.demo, drive: WORDS.drive, aim: WORDS.aim };
    function say() { status.textContent = SAY[mode] + (build && mode === 'aim' ? ' ' + WORDS.building : ''); }
    function setBuild(on) { build = on; buildBtn.setAttribute('aria-pressed', on); if (on) lastAim = performance.now(); say(); }
    function setMode(m) {
      if (demo && m !== 'demo') { demo = false; clearAll(); dest.copy(loc); }
      mode = m; modeDrive.setAttribute('aria-pressed', m === 'drive'); modeAim.setAttribute('aria-pressed', m === 'aim');
      if (m === 'drive') setBuild(false);
      say();
    }
    function clearAll() {
      layGround(); gGeo.attributes.position.needsUpdate = true; nB = 0; bGeo.setDrawRange(0, 0); sAge.fill(FLY);
      F.fill(0); iso.update(); setBuild(false); laser.z = 0; arc = null; lift = 0;
    }
    demoBtn.addEventListener('click', () => { clearAll(); demo = true; dFrame = 0; setMode('demo'); });
    modeDrive.addEventListener('click', () => setMode('drive'));
    modeAim.addEventListener('click', () => setMode('aim'));
    buildBtn.addEventListener('click', () => { if (demo) setMode('aim'); setBuild(!build); });
    document.getElementById('etClear').addEventListener('click', () => { if (demo) setMode('drive'); clearAll(); });
    // a click (not a drag): in Drive the rover's destination; in Aim the point on the ground or the built form, and building starts
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    let press = null;
    ren.domElement.addEventListener('pointerdown', (e) => { press = e.button === 0 ? [e.clientX, e.clientY] : null; box.focus({ preventScroll: true }); });
    ren.domElement.addEventListener('pointerup', (e) => {
      if (!press || Math.hypot(e.clientX - press[0], e.clientY - press[1]) > 5) return;
      if (DESK && mode !== 'aim') setMode('aim');   // on a computer a click always aims
      if (mode === 'demo') return;
      const r = ren.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), cam);
      const onForm = nB ? ray.intersectObject(iso, false)[0] : null;
      let x, y, z = 0;
      if (onForm) { x = onForm.point.x + 500; y = onForm.point.z + 500; z = Math.max(0, onForm.point.y); }
      else if (ray.ray.intersectPlane(plane, hitP)) { x = hitP.x + 500; y = hitP.z + 500; }
      else return;
      x = Math.max(0, Math.min(1000, x)); y = Math.max(0, Math.min(1000, y));
      if (mode === 'drive') dest.set(x, y, 0);
      else { laser.set(x, y, z); setBuild(true); }
    });

    /* ---------- on a computer: W A S D or the arrows drive, a left click aims, the space bar builds, the right button turns the view ---------- */
    const DESK = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const held = new Set(), KEYS = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
    let hover = false;
    box.addEventListener('pointerenter', () => { hover = true; }); box.addEventListener('pointerleave', () => { hover = false; });
    const live = () => hover || document.activeElement === box;
    function keyDir() {
      if (!held.size) return null;
      const f = new THREE.Vector3(); cam.getWorldDirection(f); const l = Math.hypot(f.x, f.z) || 1, fx = f.x / l, fy = f.z / l;   // the view's forward, in plan
      let x = 0, y = 0;
      if (held.has('f')) { x += fx; y += fy; } if (held.has('b')) { x -= fx; y -= fy; }
      if (held.has('r')) { x -= fy; y += fx; } if (held.has('l')) { x += fy; y -= fx; }
      const m = Math.hypot(x, y); return m ? [x / m, y / m] : null;
    }
    addEventListener('keydown', (e) => {
      if (!live() || e.metaKey || e.ctrlKey || e.altKey) return;
      if (KEYS[e.code]) { e.preventDefault(); held.add(KEYS[e.code]); if (mode !== 'drive') setMode('drive'); }
      else if (e.code === 'Space') { e.preventDefault(); if (e.repeat) return; if (demo) setMode('aim'); setBuild(!build); }
    });
    addEventListener('keyup', (e) => { if (KEYS[e.code]) held.delete(KEYS[e.code]); });
    addEventListener('blur', () => held.clear());
    if (DESK) {
      ctl.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
      ren.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
      SAY.drive = WORDS['desk-drive']; SAY.aim = WORDS['desk-aim'];
    }

    /* ---------- loop ---------- */
    function size() { const r = box.getBoundingClientRect(); if (!r.width) return; ren.setSize(r.width, r.height); cam.aspect = r.width / r.height; cam.updateProjectionMatrix(); }
    new ResizeObserver(size).observe(box); size();
    say();
    // it runs only while it is on screen
    let running = false;
    function loop() {
      if (!running) return;
      if (demo) demoStep();
      step();
      ren.render(scene, cam);
      requestAnimationFrame(loop);
    }
    new IntersectionObserver(es => { const on = es.some(e => e.isIntersecting); if (on && !running) { running = true; requestAnimationFrame(loop); } else if (!on) { running = false; held.clear(); } }).observe(box);
  }
});

// Layers of Egypt: the plan opens large, the section marks open the section; each dot opens the render seen from there.
// While the story runs, a dot opens only the renders of the room the story is in
$$('.vb-plan').forEach(box => {
  const dots = $$('.vb-dot', box), open = $('.vb-open', box);
  const item = d => ({ f: d.dataset.f, c: d.getAttribute('aria-label') });
  dots.forEach(d => d.addEventListener('click', () => {
    const set = box.dataset.step ? dots.filter(e => e.dataset.zone === box.dataset.step) : dots;
    openLb(set.map(item), set.indexOf(d), d);
  }));
  open.addEventListener('click', () => openLb([{ src: '/assets/img/projects/vb-plan-full.webp', c: open.getAttribute('aria-label'), paper: true }], 0, open));
  $$('.vb-cut', box).forEach(c => c.addEventListener('click', () => openLb([{ src: '/assets/img/projects/vb-section-full.webp', c: c.getAttribute('aria-label'), paper: true }], 0, c)));
});

// The visitors' way through the pavilion, in the plan's percent (x is stretched by 2.14, the plan's proportion), along
// the middle of every corridor and passage (measured from the plan's pixels). It shows as a soft glow of colour that
// fades towards its tail. The past: in from the entrance, round the corridor to the labyrinth's door. The present: two
// groups at a time take different ways through the labyrinth; whoever reaches a meeting point first waits for the
// other, and they go on together, three times, then into the white room. Elysium: round the table and out.
const VB_FLOW = (() => {
  const P = pts => pts.map(([x, y]) => [x * 2.14, y]);
  const IN = [[93.2, 38], [89.6, 38]], X3 = [86.95, 33], X2 = [79.4, 39], X1 = [74.1, 30.5];
  return {
    1: { loop: P([[50, 100], [50, 68.6], [6.8, 68.6], [6.8, 15.2], [93.2, 15.2], [93.2, 38], [91, 38]]) },
    2: {
      legs: [
        [[...IN, [89.6, 22.95], [76.85, 22.95], [76.85, 28], [86.95, 28], X3],
         [...IN, [89.6, 61], [86.95, 61], X3]],
        [[X3, [86.95, 33.4], [79.4, 33.4], X2],
         [X3, [86.95, 33.4], [84.45, 33.4], [84.45, 61], [81.95, 61], [81.95, 39], X2]],
        [[X2, [79.4, 60.8], [71.9, 60.8], [71.9, 30.5], X1],
         [X2, [79.4, 60.8], [71.9, 60.8], [71.9, 31], [74.35, 31], [74.35, 56], [76.85, 56], [76.85, 33], [76.85, 56], [74.35, 56], [74.35, 31], X1]],
        [[X1, [74.1, 23.8], [70.3, 23.8], [64, 23.8]], [X1, [74.1, 23.8], [70.3, 23.8], [64, 23.8]]],
      ].map(leg => leg.map(P)),
    },
    3: { loop: P([[70.3, 24], [12.55, 24], [12.55, 60], [67.3, 60], [67.3, 68.6], [50, 68.6], [50, 100]]) },
  };
})();
function vbFlow(svg) {
  const NS = 'http://www.w3.org/2000/svg', g = $('.vb-bands', svg), K = 7;   // the glow in K pieces, each fainter than the one before
  const LOOP = { v: 30, band: 46 }, LAB = { v: 14, band: 30 };   // speeds in units a second; glow lengths
  const line = pts => {
    const e = document.createElementNS(NS, 'g'), d = 'M' + pts.map(p => p.map(v => v.toFixed(2)).join(' ')).join('L');
    for (let k = 0; k < K; k++) { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.style.opacity = (Math.pow(1 - k / K, 1.6)).toFixed(3); e.append(p); }
    g.append(e); return { e, len: e.firstChild.getTotalLength() };
  };
  // the glow's head at s with a tail of length tl behind it
  const draw = (b, s, tl) => {
    const seg = tl / K;
    [...b.e.children].forEach((p, k) => { p.style.strokeDasharray = `${seg + .6} ${b.len + 400}`; p.style.strokeDashoffset = (-(s - (k + 1) * seg)).toFixed(2); });
  };
  const len = pts => { let l = 0; for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return l; };
  let raf = 0, t0 = 0, step = 0, parts = [], lab = null;
  function build(s) {
    g.innerHTML = ''; step = s; parts = []; lab = null; const F = VB_FLOW[s]; if (!F) return;
    if (F.loop) { parts = [line(F.loop)]; return; }
    // the labyrinth: each group walks one unbroken line through all the legs, so nothing jumps when they set off again
    const groups = [0, 1].map(gi => F.legs.flatMap((leg, k) => (k ? leg[gi].slice(1) : leg[gi])));
    const legLen = F.legs.map(leg => leg.map(len)), dur = legLen.map(l => Math.max(...l) / LAB.v);   // they go on the moment the later one arrives
    dur[dur.length - 1] += LAB.band / LAB.v;   // the last leg runs on into the white room and out of sight
    lab = { legLen, dur, total: dur.reduce((x, y) => x + y, 0) + .6 };
    parts = groups.map(line);
  }
  function frame(now) {
    if (!parts.length) return;   // a step without a way through the plan
    const t = (now - t0) / 1000;
    if (!lab) {
      // the glow runs to the end and slips out of sight, then comes again
      const b = parts[0], s = (t % ((b.len + LOOP.band) / LOOP.v + .6)) * LOOP.v;
      draw(b, s, LOOP.band);
    } else {
      // leg after leg: both groups leave a meeting point together; the first to arrive draws its tail in and waits, and
      // the moment the other's head arrives they set off again, each tail simply following on
      const c = t % lab.total;
      parts.forEach((b, gi) => {
        let off = 0, c2 = c, tl = 0;
        for (let k = 0; k < lab.dur.length; k++) {
          const L = lab.legLen[k][gi], last = k === lab.dur.length - 1, d = Math.min(c2, lab.dur[k]) * LAB.v;
          const moving = last || d <= L, tlNow = moving ? Math.min(LAB.band, tl + d) : Math.min(LAB.band, tl + L) * Math.max(0, 1 - (d - L) / LAB.v / .85);
          if (c2 < lab.dur[k] || last) { draw(b, off + (moving ? d : L), tlNow); break; }
          tl = tlNow; c2 -= lab.dur[k]; off += L;
        }
      });
    }
    raf = requestAnimationFrame(frame);
  }
  return { play(s) { cancelAnimationFrame(raf); raf = 0; build(s); if (VB_FLOW[s]) { t0 = performance.now(); raf = requestAnimationFrame(frame); } } };
}

// The story: each step lights its room on the plan, which keeps its size, and shows the room's picture under it, a
// fifth of its width, with its words beside the picture (one under the other on a phone), typed like the limericks, and
// the buttons under the words. The last step builds the city under the plan with a slider, the card gliding slowly
// down to it, and its words under it say the stage the slider has reached; once the city is built, a button shows the
// render there instead, and the slider again. On a computer the plan is as wide as leaves the story under it in view, before the story and during it
$$('.vb-story').forEach(st => {
  const box = st.closest('.vb-box'), plan = $('.vb-plan', box), flow = vbFlow($('.vb-flow', plan));
  const steps = $('.vb-steps', st), go = $('.vb-go', st), secs = $$('.vb-texts section', st);
  const media = $('.vb-media', box), pic = $('.vb-pic', media), img = $('img', pic), pPrev = $('.vb-pa.prev', media), pNext = $('.vb-pa.next', media);
  const big = $('.vb-big', box), duo = $('.vb-duo', big), city = $('.city-build', big), rimg = $('.vb-rimg', big), row = $('.vb-row', box);
  const rbtn = $('.vb-render', big), [rShow, rBack] = $$('span', rbtn);
  const back = $('.vb-back', st), next = $('.vb-next', st), end = $('.vb-end', st), n = $('.vb-n', st);
  const slide = box.closest('.slide'), wide = matchMedia('(min-width:901px)');
  // the words that are typed: a step's own paragraph (the last step's words follow the slider instead)
  const para = s => $('p:not([class])', s);
  const words = secs.map(s => (para(s) || {}).textContent || '');
  let typing = null, built = false, render = false;
  // type a step's words a letter at a time, with the limericks' caret; the space is kept by the other steps' words
  const poemOf = s => { const src = $('.vb-poem-src', s); return src ? [$('.vb-poem', s), src.textContent.trim()] : null; };
  const settle = () => secs.forEach((s, j) => { const p = para(s); if (p) p.textContent = words[j]; const pm = poemOf(s); if (pm) { pm[0].textContent = pm[1]; pm[0].scrollTop = 0; pm[0].classList.remove('on'); } });
  function type(i) {
    clearTimeout(typing); settle();
    const p = para(secs[i]); if (!p) return;
    const pm = poemOf(secs[i]);
    if (reduced) { if (pm) pm[0].classList.add('on'); return; }
    const into = (el, text, then, follow) => {
      const txt = document.createTextNode(''), caret = document.createElement('span'); caret.className = 'caret';
      el.textContent = ''; el.append(txt, caret);
      let k = 0;
      const tick = () => {
        k++; txt.data = text.slice(0, k);
        if (follow) el.scrollTop = el.scrollHeight;
        if (k >= text.length) { caret.remove(); if (then) then(); return; }
        const ch = text[k - 1];
        typing = setTimeout(tick, ch === '\n' ? 260 : /[.;:]/.test(ch) ? 220 : ch === ',' ? 120 : 14 + Math.random() * 18);
      };
      typing = setTimeout(tick, 300);
    };
    if (pm) { pm[0].textContent = ''; pm[0].classList.remove('on'); }
    into(p, words[i], pm ? () => { pm[0].classList.add('on'); into(pm[0], pm[1], null, true); } : null);
  }
  // on a computer: the plan as wide as the card, or narrower if the story under it would not fit on the screen with
  // it; the same before the story and during it. While the story runs, it is as tall as the card's inside
  const ROW = 210;   // the least height the picture and the words need under the plan
  function fit() {
    if (!wide.matches || !slide) { box.style.removeProperty('--vbh'); box.style.removeProperty('--vbw'); return; }
    const cs = getComputedStyle(slide), bs = getComputedStyle(box);
    const H = slide.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const inH = H - parseFloat(bs.paddingTop) - parseFloat(bs.paddingBottom) - 2;
    box.style.setProperty('--vbw', Math.max(320, Math.floor((inH - 14 - ROW) * 1800 / 841)) + 'px');
    if (box.classList.contains('telling') && !box.classList.contains('city')) box.style.setProperty('--vbh', Math.max(360, Math.floor(H)) + 'px'); else box.style.removeProperty('--vbh');
  }
  if (slide) new ResizeObserver(fit).observe(slide);
  wide.addEventListener('change', fit);
  const cap = f => { const d = $(`.vb-dot[data-f="${f}"]`, plan); return d ? d.getAttribute('aria-label') : $('h4', secs[st.k]).textContent; };
  const pics = () => secs[st.k].dataset.pics.split(' ');
  function showPic(j) {
    const list = pics(); st.p = (j + list.length) % list.length;
    img.src = `/assets/img/projects/${list[st.p]}.jpg`; img.alt = pic.ariaLabel = cap(list[st.p]);
    pPrev.hidden = pNext.hidden = list.length < 2;
  }
  // the last step: the city and its slider under the plan, or once it is built, the render; its words under it
  function place() {
    const isCity = st.k >= 0 && !!$('.city-step', secs[st.k]);
    box.classList.toggle('city', isCity); city.hidden = !(isCity && !render); rimg.hidden = !(isCity && render);
    rbtn.hidden = !(isCity && built); rShow.hidden = render; rBack.hidden = !render;
    media.hidden = st.k < 0 || isCity; row.classList.toggle('solo', isCity);
    if (st.k >= 0 && !isCity) showPic(0);
  }
  city.addEventListener('built', () => { built = true; place(); });
  rbtn.addEventListener('click', () => { render = !render; place(); });
  function show(i) {
    const open = i >= 0; st.k = i; go.hidden = open; steps.hidden = !open;
    box.classList.toggle('telling', open); fit();
    if (open) plan.dataset.step = i + 1; else delete plan.dataset.step;
    flow.play(open ? i + 1 : 0);
    if (!open) { clearTimeout(typing); settle(); render = false; place(); return; }
    secs.forEach((s, j) => s.classList.toggle('on', j === i));
    const was = box.classList.contains('city');
    render = false; type(i); place(); fit();
    if (!was && box.classList.contains('city')) requestAnimationFrame(() => glideTo(city));
    // Back and Next keep their place; on the last step Next rests and Close story appears to their right
    n.textContent = `${i + 1}/${secs.length}`; back.disabled = i <= 0; next.disabled = i === secs.length - 1; end.hidden = !next.disabled;
  }
  // the card (or on a phone, the page) glides slowly until the city and the words under it are in view
  function glideTo(el) {
    const inCard = wide.matches && slide, top = inCard ? slide.getBoundingClientRect().top : 0;
    const want = el.getBoundingClientRect().top - top - 12;   // the city's top to the top of what is seen
    const from = inCard ? slide.scrollTop : scrollY, T = reduced ? 0 : 1600, t0 = performance.now();
    if (want <= 0) return;
    const step = (now) => {
      const u = T ? Math.min(1, (now - t0) / T) : 1, e = u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2, y = from + want * e;
      if (inCard) slide.scrollTop = y; else scrollTo(0, y);
      if (u < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  // on a computer, the story's top comes to the card's top, so all of it is in view
  const bring = () => { if (!wide.matches || !slide) return; const d = box.getBoundingClientRect().top - slide.getBoundingClientRect().top - parseFloat(getComputedStyle(slide).paddingTop); slide.scrollBy({ top: d, behavior: reduced ? 'auto' : 'smooth' }); };
  go.addEventListener('click', () => { show(0); bring(); next.focus({ preventScroll: true }); });
  back.addEventListener('click', () => show(st.k - 1));
  next.addEventListener('click', () => show(st.k + 1));
  end.addEventListener('click', () => { show(-1); go.focus({ preventScroll: true }); });
  pPrev.addEventListener('click', () => showPic(st.p - 1));
  pNext.addEventListener('click', () => showPic(st.p + 1));
  pic.addEventListener('click', () => openLb(pics().map(f => ({ f, c: cap(f) })), st.p, pic));
});

// Layers of Egypt: the entry's own city, from the competition's Rhino model (assets/data/cairo-city.json), in the frame of
// its render, with the existing city around it. The buildings come baked, in the order the three rules raise them; the
// slider only shows the first so many. Drawn like the other models; a line under the slider says which rule is building
$$('.city-build').forEach(fig => {
  const box = $('.b8-3d', fig), range = $('input', fig), out = $('output', fig), rows = $$('.city-step', fig.closest('.vb-box') || fig).map((p) => [...p.children]);   // the stage's words stand beside the city, in the story
  let started = false;
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting) && !started) { started = true; io.disconnect(); start(); } }, { rootMargin: '200px' });
  io.observe(box);
  // each stage's words, and below them how its rule grows the city
  let shownPh = 0;
  const say = (ph) => {
    rows.forEach((r) => r.forEach((s, i) => s.classList.toggle('on', i === ph)));
    // when the city moves on to another stage, its words glow through the rainbow once
    if (ph !== shownPh && !reduced) rows.forEach((r) => { const s = r[ph]; s.classList.remove('glow'); void s.offsetWidth; s.classList.add('glow'); s.addEventListener('animationend', () => s.classList.remove('glow'), { once: true }); });
    shownPh = ph;
  };
  say(0);
  async function start() {
    const [THREE, { OrbitControls }, { mergeGeometries }, D] = await Promise.all([
      import('https://cdn.jsdelivr.net/npm/three@0.160.0/+esm'),
      import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js/+esm'),
      import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js/+esm'),
      fetch('/assets/data/cairo-city.json').then(r => r.json()),
    ]);
    const ren = new THREE.WebGLRenderer({ antialias: true });
    // drawn finer than the screen, so its many one-pixel lines read thinner
    ren.setClearColor('#ffffff', 1); ren.setPixelRatio(Math.min(4, Math.max(3, devicePixelRatio * 2))); box.append(ren.domElement);
    const [EX, EY] = D.size, scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 1000, 30000);
    // the render's camera: a long lens from far off (fitted to the render: its far edge, front corners and the ring's
    // centre land where they do in the picture); its width of view is kept at every size, so a resized window shows
    // the same city, larger or smaller
    const HFOV = 12 * Math.PI / 180;
    const ctl = new OrbitControls(cam, ren.domElement);
    cam.position.set(2411, 5000, 11250); ctl.target.set(2411, 0, -1000);
    ctl.enablePan = false; ctl.minDistance = 3000; ctl.maxDistance = 30000; ctl.maxPolarAngle = Math.PI * .46; ctl.update();
    ren.domElement.style.touchAction = 'none';   // a drag that starts on the model turns it; outside it, the page scrolls
    wheelOnly(box);
    const WHITE = new THREE.MeshBasicMaterial({ color: '#fff', polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    // nine thousand buildings: their lines a shade lighter than the other models', or the city reads as grey (and a
    // touch stronger than they were, so the outlines still read in the dark)
    const EDGE = new THREE.LineBasicMaterial({ color: '#9eaabb' }), FAINT = new THREE.LineBasicMaterial({ color: '#cbd3de' });
    const ease = (u) => u * u * (3 - 2 * u);
    // the base, cut at the site's south edge like the render
    { const g = new THREE.BoxGeometry(EX, 140, EY); g.translate(EX / 2, -70, -EY / 2); scene.add(new THREE.Mesh(g, WHITE), new THREE.LineSegments(new THREE.EdgesGeometry(g), EDGE)); }
    // a footprint (plan points in decimetres) raised to height h, as walls and a roof
    const prism = (pts, h) => {
      const n = pts.length / 2, v = [], idx = [];
      for (let k = 0; k < n; k++) { const x = pts[k * 2] / 10, y = pts[k * 2 + 1] / 10; v.push(x, 0, -y, x, h, -y); }
      for (let k = 0; k < n; k++) { const a = k * 2, b = ((k + 1) % n) * 2; idx.push(a, b, b + 1, a, b + 1, a + 1); }
      for (let k = 1; k < n - 1; k++) idx.push(1, k * 2 + 1, k * 2 + 3);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx); return g.toNonIndexed();
    };
    // the existing city around the site: its roofs at 15 m, walls down from their outer edges
    { const { v, t } = D.ctx, pos = [], cnt = new Map();
      const tri = (a, b, c) => [a, b, c].forEach((i) => pos.push(v[i * 2] / 10, 15, -v[i * 2 + 1] / 10));
      for (let k = 0; k < t.length; k += 3) { tri(t[k], t[k + 1], t[k + 2]); for (let e = 0; e < 3; e++) { const a = t[k + e], b = t[k + (e + 1) % 3], key = a < b ? a + '|' + b : b + '|' + a; cnt.set(key, (cnt.get(key) || 0) + 1); } }
      for (const [key, n] of cnt) if (n === 1) { const [a, b] = key.split('|').map(Number), ax = v[a * 2] / 10, ay = -v[a * 2 + 1] / 10, bx = v[b * 2] / 10, by = -v[b * 2 + 1] / 10;
        pos.push(ax, 0, ay, bx, 0, by, bx, 15, by, ax, 0, ay, bx, 15, by, ax, 15, ay); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      scene.add(new THREE.Mesh(g, WHITE), new THREE.LineSegments(new THREE.EdgesGeometry(g, 30), FAINT)); }
    // the site's buildings, in the order the rules build them, in a hundred steps
    const all = D.phases.flatMap((list, ph) => list.map((b) => ({ ph, h: b[0] / 10, f: b.slice(1) })));
    const A = new THREE.Color('#22c3a0'), B = new THREE.Color('#3b82f6'), STEPS = 100, batches = [];
    for (let s = 0; s < STEPS; s++) {
      const part = all.slice(Math.floor(all.length * s / STEPS), Math.floor(all.length * (s + 1) / STEPS));
      const g = mergeGeometries(part.map((b) => prism(b.f, b.h))), c = A.clone().lerp(B, s / (STEPS - 1));
      const lit = { face: new THREE.MeshBasicMaterial({ color: c.clone().lerp(new THREE.Color('#fff'), .35), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }), line: new THREE.LineBasicMaterial({ color: c }) };
      const grp = new THREE.Group(), mesh = new THREE.Mesh(g, WHITE), ln = new THREE.LineSegments(new THREE.EdgesGeometry(g, 30), EDGE);
      grp.add(mesh, ln); scene.add(grp);
      batches.push({ grp, mesh, ln, lit, ph: part[part.length - 1].ph, s: 1, target: 1 });
    }
    let raf = 0;
    function tick() {
      let moving = false;
      for (const b of batches) {
        b.s += (b.target - b.s) * .22; if (Math.abs(b.target - b.s) < .004) b.s = b.target; else moving = true;
        b.grp.visible = b.s > .002; b.grp.scale.y = Math.max(.002, ease(Math.min(1, b.s)));
        const lit = b.s !== b.target; b.mesh.material = lit ? b.lit.face : WHITE; b.ln.material = lit ? b.lit.line : EDGE;
      }
      ren.render(scene, cam); raf = moving ? requestAnimationFrame(tick) : 0;
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
    function set(v) { batches.forEach((b, i) => { b.target = i < v ? 1 : 0; }); out.value = out.textContent = v + ' %'; say(batches[v - 1].ph); kick(); if (v >= STEPS) fig.dispatchEvent(new Event('built')); }   // built: the story may now offer the render
    batches.forEach((b, i) => { b.s = b.target = i < +range.value ? 1 : 0; });
    function size() { const r = box.getBoundingClientRect(); if (!r.width) return; ren.setSize(r.width, r.height); cam.aspect = r.width / r.height; cam.fov = 2 * Math.atan(Math.tan(HFOV / 2) / cam.aspect) * 180 / Math.PI; cam.updateProjectionMatrix(); kick(); }
    ctl.addEventListener('change', kick);
    range.addEventListener('input', () => set(+range.value));
    new ResizeObserver(size).observe(box);
    set(+range.value); size();
    fig.dataset.buildings = all.length;
  }
});

// The staircase's interactive model, live in its card: loaded when the card first comes into view,
// and as tall as its content at any width (same origin, so its height can be read directly)
$$('.ss-live iframe').forEach(fr => {
  const io = new IntersectionObserver(es => {
    if (!es.some(e => e.isIntersecting)) return;
    io.disconnect();
    fr.addEventListener('load', () => {
      const doc = fr.contentDocument; if (!doc) return;
      const fit = () => { fr.style.height = Math.ceil(doc.querySelector('.wrap').getBoundingClientRect().height) + 'px'; };
      new ResizeObserver(fit).observe(doc.querySelector('.wrap')); fit();
    });
    fr.src = fr.dataset.src;
  }, { rootMargin: '300px' });
  io.observe(fr);
});

/* ================= apps ================= */
CARS.apps = carousel({
  car: $('#appCar'), trackEl: $('#appTrack'), prev: $('#appPrev'), next: $('#appNext'),
  count: $('#appCount'), dots: $('#appDots'),
});

/* ================= apps: a computer and a phone ================= */
// The Apps tab as two screens, a computer and a phone, side by side. The computer holds the desktop software
// (Revitesse, RealStage), the phone the three phone apps (the slides marked data-device="pc" go on the computer).
// A click on a device brings it to the middle, larger; a click on an app there opens its page, which grows out of
// the icon while the screens zoom in behind it. The back button in the card's corner, Escape, or the browser's Back
// close it into its icon again, on its own device
(() => {
  const panel = document.getElementById('apps'); if (!panel) return;
  const wrap = panel.querySelector('.wrap'), card = wrap.querySelector(':scope > .glass.card');
  const track = document.getElementById('appTrack'), slides = [...track.children];
  if (!card || !track || !CARS.apps) return;
  const carShow = CARS.apps.show, index = () => CARS.apps.index, showApp = (k) => carShow(k, false);

  const name = (s) => (s.querySelector('h3')?.firstChild?.textContent || '').trim();
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };

  // the two devices
  const devices = el('div', 'devices');
  const pc = el('div', 'device pc', '<div class="screen"><div class="glass-in"><div class="bar"><span class="clock"></span></div></div></div><div class="neck"></div><div class="foot"></div>');
  const ph = el('div', 'device ph', '<div class="screen"><div class="glass-in"><div class="status"><span class="clock"></span><span class="power"><span class="pct"></span><span class="batt"><i></i></span></span></div></div></div>');
  devices.append(pc, ph);
  pc.setAttribute('aria-label', t('Computer')); ph.setAttribute('aria-label', t('Phone'));
  const icons = slides.map((s, k) => {
    const b = el('button', 'dicon'); b.type = 'button';
    // the logo as it ends up: the animated ones as their finished drawing
    const STILL = { Revitesse: 'revitesse.png', RealStage: 'plug.svg', Bancanca: 'bancanca.svg' };
    let logo;
    if (STILL[name(s)]) { logo = el('span', 'logo', `<img src="/assets/img/logos/${STILL[name(s)]}" alt="">`); }
    else { logo = s.querySelector('.a-head .logo, .p-head .logo').cloneNode(true); logo.classList.remove('anim-logo'); logo.removeAttribute('data-player'); }
    logo.setAttribute('aria-hidden', 'true');
    const tag = (s.querySelector('.a-head .tag, .p-head .tag') || {}).textContent || '';
    const txt = el('span', 'txt'); txt.append(el('span', 'name', name(s)), el('span', 'sub', tag.trim()));
    b.append(logo, txt);
    (s.dataset.device === 'pc' ? pc : ph).querySelector('.glass-in').append(b);
    b.addEventListener('click', () => open(k));
    return b;
  });
  card.before(devices);

  // One unit for both screens: 1px of the computer's screen when the computer is the chosen one, and 1px of the
  // phone's when the phone is, scaled so that a logo is the same size on both (and smaller on a small screen). The
  // widths are those the CSS gives the chosen device
  const units = () => {
    const W = devices.clientWidth, H = devices.clientHeight; if (!W || !H) return;
    const wide = matchMedia('(min-width: 901px)').matches;
    const P = Math.min((wide ? .72 : .74) * W, 1.28 * H), F = Math.min((wide ? .44 : .66) * W, .44 * H);
    // the inside of each screen: less the frame (the computer's border and margin, the phone's rim)
    const Pi = P * .972 - 4, Fi = F - 5;
    const k = Math.min(1, Fi / 270);   // on a small phone everything a little smaller, the same on both
    devices.style.setProperty('--upc', (k / Pi).toFixed(6)); devices.style.setProperty('--uph', (k / Fi).toFixed(6));
  };
  new ResizeObserver(units).observe(devices); units();
  panel.classList.add('devices-on');

  // the time on both screens
  const lang = document.documentElement.lang || undefined;
  const tick = () => {
    const d = new Date(), hm = d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
    ph.querySelector('.clock').textContent = hm;
    pc.querySelector('.clock').textContent = d.toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'short' }) + '  ' + hm;
  };
  tick(); setInterval(tick, 15000);

  // a battery that runs down slowly while the visitor stays, and never quite runs out
  let charge = 87;
  const battery = () => {
    ph.querySelector('.pct').textContent = charge + '%';
    ph.querySelector('.batt i').style.setProperty('--b', charge / 100);
    ph.querySelector('.batt').classList.toggle('low', charge <= 20);
  };
  battery(); setInterval(() => { if (charge > 9) { charge--; battery(); } }, 90000);

  // turning to a device: the mouse on its way over it, a tap on it, or the keyboard on one of its icons
  const turn = (d) => { if (d) devices.dataset.focus = d; else delete devices.dataset.focus; };
  // a click beside both devices puts them side by side again
  devices.addEventListener('click', (e) => { if (!e.target.closest('.device')) turn(null); });
  pc.addEventListener('click', (e) => { if (!e.target.closest('.dicon')) turn('pc'); });
  ph.addEventListener('click', (e) => { if (!e.target.closest('.dicon')) turn('ph'); });
  devices.addEventListener('focusin', (e) => { const d = e.target.closest('.device'); if (d) turn(d === pc ? 'pc' : 'ph'); });

  // one button at the top right of the open app, the same for every app: back to its device
  const top = el('div', 'dev-top'), home = el('button', 'arrow dev-back', '<svg class="i" viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>');
  home.type = 'button'; home.setAttribute('aria-label', t('Back to the apps')); home.title = t('Back to the apps');
  // on a computer it stands in the card's head where the arrow to the next app was; on a phone, whose card has its
  // arrows at the bottom, it stays at the top right as the page scrolls
  card.prepend(top);
  const nav = card.querySelector('.card-head .nav');
  const seat = () => { if (matchMedia('(min-width: 901px)').matches) nav.append(home); else top.append(home); };
  seat(); matchMedia('(min-width: 901px)').addEventListener('change', seat);
  const deviceOf = (k) => (pc.contains(icons[k]) ? 'pc' : 'ph');

  let isOpen = false, busy = false;
  const framed = () => matchMedia('(min-width: 901px)').matches;
  // while it moves, the card lies over the screens, in their place
  const place = () => {
    card.style.top = devices.offsetTop + 'px'; card.style.left = devices.offsetLeft + 'px'; card.style.width = devices.offsetWidth + 'px';
    card.style.height = framed() ? devices.offsetHeight + 'px' : 'auto';
  };
  const unplace = () => { for (const p of ['top', 'left', 'width', 'height']) card.style[p] = ''; };
  const clipFor = (k) => {
    const i = icons[k].querySelector('.logo').getBoundingClientRect(), c = card.getBoundingClientRect();
    return `inset(${i.top - c.top}px ${c.right - i.right}px ${c.bottom - i.bottom}px ${i.left - c.left}px round ${i.width / 2}px)`;
  };
  const origin = (k) => {
    const i = icons[k].querySelector('.logo').getBoundingClientRect(), d = devices.getBoundingClientRect();
    devices.style.setProperty('--ox', (i.left + i.width / 2 - d.left) + 'px'); devices.style.setProperty('--oy', (i.top + i.height / 2 - d.top) + 'px');
  };
  const parts = () => [...card.children];

  function open(k, push = true) {
    if (isOpen || busy) return;
    // the project, without the slide sideways
    track.classList.add('drag'); showApp(k); void track.offsetWidth; track.classList.remove('drag');
    isOpen = true;
    if (push) history.pushState({ devApp: k }, '', location.href);
    if (reduced) { panel.classList.add('app-open'); return; }
    busy = true;
    origin(k);
    panel.classList.add('app-moving'); place();
    const from = clipFor(k);
    devices.classList.add('zoomed');
    const a = card.animate([{ clipPath: from }, { clipPath: 'inset(0px 0px 0px 0px round 10px)' }], { duration: 520, easing: 'cubic-bezier(.3,.7,.2,1)' });
    parts().forEach((p) => p.animate([{ opacity: 0 }, { opacity: 0, offset: .35 }, { opacity: 1 }], { duration: 520 }));
    a.onfinish = () => {
      panel.classList.remove('app-moving'); panel.classList.add('app-open'); unplace(); busy = false;
      if (!framed()) scrollTo({ top: card.getBoundingClientRect().top + scrollY - document.querySelector('header').offsetHeight - 14, behavior: 'instant' });
    };
  }

  function close() {
    if (!isOpen || busy) return;
    isOpen = false;
    const k = index();
    // back to its own device, brought forward
    devices.classList.add('instant'); turn(deviceOf(k));
    if (reduced) { panel.classList.remove('app-open'); devices.classList.remove('instant'); return; }
    busy = true;
    // the screens come back, zoomed in on the icon, and settle as the card shrinks into it
    devices.style.transition = 'none'; devices.classList.add('zoomed');
    panel.classList.remove('app-open'); panel.classList.add('app-moving'); place();
    origin(k); void devices.offsetWidth; devices.style.transition = ''; devices.classList.remove('instant');
    requestAnimationFrame(() => devices.classList.remove('zoomed'));
    const to = clipFor(k);
    const a = card.animate([{ clipPath: 'inset(0px 0px 0px 0px round 10px)' }, { clipPath: to }], { duration: 460, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' });
    const fades = parts().map((p) => p.animate([{ opacity: 1 }, { opacity: 0, offset: .45 }, { opacity: 0 }], { duration: 460, fill: 'forwards' }));
    a.onfinish = () => {
      panel.classList.remove('app-moving'); unplace();
      [a, ...fades].forEach((x) => x.cancel());
      busy = false; icons[k].focus({ preventScroll: true });
      if (!framed()) { const r = icons[k].getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) scrollTo({ top: r.top + scrollY - innerHeight / 2, behavior: 'instant' }); }
    };
  }

  // an app asked for from elsewhere (the About strip, or a project's own address) opens at once, without the growing
  const openNow = (k) => {
    if (isOpen) { showApp(k); return; }
    track.classList.add('drag'); showApp(k); void track.offsetWidth; track.classList.remove('drag');
    isOpen = true; turn(deviceOf(k)); panel.classList.add('app-open');
  };
  CARS.apps.show = (k) => openNow(k);
  const [st, sk] = (document.documentElement.dataset.start || '').split('/');
  if (st === 'apps' && !location.hash && sk !== undefined && sk !== '') openNow(+sk);

  home.addEventListener('click', () => { if (history.state && history.state.devApp != null) history.back(); else close(); });
  addEventListener('popstate', () => { if (isOpen) close(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen && panel.getAttribute('aria-hidden') !== 'true') home.click(); });
})();

/* ================= archive: the map ================= */
// Take me somewhere: one of the places on the map at random, and its newest video
{
  const take = $('#takeMe'), places = ((window.WW || {}).places || []).filter((p) => p.v);
  if (take && places.length) take.addEventListener('click', () => {
    const p = places[Math.floor(Math.random() * places.length)];
    window.open(`https://www.youtube.com/watch?v=${p.v}`, '_blank', 'noopener');
  });
  else if (take) take.hidden = true;
}
const W = window.WW;
const byCountry = d3.group(W.places, p => p.country);
$('#sPlaces').textContent = W.places.length;
$('#sCountries').textContent = byCountry.size;
// Long videos and shorts are counted apart; data from before that split only has the total.
$('#sLong').textContent = W.long ?? W.total;
$('#sShorts').textContent = W.shorts ?? '–';
if (W.first && W.first.date) {
  const d = new Date(W.first.date + 'T12:00:00Z');
  $('#sFirstLink').textContent = d.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });
  $('#sFirstLink').href = 'https://www.youtube.com/watch?v=' + W.first.id;
}
if (W.updated) {
  const d = new Date(W.updated + 'T12:00:00Z').toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });
  $('.maphint').insertAdjacentHTML('beforeend', ' ' + t('The numbers are refreshed from the channel every day; last update {d}.', { d }));
}

const ALIAS = {
  'United States of America': 'United States', 'Macedonia': 'North Macedonia',
  'Bosnia and Herz.': 'Bosnia and Herzegovina', 'Dem. Rep. Congo': 'DR Congo',
  'Central African Rep.': 'Central African Republic', 'Dominican Rep.': 'Dominican Republic',
  'S. Sudan': 'South Sudan', 'Eq. Guinea': 'Equatorial Guinea', 'eSwatini': 'Eswatini',
  'Fr. S. Antarctic Lands': 'French Southern Lands', 'Fr. Polynesia': 'French Polynesia',
  'S. Geo. and the Is.': 'South Georgia', 'St. Vin. and Gren.': 'Saint Vincent and the Grenadines',
  'Antigua and Barb.': 'Antigua and Barbuda', 'Br. Indian Ocean Ter.': 'British Indian Ocean Territory',
};
const cleanName = n => ALIAS[n] || n.replace(/ Is\.$/, ' Islands').replace(/^St\. /, 'Saint ');
// Country names in the page's language: the browser knows every region by its two-letter code;
// the English names are matched to codes once. The UK's four countries come from the translations.
const regionName = (() => {
  if (LANG === 'en' || !Intl.DisplayNames) return (n) => n;
  const en = new Intl.DisplayNames('en', { type: 'region' }), loc = new Intl.DisplayNames(LOCALE, { type: 'region' });
  const code = {};
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const a of A) for (const b of A) { try { const c = a + b, n = en.of(c); if (n && n !== c) code[n] = c; } catch (_) {} }
  Object.assign(code, { 'United States': 'US', 'Bosnia and Herzegovina': 'BA', 'DR Congo': 'CD', 'Republic of the Congo': 'CG', 'Congo': 'CG',
    'Central African Republic': 'CF', 'Dominican Republic': 'DO', 'Ivory Coast': 'CI', "Côte d'Ivoire": 'CI', 'Czechia': 'CZ', 'Czech Republic': 'CZ',
    'Eswatini': 'SZ', 'North Macedonia': 'MK', 'Myanmar': 'MM', 'Palestine': 'PS', 'Saint Vincent and the Grenadines': 'VC', 'Antigua and Barbuda': 'AG',
    'Solomon Islands': 'SB', 'Falkland Islands': 'FK', 'Faeroe Islands': 'FO', 'Turks and Caicos Islands': 'TC', 'Cayman Islands': 'KY', 'Marshall Islands': 'MH',
    'Cook Islands': 'CK', 'Timor-Leste': 'TL', 'Vatican': 'VA', 'Macao': 'MO', 'Hong Kong': 'HK', 'Kosovo': 'XK', 'Cabo Verde': 'CV', 'São Tomé and Principe': 'ST' });
  return (n) => (I.t && I.t[n]) || (code[n] ? loc.of(code[n]) : n);
})();
const placeName = (n) => (I.t && I.t[n]) || n;

function initMap() {
  const host = $('#map'), tip = $('#mapTip');
  Promise.all([d3.json('/assets/data/countries-50m.json'), d3.json('/assets/data/uk-countries.json')]).then(([world, ukParts]) => {
    const geoms = world.objects.countries.geometries;
    let feats = topojson.feature(world, world.objects.countries).features;
    // The same merges Shuin makes, so the outlines match the app.
    const merge = (names, as) => {
      const parts = geoms.filter(g => names.includes(g.properties.name));
      if (parts.length < 2) return;
      feats = feats.filter(f => !names.includes(f.properties.name));
      feats.push({ type: 'Feature', properties: { name: as }, geometry: topojson.merge(world, parts) });
    };
    merge(['Morocco', 'W. Sahara', 'Western Sahara'], 'Morocco');
    merge(['Somalia', 'Somaliland'], 'Somalia');
    merge(['Israel', 'Palestine'], 'Palestine');
    merge(['Cyprus', 'N. Cyprus', 'Northern Cyprus'], 'Cyprus');
    feats.forEach(f => { f.properties.name = cleanName(f.properties.name); });
    // The UK is shown as its four countries (England | UK, Scotland | UK, Wales | UK,
    // Northern Ireland | UK), outlines from Natural Earth's map units.
    if (ukParts && ukParts.features) {
      feats = feats.filter(f => f.properties.name !== 'United Kingdom').concat(ukParts.features);
    }

    $('.loading', host).remove();
    const svg = d3.select(host).insert('svg', '.tip').attr('role', 'img')
      .attr('aria-label', t('World map of {p} places documented in {c} countries', { p: W.places.length, c: byCountry.size }));
    const layer = svg.append('g');
    const gC = layer.append('g'), gP = layer.append('g');
    const zoom = d3.zoom().scaleExtent([1, 18])
      .filter(e => e.type === 'wheel' || !e.button)
      .on('zoom', e => {
        layer.attr('transform', e.transform);
        gP.selectAll('circle').attr('r', d => d.r / Math.sqrt(e.transform.k) / Math.pow(e.transform.k, .25));
        if (pinned) placeTip(lastXY);
      });
    svg.call(zoom).on('dblclick.zoom', null);

    let pinned = null, lastXY = [0, 0], size = [0, 0];

    function render() {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h || (w === size[0] && h === size[1])) return;
      size = [w, h];
      svg.attr('viewBox', `0 0 ${w} ${h}`);
      // Fit from the Arctic down past Cape Horn, so all of South America and the edge of Antarctica show
      const frame = { type: 'MultiPoint', coordinates: [[-168, 76], [0, 80], [178, 76], [-168, -68], [0, -68], [178, -68]] };
      const proj = d3.geoNaturalEarth1().fitExtent([[6, 6], [w - 6, h - 6]], frame);
      const path = d3.geoPath(proj);
      gC.selectAll('path').data(feats, d => d.properties.name).join('path')
        .attr('class', d => 'country' + (byCountry.has(d.properties.name) ? ' doc' : ''))
        .attr('d', path);
      gC.selectAll('path.doc').raise();
      const base = Math.max(2.2, Math.min(w, 1100) / 330);
      W.places.forEach(p => { [p.x, p.y] = proj([p.lon, p.lat]); p.r = base + Math.sqrt(p.n) * base * .22; });
      gP.selectAll('circle').data([...W.places].sort((a, b) => b.n - a.n), d => d.name).join('circle')
        .attr('class', 'city').attr('cx', d => d.x).attr('cy', d => d.y).attr('r', d => d.r);
      zoom.translateExtent([[0, 0], [w, h]]);
      svg.call(zoom.transform, d3.zoomIdentity);
    }
    new ResizeObserver(render).observe(host);
    render();

    const xy = e => { const r = host.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    function placeTip([x, y]) {
      lastXY = [x, y];
      const w = host.clientWidth, h = host.clientHeight, tw = tip.offsetWidth, th = tip.offsetHeight;
      let left = x + 14, top = y - th - 12;
      if (left + tw > w - 8) left = x - tw - 14;
      if (left < 8) left = 8;
      if (top < 8) top = Math.min(y + 16, h - th - 8);
      tip.style.left = left + 'px'; tip.style.top = top + 'px';
    }
    function focus(country) {
      if (country && !byCountry.has(country)) country = null;   // only documented countries dim the rest
      host.classList.toggle('focus', !!country);
      gC.selectAll('path').classed('hi', d => d.properties.name === country);
      gP.selectAll('circle').classed('hi', d => d.country === country);
    }
    function countryTip(name) {
      const list = byCountry.get(name);
      if (!list) return `<b>${regionName(name)}</b><span>${t('Not documented yet')}</span>`;
      const ps = [...list].sort((a, b) => b.n - a.n);
      const vids = d3.sum(ps, p => p.n);
      return `<b>${regionName(name)}</b><span>${ps.map(p => placeName(p.name)).join(' · ')}</span><br><span>${plural(ps.length, 'place')}${LANG === 'ar' ? '، ' : ', '}${plural(vids, 'video')}</span>${playlistLink(name, '<br>')}`;
    }
    const playlistLink = (country, before = '') => (W.playlists || {})[country]
      ? `${before}<a href="https://www.youtube.com/playlist?list=${W.playlists[country]}" target="_blank" rel="noopener">${t('All the walks from here')}</a>` : '';
    const cityTip = p => `<b>${placeName(p.name)}</b><span>${regionName(p.country)} · ${plural(p.n, 'video')}</span><br>` +
      `<a href="https://www.youtube.com/watch?v=${p.v}" target="_blank" rel="noopener">${t('Watch a video')}</a>${playlistLink(p.country)}`;
    function show(html, at, pin) {
      tip.innerHTML = html; tip.classList.add('show'); tip.classList.toggle('pinned', !!pin); placeTip(at);
    }
    function clear() {
      pinned = null; focus(null); tip.classList.remove('show', 'pinned');
      gP.selectAll('circle').classed('sel', false);
    }

    gC.on('pointerover', (e, d) => {
      if (pinned || e.pointerType !== 'mouse' || !e.target.__data__) return;
      const name = e.target.__data__.properties.name;
      focus(name); show(countryTip(name), xy(e));
    }).on('pointermove', e => { if (!pinned && e.pointerType === 'mouse') placeTip(xy(e)); })
      .on('pointerout', e => { if (!pinned && e.pointerType === 'mouse') { focus(null); tip.classList.remove('show'); } })
      .on('click', e => {
        const d = e.target.__data__; if (!d) return;
        e.stopPropagation();
        const name = d.properties.name;
        if (pinned && pinned.type === 'country' && pinned.name === name) return clear();
        clear(); pinned = { type: 'country', name }; focus(name); show(countryTip(name), xy(e), true);
      });

    gP.on('pointerover', e => {
      const p = e.target.__data__;
      if (pinned || e.pointerType !== 'mouse' || !p) return;
      focus(p.country); show(cityTip(p), xy(e));
    }).on('pointerout', e => { if (!pinned && e.pointerType === 'mouse') { focus(null); tip.classList.remove('show'); } })
      .on('click', e => {
        const p = e.target.__data__; if (!p) return;
        e.stopPropagation();
        if (pinned && pinned.type === 'city' && pinned.name === p.name) return clear();
        clear(); pinned = { type: 'city', name: p.name }; focus(p.country);
        d3.select(e.target).classed('sel', true).raise();
        show(cityTip(p), xy(e), true);
      });

    svg.on('click', clear);
    $('#zIn').addEventListener('click', () => svg.transition().duration(350).call(zoom.scaleBy, 1.8));
    $('#zOut').addEventListener('click', () => svg.transition().duration(350).call(zoom.scaleBy, 1 / 1.8));
    // the map is there: its drawing from the bottom up may begin (see go)
    $('#archive').classList.add('ready');
  }).catch(() => { $('.loading', host).textContent = t('The map got lost on the way. Reload and it should find its way back.'); $('#archive').classList.add('ready'); });
}

/* ================= first visits ================= */
const onFirstShow = {
  writing() {
    // The award simply appears; only the limericks are typed.
    $('#awardCard').classList.add('in');
    setTimeout(() => { poemsReady = true; poemTypers[poems.index].start(); }, reduced ? 0 : 900);
  },
  archive() { initMap(); },
  apps() { loadAppImages(); },
};
// Slides sit off-screen inside the slider, where lazy loading never fires.
function loadAppImages() { $$('#apps img[loading="lazy"]').forEach(img => { img.loading = 'eager'; }); }
addEventListener('load', () => setTimeout(loadAppImages, 1500));

const [startTab, startSlide] = (document.documentElement.dataset.start || '').split('/');
/* ================= About: the project browser ================= */
// Every project of every tab as its own logo tile on a slowly drifting strip, turned like cards in a fan; drag it
// through, click one to stop on it and read about it, or search all the projects' words. Built from the page itself,
// so it speaks the page's language.
(() => {
  const box = $('#dex'); if (!box) return;
  const flow = $('.dex-flow', box), info = $('.dex-info', box), results = $('.dex-results', box), input = $('.dex-search input', box);
  const W = (k) => ($(`.dex-words [data-w="${k}"]`, box) || {}).textContent || '';
  const norm = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // an element's words as they read: separators as dots, line breaks as commas
  const said = (e) => e.innerHTML.replace(/<i><\/i>/g, ' · ').replace(/<br\s*\/?>/g, ', ').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  let uid = 0;
  // a copy of a logo tile, its ids made its own so its masks and gradients play in the copy
  function copyLogo(el) {
    const c = el.cloneNode(true), n = ++uid;
    c.setAttribute('data-dex', ''); c.removeAttribute('id');
    const ids = new Map(); c.querySelectorAll('[id]').forEach((e) => { const id = `${e.id}-dex${n}`; ids.set(e.id, id); e.id = id; });
    if (ids.size) c.querySelectorAll('*').forEach((e) => [...e.attributes].forEach((a) => {
      let v = a.value; for (const [o, m] of ids) v = v.split(`#${o})`).join(`#${m})`).split(`"#${o}"`).join(`"#${m}"`);
      if ((a.name === 'href' || a.name === 'xlink:href') && v.startsWith('#') && ids.has(v.slice(1))) v = '#' + ids.get(v.slice(1));
      if (v !== a.value) e.setAttribute(a.name, v);
    }));
    // at rest a copy shows its logo finished, as it stands on its page after playing
    const anims = [...(c.matches('.anim-logo') ? [c] : []), ...c.querySelectorAll('.anim-logo')];
    anims.forEach((e) => { const p = PLAYERS[e.dataset.player]; if (p) return; e.classList.add('play'); });
    c.classList.add('dex-still');
    return c;
  }
  // the projects, read from the tabs
  const items = [];
  const TRACKS = { architecture: '#archTrack', design: '#desTrack', writing: '#writTrack', apps: '#appTrack' };
  for (const [tab, sel] of Object.entries(TRACKS)) {
    $$(`${sel} > .slide`).forEach((s, k) => {
      const head = s.querySelector(':scope > .p-head, :scope > .a-head'), logo = head && head.querySelector('.logo');
      if (!logo) return;
      const m = head.querySelector('.p-meta, .tag'), title = head.querySelector('h2, h3').textContent.trim();
      const meta = m ? said(m) : '';
      // its own words for the strip, found by its place in the tab (or by name); an h4 there is the grey line under the title
      const note = $(`.dex-words [data-for="${tab}-${k}"], .dex-words [data-for="${title}"]`, box), sub = note && note.querySelector('h4');
      const own = note ? [...note.querySelectorAll('p')].map((p) => p.textContent.trim()) : [];
      const words = [...s.querySelectorAll('p, dt, dd, li, figcaption, h4, .city-step span, .prize-line')].map(said);
      const caps = [...s.querySelectorAll('[data-imgs]')].flatMap((e) => e.dataset.imgs.split(';').map((x) => (x.split('|')[1] || '').trim()));
      const labels = [...s.querySelectorAll('.vb-dot[aria-label]')].map((e) => e.getAttribute('aria-label'));
      const desc = own.length ? own : [((s.querySelector('.prose p, .a-body p, .lead') || {}).textContent || '').trim()].filter(Boolean);
      items.push({ tab, k, title, meta: sub ? sub.textContent.trim() : meta.replace(/\s+/g, ' ').trim(), logo, desc, texts: [...(sub ? [sub.textContent.trim(), meta] : []), ...own,...words, ...caps, ...labels].filter(Boolean) });
    });
  }
  { // the Archive: the Wandering Wayfarer channel's own logo on a tile, its words from the About page
    const tile = document.createElement('span'); tile.className = 'logo dex-archive';
    tile.innerHTML = '<img src="/assets/img/logos/wandering-wayfarer.png" width="512" height="512" alt="" decoding="async">';
    const note = $('.dex-words [data-for="archive"]', box), own = [...note.querySelectorAll('p')].map((p) => p.textContent.trim());
    const lead = (($('#archive .lead') || {}).textContent || '').trim();
    items.push({ tab: 'archive', k: -1, title: W('archive'), meta: W('archive-meta'), logo: tile, desc: own, texts: [...own, lead] });
  }
  const N = items.length;
  const open = (it) => { go(it.tab); if (it.k >= 0 && CARS[it.tab]) CARS[it.tab].show(it.k); };

  // the strip
  const tiles = items.map((it, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'dex-item'; b.setAttribute('role', 'option'); b.setAttribute('aria-label', it.title);
    b.append(copyLogo(it.logo)); b.dataset.i = i; flow.append(b); return b;
  });
  const GAP = () => (flow.clientWidth < 520 ? 74 : 92);
  let pos = 0, vel = 0, drift = !reduced, target = null, raf = 0, last = 0;
  let touched = false, shown = -1, played = -1;   // once the visitor takes the strip, the words follow the tile in the middle
  const wrap = (d) => ((d % N) + N + N / 2) % N - N / 2;
  // the tiles keep their shape: the further from the middle, the smaller, nothing turned
  let drawn = 0;
  function place() {
    const g = GAP(), TILE = flow.clientWidth < 520 ? 56 : 64, MAX = TILE * 1.14;
    // every tile is laid out once, at the size of the one in the middle, and only scaled down from there: a scale
    // moves without laying the page out again, so the strip runs smoothly, and shrinking keeps every logo sharp
    if (drawn !== MAX) { drawn = MAX; tiles.forEach((t) => t.style.setProperty('--sz', MAX.toFixed(1) + 'px')); }
    tiles.forEach((t, i) => {
      const d = wrap(i - pos), a = Math.abs(d);
      const x = d * g * (1 - Math.min(a, 4) * .07), s = 1.14 - Math.min(a, 3.5) * .15;
      t.style.transform = `translate(-50%, -50%) translateX(${x.toFixed(2)}px) scale(${(s / 1.14).toFixed(4)})`;
      t.style.opacity = a > 4.2 ? 0 : (1 - Math.max(0, a - 1.6) * .38).toFixed(2);
      t.style.zIndex = 100 - Math.round(a * 10);
      t.tabIndex = a < .5 ? 0 : -1;
    });
  }
  const middle = () => ((Math.round(pos) % N) + N) % N;
  function frame(now) {
    const dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
    if (target !== null) { const d = wrap(target - pos); pos += d * Math.min(1, dt * 9); if (Math.abs(d) < .002) { pos = target; target = null; } }
    else if (!dragging && Math.abs(vel) > .02) { pos += vel * dt; vel *= Math.pow(.04, dt); if (Math.abs(vel) <= .02) { vel = 0; if (!drift) target = Math.round(pos); } }
    else if (drift && !dragging) pos += dt * .32;
    place();
    const moving = (drift || dragging || target !== null || Math.abs(vel) > .02) && !flow.hidden;
    if (touched) { const c = middle(); if (c !== shown) tell(c); if (!moving && played !== c) play(c); }
    raf = moving ? requestAnimationFrame(frame) : 0;
  }
  const kick = () => { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };
  // drag it through; a short press without moving is a click
  let dragging = false, x0 = 0, p0 = 0, moved = 0, lx = 0, lt = 0;
  flow.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true; drift = false; touched = true; target = null; vel = 0; x0 = lx = e.clientX; lt = performance.now(); p0 = pos; moved = 0;
    flow.classList.add('dragging'); kick();
  });
  flow.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - x0, now = performance.now(); moved = Math.max(moved, Math.abs(dx));
    // the strip holds on to the pointer only once it is really dragged, so a plain click still reaches its tile
    if (moved > 6 && !flow.hasPointerCapture(e.pointerId)) try { flow.setPointerCapture(e.pointerId); } catch (_) {}
    pos = p0 - dx / GAP() * (RTL ? -1 : 1);
    if (now > lt) vel = -(e.clientX - lx) / GAP() / ((now - lt) / 1000) * (RTL ? -1 : 1);
    lx = e.clientX; lt = now;
  });
  const up = () => { if (!dragging) return; dragging = false; flow.classList.remove('dragging'); if (performance.now() - lt > 80) vel = 0; if (Math.abs(vel) < .3) target = Math.round(pos); kick(); };
  flow.addEventListener('pointerup', up); flow.addEventListener('pointercancel', up);
  // a click brings that tile to the middle
  flow.addEventListener('click', (e) => {
    const t = e.target.closest('.dex-item'); if (!t || moved > 6) return;
    choose(+t.dataset.i);
  });
  flow.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault(); const step = (e.key === 'ArrowRight') !== !!RTL ? 1 : -1;
    choose(((Math.round(pos) + step) % N + N) % N); tiles[target].focus({ preventScroll: true });
  });
  function choose(i) { drift = false; touched = true; vel = 0; target = i; kick(); }
  // the words about the project in the middle, and its ring
  function tell(i) {
    shown = i;
    tiles.forEach((t, j) => { t.classList.toggle('sel', j === i); t.setAttribute('aria-selected', j === i); });
    const it = items[i];
    info.innerHTML = `<h3>${esc(it.title)}</h3><button class="vb-pill dex-open" type="button">${esc(W('open'))}</button>${it.meta ? `<p class="meta">${esc(it.meta)}</p>` : ''}${it.desc.map((p) => `<p>${esc(p)}</p>`).join('')}`;
    $('.dex-open', info).addEventListener('click', () => open(it));
  }
  // once the strip rests, the logo in the middle plays: from the finished logo it stands as, back to its start and
  // forward again, so it never jumps
  function play(i) {
    played = i;
    const tile = tiles[i], logo = tile.querySelector('.logo');
    logo.classList.remove('dex-still'); unsettle(logo);
    [...(logo.matches('.anim-logo') ? [logo] : []), ...logo.querySelectorAll('.anim-logo')].forEach((svg) => {
      svg.classList.remove('play');
      const player = PLAYERS[svg.dataset.player];
      if (player) { if (player.loop && !reduced) player.loop(svg); else { player.reset(svg); player.play(svg, reduced); } return; }
      svg.style.setProperty('--dir', -1); void svg.getBoundingClientRect(); svg.classList.add('play');
      if (!reduced) rewind(svg, tile);
    });
  }
  // a logo drawn by CSS: each of its animations is set to its end and runs backwards (see backTime), then forwards
  // as on the project's page; the tile settles only once the loop is over
  function rewind(svg, tile) {
    const anims = svg.getAnimations({ subtree: true }).filter((a) => isFinite(a.effect.getComputedTiming().endTime));
    if (!anims.length) return;
    const run = tile._loop = (tile._loop || 0) + 1;
    tile.dataset.loop = '';
    const total = Math.max(...anims.map((a) => a.effect.getComputedTiming().endTime)), rate = total / backTime(total);
    anims.forEach((a) => { a.pause(); a.currentTime = a.effect.getComputedTiming().endTime; a.playbackRate = -rate; a.play(); });
    Promise.all(anims.map((a) => a.finished)).then(() => {
      if (run !== tile._loop) return;
      anims.forEach((a) => { a.playbackRate = 1; a.currentTime = 0; a.play(); });
      return Promise.all(anims.map((a) => a.finished));
    }).then(() => { if (run === tile._loop) { delete tile.dataset.loop; settle(tile); } }).catch(() => {});
  }

  // search: every project's words; the matches side by side, each with the sentences it was found in
  const sentences = (s) => s.split(/(?<=[.!?؟。])\s+/);
  function mark(s, q) {
    const n = norm(s), i = n.indexOf(q); if (i < 0) return esc(s);
    // map the match in the plain text back onto the sentence as written
    let a = -1, b = -1, k = 0;
    for (let j = 0; j < s.length; j++) { const len = norm(s[j]).length; if (a < 0 && k + len > i) a = j; k += len; if (k >= i + q.length) { b = j + 1; break; } }
    if (a < 0 || b < 0) return esc(s);
    return esc(s.slice(0, a)) + '<mark>' + esc(s.slice(a, b)) + '</mark>' + esc(s.slice(b));
  }
  function search() {
    const q = norm(input.value.trim());
    const on = q.length >= 2;
    flow.hidden = on; info.hidden = on; results.hidden = !on; $('.dex-hint', box).hidden = on;
    if (!on) { kick(); return; }
    const hits = [];
    for (const it of items) {
      const inTitle = norm(it.title).includes(q) || norm(it.meta).includes(q);
      const found = []; const seen = new Set();
      for (const t of it.texts) for (const s of sentences(t)) { if (found.length >= 2) break; const k = norm(s); if (k.includes(q) && !seen.has(k)) { seen.add(k); found.push(s); } }
      if (inTitle || found.length) hits.push({ it, found: found.length ? found : [it.meta], score: (inTitle ? 2 : 0) + found.length });
    }
    hits.sort((x, y) => y.score - x.score);
    results.innerHTML = hits.length ? '' : `<p class="dex-none">${esc(W('none'))}</p>`;
    for (const { it, found } of hits) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'dex-hit';
      b.append(copyLogo(it.logo));
      const txt = document.createElement('div');
      txt.innerHTML = `<b>${mark(it.title, q)}</b>${found.filter(Boolean).map((s) => `<span>${mark(s, q)}</span>`).join('')}`;
      b.append(txt); b.addEventListener('click', () => open(it)); results.append(b);
    }
  }
  let timer = 0; input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(search, 120); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { input.value = ''; search(); } });

  // the strip moves only while it can be seen
  new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) kick(); }).observe(flow);
  new ResizeObserver(() => place()).observe(flow);
  place();
  // a finished animation can stay a picture drawn at the size it ran at, and turn blurry as its tile grows; once
  // done, its last frame is written onto the element and the animation let go, so the logo is drawn sharp at any size
  function settle(root) {
    if (root.hasAttribute && root.hasAttribute('data-loop')) return;
    root.getAnimations({ subtree: true }).forEach((a) => {
      if (a.playState !== 'finished' || !a.effect || !a.effect.target) return;
      const el = a.effect.target;
      if (!el.hasAttribute('data-dex-style')) el.setAttribute('data-dex-style', el.getAttribute('style') || '');
      // the finished frame as the page draws it (commitStyles wrote a frame from mid-way here), then the animation goes
      const props = new Set(); a.effect.getKeyframes().forEach((k) => Object.keys(k).forEach((p) => { if (!['offset', 'computedOffset', 'easing', 'composite'].includes(p)) props.add(p); }));
      const cs = getComputedStyle(el), end = [...props].map((p) => { const css = p.startsWith('--') ? p : p.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()); return [css, cs.getPropertyValue(css)]; });
      a.cancel(); end.forEach(([p, v]) => el.style.setProperty(p, v));
    });
  }
  function unsettle(root) {
    root.querySelectorAll('[data-dex-style]').forEach((el) => {
      const s = el.getAttribute('data-dex-style'); if (s) el.setAttribute('style', s); else el.removeAttribute('style');
      el.removeAttribute('data-dex-style');
    });
  }
  flow.addEventListener('animationend', (e) => { const t = e.target.closest('.dex-item'); if (t) settle(t); });
  requestAnimationFrame(() => requestAnimationFrame(() => tiles.forEach(settle)));
})();

if (!location.hash && startTab) { go(startTab, { push: false }); if (CARS[startTab] && +startSlide) CARS[startTab].show(+startSlide, false); }
else go(location.hash.slice(1) || DEFAULT, { push: false });
})();
