type LogoProps = { compact?: boolean; className?: string };

export function WapveLogo({ compact = false, className = '' }: LogoProps) {
  return (
    <span className={`wapve-logo ${className}`} aria-label="Wapve" role="img">
      <img aria-hidden="true" src="/brand/wapve-wave-mark-v2.png" alt="" width="40" height="40" />
      {!compact && <strong>Wapve</strong>}
    </span>
  );
}
