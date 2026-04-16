import React, { useState } from "react";
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppHeader, UserAvatar } from "@/components";
import { colors, spacing } from "@/constants";
import { useAppContext } from "@/context/AppContext";

export default function InstagramFollowingScreen() {
  const router = useRouter();
  const { users, currentUser } = useAppContext();
  const [followingIds, setFollowingIds] = useState<string[]>([]);

  const list = users.filter((user) => user.id !== currentUser?.id);

  const toggleFollow = (id: string) => {
    setFollowingIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [id, ...prev]));
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title="Following" leftAction={{ icon: "arrow-back", onPress: () => router.back() }} />
      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const followed = followingIds.includes(item.id);
          return (
            <View style={styles.row}>
              <View style={styles.userInfo}>
                <UserAvatar uri={item.avatar} name={item.username} size={44} />
                <View>
                  <Text style={styles.username}>{item.username}</Text>
                  <Text style={styles.name}>{item.fullName}</Text>
                </View>
              </View>
              <Pressable
                style={[styles.followBtn, followed ? styles.following : styles.notFollowing]}
                onPress={() => toggleFollow(item.id)}
              >
                <Text style={[styles.followText, followed && styles.followingText]}>
                  {followed ? "Following" : "Follow"}
                </Text>
              </Pressable>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  username: {
    color: colors.text,
    fontWeight: "700",
  },
  name: {
    color: colors.textMuted,
  },
  followBtn: {
    minWidth: 96,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    borderWidth: 1,
  },
  notFollowing: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  following: {
    backgroundColor: colors.white,
    borderColor: colors.border,
  },
  followText: {
    color: colors.white,
    fontWeight: "700",
  },
  followingText: {
    color: colors.text,
  },
});
