import type { VoiceIceConfiguration } from '@wapve/contracts';

export type VoiceCandidateType = 'host' | 'srflx' | 'prflx' | 'relay';
export type VoiceTransport = 'CHECKING' | 'DIRECT' | 'RELAYED';

export function isCanonicalTurnUri(url: string): boolean {
  return /^turns?:[^/?#\s][^\s]*$/i.test(url);
}

export function classifyVoiceTransport(candidateTypes: VoiceCandidateType[]): VoiceTransport {
  if (candidateTypes.includes('relay')) return 'RELAYED';
  return candidateTypes.length ? 'DIRECT' : 'CHECKING';
}

export function isPrivateVoiceConfiguration(configuration: VoiceIceConfiguration): boolean {
  return (
    configuration.turnEnabled &&
    configuration.iceTransportPolicy === 'relay' &&
    configuration.iceServers.length > 0 &&
    configuration.iceServers.every(
      (server) =>
        Boolean(server.username && server.credential) &&
        server.urls.length > 0 &&
        server.urls.every(isCanonicalTurnUri),
    )
  );
}

export function iceCandidateMatchesRemoteDescription(
  candidate: RTCIceCandidateInit,
  remoteSdp: string | null | undefined,
): boolean {
  const candidateFragment =
    candidate.usernameFragment ?? /(?:^|\s)ufrag\s+([^\s]+)/i.exec(candidate.candidate ?? '')?.[1];
  if (!candidateFragment || !remoteSdp) return true;
  const remoteFragments = [...remoteSdp.matchAll(/^a=ice-ufrag:([^\r\n]+)/gim)].map((match) =>
    match[1]!.trim(),
  );
  return remoteFragments.length === 0 || remoteFragments.includes(candidateFragment);
}
