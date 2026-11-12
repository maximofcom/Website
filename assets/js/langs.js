/*
 * langs.js - language registry and explicit language links.
 *
 * Russian intentionally comes first in the selector. English is the fallback.
 * A stored choice is honoured on the root page only, and an explicit ?lang=
 * link always wins. On the first visit, the root page follows the browser's
 * language when it is Russian; other languages use English.
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

  /* Absolute URL of the site root. Data files use it for shared assets. */
  window.SITE_ROOT = siteRoot();

  function browserLanguage() {
    var list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ''];
    for (var i = 0; i < list.length; i++) {
      var base = String(list[i]).toLowerCase().split('-')[0];
      if (byCode[base]) return base;
    }
    return '';
  }

  function langUrl(code) {
    var dir = byCode[code].dir;
    return dir ? new URL(dir, siteRoot()).href : siteRoot();
  }

  function isRootPage() {
    try {
      var rootPath = new URL(siteRoot()).pathname;
      var path = window.location.pathname;
      return path === rootPath || path === rootPath + 'index.html';
    } catch (error) {
      return false;
    }
  }

  /* Explicit ?lang= links are user intent: store and follow them. */
  var explicit = false;
  try {
    var params = new URLSearchParams(window.location.search);
    var forced = (params.get('lang') || '').toLowerCase();
    if (forced && byCode[forced]) {
      explicit = true;
      storageSet('site-lang', forced);
      if (forced !== current) {
        window.location.replace(langUrl(forced));
        return;
      }
      params.delete('lang');
      var query = params.toString();
      var clean = window.location.pathname + (query ? '?' + query : '') + window.location.hash;
      try { window.history.replaceState(null, '', clean); } catch (error) { /* history unavailable */ }
    }
  } catch (error) { /* legacy browser */ }

  /* Honour a stored choice only on the root page, never on a direct subpage link. */
  if (!explicit) {
    var stored = storageGet('site-lang');
    if (stored && byCode[stored] && stored !== current && isRootPage()) {
      window.location.replace(langUrl(stored));
      return;
    }

    /* On the first visit, automatically choose Russian for Russian browsers. */
    if (!stored && isRootPage() && current === DEFAULT_LANGUAGE) {
      var preferred = browserLanguage();
      if (preferred === 'ru') {
        storageSet('site-lang', preferred);
        window.location.replace(langUrl(preferred));
        return;
      }
    }
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
        window.location.href = langUrl(code);
      });
    });
  }

  function init() {
    initLangSelects();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
