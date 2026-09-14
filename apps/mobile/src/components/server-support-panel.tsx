import { Alert, Pressable, Text } from '@/components/localized-native';
import type { ServerSummary, ServerSupportOverview } from '@wapve/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, radius, spacing, typography } from '@wapve/design-tokens';
import { ActivityIndicator, Animated, Easing, Image, StyleSheet, View } from '@/components/themed-native';
import { Icon, type IconName } from '@/components/icon';
import { api } from '@/lib/client';
import { useI18n } from '@/lib/i18n';
import { useEffect, useRef, useState } from 'react';

function MobileWoostIcon({ size = 22 }: { size?: number }) {
  return <Image source={require('../../assets/brand/woost-icon.png') as number} style={{ width: size, height: size }} resizeMode="contain" />;
}

export function MobileServerSupportPanel({ server }: { server: ServerSummary }) {
  const { locale } = useI18n();
  const tr = locale === 'tr';
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;
  const burst = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.045, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const overview = useQuery({
    queryKey: ['server-support', server.id],
    queryFn: () => api.request<ServerSupportOverview>(`/premium/servers/${server.id}`),
  });
  const support = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.request(`/premium/servers/${server.id}/support`, { method: 'POST' });
      await Promise.all([overview.refetch(), queryClient.invalidateQueries({ queryKey: ['servers'] })]);
      setCelebrating(true);
      burst.setValue(0);
      Animated.timing(burst, { toValue: 1, duration: 1600, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
        if (finished) setCelebrating(false);
      });
      Alert.alert(tr ? 'Woost tamamlandı' : 'Woost assigned', tr ? 'Woost bu sunucuya verildi.' : 'Your Woost was assigned to this server.');
    } catch {
      Alert.alert(tr ? 'Woost verilemedi' : 'Woost failed', tr ? 'Wapve+ üyeliğini ve yuva bekleme süreni kontrol et.' : 'Check Wapve+ and your slot cooldown.');
    } finally {
      setBusy(false);
    }
  };
  if (!overview.data) return <View style={styles.loading}><ActivityIndicator color={colors.waveBright} /></View>;
  const data = overview.data;
  return <View style={styles.root}>
    <View style={styles.hero}>
      <Animated.View style={[styles.orb, { transform: [{ scale: pulse }] }]}><MobileWoostIcon size={48} /><Text style={styles.level}>{data.unlimited ? '∞' : data.currentLevel}</Text></Animated.View>
      <View style={styles.heroCopy}><Text style={styles.kicker}>WAPVE WOOST</Text><Text style={styles.title} numberOfLines={1}>{server.name}</Text><Text style={styles.muted}>{data.unlimited ? '∞' : data.currentCount} Woost · {tr ? 'Seviye' : 'Level'} {data.currentLevel}</Text><View style={styles.live}><View style={styles.liveDot} /><Text style={styles.liveText}>{tr ? 'AKTİF' : 'ACTIVE'}</Text></View></View>
      <View style={styles.heroCount}><Text style={styles.heroCountValue}>{data.unlimited ? '∞' : data.currentCount}</Text><Text style={styles.heroCountLabel}>Woost</Text></View>
      {celebrating && <Animated.View pointerEvents="none" style={[styles.burst, { opacity: burst.interpolate({ inputRange: [0, .3, 1], outputRange: [0, 1, 0] }), transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [.35, 2.8] }) }] }]}><View style={styles.burstRing} /><Icon name="star-four-points" size={26} color="#c4f8ff" /></Animated.View>}
    </View>
    <View style={styles.progressCopy}><Text style={styles.muted}>{data.nextThreshold ? `${tr ? 'Sonraki hedef' : 'Next goal'}: ${data.nextThreshold} Woost` : (tr ? 'Tüm seviyeler açık' : 'All levels unlocked')}</Text><Text style={styles.progressValue}>{data.unlimited ? '∞' : `${Math.round(data.progressPercent)}%`}</Text></View>
    <View style={styles.track}><View style={[styles.fill, { width: `${data.progressPercent}%` }]} /></View>
    <View style={styles.perks}><Perk icon="speedometer" value={`${data.perks.voiceBitrateKbps} kbps`} label={tr ? 'Ses kalitesi' : 'Voice quality'} /><Perk icon="emoticon-outline" value={`${data.perks.emojiSlots}`} label={tr ? 'Emoji yuvası' : 'Emoji slots'} /><Perk icon="compass-outline" value={data.perks.discoveryPriority ? (tr ? 'Öncelikli' : 'Priority') : (tr ? 'Standart' : 'Standard')} label={tr ? 'Keşfet' : 'Discovery'} /></View>
    <View style={styles.levels}>{data.levels.map((item) => <View key={item.level} style={[styles.levelRow, item.unlocked && styles.levelRowActive]}><View style={styles.levelMark}>{item.unlocked ? <Icon name="check" size={18} color={colors.waveBright} /> : <Text style={styles.levelMarkText}>{item.level}</Text>}</View><View><Text style={styles.levelTitle}>{tr ? 'Seviye' : 'Level'} {item.level}</Text><Text style={styles.muted}>{item.requiredSupports} Woost · {item.perks.voiceBitrateKbps} kbps · {item.perks.emojiSlots} emoji</Text></View></View>)}</View>
    <Pressable disabled={busy || !data.canSupport} style={[styles.button, busy && styles.buttonBusy, celebrating && styles.buttonComplete]} onPress={() => void support()}><View style={styles.buttonIcon}>{busy ? <ActivityIndicator color="#fff" size="small" /> : celebrating ? <Icon name="check" size={19} color="#fff" /> : <MobileWoostIcon size={29} />}</View><Text style={styles.buttonText}>{busy ? (tr ? 'Woost gönderiliyor…' : 'Sending Woost…') : celebrating ? (tr ? 'Woost gönderildi' : 'Woost sent') : data.unlimited ? (tr ? 'Sonsuz Woost etkin' : 'Unlimited Woost active') : (tr ? 'Bu sunucuya Woost yap' : 'Woost this server')}</Text>{!busy && !celebrating && data.canSupport && <Text style={styles.buttonArrow}>→</Text>}</Pressable>
    <Text style={styles.buttonHint}>{tr ? 'Wapve+ üyeleri bir Woost yuvası kullanır. Seviye eşikleri 2, 7 ve 14’tür.' : 'Wapve+ members use one Woost slot. Level thresholds are 2, 7, and 14.'}</Text>
  </View>;
}

function Perk({ icon, value, label }: { icon: IconName; value: string; label: string }) { return <View style={styles.perk}><Icon name={icon} size={20} color={colors.waveBright} /><Text style={styles.perkValue}>{value}</Text><Text style={styles.muted}>{label}</Text></View>; }

const styles = StyleSheet.create({
  root:{gap:spacing.md}, loading:{minHeight:220,alignItems:'center',justifyContent:'center'}, hero:{position:'relative',minHeight:145,flexDirection:'row',alignItems:'center',gap:spacing.md,padding:spacing.lg,borderRadius:radius.xl,backgroundColor:'#0d3d70',overflow:'hidden'}, orb:{width:68,height:68,alignItems:'center',justifyContent:'center',borderRadius:34,backgroundColor:'#207fc9',borderWidth:1,borderColor:'rgba(196,245,255,.45)',shadowColor:'#42cfff',shadowOpacity:.45,shadowRadius:18,shadowOffset:{width:0,height:0},elevation:8}, boostIcon:{alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'rgba(188,245,255,.5)',backgroundColor:'#3ba9e8',shadowColor:'#4cd9ff',shadowOpacity:.55,shadowRadius:8,shadowOffset:{width:0,height:0}}, boostIconSpark:{position:'absolute',top:-5,right:-5}, level:{position:'absolute',right:-2,bottom:-2,width:25,height:25,paddingTop:3,textAlign:'center',borderRadius:13,backgroundColor:'#b4efff',color:'#062340',fontWeight:'900'}, heroCopy:{flex:1,gap:3,minWidth:0}, kicker:{color:'#88dcff',fontSize:9,fontWeight:'900',letterSpacing:1.3}, title:{color:colors.text,fontSize:22,fontWeight:'900'}, muted:{color:colors.textMuted,...typography.caption}, live:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:4,marginTop:2,paddingHorizontal:7,paddingVertical:4,borderRadius:99,borderWidth:1,borderColor:'rgba(93,231,191,.3)',backgroundColor:'rgba(28,179,138,.12)'}, liveDot:{width:6,height:6,borderRadius:3,backgroundColor:'#5ee7c0'}, liveText:{color:'#aaf8df',fontSize:9,fontWeight:'900',letterSpacing:.7}, heroCount:{alignSelf:'flex-start',alignItems:'flex-end',paddingHorizontal:9,paddingVertical:7,borderRadius:12,borderWidth:1,borderColor:'rgba(180,230,255,.16)',backgroundColor:'rgba(1,14,34,.36)'}, heroCountValue:{color:'#f0fdff',fontSize:21,fontWeight:'900',lineHeight:23}, heroCountLabel:{color:'#a4d3eb',fontSize:10}, burst:{position:'absolute',left:'24%',top:'50%',width:55,height:55,alignItems:'center',justifyContent:'center'}, burstRing:{position:'absolute',width:45,height:45,borderWidth:2,borderColor:'rgba(174,248,255,.8)',borderRadius:23,shadowColor:'#68e9ff',shadowOpacity:.8,shadowRadius:18,shadowOffset:{width:0,height:0}}, progressCopy:{flexDirection:'row',justifyContent:'space-between'}, progressValue:{color:colors.waveBright,fontWeight:'900'}, track:{height:7,overflow:'hidden',borderRadius:4,backgroundColor:colors.surfaceRaised}, fill:{height:'100%',backgroundColor:colors.waveBright}, perks:{flexDirection:'row',gap:spacing.xs}, perk:{flex:1,minHeight:92,gap:3,padding:spacing.sm,borderWidth:1,borderColor:colors.line,borderRadius:radius.lg,backgroundColor:colors.surface}, perkValue:{color:colors.text,fontSize:14,fontWeight:'800'}, levels:{gap:spacing.xs}, levelRow:{flexDirection:'row',alignItems:'center',gap:spacing.sm,padding:spacing.sm,borderWidth:1,borderColor:colors.line,borderRadius:radius.lg,backgroundColor:colors.surface,opacity:.68}, levelRowActive:{borderColor:'rgba(59,190,255,.38)',opacity:1}, levelMark:{width:34,height:34,alignItems:'center',justifyContent:'center',borderRadius:11,backgroundColor:colors.surfaceRaised}, levelMarkText:{color:colors.waveBright,fontWeight:'900'}, levelTitle:{color:colors.text,fontWeight:'800'}, button:{minHeight:50,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:spacing.xs,borderRadius:radius.lg,backgroundColor:colors.wave,borderWidth:1,borderColor:'rgba(179,244,255,.24)'}, buttonBusy:{backgroundColor:'#365cb9'}, buttonComplete:{backgroundColor:'#199c8b'}, buttonIcon:{minWidth:24,alignItems:'center',justifyContent:'center'}, buttonText:{color:'#fff',fontWeight:'900'}, buttonArrow:{marginLeft:3,color:'#fff',fontSize:20,lineHeight:22}, buttonHint:{marginTop:-8,color:colors.textMuted,fontSize:10,textAlign:'center'},
});
