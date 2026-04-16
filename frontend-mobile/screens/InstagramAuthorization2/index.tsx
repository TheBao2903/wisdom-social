import React from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { CustomButton } from "@/components";
import { colors, spacing } from "@/constants";

export default function InstagramAuthorization2Screen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Authorization Step 2</Text>
        <Text style={styles.desc}>
          Hoàn tất thiết lập bảo mật 2 bước để bảo vệ tài khoản của bạn.
        </Text>

        <CustomButton title="Hoàn tất" onPress={() => router.replace("/(auth)/login")} />
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
    textAlign: "center",
    fontSize: 24,
    color: colors.text,
    fontWeight: "700",
  },
  desc: {
    textAlign: "center",
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    color: colors.textMuted,
    lineHeight: 20,
  },
});
