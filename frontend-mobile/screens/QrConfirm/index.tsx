import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    SafeAreaView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppHeader, CustomButton } from "@/components";
import { colors, spacing } from "@/constants";
import { useAppContext } from "@/context/AppContext";
import apiClient from "@/api/apiClient";
import { getDeviceInfo } from "@/utils/deviceInfo";

type SessionData = {
    seesion_id?: string;
    session_id?: string;
    status?: string;
    user?: {
        id?: number;
        username?: string;
        name?: string;
        avatarUrl?: string;
    };
    expireAt?: string;
};

export default function QrConfirmScreen() {
    const router = useRouter();
    const { currentUser } = useAppContext();
    const { session_id } = useLocalSearchParams<{ session_id?: string }>();

    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState("");
    const [sessionData, setSessionData] = useState<SessionData | null>(null);

    const scanSession = async () => {
        if (!session_id) {
            setError("Thiếu session_id.");
            setLoading(false);
            return;
        }

        setLoading(true);
        setError("");

        try {
            const response = await apiClient.get("/session/qr-login/scan", {
                params: { session_id },
            });
            const data = response.data?.data ?? response.data;
            setSessionData(data as SessionData);
        } catch {
            if (currentUser) {
                setSessionData({
                    session_id,
                    status: "SCANNED",
                    user: {
                        id: Number(currentUser.id),
                        username: currentUser.username,
                        name: currentUser.fullName,
                        avatarUrl: currentUser.avatar,
                    },
                });
            } else {
                setError("Không thể xác thực phiên QR.");
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void scanSession();
    }, [session_id]);

    const onConfirm = async () => {
        if (!session_id) return;
        setProcessing(true);

        try {
            const device = await getDeviceInfo();
            await apiClient.post("/session/qr-login/confirm", {
                session_id,
                deviceType: device.deviceType,
                deviceName: device.deviceName,
                ipAddress: device.ipAddress,
            });
            Alert.alert("Thành công", "Đã xác nhận đăng nhập QR.", [
                { text: "OK", onPress: () => router.back() },
            ]);
        } catch {
            Alert.alert("Lỗi", "Không thể xác nhận đăng nhập.");
        } finally {
            setProcessing(false);
        }
    };

    const onReject = async () => {
        if (!session_id) return;
        setProcessing(true);
        try {
            await apiClient.get("/session/qr-login/reject", {
                params: { session_id },
            });
            Alert.alert("Đã từ chối", "Yêu cầu đăng nhập đã bị từ chối.", [
                { text: "OK", onPress: () => router.back() },
            ]);
        } catch {
            Alert.alert("Lỗi", "Không thể từ chối yêu cầu.");
        } finally {
            setProcessing(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                title="QR Confirm"
                leftAction={{
                    icon: "arrow-back",
                    onPress: () => router.back(),
                }}
            />

            <View style={styles.content}>
                {loading ? (
                    <ActivityIndicator size="large" color={colors.primary} />
                ) : error ? (
                    <>
                        <Text style={styles.error}>{error}</Text>
                        <CustomButton title="Thử lại" onPress={scanSession} />
                    </>
                ) : (
                    <>
                        <Text style={styles.title}>Xác nhận đăng nhập</Text>
                        <Text style={styles.subtitle}>
                            Bạn có muốn đăng nhập tài khoản này trên trình duyệt
                            web?
                        </Text>

                        <Text style={styles.meta}>
                            User:{" "}
                            {sessionData?.user?.name ??
                                sessionData?.user?.username ??
                                "Unknown"}
                        </Text>

                        <CustomButton
                            title={processing ? "Đang xử lý..." : "Xác nhận"}
                            onPress={onConfirm}
                            disabled={processing}
                        />
                        <CustomButton
                            title="Từ chối"
                            variant="outline"
                            onPress={onReject}
                            disabled={processing}
                            style={styles.gap}
                        />
                    </>
                )}
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
        fontSize: 22,
        fontWeight: "700",
        color: colors.text,
        textAlign: "center",
    },
    subtitle: {
        marginTop: spacing.sm,
        color: colors.textMuted,
        textAlign: "center",
        marginBottom: spacing.lg,
    },
    meta: {
        textAlign: "center",
        marginBottom: spacing.lg,
        color: colors.text,
    },
    error: {
        color: colors.danger,
        textAlign: "center",
        marginBottom: spacing.md,
    },
    gap: {
        marginTop: spacing.sm,
    },
});
