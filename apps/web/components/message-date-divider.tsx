import { formatMessageDay } from '@/lib/message-date';

export function MessageDateDivider({ createdAt, locale }: { createdAt: string; locale: string }) {
  const label = formatMessageDay(createdAt, locale);
  return (
    <div className="message-date-divider" role="separator" aria-label={label}>
      <time dateTime={createdAt}>{label}</time>
    </div>
  );
}
