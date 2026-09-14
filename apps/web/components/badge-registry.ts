import type { PlatformBadge } from '@wapve/contracts';

export type BadgePresentation = {
  id: PlatformBadge;
  priority: number;
  title: { tr: string; en: string };
  eyebrow: { tr: string; en: string };
  description: { tr: string; en: string };
  image: string;
  color: string;
};

export type OwnedBadge =
  | { kind: 'premium'; id: 'WAPVE_PLUS' }
  | { kind: 'platform'; id: PlatformBadge };

export const platformBadgeRegistry = {
  PLATFORM_OWNER: {
    id: 'PLATFORM_OWNER',
    priority: 0,
    title: { tr: 'Uygulama Sahibi', en: 'Application Owner' },
    eyebrow: { tr: 'ÖZEL ROZET', en: 'SPECIAL BADGE' },
    description: {
      tr: 'Wapve’nin kurucusu ve en üst yetkilisi.',
      en: 'Founder of Wapve and its highest authority.',
    },
    image: '/brand/platform-owner-badge.png',
    color: '#fbbf24',
  },
  SYSTEM: {
    id: 'SYSTEM',
    priority: 1,
    title: { tr: 'Resmî Wapve Sistemi', en: 'Official Wapve System' },
    eyebrow: { tr: 'DOĞRULANMIŞ SİSTEM HESABI', en: 'VERIFIED SYSTEM ACCOUNT' },
    description: {
      tr: 'Yalnızca Wapve tarafından güvenli sistem bildirimleri gönderen doğrulanmış hesap.',
      en: 'Verified account used only by Wapve for secure system notifications.',
    },
    image: '/brand/wapve-system-badge.png',
    color: '#38bdf8',
  },
  STAFF: {
    id: 'STAFF',
    priority: 2,
    title: { tr: 'Wapve Ekibi', en: 'Wapve Staff' },
    eyebrow: { tr: 'WAPVE ROZETİ', en: 'WAPVE BADGE' },
    description: {
      tr: 'Wapve ekibinin doğrulanmış üyesi.',
      en: 'Verified member of the Wapve team.',
    },
    image: '/brand/badge-staff.png',
    color: '#22d3ee',
  },
  MODERATOR: {
    id: 'MODERATOR',
    priority: 3,
    title: { tr: 'Platform Moderatörü', en: 'Platform Moderator' },
    eyebrow: { tr: 'WAPVE ROZETİ', en: 'WAPVE BADGE' },
    description: {
      tr: 'Platform güvenliği ve moderasyonu için yetkilendirilmiş ekip üyesi.',
      en: 'Authorized platform safety and moderation team member.',
    },
    image: '/brand/badge-moderator.png',
    color: '#fb7185',
  },
  DEVELOPER: {
    id: 'DEVELOPER',
    priority: 4,
    title: { tr: 'Geliştirici', en: 'Developer' },
    eyebrow: { tr: 'WAPVE ROZETİ', en: 'WAPVE BADGE' },
    description: {
      tr: 'Wapve ürünlerini geliştiren ekip üyesi.',
      en: 'Member of the team building Wapve products.',
    },
    image: '/brand/badge-developer.png',
    color: '#60a5fa',
  },
  SUPPORT: {
    id: 'SUPPORT',
    priority: 5,
    title: { tr: 'Destek Ekibi', en: 'Support Team' },
    eyebrow: { tr: 'WAPVE ROZETİ', en: 'WAPVE BADGE' },
    description: {
      tr: 'Kullanıcı sorunlarında yardımcı olan doğrulanmış destek görevlisi.',
      en: 'Verified support representative helping users.',
    },
    image: '/brand/badge-support.png',
    color: '#34d399',
  },
  PARTNER: {
    id: 'PARTNER',
    priority: 6,
    title: { tr: 'Wapve Ortağı', en: 'Wapve Partner' },
    eyebrow: { tr: 'WAPVE ROZETİ', en: 'WAPVE BADGE' },
    description: {
      tr: 'Wapve ile resmî ortaklık kurmuş topluluk veya kişi.',
      en: 'Community or creator officially partnered with Wapve.',
    },
    image: '/brand/badge-partner.png',
    color: '#c084fc',
  },
  VERIFIED_CREATOR: {
    id: 'VERIFIED_CREATOR',
    priority: 7,
    title: { tr: 'Doğrulanmış Üretici', en: 'Verified Creator' },
    eyebrow: { tr: 'WAPVE ROZETİ', en: 'WAPVE BADGE' },
    description: {
      tr: 'Kimliği doğrulanmış içerik üreticisi.',
      en: 'Identity-verified content creator.',
    },
    image: '/brand/badge-verified-creator.png',
    color: '#38bdf8',
  },
  EARLY_SUPPORTER: {
    id: 'EARLY_SUPPORTER',
    priority: 8,
    title: { tr: 'İlk Destekçi', en: 'Early Supporter' },
    eyebrow: { tr: 'WAPVE ROZETİ', en: 'WAPVE BADGE' },
    description: {
      tr: 'Wapve’yi ilk döneminde destekleyen üye.',
      en: 'Member who supported Wapve in its early days.',
    },
    image: '/brand/badge-early-supporter.png',
    color: '#fbbf24',
  },
  BUG_HUNTER: {
    id: 'BUG_HUNTER',
    priority: 9,
    title: { tr: 'Hata Avcısı', en: 'Bug Hunter' },
    eyebrow: { tr: 'WAPVE ROZETİ', en: 'WAPVE BADGE' },
    description: {
      tr: 'Önemli bir hatayı sorumlu şekilde bildiren üye.',
      en: 'Member who responsibly reported an important bug.',
    },
    image: '/brand/badge-bug-hunter.png',
    color: '#a3e635',
  },
  COMMUNITY_CHAMPION: {
    id: 'COMMUNITY_CHAMPION',
    priority: 10,
    title: { tr: 'Topluluk Öncüsü', en: 'Community Champion' },
    eyebrow: { tr: 'WAPVE ROZETİ', en: 'WAPVE BADGE' },
    description: {
      tr: 'Wapve topluluğuna olağanüstü katkıda bulunan üye.',
      en: 'Member making outstanding contributions to the Wapve community.',
    },
    image: '/brand/badge-community-champion.png',
    color: '#f59e0b',
  },
  SERVER_SURFER: {
    id: 'SERVER_SURFER',
    priority: 11,
    title: { tr: 'Sunucu Sörfçüsü', en: 'Server Surfer' },
    eyebrow: { tr: 'AKTİF TAKVİYE ROZETİ', en: 'ACTIVE BOOST BADGE' },
    description: {
      tr: 'Wapve+ takviyelerinden en az birini bir topluluğa ayıran üye.',
      en: 'Member currently assigning at least one Wapve+ boost to a community.',
    },
    image: '/brand/badge-server-surfer.png',
    color: '#22d3ee',
  },
  ALPHA_MEMBER: {
    id: 'ALPHA_MEMBER',
    priority: 12,
    title: { tr: 'Öncü Katılımcı', en: 'Early Pioneer' },
    eyebrow: { tr: 'ÖNCÜ ÜYE ROZETİ', en: 'EARLY PIONEER BADGE' },
    description: {
      tr: 'Wapve’nin ilk dalgasına katılan öncü üyelerden biri.',
      en: 'One of the pioneering members who joined Wapve’s first wave.',
    },
    image: '/brand/alpha-member-badge.png',
    color: '#a78bfa',
  },
} satisfies Record<PlatformBadge, BadgePresentation>;

export function orderedPlatformBadges(badges: PlatformBadge[]): PlatformBadge[] {
  return [...new Set(badges)].sort(
    (left, right) => platformBadgeRegistry[left].priority - platformBadgeRegistry[right].priority,
  );
}

export function ownedBadges(badges: PlatformBadge[], premiumActive: boolean): OwnedBadge[] {
  return [
    ...(premiumActive ? ([{ kind: 'premium', id: 'WAPVE_PLUS' }] as const) : []),
    ...orderedPlatformBadges(badges).map((id) => ({ kind: 'platform' as const, id })),
  ];
}
