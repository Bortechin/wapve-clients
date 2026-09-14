export function decodeWaveConversationSegment(
  segment: string | undefined,
): string | undefined | null {
  if (!segment) return undefined;
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}
