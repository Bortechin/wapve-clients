import { parseCustomServerStatusEmoji } from '@wapve/contracts';

export function CustomStatusEmoji({ value, className }: { value: string; className?: string }) {
  const custom = parseCustomServerStatusEmoji(value);
  if (!custom) return <span className={className}>{value}</span>;

  return (
    <span className={className} title={`:${custom.name}:`}>
      <img
        className="custom-status-emoji-image"
        src={`/api/v1/server-emojis/${custom.id}`}
        alt={`:${custom.name}:`}
        loading="lazy"
      />
    </span>
  );
}
