/*
 * app.js - логика сайта: светлая и тёмная темы, главы книги, год в подвале.
 */
(function () {
  'use strict';

  var root = document.documentElement;

  /* ---------------- Тема оформления ---------------- */

  var THEME_KEY = 'theme';
  var themeButton = document.getElementById('theme-toggle');
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  var darkMedia = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function storedTheme() {
    try { return window.localStorage.getItem(THEME_KEY); } catch (error) { return null; }
  }

  function saveTheme(value) {
    try { window.localStorage.setItem(THEME_KEY, value); } catch (error) { /* хранилище недоступно */ }
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    if (themeButton) themeButton.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    if (themeMeta) themeMeta.setAttribute('content', theme === 'dark' ? '#0d0d0d' : '#ffffff');
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

  /* ---------------- Главы книги ---------------- */

  var data = window.BOOK_DATA;
  var grid = document.getElementById('chapters');
  var stats = document.getElementById('book-stats');

  function plural(count, forms) {
    var rest10 = count % 10;
    var rest100 = count % 100;
    if (rest10 === 1 && rest100 !== 11) return forms[0];
    if (rest10 >= 2 && rest10 <= 4 && (rest100 < 12 || rest100 > 14)) return forms[1];
    return forms[2];
  }

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

  function buildFigure(block) {
    var figure = document.createElement('figure');
    var image = document.createElement('img');
    image.src = block.src;
    image.alt = block.alt || '';
    image.loading = 'lazy';
    image.decoding = 'async';
    figure.appendChild(image);
    return figure;
  }

  function buildChapter(chapter, index) {
    var article = document.createElement('article');
    article.className = 'tile';
    article.id = chapter.id;

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'tile-toggle';
    toggle.id = chapter.id + '-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', chapter.id + '-body');

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

    var body = document.createElement('div');
    body.className = 'tile-body';
    body.id = chapter.id + '-body';
    body.setAttribute('role', 'region');
    body.setAttribute('aria-labelledby', toggle.id);

    var inner = document.createElement('div');
    inner.className = 'tile-body-inner';

    var content = document.createElement('div');
    content.className = 'tile-content';
    (chapter.blocks || []).forEach(function (block) {
      if (block.type === 'p') content.appendChild(buildParagraph(block));
      else if (block.type === 'table') content.appendChild(buildTable(block));
      else if (block.type === 'img') content.appendChild(buildFigure(block));
    });

    inner.appendChild(content);
    body.appendChild(inner);
    article.appendChild(toggle);
    article.appendChild(body);
    return article;
  }

  function setChapterOpen(article, toggle, body, open) {
    article.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if ('inert' in body) body.inert = !open;
  }

  if (grid && data && data.chapters && data.chapters.length) {
    var fragment = document.createDocumentFragment();
    data.chapters.forEach(function (chapter, index) {
      fragment.appendChild(buildChapter(chapter, index));
    });
    grid.appendChild(fragment);

    Array.prototype.forEach.call(grid.querySelectorAll('.tile'), function (tile) {
      var toggle = tile.querySelector('.tile-toggle');
      var body = tile.querySelector('.tile-body');
      if (body && 'inert' in body) body.inert = true;
      toggle.addEventListener('click', function () {
        setChapterOpen(tile, toggle, body, !tile.classList.contains('is-open'));
      });
    });

    if (stats) {
      stats.textContent = data.chapters.length + ' ' + plural(data.chapters.length, ['глава', 'главы', 'глав']) + ', нажмите на плитку, чтобы развернуть главу';
    }
  } else if (grid) {
    var message = document.createElement('p');
    message.className = 'note';
    message.textContent = 'Не удалось загрузить текст книги: проверьте файл assets/js/data.ru.js.';
    grid.appendChild(message);
  }

  /* ---------------- Год в подвале ---------------- */

  var year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
})();