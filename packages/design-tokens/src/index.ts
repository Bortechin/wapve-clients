export const colors = {
  ink: '#050A18',
  canvas: '#07101F',
  surface: '#0B1729',
  surfaceRaised: '#10213A',
  surfaceSoft: '#132945',
  line: '#203B5C',
  lineStrong: '#2B5179',
  text: '#F5FAFF',
  textMuted: '#94A9BF',
  textDim: '#647C96',
  wave: '#1598FF',
  waveBright: '#47C7FF',
  cyan: '#62E3FF',
  success: '#35D07F',
  warning: '#FFB84A',
  danger: '#FF667D',
  overlay: 'rgba(2, 7, 18, 0.78)',
} as const;

export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;
export const touch = { minimum: 48 } as const;
export const typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '800' as const },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '800' as const },
  heading: { fontSize: 17, lineHeight: 23, fontWeight: '700' as const },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' as const },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '700' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
} as const;
export const motion = { quick: 160, normal: 260, deliberate: 420 } as const;

export const wapveTheme = { colors, spacing, radius, touch, typography, motion } as const;
export type WapveTheme = typeof wapveTheme;
