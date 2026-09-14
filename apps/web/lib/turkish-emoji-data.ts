import annotationsJson from 'cldr-annotations-full/annotations/tr/annotations.json';
import englishEmojiData from 'emoji-picker-react/dist/data/emojis-en.json';
import type { EmojiData } from 'emoji-picker-react/dist/types/exposedTypes';

type Annotation = { default?: string[]; tts?: string[] };

const annotations = annotationsJson.annotations.annotations as Record<string, Annotation>;
const sourceEmojiData = englishEmojiData as unknown as EmojiData;
const categoryNames: Record<string, string> = {
  suggested: 'Sık kullanılanlar',
  suggested_recent: 'Son kullanılanlar',
  smileys_people: 'Yüzler ve insanlar',
  animals_nature: 'Hayvanlar ve doğa',
  food_drink: 'Yiyecek ve içecek',
  travel_places: 'Seyahat ve yerler',
  activities: 'Etkinlikler',
  objects: 'Nesneler',
  symbols: 'Semboller',
  flags: 'Bayraklar',
  custom: 'Özel emojiler',
};

function unifiedToEmoji(unified: string): string {
  return String.fromCodePoint(...unified.split('-').map((part) => Number.parseInt(part, 16)));
}

function turkishNames(unified: string, fallback: string[]): string[] {
  const emoji = unifiedToEmoji(unified);
  const annotation = annotations[emoji] ?? annotations[emoji.replaceAll('\uFE0F', '')];
  if (!annotation) return fallback;
  return [...new Set([...(annotation.tts ?? []), ...(annotation.default ?? []), ...fallback])];
}

export const turkishEmojiData = {
  categories: Object.fromEntries(
    Object.entries(sourceEmojiData.categories).map(([key, category]) => [
      key,
      category ? { ...category, name: categoryNames[key] ?? category.name } : category,
    ]),
  ),
  emojis: Object.fromEntries(
    Object.entries(sourceEmojiData.emojis).map(([category, emojis]) => [
      category,
      emojis.map((emoji) => ({ ...emoji, n: turkishNames(emoji.u, emoji.n) })),
    ]),
  ),
} as EmojiData;
