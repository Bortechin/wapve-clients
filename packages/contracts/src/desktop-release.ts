export interface DesktopReleaseInfo {
  version: string;
  releaseDate: string;
  platform: 'win32';
  arch: 'x64';
  filename: string;
  sizeBytes: number;
  sha256: string;
  minOsVersion: string;
  downloadUrl: string;
}

export const LATEST_WINDOWS_DESKTOP_RELEASE: DesktopReleaseInfo = {
  version: '0.3.7',
  releaseDate: '2026-09-07',
  platform: 'win32',
  arch: 'x64',
  filename: 'Wapve_0.3.7_x64-setup.exe',
  sizeBytes: 104889983,
  sha256: '44ad1c67883214c06b6c06385945689d114ae84a2d010e5b702f195df4661a4a',
  minOsVersion: 'Windows 10 / Windows 11 (64-bit)',
  downloadUrl: '/api/v1/desktop/download/windows',
};

export function getVerificationPowerShellCommand(
  release: DesktopReleaseInfo = LATEST_WINDOWS_DESKTOP_RELEASE,
): string {
  return `(Get-FileHash .\\${release.filename}).Hash -eq "${release.sha256.toUpperCase()}"`;
}
