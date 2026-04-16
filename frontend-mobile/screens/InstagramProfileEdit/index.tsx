import React, { useState } from "react";
import { SafeAreaView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { AppHeader, CustomButton, CustomInput } from "@/components";
import { colors, spacing } from "@/constants";
import { useAppContext } from "@/context/AppContext";

export default function InstagramProfileEditScreen() {
  const router = useRouter();
  const { currentUser, updateProfile } = useAppContext();
  const [fullName, setFullName] = useState(currentUser?.fullName ?? "");
  const [bio, setBio] = useState(currentUser?.bio ?? "");
  const [website, setWebsite] = useState(currentUser?.website ?? "");

  const onSave = () => {
    updateProfile({ fullName, bio, website });
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title="Edit Profile" leftAction={{ icon: "arrow-back", onPress: () => router.back() }} />
      <View style={styles.content}>
        <CustomInput label="Full name" value={fullName} onChangeText={setFullName} />
        <CustomInput label="Bio" value={bio} onChangeText={setBio} multiline />
        <CustomInput label="Website" value={website} onChangeText={setWebsite} autoCapitalize="none" />
        <CustomButton title="Save" onPress={onSave} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: {
    padding: spacing.lg,
  },
});
