import { describe, expect, it } from 'vitest';
import {
  LATEST_WINDOWS_DESKTOP_RELEASE,
  getVerificationPowerShellCommand,
} from './desktop-release.js';

describe('desktop release contracts', () => {
  it('defines valid latest windows desktop release metadata', () => {
    expect(LATEST_WINDOWS_DESKTOP_RELEASE.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(LATEST_WINDOWS_DESKTOP_RELEASE.platform).toBe('win32');
    expect(LATEST_WINDOWS_DESKTOP_RELEASE.arch).toBe('x64');
    expect(LATEST_WINDOWS_DESKTOP_RELEASE.filename).toMatch(/^Wapve_.*\.exe$/);
    expect(LATEST_WINDOWS_DESKTOP_RELEASE.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(LATEST_WINDOWS_DESKTOP_RELEASE.sizeBytes).toBeGreaterThan(50 * 1024 * 1024);
    expect(LATEST_WINDOWS_DESKTOP_RELEASE.downloadUrl).toBe('/api/v1/desktop/download/windows');
  });

  it('generates correct powershell verification command', () => {
    const cmd = getVerificationPowerShellCommand(LATEST_WINDOWS_DESKTOP_RELEASE);
    expect(cmd).toContain(`(Get-FileHash .\\${LATEST_WINDOWS_DESKTOP_RELEASE.filename}).Hash -eq`);
    expect(cmd).toContain(LATEST_WINDOWS_DESKTOP_RELEASE.sha256.toUpperCase());
  });
});
