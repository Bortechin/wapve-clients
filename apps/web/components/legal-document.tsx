import {
  Copyright,
  Cookie,
  Eye,
  FileCheck2,
  Heart,
  MessageCircle,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import type { Locale } from '@wapve/contracts';
import type { LegalDocument, LegalSlug } from '@/lib/legal-content';
import type { MarketingCopy } from '@/lib/marketing-copy';
import { MarketingShell } from './marketing-site';
import styles from './public-site.module.css';

const legalIcons = {
  terms: FileCheck2,
  privacy: Eye,
  kvkk: ShieldCheck,
  cookies: Cookie,
  community: Heart,
  copyright: Copyright,
};

export function LegalDocumentPage({
  locale,
  copy,
  document,
  slug,
}: {
  locale: Locale;
  copy: MarketingCopy;
  document: LegalDocument;
  slug: LegalSlug;
}) {
  const links: Array<{ slug: LegalSlug; label: string }> = [
    { slug: 'terms', label: copy.footer.legalLinks.terms },
    { slug: 'privacy', label: copy.footer.legalLinks.privacy },
    { slug: 'kvkk', label: copy.footer.legalLinks.kvkk },
    { slug: 'cookies', label: copy.footer.legalLinks.cookies },
    { slug: 'community', label: copy.footer.legalLinks.community },
    {
      slug: 'copyright',
      label: locale === 'tr' ? 'Telif ve İçerik Kaldırma' : 'Copyright & Content Removal',
    },
  ];
  const DocumentIcon = legalIcons[slug];

  return (
    <MarketingShell locale={locale} copy={copy}>
      <main className={styles.legalLayout}>
        <aside className={styles.legalSidebar}>
          <div className={styles.legalSidebarTitle}>
            <FileCheck2 size={15} />
            {locale === 'tr' ? 'Yasal merkez' : 'Legal center'}
          </div>
          {links.map((link) => {
            const Icon = legalIcons[link.slug];
            return (
              <Link
                key={link.slug}
                href={`/legal/${link.slug}`}
                aria-current={link.slug === slug ? 'page' : undefined}
              >
                <Icon size={14} />
                <span>{link.label}</span>
                <ChevronRight size={12} />
              </Link>
            );
          })}
          <div className={styles.legalHelp}>
            <MessageCircle size={16} />
            <strong>{locale === 'tr' ? 'Yardıma mı ihtiyacın var?' : 'Need help?'}</strong>
            <Link href="mailto:info@wapve.com">info@wapve.com</Link>
          </div>
        </aside>
        <article className={styles.legalDocument}>
          <header>
            <div className={styles.legalIcon}>
              <DocumentIcon size={23} />
            </div>
            <span className={styles.sectionEyebrow}>{document.eyebrow}</span>
            <h1>{document.title}</h1>
            <p className={styles.legalSummary}>{document.summary}</p>
            <small className={styles.legalUpdated}>
              <span />
              {locale === 'tr' ? 'Son güncelleme' : 'Last updated'} · {document.updatedAt}
            </small>
          </header>
          <div className={styles.legalSections}>
            {document.sections.map((section, index) => (
              <section key={section.title}>
                <h2>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  {section.title}
                </h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.items ? (
                  <ul>
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
          <footer className={styles.legalContact}>
            <ShieldCheck size={22} />
            <div>
              <strong>
                {locale === 'tr'
                  ? 'Verilerin ve seçimlerin sana ait.'
                  : 'Your data and choices belong to you.'}
              </strong>
              <p>
                {locale === 'tr'
                  ? 'Bu metinle ilgili bildirim ve taleplerini bize iletebilirsin.'
                  : 'You can send us notices and requests about this document.'}
              </p>
            </div>
            <Link href="mailto:info@wapve.com">
              {locale === 'tr' ? 'İletişime geç' : 'Contact us'}
            </Link>
          </footer>
        </article>
      </main>
    </MarketingShell>
  );
}
