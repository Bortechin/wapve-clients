import type { ExpoConfig, ConfigContext } from 'expo/config';

const development = process.env.APP_VARIANT === 'development';
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: development ? 'Wapve Alpha' : 'Wapve',
  slug: 'wapve',
  version: '0.1.4',
  orientation: 'default',
  icon: '../web/public/brand/wapve-icon-v2-512.png',
  scheme: 'wapve',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  runtimeVersion: { policy: 'appVersion' },
  locales: {
    tr: {
      ios: {
        NSCameraUsageDescription: 'Wapve, görüntülü görüşme ve QR tarama için kamerayı kullanır.',
        NSMicrophoneUsageDescription: 'Wapve, sesli mesaj ve görüşmeler için mikrofonu kullanır.',
        NSPhotoLibraryUsageDescription: 'Wapve, sohbetlerde medya paylaşmak için fotoğraflarına erişir.',
      },
    },
    en: {
      ios: {
        NSCameraUsageDescription: 'Wapve uses the camera for video calls and QR scanning.',
        NSMicrophoneUsageDescription: 'Wapve uses the microphone for voice messages and calls.',
        NSPhotoLibraryUsageDescription: 'Wapve accesses your photos when you share media in chats.',
      },
    },
  },
  android: {
    package: development ? 'com.wapve.dev' : 'com.wapve',
    versionCode: 5,
    softwareKeyboardLayoutMode: 'resize',
    ...(googleServicesFile ? { googleServicesFile } : {}),
    adaptiveIcon: {
      foregroundImage: '../web/public/brand/wapve-icon-v2-512.png',
      backgroundColor: '#050A18',
    },
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: 'wapve.com', pathPrefix: '/qr-login' },
          { scheme: 'https', host: 'wapve.com', pathPrefix: '/invite' },
          { scheme: 'https', host: 'wapve.com', pathPrefix: '/channels' },
          { scheme: 'https', host: 'wapve.com', pathPrefix: '/waves' },
          { scheme: 'https', host: 'wapve.com', pathPrefix: '/verify-email' },
          { scheme: 'https', host: 'wapve.com', pathPrefix: '/reset-password' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
    permissions: [
      'android.permission.CAMERA',
      'android.permission.RECORD_AUDIO',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE',
      'android.permission.FOREGROUND_SERVICE_CAMERA',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.MODIFY_AUDIO_SETTINGS',
      'android.permission.USE_FULL_SCREEN_INTENT',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
  },
  ios: {
    bundleIdentifier: 'com.wapve',
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription: 'Wapve, görüntülü görüşme ve QR tarama için kamerayı kullanır.',
      NSMicrophoneUsageDescription: 'Wapve, sesli mesaj ve görüşmeler için mikrofonu kullanır.',
    },
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-camera',
      {
        cameraPermission:
          'QR kodu taramak ve görüntülü görüşme yapmak için kamera erişimi gerekir.',
      },
    ],
    [
      'expo-image-picker',
      { photosPermission: 'Sohbetlerde medya paylaşmak için fotoğraflarına erişim gerekir.' },
    ],
    ['expo-notifications', { defaultChannel: 'wapve_messages' }],
    [
      'expo-splash-screen',
      {
        image: '../web/public/brand/wapve-wave-mark-v2.png',
        backgroundColor: '#050A18',
        imageWidth: 180,
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 28,
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          kotlinVersion: '2.2.20',
        },
      },
    ],
    '@config-plugins/react-native-webrtc',
    './plugins/with-local-release-signing.cjs',
  ],
  experiments: { typedRoutes: true },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'https://wapve.com/api/v1',
    socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL ?? 'https://wapve.com',
    development,
  },
});
