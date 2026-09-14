import type { ChannelMessage, DirectMessage, GroupMessage } from '@wapve/contracts';

export type MobileMessage = ChannelMessage | DirectMessage | GroupMessage;

function callDuration(seconds: number | null | undefined) {
  if (!seconds) return null;
  if (seconds < 60) return `${seconds} sn`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes} dk ${remainder} sn` : `${minutes} dk`;
}

export function systemMessageLabel(message: MobileMessage): string | null {
  if (!('systemAction' in message) || !message.systemAction) return null;
  if (message.systemAction === 'CALL_STARTED') return 'Arama başlatıldı';
  if (message.systemAction === 'CALL_ENDED') {
    const duration = callDuration(
      'systemDurationSeconds' in message ? message.systemDurationSeconds : null,
    );
    return duration ? `Arama sona erdi · ${duration}` : 'Cevapsız arama';
  }
  if ('kind' in message && message.kind === 'SYSTEM_MODERATION') {
    const target = 'systemTarget' in message ? message.systemTarget : null;
    return target
      ? `${message.systemAction.replaceAll('_', ' ')} · ${target}`
      : message.systemAction.replaceAll('_', ' ');
  }
  return 'Wapve sistem mesajı';
}

function plainPreview(content: string): string {
  return content
    .replace(/\|\|[\s\S]*?\|\|/g, '•••')
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, '$1')
    .replace(/(\*\*|__|~~|`)(.+?)\1/g, '$2')
    .replace(/\s+/g, ' ')
    .trim();
}

export function messagePreview(message: MobileMessage | null | undefined): string {
  if (!message) return 'Henüz mesaj yok';
  if (message.deleted) return 'Mesaj silindi';
  const system = systemMessageLabel(message);
  if (system) return system;
  if (message.content?.trim()) return plainPreview(message.content);
  if (message.forwardedFrom?.excerpt?.trim()) return `İletildi: ${plainPreview(message.forwardedFrom.excerpt)}`;
  if (message.gif) return `GIF · ${message.gif.alt}`;
  const firstAttachment = message.attachments[0];
  if (firstAttachment) {
    if (firstAttachment.kind === 'IMAGE') return 'Fotoğraf';
    if (firstAttachment.kind === 'VIDEO') return 'Video';
    if (firstAttachment.kind === 'AUDIO') return 'Sesli mesaj';
    return firstAttachment.name;
  }
  if ('poll' in message && message.poll) return `Anket · ${message.poll.question}`;
  return 'Desteklenmeyen mesaj';
}

export function isSystemMessage(message: MobileMessage) {
  return Boolean(systemMessageLabel(message));
}
