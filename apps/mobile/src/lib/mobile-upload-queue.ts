export const MAX_MOBILE_ATTACHMENT_COUNT = 10;
export const MAX_MOBILE_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export type MobileUploadCandidate = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number | null;
};

export type MobileUploadRejection = {
  candidate: MobileUploadCandidate;
  reason: 'duplicate' | 'too-large' | 'queue-full';
};

export function acceptMobileUploadCandidates(
  existing: MobileUploadCandidate[],
  candidates: MobileUploadCandidate[],
) {
  const accepted: MobileUploadCandidate[] = [];
  const rejected: MobileUploadRejection[] = [];
  const fingerprints = new Set(existing.map(uploadFingerprint));

  for (const candidate of candidates) {
    const fingerprint = uploadFingerprint(candidate);
    if (fingerprints.has(fingerprint)) {
      rejected.push({ candidate, reason: 'duplicate' });
      continue;
    }
    if (typeof candidate.size === 'number' && candidate.size > MAX_MOBILE_ATTACHMENT_BYTES) {
      rejected.push({ candidate, reason: 'too-large' });
      continue;
    }
    if (existing.length + accepted.length >= MAX_MOBILE_ATTACHMENT_COUNT) {
      rejected.push({ candidate, reason: 'queue-full' });
      continue;
    }
    fingerprints.add(fingerprint);
    accepted.push(candidate);
  }

  return { accepted, rejected };
}

export function formatUploadBytes(bytes?: number | null) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function uploadFingerprint(candidate: MobileUploadCandidate) {
  return `${candidate.uri}\u0000${candidate.name}\u0000${candidate.size ?? 'unknown'}`;
}
