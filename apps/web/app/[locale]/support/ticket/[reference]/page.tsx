import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supportReferenceSchema } from '@wapve/contracts';
import { SupportCustomerPortal } from '@/components/support-center/support-customer-portal';
export const metadata: Metadata = {
  title: 'Talebim | Wapve Destek',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};
export default async function Page({
  params,
}: {
  params: Promise<{ reference: string; locale: string }>;
}) {
  const { reference, locale } = await params;
  if (!supportReferenceSchema.safeParse(reference).success) notFound();
  return <SupportCustomerPortal reference={reference.toUpperCase()} locale={locale} />;
}
