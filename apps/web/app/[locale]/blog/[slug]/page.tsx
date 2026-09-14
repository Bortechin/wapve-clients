import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BlogPostPage } from '@/components/marketing-site';
import { isLocale } from '@/lib/i18n';
import { marketingCopy } from '@/lib/marketing-copy';
import { blogPost, blogPosts, localized } from '@/lib/public-content';

export function generateStaticParams() {
  return blogPosts.flatMap((post) => ['tr', 'en'].map((locale) => ({ locale, slug: post.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const post = blogPost(slug);
  if (!post) return {};
  return {
    title: localized(locale, post.title),
    description: localized(locale, post.summary),
    alternates: { canonical: `https://wapve.com/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      url: `https://wapve.com/blog/${post.slug}`,
      publishedTime: `${post.date}T09:00:00+03:00`,
    },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const post = blogPost(slug);
  if (!post) notFound();
  return <BlogPostPage locale={locale} copy={marketingCopy(locale)} post={post} />;
}
