'use client';

import { Camera, Check, Monitor, MonitorUp, Video, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Dictionary } from '@/lib/i18n';

type MediaSetupKind = 'camera' | 'screen';
type MediaSetupRequest = {
  kind: MediaSetupKind;
  resolve: (stream: MediaStream | null) => void;
};

type WapveDesktopBridge = {
  runtime: 'electron';
  currentGame?: () => Promise<string | null>;
  chooseCaptureSource?: () => Promise<{ quality: 'balanced' | 'high' } | null>;
  takeCaptureSettings: () => Promise<{ quality: 'balanced' | 'high' } | null>;
};

declare global {
  interface Window {
    wapveDesktop?: WapveDesktopBridge;
  }
}

const MEDIA_SETUP_EVENT = 'wapve:media-setup-request';

export function requestWapveMedia(kind: MediaSetupKind): Promise<MediaStream | null> {
  if (kind === 'screen' && window.wapveDesktop?.runtime === 'electron') {
    return requestElectronScreenCapture();
  }
  return new Promise((resolve) => {
    window.dispatchEvent(
      new CustomEvent<MediaSetupRequest>(MEDIA_SETUP_EVENT, { detail: { kind, resolve } }),
    );
  });
}

async function requestElectronScreenCapture(): Promise<MediaStream | null> {
  try {
    const bridge = window.wapveDesktop;
    // Start both operations in the same user-activation task. The native
    // picker can paint instantly, while Chromium's display request remains
    // active and is completed by the selected source in Electron's handler.
    const selectionPromise = bridge?.chooseCaptureSource?.() ?? Promise.resolve(null);
    const streamPromise = navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 60, max: 60 } },
      audio: false,
    });
    const [stream, selectedSettings] = await Promise.all([streamPromise, selectionPromise]);
    const settings = selectedSettings ?? (await bridge?.takeCaptureSettings().catch(() => null));
    const track = stream.getVideoTracks()[0];
    if (track) {
      await track
        .applyConstraints(
          settings?.quality === 'balanced'
            ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
            : { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } },
        )
        .catch(() => undefined);
    }
    return stream;
  } catch {
    return null;
  }
}

export function MediaSetupHost({ messages }: { messages: Dictionary }) {
  const [request, setRequest] = useState<MediaSetupRequest | null>(null);
  const [preview, setPreview] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [screenSurface, setScreenSurface] = useState<'window' | 'monitor'>('window');
  const [quality, setQuality] = useState<'balanced' | 'high'>('high');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const previewRef = useRef<HTMLVideoElement>(null);

  const stopPreview = useCallback(() => {
    setPreview((current) => {
      for (const track of current?.getTracks() ?? []) track.stop();
      return null;
    });
  }, []);

  const close = useCallback(
    (result: MediaStream | null = null) => {
      const current = request;
      if (!current) return;
      if (result) setPreview(null);
      else stopPreview();
      setRequest(null);
      setBusy(false);
      setError('');
      current.resolve(result);
    },
    [request, stopPreview],
  );

  useEffect(() => {
    const open = (event: Event) => {
      const next = (event as CustomEvent<MediaSetupRequest>).detail;
      if (!next?.resolve || !['camera', 'screen'].includes(next.kind)) return;
      setRequest((current) => {
        current?.resolve(null);
        return next;
      });
      stopPreview();
      setDevices([]);
      setDeviceId('');
      setScreenSurface('window');
      setQuality('high');
      setError('');
    };
    window.addEventListener(MEDIA_SETUP_EVENT, open);
    return () => window.removeEventListener(MEDIA_SETUP_EVENT, open);
  }, [stopPreview]);

  useEffect(() => {
    const video = previewRef.current;
    if (!video || !preview) return;
    video.srcObject = preview;
    void video.play().catch(() => undefined);
    return () => {
      if (video.srcObject === preview) video.srcObject = null;
    };
  }, [preview]);

  async function startCameraPreview(selectedDeviceId = deviceId) {
    setBusy(true);
    setError('');
    stopPreview();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          ...(selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : {}),
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false,
      });
      setPreview(stream);
      const available = (await navigator.mediaDevices.enumerateDevices()).filter(
        (device) => device.kind === 'videoinput',
      );
      setDevices(available);
      const activeDevice = stream.getVideoTracks()[0]?.getSettings().deviceId;
      if (activeDevice) setDeviceId(activeDevice);
    } catch {
      setError(messages.cameraPermissionError);
    } finally {
      setBusy(false);
    }
  }

  async function chooseScreen() {
    setBusy(true);
    setError('');
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: screenSurface,
          frameRate: quality === 'high' ? { ideal: 60, max: 60 } : { ideal: 30, max: 30 },
        },
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      if (track) {
        await track
          .applyConstraints(
            quality === 'high'
              ? { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } }
              : { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
          )
          .catch(() => undefined);
      }
      close(stream);
    } catch {
      setError(messages.screenSharePermissionError);
      setBusy(false);
    }
  }

  if (!request) return null;
  return createPortal(
    <div className="media-setup-backdrop" role="presentation">
      <section className="media-setup-dialog" role="dialog" aria-modal="true">
        <header>
          <span>
            {request.kind === 'camera' ? <Video size={20} /> : <MonitorUp size={20} />}
            <strong>
              {request.kind === 'camera' ? messages.cameraSetupTitle : messages.screenSetupTitle}
            </strong>
          </span>
          <button onClick={() => close()} aria-label={messages.close}>
            <X size={19} />
          </button>
        </header>

        {request.kind === 'camera' ? (
          <div className="media-camera-setup">
            <div className={`media-camera-preview${preview ? ' ready' : ''}`}>
              {preview ? (
                <video ref={previewRef} autoPlay playsInline muted />
              ) : (
                <span>
                  <Camera size={34} />
                  <strong>{messages.cameraPreviewReady}</strong>
                  <small>{messages.cameraPreviewHint}</small>
                </span>
              )}
            </div>
            <label>
              <span>{messages.cameraDevice}</span>
              <select
                value={deviceId}
                disabled={!devices.length || busy}
                onChange={(event) => {
                  setDeviceId(event.target.value);
                  void startCameraPreview(event.target.value);
                }}
              >
                {!devices.length && <option value="">{messages.defaultCamera}</option>}
                {devices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `${messages.camera} ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <div className="media-screen-setup">
            <p>{messages.screenSetupDescription}</p>
            <div className="media-source-options">
              <button
                className={screenSurface === 'window' ? 'active' : ''}
                onClick={() => setScreenSurface('window')}
              >
                <span>
                  <MonitorUp size={29} />
                </span>
                <strong>{messages.shareApplicationWindow}</strong>
                <small>{messages.shareApplicationWindowHint}</small>
                {screenSurface === 'window' && <Check size={17} />}
              </button>
              <button
                className={screenSurface === 'monitor' ? 'active' : ''}
                onClick={() => setScreenSurface('monitor')}
              >
                <span>
                  <Monitor size={29} />
                </span>
                <strong>{messages.shareEntireScreen}</strong>
                <small>{messages.shareEntireScreenHint}</small>
                {screenSurface === 'monitor' && <Check size={17} />}
              </button>
            </div>
            <div className="media-quality-options" role="group" aria-label={messages.streamQuality}>
              <button
                className={quality === 'high' ? 'active' : ''}
                onClick={() => setQuality('high')}
              >
                <strong>1080p</strong>
                <small>60 FPS</small>
              </button>
              <button
                className={quality === 'balanced' ? 'active' : ''}
                onClick={() => setQuality('balanced')}
              >
                <strong>720p</strong>
                <small>30 FPS</small>
              </button>
            </div>
            <small className="media-system-picker-note">{messages.systemSharePickerNote}</small>
          </div>
        )}

        {error && (
          <div className="message-error" role="alert">
            {error}
          </div>
        )}
        <footer>
          <button className="secondary-button" onClick={() => close()}>
            {messages.cancel}
          </button>
          {request.kind === 'camera' ? (
            preview ? (
              <button className="primary-button" onClick={() => preview && close(preview)}>
                <Camera size={17} /> {messages.enableCamera}
              </button>
            ) : (
              <button
                className="primary-button"
                disabled={busy}
                onClick={() => void startCameraPreview()}
              >
                <Video size={17} /> {busy ? messages.loading : messages.startCameraPreview}
              </button>
            )
          ) : (
            <button className="primary-button" disabled={busy} onClick={() => void chooseScreen()}>
              <MonitorUp size={17} /> {busy ? messages.loading : messages.chooseShareSource}
            </button>
          )}
        </footer>
      </section>
    </div>,
    document.body,
  );
}
