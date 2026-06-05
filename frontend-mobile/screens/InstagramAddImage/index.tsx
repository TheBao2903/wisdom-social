import React, { useMemo, useState } from "react";
import { Image, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppHeader, CustomButton, CustomInput } from "@/components";
import { colors, fallbackImages, spacing } from "@/constants";
import { useAppContext } from "@/context/AppContext";

export default function InstagramAddImageScreen() {
    const router = useRouter();
    const { createPostWithOptions } = useAppContext();
    const [caption, setCaption] = useState("");
    const [imageUrl, setImageUrl] = useState(fallbackImages.post);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const canSubmit = useMemo(() => caption.trim().length > 0, [caption]);

    const onCreate = async () => {
        setError("");
        setLoading(true);
        const result = await createPostWithOptions({ caption, imageUrl, privacy: "PUBLIC", allowComments: true, allowShares: true });
        setLoading(false);

        if (!result.success) {
            setError(result.message ?? "Không thể tạo bài viết");
            return;
        }

        setCaption("");
        router.replace("/(tabs)");
    };

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader title="New Post" />
            <View style={styles.content}>
                <Image source={{ uri: imageUrl || fallbackImages.post }} style={styles.preview} />
                <CustomInput label="Image/Video URL hoặc S3 key" value={imageUrl} onChangeText={setImageUrl} autoCapitalize="none" />
                <CustomInput label="Caption" value={caption} onChangeText={setCaption} />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <CustomButton title="Share" onPress={onCreate} disabled={!canSubmit} loading={loading} />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.white },
    content: { padding: spacing.lg },
    preview: { width: "100%", aspectRatio: 1, borderRadius: 10, backgroundColor: colors.surface, marginBottom: spacing.md },
    error: { color: colors.danger, marginBottom: spacing.sm },
});
