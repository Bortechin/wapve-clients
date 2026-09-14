import { requireNativeModule } from 'expo-modules-core';

type WapveCredentialsNativeModule = {
  authenticatePasskey(requestJson: string): Promise<string>;
  createPasskey(requestJson: string): Promise<string>;
  openProviderSettings(): Promise<void>;
};

export default requireNativeModule<WapveCredentialsNativeModule>('WapveCredentials');
