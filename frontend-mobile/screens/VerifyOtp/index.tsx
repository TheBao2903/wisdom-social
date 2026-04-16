import React, { useMemo, useState } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CustomButton, CustomInput } from "@/components";
import { colors, spacing } from "@/constants";
import { useAppContext } from "@/context/AppContext";
import { validateOtp, validatePhone } from "@/utils/validators";

export default function VerifyOtpScreen() {
    const router = useRouter();
    const { phone, type } = useLocalSearchParams<{
        phone?: string;
        type?: string;
    }>();
    const { verifySignupOtp, requestPasswordReset } = useAppContext();

    const [otp, setOtp] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [resending, setResending] = useState(false);

    const normalizedType = useMemo(
        () => (type === "register" ? "register" : "reset"),
        [type],
    );

    const onVerify = async () => {
        setError("");

        if (!phone || !validatePhone(phone)) {
            setError("Số điện thoại không hợp lệ.");
            return;
        }

        if (!validateOtp(otp)) {
            setError("OTP phải gồm 6 chữ số.");
            return;
        }

        setSubmitting(true);

        if (normalizedType === "register") {
            const result = await verifySignupOtp(phone, otp.trim());
            setSubmitting(false);
            if (!result.success) {
                setError(result.message ?? "Xác thực OTP thất bại.");
                return;
            }

            router.replace("/(auth)/login");
            return;
        }

        setSubmitting(false);
        router.push({
            pathname: "/(auth)/reset-password",
            params: {
                phone,
                otp: otp.trim(),
            },
        });
    };

    const onResend = async () => {
        setError("");

        if (!phone || !validatePhone(phone)) {
            setError("Số điện thoại không hợp lệ.");
            return;
        }

        setResending(true);
        const result = await requestPasswordReset(phone);
        setResending(false);

        if (!result.success) {
            setError(result.message ?? "Không thể gửi lại OTP.");
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Xác Thực OTP</Text>
                <Text style={styles.subtitle}>
                    Nhập mã OTP đã gửi tới {phone ?? "số điện thoại của bạn"}.
                </Text>

                <CustomInput
                    label="Mã OTP"
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                />

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <CustomButton
                    title="Xác nhận"
                    onPress={onVerify}
                    loading={submitting}
                />

                <CustomButton
                    title={resending ? "Đang gửi lại..." : "Gửi lại OTP"}
                    onPress={onResend}
                    variant="outline"
                    disabled={resending}
                    style={styles.gap}
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
    gap: {
        marginTop: spacing.md,
    },
});
