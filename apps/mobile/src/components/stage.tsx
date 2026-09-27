import { createElement, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useVideoPlayer, VideoView } from 'expo-video';
import { hydrateLocalUri } from '../storage/files';
import { colors } from '../theme';
import { TrackSlider } from './controls';

function useRenderableUri(uri: string | null): string {
  const [value, setValue] = useState(!uri || uri.startsWith('idb:') ? '' : uri);
  useEffect(() => {
    if (!uri) {
      setValue('');
      return;
    }
    let alive = true;
    void hydrateLocalUri(uri).then((next) => {
      if (alive) setValue(next);
    });
    return () => {
      alive = false;
    };
  }, [uri]);
  return value;
}

export function Stage({
  currentUri,
  originalUri,
  mime,
  compare,
  hold,
  ratio,
}: {
  currentUri: string;
  originalUri: string | null;
  mime: string;
  compare: boolean;
  hold: boolean;
  ratio: number;
}) {
  const [width, setWidth] = useState(0);
  const shown = useRenderableUri(hold && originalUri ? originalUri : currentUri);
  const before = useRenderableUri(originalUri);
  const after = useRenderableUri(currentUri);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.min(6, Math.max(1, savedScale.value * event.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });
  const pan = Gesture.Pan()
    .onUpdate((event) => {
      tx.value = savedX.value + event.translationX;
      ty.value = savedY.value + event.translationY;
    })
    .onEnd(() => {
      savedX.value = tx.value;
      savedY.value = ty.value;
    });
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));
  const video = mime.startsWith('video/') && !hold && !compare;

  return (
    <View style={styles.frame} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {video ? (
        <Clip uri={shown} />
      ) : (
        <GestureDetector gesture={Gesture.Simultaneous(pinch, pan)}>
          <Animated.View style={[styles.fill, style]}>
            {compare && originalUri ? (
              <View style={styles.fill}>
                {after ? <Image source={{ uri: after }} style={StyleSheet.absoluteFill} contentFit="contain" /> : null}
                <View style={[styles.beforeClip, { width: width * ratio }]}>
                  {before ? <Image source={{ uri: before }} style={{ width, height: '100%' }} contentFit="contain" /> : null}
                </View>
              </View>
            ) : shown ? (
              <Image source={{ uri: shown }} style={styles.fill} contentFit="contain" />
            ) : null}
          </Animated.View>
        </GestureDetector>
      )}
      {hold ? <Text style={styles.badge}>Original</Text> : null}
    </View>
  );
}

function Clip({ uri }: { uri: string }) {
  if (!uri) return null;
  if (Platform.OS === 'web') return <WebClip uri={uri} />;
  return <NativeClip uri={uri} />;
}

function WebClip({ uri }: { uri: string }) {
  return createElement('video', {
    src: uri,
    controls: true,
    loop: true,
    playsInline: true,
    style: { width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#05060A' },
  });
}

function NativeClip({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (item) => {
    item.loop = true;
  });
  return <VideoView player={player} style={styles.fill} nativeControls contentFit="contain" />;
}

export function CompareBar({
  compare,
  onCompare,
  ratio,
  onRatio,
  onHoldStart,
  onHoldEnd,
}: {
  compare: boolean;
  onCompare: () => void;
  ratio: number;
  onRatio: (value: number) => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
}) {
  return (
    <View style={styles.bar}>
      <Pressable onPress={onCompare} style={styles.small}>
        <Text style={styles.smallText}>{compare ? 'Ver actual' : 'Antes / después'}</Text>
      </Pressable>
      <Pressable onPressIn={onHoldStart} onPressOut={onHoldEnd} style={styles.small}>
        <Text style={styles.smallText}>Mantener original</Text>
      </Pressable>
      {compare ? <TrackSlider label="Corte" value={ratio} min={0.05} max={0.95} step={0.01} onChange={onRatio} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: 360, backgroundColor: '#05060A', borderRadius: 16, overflow: 'hidden' },
  fill: { flex: 1 },
  beforeClip: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden', borderRightWidth: 2, borderRightColor: colors.accent },
  badge: { position: 'absolute', top: 10, left: 10, backgroundColor: colors.accent, color: colors.ink, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  bar: { gap: 8 },
  small: { backgroundColor: colors.surface, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  smallText: { color: colors.text, fontWeight: '600' },
});
