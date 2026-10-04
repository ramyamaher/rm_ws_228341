(() => {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ================= categories: pills on top, panels slide sideways ================= */
const ORDER = ['about', 'architecture', 'design', 'writing', 'documentation', 'apps'];
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
const ro = new ResizeObserver(fitHeight);
panels.forEach(p => ro.observe(p));

function go(id, { push = true } = {}) {
  if (!ORDER.includes(id)) id = DEFAULT;
  const changed = current !== null && current !== id;
  current = id;
  const i = ORDER.indexOf(id);
  track.style.transform = `translateX(${-i * 100}%)`;
  panels.forEach((p, k) => p.setAttribute('aria-hidden', k === i ? 'false' : 'true'));
  tabs.forEach(t => {
    const on = t.dataset.tab === id;
    t.classList.toggle('on', on);
    t.setAttribute('aria-selected', on);
  });
  fitHeight();
  if (push && location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
  if (changed) window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  if (!firstShow[id]) { firstShow[id] = true; (onFirstShow[id] || (() => {}))(); }
}
tabs.forEach(t => t.addEventListener('click', () => go(t.dataset.tab)));
$$('[data-go]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); go(a.dataset.go); }));
addEventListener('hashchange', () => go(location.hash.slice(1), { push: false }));

/* ================= contact popover ================= */
const cBtn = $('#contactBtn'), pop = $('#contactPop');
const setPop = open => { pop.classList.toggle('open', open); cBtn.setAttribute('aria-expanded', open); };
cBtn.addEventListener('click', e => { e.stopPropagation(); setPop(!pop.classList.contains('open')); });
document.addEventListener('click', e => { if (!pop.contains(e.target)) setPop(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') setPop(false); });

/* ================= carousel with swipe ================= */
function carousel({ car, trackEl, prev, next, count, dots, onChange }) {
  const slides = [...trackEl.children];
  const n = slides.length;
  let i = 0;
  dots.innerHTML = slides.map(() => '<i></i>').join('');
  function show(k, fromUser = true) {
    const old = i;
    i = Math.max(0, Math.min(n - 1, k));
    trackEl.style.transform = `translateX(${-i * 100}%)`;
    count.textContent = `${i + 1}/${n}`;
    prev.disabled = i === 0; next.disabled = i === n - 1;
    [...dots.children].forEach((d, j) => d.classList.toggle('on', j === i));
    slides.forEach((s, j) => s.setAttribute('aria-hidden', j !== i));
    onChange && onChange(i, old, fromUser);
  }
  prev.addEventListener('click', () => show(i - 1));
  next.addEventListener('click', () => show(i + 1));

  let x0 = 0, y0 = 0, dx = 0, down = false, dragging = false, moved = false;
  car.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
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
    const edge = (i === 0 && dx > 0) || (i === n - 1 && dx < 0);
    trackEl.style.transform = `translateX(calc(${-i * 100}% + ${edge ? dx / 3 : dx}px))`;
  });
  const end = () => {
    if (!down) return;
    down = false;
    if (!dragging) return;
    trackEl.classList.remove('drag');
    const w = car.clientWidth;
    if (dx < -Math.min(60, w * .18)) show(i + 1);
    else if (dx > Math.min(60, w * .18)) show(i - 1);
    else show(i, false);
  };
  car.addEventListener('pointerup', end);
  car.addEventListener('pointercancel', end);
  car.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  show(0, false);
  return { show, get index() { return i; } };
}

/* ================= typewriter ================= */
function typer(host, text, { speed = 30, lineGap = 240 } = {}) {
  host.innerHTML = ''; host.classList.add('tw');
  const ghost = document.createElement('div'); ghost.className = 'ghost'; ghost.textContent = text;
  const out = document.createElement('div'); out.className = 'typed';
  const txt = document.createTextNode(''); const caret = document.createElement('span'); caret.className = 'caret';
  out.append(txt, caret); host.append(ghost, out);
  host.setAttribute('aria-label', text);
  let k = 0, timer = null, state = 'idle';
  const t = {
    get state() { return state; },
    start(done) {
      if (state !== 'idle') return;
      if (reduced) { t.finish(); done && done(); return; }
      state = 'typing';
      const step = () => {
        k++; txt.data = text.slice(0, k);
        if (k >= text.length) { state = 'done'; host.classList.add('done'); done && done(); return; }
        const ch = text[k - 1];
        const wait = ch === '\n' ? lineGap : /[,.;]/.test(ch) ? speed * 4 : speed * (0.6 + Math.random() * 0.8);
        timer = setTimeout(step, wait);
      };
      timer = setTimeout(step, 250);
    },
    finish() { clearTimeout(timer); txt.data = text; k = text.length; state = 'done'; host.classList.add('done'); },
  };
  return t;
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
const awardEl = $('#awardText');
const awardTyper = typer(awardEl, awardEl.dataset.text, { speed: 22 });
let writingOpen = false;

const poems = carousel({
  car: $('#poemCar'), trackEl: poemTrack, prev: $('#poemPrev'), next: $('#poemNext'),
  count: $('#poemCount'), dots: $('#poemDots'),
  onChange(i, old) {
    if (old !== i && poemTypers[old].state === 'typing') poemTypers[old].finish();
    if (writingOpen && awardTyper.state === 'done') poemTypers[i].start();
  },
});

/* ================= apps ================= */
carousel({
  car: $('#appCar'), trackEl: $('#appTrack'), prev: $('#appPrev'), next: $('#appNext'),
  count: $('#appCount'), dots: $('#appDots'),
});

/* ================= documentation: the map ================= */
const W = window.WW;
const byCountry = d3.group(W.places, p => p.country);
$('#sPlaces').textContent = W.places.length;
$('#sCountries').textContent = byCountry.size;
$('#sVideos').textContent = W.total;

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
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function initMap() {
  const host = $('#map'), tip = $('#mapTip');
  d3.json('assets/data/countries-50m.json').then(world => {
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
    const land = { type: 'FeatureCollection', features: feats.filter(f => f.properties.name !== 'Antarctica') };
    feats = land.features;

    $('.loading', host).remove();
    const svg = d3.select(host).insert('svg', '.tip').attr('role', 'img')
      .attr('aria-label', `World map of ${W.places.length} places filmed in ${byCountry.size} countries`);
    const layer = svg.append('g');
    const gC = layer.append('g'), gP = layer.append('g');
    const zoom = d3.zoom().scaleExtent([1, 18])
      .filter(e => (e.type === 'wheel' ? e.ctrlKey : !e.button))
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
      if (!list) return `<b>${name}</b><span>Not documented yet</span>`;
      const ps = [...list].sort((a, b) => b.n - a.n);
      const vids = d3.sum(ps, p => p.n);
      return `<b>${name}</b><span>${ps.map(p => p.name).join(' · ')}</span><br><span>${plural(ps.length, 'place')}, ${plural(vids, 'video')}</span>`;
    }
    const cityTip = p => `<b>${p.name}</b><span>${p.country} · ${plural(p.n, 'video')}</span><br>` +
      `<a href="https://www.youtube.com/watch?v=${p.v}" target="_blank" rel="noopener">Watch a video</a>`;
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
  }).catch(() => { $('.loading', host).textContent = 'The map could not be loaded. Please reload the page.'; });
}

/* ================= first visits ================= */
const onFirstShow = {
  writing() {
    writingOpen = true;
    setTimeout(() => awardTyper.start(() => poemTypers[poems.index].start()), reduced ? 0 : 450);
  },
  documentation() { initMap(); },
  apps() { loadAppImages(); },
};
// Slides sit off-screen inside the slider, where lazy loading never fires.
function loadAppImages() { $$('#apps img[loading="lazy"]').forEach(img => { img.loading = 'eager'; }); }
addEventListener('load', () => setTimeout(loadAppImages, 1500));

go(location.hash.slice(1) || DEFAULT, { push: false });
})();
