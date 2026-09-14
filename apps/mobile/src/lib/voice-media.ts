import type { VoicePreferences } from './voice-preferences';

export function cameraConstraints(preferences: Pick<VoicePreferences, 'reducedData'>) {
  return preferences.reducedData
    ? { width: { ideal: 640, max: 854 }, height: { ideal: 360, max: 480 }, frameRate: { ideal: 15, max: 20 } }
    : { width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 }, frameRate: { ideal: 30, max: 30 } };
}
