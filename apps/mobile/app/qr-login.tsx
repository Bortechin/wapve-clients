import { Redirect, useLocalSearchParams } from 'expo-router';
export default function QrDeepLink() { const { challenge, token } = useLocalSearchParams<{ challenge: string; token: string }>(); return <Redirect href={{ pathname: '/qr/approve', params: { challengeId: challenge, token } }} />; }
