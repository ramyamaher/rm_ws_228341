// Refreshes assets/data/places.js from the Wandering Wayfarer channel: the count of all
// videos and shorts, the places they were filmed in, one video per place, and the playlist of
// each country. Run daily by .github/workflows/update-channel.yml, or by hand:
//     node scripts/update-channel.mjs
// No API key: it uses the same public endpoints the YouTube website itself calls.
//
// A video's place is the location set on it in YouTube Studio (the pin above the title on its
// page), grouped by that location's Google Place ID. Only a video with no location set falls
// back to scripts/place-rules.mjs, which reads the place from the title.
// What was read is kept in scripts/channel-cache.json, so a day's run asks YouTube only about
// new videos and a rolling share of the older ones (a location changed later still comes
// through within about two weeks), and asks OpenStreetMap only about places it has not seen.
// A place is looked up once; one found in the wrong spot can be corrected by hand in that
// file's "places" section (each video there carries its title, to see what it is).
import { writeFile, readFile } from 'node:fs/promises';
import { RULES, PLAYLIST_ALIASES, PLACE_FIXES } from './place-rules.mjs';

const CHANNEL = 'UCDRz8yeFDCXvv6AOuUssFmg';
const OUT = new URL('../assets/data/places.js', import.meta.url);
const CACHE = new URL('./channel-cache.json', import.meta.url);
const CONTEXT = { client: { clientName: 'WEB', clientVersion: '2.20261002.01.00', hl: 'en', gl: 'CH' } };
const RECHECK = 40;   // older videos asked about again each day

async function youtube(endpoint, body) {
  const r = await fetch(`https://www.youtube.com/youtubei/v1/${endpoint}?prettyPrint=false`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: 'SOCS=CAI', 'user-agent': 'Mozilla/5.0' },
    body: JSON.stringify({ context: CONTEXT, ...body }),
  });
  if (!r.ok) throw new Error(`YouTube answered ${r.status}`);
  return r.json();
}
const browse = (body) => youtube('browse', body);
// The "load more" token. On the playlists page it sits in a continuationItemRenderer and a
// second token belongs to the sort menu; on the uploads playlist it is the only token and is
// not wrapped. So: the wrapped one if there is one, otherwise the first on the page.
const TOKEN = /"continuationCommand":\{"token":"([^"]+)"/;
function lastToken(o) {
  let tok = null;
  (function walk(x) {
    if (tok || !x || typeof x !== 'object') return;
    if (x.continuationItemRenderer) {
      const m = JSON.stringify(x.continuationItemRenderer).match(TOKEN);
      if (m) tok = m[1];
    }
    for (const k in x) walk(x[k]);
  })(o);
  return tok || (JSON.stringify(o).match(TOKEN) || [])[1] || null;
}
const text = (t) => (t?.runs ? t.runs.map((r) => r.text).join('') : t?.simpleText || t?.content || '');

/* Every upload, videos and shorts alike, lives in the channel's "uploads" playlist (UU...). */
async function uploads() {
  const out = new Map();
  const take = (o) => {
    if (!o || typeof o !== 'object') return;
    // YouTube serves either the older renderer or the newer "lockup"; accept both.
    if (o.playlistVideoRenderer) out.set(o.playlistVideoRenderer.videoId, text(o.playlistVideoRenderer.title));
    const l = o.lockupViewModel;
    if (l && /^[\w-]{11}$/.test(l.contentId || '')) out.set(l.contentId, text(l.metadata?.lockupMetadataViewModel?.title));
    for (const k in o) take(o[k]);
  };
  let r = await browse({ browseId: 'VLUU' + CHANNEL.slice(2) });
  take(r);
  for (let tok = lastToken(r), n = 0; tok && n < 60; n++) {
    r = await browse({ continuation: tok });
    const before = out.size; take(r);
    const next = lastToken(r);
    if (next === tok || out.size === before) break;
    tok = next;
  }
  return [...out].map(([id, t]) => ({ id, t }));
}

async function playlists() {
  const out = new Map();
  const take = (o) => {
    if (!o || typeof o !== 'object') return;
    if (o.lockupViewModel?.contentId?.startsWith('PL')) out.set(o.lockupViewModel.contentId, text(o.lockupViewModel.metadata?.lockupMetadataViewModel?.title));
    for (const k in o) take(o[k]);
  };
  let r = await browse({ browseId: CHANNEL, params: 'EglwbGF5bGlzdHPyBgoKCEIGCgIQaCIA' });
  take(r);
  for (let tok = lastToken(r), n = 0; tok && n < 20; n++) {
    r = await browse({ continuation: tok });
    const before = out.size; take(r);
    if (out.size === before) break;
    tok = lastToken(r);
  }
  return [...out].map(([id, t]) => ({ id, t }));
}

// The location set on a video: the pin link above its title, a search for videos tagged with
// that place. Its params carry the place's Google Place ID.
// Returns { q, pid } or null when the video has no location; throws when the page did not
// come back as a video page, so a refusal is never taken for "no location".
async function locationOf(id) {
  const r = await youtube('next', { videoId: id });
  let pin = null, page = false;
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    if (o.videoPrimaryInfoRenderer) page = true;
    const s = o.superTitleLink?.runs?.[0]?.navigationEndpoint?.searchEndpoint;
    if (s && o.superTitleIcon?.iconType === 'LOCATION_PIN' && !pin) pin = s;
    for (const k in o) walk(o[k]);
  })(r);
  if (!page) throw new Error('not a video page');
  if (!pin) return null;
  let pid = null;
  try {
    pid = (Buffer.from(decodeURIComponent(pin.params), 'base64').toString('latin1').match(/[\w-]{20,}/) || [])[0];
  } catch (_) { /* the name alone still places it */ }
  return { q: pin.query, pid: pid || 'q:' + pin.query.toLowerCase() };
}

// Countries as the site names them: the UK's nations each on their own, and the owner's rules
const COUNTRY = { 'United States of America': 'United States', Israel: 'Palestine', 'Palestinian Territory': 'Palestine', 'Western Sahara': 'Morocco', 'Sahrawi Arab Democratic Republic': 'Morocco', Czechia: 'Czech Republic', 'Northern Cyprus': 'Cyprus', 'Turkish Republic of Northern Cyprus': 'Cyprus', 'Türkiye': 'Turkey', Gibraltar: 'Gibraltar | UK' };
const UK = { England: 'England | UK', Scotland: 'Scotland | UK', Wales: 'Wales | UK', 'Northern Ireland': 'Northern Ireland | UK' };
function countryOf(a) {
  if (a.country === 'United Kingdom') return UK[a.state] || 'England | UK';
  return COUNTRY[a.country] || a.country;
}
let lastAsk = 0;
// Where a place is: OpenStreetMap's best match for its name, preferring one in the country the
// video's title points to, if it points to one (one question a second, as their rules ask)
async function osm(q) {
  await new Promise((r) => setTimeout(r, Math.max(0, lastAsk + 1100 - Date.now())));
  lastAsk = Date.now();
  const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&addressdetails=1&accept-language=en&q=' + encodeURIComponent(q), {
    headers: { 'user-agent': 'ramymaher.com Wandering Wayfarer map (https://ramymaher.com)' },
  });
  if (!r.ok) throw new Error(`OpenStreetMap answered ${r.status}`);
  return (await r.json()).filter((h) => h.address?.country);
}
// hint: { country, state, near: [lat, lon] of a city the titles name }. Of the matches in that
// country (and state), the one nearest that city; when none is near, the name is asked for
// together with the state or the city
const km = (a, b) => Math.hypot(a[0] - b[0], (a[1] - b[1]) * Math.cos(a[0] * Math.PI / 180)) * 111;
async function geocode(q, { country, state, near, city } = {}) {
  const fits = (h) => (!country || countryOf(h.address) === country) && (!state || h.address.state === state);
  const pick = (hits) => {
    const ok = hits.filter(fits);
    if (near) ok.sort((a, b) => km(near, [+a.lat, +a.lon]) - km(near, [+b.lat, +b.lon]));
    return ok.find((h) => !near || km(near, [+h.lat, +h.lon]) < 120) || null;
  };
  let hits = await osm(q), best = pick(hits);
  if (!best && (state || city)) best = pick(await osm(`${q}, ${state || city}`));
  if (!best && country) best = (await osm(`${q}, ${country.replace(' | UK', '')}`)).find(fits);
  best ||= hits.find(fits) || hits[0];
  if (!best) return null;
  return { name: q, country: countryOf(best.address), lat: +(+best.lat).toFixed(4), lon: +(+best.lon).toFixed(4) };
}
// The place a title names, by the old rules: for videos with no location, and as a hint
const RX = RULES.map(([name, country, lat, lon, re, cs]) => ({ name, country, lat, lon, ri: new RegExp(re, 'i'), rc: cs ? new RegExp(cs) : null }));
const byTitle = (t) => RX.filter((r) => r.ri.test(t) || (r.rc && r.rc.test(t)));
// the country a title names: "Galway | Ireland - ...", or the country of a place the rules know
const NAMED = [...new Set([...RX.map((r) => r.country), ...Object.values(COUNTRY), 'Australia', 'Canada', 'Greece', 'Austria', 'Netherlands', 'Belgium', 'Denmark', 'Sweden'])];
const countryIn = (t) => {
  const parts = t.split(/\s[|\-–]\s|\s#/).map((s) => s.trim().toLowerCase());
  const named = NAMED.find((c) => parts.includes(c.replace(' | UK', '').toLowerCase()) || (c === 'United States' && parts.some((s) => s === 'usa')));
  return named || byTitle(t)[0]?.country;
};
const STATES = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'];
const stateIn = (t) => { const parts = t.split(/\s[|\-–]\s/).map((s) => s.trim()); return STATES.find((s) => parts.includes(s)); };
// what a place's videos' titles say about where it is: the country, the US state and a city
// they name most often
function hintOf(titles) {
  const most = (xs) => { const n = {}; xs.filter(Boolean).forEach((x) => { n[x] = (n[x] || 0) + 1; }); return Object.keys(n).sort((a, b) => n[b] - n[a])[0]; };
  const country = most(titles.map(countryIn)), state = country === 'United States' ? most(titles.map(stateIn)) : undefined;
  const cities = titles.flatMap(byTitle).filter((r) => !country || r.country === country), city = most(cities.map((r) => r.name));
  const r = cities.find((c) => c.name === city);
  return { country, state, city, near: r && [r.lat, r.lon] };
}

const videos = await uploads();
// A sudden drop means YouTube changed its format or refused us, not that videos vanished.
const previous = Number(((await readFile(OUT, 'utf8').catch(() => '')).match(/"?total"?: (\d+)/) || [])[1] || 0);
if (videos.length < 100 || videos.length < previous * 0.9) throw new Error(`Only ${videos.length} uploads came back (last run: ${previous}); keeping the old data.`);

const cache = JSON.parse(await readFile(CACHE, 'utf8').catch(() => '{}'));
cache.videos ||= {}; cache.places ||= {};
const today = new Date().toISOString().slice(0, 10);

// Ask about every video not seen before, and the ones asked about longest ago
const fresh = videos.filter((v) => !cache.videos[v.id]);
const old = videos.filter((v) => cache.videos[v.id]).sort((a, b) => (cache.videos[a.id].checked < cache.videos[b.id].checked ? -1 : 1)).slice(0, RECHECK);
const ask = [...fresh, ...old];
let failed = 0;
for (let i = 0; i < ask.length; i += 6) {
  await Promise.all(ask.slice(i, i + 6).map(async (v) => {
    try {
      const loc = await locationOf(v.id);
      cache.videos[v.id] = loc ? { ...loc, checked: today } : { checked: today };
    } catch (_) { failed++; }
  }));
}
if (ask.length && failed > ask.length / 2) throw new Error(`YouTube refused ${failed} of ${ask.length} video pages; keeping the old data.`);

// Find each place not yet known, in the country most of its videos' titles name
const titled = new Map();
for (const v of videos) {
  const c = cache.videos[v.id];
  if (!c) continue;
  c.t = v.t;
  if (c.pid) (titled.get(c.pid) || titled.set(c.pid, { q: c.q, titles: [] }).get(c.pid)).titles.push(v.t);
}
for (const [pid, { q, titles }] of titled) {
  const fix = PLACE_FIXES[q];
  if (fix) { cache.places[pid] = { name: fix[0], country: fix[1], lat: fix[2], lon: fix[3] }; continue; }
  if (cache.places[pid]) continue;
  try { const p = await geocode(q, hintOf(titles)); if (p) cache.places[pid] = p; }
  catch (e) { console.log(`Could not place "${q}": ${e.message}`); }
}

// Count the videos of each place, newest first, so each place shows its latest video
const places = new Map();
const add = (key, p, id) => {
  const e = places.get(key);
  if (e) e.n++; else places.set(key, { name: p.name, country: p.country, lat: p.lat, lon: p.lon, n: 1, v: id });
};
const untagged = [], unmapped = [];
for (const v of videos) {
  const c = cache.videos[v.id], p = c?.pid && cache.places[c.pid];
  if (p) { add(p.name + '|' + p.country, p, v.id); continue; }
  untagged.push(v.t);
  const hits = byTitle(v.t);
  if (!hits.length) unmapped.push(v.t);
  hits.forEach((h) => add(h.name + '|' + h.country, h, v.id));
}

// A country playlist is one whose title, without flags and emoji, is exactly a country we film in.
const all = [...places.values()];
const countries = new Set(all.map((p) => p.country));
const lists = {};
for (const p of await playlists()) {
  const clean = p.t.replace(/[^\p{L}\p{N} .|]/gu, '').trim();
  const name = PLAYLIST_ALIASES[clean] || clean;
  if (countries.has(name) && !lists[name]) lists[name] = p.id;
}

// The uploads list runs newest first, so the last entry is the first video ever posted.
// Its date is read from the video's own page.
const firstVideo = videos[videos.length - 1];
let firstDate = null;
try {
  const page = await (await fetch(`https://www.youtube.com/watch?v=${firstVideo.id}`, { headers: { cookie: 'SOCS=CAI', 'user-agent': 'Mozilla/5.0', 'accept-language': 'en' } })).text();
  const m = page.match(/"(?:uploadDate|publishDate)":"(\d{4}-\d{2}-\d{2})/) || page.match(/itemprop="(?:uploadDate|datePublished)" content="(\d{4}-\d{2}-\d{2})/);
  if (m) firstDate = m[1];
} catch (_) { /* keep null; the page falls back to the last known date */ }
if (!firstDate) {
  const prev = (await readFile(OUT, 'utf8').catch(() => '')).match(/"first": \{[^}]*"date": "(\d{4}-\d{2}-\d{2})"/);
  if (prev) firstDate = prev[1];
}

// the cache keeps only videos still on the channel
const live = new Set(videos.map((v) => v.id));
for (const id in cache.videos) if (!live.has(id)) delete cache.videos[id];
const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
await writeFile(CACHE, JSON.stringify({ videos: sorted(cache.videos), places: sorted(cache.places) }, null, 1) + '\n');

const body = `/* Generated by scripts/update-channel.mjs on ${today}. Do not edit by hand: run it again.
   ${videos.length} videos and shorts; ${videos.length - untagged.length} placed by their location, ${untagged.length - unmapped.length} by their title, ${unmapped.length} not placed. */
window.WW = ${JSON.stringify({ channel: 'https://www.youtube.com/@WanderingWayfarer', updated: today, total: videos.length, first: { id: firstVideo.id, date: firstDate }, places: all, playlists: lists }, null, 1)};
`;

const before = await readFile(OUT, 'utf8').catch(() => '');
const strip = (s) => s.replace(/on \d{4}-\d{2}-\d{2}/, '').replace(/"updated": "[^"]+"/, '');
if (strip(before) === strip(body)) console.log('No change on the channel.');
else { await writeFile(OUT, body); console.log(`Updated: ${videos.length} uploads, ${all.length} places, ${countries.size} countries, ${Object.keys(lists).length} playlists.`); }
console.log(`Asked about ${ask.length} videos (${fresh.length} new), ${failed} failed.`);
if (untagged.length) console.log(`Videos with no location (${untagged.length}), placed by title where it names a place:\n  ` + untagged.join('\n  '));
