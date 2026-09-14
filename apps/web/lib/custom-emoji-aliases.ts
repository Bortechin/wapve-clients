type CustomEmoji = {
  id: string;
  name: string;
};

const CUSTOM_EMOJI_ALIAS = /:([A-Za-z0-9_]{2,32}):/gu;
const CANONICAL_EMOJI_SUFFIX = /^[0-9a-f-]{36}>/u;

export function canonicalizeCustomEmojiAliases(content: string, emojis: CustomEmoji[]): string {
  if (!content || emojis.length === 0) return content;
  const byName = new Map(emojis.map((emoji) => [emoji.name.toLocaleLowerCase('en'), emoji]));
  return content.replace(
    CUSTOM_EMOJI_ALIAS,
    (alias: string, name: string, offset: number, source: string) => {
      if (
        source[offset - 1] === '<' &&
        CANONICAL_EMOJI_SUFFIX.test(source.slice(offset + alias.length))
      )
        return alias;
      const emoji = byName.get(name.toLocaleLowerCase('en'));
      return emoji ? `<:${emoji.name}:${emoji.id}>` : alias;
    },
  );
}
