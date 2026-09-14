import annotationsJson from 'cldr-annotations-full/annotations/tr/annotations.json';
import englishEmojiData from 'emoji-picker-react/dist/data/emojis-en.json';

type EnglishEmojiEntry = {
  n?: string[];
  u?: string;
  a?: string;
};

type EnglishEmojiPayload = {
  emojis: Record<EmojiCategoryId, EnglishEmojiEntry[]>;
};

type AnnotationEntry = {
  tts?: string[];
  default?: string[];
};

type AnnotationPayload = {
  annotations?: {
    annotations?: Record<string, AnnotationEntry>;
  };
};

export type EmojiCategoryId =
  | 'smileys_people'
  | 'animals_nature'
  | 'food_drink'
  | 'travel_places'
  | 'activities'
  | 'objects'
  | 'symbols'
  | 'flags';

export type MobileEmojiItem = {
  emoji: string;
  category: EmojiCategoryId;
  names: string[];
  searchText: string;
};

export const emojiCategories: { id: EmojiCategoryId; icon: string; label: string }[] = [
  { id: 'smileys_people', icon: '😀', label: 'Yüzler ve kişiler' },
  { id: 'animals_nature', icon: '🐻', label: 'Hayvanlar ve doğa' },
  { id: 'food_drink', icon: '🍕', label: 'Yiyecek ve içecek' },
  { id: 'travel_places', icon: '✈️', label: 'Seyahat ve yerler' },
  { id: 'activities', icon: '⚽', label: 'Etkinlikler' },
  { id: 'objects', icon: '💡', label: 'Nesneler' },
  { id: 'symbols', icon: '💜', label: 'Semboller' },
  { id: 'flags', icon: '🏳️', label: 'Bayraklar' },
];

function unifiedToEmoji(unified: string) {
  return unified
    .split('-')
    .map((part) => String.fromCodePoint(Number.parseInt(part, 16)))
    .join('');
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

const annotations = (annotationsJson as AnnotationPayload).annotations?.annotations ?? {};
const english = (englishEmojiData as EnglishEmojiPayload).emojis;

export const mobileEmojiItems: MobileEmojiItem[] = emojiCategories.flatMap(({ id }) =>
  (english[id] ?? []).flatMap((entry) => {
    if (!entry.u) return [];
    const emoji = unifiedToEmoji(entry.u);
    const annotation = annotations[emoji];
    const names = Array.from(
      new Set(
        [...(annotation?.tts ?? []), ...(annotation?.default ?? []), ...(entry.n ?? [])].filter(
          Boolean,
        ),
      ),
    );
    return [{ emoji, category: id, names, searchText: normalize(names.join(' ')) }];
  }),
);

export function searchEmoji(query: string, category: EmojiCategoryId) {
  const normalizedQuery = normalize(query.trim());
  return mobileEmojiItems.filter((item) =>
    normalizedQuery ? item.searchText.includes(normalizedQuery) : item.category === category,
  );
}
