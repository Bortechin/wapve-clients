import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalDocumentPage } from '@/components/legal-document';
import { isLocale } from '@/lib/i18n';
import { isLegalSlug, legalDocument, legalSlugs } from '@/lib/legal-content';
import { marketingCopy } from '@/lib/marketing-copy';

type LegalPageProps = {
  params: Promise<{ locale: string; document: string }>;
};

export function generateStaticParams() {
  return ['tr', 'en'].flatMap((locale) => legalSlugs.map((document) => ({ locale, document })));
}

export async function generateMetadata({ params }: LegalPageProps): Promise<Metadata> {
  const { locale, document } = await params;
  if (!isLocale(locale) || !isLegalSlug(document)) return {};
  const content = legalDocument(locale, document);
  return {
    title: content.title,
    description: content.summary,
    alternates: {
      canonical: `https://wapve.com/legal/${document}`,
    },
  };
}

export default async function LegalPage({ params }: LegalPageProps) {
  const { locale, document } = await params;
  if (!isLocale(locale) || !isLegalSlug(document)) notFound();
  return (
    <LegalDocumentPage
      locale={locale}
      copy={marketingCopy(locale)}
      document={legalDocument(locale, document)}
      slug={document}
    />
  );
}
