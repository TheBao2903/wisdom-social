import React, { useMemo, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { colors, spacing } from "@/constants";
import { useAppContext } from "@/context/AppContext";
import { validatePhone, validateRequired } from "@/utils/validators";
import { CustomButton, CustomInput } from "@/components";

export default function LoginScreen() {
    const router = useRouter();
    const { login, loadingAuth } = useAppContext();
    const [phone, setPhone] = useState("0398724346");
    const [password, setPassword] = useState("Xen123123!");
    const [error, setError] = useState("");

    const disabled = useMemo(() => !phone || !password, [phone, password]);

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
            return;
        }

        router.replace("/(tabs)");
    };

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

                <CustomButton
                    title="Log In"
                    onPress={onSubmit}
                    loading={loadingAuth}
                   
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
