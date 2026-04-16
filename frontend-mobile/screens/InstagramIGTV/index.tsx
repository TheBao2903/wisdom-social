import React from "react";
import {
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { AppHeader, UserAvatar } from "@/components";
import { colors, spacing } from "@/constants";
import { useAppContext } from "@/context/AppContext";

export default function InstagramIGTVScreen() {
  const router = useRouter();
  const { igtvVideos, getUserById } = useAppContext();

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title="IGTV"
        leftAction={{ icon: "arrow-back", onPress: () => router.back() }}
        rightActions={[{ icon: "videocam-outline", onPress: () => router.push("/(stack)/live") }]}
      />

      <FlatList
        data={igtvVideos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const user = getUserById(item.userId);
          return (
            <Pressable
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: "/(stack)/igtv/[videoId]",
                  params: { videoId: item.id },
                })
              }
            >
              <Image source={{ uri: item.thumbnail }} style={styles.thumb} />
              <View style={styles.metaRow}>
                <UserAvatar uri={user?.avatar} name={user?.username ?? "?"} size={38} />
                <View style={styles.metaText}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.info}>{user?.username} • {item.views} views • {item.duration}</Text>
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  card: {
    marginBottom: spacing.lg,
  },
  thumb: {
    width: "100%",
    aspectRatio: 1.6,
    backgroundColor: colors.surface,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  metaText: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontWeight: "700",
  },
  info: {
    color: colors.textMuted,
    marginTop: 2,
  },
});
