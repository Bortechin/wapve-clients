import type { ComponentType, ReactNode } from 'react';
import {
  ArrowRight,
  AudioLines,
  AlertTriangle,
  BadgeCheck,
  Blocks,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Cloud,
  Code2,
  Download,
  Eye,
  Fingerprint,
  Heart,
  HelpCircle,
  KeyRound,
  LifeBuoy,
  LockKeyhole,
  Menu,
  MessageCircle,
  Mic2,
  MonitorSmartphone,
  Network,
  Newspaper,
  Orbit,
  Radio,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Palette,
  Gift,
  Mail,
  UserRound,
  Users,
  Waves,
  Zap,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { WapveLogo } from '@wapve/ui';
import { type Locale, LATEST_WINDOWS_DESKTOP_RELEASE } from '@wapve/contracts';
import { DownloadVerificationCard } from './download-verification';
import { LocaleSwitch } from '@/components/locale-switch';
import type { MarketingCopy } from '@/lib/marketing-copy';
import {
  blogPosts,
  faqCategories,
  localized,
  plusBenefits,
  supportTopics,
  type BlogPost,
} from '@/lib/public-content';
import styles from './public-site.module.css';

const featureIcons = {
  server: Server,
  message: MessageCircle,
  voice: Mic2,
  shield: ShieldCheck,
  user: UserRound,
  devices: MonitorSmartphone,
};

const groupIcons = [BadgeCheck, Server, MessageCircle, Network];
const securityIcons = [KeyRound, Fingerprint, ShieldCheck, Cloud, LockKeyhole, Eye];
const roadmapIcons = [ShieldCheck, MessageCircle, AudioLines, MonitorSmartphone];

function local(locale: Locale, tr: string, en: string) {
  return locale === 'tr' ? tr : en;
}

function AmbientBackground() {
  return (
    <div className={styles.ambient} aria-hidden="true">
      <span className={styles.ambientOne} />
      <span className={styles.ambientTwo} />
      <span className={styles.dotField} />
      <span className={styles.stars} />
    </div>
  );
}

function WaveField({ className }: { className: string | undefined }) {
  return (
    <div className={className} aria-hidden="true">
      <svg viewBox="0 0 1440 180" preserveAspectRatio="none" focusable="false">
        <path
          className={styles.waveLineOne}
          d="M-180 102C-20 18 140 186 300 102S620 18 780 102s320 84 480 0 320-84 480 0"
        />
        <path
          className={styles.waveLineTwo}
          d="M-180 124C-20 54 140 194 300 124S620 54 780 124s320 70 480 0 320-70 480 0"
        />
        <path
          className={styles.waveLineThree}
          d="M-180 146C-20 92 140 200 300 146S620 92 780 146s320 54 480 0 320-54 480 0"
        />
      </svg>
    </div>
  );
}

export function MarketingShell({
  locale,
  copy,
  children,
}: {
  locale: Locale;
  copy: MarketingCopy;
  children: ReactNode;
}) {
  const legalLinks = [
    ['terms', copy.footer.legalLinks.terms],
    ['privacy', copy.footer.legalLinks.privacy],
    ['kvkk', copy.footer.legalLinks.kvkk],
    ['cookies', copy.footer.legalLinks.cookies],
    ['community', copy.footer.legalLinks.community],
    ['copyright', local(locale, 'Telif ve İçerik Kaldırma', 'Copyright & Content Removal')],
  ] as const;

  return (
    <div className={styles.site} lang={locale}>
      <AmbientBackground />
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link
            href="/"
            className={styles.brand}
            aria-label={local(locale, 'Wapve ana sayfa', 'Wapve home')}
          >
            <WapveLogo />
          </Link>
          <nav
            className={styles.navigation}
            aria-label={local(locale, 'Ana menü', 'Main navigation')}
          >
            <Link href="/download">{copy.nav.download}</Link>
            <Link href="/features">{copy.nav.features}</Link>
            <Link href="/wapve-plus">{copy.nav.plus}</Link>
            <Link href="/security">{copy.nav.security}</Link>
            <Link href="/faq">{copy.nav.faq}</Link>
            <Link href="/blog">{copy.nav.blog}</Link>
            <Link href="/support">{copy.nav.support}</Link>
          </nav>
          <div className={styles.headerActions}>
            <Link className={styles.loginLink} href="/login">
              {copy.nav.login}
            </Link>
            <Link className={styles.openButton} href="/app">
              {copy.nav.openApp}
              <ArrowRight size={15} />
            </Link>
            <details className={styles.mobileMenu}>
              <summary aria-label={local(locale, 'Menüyü aç', 'Open menu')}>
                <Menu size={18} />
              </summary>
              <nav>
                <Link href="/">{local(locale, 'Ana sayfa', 'Home')}</Link>
                <Link href="/download">{copy.nav.download}</Link>
                <Link href="/features">{copy.nav.features}</Link>
                <Link href="/wapve-plus">{copy.nav.plus}</Link>
                <Link href="/security">{copy.nav.security}</Link>
                <Link href="/roadmap">{copy.nav.roadmap}</Link>
                <Link href="/faq">{copy.nav.faq}</Link>
                <Link href="/blog">{copy.nav.blog}</Link>
                <Link href="/support">{copy.nav.support}</Link>
                <Link href="/login">{copy.nav.login}</Link>
                <Link href="/app">{copy.nav.openApp}</Link>
              </nav>
            </details>
          </div>
        </div>
      </header>
      <div className={styles.content}>{children}</div>
      <footer className={styles.footer}>
        <div className={styles.footerGrid}>
          <div className={styles.footerBrand}>
            <WapveLogo />
          </div>
          <nav
            className={styles.footerLinks}
            aria-label={local(locale, 'Site bağlantıları', 'Site links')}
          >
            <Link href="/download">{copy.nav.download}</Link>
            <Link href="/features">{copy.nav.features}</Link>
            <Link href="/wapve-plus">{copy.nav.plus}</Link>
            <Link href="/faq">{copy.nav.faq}</Link>
            <Link href="/support">{copy.nav.support}</Link>
            <Link href="/blog">{copy.nav.blog}</Link>
            {legalLinks.map(([slug, label]) => (
              <Link key={slug} href={`/legal/${slug}`}>
                {label}
              </Link>
            ))}
          </nav>
        </div>
        <div className={styles.footerBottom}>
          <span>
            © {new Date().getFullYear()} Wapve · {copy.footer.rights}
          </span>
          <LocaleSwitch locale={locale} />
        </div>
      </footer>
    </div>
  );
}

function StateBadge({
  state,
  labels,
}: {
  state: 'ready' | 'next' | 'planned';
  labels: MarketingCopy['home']['stateLabels'];
}) {
  return (
    <span className={`${styles.stateBadge} ${styles[`state${state}`]}`}>
      <CircleDot size={11} />
      {labels[state]}
    </span>
  );
}

function PreviewMessage({
  initials,
  name,
  color,
  text,
}: {
  initials: string;
  name: string;
  color: 'violet' | 'green';
  text: string;
}) {
  return (
    <article className={styles.previewMessage}>
      <span className={color === 'violet' ? styles.avatarViolet : styles.avatarGreen}>
        {initials}
      </span>
      <div>
        <strong>
          {name}
          <small>19:4{name === 'Elif' ? '2' : '4'}</small>
        </strong>
        <p>{text}</p>
      </div>
    </article>
  );
}

function MascotOrbit({ alt }: { alt: string }) {
  return (
    <div className={styles.mascotOrbit}>
      <span className={styles.mascotGlow} />
      <Image
        src="/brand/wapve-wave-mark-v2.png"
        alt={alt}
        width={1254}
        height={1254}
        loading="eager"
        fetchPriority="high"
        sizes="320px"
      />
      <span className={`${styles.orbitPath} ${styles.orbitInner}`} />
      <span className={`${styles.orbitPath} ${styles.orbitOuter}`} />
      <span className={`${styles.orbitToken} ${styles.tokenMessage}`}>
        <MessageCircle size={15} />
      </span>
      <span className={`${styles.orbitToken} ${styles.tokenVoice}`}>
        <Mic2 size={15} />
      </span>
      <span className={`${styles.orbitToken} ${styles.tokenPeople}`}>
        <Users size={15} />
      </span>
      <span className={`${styles.orbitToken} ${styles.tokenSpark}`}>
        <Sparkles size={13} />
      </span>
    </div>
  );
}

export function MarketingHome({ locale, copy }: { locale: Locale; copy: MarketingCopy }) {
  return (
    <MarketingShell locale={locale} copy={copy}>
      <main>
        <section className={styles.hero}>
          <div className={styles.heroLayout}>
            <div className={styles.heroCopy}>
              <p className={styles.heroEyebrow}>{copy.hero.eyebrow}</p>
              <h1>
                {copy.hero.title}
                <span>{copy.hero.accent}</span>
              </h1>
              <p className={styles.heroDescription}>{copy.hero.description}</p>
              <div className={styles.heroActions}>
                <Link className={styles.shimmerButton} href="/download">
                  <Download size={17} />
                  <span>{copy.hero.downloadWindows}</span>
                </Link>
                <Link className={styles.secondaryButton} href="/register">
                  {copy.hero.primary}
                  <ArrowRight size={15} />
                </Link>
              </div>
            </div>
            <div className={styles.heroVisual}>
              <MascotOrbit alt={copy.hero.mascotAlt} />
            </div>
          </div>
          <WaveField className={styles.heroWaves} />
        </section>

        <section className={styles.section} id="features">
          <SectionHeading
            eyebrow={copy.home.featuresEyebrow}
            title={copy.home.featuresTitle}
            text={copy.home.featuresText}
          />
          <div className={styles.bentoGrid}>
            {copy.home.featureCards.map((card, index) => {
              const Icon = featureIcons[card.icon as keyof typeof featureIcons] ?? Sparkles;
              return (
                <article
                  className={`${styles.magicCard} ${styles[`featureCard${index}`]}`}
                  key={card.title}
                >
                  <div className={styles.cardContent}>
                    <Icon className={styles.cardIcon} size={22} />
                    <div className={styles.cardCopy}>
                      <h3>{card.title}</h3>
                      <p>{card.text}</p>
                    </div>
                    <FeatureVisual index={index} locale={locale} />
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <WaveField className={styles.sectionWaves} />

        <section className={styles.principles}>
          <div className={styles.principleIntro}>
            <span className={styles.sectionEyebrow}>{copy.home.principleEyebrow}</span>
            <h2>{copy.home.principleTitle}</h2>
            <p>{copy.home.principleText}</p>
            <Link href="/security">
              {copy.nav.security}
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className={styles.principleList}>
            {copy.home.principles.map((item, index) => {
              const Icon = [Code2, Fingerprint, Heart][index] ?? Sparkles;
              return (
                <article className={styles.magicCard} key={item.title}>
                  <span>0{index + 1}</span>
                  <i>
                    <Icon size={18} />
                  </i>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </div>
                  <ArrowRight size={15} />
                </article>
              );
            })}
          </div>
        </section>

        <section
          className={styles.launchLinks}
          aria-label={local(locale, 'Wapve rehberi', 'Wapve guide')}
        >
          {[
            {
              href: '/wapve-plus',
              icon: Palette,
              title: copy.nav.plus,
              text: local(
                locale,
                'Tüm hesaplara ücretsiz profil kozmetikleri ve sunucu destekleri.',
                'Free profile cosmetics and server supports for every account.',
              ),
            },
            {
              href: '/faq',
              icon: HelpCircle,
              title: copy.nav.faq,
              text: local(
                locale,
                'Hesap, sunucu, ses, gizlilik ve Wapve+ hakkında net yanıtlar.',
                'Clear answers about accounts, servers, voice, privacy and Wapve+.',
              ),
            },
            {
              href: '/support',
              icon: LifeBuoy,
              title: copy.nav.support,
              text: local(
                locale,
                'Hesap, güvenlik, güven ve telif konularında doğru yardım kanalı.',
                'The right help channel for accounts, security, safety and copyright.',
              ),
            },
            {
              href: '/blog',
              icon: Newspaper,
              title: copy.nav.blog,
              text: local(
                locale,
                'Ürün duyuruları, güvenlik notları ve Wapve’nin gelişim günlüğü.',
                'Product announcements, security notes and Wapve’s development journal.',
              ),
            },
          ].map(({ href, icon: Icon, title, text }) => (
            <Link className={styles.launchLinkCard} href={href} key={href}>
              <i>
                <Icon size={19} />
              </i>
              <div>
                <h2>{title}</h2>
                <p>{text}</p>
              </div>
              <ArrowRight size={16} />
            </Link>
          ))}
        </section>

        <FinalCta locale={locale} copy={copy} />
      </main>
    </MarketingShell>
  );
}

function FeatureVisual({ index, locale }: { index: number; locale: Locale }) {
  if (index === 0) {
    return (
      <div className={styles.communityVisual}>
        <span className={styles.communityCore}>
          <Waves size={25} />
        </span>
        {['AK', 'EL', 'MR', 'ZE'].map((name, item) => (
          <span key={name} className={styles[`person${item}`]}>
            {name}
          </span>
        ))}
        <i />
        <i />
      </div>
    );
  }
  if (index === 1) {
    return (
      <div className={styles.chatVisual}>
        <PreviewMessage
          initials="EL"
          name="Elif"
          color="violet"
          text={local(
            locale,
            'Tasarımı birlikte deneyelim mi?',
            'Shall we try the design together?',
          )}
        />
        <PreviewMessage
          initials="MR"
          name="Mert"
          color="green"
          text={local(locale, 'Ses odasında buluşalım ✨', 'Meet in the voice room ✨')}
        />
        <span className={styles.typingDots}>
          <i />
          <i />
          <i />
        </span>
      </div>
    );
  }
  if (index === 2) {
    return (
      <div className={styles.voiceVisual}>
        <span />
        <span />
        <span />
        <i className={styles.voiceCenter}>
          <AudioLines size={22} />
        </i>
        <i className={styles.voiceLeft}>AK</i>
        <i className={styles.voiceRight}>EL</i>
      </div>
    );
  }
  if (index === 3) {
    return (
      <div className={styles.controlVisual}>
        {[
          [local(locale, 'Yönetici', 'Admin'), 92],
          [local(locale, 'Moderatör', 'Moderator'), 68],
          [local(locale, 'Üye', 'Member'), 42],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <span>{label}</span>
            <i>
              <b style={{ width: `${value}%` }} />
            </i>
          </div>
        ))}
      </div>
    );
  }
  if (index === 4) {
    return (
      <div className={styles.profileVisual}>
        <span className={styles.profileBanner} />
        <i className={styles.profileAvatar}>
          WA
          <b />
        </i>
        <div>
          <strong>Wapve</strong>
          <small>@wapve</small>
        </div>
        <BadgeCheck size={16} />
      </div>
    );
  }
  return (
    <div className={styles.devicesVisual}>
      <span className={styles.desktopDevice}>
        <i />
        <i />
        <i />
        <b />
      </span>
      <span className={styles.mobileDevice}>
        <i />
        <b />
        <b />
      </span>
      <em />
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className={styles.sectionHeading}>
      <div>
        <span className={styles.sectionEyebrow}>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <p>{text}</p>
    </div>
  );
}

function FinalCta({ locale, copy }: { locale: Locale; copy: MarketingCopy }) {
  return (
    <section className={styles.finalCta}>
      <span className={styles.ctaMeteors} aria-hidden="true" />
      <div className={styles.ctaMascot}>
        <Image
          src="/brand/wapve-wave-mark-v2.png"
          alt=""
          width={1254}
          height={1254}
          sizes="170px"
        />
      </div>
      <div>
        <h2>{copy.home.ctaTitle}</h2>
        <p>{copy.home.ctaText}</p>
      </div>
      <Link className={styles.shimmerButton} href="/register">
        {local(locale, 'Ücretsiz başla', 'Start for free')}
        <ArrowRight size={16} />
      </Link>
      <i className={styles.shineBorder} aria-hidden="true" />
      <span className={styles.srOnly}>
        {local(locale, 'Wapve herkese açık kayıt', 'Wapve public registration')}
      </span>
    </section>
  );
}

function PageHero({
  locale,
  eyebrow,
  title,
  intro,
  icon: Icon,
}: {
  locale: Locale;
  eyebrow: string;
  title: string;
  intro: string;
  icon: ComponentType<{ size?: number }>;
}) {
  return (
    <section className={styles.innerHero}>
      <div>
        <span className={styles.sectionEyebrow}>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{intro}</p>
      </div>
      <div className={styles.innerOrb} aria-hidden="true">
        <span>
          <Icon size={42} />
        </span>
        <i>
          <Sparkles size={13} />
        </i>
        <i>
          <Waves size={13} />
        </i>
        <i>
          <Zap size={13} />
        </i>
        <i>
          <Star size={12} />
        </i>
      </div>
      <span className={styles.srOnly}>
        {local(locale, 'Wapve sayfa tanıtımı', 'Wapve page introduction')}
      </span>
    </section>
  );
}

export function FeaturesPage({ locale, copy }: { locale: Locale; copy: MarketingCopy }) {
  const data = copy.pages.features;
  return (
    <MarketingShell locale={locale} copy={copy}>
      <main className={styles.innerPage}>
        <PageHero
          locale={locale}
          eyebrow={data.eyebrow}
          title={data.title}
          intro={data.intro}
          icon={Blocks}
        />
        <section className={styles.featureGroups}>
          {data.groups.map((group, index) => {
            const Icon = groupIcons[index] ?? Blocks;
            return (
              <article className={styles.magicCard} key={group.title}>
                <div className={styles.groupCardInner}>
                  <i className={styles.groupIcon}>
                    <Icon size={21} />
                  </i>
                  <StateBadge state={group.state} labels={copy.home.stateLabels} />
                  <h2>{group.title}</h2>
                  <p>{group.text}</p>
                  <ul>
                    {group.items.map((item) => (
                      <li key={item}>
                        <CheckCircle2 size={14} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </section>
        <section className={styles.nextWave}>
          <Radio size={21} />
          <div>
            <span>{local(locale, 'SONRAKİ DALGA', 'NEXT WAVE')}</span>
            <strong>
              {local(
                locale,
                'Sesli odalar, ekran paylaşımı ve masaüstü uygulaması.',
                'Voice rooms, screen sharing, and a desktop app.',
              )}
            </strong>
          </div>
          <Link href="/roadmap">
            {copy.nav.roadmap}
            <ArrowRight size={15} />
          </Link>
        </section>
        <FinalCta locale={locale} copy={copy} />
      </main>
    </MarketingShell>
  );
}

export function SecurityPage({ locale, copy }: { locale: Locale; copy: MarketingCopy }) {
  const data = copy.pages.security;
  return (
    <MarketingShell locale={locale} copy={copy}>
      <main className={styles.innerPage}>
        <PageHero
          locale={locale}
          eyebrow={data.eyebrow}
          title={data.title}
          intro={data.intro}
          icon={ShieldCheck}
        />
        <section className={styles.securityOverview}>
          <div className={styles.securityRadar} aria-hidden="true">
            <span />
            <span />
            <span />
            <i className={styles.radarCore}>
              <ShieldCheck size={30} />
              <strong>WAPVE CORE</strong>
              <small>Secure by default</small>
            </i>
            {securityIcons.map((Icon, index) => (
              <i className={styles[`radarNode${index}`]} key={index}>
                <Icon size={17} />
              </i>
            ))}
          </div>
          <div className={styles.securityCopy}>
            <span className={styles.trustBadge}>
              <i />
              TRUST CENTER
            </span>
            <h2>
              {local(
                locale,
                'Koruma, görünmeyen katmanlarda başlar.',
                'Protection begins in the layers you cannot see.',
              )}
            </h2>
            <p>
              {local(
                locale,
                'Oturumdan dosya erişimine, mesaj isteğinden rol kontrolüne kadar her akış önce güvenlik sınırından geçer.',
                'From sessions to file access and message requests to role checks, every flow passes through a security boundary first.',
              )}
            </p>
            <div className={styles.securityMetrics}>
              <div>
                <strong>30 {local(locale, 'gün', 'days')}</strong>
                <span>{local(locale, 'Azami oturum', 'Maximum session')}</span>
              </div>
              <div>
                <strong>7 {local(locale, 'gün', 'days')}</strong>
                <span>{local(locale, 'Yedek döngüsü', 'Backup cycle')}</span>
              </div>
              <div>
                <strong>0</strong>
                <span>{local(locale, 'Reklam takipçisi', 'Ad trackers')}</span>
              </div>
            </div>
          </div>
        </section>
        <section className={styles.securityGrid}>
          {data.cards.map((card, index) => {
            const Icon = securityIcons[index] ?? Shield;
            return (
              <article key={card.title}>
                <i>
                  <Icon size={18} />
                </i>
                <h2>{card.title}</h2>
                <p>{card.text}</p>
                <span>
                  <CheckCircle2 size={12} />
                  {local(locale, 'Aktif koruma', 'Active protection')}
                </span>
              </article>
            );
          })}
        </section>
        <section className={styles.securityNote}>
          <span>
            <ShieldCheck size={21} />
          </span>
          <div>
            <h2>{data.noteTitle}</h2>
            <p>{data.noteText}</p>
          </div>
          <Link href="mailto:info@wapve.com">
            info@wapve.com
            <ArrowRight size={15} />
          </Link>
        </section>
      </main>
    </MarketingShell>
  );
}

export function RoadmapPage({ locale, copy }: { locale: Locale; copy: MarketingCopy }) {
  const data = copy.pages.roadmap;
  const progress = [100, 100, 74, 18];
  return (
    <MarketingShell locale={locale} copy={copy}>
      <main className={styles.innerPage}>
        <PageHero
          locale={locale}
          eyebrow={data.eyebrow}
          title={data.title}
          intro={data.intro}
          icon={Orbit}
        />
        <section className={styles.roadmap}>
          <span className={styles.roadmapLine}>
            <i />
          </span>
          {data.phases.map((phase, index) => {
            const Icon = roadmapIcons[index] ?? Orbit;
            return (
              <article className={`${styles.magicCard} ${styles.roadmapCard}`} key={phase.number}>
                <span className={styles.roadmapMarker}>{phase.number}</span>
                <div className={styles.roadmapCardInner}>
                  <div>
                    <i>
                      <Icon size={20} />
                    </i>
                    <StateBadge state={phase.state} labels={copy.home.stateLabels} />
                  </div>
                  <h2>{phase.title}</h2>
                  <p>{phase.text}</p>
                  <span className={styles.progress}>
                    <i style={{ width: `${progress[index]}%` }} />
                  </span>
                  <small>
                    <span>{local(locale, 'İlerleme', 'Progress')}</span>
                    <strong>%{progress[index]}</strong>
                  </small>
                  <ul>
                    {phase.items.map((item) => (
                      <li key={item}>
                        <Check size={13} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </section>
        <section className={styles.roadmapNote}>
          <Sparkles size={20} />
          <div>
            <strong>
              {local(locale, 'Yol haritası yaşayan bir plan.', 'The roadmap is a living plan.')}
            </strong>
            <p>
              {local(
                locale,
                'Topluluktan gelen geri bildirimler öncelikleri ve zamanlamayı değiştirebilir.',
                'Community feedback may change priorities and timing.',
              )}
            </p>
          </div>
        </section>
        <FinalCta locale={locale} copy={copy} />
      </main>
    </MarketingShell>
  );
}

const plusIcons = [Palette, Gift, Server, Sparkles, MonitorSmartphone, ShieldCheck];
const supportIcons = [KeyRound, ShieldCheck, AlertTriangle, BadgeCheck];

export function WapvePlusPage({ locale, copy }: { locale: Locale; copy: MarketingCopy }) {
  return (
    <MarketingShell locale={locale} copy={copy}>
      <main className={styles.innerPage}>
        <PageHero
          locale={locale}
          eyebrow="WAPVE+"
          title={local(locale, 'Tarzın sana ait. Ücreti yok.', 'Your style, with no price tag.')}
          intro={local(
            locale,
            'Wapve+; profil kozmetikleri, koleksiyonlar ve sunucu desteklerini bir araya getirir. Kamusal sürümde her hesap için ücretsizdir.',
            'Wapve+ brings together profile cosmetics, collections and server supports. It is free for every account in the public release.',
          )}
          icon={Sparkles}
        />
        <section className={styles.freePromise}>
          <div>
            <span>
              <CheckCircle2 size={17} />
              {local(locale, 'ÜCRETSİZ ERİŞİM', 'FREE ACCESS')}
            </span>
            <h2>
              {local(
                locale,
                'Kart yok. Deneme yok. Otomatik yenileme yok.',
                'No card. No trial. No auto-renewal.',
              )}
            </h2>
            <p>
              {local(
                locale,
                'Wapve+ etkinliğinin bitiş tarihi bulunmaz. Mevcut kozmetikleri koleksiyonuna eklemek veya kullanmak için ödeme bilgisi istenmez.',
                'Wapve+ access has no expiry. No payment details are requested to claim or use the current cosmetics.',
              )}
            </p>
          </div>
          <Link className={styles.shimmerButton} href="/register">
            {local(locale, 'Ücretsiz hesap oluştur', 'Create a free account')}
            <ArrowRight size={16} />
          </Link>
        </section>
        <section className={styles.infoCardGrid}>
          {plusBenefits.map((benefit, index) => {
            const Icon = plusIcons[index] ?? Sparkles;
            return (
              <article key={benefit.title.en}>
                <i>
                  <Icon size={20} />
                </i>
                <h2>{localized(locale, benefit.title)}</h2>
                <p>{localized(locale, benefit.text)}</p>
              </article>
            );
          })}
        </section>
        <section className={styles.howItWorks}>
          <div>
            <span>01</span>
            <h2>{local(locale, 'Hesabını oluştur', 'Create your account')}</h2>
            <p>
              {local(
                locale,
                'Davet veya ödeme adımı olmadan kaydol.',
                'Register without an invitation or payment step.',
              )}
            </p>
          </div>
          <div>
            <span>02</span>
            <h2>{local(locale, 'Koleksiyonunu seç', 'Choose your collection')}</h2>
            <p>
              {local(
                locale,
                'Mağazadan ücretsiz öğeleri ve paketleri hesabına ekle.',
                'Claim free items and bundles from the store.',
              )}
            </p>
          </div>
          <div>
            <span>03</span>
            <h2>{local(locale, 'Profilini yansıt', 'Express your profile')}</h2>
            <p>
              {local(
                locale,
                'Avatar, efekt, çerçeve ve isim plakasını birlikte kullan.',
                'Combine an avatar, effect, frame and nameplate.',
              )}
            </p>
          </div>
        </section>
        <FinalCta locale={locale} copy={copy} />
      </main>
    </MarketingShell>
  );
}

export function FaqPage({ locale, copy }: { locale: Locale; copy: MarketingCopy }) {
  return (
    <MarketingShell locale={locale} copy={copy}>
      <main className={styles.innerPage}>
        <PageHero
          locale={locale}
          eyebrow={local(locale, 'SIK SORULAN SORULAR', 'FREQUENTLY ASKED QUESTIONS')}
          title={local(
            locale,
            'Merak ettiğin ne varsa, açıkça.',
            'Straight answers to common questions.',
          )}
          intro={local(
            locale,
            'Hesap oluşturmadan sesli kanallara, Wapve+’dan gizlilik haklarına kadar en sık sorulan konular.',
            'From creating an account and voice channels to Wapve+ and privacy rights, these are the most common topics.',
          )}
          icon={HelpCircle}
        />
        <section className={styles.faqGroups}>
          {faqCategories.map((category) => (
            <article key={category.title.en}>
              <h2>{localized(locale, category.title)}</h2>
              <div>
                {category.items.map((item, index) => (
                  <details key={item.question.en} open={index === 0}>
                    <summary>
                      {localized(locale, item.question)}
                      <ChevronRight size={16} />
                    </summary>
                    <p>{localized(locale, item.answer)}</p>
                  </details>
                ))}
              </div>
            </article>
          ))}
        </section>
        <section className={styles.contactBand}>
          <LifeBuoy size={24} />
          <div>
            <h2>{local(locale, 'Yanıtı bulamadın mı?', 'Didn’t find the answer?')}</h2>
            <p>
              {local(
                locale,
                'Destek sayfasından konuna uygun iletişim akışını seç.',
                'Choose the right contact flow from the Support page.',
              )}
            </p>
          </div>
          <Link href="/support">
            {copy.nav.support}
            <ArrowRight size={15} />
          </Link>
        </section>
      </main>
    </MarketingShell>
  );
}

export function SupportPage({ locale, copy }: { locale: Locale; copy: MarketingCopy }) {
  return (
    <MarketingShell locale={locale} copy={copy}>
      <main className={styles.innerPage}>
        <PageHero
          locale={locale}
          eyebrow={local(locale, 'DESTEK MERKEZİ', 'SUPPORT CENTER')}
          title={local(
            locale,
            'Doğru konu, doğru yardım kanalı.',
            'The right help for the right issue.',
          )}
          intro={local(
            locale,
            'Önce uygulama içi araçları kullan; hesabına erişemiyorsan veya hassas bir bildirim yapacaksan ilgili e-posta akışını seç.',
            'Use in-app tools first. If you cannot access your account or need to make a sensitive report, choose the relevant email flow.',
          )}
          icon={LifeBuoy}
        />
        <section className={styles.supportNotice}>
          <AlertTriangle size={21} />
          <div>
            <strong>
              {local(
                locale,
                'Acil tehlike için Wapve destek hattı değildir.',
                'Wapve support is not an emergency service.',
              )}
            </strong>
            <p>
              {local(
                locale,
                'Yakın ve ciddi bir tehlike varsa bulunduğun yerdeki acil yardım veya kolluk birimleriyle iletişime geç.',
                'For imminent serious danger, contact local emergency services or law enforcement.',
              )}
            </p>
          </div>
        </section>
        <section className={styles.supportGrid}>
          {supportTopics.map((topic, index) => {
            const Icon = supportIcons[index] ?? Mail;
            const subject = encodeURIComponent(`[Wapve] ${topic.subject}`);
            return (
              <article key={topic.subject}>
                <i>
                  <Icon size={21} />
                </i>
                <h2>{localized(locale, topic.title)}</h2>
                <p>{localized(locale, topic.text)}</p>
                <a href={`mailto:info@wapve.com?subject=${subject}`}>
                  info@wapve.com
                  <ArrowRight size={14} />
                </a>
              </article>
            );
          })}
        </section>
        <section className={styles.supportChecklist}>
          <div>
            <h2>{local(locale, 'Daha hızlı inceleme için', 'For a faster review')}</h2>
            <p>
              {local(
                locale,
                'Bildirimine olayın tarihi, ilgili kullanıcı/sunucu/mesaj kimliği, ekran görüntüsü ve beklediğin sonucu ekle. Parolanı, iki adımlı doğrulama kodunu veya kurtarma kodunu asla gönderme.',
                'Include the date, relevant user/server/message ID, screenshot and expected outcome. Never send your password, two-factor code or recovery code.',
              )}
            </p>
          </div>
          <nav>
            <Link href="/faq">{copy.nav.faq}</Link>
            <Link href="/security">{copy.nav.security}</Link>
            <Link href="/legal/community">{copy.footer.legalLinks.community}</Link>
            <Link href="/legal/copyright">
              {local(locale, 'Telif Politikası', 'Copyright Policy')}
            </Link>
          </nav>
        </section>
      </main>
    </MarketingShell>
  );
}

function BlogCard({ locale, post }: { locale: Locale; post: BlogPost }) {
  return (
    <article className={styles.blogCard}>
      <div>
        <span>{localized(locale, post.category)}</span>
        <time dateTime={post.date}>
          {new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
            dateStyle: 'long',
          }).format(new Date(`${post.date}T12:00:00Z`))}
        </time>
      </div>
      <h2>{localized(locale, post.title)}</h2>
      <p>{localized(locale, post.summary)}</p>
      <Link href={`/blog/${post.slug}`}>
        {local(locale, 'Yazıyı oku', 'Read article')} · {post.readMinutes}{' '}
        {local(locale, 'dk', 'min')}
        <ArrowRight size={14} />
      </Link>
    </article>
  );
}

export function BlogPage({ locale, copy }: { locale: Locale; copy: MarketingCopy }) {
  return (
    <MarketingShell locale={locale} copy={copy}>
      <main className={styles.innerPage}>
        <PageHero
          locale={locale}
          eyebrow="WAPVE BLOG"
          title={local(
            locale,
            'Ürünün içinden, doğrudan.',
            'Directly from the people building Wapve.',
          )}
          intro={local(
            locale,
            'Ürün duyuruları, güvenlik yaklaşımı, topluluk notları ve Wapve’nin nasıl geliştiğine dair yazılar.',
            'Product announcements, security practices, community notes and stories about how Wapve evolves.',
          )}
          icon={Newspaper}
        />
        <section className={styles.blogGrid}>
          {blogPosts.map((post) => (
            <BlogCard locale={locale} post={post} key={post.slug} />
          ))}
        </section>
        <section className={styles.contactBand}>
          <Mail size={24} />
          <div>
            <h2>{local(locale, 'Bir konu önerin mi var?', 'Have a topic suggestion?')}</h2>
            <p>
              {local(
                locale,
                'Görmek istediğin teknik veya topluluk konusunu bize ilet.',
                'Send us a technical or community topic you would like to see.',
              )}
            </p>
          </div>
          <a href="mailto:info@wapve.com?subject=Wapve%20Blog">
            info@wapve.com
            <ArrowRight size={15} />
          </a>
        </section>
      </main>
    </MarketingShell>
  );
}

export function BlogPostPage({
  locale,
  copy,
  post,
}: {
  locale: Locale;
  copy: MarketingCopy;
  post: BlogPost;
}) {
  return (
    <MarketingShell locale={locale} copy={copy}>
      <main className={styles.blogArticle}>
        <Link className={styles.blogBack} href="/blog">
          <ArrowRight size={14} />
          {local(locale, 'Tüm yazılar', 'All articles')}
        </Link>
        <header>
          <span>{localized(locale, post.category)}</span>
          <h1>{localized(locale, post.title)}</h1>
          <p>{localized(locale, post.summary)}</p>
          <div>
            <time dateTime={post.date}>
              {new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
                dateStyle: 'long',
              }).format(new Date(`${post.date}T12:00:00Z`))}
            </time>
            <i />
            {post.readMinutes} {local(locale, 'dakika okuma', 'minute read')}
          </div>
        </header>
        <article>
          {post.sections.map((section) => (
            <section key={section.title.en}>
              <h2>{localized(locale, section.title)}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.en}>{localized(locale, paragraph)}</p>
              ))}
            </section>
          ))}
        </article>
        <nav className={styles.blogArticleFooter}>
          <Link href="/blog">{local(locale, 'Bloga dön', 'Back to blog')}</Link>
          <Link href="/register">
            {local(locale, 'Ücretsiz başla', 'Start for free')}
            <ArrowRight size={14} />
          </Link>
        </nav>
      </main>
    </MarketingShell>
  );
}

export function DownloadMarketingPage({
  locale,
  copy,
}: {
  locale: Locale;
  copy: MarketingCopy;
}) {
  return (
    <MarketingShell locale={locale} copy={copy}>
      <main className={styles.innerPage}>
        <DownloadVerificationCard
          copy={copy.pages.download}
          release={LATEST_WINDOWS_DESKTOP_RELEASE}
        />
      </main>
    </MarketingShell>
  );
}
