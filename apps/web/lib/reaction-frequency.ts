export const DEFAULT_QUICK_REACTIONS = ['👍', '❤️', '😂'] as const;

export type ReactionFrequency = Record<string, number>;

export function readReactionFrequency(value: string | null): ReactionFrequency {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([emoji, count]) => emoji.length <= 80 && Number.isInteger(count) && Number(count) > 0,
      ),
    ) as ReactionFrequency;
  } catch {
    return {};
  }
}

export function incrementReactionFrequency(
  frequency: ReactionFrequency,
  emoji: string,
): ReactionFrequency {
  return { ...frequency, [emoji]: Math.min((frequency[emoji] ?? 0) + 1, 1_000_000) };
}

export function quickReactions(
  frequency: ReactionFrequency,
  availableCustomTokens: string[],
): string[] {
  const availableCustom = new Set(availableCustomTokens);
  const learned = Object.entries(frequency)
    .filter(([emoji]) => !emoji.startsWith('<:') || availableCustom.has(emoji))
    .sort(([leftEmoji, leftCount], [rightEmoji, rightCount]) =>
      rightCount === leftCount ? leftEmoji.localeCompare(rightEmoji) : rightCount - leftCount,
    )
    .map(([emoji]) => emoji);

  return [...new Set([...learned, ...DEFAULT_QUICK_REACTIONS])].slice(
    0,
    DEFAULT_QUICK_REACTIONS.length,
  );
}
