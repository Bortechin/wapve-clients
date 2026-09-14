'use client';

import { Download, ExternalLink, FileText, LoaderCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { MessageAttachment } from '@wapve/contracts';

const MAX_TEXT_PREVIEW_BYTES = 64 * 1024;

function isPlainText(attachment: MessageAttachment): boolean {
  return (
    attachment.contentType.toLocaleLowerCase().startsWith('text/') ||
    /\.(txt|log|csv|md|json|xml|yaml|yml|ini|cfg)$/iu.test(attachment.name)
  );
}

function safeDownloadName(name: string): string {
  const safe = Array.from(name, (character) =>
    /[\\/:*?"<>|]/u.test(character) || character.charCodeAt(0) < 0x20 ? '_' : character,
  ).join('');
  return safe.slice(0, 180) || 'download.txt';
}

export function TextAttachmentActions({
  attachment,
  locale,
}: {
  attachment: MessageAttachment;
  locale: 'tr' | 'en';
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const textFile = isPlainText(attachment);
  const canPreview = textFile && attachment.size <= MAX_TEXT_PREVIEW_BYTES;

  useEffect(() => {
    if (!open || !canPreview) return;
    const controller = new AbortController();
    setBusy(true);
    setError('');
    void fetch(attachment.url, { credentials: 'include', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('preview');
        if (Number(response.headers.get('content-length') ?? 0) > MAX_TEXT_PREVIEW_BYTES)
          throw new Error('large');
        const reader = response.body?.getReader();
        if (!reader) {
          const buffer = await response.arrayBuffer();
          if (buffer.byteLength > MAX_TEXT_PREVIEW_BYTES) throw new Error('large');
          return new TextDecoder().decode(buffer);
        }
        const chunks: Uint8Array[] = [];
        let total = 0;
        for (;;) {
          const next = await reader.read();
          if (next.done) break;
          total += next.value.byteLength;
          if (total > MAX_TEXT_PREVIEW_BYTES) {
            await reader.cancel();
            throw new Error('large');
          }
          chunks.push(next.value);
        }
        const merged = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.byteLength;
        }
        return new TextDecoder().decode(merged);
      })
      .then(setText)
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(caught instanceof Error && caught.message === 'large' ? 'large' : 'preview');
      })
      .finally(() => setBusy(false));
    return () => controller.abort();
  }, [attachment.url, canPreview, open]);

  return (
    <div className="message-file-actions">
      <FileText size={22} aria-hidden="true" />
      <span>
        <strong>{attachment.name}</strong>
        <small>{formatAttachmentSize(attachment.size, locale)}</small>
      </span>
      <a
        className="message-file-download"
        href={attachment.url}
        download={safeDownloadName(attachment.name)}
        aria-label={locale === 'tr' ? 'İndir' : 'Download'}
        title={locale === 'tr' ? 'İndir' : 'Download'}
      >
        <Download size={16} />
      </a>
      {canPreview && (
        <button
          type="button"
          className="message-file-open"
          onClick={() => setOpen(true)}
          aria-label={locale === 'tr' ? 'Aç' : 'Open'}
          title={locale === 'tr' ? 'Güvenli metin önizlemesi' : 'Safe text preview'}
        >
          <ExternalLink size={16} />
        </button>
      )}
      {open && canPreview && (
        <div className="text-preview-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <section
            className="text-preview-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={attachment.name}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <strong>{attachment.name}</strong>
              <button type="button" onClick={() => setOpen(false)} aria-label={locale === 'tr' ? 'Kapat' : 'Close'}>
                <X size={17} />
              </button>
            </header>
            {busy ? (
              <div className="text-preview-state"><LoaderCircle className="spin" size={18} /></div>
            ) : error ? (
              <div className="text-preview-state">
                {error === 'large'
                  ? locale === 'tr' ? 'Metin önizleme sınırı aşıldı; dosyayı indirin.' : 'Preview limit exceeded; download the file.'
                  : locale === 'tr' ? 'Dosya önizlenemedi; dosyayı indirin.' : 'The file could not be previewed; download it.'}
              </div>
            ) : (
              <pre>{text}</pre>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function formatAttachmentSize(bytes: number, locale: 'tr' | 'en'): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1024)} KB`;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`;
}
