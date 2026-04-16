import React, { useState } from "react";
import { Alert, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppHeader, CustomButton, CustomInput } from "@/components";
import { colors, spacing } from "@/constants";
import pageService from "@/services/pageService";

export default function CreatePageScreen() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const onSubmit = async () => {
        if (!name.trim()) {
            Alert.alert("Thiếu thông tin", "Vui lòng nhập tên trang.");
            return;
        }

        setSubmitting(true);
        try {
            await pageService.createPage({
                name: name.trim(),
                description: description.trim(),
                status: "PUBLIC",
            });
            Alert.alert("Thành công", "Đã tạo trang mới.");
            router.back();
        } catch {
            Alert.alert("Lỗi", "Không thể tạo trang.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                title="Create Page"
                leftAction={{ icon: "close", onPress: () => router.back() }}
            />
            <View style={styles.content}>
                <Text style={styles.desc}>
                    Tạo nhanh trang mới từ base hiện tại.
                </Text>

                <CustomInput
                    label="Tên trang"
                    value={name}
                    onChangeText={setName}
                />

                <CustomInput
                    label="Mô tả"
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    style={styles.multilineInput}
                />

                <CustomButton
                    title="Tạo trang"
                    onPress={onSubmit}
                    loading={submitting}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.white,
    },
    content: {
        padding: spacing.lg,
    },
    desc: {
        color: colors.textMuted,
        marginBottom: spacing.md,
    },
    multilineInput: {
        minHeight: 90,
        textAlignVertical: "top",
    },
});
