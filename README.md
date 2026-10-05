# rm_ws_228341
The personal website, ramymaher.com.

`index.html` is the English home page and the only page edited by hand. Everything else is
generated from it:

- `/de/`, `/fr/`, `/es/`, `/ar/`: the same site in German, French, Spanish and Arabic
  (Arabic reads right to left; the header stays as it is).
- `/architecture/berlin-modern/` and the other project addresses, in every language: the same
  site, opening on that project, with its own title, description and share image.
- `sitemap.xml`, with every address and its other languages.

After changing `index.html`:

```
node scripts/i18n/build.mjs extract
node scripts/i18n/build.mjs
```

The first command lists every English phrase in `scripts/i18n/source.json`; translations live
in `scripts/i18n/de.json`, `fr.json`, `es.json` and `ar.json`. A phrase without a translation
stays in English and the build lists it, so add its translation and build again.
