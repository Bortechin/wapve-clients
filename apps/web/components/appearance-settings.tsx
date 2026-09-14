'use client';

import { useEffect, useState } from 'react';
import { applyTheme, gameSharingEnabled, readTheme, setGameSharing, themeIds, type ThemeId } from '@/lib/appearance';

export function AppearanceSettings({ locale, desktop }: { locale: string; desktop: boolean }) {
  const [theme, setTheme] = useState<ThemeId>('dark');
  const [sharing, setSharing] = useState(true);
  useEffect(() => { setTheme(readTheme()); setSharing(gameSharingEnabled()); }, []);
  const names = locale === 'tr' ? ['Koyu', 'Mor', 'Mavi', 'Yeşil', 'Bordo'] : ['Dark', 'Purple', 'Blue', 'Green', 'Burgundy'];
  return <div className="settings-section appearance-settings">
    <h3>{locale === 'tr' ? 'Tema renkleri' : 'Theme colors'}</h3>
    <div className="theme-options" role="group" aria-label={locale === 'tr' ? 'Tema' : 'Theme'}>
      {themeIds.map((id, index) => <button type="button" key={id} data-theme={id} className="theme-option" aria-pressed={theme === id} onClick={() => { applyTheme(id); setTheme(id); }}>
        <span className="theme-preview"><i /><i /><i /></span><strong>{names[index]}</strong>
      </button>)}
    </div>
    <p>{locale === 'tr' ? 'Tema seçimin bu cihazda saklanır.' : 'Your theme is saved on this device.'}</p>
    {desktop && <label className="game-sharing-setting"><input type="checkbox" checked={sharing} onChange={event => { setSharing(event.target.checked); setGameSharing(event.target.checked); }} />{locale === 'tr' ? 'Oynadığım oyunu göster' : 'Show the game I am playing'}</label>}
  </div>;
}
