import * as SecureStore from 'expo-secure-store';

const prefix = 'wapve.message.draft.v1.';

export async function loadMessageDraft(threadKey: string) {
  return (await SecureStore.getItemAsync(`${prefix}${threadKey}`)) ?? '';
}

export async function saveMessageDraft(threadKey: string, content: string) {
  if (content.trim()) await SecureStore.setItemAsync(`${prefix}${threadKey}`, content);
  else await SecureStore.deleteItemAsync(`${prefix}${threadKey}`);
}
