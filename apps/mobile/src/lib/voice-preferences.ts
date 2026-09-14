import * as SecureStore from 'expo-secure-store';

const key = 'wapve.voice.preferences.v1';

export type VoicePreferences = {
  speakerByDefault: boolean;
  audioInputDeviceId: string;
  outputVolume: number;
  pushToTalk: boolean;
  previewCamera: boolean;
  reducedData: boolean;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
};

const defaults: VoicePreferences = {
  speakerByDefault: false,
  audioInputDeviceId: 'default',
  outputVolume: 0.75,
  pushToTalk: false,
  previewCamera: true,
  reducedData: false,
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
};

export async function loadVoicePreferences(): Promise<VoicePreferences> {
  try {
    const stored = await SecureStore.getItemAsync(key);
    return stored ? { ...defaults, ...(JSON.parse(stored) as Partial<VoicePreferences>) } : defaults;
  } catch {
    return defaults;
  }
}

export async function saveVoicePreferences(preferences: VoicePreferences) {
  await SecureStore.setItemAsync(
    key,
    JSON.stringify({
      ...preferences,
      outputVolume: Math.max(0, Math.min(1, preferences.outputVolume)),
    }),
  );
}
