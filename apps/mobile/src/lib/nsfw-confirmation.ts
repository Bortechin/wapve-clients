import * as SecureStore from 'expo-secure-store';

const prefix = 'wapve.nsfw-confirmed.v1.';

function key(userId: string, channelId: string) {
  return `${prefix}${userId}.${channelId}`;
}

export async function hasConfirmedNsfw(userId: string, channelId: string) {
  return (await SecureStore.getItemAsync(key(userId, channelId))) === 'yes';
}

export async function confirmNsfw(userId: string, channelId: string) {
  await SecureStore.setItemAsync(key(userId, channelId), 'yes', {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}
