// Quick search-engine check of every generated page: title and description lengths, one h1,
// images without alt text, canonical and language links present.
//   node scripts/i18n/seo-check.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (!/^(assets|scripts|\.git|node_modules)$/.test(f)) walk(p); } else if (f === 'index.html') files.push(p); } };
walk(ROOT);
let problems = 0;
for (const f of files) {
  const h = readFileSync(f, 'utf8');
  const t = (h.match(/<title>([^<]*)/) || [])[1] || '';
  const d = (h.match(/name="description" content="([^"]*)/) || [])[1] || '';
  const issues = [];
  if (t.length < 10 || t.length > 70) issues.push(`title ${t.length} chars`);
  if (d.length < 70 || d.length > 170) issues.push(`description ${d.length} chars`);
  if ((h.match(/<h1[\s>]/g) || []).length !== 1) issues.push('h1 count');
  const noAlt = (h.match(/<img(?![^>]*\balt="[^"]+")[^>]*>/g) || []).length;
  if (noAlt) issues.push(`${noAlt} images without alt`);
  if (!/rel="canonical"/.test(h)) issues.push('no canonical');
  if ((h.match(/hreflang=/g) || []).length < 6 && !/name="seo-check" content="standalone"/.test(h)) issues.push('language links missing');
  if (issues.length) { problems++; console.log(relative(ROOT, f).replace(/\\/g, '/').padEnd(48), issues.join(', ')); }
}
console.log(`${files.length} pages checked, ${problems} with something to fix`);
