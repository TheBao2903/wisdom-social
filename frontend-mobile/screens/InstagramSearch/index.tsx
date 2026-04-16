import React, { useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  AppHeader,
  EmptyState,
  PostGrid,
  SearchBar,
  UserAvatar,
} from "@/components";
import { colors, spacing } from "@/constants";
import { useAppContext } from "@/context/AppContext";

export default function InstagramSearchScreen() {
  const router = useRouter();
  const { searchUsersAndPosts } = useAppContext();
  const [query, setQuery] = useState("");

  const result = useMemo(() => searchUsersAndPosts(query), [query, searchUsersAndPosts]);

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title="Search"
        rightActions={[
          {
            icon: "sparkles-outline",
            onPress: () => router.push("/(stack)/search/picks"),
          },
        ]}
      />

      <View style={styles.searchWrap}>
        <SearchBar value={query} onChangeText={setQuery} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Users</Text>
          <Pressable onPress={() => router.push("/(stack)/search/picks")}>
            <Text style={styles.link}>Explore picks</Text>
          </Pressable>
        </View>

        {result.users.length === 0 ? (
          <EmptyState title="Không tìm thấy user" description="Thử từ khóa khác." />
        ) : (
          result.users.slice(0, 5).map((user) => (
            <Pressable key={user.id} style={styles.userRow}>
              <UserAvatar uri={user.avatar} name={user.username} size={42} />
              <View style={styles.userMeta}>
                <Text style={styles.username}>{user.username}</Text>
                <Text style={styles.name}>{user.fullName}</Text>
              </View>
            </Pressable>
          ))
        )}

        <Text style={styles.sectionTitle}>Posts</Text>
        {result.posts.length === 0 ? (
          <EmptyState title="Không tìm thấy bài viết" description="Hãy thử từ khóa khác." />
        ) : (
          <PostGrid posts={result.posts} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  searchWrap: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sectionHeader: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  link: {
    color: colors.primary,
    fontWeight: "600",
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  userMeta: {
    marginLeft: spacing.sm,
  },
  username: {
    color: colors.text,
    fontWeight: "700",
  },
  name: {
    color: colors.textMuted,
  },
});
