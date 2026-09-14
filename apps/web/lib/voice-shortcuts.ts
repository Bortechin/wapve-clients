export const voiceShortcutActions = [
  'toggleMute',
  'toggleDeafen',
  'toggleCamera',
  'toggleScreenShare',
  'toggleVideoPause',
  'disconnect',
] as const;

export type VoiceShortcutAction = (typeof voiceShortcutActions)[number];

export type VoiceShortcutBinding = {
  code: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
};

export type VoiceShortcuts = Record<VoiceShortcutAction, VoiceShortcutBinding | null>;

export const VOICE_SHORTCUTS_STORAGE_KEY = 'wapve:voice-shortcuts:v1';

export const defaultVoiceShortcuts: VoiceShortcuts = {
  toggleMute: { code: 'KeyM', ctrl: true, alt: false, shift: true, meta: false },
  toggleDeafen: { code: 'KeyD', ctrl: true, alt: false, shift: true, meta: false },
  toggleCamera: null,
  toggleScreenShare: null,
  toggleVideoPause: { code: 'KeyP', ctrl: false, alt: true, shift: false, meta: false },
  disconnect: null,
};

function isBinding(value: unknown): value is VoiceShortcutBinding {
  if (!value || typeof value !== 'object') return false;
  const binding = value as Partial<VoiceShortcutBinding>;
  return (
    typeof binding.code === 'string' &&
    binding.code.length > 0 &&
    binding.code.length <= 64 &&
    typeof binding.ctrl === 'boolean' &&
    typeof binding.alt === 'boolean' &&
    typeof binding.shift === 'boolean' &&
    typeof binding.meta === 'boolean'
  );
}

export function parseVoiceShortcuts(value: string | null): VoiceShortcuts {
  if (!value) return { ...defaultVoiceShortcuts };
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.fromEntries(
      voiceShortcutActions.map((action) => {
        const binding = parsed[action];
        return [
          action,
          binding === null || isBinding(binding) ? binding : defaultVoiceShortcuts[action],
        ];
      }),
    ) as VoiceShortcuts;
  } catch {
    return { ...defaultVoiceShortcuts };
  }
}

export function shortcutFromKeyboardEvent(
  event: Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>,
): VoiceShortcutBinding | null {
  if (
    [
      'ControlLeft',
      'ControlRight',
      'AltLeft',
      'AltRight',
      'ShiftLeft',
      'ShiftRight',
      'MetaLeft',
      'MetaRight',
    ].includes(event.code)
  )
    return null;
  return {
    code: event.code,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
  };
}

export function matchesVoiceShortcut(
  event: Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'>,
  binding: VoiceShortcutBinding | null,
): boolean {
  return Boolean(
    binding &&
      event.code === binding.code &&
      event.ctrlKey === binding.ctrl &&
      event.altKey === binding.alt &&
      event.shiftKey === binding.shift &&
      event.metaKey === binding.meta,
  );
}

export function voiceShortcutId(binding: VoiceShortcutBinding | null): string | null {
  if (!binding) return null;
  return [
    binding.ctrl ? 'Ctrl' : '',
    binding.alt ? 'Alt' : '',
    binding.shift ? 'Shift' : '',
    binding.meta ? 'Meta' : '',
    binding.code,
  ]
    .filter(Boolean)
    .join('+');
}

export function formatVoiceShortcut(binding: VoiceShortcutBinding | null): string {
  if (!binding) return '—';
  const key = binding.code
    .replace(/^Key/u, '')
    .replace(/^Digit/u, '')
    .replace('Space', 'Space')
    .replace('Arrow', '');
  return [
    binding.ctrl ? 'Ctrl' : '',
    binding.alt ? 'Alt' : '',
    binding.shift ? 'Shift' : '',
    binding.meta ? 'Meta' : '',
    key,
  ]
    .filter(Boolean)
    .join(' + ');
}

export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return Boolean(
    element?.closest(
      'input, textarea, select, [contenteditable="true"], [role="textbox"], [data-shortcut-capture="true"]',
    ),
  );
}
