jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

jest.mock('../../modules/wapve-call', () => ({
  __esModule: true,
  default: {
    showIncomingCall: jest.fn(async () => undefined),
    startCallService: jest.fn(async () => undefined),
    stopCall: jest.fn(async () => undefined),
    setSpeakerEnabled: jest.fn(async () => undefined),
    canDrawCallBubble: jest.fn(async () => false),
    requestCallBubblePermission: jest.fn(async () => undefined),
    setCallBubbleVisible: jest.fn(async () => false),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));
import { jest } from '@jest/globals';
