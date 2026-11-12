# Book website

Static website for the book **“How to Become a Native Speaker of Foreign Languages in 4 Months”** by Maximov Alexander, in English and Russian.

- English: <https://maximofcom.github.io/Website/>
- Russian: <https://maximofcom.github.io/Website/ru/>

The site has no build step and no dependencies: plain HTML, CSS and vanilla JavaScript. It is served directly from the repository by GitHub Pages.

## Structure

```
index.html                 English page
ru/index.html              Russian page
404.html                   Custom not-found page
manifest.webmanifest       English web app manifest
ru/manifest.webmanifest    Russian web app manifest
sitemap.xml                Both pages with hreflang alternates
robots.txt                 Crawler rules and sitemap URL
assets/
  css/style.css            All styles, themes, layout and print rules
  js/langs.js              Language registry, language switcher, suggestion banner
  js/data.en.js            English book content (window.BOOK_DATA)
  js/data.ru.js            Russian book content (window.BOOK_DATA)
  js/app.js                Chapters, tile layout, theme, deep links, toolbar
  img/favicon.svg          Browser icon
  img/apple-touch-icon.png 180×180 touch icon
  img/icon-192.png         Manifest icon
  img/icon-512.png         Manifest icon
  img/og-en.png            English social preview, 1200×630
  img/og-ru.png            Russian social preview, 1200×630
  img/chart.png            Book chart, 800×439
```

## Editing the book text

All book content lives in `assets/js/data.en.js` and `assets/js/data.ru.js`. Each file assigns one object to `window.BOOK_DATA`:

```js
window.BOOK_DATA = {
  "lang": "en",
  "title": "…",
  "author": "…",
  "chapters": [
    {
      "id": "chapter-1",
      "title": "Chapter title",
      "preview": ["Short teaser sentence."],
      "blocks": [
        { "type": "p", "text": "Paragraph text.", "hl": [[0, 9]] },
        { "type": "list", "ordered": false, "items": ["First item", "Second item"] },
        { "type": "img", "src": "assets/img/chart.png", "width": 800, "height": 439, "alt": "…" },
        { "type": "table", "rows": [["Header 1", "Header 2"], ["Cell", "Cell"]] }
      ]
    }
  ]
};
```

Block types:

- `p` — a paragraph. `text` is plain text; `hl` is a list of highlight ranges.
- `list` — a bulleted or numbered list. `items` is an array of plain strings; add `"ordered": true` for a numbered list.
- `img` — an image. `src` is relative to the site root, `alt` is required, and `width`/`height` should match the file so the layout does not jump while loading.
- `table` — the first row becomes the table header.

Keep chapter `id` values stable (`chapter-1`, `chapter-2`, …): they are used for deep links such as `/#chapter-7` and `ru/#chapter-7`.

### Highlight offsets are character positions

`hl` is an array of `[start, end]` character offsets into the paragraph's `text` string. The end offset is exclusive. For example, in `"Banana"`, `[0, 6]` highlights the whole word.

**Any edit to a paragraph's `text` invalidates its `hl` offsets**, because inserting or deleting a single character shifts everything after it. After editing text, recalculate the affected ranges. A quick way is the browser console:

```js
const ranges = [[10, 24], [40, 51]];
const text = "your edited paragraph text";
ranges.map(([start, end]) => text.slice(start, end));
```

Check that each slice is the phrase you intended to highlight, then update the numbers in the data file. Do not copy offsets from the other language file: English and Russian text have different lengths.

The `text` field must be valid JSON: escape double quotes as `\"` and keep the file UTF-8 encoded.

## Images

- `chart.png` is 800×439. If you replace it, update `width` and `height` in both data files and resize the file to about 800 px wide.
- Social preview images must be 1200×630 PNG. `og-en.png` is used by the English page, `og-ru.png` by the Russian page.
- `icon-192.png` and `icon-512.png` are the manifest icons; `apple-touch-icon.png` is 180×180.
- All text alternatives are set in the `alt` fields of the data files. Update them when the image changes.

## SEO and metadata

Both pages contain a canonical URL, `hreflang` alternates (`en`, `ru`, `x-default`), Open Graph and Twitter Card tags, and Schema.org `Book` JSON-LD. `sitemap.xml` mirrors the same URLs and alternates, and `robots.txt` points to the sitemap.

If the site moves to another domain or repository path, update the absolute URLs in:

- `index.html` and `ru/index.html` (canonical, alternates, Open Graph, Twitter, JSON-LD);
- `sitemap.xml` and `robots.txt`;
- the `start_url` and `scope` values in both manifest files;
- the absolute asset paths in `404.html`.

The `404.html` page uses `/Website/` paths because GitHub Pages serves it from any URL depth.

## Language behaviour

- The language selector stores the choice in `localStorage` under `site-lang`.
- A stored choice redirects only on the site root, so a direct link to a chapter is never bounced to another language.
- `?lang=en` and `?lang=ru` are explicit links: they store the choice and redirect once.
- There is no automatic redirect based on browser language. Instead, `langs.js` shows a one-time, dismissible suggestion banner. Dismissal is remembered per suggested language.

## Reading features

- Click a chapter tile to expand it in place; the tile grid reflows around open chapters.
- “Expand all”, “Collapse all” and “Print / PDF” buttons sit above the chapters. Print styles hide navigation and expand every chapter, so the browser's print dialog can save a clean PDF.
- Chapter tiles are deep-linkable (`#chapter-N`); opening a link expands and scrolls to that chapter.
- The header height is measured at runtime (`--header-offset`), so anchors are not hidden under the sticky header on mobile.
- Light and dark themes follow the system preference until the visitor chooses one; the choice is stored in `localStorage` under `theme`.

## Running locally

Open `index.html` directly in a browser, or serve the folder to avoid any file-URL restrictions:

```powershell
# Any static server works. For example, with Python installed:
python -m http.server 8000
```

Then visit <http://localhost:8000/>.

## Deployment

The site is deployed with GitHub Pages from the `main` branch, repository root. Push changes and Pages publishes them automatically; there is no build or deploy job.

After changing content, bump the `lastmod` dates in `sitemap.xml` and, if needed, the `content` of the Open Graph/Twitter tags. Browsers and social networks cache images and metadata, so a hard refresh or a new share may be needed to see updates.
