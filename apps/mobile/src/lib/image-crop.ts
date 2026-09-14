export type CropRectangleInput = {
  sourceWidth: number;
  sourceHeight: number;
  frameWidth: number;
  frameHeight: number;
  zoom: number;
  translateX: number;
  translateY: number;
};

export function clampCropTranslation(
  renderedWidth: number,
  renderedHeight: number,
  frameWidth: number,
  frameHeight: number,
  zoom: number,
  translateX: number,
  translateY: number,
) {
  'worklet';
  const maxX = Math.max(0, (renderedWidth * zoom - frameWidth) / 2);
  const maxY = Math.max(0, (renderedHeight * zoom - frameHeight) / 2);
  return {
    x: Math.max(-maxX, Math.min(maxX, translateX)),
    y: Math.max(-maxY, Math.min(maxY, translateY)),
  };
}

export function cropRectangle(input: CropRectangleInput) {
  const safeSourceWidth = Math.max(1, input.sourceWidth);
  const safeSourceHeight = Math.max(1, input.sourceHeight);
  const safeFrameWidth = Math.max(1, input.frameWidth);
  const safeFrameHeight = Math.max(1, input.frameHeight);
  const safeZoom = Math.max(1, input.zoom);
  const baseScale = Math.max(safeFrameWidth / safeSourceWidth, safeFrameHeight / safeSourceHeight);
  const totalScale = baseScale * safeZoom;
  const width = Math.min(safeSourceWidth, safeFrameWidth / totalScale);
  const height = Math.min(safeSourceHeight, safeFrameHeight / totalScale);
  const originX = Math.max(0, Math.min(safeSourceWidth - width, (safeSourceWidth - width) / 2 - input.translateX / totalScale));
  const originY = Math.max(0, Math.min(safeSourceHeight - height, (safeSourceHeight - height) / 2 - input.translateY / totalScale));
  return { originX, originY, width, height };
}
