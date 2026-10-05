// Language versions and project pages for ramymaher.com, generated from index.html.
//
//   node scripts/i18n/build.mjs extract   writes scripts/i18n/source.json: every English phrase
//                                         on the page and in app.js that a translation needs
//   node scripts/i18n/build.mjs           writes /de/, /fr/, /es/, /ar/ and a page for each
//                                         project in every language, plus sitemap.xml
//
// index.html is the English home page and the single source. Run the build after changing it;
// a phrase without a translation stays in English and is listed, so nothing is ever blank.
// Every generated page looks exactly like the home page; it only opens on another tab or
// project, and carries its own title, description, address and share image.
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const HERE = join(ROOT, 'scripts', 'i18n');
const SITE = 'https://ramymaher.com';
const LANGS = ['en', 'de', 'fr', 'es', 'ar'];
const LOCALE = { en: 'en-GB', de: 'de-DE', fr: 'fr-FR', es: 'es-ES', ar: 'ar-EG-u-nu-latn' };   // Arabic with the digits used on the rest of the page
const OG_LOCALE = { en: 'en_GB', de: 'de_DE', fr: 'fr_FR', es: 'es_ES', ar: 'ar_EG' };
const NAME = { en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español', ar: 'العربية' };

// Each project's own address: the tab it is in and its position there. Revitesse has no page
// of its own on purpose: revitesse.com is its page.
const PROJECTS = [
  ['architecture', 0, 'berlin-modern'], ['architecture', 1, 'zweite-stammstrecke'], ['architecture', 2, 'wohnpark-gebersdorf'],
  ['design', 0, 'layers-of-egypt'], ['design', 1, 'extended-threads'], ['design', 2, 'building-8-motion-furniture'],
  ['writing', 0, 'limericks-contest'],
  ['apps', 0, 'shuin'], ['apps', 2, 'bancanca'], ['apps', 3, 'realstage'],
];

// Strings app.js shows (passed through t() there), and the plural words it counts with.
const JS = [
  'Hello.', 'Good morning.', 'Good afternoon.', 'Good evening.', 'Tap anywhere to proceed',
  'Open image: {c}', 'Image to come', 'The numbers are refreshed from the channel every day; last update {d}.',
  'World map of {p} places documented in {c} countries', 'Not documented yet', 'Go to playlist', 'Watch a video',
  'The map could not be loaded. Please reload the page.',
  'England | UK', 'Scotland | UK', 'Wales | UK', 'Northern Ireland | UK', 'Gibraltar | UK',
];
const PLURALS = ['place', 'video'];

/* ---------------- reading the page ---------------- */
// Tokens: comments, whole script/style/svg elements (opaque), tags, and text.
const TOK = /<!--[\s\S]*?-->|<(script|style|svg)\b[\s\S]*?<\/\1>|<[^>]+>|[^<]+/g;
const INLINE = new Set(['a', 'b', 'i', 'em', 'strong', 'span', 'br', 'small', 'sup', 'sub', 'abbr', 'cite', 'q', 'time', 'code', 'u', 's', 'mark', 'wbr']);
const tagName = (tok) => (tok.match(/^<\/?([a-zA-Z][\w-]*)/) || [])[1]?.toLowerCase();
const isText = (tok) => tok[0] !== '<';
const hasWords = (s) => /\p{L}{2,}/u.test(s.replace(/&[a-z]+;|&#\d+;/g, ''));
const KEEP = new Set(['Ramy Maher', 'GitHub', 'LinkedIn', 'YouTube']);

// A unit is a stretch of text and inline markup between block boundaries, trimmed to start and
// end on text. Tags inside it become numbered placeholders, [[0]], [[1]], so a translation can
// move them but never has to copy markup.
function units(html) {
  const out = [];
  const body = html.indexOf('<body');
  const toks = [...html.matchAll(TOK)].map((m) => ({ s: m[0], at: m.index }));
  let run = [];
  const flush = () => {
    let a = 0, b = run.length - 1;
    while (a <= b && !(isText(run[a].s) && run[a].s.trim())) a++;
    while (b >= a && !(isText(run[b].s) && run[b].s.trim())) b--;
    if (a <= b) {
      const seg = run.slice(a, b + 1);
      const tags = [];
      let key = seg.map((t) => (isText(t.s) ? t.s : `[[${tags.push(t.s) - 1}]]`)).join('');
      const lead = key.match(/^\s*/)[0].length, trail = key.match(/\s*$/)[0].length;
      const text = seg.filter((t) => isText(t.s)).map((t) => t.s).join('');
      if (hasWords(text) && !KEEP.has(key.trim())) {
        out.push({ from: seg[0].at, to: seg[seg.length - 1].at + seg[seg.length - 1].s.length, key: key.trim().replace(/\s+/g, ' '), tags, lead, trail, raw: key });
      }
    }
    run = [];
  };
  for (const t of toks) {
    if (t.at < body) continue;
    if (isText(t.s)) { run.push(t); continue; }
    const name = tagName(t.s);
    if (t.s.startsWith('<!--') || name === 'script' || name === 'style') { flush(); continue; }
    // links that simply follow one another (a menu, a row of chips) are separate phrases
    if (name === 'a' && !t.s.startsWith('</')) {
      const last = [...run].reverse().find((x) => !(isText(x.s) && !x.s.trim()));
      if (last && /^<\/a>/i.test(last.s)) flush();
    }
    if (name === 'svg' || INLINE.has(name)) { run.push(t); continue; }
    flush();
  }
  flush();
  return out;
}

// Attributes a visitor reads or hears: alt, aria-label, title, image captions, meta text.
const ATTR = /\s(alt|aria-label|title|placeholder|data-imgs)="([^"]*)"/g;
function attrStrings(html) {
  const list = [];
  for (const m of html.matchAll(ATTR)) {
    if (m[1] === 'data-imgs') m[2].split(';').forEach((e) => { const c = e.split('|')[1]; if (c && hasWords(c)) list.push(c.trim()); });
    else if (hasWords(m[2]) && !KEEP.has(m[2])) list.push(m[2]);
  }
  for (const m of html.matchAll(/<meta (?:name|property)="(description|og:title|og:description|og:image:alt)" content="([^"]*)"/g)) list.push(m[2]);
  list.push(html.match(/<title>([^<]*)<\/title>/)[1]);
  return list;
}

async function placeNames() {
  const s = await readFile(join(ROOT, 'assets', 'data', 'places.js'), 'utf8');
  const w = JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1));
  return [...new Set(w.places.map((p) => p.name))].sort();
}

/* ---------------- extract ---------------- */
if (process.argv[2] === 'extract') {
  const html = await readFile(join(ROOT, 'index.html'), 'utf8');
  const u = [...new Set(units(html).map((x) => x.key))];
  const a = [...new Set(attrStrings(html))].filter((s) => !u.includes(s));
  const source = { units: u, attributes: a, script: JS, plurals: PLURALS, places: await placeNames() };
  await writeFile(join(HERE, 'source.json'), JSON.stringify(source, null, 1));
  console.log(`source.json: ${u.length} text units, ${a.length} attributes, ${JS.length} script strings, ${source.places.length} place names`);
  process.exit(0);
}

/* ---------------- build ---------------- */
const esc = (s) => s.replace(/&(?!(?:[a-z]+|#\d+);)/g, '&amp;').replace(/"/g, '&quot;');
const missing = {};

function translateHtml(html, T, lang) {
  const tr = (s) => {
    const k = s.trim().replace(/\s+/g, ' ');
    if (T[k]) return T[k];
    (missing[lang] ||= new Set()).add(k);
    return null;
  };
  // text units, from the end so positions stay valid
  for (const u of units(html).reverse()) {
    const t = tr(u.key);
    if (!t) continue;
    const used = new Set();
    const back = t.replace(/\[\[(\d+)\]\]/g, (m, n) => { used.add(+n); return u.tags[+n] ?? ''; });
    if (used.size !== u.tags.length) { (missing[lang] ||= new Set()).add('(markup lost) ' + u.key); continue; }
    h0: {
      const before = u.raw.match(/^\s*/)[0], after = u.raw.match(/\s*$/)[0];
      html = html.slice(0, u.from) + before + back + after + html.slice(u.to);
    }
  }
  // attributes and meta text
  html = html.replace(ATTR, (m, name, val) => {
    if (name === 'data-imgs') return ` data-imgs="${val.split(';').map((e) => { const p = e.split('|'); if (p[1] && T[p[1].trim()]) p[1] = esc(T[p[1].trim()]); return p.join('|'); }).join(';')}"`;
    const t = hasWords(val) && !KEEP.has(val) ? tr(val) : null;
    return t ? ` ${name}="${esc(t)}"` : m;
  });
  html = html.replace(/(<meta (?:name|property)="(?:description|og:title|og:description|og:image:alt)" content=")([^"]*)"/g, (m, a, v) => { const t = tr(v); return t ? a + esc(t) + '"' : m; });
  html = html.replace(/<title>([^<]*)<\/title>/, (m, v) => { const t = tr(v); return t ? `<title>${t}</title>` : m; });
  return html;
}

// the n-th project of a tab, as an HTML string, to read its title, first sentences and image
function article(html, tab, n) {
  const a = html.indexOf(`id="${tab}" role="tabpanel"`);
  const parts = html.slice(a).split(/<article class="slide[^"]*"[^>]*>/).slice(1);
  return parts[n].split('</article>')[0];
}
const plain = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
function summary(text, max = 160) {
  const sentences = text.match(/[^.!?。؟]+[.!?。؟]+/g) || [text];
  let out = '';
  for (const s of sentences) { if ((out + s).length > max && out) break; out += s; }
  return out.trim().slice(0, max + 40);
}

function page(html, { lang, path, start, title, desc, image, imageAlt }) {
  const url = `${SITE}/${lang === 'en' ? '' : lang + '/'}${path}`;
  const urlOf = (l) => `${SITE}/${l === 'en' ? '' : l + '/'}${path}`;
  html = html.replace(/<html lang="en">/, `<html lang="${lang}"${lang === 'ar' ? ' dir="rtl"' : ''}${start ? ` data-start="${start}"` : ''}>`);
  html = html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`);
  html = html.replace(/<link rel="alternate" hreflang="[^"]*" href="[^"]*">\n?/g, '');
  html = html.replace(`<link rel="canonical" href="${url}">`, `<link rel="canonical" href="${url}">\n` +
    LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${urlOf(l)}">`).join('\n') + `\n<link rel="alternate" hreflang="x-default" href="${urlOf('en')}">`);
  html = html.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">\n<meta property="og:locale" content="${OG_LOCALE[lang]}">`);
  if (title) {
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
    html = html.replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(title)}">`);
  }
  if (desc) {
    html = html.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(desc)}">`);
    html = html.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(desc)}">`);
  }
  if (image) {
    html = html.replace(/<meta property="og:image" content="[^"]*">\n<meta property="og:image:width" content="\d+">\n<meta property="og:image:height" content="\d+">/, `<meta property="og:image" content="${SITE}/assets/img/projects/${image}.jpg">`);
    html = html.replace(/<meta property="og:image:alt" content="[^"]*">/, `<meta property="og:image:alt" content="${esc(imageAlt || title)}">`);
  }
  // the flag menu points at this same page in every language
  html = html.replace(/<a href="[^"]*" hreflang="(\w+)" lang="\w+" data-lang="\w+"( class="sel" aria-current="true")?/g, (m, l) =>
    `<a href="/${l === 'en' ? '' : l + '/'}${path}" hreflang="${l}" lang="${l}" data-lang="${l}"${l === lang ? ' class="sel" aria-current="true"' : ''}`);
  return html;
}

const src = await readFile(join(ROOT, 'index.html'), 'utf8');
const flagOf = (l) => src.match(new RegExp(`data-lang="${l}"[^>]*>(<span class="flag">[\\s\\S]*?</svg></span>)`))[1];
const sitemap = [];
const places = await placeNames();

for (const lang of LANGS) {
  let T = {}, plurals = {};
  if (lang !== 'en') {
    const tr = JSON.parse(await readFile(join(HERE, `${lang}.json`), 'utf8').catch(() => '{}'));
    T = tr.t || {};
    plurals = tr.plurals || {};
  }
  let home = lang === 'en' ? src : translateHtml(src, T, lang);
  if (lang !== 'en') {
    // the round flag button shows this language
    home = home.replace(/(<button class="theme lang" id="langBtn" aria-label=")[^"]*(" title=")[^"]*(" [^>]*>)<span class="flag">[\s\S]*?<\/svg><\/span>/,
      (m, a, b, c) => `${a}${esc((T['Language'] || 'Language') + ': ' + NAME[lang])}${b}${NAME[lang]}${c}${flagOf(lang)}`);
    const js = {};
    for (const k of [...JS, ...places]) if (T[k]) js[k] = T[k];
    home = home.replace('<script src="/assets/app.js"></script>',
      `<script>window.I18N=${JSON.stringify({ lang, locale: LOCALE[lang], t: js, plurals })}</script>\n<script src="/assets/app.js"></script>`);
  }
  const dir = lang === 'en' ? ROOT : join(ROOT, lang);
  const out = async (path, html) => {
    const d = join(dir, path);
    await mkdir(d, { recursive: true });
    await writeFile(join(d, 'index.html'), html);
  };
  if (lang !== 'en') await out('', page(home, { lang, path: '' }));
  sitemap.push('');
  for (const [tab, n, slug] of PROJECTS) {
    const art = article(home, tab, n);
    const name = plain((art.match(/<h[23]>([\s\S]*?)<\/h[23]>/) || [])[1] || slug);
    const p = (art.match(/<div class="(?:prose|a-body)">\s*(?:<div>\s*)?<p[^>]*>([\s\S]*?)<\/p>/) || art.match(/<p(?: class="first")?>([\s\S]*?)<\/p>/) || [])[1] || '';
    const img = (art.match(/data-imgs="([^|"]+)\|([^;"]*)/) || []);
    const path = `${tab}/${slug}/`;
    await out(path, page(home, { lang, path, start: `${tab}/${n}`, title: `${name} | Ramy Maher`, desc: summary(plain(p)), image: img[1], imageAlt: img[2] && plain(img[2]) }));
    if (lang === 'en') sitemap.push(path);
  }
}

// sitemap: every page once, with its other languages as alternates
await writeFile(join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${[...new Set(sitemap)].flatMap((path) => LANGS.map((l) => `  <url>
    <loc>${SITE}/${l === 'en' ? '' : l + '/'}${path}</loc>
${LANGS.map((a) => `    <xhtml:link rel="alternate" hreflang="${a}" href="${SITE}/${a === 'en' ? '' : a + '/'}${path}"/>`).join('\n')}
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/${path}"/>
  </url>`)).join('\n')}
</urlset>
`);

for (const [l, s] of Object.entries(missing)) {
  console.log(`${l}: ${s.size} phrases without a translation (shown in English)`);
  [...s].slice(0, 8).forEach((k) => console.log('   ', k.slice(0, 110)));
}
console.log(`built ${LANGS.length} languages, ${PROJECTS.length} project pages each, sitemap with ${new Set(sitemap).size * LANGS.length} addresses`);
