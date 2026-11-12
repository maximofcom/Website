/*
 * app.js - site logic: light and dark themes, book chapters, layout, deep links.
 * No dependencies.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var data = window.BOOK_DATA;
  var lang = (data && data.lang) || (root.getAttribute('lang') || 'en').toLowerCase().split('-')[0];

  var UI = {
    ru: {
      stats: function (count) {
        var rest10 = count % 10;
        var rest100 = count % 100;
        var word = (rest10 === 1 && rest100 !== 11) ? 'глава' :
          (rest10 >= 2 && rest10 <= 4 && (rest100 < 12 || rest100 > 14)) ? 'главы' : 'глав';
        return count + ' ' + word + '. Нажмите на плитку, чтобы раскрыть главу.';
      },
      loadError: 'Не удалось загрузить текст книги: проверьте файл данных.',
      themeToDark: 'Включить тёмную тему',
      themeToLight: 'Включить светлую тему'
    },
    en: {
      stats: function (count) {
        return count + ' ' + (count === 1 ? 'chapter' : 'chapters') + '. Click a tile to expand a chapter.';
      },
      loadError: 'The book text could not be loaded. Check the data file.',
      themeToDark: 'Switch to dark theme',
      themeToLight: 'Switch to light theme'
    }
  };
  var strings = UI[lang] || UI.en;

  /* ---------------- Theme ---------------- */

  var THEME_KEY = 'theme';
  var themeButton = document.getElementById('theme-toggle');
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  var darkMedia = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function storedTheme() {
    try { return window.localStorage.getItem(THEME_KEY); } catch (error) { return null; }
  }

  function saveTheme(value) {
    try { window.localStorage.setItem(THEME_KEY, value); } catch (error) { /* storage unavailable */ }
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    if (themeMeta) themeMeta.setAttribute('content', theme === 'dark' ? '#0d0d0d' : '#ffffff');
    if (themeButton) {
      var label = theme === 'dark' ? strings.themeToLight : strings.themeToDark;
      themeButton.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      themeButton.setAttribute('aria-label', label);
      themeButton.setAttribute('title', label);
    }
  }

  applyTheme(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

  if (themeButton) {
    themeButton.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      saveTheme(next);
    });
  }

  if (darkMedia && darkMedia.addEventListener) {
    darkMedia.addEventListener('change', function (event) {
      if (!storedTheme()) applyTheme(event.matches ? 'dark' : 'light');
    });
  }

  /* ---------------- Header offset for anchors ---------------- */

  var header = document.querySelector('.site-header');

  function updateHeaderOffset() {
    var height = header ? header.getBoundingClientRect().height : 0;
    root.style.setProperty('--header-offset', Math.round(height) + 'px');
  }

  updateHeaderOffset();
  if (header) {
    if (window.ResizeObserver) {
      new window.ResizeObserver(updateHeaderOffset).observe(header);
    } else {
      window.addEventListener('resize', updateHeaderOffset);
    }
  }

  /* ---------------- Book chapters ---------------- */

  var grid = document.getElementById('chapters');
  var stats = document.getElementById('book-stats');

  function buildParagraph(block) {
    var paragraph = document.createElement('p');
    var text = block.text || '';
    var ranges = block.hl || [];
    var position = 0;
    ranges.forEach(function (range) {
      var start = range[0];
      var end = range[1];
      if (start > position) paragraph.appendChild(document.createTextNode(text.slice(position, start)));
      var mark = document.createElement('mark');
      mark.textContent = text.slice(start, end);
      paragraph.appendChild(mark);
      position = end;
    });
    if (position < text.length) paragraph.appendChild(document.createTextNode(text.slice(position)));
    return paragraph;
  }

  function buildList(block) {
    var ordered = block.ordered === true;
    var list = document.createElement(ordered ? 'ol' : 'ul');
    list.className = 'tile-list';
    (block.items || []).forEach(function (item) {
      var li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    });
    return list;
  }

  function buildTable(block) {
    var wrapper = document.createElement('div');
    wrapper.className = 'table-scroll';
    var table = document.createElement('table');
    var head = document.createElement('thead');
    var body = document.createElement('tbody');
    (block.rows || []).forEach(function (row, rowIndex) {
      var tr = document.createElement('tr');
      row.forEach(function (cell) {
        var cellEl = document.createElement(rowIndex === 0 ? 'th' : 'td');
        cellEl.textContent = cell;
        tr.appendChild(cellEl);
      });
      (rowIndex === 0 ? head : body).appendChild(tr);
    });
    table.appendChild(head);
    table.appendChild(body);
    wrapper.appendChild(table);
    return wrapper;
  }

  function assetUrl(path) {
    if (!path) return '';
    if (/^(https?:)?\/\//i.test(path) || path.charAt(0) === '/') return path;
    var base = window.SITE_ROOT || './';
    return new URL(path, base).href;
  }

  function buildFigure(block) {
    var figure = document.createElement('figure');
    var image = document.createElement('img');
    image.src = assetUrl(block.src);
    image.alt = block.alt || '';
    image.loading = 'lazy';
    image.decoding = 'async';
    if (block.width) image.setAttribute('width', String(block.width));
    if (block.height) image.setAttribute('height', String(block.height));
    figure.appendChild(image);
    return figure;
  }

  function buildChapter(chapter, index) {
    var article = document.createElement('article');
    article.className = 'tile';
    article.id = chapter.id;

    var heading = document.createElement('h3');
    heading.className = 'tile-heading';

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'tile-toggle';
    toggle.id = chapter.id + '-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', chapter.id + '-body');
    toggle.setAttribute('aria-label', chapter.title);

    var head = document.createElement('span');
    head.className = 'tile-head';

    var number = document.createElement('span');
    number.className = 'tile-number';
    number.setAttribute('aria-hidden', 'true');
    number.textContent = (index + 1 < 10 ? '0' : '') + (index + 1);
    head.appendChild(number);

    var marker = document.createElement('span');
    marker.className = 'tile-marker';
    marker.setAttribute('aria-hidden', 'true');
    marker.textContent = '+';
    head.appendChild(marker);

    toggle.appendChild(head);

    var title = document.createElement('span');
    title.className = 'tile-title';
    title.textContent = chapter.title;
    toggle.appendChild(title);

    if (chapter.preview && chapter.preview.length) {
      var preview = document.createElement('span');
      preview.className = 'tile-preview';
      chapter.preview.forEach(function (sentence) {
        var item = document.createElement('span');
        item.className = 'tile-preview-item';
        item.textContent = sentence;
        preview.appendChild(item);
      });
      toggle.appendChild(preview);
    }

    heading.appendChild(toggle);
    article.appendChild(heading);

    var body = document.createElement('div');
    body.className = 'tile-body';
    body.id = chapter.id + '-body';

    var inner = document.createElement('div');
    inner.className = 'tile-body-inner';

    var content = document.createElement('div');
    content.className = 'tile-content';
    (chapter.blocks || []).forEach(function (block) {
      if (block.type === 'p') content.appendChild(buildParagraph(block));
      else if (block.type === 'list') content.appendChild(buildList(block));
      else if (block.type === 'table') content.appendChild(buildTable(block));
      else if (block.type === 'img') content.appendChild(buildFigure(block));
    });

    inner.appendChild(content);
    body.appendChild(inner);
    article.appendChild(body);
    return article;
  }

  function setChapterOpen(article, toggle, body, open) {
    article.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if ('inert' in body) {
      body.inert = !open;
      body.removeAttribute('aria-hidden');
    } else if (open) {
      body.removeAttribute('aria-hidden');
    } else {
      body.setAttribute('aria-hidden', 'true');
    }
  }

  /* ---------------- Dense tile layout ---------------- */

  var LAYOUT_GAP = 16; /* vertical gap between tiles, px */
  var LAYOUT_ROW = 2;  /* grid row step, px (must match CSS) */
  var tiles = [];
  var columns = 1;
  var layoutFrame = 0;
  var layoutReuse = true;

  function measureColumns() {
    if (!grid) return 1;
    var template = window.getComputedStyle(grid).gridTemplateColumns;
    if (!template || template === 'none') return 1;
    return template.trim().split(/\s+/).length || 1;
  }

  function layoutTiles(reuse) {
    if (!grid || !tiles.length) return;

    var heights = [];
    var sizes = [];
    var i;
    for (i = 0; i < columns; i++) heights.push(0);
    for (i = 0; i < tiles.length; i++) sizes.push(tiles[i].getBoundingClientRect().height);

    for (i = 0; i < tiles.length; i++) {
      var span = Math.max(1, Math.ceil((sizes[i] + LAYOUT_GAP) / LAYOUT_ROW));
      var column = 0;
      if (reuse && tiles[i].dataset.col) {
        column = Math.min(columns - 1, Number(tiles[i].dataset.col) || 0);
      } else {
        for (var c = 1; c < columns; c++) {
          if (heights[c] < heights[column]) column = c;
        }
        tiles[i].dataset.col = String(column);
      }
      var rowStart = Math.round(heights[column] / LAYOUT_ROW) + 1;
      tiles[i].style.gridColumn = String(column + 1);
      tiles[i].style.gridRow = rowStart + ' / span ' + span;
      heights[column] = (rowStart - 1 + span) * LAYOUT_ROW;
    }
  }

  function scheduleLayout(reuse) {
    layoutReuse = reuse;
    if (layoutFrame) return;
    layoutFrame = window.requestAnimationFrame(function () {
      layoutFrame = 0;
      layoutTiles(layoutReuse);
    });
  }

  /* ---------------- Deep links and toolbar ---------------- */

  function findTile(id) {
    if (!id || !grid) return null;
    var tile = document.getElementById(id);
    return tile && tile.classList.contains('tile') ? tile : null;
  }

  function setHash(id) {
    try {
      if (id) window.history.replaceState(null, '', '#' + id);
      else window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch (error) { /* history unavailable */ }
  }

  function openFromHash(smooth) {
    var tile = findTile(window.location.hash.replace(/^#/, ''));
    if (!tile) return false;
    var toggle = tile.querySelector('.tile-toggle');
    var body = tile.querySelector('.tile-body');
    if (toggle && body && !tile.classList.contains('is-open')) {
      setChapterOpen(tile, toggle, body, true);
    }
    scheduleLayout(true);
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        tile.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
      });
    });
    return true;
  }

  function eachTile(callback) {
    tiles.forEach(callback);
  }

  function expandAll() {
    eachTile(function (tile) {
      setChapterOpen(tile, tile.querySelector('.tile-toggle'), tile.querySelector('.tile-body'), true);
    });
    scheduleLayout(true);
  }

  function collapseAll() {
    eachTile(function (tile) {
      setChapterOpen(tile, tile.querySelector('.tile-toggle'), tile.querySelector('.tile-body'), false);
    });
    if (findTile(window.location.hash.replace(/^#/, ''))) setHash('');
    scheduleLayout(true);
  }

  if (grid && data && data.chapters && data.chapters.length) {
    var fragment = document.createDocumentFragment();
    data.chapters.forEach(function (chapter, index) {
      fragment.appendChild(buildChapter(chapter, index));
    });
    grid.appendChild(fragment);
    tiles = Array.prototype.slice.call(grid.querySelectorAll('.tile'));

    tiles.forEach(function (tile) {
      var toggle = tile.querySelector('.tile-toggle');
      var body = tile.querySelector('.tile-body');
      setChapterOpen(tile, toggle, body, false);

      var openNow = function (open) {
        setChapterOpen(tile, toggle, body, open);
        scheduleLayout(true);
        /* When transitions are disabled, transitionend never fires, so remeasure once the frame settles. */
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () { scheduleLayout(true); });
        });
      };

      toggle.addEventListener('click', function () {
        var open = !tile.classList.contains('is-open');
        openNow(open);
        if (open) setHash(tile.id);
        else if (window.location.hash === '#' + tile.id) setHash('');
      });

      body.addEventListener('transitionend', function (event) {
        if (event.propertyName === 'grid-template-rows') scheduleLayout(true);
      });
    });

    columns = measureColumns();
    layoutTiles(false);

    if (window.ResizeObserver) {
      var tileObserver = new window.ResizeObserver(function () { scheduleLayout(true); });
      tiles.forEach(function (tile) { tileObserver.observe(tile); });

      var gridObserver = new window.ResizeObserver(function () {
        var next = measureColumns();
        if (next !== columns) {
          columns = next;
          layoutTiles(false);
        }
      });
      gridObserver.observe(grid);
    } else {
      window.addEventListener('resize', function () {
        columns = measureColumns();
        layoutTiles(false);
      });
    }

    window.addEventListener('hashchange', function () { openFromHash(true); });
    window.addEventListener('load', function () { scheduleLayout(false); });
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(function () { scheduleLayout(false); });
    }

    var expandButton = document.querySelector('[data-book-action="expand"]');
    var collapseButton = document.querySelector('[data-book-action="collapse"]');
    var printButton = document.querySelector('[data-book-action="print"]');
    if (expandButton) expandButton.addEventListener('click', expandAll);
    if (collapseButton) collapseButton.addEventListener('click', collapseAll);
    if (printButton) printButton.addEventListener('click', function () { window.print(); });

    if (stats) stats.textContent = strings.stats(data.chapters.length);
    openFromHash(false);
  } else if (grid) {
    var message = document.createElement('p');
    message.className = 'note';
    message.textContent = strings.loadError;
    grid.appendChild(message);
  }

  /* ---------------- Footer year ---------------- */

  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
