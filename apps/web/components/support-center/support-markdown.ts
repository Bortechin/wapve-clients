function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

function inlineMarkdown(value: string): string {
  const tokens: string[] = [];
  const token = (html: string): string => {
    const index = tokens.push(html) - 1;
    return `%%WAPVETOKEN${index}%%`;
  };

  let html = escapeHtml(value)
    .replace(/`([^`\n]+)`/gu, (_match, code: string) => token(`<code>${code}</code>`))
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/gu, (_match, label: string, href: string) =>
      token(`<a href="${href}">${inlineMarkdown(label)}</a>`),
    )
    .replace(/\*\*([^*]+)\*\*/gu, '<strong>$1</strong>')
    .replace(/__([^_]+)__/gu, '<u>$1</u>')
    .replace(/~~([^~]+)~~/gu, '<del>$1</del>')
    .replace(/\*([^*]+)\*/gu, '<em>$1</em>')
    .replace(/_([^_]+)_/gu, '<em>$1</em>');

  html = html.replace(
    /%%WAPVETOKEN(\d+)%%/gu,
    (_match, index: string) => tokens[Number(index)] ?? '',
  );
  return html;
}

function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/u, '')
    .replace(/\|$/u, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableDivider(line: string): boolean {
  const cells = tableCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/u.test(cell));
}

function startsBlock(lines: string[], index: number): boolean {
  const line = lines[index] ?? '';
  const next = lines[index + 1] ?? '';
  return (
    !line.trim() ||
    /^#{3,4}\s/u.test(line) ||
    /^```/u.test(line) ||
    /^>\s?/u.test(line) ||
    /^-\s/u.test(line) ||
    /^\d+\.\s/u.test(line) ||
    (line.trim().startsWith('|') && next.trim().startsWith('|') && isTableDivider(next))
  );
}

export function formatSupportArticleHtml(rawText: string): string {
  const lines = rawText.replace(/\r\n?/gu, '\n').split('\n');
  const blocks: string[] = [];

  for (let index = 0; index < lines.length; ) {
    const line = lines[index] ?? '';
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^```[^\s]*\s*$/u);
    if (fence) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/u.test(lines[index] ?? '')) {
        code.push(lines[index] ?? '');
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{3,4})\s+(.+)$/u);
    if (heading) {
      const level = heading[1]!.length;
      blocks.push(`<h${level}>${inlineMarkdown(heading[2]!)}</h${level}>`);
      index += 1;
      continue;
    }

    if (
      line.trim().startsWith('|') &&
      (lines[index + 1] ?? '').trim().startsWith('|') &&
      isTableDivider(lines[index + 1] ?? '')
    ) {
      const headers = tableCells(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && (lines[index] ?? '').trim().startsWith('|')) {
        rows.push(tableCells(lines[index] ?? ''));
        index += 1;
      }
      blocks.push(
        `<table><thead><tr>${headers.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join('')}</tr></thead><tbody>${rows
          .map(
            (row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join('')}</tr>`,
          )
          .join('')}</tbody></table>`,
      );
      continue;
    }

    const unordered = /^-\s/u.test(line);
    const ordered = /^\d+\.\s/u.test(line);
    if (unordered || ordered) {
      const items: string[] = [];
      const pattern = unordered ? /^-\s+(.+)$/u : /^\d+\.\s+(.+)$/u;
      while (index < lines.length) {
        const item = (lines[index] ?? '').match(pattern);
        if (!item) break;
        items.push(`<li>${inlineMarkdown(item[1]!)}</li>`);
        index += 1;
      }
      const tag = unordered ? 'ul' : 'ol';
      blocks.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }

    if (/^>\s?/u.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/u.test(lines[index] ?? '')) {
        quote.push((lines[index] ?? '').replace(/^>\s?/u, ''));
        index += 1;
      }
      blocks.push(`<blockquote>${quote.map(inlineMarkdown).join('<br />')}</blockquote>`);
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && !startsBlock(lines, index)) {
      paragraph.push(lines[index] ?? '');
      index += 1;
    }
    if (paragraph.length) blocks.push(`<p>${paragraph.map(inlineMarkdown).join('<br />')}</p>`);
  }

  return blocks.join('');
}
