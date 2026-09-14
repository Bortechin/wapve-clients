import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import * as SecureStore from 'expo-secure-store';
import { colors } from '@wapve/design-tokens';

type Palette = { [K in keyof typeof colors]: string };
export const mobileThemes = {
  dark: {
    ...colors,
    ink: '#16181D',
    canvas: '#1C1E25',
    surface: '#23262E',
    surfaceRaised: '#2B2F39',
    surfaceSoft: '#343945',
    line: '#353A46',
    lineStrong: '#495161',
  },
  purple: {
    ...colors,
    ink: '#191522',
    canvas: '#211B2D',
    surface: '#2A2339',
    surfaceRaised: '#352C47',
    surfaceSoft: '#413557',
    line: '#493B5E',
    wave: '#9B7BFF',
    waveBright: '#B99EFF',
  },
  blue: { ...colors },
  green: {
    ...colors,
    ink: '#111E1B',
    canvas: '#172721',
    surface: '#1D3029',
    surfaceRaised: '#263D33',
    surfaceSoft: '#304B3E',
    line: '#365A47',
    wave: '#36B983',
    waveBright: '#74DFAC',
  },
  burgundy: {
    ...colors,
    ink: '#24151C',
    canvas: '#2D1B24',
    surface: '#38232E',
    surfaceRaised: '#462C3A',
    surfaceSoft: '#553446',
    line: '#614053',
    wave: '#DD648E',
    waveBright: '#FF93B7',
  },
} satisfies Record<string, Palette>;
export type MobileThemeId = keyof typeof mobileThemes;
const key = 'wapve.mobile.appearance.v1';
const AppearanceContext = createContext<{
  theme: MobileThemeId;
  palette: Palette;
  setTheme(theme: MobileThemeId): Promise<void>;
}>({ theme: 'dark', palette: mobileThemes.dark, setTheme: () => Promise.resolve() });

export function AppearanceProvider({ children }: PropsWithChildren) {
  const [theme, update] = useState<MobileThemeId>('dark');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    void SecureStore.getItemAsync(key)
      .then((value) => {
        if (active && value && Object.hasOwn(mobileThemes, value)) update(value as MobileThemeId);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  async function setTheme(next: MobileThemeId) {
    await SecureStore.setItemAsync(key, next);
    update(next);
  }
  if (!ready) return null;
  return (
    <AppearanceContext.Provider value={{ theme, palette: mobileThemes[theme], setTheme }}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  return useContext(AppearanceContext);
}

/** Map semantic legacy tokens without modifying media or user-selected role colors. */
export function themeColor(value: unknown, palette: Palette): unknown {
  if (typeof value !== 'string') return value;
  const token = (Object.keys(colors) as Array<keyof typeof colors>).find(
    (name) => colors[name].toLowerCase() === value.toLowerCase(),
  );
  return token ? palette[token] : value;
}
