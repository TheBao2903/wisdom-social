import React from "react";
import { Image, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppHeader, EmptyState } from "@/components";
import { colors, spacing } from "@/constants";
import { useAppContext } from "@/context/AppContext";

export default function InstagramIGVTShowScreen() {
  const { videoId } = useLocalSearchParams<{ videoId: string }>();
  const router = useRouter();
  const { igtvVideos, getUserById } = useAppContext();

  const video = igtvVideos.find((item) => item.id === videoId);
  const user = video ? getUserById(video.userId) : undefined;

  if (!video) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader title="IGTV" leftAction={{ icon: "arrow-back", onPress: () => router.back() }} />
        <EmptyState title="Video không tồn tại" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title="IGTV Video" leftAction={{ icon: "arrow-back", onPress: () => router.back() }} />
      <Image source={{ uri: video.thumbnail }} style={styles.cover} />
      <View style={styles.content}>
        <Text style={styles.title}>{video.title}</Text>
        <Text style={styles.meta}>{user?.username} • {video.views} views • {video.duration}</Text>
        <Text style={styles.desc}>{video.description}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  cover: {
    width: "100%",
    aspectRatio: 1.4,
    backgroundColor: colors.surface,
  },
  content: {
    padding: spacing.lg,
  },
  title: {
    fontSize: 19,
    fontWeight: "700",
    color: colors.text,
  },
  meta: {
    marginTop: spacing.xs,
    color: colors.textMuted,
  },
  desc: {
    marginTop: spacing.md,
    color: colors.text,
    lineHeight: 20,
  },
});
