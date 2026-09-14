import { Download, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { DesktopReleaseInfo } from '@wapve/contracts';
import type { MarketingCopy } from '@/lib/marketing-copy';
import styles from './public-site.module.css';

export function DownloadVerificationCard({
  copy,
  release,
}: {
  copy: MarketingCopy['pages']['download'];
  release: DesktopReleaseInfo;
}) {
  return (
    <div className={styles.downloadContainer}>
      <div className={styles.downloadHeroCard}>
        <div className={styles.downloadCardGlow} aria-hidden="true" />
        <span className={styles.downloadBadge}>{copy.architectureBadge}</span>
        <h1 className={styles.downloadTitle}>
          {copy.title} <span>{copy.accent}</span>
        </h1>
        <p className={styles.downloadDescription}>{copy.description}</p>

        <div className={styles.downloadMainAction}>
          <a
            className={styles.shimmerButton}
            href={release.downloadUrl}
            download={release.filename}
          >
            <Download size={18} />
            <span>{copy.downloadButton}</span>
          </a>
          <span className={styles.downloadMeta}>
            {copy.versionBadge} · {(release.sizeBytes / (1024 * 1024)).toFixed(1)} MB
          </span>
        </div>

        <p className={styles.downloadRequirements}>{copy.requirements}</p>

        <div className={styles.downloadAltLink}>
          <Link href="/app">
            <span>{copy.webAlternative}</span>
            <ExternalLink size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}
