import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/src/generated/**',
      '**/postcss.config.mjs',
      '**/public/audio/**',
      '**/scripts/prepare-audio-assets.mjs',
      '**/scripts/optimize-premium-assets.mjs',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  prettier,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
  {
    ...tseslint.configs.disableTypeChecked,
    files: ['apps/web/public/theme-init.js'],
  },
  {
    files: ['apps/mobile/**/*.{ts,tsx}'],
    rules: {
      // React hooks/context APIs and Expo Router expose intentionally unbound callbacks.
      '@typescript-eslint/unbound-method': 'off',
      // Metro's canonical static asset syntax is require('asset.png' | 'asset.wav').
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['apps/mobile/app/call/**/*.{ts,tsx}', 'apps/mobile/app/voice/**/*.{ts,tsx}'],
    rules: {
      // react-native-webrtc 124 loses candidate/track types at this library boundary.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  {
    files: ['apps/mobile/src/test/**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/require-await': 'off' },
  },
);
