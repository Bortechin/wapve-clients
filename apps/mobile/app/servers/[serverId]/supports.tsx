import { Pressable } from '@/components/localized-native';
import type { ServerSummary } from '@wapve/contracts';
import { useQuery } from '@tanstack/react-query';
import { colors, spacing, touch } from '@wapve/design-tokens';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet } from '@/components/themed-native';
import { SafeAreaView } from '@/components/themed-native';
import { Icon } from '@/components/icon';
import { MobileServerSupportPanel } from '@/components/server-support-panel';
import { ScreenHeader } from '@/components/ui';
import { api } from '@/lib/client';

export default function ServerSupportsScreen() {
  const { serverId = '' } = useLocalSearchParams<{ serverId: string }>();
  const servers = useQuery({ queryKey:['servers'], queryFn:()=>api.request<ServerSummary[]>('/servers') });
  const server = servers.data?.find((item)=>item.id===serverId);
  return <SafeAreaView style={styles.root}><ScreenHeader title="Woost Hedefi" left={<Pressable style={styles.back} onPress={()=>router.back()}><Icon name="arrow-left" size={27} color={colors.text} /></Pressable>} /><ScrollView contentContainerStyle={styles.content}>{server ? <MobileServerSupportPanel server={server} /> : null}</ScrollView></SafeAreaView>;
}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:colors.canvas},back:{width:touch.minimum,height:touch.minimum,alignItems:'center',justifyContent:'center'},content:{padding:spacing.md,paddingBottom:spacing.xxl}});
