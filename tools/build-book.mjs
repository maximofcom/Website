#!/usr/bin/env node
/*
 * build-book.mjs — собирает содержимое сайта из книги «Ru.docx».
 *
 * Запуск:  node tools/build-book.mjs
 * Создаёт: assets/js/data.ru.js  — главы, превью и полный текст книги
 *          assets/img/chart.png  — иллюстрация из книги
 *
 * Внешних зависимостей нет: DOCX — это ZIP-архив, а XML разбирается
 * встроенными средствами Node.js.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOCX_PATH = join(ROOT, 'Ru.docx');
const DATA_PATH = join(ROOT, 'assets', 'js', 'data.ru.js');
const IMG_DIR = join(ROOT, 'assets', 'img');
const CHART_ALT =
  'Диаграмма из книги: скорость запоминания 1000 слов при длительности занятий 2 часа, 1 час и 30 минут в день.';

/* ============================== ZIP ============================== */

function readZipEntries(buf) {
  const EOCD = 0x06054b50;
  let eocd = -1;
  const min = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Не найден конец ZIP-архива (EOCD).');

  const total = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  const entries = [];

  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('Повреждён центральный каталог ZIP.');
    }
    const method = buf.readUInt16LE(offset + 10);
    const compressedSize = buf.readUInt32LE(offset + 20);
    const nameLength = buf.readUInt16LE(offset + 28);
    const extraLength = buf.readUInt16LE(offset + 30);
    const commentLength = buf.readUInt16LE(offset + 32);
    const localOffset = buf.readUInt32LE(offset + 42);
    const name = buf.toString('utf8', offset + 46, offset + 46 + nameLength);
    entries.push({ name, method, compressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readZipEntry(buf, entry) {
  const offset = entry.localOffset;
  if (buf.readUInt32LE(offset) !== 0x04034b50) {
    throw new Error('Повреждён локальный заголовок ZIP: ' + entry.name);
  }
  const nameLength = buf.readUInt16LE(offset + 26);
  const extraLength = buf.readUInt16LE(offset + 28);
  const start = offset + 30 + nameLength + extraLength;
  const data = buf.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return Buffer.from(data);
  if (entry.method === 8) return inflateRawSync(data);
  throw new Error('Неподдерживаемый метод сжатия: ' + entry.method);
}

/* ============================ XML ================================ */

function decodeXml(text) {
  return text.replace(/&(#x?[0-9A-Fa-f]+|[a-zA-Z]+);/g, (match, group) => {
    if (group[0] === '#') {
      const hex = group[1] === 'x' || group[1] === 'X';
      const code = parseInt(group.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    switch (group) {
      case 'amp': return '&';
      case 'lt': return '<';
      case 'gt': return '>';
      case 'quot': return '"';
      case 'apos': return "'";
      default: return match;
    }
  });
}

/** Ищет открывающий тег <name ...> с проверкой границы имени (не <nameExtra>). */
function findTag(xml, name, from) {
  const needle = '<' + name;
  let index = from;
  for (;;) {
    index = xml.indexOf(needle, index);
    if (index === -1) return -1;
    const next = xml[index + needle.length];
    if (next === '>' || next === '/' || next === ' ' || next === '\t' || next === '\n' || next === '\r') {
      return index;
    }
    index += needle.length;
  }
}

/** Возвращает позицию сразу после закрывающего тега с учётом вложенности. */
function findMatching(xml, name, from) {
  let depth = 0;
  let index = from;
  for (;;) {
    const open = findTag(xml, name, index);
    const close = xml.indexOf('</' + name + '>', index);
    if (close === -1) return xml.length;
    if (open !== -1 && open < close) {
      depth += 1;
      index = open + name.length + 1;
    } else {
      depth -= 1;
      index = close + name.length + 3;
      if (depth === 0) return index;
    }
  }
}

/* ========================= ПАРАГРАФЫ ============================= */

/** Разбирает один <w:r> в текст и признак цветной подсветки (w:shd). */
function parseRuns(paragraphXml) {
  const runs = [];
  const runRe = /<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>/g;
  let match;
  while ((match = runRe.exec(paragraphXml))) {
    const runXml = match[1];
    let text = '';
    const chunkRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab(?:\s[^>]*)?\/>|<w:br(?:\s[^>]*)?\/>/g;
    let chunk;
    while ((chunk = chunkRe.exec(runXml))) {
      text += chunk[1] !== undefined ? decodeXml(chunk[1]) : ' ';
    }
    const shading = /<w:shd[^>]*w:fill="([0-9A-Fa-f]{6})"/.exec(runXml);
    runs.push({ text, highlighted: Boolean(shading) });
  }
  return runs;
}

function parseParagraph(paragraphXml) {
  const style = (/<w:pStyle[^>]*w:val="([^"]*)"/.exec(paragraphXml) || [])[1] || '';
  const runs = parseRuns(paragraphXml);
  let text = '';
  const flags = [];
  for (const run of runs) {
    text += run.text;
    for (let i = 0; i < run.text.length; i++) flags.push(run.highlighted);
  }
  return {
    style,
    text,
    flags,
    hasImage: /<w:drawing[\s>]/.test(paragraphXml),
  };
}

/** Превращает массив флагов в отсортированные диапазоны подсветки. */
function highlightRanges(flags) {
  const ranges = [];
  let start = -1;
  for (let i = 0; i < flags.length; i++) {
    if (flags[i] && start === -1) start = i;
    if (start !== -1 && (!flags[i] || i === flags.length - 1)) {
      const end = flags[i] ? i + 1 : i;
      if (end > start) ranges.push([start, end]);
      start = -1;
    }
  }
  return ranges;
}

function hasFlag(flags, from, to) {
  for (let i = from; i < to && i < flags.length; i++) {
    if (flags[i]) return true;
  }
  return false;
}

/** Делит текст на предложения и помечает те, что содержат подсветку. */
function sentences(text, flags) {
  const out = [];
  const isSpace = (ch) => ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\u00A0';
  const isPunct = (ch) => ch === '.' || ch === '!' || ch === '?' || ch === '…';
  let start = -1;

  for (let i = 0; i < text.length; i++) {
    if (start === -1 && !isSpace(text[i])) start = i;
    if (start === -1 || !isPunct(text[i])) continue;

    let j = i + 1;
    while (j < text.length && isPunct(text[j])) j++;
    if (j < text.length && !isSpace(text[j])) continue;

    const chunk = text.slice(start, j).replace(/\s+/g, ' ').trim();
    if (chunk) out.push({ text: chunk, highlighted: hasFlag(flags, start, j) });
    start = -1;
    i = j - 1;
  }

  if (start !== -1) {
    const chunk = text.slice(start).replace(/\s+/g, ' ').trim();
    if (chunk) out.push({ text: chunk, highlighted: hasFlag(flags, start, text.length) });
  }
  return out;
}

/* =========================== ТАБЛИЦЫ ============================= */

function parseTable(tableXml) {
  const rows = [];
  let rowIndex = 0;
  while ((rowIndex = findTag(tableXml, 'w:tr', rowIndex)) !== -1) {
    const rowEnd = findMatching(tableXml, 'w:tr', rowIndex);
    const rowXml = tableXml.slice(rowIndex, rowEnd);
    const cells = [];
    let cellIndex = 0;
    while ((cellIndex = findTag(rowXml, 'w:tc', cellIndex)) !== -1) {
      const cellEnd = findMatching(rowXml, 'w:tc', cellIndex);
      const cellXml = rowXml.slice(cellIndex, cellEnd);
      const paragraphs = [];
      let pIndex = 0;
      while ((pIndex = findTag(cellXml, 'w:p', pIndex)) !== -1) {
        const pEnd = cellXml.indexOf('</w:p>', pIndex);
        const pXml = cellXml.slice(pIndex, pEnd === -1 ? cellXml.length : pEnd + 6);
        const text = parseParagraph(pXml).text.replace(/[ \t]+/g, ' ').trim();
        if (text) paragraphs.push(text);
        pIndex = pEnd === -1 ? cellXml.length : pEnd + 6;
      }
      cells.push(paragraphs.join('\n'));
      cellIndex = cellEnd;
    }
    rows.push(cells);
    rowIndex = rowEnd;
  }
  return rows;
}

/* ======================== СБОРКА ГЛАВ ============================ */

/* В книге у главы «Зачем учиться писать…» нет заголовка в тексте —
   она есть только в оглавлении. Восстанавливаем её по первой фразе. */
const RECOVERY_TRIGGER = /^Вы бы хотели научиться ремонтировать/u;
const RECOVERY_FALLBACK_TITLE = 'Зачем учиться писать на иностранном языке?';

function cleanTitle(text) {
  return text.replace(/\s+/g, ' ').replace(/\s+([.,!?…])/g, '$1').trim();
}

function main() {
  const buf = readFileSync(DOCX_PATH);
  const entries = readZipEntries(buf);

  const documentEntry = entries.find((e) => e.name === 'word/document.xml');
  if (!documentEntry) throw new Error('В DOCX не найден word/document.xml.');

  let xml = readZipEntry(buf, documentEntry).toString('utf8');
  if (xml.charCodeAt(0) === 0xfeff) xml = xml.slice(1);

  const bodyStart = xml.indexOf('<w:body');
  const bodyEnd = xml.lastIndexOf('</w:body>');
  if (bodyStart === -1 || bodyEnd === -1) throw new Error('Не найден раздел w:body.');
  const bodyXml = xml.slice(xml.indexOf('>', bodyStart) + 1, bodyEnd);

  /* --- картинка из книги --- */
  const media = entries.find((e) => /^word\/media\/image1\.(png|jpe?g|gif)$/i.test(e.name));
  let imageFile = '';
  if (media) {
    const imageBuf = readZipEntry(buf, media);
    let ext = 'png';
    if (imageBuf[0] === 0xff && imageBuf[1] === 0xd8) ext = 'jpg';
    else if (imageBuf.slice(0, 6).toString('ascii') === 'GIF87a' || imageBuf.slice(0, 6).toString('ascii') === 'GIF89a') ext = 'gif';
    imageFile = 'chart.' + ext;
    mkdirSync(IMG_DIR, { recursive: true });
    writeFileSync(join(IMG_DIR, imageFile), imageBuf);
  }

  /* --- разбор тела документа: абзацы и таблицы по порядку --- */
  const elements = [];
  let cursor = 0;
  while (cursor < bodyXml.length) {
    const pIndex = findTag(bodyXml, 'w:p', cursor);
    const tIndex = findTag(bodyXml, 'w:tbl', cursor);
    if (pIndex === -1 && tIndex === -1) break;

    if (tIndex !== -1 && (pIndex === -1 || tIndex < pIndex)) {
      const end = findMatching(bodyXml, 'w:tbl', tIndex);
      elements.push({ kind: 'table', xml: bodyXml.slice(tIndex, end) });
      cursor = end;
    } else {
      const end = bodyXml.indexOf('</w:p>', pIndex);
      const stop = end === -1 ? bodyXml.length : end + 6;
      elements.push({ kind: 'paragraph', xml: bodyXml.slice(pIndex, stop) });
      cursor = stop;
    }
  }

  /* --- главы --- */
  const chapters = [];
  const frontMatter = [];
  const warnings = [];
  let title = '';
  let author = '';
  let current = null;
  let recoveryDone = false;

  const startChapter = (rawTitle) => {
    const cleaned = cleanTitle(rawTitle);
    if (!cleaned) return;
    let chapterTitle = cleaned;
    let intro = '';
    const split = /^(.+?[.!?…])\s+(\S[\s\S]*)$/u.exec(cleaned);
    if (split) {
      chapterTitle = split[1];
      intro = split[2];
    }
    current = { title: chapterTitle, preview: [], blocks: [] };
    if (intro) current.blocks.push({ type: 'p', text: intro, hl: [] });
    chapters.push(current);
  };

  for (const element of elements) {
    if (element.kind === 'table') {
      if (current) current.blocks.push({ type: 'table', rows: parseTable(element.xml) });
      continue;
    }

    const paragraph = parseParagraph(element.xml);
    const text = paragraph.text.trim();

    if (paragraph.style === 'Title') {
      if (!author && /maximov/i.test(paragraph.text)) author = text.replace(/\.$/, '');
      else if (!title && text) title = text.replace(/\.$/, '');
      continue;
    }

    if (paragraph.style === 'Heading1') {
      startChapter(paragraph.text);
      continue;
    }

    if (!current) {
      if (text) frontMatter.push(text);
      continue;
    }

    /* Восстановление главы без заголовка в тексте книги. */
    if (!recoveryDone && RECOVERY_TRIGGER.test(text)) {
      const already = chapters.some((chapter) => /писать/u.test(chapter.title));
      if (!already) {
        const fromContents = frontMatter.find((line) => /Зачем учиться писать/u.test(line));
        startChapter(fromContents || RECOVERY_FALLBACK_TITLE);
        recoveryDone = true;
        warnings.push('Восстановлена глава без заголовка: «' + current.title + '».');
      }
    }

    if (paragraph.hasImage) {
      if (imageFile) {
        current.blocks.push({ type: 'img', src: 'assets/img/' + imageFile, alt: CHART_ALT });
      } else {
        warnings.push('Найден рисунок, но файл изображения отсутствует.');
      }
    }

    if (!text) continue;

    const flags = paragraph.flags;
    for (const sentence of sentences(paragraph.text, flags)) {
      if (!sentence.highlighted) continue;
      if (!/[A-Za-zА-Яа-яЁё]/.test(sentence.text)) continue;
      if (!current.preview.includes(sentence.text)) current.preview.push(sentence.text);
    }

    const lead = paragraph.text.search(/\S/);
    const trail = paragraph.text.search(/\s*$/);
    const plain = paragraph.text.slice(lead, trail);
    const hl = [];
    for (const [from, to] of highlightRanges(flags)) {
      const start = Math.max(0, from - lead);
      const end = Math.min(plain.length, to - lead);
      if (end <= start) continue;
      if (!/\S/.test(plain.slice(start, end))) continue;
      const last = hl[hl.length - 1];
      if (last && last[1] >= start) last[1] = Math.max(last[1], end);
      else hl.push([start, end]);
    }
    current.blocks.push({ type: 'p', text: plain, hl });
  }

  const published = chapters.filter((chapter) => chapter.blocks.length > 0);
  for (const chapter of chapters) {
    if (chapter.blocks.length === 0) {
      warnings.push('Пропущена пустая глава: «' + chapter.title + '».');
    }
  }

  const data = {
    lang: 'ru',
    title: title || 'Как стать носителем иностранных языков за 4 месяца',
    author: author || 'Maximov Alexander',
    chapters: published.map((chapter, index) => ({
      id: 'chapter-' + (index + 1),
      title: chapter.title,
      preview: chapter.preview,
      blocks: chapter.blocks,
    })),
  };

  mkdirSync(dirname(DATA_PATH), { recursive: true });
  const header =
    '/* Файл создан автоматически из Ru.docx скриптом tools/build-book.mjs.\n' +
    '   Не редактируйте вручную — правьте книгу и запускайте: node tools/build-book.mjs */\n';
  writeFileSync(DATA_PATH, header + 'window.BOOK_DATA = ' + JSON.stringify(data, null, 2) + ';\n', 'utf8');

  const withoutPreview = data.chapters.filter((chapter) => chapter.preview.length === 0).length;
  console.log('Готово.');
  console.log('  Книга:        ' + data.title);
  console.log('  Автор:        ' + data.author);
  console.log('  Глав:         ' + data.chapters.length + ' (без превью: ' + withoutPreview + ')');
  console.log('  Файл данных:  ' + DATA_PATH.slice(ROOT.length + 1));
  if (imageFile) console.log('  Иллюстрация:  assets/img/' + imageFile);
  for (const warning of warnings) console.log('  ! ' + warning);
}

main();
