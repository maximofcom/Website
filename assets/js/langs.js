/*
 * langs.js - реестр языков сайта и определение языка посетителя.
 *
 * Как добавить язык:
 *   1. создайте папку /код/ и положите туда копию index.html;
 *   2. переведите книгу в файл assets/js/data.код.js;
 *   3. добавьте запись в массив LANGS (например: en, English, en/).
 *
 * При заходе на сайт скрипт проверяет параметр lang, сохранённый выбор
 * и языки браузера, после чего переводит посетителя на нужную версию.
 */
(function () {
  'use strict';

  var LANGS = [
    { code: 'ru', name: 'Русский', dir: '' }
  ];

  window.SITE_LANGS = LANGS;

  var current = (document.documentElement.getAttribute('lang') || 'ru').toLowerCase().split('-')[0];
  var byCode = {};
  LANGS.forEach(function (lang) { byCode[lang.code] = lang; });

  function storageGet(key) {
    try { return window.localStorage.getItem(key); } catch (error) { return null; }
  }

  function storageSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (error) { /* хранилище недоступно */ }
  }

  function siteRoot() {
    var script = document.currentScript;
    if (script && script.src) return new URL('../../', script.src).href;
    return new URL('./', window.location.href).href;
  }

  function browserLanguage() {
    var list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ''];
    for (var i = 0; i < list.length; i++) {
      var base = String(list[i]).toLowerCase().split('-')[0];
      if (byCode[base]) return base;
    }
    return '';
  }

  /* Явный параметр lang имеет самый высокий приоритет. */
  try {
    var params = new URLSearchParams(window.location.search);
    var forced = (params.get('lang') || '').toLowerCase();
    if (forced && byCode[forced]) storageSet('site-lang', forced);
  } catch (error) { /* браузер без URLSearchParams */ }

  var chosen = storageGet('site-lang');
  var target = (chosen && byCode[chosen]) ? chosen : browserLanguage();

  if (target && target !== current && byCode[target]) {
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLangSelects);
  } else {
    initLangSelects();
  }
})();