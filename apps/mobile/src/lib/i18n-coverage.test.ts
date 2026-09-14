import { describe, expect, it } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { translateLiteralForLocale } from './i18n';

const roots = [join(process.cwd(), 'app'), join(process.cwd(), 'src', 'components'), join(process.cwd(), 'src', 'lib')];
const turkishCopy = /[çğıöşüÇĞİÖŞÜ]|\b(?:ve|veya|için|ile|olarak|değil|yok|var|geri|kapat|aç|gönder|sunucu|kanal|mesaj|arama|ayarlar|profil|kullanıcı|arkadaş|ses|görüntü|bildirim|davet|bağlantı|oluştur|kaydet|sil|seç|azalt|tümü|henüz|bugün|dün|şimdi|son|yeni|hata|işlem|cihaz|oturum|parola|gizlilik|koşulları|konuşmak)\b/iu;
const dataOnly = new Set([
  'amına koyayım', 'avradını', 'dürzü', 'gerizekalı', 'göt', 'götveren', 'hıyar', 'oç',
  'orospu çocuğu', 'piç', 'puşt', 'sürtük', 'şerefsiz', 'şerefsizlik', 'taşak', 'yavşak',
  'kanal-adı', 'ses-kanalı', 'wapve-sesli-mesaj-1.m4a',
]);

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/u.test(entry.name) && !/\.test\./u.test(entry.name) && entry.name !== 'i18n.tsx' ? [path] : [];
  });
}

function copyIn(path: string): string[] {
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const values: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) values.push(node.text);
    else if (ts.isJsxText(node)) values.push(node.text.trim());
    else if (ts.isTemplateExpression(node)) values.push(`${node.head.text}${node.templateSpans.map((span) => `1${span.literal.text}`).join('')}`);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return values;
}

describe('mobile translation coverage', () => {
  it('has an English resolution for every static Turkish user-facing string', () => {
    const untranslated = [...new Set(roots.flatMap(sourceFiles).flatMap(copyIn))]
      .map((value) => value.trim())
      .filter((value) => value.length > 1 && turkishCopy.test(value) && !dataOnly.has(value))
      .filter((value) => translateLiteralForLocale(value, 'en') === value)
      .sort((left, right) => left.localeCompare(right, 'tr'));
    expect(untranslated).toEqual([]);
  });
});
