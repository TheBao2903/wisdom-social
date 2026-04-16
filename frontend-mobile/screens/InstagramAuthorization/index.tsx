import React from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { CustomButton } from "@/components";
import { colors, spacing } from "@/constants";

export default function InstagramAuthorizationScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Authorization Step 1</Text>
        <Text style={styles.desc}>
          Kết nối tài khoản để đồng bộ hoạt động, lượt thích và tin nhắn.
        </Text>

        <CustomButton title="Tiếp tục" onPress={() => router.push("/(auth)/authorization-2")} />
        <CustomButton
          title="Bỏ qua"
          variant="outline"
          onPress={() => router.replace("/(auth)/login")}
          style={styles.skipBtn}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  desc: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  skipBtn: {
    marginTop: spacing.md,
  },
});
