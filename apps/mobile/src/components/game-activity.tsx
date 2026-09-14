import { gameNames, type GameActivity } from '@wapve/contracts';
import { Text } from '@/components/localized-native';
import { useI18n } from '@/lib/i18n';
import { colors } from '@wapve/design-tokens';

export function GameActivityLabel({
  person,
}: {
  person: { status?: string | undefined; gameActivity?: GameActivity | null | undefined };
}) {
  const { locale } = useI18n();
  const game = person.gameActivity;
  if (
    !game ||
    person.status === 'OFFLINE' ||
    person.status === 'INVISIBLE' ||
    !gameNames[game.gameId]
  )
    return null;
  const name = gameNames[game.gameId];
  return (
    <Text numberOfLines={1} style={{ color: colors.waveBright, fontSize: 12, lineHeight: 18 }}>
      {locale === 'tr' ? `🎮 ${name} oynuyor` : `🎮 Playing ${name}`}
    </Text>
  );
}
