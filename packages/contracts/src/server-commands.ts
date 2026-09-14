import type { ServerPermission } from './moderation.js';

export const serverCommands = [
  { name: 'help', permission: null, usage: '/help', tr: 'Kullanabileceğin komutlar', en: 'Your available commands' },
  { name: 'ban', permission: 'BAN_MEMBERS', usage: '/ban @kişi [sebep]', tr: 'Üyeyi yasakla', en: 'Ban a member' },
  { name: 'kick', permission: 'KICK_MEMBERS', usage: '/kick @kişi [sebep]', tr: 'Üyeyi sunucudan çıkar', en: 'Kick a member' },
  { name: 'warn', permission: 'TIMEOUT_MEMBERS', usage: '/warn @kişi [sebep]', tr: 'Üyeyi uyar', en: 'Warn a member' },
  { name: 'timeout', permission: 'TIMEOUT_MEMBERS', usage: '/timeout @kişi <dakika> [sebep]', tr: 'Üyeye zaman aşımı uygula', en: 'Time out a member' },
  { name: 'untimeout', permission: 'TIMEOUT_MEMBERS', usage: '/untimeout @kişi [sebep]', tr: 'Zaman aşımını kaldır', en: 'Remove a timeout' },
] as const;

export function availableCommands(permissions: readonly ServerPermission[]) {
  return serverCommands.filter(command => command.permission === null || permissions.includes(command.permission));
}

export function commandUsage(usage: string, locale: string): string {
  return locale === 'tr' ? usage : usage.replace('@kişi', '@member').replace('[sebep]', '[reason]').replace('<dakika>', '<minutes>');
}

export function parseServerCommand(value: string, permissions: readonly ServerPermission[], members: readonly { id: string }[], locale: string) {
  const fail = (tr: string, en: string): never => { throw new Error(locale === 'tr' ? tr : en); };
  const match = /^\/(\w+)(?:\s+([\s\S]*))?$/u.exec(value.trim());
  const command = availableCommands(permissions).find(item => item.name === match?.[1]?.toLowerCase());
  if (!command) return fail('Bilinmeyen komut veya bu komut için yetkin yok.', 'Unknown command or missing permission.');
  const args = match?.[2]?.trim() ?? '';
  if (command.name === 'help') {
    if (args) return fail('Kullanım: /help', 'Usage: /help');
    return { kind: 'help' as const };
  }
  const target = /^<@([0-9a-f-]+)>(?:\s+([\s\S]*))?$/iu.exec(args);
  const userId = target?.[1];
  if (!userId || !members.some(member => member.id === userId)) return fail('Hedef üyeyi @ listesinden seç. Kullanım: ' + command.usage, 'Select the target from the @ list. Usage: ' + commandUsage(command.usage, locale));
  let reason = target?.[2]?.trim() ?? '';
  let durationMinutes: number | null = null;
  if (command.name === 'timeout') {
    const duration = /^(\d+)(?:\s+([\s\S]*))?$/u.exec(reason);
    durationMinutes = Number(duration?.[1]);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 40_320) return fail('Süre 1–40320 dakika arasında tam sayı olmalı.', 'Duration must be an integer from 1 to 40320 minutes.');
    reason = duration?.[2]?.trim() ?? '';
  }
  if (reason.length > 512) return fail('Sebep en fazla 512 karakter olabilir.', 'Reason may contain at most 512 characters.');
  const timeout = command.name === 'timeout' || command.name === 'untimeout';
  return {
    kind: 'action' as const,
    name: command.name,
    path: timeout ? `members/${userId}/timeout` : `members/${userId}/actions/${command.name}`,
    method: timeout ? 'PATCH' : 'POST',
    body: timeout ? { durationMinutes, reason } : command.name === 'ban' ? { reason, deleteMessageSeconds: '0' } : { reason },
  };
}
