/*
 * langs.js - language registry and visitor language detection.
 *
 * The order below also controls the language selector. Russian intentionally
 * comes first, as requested. English is the site's fallback language.
 */
(function () {
  'use strict';

  var LANGS = [
    { code: 'ru', name: '🇷🇺 Русский', dir: 'ru/' },
    { code: 'en', name: '🇬🇧 English', dir: '' }
  ];
  var DEFAULT_LANGUAGE = 'en';

  window.SITE_LANGS = LANGS;

  var current = (document.documentElement.getAttribute('lang') || DEFAULT_LANGUAGE).toLowerCase().split('-')[0];
  var byCode = {};
  LANGS.forEach(function (lang) { byCode[lang.code] = lang; });

  function storageGet(key) {
    try { return window.localStorage.getItem(key); } catch (error) { return null; }
  }

  function storageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (error) { /* storage unavailable */ }
  }

  function siteRoot() {
    var script = document.currentScript;
    if (script && script.src) return new URL('../../', script.src).href;
    return new URL('./', window.location.href).href;
  }

  /* Абсолютный путь к корню сайта: нужен для ресурсов из файлов данных
     (например, картинок), потому что глубина страниц ru/ и корня различается. */
  window.SITE_ROOT = siteRoot();

  function browserLanguage() {
    var list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ''];
    for (var i = 0; i < list.length; i++) {
      var base = String(list[i]).toLowerCase().split('-')[0];
      if (byCode[base]) return base;
    }
    return '';
  }

  try {
    var params = new URLSearchParams(window.location.search);
    var forced = (params.get('lang') || '').toLowerCase();
    if (forced && byCode[forced]) storageSet('site-lang', forced);
  } catch (error) { /* legacy browser */ }

  var chosen = storageGet('site-lang');
  var target = (chosen && byCode[chosen]) ? chosen : (browserLanguage() || DEFAULT_LANGUAGE);

  if (target !== current && byCode[target]) {
    var dir = byCode[target].dir;
    window.location.replace(dir ? new URL(dir, siteRoot()).href : siteRoot());
    return;
  }

  function initLangSelects() {
    var selects = document.querySelectorAll('.js-lang-select');
    Array.prototype.forEach.call(selects, function (select) {
      while (select.firstChild) select.removeChild(select.firstChild);
      LANGS.forEach(function (lang) {
        var option = document.createElement('option');
        option.value = lang.code;
        option.textContent = lang.name;
        if (lang.code === current) option.selected = true;
        select.appendChild(option);
      });
      select.addEventListener('change', function () {
        var code = select.value;
        if (!byCode[code]) return;
        storageSet('site-lang', code);
        if (code === current) return;
        var dir = byCode[code].dir;
        window.location.href = dir ? new URL(dir, siteRoot()).href : siteRoot();
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initLangSelects);
  else initLangSelects();
})();