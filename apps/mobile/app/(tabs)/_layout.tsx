import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/lib/auth';

export default function TabLayout() {
  const { user } = useAuth();
  if (!user) return <Redirect href="/auth/login" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
