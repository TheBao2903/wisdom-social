import React, { useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { colors, spacing } from "@/constants";
import { CustomButton, CustomInput } from "@/components";
import { useAppContext } from "@/context/AppContext";
import { validatePhone, validateStrongPassword } from "@/utils/validators";

export default function SignUpScreen() {
    const router = useRouter();
    const { signupWithPhone, loadingAuth } = useAppContext();
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");

    const onSubmit = async () => {
        setError("");

        const normalizedPhone = phone.trim();
        if (!validatePhone(normalizedPhone)) {
            setError("Số điện thoại phải gồm 10 chữ số.");
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

        const result = await signupWithPhone({
            phone: normalizedPhone,
            password,
            confirmPassword,
        });

        if (!result.success) {
            setError(result.message ?? "Đăng ký thất bại.");
            return;
        }

        router.push({
            pathname: "/(auth)/verify-otp",
            params: {
                phone: normalizedPhone,
                type: "register",
            },
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>Đăng ký bằng số điện thoại</Text>
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

                <CustomInput
                    label="Confirm password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    autoCapitalize="none"
                />

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <CustomButton
                    title="Sign Up"
                    onPress={onSubmit}
                    loading={loadingAuth}
                />

                <Pressable onPress={() => router.back()}>
                    <Text style={styles.link}>Đã có tài khoản? Log in</Text>
                </Pressable>
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
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: spacing.xxl,
    },
    title: {
        textAlign: "center",
        fontSize: 24,
        fontWeight: "700",
        color: colors.text,
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
    link: {
        marginTop: spacing.lg,
        textAlign: "center",
        color: colors.primary,
        fontWeight: "600",
    },
});
