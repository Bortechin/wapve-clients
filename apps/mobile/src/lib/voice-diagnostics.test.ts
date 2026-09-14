import { describe, expect, it } from '@jest/globals';
import { diagnosticErrorName } from './voice-diagnostics';

describe('diagnosticErrorName', () => {
  it('keeps only the server-safe error class', () => {
    expect(diagnosticErrorName(Object.assign(new Error('failed'), { name: 'Not Allowed-Error' }))).toBe('NotAllowedError');
  });

  it('does not send values that cannot satisfy the contract', () => {
    expect(diagnosticErrorName('404 failure')).toBeUndefined();
  });
});
