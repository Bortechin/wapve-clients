import { ImageResponse } from 'next/og';

export const alt = 'Wapve — Kendi dalgan';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          color: '#f4fbff',
          background: 'linear-gradient(135deg,#030817 0%,#071b36 52%,#17245c 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: 590,
            height: 590,
            right: -180,
            top: -250,
            display: 'flex',
            border: '2px solid rgba(80,211,255,.18)',
            borderRadius: 999,
            boxShadow: '0 0 0 52px rgba(65,115,255,.06),0 0 0 105px rgba(113,79,255,.04)',
          }}
        />
        <div style={{ width: 1010, display: 'flex', alignItems: 'center', gap: 56 }}>
          <img
            src="https://wapve.com/brand/wapve-icon-v2-512.png"
          width={240}
          height={240}
            alt=""
            style={{ borderRadius: 58, filter: 'drop-shadow(0 24px 45px rgba(28,185,255,.35))' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ color: '#77e1ff', fontSize: 25, fontWeight: 800, letterSpacing: 5 }}>
              WAPVE
            </div>
            <div style={{ fontSize: 70, lineHeight: 1.05, fontWeight: 900 }}>Kendi dalgan.</div>
            <div style={{ maxWidth: 660, color: '#b9cce3', fontSize: 27, lineHeight: 1.35 }}>
              Topluluklar için güvenli sesli, görüntülü ve yazılı iletişim.
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
