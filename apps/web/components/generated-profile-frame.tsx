import type { CSSProperties } from 'react';

export type GeneratedProfileFrameAssets =
  | { kind: 'frame'; top: string; bottom: string; topOffset?: number; bottomOffset?: number }
  | { kind: 'overlay'; asset: string };

export function GeneratedProfileFrame({ frame }: { frame: GeneratedProfileFrameAssets }) {
  if (frame.kind === 'overlay') {
    return (
      <div className="generated-profile-frame is-overlay" aria-hidden="true">
        <img className="profile-effect-overlay" src={frame.asset} alt="" />
      </div>
    );
  }
  return (
    <div className="generated-profile-frame" aria-hidden="true" style={{
      ...(frame.topOffset !== undefined ? { '--profile-frame-top-offset': `${frame.topOffset}%` } : {}),
      ...(frame.bottomOffset !== undefined ? { '--profile-frame-bottom-offset': `${frame.bottomOffset}%` } : {}),
    } as CSSProperties}>
      <img className="profile-frame-top" src={frame.top} alt="" />
      <img className="profile-frame-bottom" src={frame.bottom} alt="" />
    </div>
  );
}
