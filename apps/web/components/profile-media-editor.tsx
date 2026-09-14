'use client';

import * as Dialog from '@radix-ui/react-dialog';
import {
  Camera,
  ImagePlus,
  RotateCcw,
  RotateCw,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

export type ProfileMediaKind = 'avatar' | 'banner';

const STAGE_WIDTH = 520;
const STAGE_HEIGHT = 350;
const AVATAR_CROP = { width: 330, height: 330 };
const BANNER_CROP = { width: 500, height: 500 / 3 };

type Point = { x: number; y: number };

export function ProfileMediaEditor({
  kind,
  open,
  locale,
  currentUrl,
  busy,
  onOpenChange,
  onApply,
  onRemove,
}: {
  kind: ProfileMediaKind;
  open: boolean;
  locale: 'tr' | 'en';
  currentUrl: string | null;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (file: File) => Promise<boolean>;
  onRemove: () => Promise<boolean>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      setError('');
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [open]);

  const chooseFile = (file: File | undefined) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError(
        locale === 'tr' ? 'Bu görsel türü desteklenmiyor.' : 'This image type is not supported.',
      );
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(
        locale === 'tr' ? 'Görsel 5 MB’den küçük olmalı.' : 'The image must be smaller than 5 MB.',
      );
      return;
    }
    setError('');
    setSelectedFile(file);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="profile-media-overlay" />
        <Dialog.Content
          className={`profile-media-dialog${selectedFile ? ' profile-media-dialog--crop' : ''}`}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          {selectedFile ? (
            <ProfileCropper
              key={`${kind}:${selectedFile.name}:${selectedFile.lastModified}`}
              kind={kind}
              file={selectedFile}
              locale={locale}
              busy={busy}
              onBack={() => setSelectedFile(null)}
              onCancel={() => onOpenChange(false)}
              onApply={onApply}
            />
          ) : (
            <>
              <header className="profile-media-dialog-header">
                <Dialog.Title>
                  {kind === 'avatar'
                    ? locale === 'tr'
                      ? 'Bir Görsel Seç'
                      : 'Choose an Image'
                    : locale === 'tr'
                      ? 'Bir Banner Seç'
                      : 'Choose a Banner'}
                </Dialog.Title>
                <Dialog.Close
                  className="profile-media-close"
                  aria-label={locale === 'tr' ? 'Kapat' : 'Close'}
                >
                  <X size={22} />
                </Dialog.Close>
              </header>

              <button
                className="profile-media-upload-tile"
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                <span>
                  <ImagePlus size={29} />
                </span>
                <strong>{locale === 'tr' ? 'Görsel Yükle' : 'Upload Image'}</strong>
              </button>

              <input
                ref={inputRef}
                className="visually-hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => chooseFile(event.target.files?.[0])}
              />

              {currentUrl && (
                <section className="profile-media-current">
                  <div>
                    <strong>{locale === 'tr' ? 'Şu anki görsel' : 'Current image'}</strong>
                    <span>
                      {locale === 'tr'
                        ? 'İstersen kaldırıp yenisini seçebilirsin.'
                        : 'Remove it or choose a new one.'}
                    </span>
                  </div>
                  <div
                    className={`profile-media-current-preview profile-media-current-preview--${kind}`}
                  >
                    <img src={currentUrl} alt="" />
                  </div>
                  <button
                    className="profile-media-remove"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      void onRemove().then((removed) => {
                        if (removed) onOpenChange(false);
                      });
                    }}
                  >
                    <Trash2 size={17} />
                    {locale === 'tr' ? 'Kaldır' : 'Remove'}
                  </button>
                </section>
              )}

              {error && (
                <p className="profile-media-error" role="alert">
                  {error}
                </p>
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ProfileCropper({
  kind,
  file,
  locale,
  busy,
  onBack,
  onCancel,
  onApply,
}: {
  kind: ProfileMediaKind;
  file: File;
  locale: 'tr' | 'en';
  busy: boolean;
  onBack: () => void;
  onCancel: () => void;
  onApply: (file: File) => Promise<boolean>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ pointerId: number; start: Point; origin: Point } | null>(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });

  const crop = kind === 'avatar' ? AVATAR_CROP : BANNER_CROP;

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      setReady(true);
    };
    image.src = url;
    return () => {
      URL.revokeObjectURL(url);
      imageRef.current = null;
    };
  }, [file]);

  useEffect(() => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas || !ready) return;
    drawImage(canvas, image, crop, zoom, rotation, offset);
  }, [crop, offset, ready, rotation, zoom]);

  const updateOffset = (next: Point) => {
    const image = imageRef.current;
    if (!image) return;
    setOffset(clampOffset(image, crop, zoom, rotation, next));
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!ready) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = canvasPoint(event);
    dragRef.current = { pointerId: event.pointerId, start: point, origin: offset };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = canvasPoint(event);
    updateOffset({
      x: drag.origin.x + point.x - drag.start.x,
      y: drag.origin.y + point.y - drag.start.y,
    });
  };

  const finishPointer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const rotate = () => {
    const nextRotation = (rotation + 90) % 360;
    setRotation(nextRotation);
    const image = imageRef.current;
    if (image) setOffset((current) => clampOffset(image, crop, zoom, nextRotation, current));
  };

  const reset = () => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  };

  const apply = async () => {
    const image = imageRef.current;
    if (!image) return;
    const output = await exportCrop(image, kind, crop, zoom, rotation, offset);
    const applied = await onApply(output);
    if (applied) onCancel();
  };

  return (
    <>
      <header className="profile-media-dialog-header">
        <Dialog.Title>{locale === 'tr' ? 'Görseli Düzenle' : 'Edit Image'}</Dialog.Title>
        <Dialog.Close
          className="profile-media-close"
          aria-label={locale === 'tr' ? 'Kapat' : 'Close'}
          disabled={busy}
        >
          <X size={22} />
        </Dialog.Close>
      </header>

      <div className={`profile-crop-stage profile-crop-stage--${kind}`}>
        <canvas
          ref={canvasRef}
          width={STAGE_WIDTH}
          height={STAGE_HEIGHT}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointer}
          onPointerCancel={finishPointer}
          aria-label={
            locale === 'tr' ? 'Görseli sürükleyerek konumlandır' : 'Drag to reposition image'
          }
        />
        <span className={`profile-crop-mask profile-crop-mask--${kind}`} aria-hidden="true" />
        {!ready && (
          <span className="profile-crop-loading">
            {locale === 'tr' ? 'Görsel hazırlanıyor…' : 'Preparing image…'}
          </span>
        )}
      </div>

      <div className="profile-crop-controls">
        <ZoomOut size={17} aria-hidden="true" />
        <input
          type="range"
          min="1"
          max="3"
          step="0.01"
          value={zoom}
          aria-label={locale === 'tr' ? 'Yakınlaştırma' : 'Zoom'}
          onChange={(event) => {
            const nextZoom = Number(event.target.value);
            setZoom(nextZoom);
            const image = imageRef.current;
            if (image)
              setOffset((current) => clampOffset(image, crop, nextZoom, rotation, current));
          }}
        />
        <ZoomIn size={19} aria-hidden="true" />
        <button
          type="button"
          onClick={rotate}
          aria-label={locale === 'tr' ? '90 derece döndür' : 'Rotate 90 degrees'}
        >
          <RotateCw size={20} />
        </button>
      </div>

      <footer className="profile-crop-footer">
        <button className="profile-crop-reset" type="button" onClick={reset} disabled={busy}>
          <RotateCcw size={16} /> {locale === 'tr' ? 'Sıfırla' : 'Reset'}
        </button>
        <div>
          <button type="button" className="profile-crop-cancel" onClick={onCancel} disabled={busy}>
            {locale === 'tr' ? 'İptal' : 'Cancel'}
          </button>
          <button
            type="button"
            className="profile-crop-apply"
            onClick={() => void apply()}
            disabled={busy || !ready}
          >
            <Upload size={17} />{' '}
            {busy
              ? locale === 'tr'
                ? 'Yükleniyor…'
                : 'Uploading…'
              : locale === 'tr'
                ? 'Uygula'
                : 'Apply'}
          </button>
        </div>
      </footer>

      <button className="profile-crop-back" type="button" onClick={onBack} disabled={busy}>
        {locale === 'tr' ? 'Başka görsel seç' : 'Choose another image'}
      </button>
    </>
  );
}

function canvasPoint(event: ReactPointerEvent<HTMLCanvasElement>): Point {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * STAGE_WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * STAGE_HEIGHT,
  };
}

function imageMetrics(
  image: HTMLImageElement,
  crop: { width: number; height: number },
  zoom: number,
  rotation: number,
) {
  const sideways = Math.abs(rotation % 180) === 90;
  const effectiveWidth = sideways ? image.naturalHeight : image.naturalWidth;
  const effectiveHeight = sideways ? image.naturalWidth : image.naturalHeight;
  const baseScale = Math.max(crop.width / effectiveWidth, crop.height / effectiveHeight);
  const scale = baseScale * zoom;
  return {
    scale,
    displayedWidth: effectiveWidth * scale,
    displayedHeight: effectiveHeight * scale,
  };
}

function clampOffset(
  image: HTMLImageElement,
  crop: { width: number; height: number },
  zoom: number,
  rotation: number,
  point: Point,
): Point {
  const metrics = imageMetrics(image, crop, zoom, rotation);
  const maxX = Math.max(0, (metrics.displayedWidth - crop.width) / 2);
  const maxY = Math.max(0, (metrics.displayedHeight - crop.height) / 2);
  return {
    x: Math.max(-maxX, Math.min(maxX, point.x)),
    y: Math.max(-maxY, Math.min(maxY, point.y)),
  };
}

function drawImage(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  crop: { width: number; height: number },
  zoom: number,
  rotation: number,
  offset: Point,
) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const { scale } = imageMetrics(image, crop, zoom, rotation);
  context.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
  context.fillStyle = '#07101f';
  context.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
  context.save();
  context.translate(STAGE_WIDTH / 2 + offset.x, STAGE_HEIGHT / 2 + offset.y);
  context.rotate((rotation * Math.PI) / 180);
  context.scale(scale, scale);
  context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  context.restore();
}

async function exportCrop(
  image: HTMLImageElement,
  kind: ProfileMediaKind,
  crop: { width: number; height: number },
  zoom: number,
  rotation: number,
  offset: Point,
): Promise<File> {
  const width = kind === 'avatar' ? 512 : 1200;
  const height = kind === 'avatar' ? 512 : 400;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable');

  const factor = width / crop.width;
  const { scale } = imageMetrics(image, crop, zoom, rotation);
  context.translate(width / 2 + offset.x * factor, height / 2 + offset.y * factor);
  context.rotate((rotation * Math.PI) / 180);
  context.scale(scale * factor, scale * factor);
  context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Image export failed'))),
      'image/webp',
      0.92,
    );
  });
  return new File([blob], `${kind}-${Date.now()}.webp`, { type: 'image/webp' });
}

export function ProfileMediaCameraIcon() {
  return <Camera size={24} aria-hidden="true" />;
}
