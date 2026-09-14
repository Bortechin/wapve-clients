import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = join(root, 'src', 'lib', 'mobile-literals.en.json');
const roots = [join(root, 'app'), join(root, 'src', 'components'), join(root, 'src', 'lib')];
const turkishCopy = /[çğıöşüÇĞİÖŞÜ]|\b(?:ve|veya|için|ile|olarak|değil|yok|var|geri|kapat|aç|gönder|sunucu|kanal|mesaj|arama|ayarlar|profil|kullanıcı|arkadaş|ses|görüntü|bildirim|davet|bağlantı|oluştur|kaydet|sil|seç|azalt|tümü|henüz|bugün|dün|şimdi|son|yeni|hata|işlem|cihaz|oturum|parola|gizlilik|koşulları|konuşmak)\b/iu;
const dataOnly = new Set([
  'amına koyayım', 'avradını', 'dürzü', 'gerizekalı', 'göt', 'götveren', 'hıyar', 'oç',
  'orospu çocuğu', 'piç', 'puşt', 'sürtük', 'şerefsiz', 'şerefsizlik', 'taşak', 'yavşak',
  'kanal-adı', 'ses-kanalı', 'wapve-sesli-mesaj-{0}.m4a',
]);

function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return filesIn(path);
    return /\.(?:ts|tsx)$/u.test(entry.name) && !/\.test\./u.test(entry.name) && entry.name !== 'i18n.tsx' ? [path] : [];
  });
}

function valuesIn(path) {
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const values = [];
  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) values.push(node.text);
    else if (ts.isJsxText(node)) values.push(node.text.trim());
    else if (ts.isTemplateExpression(node)) values.push(`${node.head.text}${node.templateSpans.map((span, index) => `{${index}}${span.literal.text}`).join('')}`);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return values;
}

const sourceValues = [...new Set(roots.flatMap(filesIn).flatMap(valuesIn))]
  .map((value) => value.trim())
  .filter((value) => value.length > 1 && turkishCopy.test(value) && !dataOnly.has(value));
const existing = JSON.parse(readFileSync(outputPath, 'utf8'));
const missing = sourceValues.filter((value) => !existing[value]);

const separator = '<<<WAPVE_TRANSLATION_BREAK>>>';

async function requestTranslation(value) {
  const url = new URL('https://clients5.google.com/translate_a/t');
  url.search = new URLSearchParams({ client: 'dict-chrome-ex', sl: 'tr', tl: 'en', q: value }).toString();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      const translated = (typeof body[0] === 'string' ? body.join('') : body[0].map((part) => part[0]).join('')).trim();
      if (translated) return translated;
    } catch (error) {
      if (attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, 5_000 * (attempt + 1)));
    }
  }
  return value;
}

function batches(values) {
  const result = [];
  let current = [];
  let size = 0;
  for (const value of values) {
    if (current.length >= 16 || size + value.length > 2_800) {
      result.push(current);
      current = [];
      size = 0;
    }
    current.push(value);
    size += value.length;
  }
  if (current.length) result.push(current);
  return result;
}

const pendingBatches = batches(missing);
let completed = 0;
for (const batch of pendingBatches) {
  const joined = batch.join(`\n${separator}\n`);
  const translated = await requestTranslation(joined);
  const parts = translated.split(new RegExp(`\\s*${separator}\\s*`, 'u'));
  if (parts.length !== batch.length) throw new Error(`Translation batch split failed: ${parts.length}/${batch.length}`);
  batch.forEach((source, index) => { existing[source] = parts[index].trim(); });
  completed += batch.length;
  writeFileSync(outputPath, `${JSON.stringify(Object.fromEntries(Object.entries(existing).sort(([a], [b]) => a.localeCompare(b, 'tr'))), null, 2)}\n`);
  process.stdout.write(`\rTranslated ${completed}/${missing.length}`);
  await new Promise((resolve) => setTimeout(resolve, 800));
}
writeFileSync(outputPath, `${JSON.stringify(Object.fromEntries(Object.entries(existing).sort(([a], [b]) => a.localeCompare(b, 'tr'))), null, 2)}\n`);
process.stdout.write(`\rTranslated ${missing.length}/${missing.length}; ${sourceValues.length} literals covered.\n`);
