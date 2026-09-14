const challengePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type QrLoginScan = { challengeId: string; token: string };

export function parseWapveQr(value: string): QrLoginScan | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'wapve.com' || url.pathname !== '/qr-login' || url.username || url.password || url.hash) return null;
    const challengeId = url.searchParams.get('challenge'); const token = url.searchParams.get('token');
    if (!challengeId || !challengePattern.test(challengeId) || !token || token.length < 32 || token.length > 512) return null;
    return { challengeId, token };
  } catch { return null; }
}
