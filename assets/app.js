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
  panels[i].querySelectorAll('img[loading="lazy"]').forEach(img => { img.loading = 'eager'; });
  if (entered) setTimeout(() => flashNext(panels[i]), reduced ? 0 : 450);
  if (changed) countView(id);
  fitHeight();
  if (push && location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
  if (changed) window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  // Behind the greeting nothing animates yet; entering calls go() again.
  if (!firstShow[id] && entered) { firstShow[id] = true; (onFirstShow[id] || (() => {}))(); }
  playLogos(document, (from > i ? 1 : -1) * (RTL ? -1 : 1), !changed);
}
// Shuin's tile plays the app's splash (a 1 MB SVG, fetched once, the first time it is needed),
// then fades to the stamp. A fresh blob URL per play restarts the splash from its first frame.
let shuinSplash = null;
const PLAYERS = {
  shuin: {
    play(el, still) {
      if (still) return;
      const box = el.querySelector('.shuin-splash');
      const run = ++el._run || (el._run = 1);
      shuinSplash = shuinSplash || fetch('/assets/img/logos/shuin-splash.svg').then(r => r.blob());
      shuinSplash.then(blob => {
        if (run !== el._run || el.closest('[aria-hidden="true"]')) return;
        const img = new Image();
        img.alt = '';
        img.src = URL.createObjectURL(blob);
        img.onload = () => {
          if (run !== el._run) return;
          box.replaceChildren(img);
          el.classList.add('splashing');
          el._t = setTimeout(() => { el.classList.remove('splashing'); URL.revokeObjectURL(img.src); }, 8200);
        };
      }).catch(() => {});
    },
    reset(el) { el._run = (el._run || 0) + 1; clearTimeout(el._t); el.classList.remove('splashing'); },
  },
  // RealStage: SMIL morphs, begun after a pause; removing a frozen morph puts its field back across
  plug: {
    play(el, still) {
      const run = () => el.querySelectorAll('animate').forEach(a => a.beginElement());
      if (still) { run(); el.querySelectorAll('animate').forEach(a => a.endElement()); return; }
      el._t = setTimeout(run, 900);
    },
    reset(el) {
      clearTimeout(el._t);
      el.querySelectorAll('animate').forEach(a => a.replaceWith(a.cloneNode()));
    },
  },
};
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
// Draw the eye to the next project when a tab holds more than one.
function flashNext(panel) {
  const card = panel.querySelector('.wrap > .glass.card');
  const dots = card && card.querySelector(':scope > .dots');
  const btn = card && card.querySelector(':scope > .card-head .arrow:last-child');
  if (!btn || !dots || dots.children.length < 2 || btn.disabled) return;
  btn.classList.remove('rainbow'); void btn.offsetWidth; btn.classList.add('rainbow');
}
tabs.forEach(t => t.addEventListener('click', () => go(t.dataset.tab)));
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
    ring.style.left = (a.left - b.left + thumb / 2 + f * (a.width - thumb)) + 'px'; ring.style.top = (a.top - b.top + a.height / 2) + 'px';
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

/* ================= project images and the viewer ================= */
// Each .thumbs lists its images as "file|caption;file|caption". Thumbnails load small;
// the click opens the full image. An entry with no file is an empty slot for a later image.
const lb = $('#lightbox'), lbImg = $('#lbImg'), lbCap = $('#lbCap');
let lbSet = [], lbAt = 0, lbFrom = null;
$$('.thumbs').forEach(box => {
  const set = box.dataset.imgs.split(';').map(s => { const [f, c, ar] = s.split('|'); return { f: f.trim(), c: (c || '').trim(), ar: +ar || 0 }; });
  const row = box.classList.contains('row');
  // A row keeps each image's proportions; capped so two phone screenshots do not grow huge.
  if (row) box.style.maxWidth = Math.round(set.reduce((t, s) => t + (s.ar || 1), 0) * 420) + 'px';
  box.innerHTML = set.map((s, k) => s.f
    ? `<button class="thumb" type="button" data-k="${k}"${row ? ` style="flex:${s.ar || 1} 1 0"` : ''} aria-label="${t('Open image: {c}', { c: s.c })}"><img src="/assets/img/projects/thumbs/${s.f}.jpg" alt="${s.c}" loading="lazy" decoding="async"></button>`
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
  } else lbImg.src = s.src || `/assets/img/projects/${s.f}.jpg`;
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
  // First "Hello.", which fades away; then the greeting for the visitor's time of day, then
  // the name, the welcome and the hint. A click at any moment still enters.
  const el = $('#greetHello');
  const words = (t) => t.split(' ').map((w, k) => `<span style="animation-delay:${.15 + k * .22}s">${w}</span>`).join(' ');
  // The greeting appears at its own slow pace; once all of it is there (and the page has loaded), it moves on.
  const loaded = new Promise(r => { if (document.readyState === 'complete') r(); else addEventListener('load', r, { once: true }); setTimeout(r, 3000); });
  const second = () => {
    el.classList.remove('out'); el.innerHTML = words(hello); greet.classList.add('p2');
    Promise.all([loaded, new Promise(r => setTimeout(r, reduced ? 0 : 1700))]).then(() => setTimeout(enter, 150));
  };
  if (reduced) second();
  else {
    el.innerHTML = words(t('Hello.'));
    setTimeout(() => el.classList.add('out'), 1250);
    setTimeout(second, 1950);
  }
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

/* ================= light and dark ================= */
// The OS decides until the visitor presses the button; that choice is then remembered.
const darkOS = matchMedia('(prefers-color-scheme: dark)');
const savedTheme = () => { try { return localStorage.getItem('theme'); } catch (_) { return null; } };
function applyTheme(t) { document.documentElement.setAttribute('data-theme', t); }
$('#themeBtn').addEventListener('click', () => {
  const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(t);
  try { localStorage.setItem('theme', t); } catch (_) {}
});
darkOS.addEventListener('change', e => { if (!['light', 'dark'].includes(savedTheme())) applyTheme(e.matches ? 'dark' : 'light'); });

/* ================= contact, privacy and cookies: one popover open at a time ================= */
const pops = [[$('#contactBtn'), $('#contactPop')], [$('#cookieBtn'), $('#privacyPop')], [$('#langBtn'), $('#langPop')]];
// a flag keeps the tab you are on, and the next page skips the greeting: you are already here
$$('#langPop a').forEach(a => a.addEventListener('click', () => {
  a.href = a.getAttribute('href').split('#')[0] + (location.hash || '');
  try { sessionStorage.setItem('langSwitch', '1'); } catch (_) {}
}));
// Each menu drops from under its own button: right-aligned to the button where there is room,
// kept 12px inside the screen otherwise, with the notch pointing at the button's centre.
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
  hint.textContent = t(matchMedia('(hover: none)').matches ? 'Tap for the last line' : 'Click for the last line');
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

// On a computer a project card scrolls inside itself and the page around it does not; a wheel turned on the card's
// margins, beside a model, or on the page around the card scrolls the card's project too, instead of doing nothing
addEventListener('wheel', (e) => {
  if (e.ctrlKey || !document.documentElement.classList.contains('fit-tab') || !e.target.closest) return;
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
$$('.b8-build:not(.city-build)').forEach(fig => {
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

/* ================= archive: the map ================= */
const W = window.WW;
const byCountry = d3.group(W.places, p => p.country);
$('#sPlaces').textContent = W.places.length;
$('#sCountries').textContent = byCountry.size;
$('#sVideos').textContent = W.total;
if (W.first && W.first.date) {
  const d = new Date(W.first.date + 'T12:00:00Z');
  $('#sFirst').textContent = d.toLocaleDateString(LOCALE, { month: matchMedia('(max-width:760px)').matches ? 'short' : 'long', year: 'numeric' });
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
    const land ={ type: 'FeatureCollection', features: feats.filter(f => f.properties.name !== 'Antarctica') };
    feats = land.features;

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
      // Fit to the latitudes people live in; the far south is empty ocean and ice.
      const frame = { type: 'MultiPoint', coordinates: [[-168, 76], [0, 80], [178, 76], [-168, -46], [0, -46], [178, -46]] };
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
      ? `${before}<a href="https://www.youtube.com/playlist?list=${W.playlists[country]}" target="_blank" rel="noopener">${t('Go to playlist')}</a>` : '';
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
  }).catch(() => { $('.loading', host).textContent = t('The map could not be loaded. Please reload the page.'); });
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
    tile.innerHTML = '<img src="/assets/img/logos/wandering-wayfarer.jpg" width="512" height="512" alt="" decoding="async">';
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
  function place() {
    const g = GAP(), TILE = flow.clientWidth < 520 ? 56 : 64;
    tiles.forEach((t, i) => {
      const d = wrap(i - pos), a = Math.abs(d);
      const x = d * g * (1 - Math.min(a, 4) * .07), s = 1.14 - Math.min(a, 3.5) * .15;
      // each tile is drawn at its own size, not scaled as a picture, so every logo stays sharp; the far ones fade
      t.style.setProperty('--sz', (TILE * s).toFixed(1) + 'px');
      t.style.transform = `translate(-50%, -50%) translateX(${x.toFixed(1)}px)`;
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
  // once the strip rests, the logo in the middle plays as it does on the project's page
  function play(i) {
    played = i;
    const logo = tiles[i].querySelector('.logo');
    logo.classList.remove('dex-still'); unsettle(logo);
    [...(logo.matches('.anim-logo') ? [logo] : []), ...logo.querySelectorAll('.anim-logo')].forEach((svg) => {
      svg.classList.remove('play');
      const player = PLAYERS[svg.dataset.player];
      if (player) { player.reset(svg); player.play(svg, reduced); return; }
      svg.style.setProperty('--dir', -1); void svg.getBoundingClientRect(); svg.classList.add('play');
    });
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
