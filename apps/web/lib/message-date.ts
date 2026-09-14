export type DatedMessage = { createdAt: string };

function calendarParts(value: string): [number, number, number] {
  const date = new Date(value);
  return [date.getFullYear(), date.getMonth(), date.getDate()];
}

export function startsNewMessageDay(messages: readonly DatedMessage[], index: number): boolean {
  if (index === 0) return true;
  const current = messages[index];
  const previous = messages[index - 1];
  if (!current || !previous) return false;
  const currentDay = calendarParts(current.createdAt);
  const previousDay = calendarParts(previous.createdAt);
  return currentDay.some((part, partIndex) => part !== previousDay[partIndex]);
}

export function formatMessageDay(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}
