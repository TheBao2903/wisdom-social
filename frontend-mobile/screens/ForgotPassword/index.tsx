import React, { useState } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { CustomButton, CustomInput } from "@/components";
import { colors, spacing } from "@/constants";
import { useAppContext } from "@/context/AppContext";
import { validatePhone } from "@/utils/validators";

export default function ForgotPasswordScreen() {
    const router = useRouter();
    const { requestPasswordReset } = useAppContext();
    const [phone, setPhone] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const onSubmit = async () => {
        setError("");

        if (!validatePhone(phone)) {
            setError("Số điện thoại phải gồm 10 chữ số.");
            return;
        }

        setSubmitting(true);
        const result = await requestPasswordReset(phone.trim());
        setSubmitting(false);

        if (!result.success) {
            setError(result.message ?? "Không thể gửi OTP.");
            return;
        }

        router.push({
            pathname: "/(auth)/verify-otp",
            params: {
                phone: phone.trim(),
                type: "reset",
            },
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Quên Mật Khẩu</Text>
                <Text style={styles.subtitle}>
                    Nhập số điện thoại để nhận OTP đặt lại mật khẩu.
                </Text>

                <CustomInput
                    label="Số điện thoại"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                    autoCapitalize="none"
                />

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <CustomButton
                    title="Gửi OTP"
                    onPress={onSubmit}
                    loading={submitting}
                />

                <CustomButton
                    title="Quay lại đăng nhập"
                    onPress={() => router.back()}
                    variant="ghost"
                    style={styles.backBtn}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
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
    subtitle: {
        marginTop: spacing.sm,
        marginBottom: spacing.xl,
        textAlign: "center",
        color: colors.textMuted,
    },
    error: {
        marginBottom: spacing.sm,
        color: colors.danger,
    },
    backBtn: {
        marginTop: spacing.md,
    },
});
