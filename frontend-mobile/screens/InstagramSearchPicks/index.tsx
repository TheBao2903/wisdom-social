import React from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { AppHeader, PostGrid } from "@/components";
import { colors, spacing } from "@/constants";
import { useAppContext } from "@/context/AppContext";

const tags = ["#design", "#developer", "#travel", "#food", "#music", "#startup"];

export default function InstagramSearchPicksScreen() {
  const router = useRouter();
  const { posts } = useAppContext();

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title="Search Picks" leftAction={{ icon: "arrow-back", onPress: () => router.back() }} />
      <ScrollView>
        <Text style={styles.label}>Trending Tags</Text>
        <View style={styles.tagsWrap}>
          {tags.map((tag) => (
            <Pressable key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Suggested Posts</Text>
        <PostGrid posts={posts} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  label: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontWeight: "700",
    fontSize: 16,
  },
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  tag: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  tagText: {
    color: colors.text,
    fontWeight: "500",
  },
});
