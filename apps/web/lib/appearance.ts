export const themeIds = ['dark', 'purple', 'blue', 'green', 'burgundy'] as const;
export type ThemeId = typeof themeIds[number];
export const themeKey = 'wapve:theme:v1';
export const gameSharingKey = 'wapve:game-sharing:v1';
export function readTheme(): ThemeId {
  try { const value = localStorage.getItem(themeKey); return themeIds.find(id => id === value) ?? 'dark'; }
  catch { return 'dark'; }
}
export function applyTheme(theme: ThemeId): void {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(themeKey, theme); } catch { /* Private storage may be unavailable. */ }
}
export function gameSharingEnabled(): boolean {
  try { return localStorage.getItem(gameSharingKey) !== 'false'; } catch { return true; }
}
export function setGameSharing(enabled: boolean): void {
  try { localStorage.setItem(gameSharingKey, String(enabled)); } catch { /* Keep the current session usable. */ }
  window.dispatchEvent(new CustomEvent('wapve:game-sharing', { detail: enabled }));
}
