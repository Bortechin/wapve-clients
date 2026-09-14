import { describe, expect, it } from '@jest/globals';
import { clampCropTranslation, cropRectangle } from './image-crop';

describe('shared image crop geometry', () => {
  it('centers a cover crop at zoom 1', () => {
    expect(cropRectangle({
      sourceWidth: 2000,
      sourceHeight: 1000,
      frameWidth: 400,
      frameHeight: 400,
      zoom: 1,
      translateX: 0,
      translateY: 0,
    })).toEqual({ originX: 500, originY: 0, width: 1000, height: 1000 });
  });

  it('keeps a zoomed and translated crop inside the source image', () => {
    const crop = cropRectangle({
      sourceWidth: 1200,
      sourceHeight: 800,
      frameWidth: 600,
      frameHeight: 300,
      zoom: 3,
      translateX: 10000,
      translateY: -10000,
    });
    expect(crop.originX).toBeGreaterThanOrEqual(0);
    expect(crop.originY).toBeGreaterThanOrEqual(0);
    expect(crop.originX + crop.width).toBeLessThanOrEqual(1200);
    expect(crop.originY + crop.height).toBeLessThanOrEqual(800);
  });

  it('clamps panning so the crop frame never exposes an empty edge', () => {
    expect(clampCropTranslation(800, 400, 400, 400, 2, 999, -999)).toEqual({ x: 600, y: -200 });
  });
});
