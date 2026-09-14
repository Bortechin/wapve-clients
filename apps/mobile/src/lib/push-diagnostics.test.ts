import { describe, expect, it } from '@jest/globals';
import { classifyPushFailure } from './push-diagnostics';

describe('classifyPushFailure', () => {
  it('adds an actionable Firebase hint for missing native configuration', () => {
    expect(classifyPushFailure('token', new Error('Default FirebaseApp is not initialized')).detail)
      .toContain('google-services.json');
  });

  it('keeps API registration failures distinct from token failures', () => {
    expect(classifyPushFailure('server', { code: 'NETWORK_ERROR' })).toEqual({
      phase: 'server_error',
      detail: 'Token sunucuya kaydedilemedi: NETWORK_ERROR',
    });
  });
});
