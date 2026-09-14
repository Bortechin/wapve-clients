import { requireNativeModule } from 'expo-modules-core';

export type CallBubbleAction = 'mute' | 'deafen' | 'speaker' | 'hangup';
type WapveCallNativeModule = {
  addListener(eventName: 'onCallBubbleAction', listener: (event: { action: CallBubbleAction; callId?: string; nativeApplied?: boolean }) => void): { remove(): void };
  showIncomingCall(callId: string, title: string, deepLink: string): Promise<void>;
  startCallService(callId: string, title: string, deepLink: string): Promise<void>;
  stopCall(callId: string): Promise<void>;
  canDrawCallBubble(): Promise<boolean>;
  requestCallBubblePermission(): Promise<boolean>;
  setCallBubbleVisible(callId: string, title: string, visible: boolean): Promise<boolean>;
  setSpeakerEnabled(enabled: boolean): Promise<void>;
  getCallVolume(): Promise<number>;
  setCallVolume(value: number): Promise<void>;
  getAudioRoutes(): Promise<Array<{ id: string; label: string; type: 'speaker' | 'earpiece' | 'wired' | 'bluetooth' | 'usb' | 'other'; selected: boolean }>>;
  setAudioRoute(routeId: string): Promise<boolean>;
  setLeftEdgeGestureExclusion(enabled: boolean, widthDp: number): Promise<void>;
};

export default requireNativeModule<WapveCallNativeModule>('WapveCall');
