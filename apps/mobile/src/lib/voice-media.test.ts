import { describe, expect, it } from '@jest/globals';
import { cameraConstraints } from './voice-media';

describe('camera constraints', () => {
  it('limits resolution and frame rate when reduced data is enabled', () => {
    const reduced = cameraConstraints({ reducedData: true });
    const normal = cameraConstraints({ reducedData: false });
    expect(reduced.width.max).toBeLessThan(normal.width.max);
    expect(reduced.frameRate.max).toBeLessThan(normal.frameRate.max);
  });
});
