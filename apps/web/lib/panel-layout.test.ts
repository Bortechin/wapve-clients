import { describe, expect, it } from 'vitest';
import { PANEL_LAYOUT_DEFAULTS, clampPanelWidth, parsePanelLayout } from './panel-layout';

describe('panel layout', () => {
  it('clamps persisted widths to the supported desktop range', () => {
    expect(parsePanelLayout('{"channel":900,"member":900,"voiceChat":900}')).toEqual({
      channel: 430,
      member: 320,
      voiceChat: 680,
    });
  });

  it('falls back safely for invalid storage values', () => {
    expect(parsePanelLayout('not-json')).toEqual(PANEL_LAYOUT_DEFAULTS);
    expect(clampPanelWidth('channel', Number.NaN)).toBe(PANEL_LAYOUT_DEFAULTS.channel);
  });
});
