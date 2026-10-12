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
    if (svg.closest('[aria-hidden="true"]')) return;
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
    ren.domElement.style.touchAction = 'pan-y';
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
    let shown = +range.value, raf = 0;
    function paint() { out.value = out.textContent = shown + ' / ' + boards.length; }
    function tick() {
      let moving = false;
      for (const b of boards) {
        if (b.leaving) { b.off += (DROP - b.off) * .28; if (b.off > DROP - .5) { b.leaving = false; b.vis = false; b.off = 0; } else moving = true; }
        else if (b.off > .02) { b.off *= .75; moving = true; } else b.off = 0;
        const lit = b.off > .05; b.meshes.forEach((m) => { m.material = lit ? b.lit.face : WHITE; }); b.lns.forEach((l) => { l.material = lit ? b.lit.line : EDGE; });
        b.grp.visible = b.vis; b.grp.position.y = b.z + b.off;
      }
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
    range.addEventListener('input', () => set(+range.value));
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

// The visitors' way through the pavilion, in the plan's percent (x is stretched by 2.14, the plan's proportion).
// The past: in from the entrance, round the corridor to the labyrinth's door. The present: through the labyrinth, where
// visitors scatter into its side passages and wait for each other at the way out. Elysium: round the table and out.
const VB_FLOW = (() => {
  const P = pts => pts.map(([x, y]) => [x * 2.14, y]);
  const IN = [[93, 38], [88.6, 38]], OUT = [[74.2, 24], [70, 24]];
  const A = [[88.6, 22.9], [76.9, 22.9], [76.9, 27.8], [82.4, 27.8], [82.4, 33.6], [79.3, 33.6], [79.3, 61.4], [71.7, 61.4], [71.7, 31.4], [74.2, 31.4]];
  return {
    1: { stream: P([[46, 99], [46, 69], [6.9, 69], [6.9, 15.3], [93, 15.3], [93, 38], [90.2, 38]]) },
    2: {
      routes: [
        [...IN, ...A, ...OUT],
        [...IN, [88.6, 62.4], [85.9, 62.4], [85.9, 27.8], ...A.slice(3), ...OUT],
        [...IN, ...A.slice(0, 3), [84.2, 27.8], [84.2, 62.4], [82, 62.4], [82, 39], [82, 62.4], [84.2, 62.4], [84.2, 33.6], ...A.slice(5), ...OUT],
        [...IN, ...A, [74.2, 57.6], [76.7, 57.6], [76.7, 33], [76.7, 57.6], [74.2, 57.6], ...OUT],
      ].map(P),
      tail: P([[70, 24], [62, 24]]),
    },
    3: { stream: P([[70, 24], [12.5, 24], [12.5, 60], [67, 60], [67, 69], [53, 69], [53, 99]]) },
  };
})();
function vbFlow(svg) {
  const NS = 'http://www.w3.org/2000/svg', V = 15, GAP = 34;   // units a second; spacing in a stream
  const walk = pts => { const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, cum, len: cum[cum.length - 1] }; };
  const at = (w, d) => { d = Math.max(0, Math.min(w.len, d)); let i = 1; while (i < w.cum.length - 1 && w.cum[i] < d) i++; const f = (d - w.cum[i - 1]) / ((w.cum[i] - w.cum[i - 1]) || 1), a = w.pts[i - 1], b = w.pts[i]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; };
  const dot = () => { const g = document.createElementNS(NS, 'g'); g.innerHTML = '<circle class="halo" r="3"/><circle class="core" r="1.3"/>'; svg.append(g); return g; };
  const put = (g, [x, y], o, t) => { g.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`); g.style.opacity = o.toFixed(2); g.firstChild.setAttribute('r', (2.6 + Math.sin(t * 3.2) * .9).toFixed(2)); };
  let raf = 0, step = 0, t0 = 0, items = [];
  function build(s) {
    svg.innerHTML = ''; items = []; step = s; const F = VB_FLOW[s]; if (!F) return;
    if (F.stream) { const w = walk(F.stream), n = Math.max(2, Math.round(w.len / GAP)); for (let k = 0; k < n; k++) items.push({ w, k, n, g: dot() }); }
    else { const ws = F.routes.map(walk), tail = walk(F.tail); ws.forEach(w => items.push({ w, tail, ws, g: dot() })); }
  }
  function frame(now) {
    const t = (now - t0) / 1000, F = VB_FLOW[step];
    if (F.stream) items.forEach(it => {
      const loop = it.w.len + GAP, d = ((t * V - it.k * (loop / it.n)) % loop + loop) % loop;
      put(it.g, at(it.w, d), d > it.w.len ? 0 : Math.min(1, d / 10, (it.w.len - d) / 10), t + it.k);
    });
    else {
      // all leave together, scatter, wait at the way out for the last one, then walk on into the white room together
      const max = Math.max(...items[0].ws.map(w => w.len)), hold = 1.4, tl = items[0].tail.len, cyc = max / V + hold + tl / V + .8, c = t % cyc;
      items.forEach((it, i) => {
        const d = c * V;
        if (d <= max) put(it.g, at(it.w, d), Math.min(1, d / 6), t + i);
        else if (c < max / V + hold) put(it.g, at(it.w, it.w.len), 1, t + i);
        else { const e = (c - max / V - hold) * V; put(it.g, at(it.tail, e), Math.max(0, Math.min(1, (tl + 8 - e) / 8)), t + i); }
      });
    }
    raf = requestAnimationFrame(frame);
  }
  return {
    play(s) { cancelAnimationFrame(raf); raf = 0; build(s); if (VB_FLOW[s]) { t0 = performance.now(); raf = requestAnimationFrame(frame); } },
  };
}

// The story under the plan: each step lights its room on the plan and opens a section below with the room's pictures
// and the words; the last lights the table with the model of Cairo and shows the city built on its empty part
$$('.vb-story').forEach(st => {
  const duo = st.previousElementSibling, plan = $('.vb-plan', duo), flow = vbFlow($('.vb-flow', plan));
  const steps = $('.vb-steps', st), go = $('.vb-go', st), secs = $$('.vb-texts section', st);
  const pic = $('.vb-pic', st), img = $('img', pic), pPrev = $('.vb-pa.prev', st), pNext = $('.vb-pa.next', st);
  const back = $('.vb-back', st), next = $('.vb-next', st), end = $('.vb-end', st), n = $('.vb-n', st);
  const cap = f => { const d = $(`.vb-dot[data-f="${f}"]`, plan); return d ? d.getAttribute('aria-label') : $('h4', secs[st.k]).textContent; };
  const pics = () => secs[st.k].dataset.pics.split(' ');
  function showPic(j) {
    const list = pics(); st.p = (j + list.length) % list.length;
    img.src = `/assets/img/projects/${list[st.p]}.jpg`; img.alt = pic.ariaLabel = cap(list[st.p]);
    pPrev.hidden = pNext.hidden = list.length < 2;
  }
  function show(i) {
    const open = i >= 0; st.k = i; go.hidden = open; steps.hidden = !open;
    if (open) plan.dataset.step = i + 1; else delete plan.dataset.step;
    flow.play(open ? i + 1 : 0);
    if (!open) return;
    secs.forEach((s, j) => s.classList.toggle('on', j === i));
    showPic(0);
    n.textContent = `${i + 1}/${secs.length}`; back.disabled = i <= 0; next.hidden = i === secs.length - 1; end.hidden = !next.hidden;
  }
  go.addEventListener('click', () => { show(0); next.focus({ preventScroll: true }); });
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
  const box = $('.b8-3d', fig), range = $('input', fig), out = $('output', fig), steps = $$('.city-step span', fig);
  let started = false;
  const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting) && !started) { started = true; io.disconnect(); start(); } }, { rootMargin: '200px' });
  io.observe(box);
  const say = (ph) => steps.forEach((s, i) => s.classList.toggle('on', i === ph));
  say(0);
  async function start() {
    const [THREE, { OrbitControls }, { mergeGeometries }, D] = await Promise.all([
      import('https://cdn.jsdelivr.net/npm/three@0.160.0/+esm'),
      import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js/+esm'),
      import('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js/+esm'),
      fetch('/assets/data/cairo-city.json').then(r => r.json()),
    ]);
    const ren = new THREE.WebGLRenderer({ antialias: true });
    ren.setClearColor('#ffffff', 1); ren.setPixelRatio(Math.min(2, devicePixelRatio)); box.append(ren.domElement);
    const [EX, EY] = D.size, scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 10, 20000);
    const ctl = new OrbitControls(cam, ren.domElement);
    cam.position.set(2150, 820, 1350); ctl.target.set(2400, 0, -800);
    ctl.enablePan = false; ctl.minDistance = 400; ctl.maxDistance = 5000; ctl.maxPolarAngle = Math.PI * .46; ctl.update();
    ren.domElement.style.touchAction = 'pan-y';
    const WHITE = new THREE.MeshBasicMaterial({ color: '#fff', polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    // nine thousand buildings: their lines a shade lighter than the other models', or the city reads as grey
    const EDGE = new THREE.LineBasicMaterial({ color: '#aab5c4' }), FAINT = new THREE.LineBasicMaterial({ color: '#d5dce6' });
    const ease = (u) => u * u * (3 - 2 * u);
    // the base, cut at the site's south edge like the render
    { const g = new THREE.BoxGeometry(EX, 30, EY); g.translate(EX / 2, -15, -EY / 2); scene.add(new THREE.Mesh(g, WHITE), new THREE.LineSegments(new THREE.EdgesGeometry(g), EDGE)); }
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
    function set(v) { batches.forEach((b, i) => { b.target = i < v ? 1 : 0; }); out.value = out.textContent = v + ' %'; say(batches[v - 1].ph); kick(); }
    batches.forEach((b, i) => { b.s = b.target = i < +range.value ? 1 : 0; });
    function size() { const r = box.getBoundingClientRect(); if (!r.width) return; ren.setSize(r.width, r.height); cam.aspect = r.width / r.height; cam.fov = 30 * Math.pow(Math.max(1, 1.6 / cam.aspect), .7); cam.updateProjectionMatrix(); kick(); }
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
if (!location.hash && startTab) { go(startTab, { push: false }); if (CARS[startTab] && +startSlide) CARS[startTab].show(+startSlide, false); }
else go(location.hash.slice(1) || DEFAULT, { push: false });
})();
