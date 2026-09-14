import { describe, expect, it } from 'vitest';
import {
  defaultVoiceShortcuts,
  formatVoiceShortcut,
  matchesVoiceShortcut,
  parseVoiceShortcuts,
  shortcutFromKeyboardEvent,
} from './voice-shortcuts';

describe('voice shortcuts', () => {
  it('falls back safely when stored data is malformed', () => {
    expect(parseVoiceShortcuts('{broken')).toEqual(defaultVoiceShortcuts);
  });

  it('preserves valid custom shortcuts and fills missing actions', () => {
    const shortcuts = parseVoiceShortcuts(
      JSON.stringify({
        toggleMute: { code: 'KeyQ', ctrl: false, alt: true, shift: false, meta: false },
      }),
    );
    expect(shortcuts.toggleMute?.code).toBe('KeyQ');
    expect(shortcuts.toggleDeafen).toEqual(defaultVoiceShortcuts.toggleDeafen);
  });

  it('captures, matches and formats modifier combinations', () => {
    const event = {
      code: 'KeyM',
      ctrlKey: true,
      altKey: false,
      shiftKey: true,
      metaKey: false,
    };
    const binding = shortcutFromKeyboardEvent(event);
    expect(matchesVoiceShortcut(event, binding)).toBe(true);
    expect(formatVoiceShortcut(binding)).toBe('Ctrl + Shift + M');
  });

  it('does not capture a modifier by itself', () => {
    expect(
      shortcutFromKeyboardEvent({
        code: 'ControlLeft',
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        metaKey: false,
      }),
    ).toBeNull();
  });
});
