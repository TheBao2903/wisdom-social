import React, { useState } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CustomButton, CustomInput } from "@/components";
import { colors, spacing } from "@/constants";
import { useAppContext } from "@/context/AppContext";
import {
    validateOtp,
    validatePhone,
    validateStrongPassword,
} from "@/utils/validators";

export default function ResetPasswordScreen() {
    const router = useRouter();
    const { phone, otp } = useLocalSearchParams<{
        phone?: string;
        otp?: string;
    }>();
    const { resetPasswordByOtp } = useAppContext();

    const [confirmationCode, setConfirmationCode] = useState(otp ?? "");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const onSubmit = async () => {
        setError("");

        if (!phone || !validatePhone(phone)) {
            setError("Số điện thoại không hợp lệ.");
            return;
        }

        if (!validateOtp(confirmationCode)) {
            setError("Mã OTP phải gồm 6 chữ số.");
            return;
        }

        const strong = validateStrongPassword(password);
        if (!strong.valid) {
            setError(strong.message ?? "Mật khẩu chưa hợp lệ.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Mật khẩu xác nhận không khớp.");
            return;
        }

        setSubmitting(true);
        const result = await resetPasswordByOtp({
            phone,
            password,
            confirmPassword,
            confirmationCode: confirmationCode,
        });
        setSubmitting(false);

        if (!result.success) {
            setError(result.message ?? "Đặt lại mật khẩu thất bại.");
            return;
        }

        router.replace("/(auth)/login");
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Đặt Lại Mật Khẩu</Text>
                <Text style={styles.subtitle}>
                    Cập nhật mật khẩu mới để tiếp tục.
                </Text>

                <CustomInput
                    label="OTP"
                    value={confirmationCode}
                    onChangeText={setConfirmationCode}
                    keyboardType="number-pad"
                    maxLength={6}
                />

                <CustomInput
                    label="Mật khẩu mới"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                />

                <CustomInput
                    label="Xác nhận mật khẩu"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    autoCapitalize="none"
                />

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <CustomButton
                    title="Cập nhật mật khẩu"
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
});
