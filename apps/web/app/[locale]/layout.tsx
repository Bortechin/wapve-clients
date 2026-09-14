import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { PersistentSocialCallProvider } from '@/components/persistent-social-call';
import { VoiceConnectionProvider } from '@/components/voice-channel';
import { dictionary, isLocale } from '@/lib/i18n';

export function generateStaticParams() {
  return [{ locale: 'tr' }, { locale: 'en' }];
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <VoiceConnectionProvider messages={dictionary(locale)}>
      <PersistentSocialCallProvider messages={dictionary(locale)}>
        {children}
      </PersistentSocialCallProvider>
    </VoiceConnectionProvider>
  );
}
