export const PANEL_LAYOUT_STORAGE_KEY = 'wapve:panel-layout:v1';

export const PANEL_LAYOUT_DEFAULTS = {
  channel: 270,
  member: 250,
  voiceChat: 400,
} as const;

const PANEL_LIMITS = {
  channel: { min: 220, max: 430 },
  member: { min: 220, max: 320 },
  voiceChat: { min: 300, max: 680 },
} as const;

export type PanelSide = keyof typeof PANEL_LAYOUT_DEFAULTS;
export type PanelLayout = Record<PanelSide, number>;

export function clampPanelWidth(side: PanelSide, width: number): number {
  const limits = PANEL_LIMITS[side];
  if (!Number.isFinite(width)) return PANEL_LAYOUT_DEFAULTS[side];
  return Math.min(limits.max, Math.max(limits.min, Math.round(width)));
}

export function parsePanelLayout(value: string | null): PanelLayout {
  if (!value) return { ...PANEL_LAYOUT_DEFAULTS };
  try {
    const parsed = JSON.parse(value) as Partial<Record<PanelSide, unknown>>;
    return {
      channel: clampPanelWidth(
        'channel',
        typeof parsed.channel === 'number' ? parsed.channel : PANEL_LAYOUT_DEFAULTS.channel,
      ),
      member: clampPanelWidth(
        'member',
        typeof parsed.member === 'number' ? parsed.member : PANEL_LAYOUT_DEFAULTS.member,
      ),
      voiceChat: clampPanelWidth(
        'voiceChat',
        typeof parsed.voiceChat === 'number' ? parsed.voiceChat : PANEL_LAYOUT_DEFAULTS.voiceChat,
      ),
    };
  } catch {
    return { ...PANEL_LAYOUT_DEFAULTS };
  }
}
