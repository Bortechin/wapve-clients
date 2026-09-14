import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  SUPPORT_ARTICLES,
  SUPPORT_CATEGORIES,
} from '../../../web/components/support-center/support-data';
import { useI18n } from '@/lib/i18n';
import { View, ScrollView, BackHandler } from './themed-native';
import { Text } from './localized-native';
import { Button, Field } from './ui';
import { colors } from '@wapve/design-tokens';

/** Shared editorial content; all navigation and article rendering remain native. */
export function SupportArticles() {
  const { locale } = useI18n();
  const [category, setCategory] = useState<string | null>(null);
  const [articleId, setArticleId] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!articleId) return false;
        setArticleId(null);
        return true;
      });
      return () => subscription.remove();
    }, [articleId]),
  );
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(8);
  const article = SUPPORT_ARTICLES.find((item) => item.id === articleId);
  const articles = SUPPORT_ARTICLES.filter(
    (item) =>
      (!category || item.categoryId === category) &&
      `${item.title[locale]} ${item.summary[locale]} ${item.tags.join(' ')}`
        .toLocaleLowerCase(locale)
        .includes(search.toLocaleLowerCase(locale)),
  );
  return (
    <View style={{ gap: 12 }}>
      <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '700' }}>
        {locale === 'tr' ? 'Yardım makaleleri' : 'Help articles'}
      </Text>
      {article ? (
        <>
          <Button
            label={locale === 'tr' ? 'Makalelere dön' : 'Back to articles'}
            variant="secondary"
            onPress={() => setArticleId(null)}
          />
          <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: '700' }}>
            {article.title[locale]}
          </Text>
          {article.content[locale].split(/\n\s*\n/).map((paragraph, index) => (
            <Text
              key={index}
              selectable
              style={{ color: colors.textMuted, fontSize: 16, lineHeight: 25 }}
            >
              {paragraph.replace(/^#{1,6}\s+/gm, '').replace(/\*\*([^*]+)\*\*/g, '$1')}
            </Text>
          ))}
        </>
      ) : (
        <>
          <Field
            label={locale === 'tr' ? 'Yardımda ara' : 'Search help'}
            value={search}
            onChangeText={(value) => {
              setSearch(value);
              setLimit(8);
            }}
          />
          <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
            <Button
              label={locale === 'tr' ? 'Tümü' : 'All'}
              variant={category === null ? 'primary' : 'secondary'}
              onPress={() => {
                setCategory(null);
                setLimit(8);
              }}
            />
            {SUPPORT_CATEGORIES.map((item) => (
              <Button
                key={item.id}
                label={item.title[locale]}
                variant={category === item.id ? 'primary' : 'secondary'}
                onPress={() => {
                  setCategory(item.id);
                  setLimit(8);
                }}
              />
            ))}
          </ScrollView>
          {articles.slice(0, limit).map((item) => (
            <View
              key={item.id}
              style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 12, gap: 8 }}
            >
              <Button
                label={item.title[locale]}
                variant="ghost"
                onPress={() => setArticleId(item.id)}
              />
              <Text style={{ color: colors.textMuted }}>{item.summary[locale]}</Text>
            </View>
          ))}
          {!articles.length && (
            <Text>{locale === 'tr' ? 'Sonuç bulunamadı.' : 'No results found.'}</Text>
          )}
          {articles.length > limit && (
            <Button
              label={locale === 'tr' ? 'Daha fazla' : 'Load more'}
              variant="secondary"
              onPress={() => setLimit((value) => value + 8)}
            />
          )}
        </>
      )}
    </View>
  );
}
