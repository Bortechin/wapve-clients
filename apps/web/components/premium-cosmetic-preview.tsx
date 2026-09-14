'use client';

import type { PremiumCosmeticItem, UserProfile } from '@wapve/contracts';
import {
  avatarDecorationAsset,
  nameplateAsset,
  profileFrameAsset,
} from './premium-cosmetic-registry';
import { GeneratedProfileFrame } from './generated-profile-frame';

export function PremiumCosmeticPreview({
  item,
  user,
  className = '',
  large = false,
}: {
  item: Pick<PremiumCosmeticItem, 'name' | 'type' | 'visual'>;
  user: UserProfile;
  className?: string;
  large?: boolean;
}) {
  const classes = `premium-cosmetic-preview is-${item.type.toLowerCase().replace('_', '-')}${large ? ' is-large' : ''}${className ? ` ${className}` : ''}`;
  const avatar = user.avatarUrl
    ? <img className="premium-cosmetic-user-avatar" src={user.avatarUrl} alt="" />
    : <span className="premium-cosmetic-user-fallback">{user.displayName.slice(0, 1).toUpperCase()}</span>;

  if (item.type === 'AVATAR_DECORATION') {
    const asset = avatarDecorationAsset(item.visual);
    return (
      <div className={classes} role="img" aria-label={item.name}>
        <div className="premium-cosmetic-avatar-stage">
          <div className="premium-cosmetic-avatar-base">
            {avatar}
            {asset && <img className="premium-cosmetic-avatar-asset" src={asset} alt="" />}
          </div>
        </div>
      </div>
    );
  }

  if (item.type === 'NAMEPLATE') {
    const asset = nameplateAsset(item.visual);
    return (
      <div className={classes} role="img" aria-label={item.name}>
        <div className="premium-cosmetic-nameplate-stage">
          {asset && <img className="premium-cosmetic-nameplate-asset" src={asset} alt="" />}
          <div className="premium-cosmetic-nameplate-user">
            <div className="premium-cosmetic-nameplate-avatar">{avatar}</div>
            <span><strong>{user.displayName}</strong><small>@{user.username}</small></span>
          </div>
        </div>
      </div>
    );
  }

  const frame = profileFrameAsset(item.visual);
  return (
    <div className={classes} role="img" aria-label={item.name}>
      <div className="premium-cosmetic-effect-stage">
        <div className="premium-cosmetic-effect-banner">
          {user.bannerUrl && <img src={user.bannerUrl} alt="" />}
        </div>
        <div className="premium-cosmetic-effect-identity">
          <div>{avatar}</div>
          <span><strong>{user.displayName}</strong><small>@{user.username}</small></span>
        </div>
        {frame && <GeneratedProfileFrame frame={frame} />}
      </div>
    </div>
  );
}
