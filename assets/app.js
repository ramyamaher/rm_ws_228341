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

// Building 8 in 3D: the hall and the bar's boards, from the Rhino model (1 unit = 5 cm); the doors, the metal
// stair, the bridge and the ramp's railings are added after the render. three.js and the model (60 kB) load only
// when it first comes into view; the slider drops the boards into place, lowest layer first
$$('.b8-build').forEach(fig => {
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
    const ren = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    ren.setPixelRatio(Math.min(2, devicePixelRatio)); box.append(ren.domElement);
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(34, 1, 1, 3000);
    cam.position.set(-45, 95, -255);   // from the ramp, looking at the glass front, as in the render
    const ctl = new OrbitControls(cam, ren.domElement);
    ctl.target.set(78, 18, -40); ctl.enablePan = false; ctl.maxPolarAngle = Math.PI * .47; ctl.minDistance = 60; ctl.maxDistance = 520; ctl.update();
    scene.add(new THREE.HemisphereLight('#ffffff', '#b9b2a8', 1.1));
    const sun = new THREE.DirectionalLight('#fff6e8', 1.6); sun.position.set(-120, 260, -60); scene.add(sun);
    const mat = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide, ...o });
    const M = { floor: mat('#e9e7e3'), upper: mat('#dcd9d4'), red: mat('#c4533c'), wood: mat('#c9a26b'), frame: mat('#a98552'), metal: mat('#4a505a'), board: mat('#b98a56'), moving: mat('#e3120b'), waiting: mat('#d9c6ad', { transparent: true, opacity: .55 }) };
    const P = (x, y, z) => [x, z, -y];                           // the model's plan x, y and height z, in three's axes
    const solid = (parts, m) => parts.forEach(s => { const g = new THREE.BufferGeometry(); const p = []; for (let i = 0; i < s.pos.length; i += 3) p.push(...P(s.pos[i], s.pos[i + 1], s.pos[i + 2])); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(s.idx); g.computeVertexNormals(); scene.add(new THREE.Mesh(g, m)); });
    const boxM = (x0, x1, y0, y1, z0, z1, m) => { const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0), Math.abs(y1 - y0)); const o = new THREE.Mesh(g, m); o.position.set((x0 + x1) / 2, (z0 + z1) / 2, -(y0 + y1) / 2); scene.add(o); return o; };
    const S = data.solids;
    // the hall: floors, the steps to the upper level, the ramp, and the red wall with its two door openings
    solid([...S[56], ...S[40], ...S[55]], M.floor); solid([...S[43], ...S[45], ...S[46], ...S[48]], M.upper);
    solid([...S[51], ...S[52], ...S[53], ...S[54]], M.floor); solid(S[41], M.red);
    // the doors: a frame and two wooden leaves in each opening
    for (const [y0, y1, z1] of [[76.7, 111.2, 56.87], [-33.1, 1.4, 53.65]]) {
      boxM(141, 146.7, y0, y0 + 1.6, 0, z1, M.frame); boxM(141, 146.7, y1 - 1.6, y1, 0, z1, M.frame); boxM(141, 146.7, y0, y1, z1 - 1.6, z1, M.frame);
      const ym = (y0 + y1) / 2; boxM(143.2, 144.4, y0 + 1.6, ym - .2, 0, z1 - 1.6, M.wood); boxM(143.2, 144.4, ym + .2, y1 - 1.6, 0, z1 - 1.6, M.wood);
    }
    // the metal stair against the red wall: up from the upper level, a landing, and back up over the first door
    const steel = (x0, x1, y0, y1, z0, z1) => boxM(x0, x1, y0, y1, z0, z1, M.metal);
    const flight = (x0, x1, yA, zA, yB, zB, n, side) => {
      for (let k = 0; k < n; k++) { const f0 = k / n, f1 = (k + 1) / n, ya = yA + (yB - yA) * f0, yb = yA + (yB - yA) * f1, z = zA + (zB - zA) * f1; steel(x0, x1, Math.min(ya, yb), Math.max(ya, yb), z - .8, z); }
      const L = Math.hypot(yB - yA, zB - zA), ang = Math.atan2(zB - zA, Math.abs(yB - yA)), dir = Math.sign(yB - yA);
      for (const x of [x0 - .6, x1 + .6]) { const g = new THREE.BoxGeometry(1.2, 2.2, L); const o = new THREE.Mesh(g, M.metal); o.position.set(x, (zA + zB) / 2 - 1.5, -(yA + yB) / 2); o.rotation.x = dir * ang; scene.add(o); }
      // the railing on the open side: posts and a handrail 20 units (1 m) above the treads
      const xr = side < 0 ? x0 - .6 : x1 + .6;
      for (let k = 0; k <= n; k += 2) { const f = k / n, y = yA + (yB - yA) * f, z = zA + (zB - zA) * f; steel(xr - .25, xr + .25, y - .25, y + .25, z, z + 20); }
      const g = new THREE.BoxGeometry(.7, .7, L); const o = new THREE.Mesh(g, M.metal); o.position.set(xr, (zA + zB) / 2 + 20, -(yA + yB) / 2); o.rotation.x = dir * ang; scene.add(o);
    };
    flight(129, 140, 165, 12, 124, 36, 8, -1);
    steel(115, 140, 112, 124, 35.2, 36);
    flight(115, 126, 112, 36, 70, 60, 8, -1);
    steel(115, 140, 58, 70, 59.2, 60);
    // the bridge across the glass front, and its railings
    steel(-22, 141, -52, -44, 58.8, 60);
    for (const y of [-52, -44]) { for (let x = -22; x <= 141; x += 6) steel(x - .25, x + .25, y - .25, y + .25, 60, 80); steel(-22, 141, y - .35, y + .35, 79.6, 80.4); }
    // the glass front, with its steel grid
    boxM(-22, 146.7, -59.6, -59.2, 0, 94.6, new THREE.MeshLambertMaterial({ color: '#cfe3ee', transparent: true, opacity: .28, side: THREE.DoubleSide, depthWrite: false }));
    for (let x = -22; x <= 146.7; x += 21) steel(x - .5, x + .5, -59.8, -59, 0, 94.6);
    for (const z of [0, 26, 46, 58.8, 76, 94]) steel(-22, 146.7, -59.8, -59, z, z + .9);
    // the railings round the ramp, on both sides, 1 m above its slope
    const rampZ = (y) => -1.11 + (12 + 1.11) * (y + 14.2) / (186 + 14.2);
    for (const x of [0.4, -22.1]) {
      for (let y = -14.2; y <= 186; y += 8) { const z = rampZ(y); steel(x - .25, x + .25, y - .25, y + .25, z, z + 20); }
      const L = Math.hypot(200.2, 13.1), ang = Math.atan2(13.1, 200.2), g = new THREE.BoxGeometry(.7, .7, L), o = new THREE.Mesh(g, M.metal);
      o.position.set(x, (rampZ(-14.2) + rampZ(186)) / 2 + 20, -(186 - 14.2) / 2); o.rotation.x = ang; scene.add(o);
    }
    // the boards: each outline extruded to its thickness, with a fine line round each layer so the layers read
    const levels = [...new Set(data.boards.map(b => b.z))].sort((a, b) => a - b);
    const lineMat = new THREE.LineBasicMaterial({ color: '#6b4a26', transparent: true, opacity: .45 });
    const boards = data.boards.map(b => {
      const shape = (L) => { const pts = []; for (let i = 0; i < L.length; i += 2) pts.push(new THREE.Vector2(L[i], L[i + 1])); return pts; };
      const s = new THREE.Shape(shape(b.loops[0])); for (const L of b.loops.slice(1)) s.holes.push(new THREE.Path(shape(L)));
      const g = new THREE.ExtrudeGeometry(s, { depth: b.h, bevelEnabled: false, curveSegments: 1 }); g.rotateX(-Math.PI / 2);
      const grp = new THREE.Group(), mesh = new THREE.Mesh(g, M.board); grp.add(mesh); grp.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 25), lineMat));
      grp.position.y = b.z; scene.add(grp);
      return { grp, mesh, z: b.z, k: levels.indexOf(b.z) };
    });
    const N = levels.length, ease = (p) => p * p * (3 - 2 * p);
    function place() {
      const t = range.value / 1000; let done = 0;
      for (const b of boards) {
        const p = ease(Math.min(1, Math.max(0, (t * (N + 2) - b.k) / 2.5)));
        b.grp.position.y = b.z + (1 - p) * (16 + b.k * 1.4);
        b.mesh.material = p >= 1 ? M.board : p > 0 ? M.moving : M.waiting;
        if (p >= 1) done++;
      }
      out.value = out.textContent = done + ' / ' + boards.length;
      draw();
    }
    let raf = 0; function draw() { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => ren.render(scene, cam)); }
    function size() { const r = box.getBoundingClientRect(); if (!r.width) return; ren.setSize(r.width, r.height); cam.aspect = r.width / r.height; cam.fov = 34 * Math.pow(Math.max(1, 1.3 / cam.aspect), .8); cam.updateProjectionMatrix(); draw(); }
    ctl.addEventListener('change', draw);
    range.addEventListener('input', place);
    new ResizeObserver(size).observe(box);
    size(); place();
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
