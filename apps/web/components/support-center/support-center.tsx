'use client';

import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Flame,
  Headphones,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  UserCheck,
  Wrench,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  SUPPORT_ARTICLES,
  SUPPORT_BRAND_LOGO_SRC,
  SUPPORT_CATEGORIES,
  type SupportArticle,
  type SupportCategory,
} from './support-data';
import { SupportTicketForm } from './support-ticket-form';
import { formatSupportArticleHtml } from './support-markdown';
import styles from './support-center.module.css';

const ICON_MAP: Record<string, React.ElementType> = {
  BookOpen,
  UserCheck,
  LayoutDashboard,
  Flame,
  Headphones,
  ShieldCheck,
  Wrench,
};

export function SupportCenter({
  locale = 'tr',
  initialCategory,
  initialArticle,
  initialView = 'home',
}: {
  locale?: string;
  initialCategory?: string | undefined;
  initialArticle?: string | undefined;
  initialView?: 'home' | 'ticket';
}) {
  const tr = locale === 'tr';

  const [activeView, setActiveView] = useState<'home' | 'category' | 'article' | 'ticket'>(
    initialView === 'ticket'
      ? 'ticket'
      : initialArticle
        ? 'article'
        : initialCategory
          ? 'category'
          : 'home',
  );
  const [selectedCategory, setSelectedCategory] = useState<SupportCategory | null>(() => {
    if (initialCategory) {
      return SUPPORT_CATEGORIES.find((c) => c.slug === initialCategory) ?? null;
    }
    return null;
  });
  const [selectedArticle, setSelectedArticle] = useState<SupportArticle | null>(() => {
    if (initialArticle) {
      return SUPPORT_ARTICLES.find((a) => a.slug === initialArticle) ?? null;
    }
    return null;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [articleFeedback, setArticleFeedback] = useState<'yes' | 'no' | null>(null);

  // Search filter
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return SUPPORT_ARTICLES.filter((art) => {
      const title = (tr ? art.title.tr : art.title.en).toLowerCase();
      const summary = (tr ? art.summary.tr : art.summary.en).toLowerCase();
      const tags = art.tags.join(' ').toLowerCase();
      return title.includes(q) || summary.includes(q) || tags.includes(q);
    }).slice(0, 6);
  }, [searchQuery, tr]);

  function handleSelectCategory(cat: SupportCategory) {
    setSelectedCategory(cat);
    setSelectedArticle(null);
    setActiveView('category');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleSelectArticle(art: SupportArticle) {
    const cat = SUPPORT_CATEGORIES.find((c) => c.id === art.categoryId) ?? null;
    setSelectedCategory(cat);
    setSelectedArticle(art);
    setSearchQuery('');
    setArticleFeedback(null);
    setActiveView('article');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleGoHome() {
    setSelectedCategory(null);
    setSelectedArticle(null);
    setSearchQuery('');
    setActiveView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleGoTicket() {
    setActiveView('ticket');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className={styles.supportRoot}>
      {/* Top Navbar */}
      <header className={styles.supportNav}>
        <button
          type="button"
          onClick={handleGoHome}
          className={styles.supportBrand}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <img
            src={SUPPORT_BRAND_LOGO_SRC}
            alt=""
            width={32}
            height={32}
            className={styles.brandLogo}
          />
          <span className={styles.brandTitle}>Wapve</span>
          <span className={styles.brandBadge}>{tr ? 'Destek' : 'Support'}</span>
        </button>

        <div className={styles.navLinks}>
          <button
            type="button"
            className={styles.navLink}
            onClick={() => handleSelectArticle(SUPPORT_ARTICLES[0]!)}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {tr ? 'Başlangıç Rehberi' : 'Getting Started'}
          </button>
          <button type="button" className={styles.ticketBtn} onClick={handleGoTicket}>
            <Send size={14} />
            <span>{tr ? 'Bir talep gönder' : 'Submit a request'}</span>
          </button>
          <Link href="/app" className={styles.appReturnBtn}>
            {tr ? "Wapve'i Aç" : 'Open Wapve'}
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className={styles.heroSection}>
        <div className={styles.heroContent}>
          <div className={styles.heroVisualRow}>
            <div className={styles.heroMascotLeft}>
              <ShieldCheck size={32} />
            </div>
            <h1 className={styles.heroTitle}>{tr ? 'YARDIM MERKEZİ' : 'HELP CENTER'}</h1>
            <div className={styles.heroMascotRight}>
              <Sparkles size={32} />
            </div>
          </div>

          {/* Search Box */}
          <div className={styles.searchContainer}>
            <div className={styles.searchBox}>
              <Search size={20} className={styles.searchIcon} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder={
                  tr
                    ? 'Nasıl yardımcı olabiliriz? Bir soru veya konu ara...'
                    : 'How can we help? Search for topics or questions...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className={styles.searchClearBtn}
                  onClick={() => setSearchQuery('')}
                  aria-label="Temizle"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Live Search Suggestions Dropdown */}
            {searchResults.length > 0 && (
              <div className={styles.searchResultsDropdown}>
                {searchResults.map((art) => (
                  <button
                    key={art.id}
                    type="button"
                    className={styles.searchResultItem}
                    onClick={() => handleSelectArticle(art)}
                    style={{ width: '100%', border: 'none', cursor: 'pointer' }}
                  >
                    <div className={styles.searchResultTitle}>
                      {tr ? art.title.tr : art.title.en}
                    </div>
                    <div className={styles.searchResultSummary}>
                      {tr ? art.summary.tr : art.summary.en}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <h2 className={styles.heroSubtitle}>
            {tr ? 'YARDIMA MI İHTİYACIN VAR? BİZ YANINDAYIZ.' : 'NEED HELP? WE ARE HERE FOR YOU.'}
          </h2>
          <p className={styles.heroDescription}>
            {tr ? (
              <>
                Wapve'de hesap ayarlarından sunucu izinlerine kadar her konuda yardım bul. Wapve'de
                yeniysen ve ipuçları arıyorsan{' '}
                <button
                  type="button"
                  onClick={() => handleSelectArticle(SUPPORT_ARTICLES[0]!)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#38bdf8',
                    textDecoration: 'underline',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Başlangıç Rehberi
                </button>
                'ne göz at.
              </>
            ) : (
              <>
                Find help for account settings, voice channels, and server permissions. If you are
                new, check out our{' '}
                <button
                  type="button"
                  onClick={() => handleSelectArticle(SUPPORT_ARTICLES[0]!)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#38bdf8',
                    textDecoration: 'underline',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Getting Started Guide
                </button>
                .
              </>
            )}
          </p>
        </div>
      </section>

      {/* Main Content Area */}
      <main className={styles.mainContainer}>
        {/* VIEW: TICKET FORM */}
        {activeView === 'ticket' && (
          <SupportTicketForm
            locale={locale}
            onBack={handleGoHome}
            onOpenArticle={(art) => handleSelectArticle(art)}
          />
        )}

        {/* VIEW: CATEGORY ARTICLES LIST */}
        {activeView === 'category' && selectedCategory && (
          <div>
            <div className={styles.breadcrumbBar}>
              <button
                type="button"
                onClick={handleGoHome}
                className={styles.breadcrumbLink}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                {tr ? 'Wapve Destek' : 'Wapve Support'}
              </button>
              <span>/</span>
              <span className={styles.breadcrumbCurrent}>
                {tr ? selectedCategory.title.tr : selectedCategory.title.en}
              </span>
            </div>

            <div className={styles.categoryDetailHeader}>
              <h2 className={styles.categoryDetailTitle}>
                {tr ? selectedCategory.title.tr : selectedCategory.title.en}
              </h2>
              <p className={styles.categoryDetailDesc}>
                {tr ? selectedCategory.description.tr : selectedCategory.description.en}
              </p>
            </div>

            <div className={styles.articleListGroup}>
              {SUPPORT_ARTICLES.filter((a) => a.categoryId === selectedCategory.id).map((art) => (
                <button
                  key={art.id}
                  type="button"
                  className={styles.articleListItem}
                  onClick={() => handleSelectArticle(art)}
                  style={{ width: '100%', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div className={styles.articleListText}>
                    <h4>{tr ? art.title.tr : art.title.en}</h4>
                    <p>{tr ? art.summary.tr : art.summary.en}</p>
                  </div>
                  <ChevronRight size={18} style={{ color: '#64748b' }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* VIEW: ARTICLE READER */}
        {activeView === 'article' && selectedArticle && (
          <div>
            <div className={styles.breadcrumbBar}>
              <button
                type="button"
                onClick={handleGoHome}
                className={styles.breadcrumbLink}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                {tr ? 'Wapve Destek' : 'Wapve Support'}
              </button>
              <span>/</span>
              {selectedCategory && (
                <>
                  <button
                    type="button"
                    onClick={() => handleSelectCategory(selectedCategory)}
                    className={styles.breadcrumbLink}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    {tr ? selectedCategory.title.tr : selectedCategory.title.en}
                  </button>
                  <span>/</span>
                </>
              )}
              <span className={styles.breadcrumbCurrent}>
                {tr ? selectedArticle.title.tr : selectedArticle.title.en}
              </span>
            </div>

            <div className={styles.articleLayout}>
              {/* Sidebar */}
              <aside className={styles.articleSidebar}>
                <h4>{tr ? 'Bu Bölümdeki Makaleler' : 'Articles in this section'}</h4>
                <div className={styles.sidebarLinks}>
                  {SUPPORT_ARTICLES.filter((a) => a.categoryId === selectedArticle.categoryId).map(
                    (art) => (
                      <button
                        key={art.id}
                        type="button"
                        onClick={() => handleSelectArticle(art)}
                        className={`${styles.sidebarLink}${art.id === selectedArticle.id ? ` ${styles.sidebarLinkActive}` : ''}`}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          width: '100%',
                        }}
                      >
                        {tr ? art.title.tr : art.title.en}
                      </button>
                    ),
                  )}
                </div>
              </aside>

              {/* Main Content Pane */}
              <article className={styles.articleMainContent}>
                <header className={styles.articleHeader}>
                  <h1 className={styles.articleTitle}>
                    {tr ? selectedArticle.title.tr : selectedArticle.title.en}
                  </h1>
                  <div className={styles.articleMeta}>
                    <span>
                      {tr
                        ? `${selectedArticle.readingTimeMinutes} dk okuma süresi`
                        : `${selectedArticle.readingTimeMinutes} min read`}
                    </span>
                  </div>
                </header>

                <div
                  className={styles.articleBody}
                  dangerouslySetInnerHTML={{
                    __html: formatSupportArticleHtml(
                      tr ? selectedArticle.content.tr : selectedArticle.content.en,
                    ),
                  }}
                />

                {/* Article Helpful Feedback */}
                <div className={styles.articleFeedbackBox}>
                  <div className={styles.articleFeedbackTitle}>
                    {tr ? 'Bu makale yardımcı oldu mu?' : 'Was this article helpful?'}
                  </div>
                  <div className={styles.feedbackBtnGroup}>
                    <button
                      type="button"
                      className={`${styles.feedbackBtn}${articleFeedback === 'yes' ? ` ${styles.feedbackBtnActive}` : ''}`}
                      onClick={() => setArticleFeedback('yes')}
                    >
                      <ThumbsUp size={15} />
                      <span>{tr ? 'Evet' : 'Yes'}</span>
                    </button>
                    <button
                      type="button"
                      className={`${styles.feedbackBtn}${articleFeedback === 'no' ? ` ${styles.feedbackBtnActive}` : ''}`}
                      onClick={() => setArticleFeedback('no')}
                    >
                      <ThumbsDown size={15} />
                      <span>{tr ? 'Hayır' : 'No'}</span>
                    </button>
                  </div>
                  {articleFeedback && (
                    <div style={{ marginTop: 12, fontSize: 13, color: '#38bdf8' }}>
                      {tr
                        ? 'Geri bildiriminiz için teşekkür ederiz!'
                        : 'Thank you for your feedback!'}
                    </div>
                  )}
                </div>
              </article>
            </div>
          </div>
        )}

        {/* VIEW: HOME CATEGORY GRID */}
        {activeView === 'home' && (
          <>
            <div className={styles.categoriesGrid}>
              {SUPPORT_CATEGORIES.map((cat) => {
                const IconComponent = ICON_MAP[cat.icon] ?? LifeBuoy;
                const articlesCount = SUPPORT_ARTICLES.filter(
                  (a) => a.categoryId === cat.id,
                ).length;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={styles.categoryCard}
                    onClick={() => handleSelectCategory(cat)}
                    style={{ textAlign: 'left', cursor: 'pointer' }}
                  >
                    <div className={styles.categoryCardHeader}>
                      <div
                        className={styles.categoryIconWrapper}
                        style={{ color: cat.badgeColor ?? '#38bdf8' }}
                      >
                        <IconComponent size={28} />
                      </div>
                      <span className={styles.categoryArticleCount}>
                        {tr ? `${articlesCount} makale` : `${articlesCount} articles`}
                      </span>
                    </div>

                    <h3 className={styles.categoryTitle}>{tr ? cat.title.tr : cat.title.en}</h3>
                    <p className={styles.categoryDescription}>
                      {tr ? cat.description.tr : cat.description.en}
                    </p>

                    <div className={styles.categoryCardFooter}>
                      <span>{tr ? 'Makaleleri Gör' : 'Browse Articles'}</span>
                      <ArrowRight size={15} />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Popular Topics Section */}
            <section className={styles.popularSection}>
              <div className={styles.popularHeader}>
                <Flame size={20} style={{ color: '#f59e0b' }} />
                <span>{tr ? 'Öne Çıkan Rehberler' : 'Featured Guides'}</span>
              </div>
              <div className={styles.popularGrid}>
                {SUPPORT_ARTICLES.slice(0, 6).map((art) => (
                  <button
                    key={art.id}
                    type="button"
                    className={styles.popularItem}
                    onClick={() => handleSelectArticle(art)}
                    style={{ border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <MessageSquare size={15} style={{ color: '#38bdf8', flexShrink: 0 }} />
                    <span>{tr ? art.title.tr : art.title.en}</span>
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        {/* Bottom CTA Banner (Shown on home, category, and article views) */}
        {activeView !== 'ticket' && (
          <div className={styles.bottomCtaBanner}>
            <div className={styles.bottomCtaText}>
              <h3>
                {tr ? 'Aradığın cevabı bulamadın mı?' : "Can't find what you're looking for?"}
              </h3>
              <p>
                {tr
                  ? 'Doğrudan Wapve destek ekibimize bir bilet göndererek yardım alabilirsin.'
                  : 'Submit a ticket directly to the Wapve support team and we will assist you.'}
              </p>
            </div>
            <button
              type="button"
              className={styles.ticketBtn}
              onClick={handleGoTicket}
              style={{ fontSize: 14, padding: '12px 24px' }}
            >
              <Send size={16} />
              <span>{tr ? 'Bir Talep Gönder' : 'Submit a Request'}</span>
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
