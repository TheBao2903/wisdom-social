import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { colors, spacing } from "@/constants";
import { useAppContext } from "@/context/AppContext";
import { validatePhone, validateRequired } from "@/utils/validators";
import { CustomButton, CustomInput } from "@/components";
import { cancelAccountDeletion } from "@/services/securityService";

export default function LoginScreen() {
    const router = useRouter();
    const { login, loadingAuth } = useAppContext();
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [lockCountdown, setLockCountdown] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const startCountdown = useCallback((seconds: number) => {
        if (timerRef.current) clearInterval(timerRef.current);
        setLockCountdown(seconds);
        timerRef.current = setInterval(() => {
            setLockCountdown((prev) => {
                if (prev <= 1) {
                    if (timerRef.current) clearInterval(timerRef.current);
                    timerRef.current = null;
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, []);

    const formatCountdown = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    const showDeletionWarning = (remainingDays?: number) => {
        Alert.alert(
            "Tài khoản đang chờ xóa",
            `Tài khoản của bạn sẽ bị xóa vĩnh viễn sau ${remainingDays ?? 30} ngày. Bạn có muốn hủy yêu cầu xóa?`,
            [
                { text: "Tiếp tục", style: "cancel", onPress: () => router.replace("/(tabs)") },
                {
                    text: "Hủy xóa tài khoản",
                    style: "destructive",
                    onPress: async () => {
                        await cancelAccountDeletion();
                        router.replace("/(tabs)");
                    },
                },
            ],
        );
    };

    const onSubmit = async () => {
        setError("");

        const normalized = phone.trim();
        if (!validatePhone(normalized)) {
            setError("Số điện thoại phải gồm 10 chữ số.");
            return;
        }

        if (!validateRequired(password)) {
            setError("Vui lòng nhập mật khẩu.");
            return;
        }

        const result = await login(normalized, password);

        if (!result.success) {
            setError(result.message ?? "Đăng nhập thất bại.");
            if (result.remainingSeconds && result.remainingSeconds > 0) {
                startCountdown(result.remainingSeconds);
            }
            return;
        }

        if (result.deletionPending) {
            showDeletionWarning(result.deletionRemainingDays);
            return;
        }

        router.replace("/(tabs)");
    };

    const isLocked = lockCountdown > 0;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.brand}>Instagram Clone</Text>
                <Text style={styles.subtitle}>Đăng nhập để tiếp tục</Text>

                <CustomInput
                    label="Số điện thoại"
                    value={phone}
                    onChangeText={setPhone}
                    autoCapitalize="none"
                    keyboardType="phone-pad"
                />
                <CustomInput
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                />

                {error ? <Text style={styles.error}>{error}</Text> : null}
                {isLocked ? (
                    <Text style={styles.lockTimer}>
                        Thử lại sau {formatCountdown(lockCountdown)}
                    </Text>
                ) : null}

                <CustomButton
                    title={isLocked ? `Đã khóa (${formatCountdown(lockCountdown)})` : "Log In"}
                    onPress={onSubmit}
                    loading={loadingAuth}
                    disabled={isLocked}
                    style={styles.loginButton}
                />

                <Pressable onPress={() => router.push("/(auth)/signup")}>
                    <Text style={styles.link}>Chưa có tài khoản? Sign up</Text>
                </Pressable>

                <Pressable
                    onPress={() => router.push("/(auth)/forgot-password")}
                >
                    <Text style={styles.linkMuted}>Quên mật khẩu?</Text>
                </Pressable>

                <Pressable onPress={() => router.push("/(auth)/authorization")}>
                    <Text style={styles.linkMuted}>
                        Hoặc mở flow Authorization
                    </Text>
                </Pressable>
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
    brand: {
        textAlign: "center",
        fontSize: 28,
        fontWeight: "700",
        color: colors.text,
    },
    subtitle: {
        textAlign: "center",
        marginTop: spacing.sm,
        marginBottom: spacing.xxl,
        color: colors.textMuted,
    },
    loginButton: {
        marginTop: spacing.sm,
    },
    error: {
        color: colors.danger,
        marginBottom: spacing.sm,
    },
    lockTimer: {
        color: "#F59E0B",
        fontWeight: "600",
        fontSize: 16,
        textAlign: "center",
        marginBottom: spacing.sm,
    },
    link: {
        marginTop: spacing.lg,
        textAlign: "center",
        color: colors.primary,
        fontWeight: "600",
    },
    linkMuted: {
        marginTop: spacing.md,
        textAlign: "center",
        color: colors.textMuted,
    },
});
