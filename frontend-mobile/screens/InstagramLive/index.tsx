import React from "react";
import { FlatList, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppHeader, CustomButton, UserAvatar } from "@/components";
import { colors, spacing } from "@/constants";
import { useAppContext } from "@/context/AppContext";

const liveTopics = [
  "Q&A về tăng trưởng tài khoản",
  "Behind the scenes setup",
  "React Native tips live",
  "Creator studio session",
];

export default function InstagramLiveScreen() {
  const router = useRouter();
  const { users } = useAppContext();

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title="Live" leftAction={{ icon: "arrow-back", onPress: () => router.back() }} />

      <FlatList
        data={users.slice(0, 4)}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <View style={styles.card}>
            <View style={styles.userRow}>
              <UserAvatar uri={item.avatar} name={item.username} size={52} />
              <View style={styles.userMeta}>
                <Text style={styles.username}>{item.username}</Text>
                <Text style={styles.topic}>{liveTopics[index % liveTopics.length]}</Text>
              </View>
            </View>
            <CustomButton title="Join Live" onPress={() => {}} variant="outline" />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  card: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  userRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  userMeta: {
    flex: 1,
    justifyContent: "center",
  },
  username: {
    color: colors.text,
    fontWeight: "700",
    marginBottom: 2,
  },
  topic: {
    color: colors.textMuted,
  },
});
