'use client';

import type { PremiumCosmeticItem, PremiumCosmeticType, PremiumCosmeticVisual, UserProfile } from '@wapve/contracts';
import { avatarDecorationAsset, nameplateAsset, profileFrameAsset } from './premium-cosmetic-registry';
import { GeneratedProfileFrame } from './generated-profile-frame';

type Candidate = {
  type: PremiumCosmeticType;
  visual: PremiumCosmeticItem['visual'] | null;
} | null;

function candidateVisual(
  candidate: Candidate,
  type: PremiumCosmeticType,
  current: PremiumCosmeticVisual | null | undefined,
) {
  return candidate?.type === type ? candidate.visual : current;
}

export function ProfileIdentityPreview({
  user,
  candidate = null,
  className = '',
  compact = false,
}: {
  user: UserProfile;
  candidate?: Candidate;
  className?: string;
  compact?: boolean;
}) {
  const avatarVisual = candidateVisual(candidate, 'AVATAR_DECORATION', user.premium?.avatarDecoration);
  const profileVisual = candidateVisual(candidate, 'PROFILE_EFFECT', user.premium?.profileEffect);
  const nameplateVisual = candidateVisual(candidate, 'NAMEPLATE', user.premium?.nameplate);
  const avatarAsset = avatarDecorationAsset(avatarVisual);
  const frameAsset = profileFrameAsset(profileVisual);
  const plateAsset = nameplateAsset(nameplateVisual);
  return (
    <article className={`profile-identity-preview${compact ? ' is-compact' : ''}${frameAsset?.kind === 'frame' ? ' has-profile-frame' : frameAsset ? ' has-profile-overlay' : ''}${className ? ` ${className}` : ''}`}>
      <div className="identity-preview-banner">
        {user.bannerUrl && <img src={user.bannerUrl} alt="" />}
      </div>
      <div className="identity-preview-avatar">
        {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <span>{user.displayName.slice(0, 1).toUpperCase()}</span>}
        {avatarAsset && <img className="identity-preview-avatar-decoration" src={avatarAsset} alt="" />}
        <i className={`status-dot ${user.status.toLowerCase()}`} />
      </div>
      <div className={`identity-preview-nameplate${plateAsset ? ' has-asset' : ''}`}>
        {plateAsset && <img src={plateAsset} alt="" />}
        <span><strong>{user.displayName}</strong><small>@{user.username}</small></span>
      </div>
      {!compact && <p>{user.bio || (user.locale === 'tr' ? 'Profilinin canlı önizlemesi' : 'A live preview of your profile')}</p>}
      {frameAsset && <GeneratedProfileFrame frame={frameAsset} />}
    </article>
  );
}
