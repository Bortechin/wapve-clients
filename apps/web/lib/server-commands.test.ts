import { describe, expect, it } from 'vitest';
import { availableCommands, parseServerCommand } from './server-commands';

const id = '019a0000-0000-7000-8000-000000000001';
const members = [{ id }];
describe('server commands', () => {
  it('filters commands by the existing permissions', () => {
    expect(availableCommands([]).map(item => item.name)).toEqual(['help']);
    expect(availableCommands(['TIMEOUT_MEMBERS']).map(item => item.name)).toEqual(['help', 'warn', 'timeout', 'untimeout']);
    expect(() => parseServerCommand(`/ban <@${id}>`, [], members, 'tr')).toThrow();
  });
  it('preserves a multi-word reason and never deletes ban history', () => {
    expect(parseServerCommand(`/ban <@${id}> spam ve hakaret`, ['BAN_MEMBERS'], members, 'tr')).toMatchObject({ method: 'POST', body: { reason: 'spam ve hakaret', deleteMessageSeconds: '0' } });
  });
  it('requires an actual selected member, a bounded duration and reason', () => {
    for (const value of ['/timeout @isim 10', `/timeout <@${id}> 0`, `/timeout <@${id}> 40321`, `/timeout <@${id}> 1.5`, `/timeout <@${id}> -1`, `/timeout <@${id}>`]) expect(() => parseServerCommand(value, ['TIMEOUT_MEMBERS'], members, 'tr')).toThrow();
    expect(() => parseServerCommand(`/warn <@${id}> ${'a'.repeat(513)}`, ['TIMEOUT_MEMBERS'], members, 'tr')).toThrow();
    expect(() => parseServerCommand(`/kick <@${id}>`, ['KICK_MEMBERS'], [], 'tr')).toThrow();
    expect(parseServerCommand(`/timeout <@${id}> 15 spam`, ['TIMEOUT_MEMBERS'], members, 'tr')).toMatchObject({ body: { durationMinutes: 15, reason: 'spam' } });
    expect(parseServerCommand(`/untimeout <@${id}>`, ['TIMEOUT_MEMBERS'], members, 'tr')).toMatchObject({ body: { durationMinutes: null } });
  });
  it('does not accept unknown commands or arguments to help', () => {
    expect(() => parseServerCommand('/unknown', [], [], 'en')).toThrow();
    expect(() => parseServerCommand('/help extra', [], [], 'en')).toThrow();
    expect(parseServerCommand('/help', [], [], 'en')).toEqual({ kind: 'help' });
  });
});
