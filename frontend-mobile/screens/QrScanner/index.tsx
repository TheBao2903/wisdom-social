import React, { useState } from "react";
import { Alert, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { AppHeader, CustomButton } from "@/components";
import { colors, spacing } from "@/constants";

export default function QrScannerScreen() {
    const router = useRouter();
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);

    const handleScanned = ({ data }: { data: string }) => {
        if (scanned) return;

        setScanned(true);

        try {
            const parsed = JSON.parse(data) as {
                type?: string;
                session_id?: string;
            };

            const sessionId = parsed.session_id;
            if ((parsed.type === "qr_login" || !!sessionId) && sessionId) {
                router.push({
                    pathname: "/(stack)/qr-confirm",
                    params: { session_id: sessionId },
                });
                return;
            }

            Alert.alert("QR không hợp lệ", "Không tìm thấy phiên đăng nhập.");
            setScanned(false);
        } catch {
            if (data.trim()) {
                router.push({
                    pathname: "/(stack)/qr-confirm",
                    params: { session_id: data.trim() },
                });
                return;
            }
            Alert.alert(
                "QR không hợp lệ",
                "Dữ liệu mã QR không đúng định dạng.",
            );
            setScanned(false);
        }
    };

    if (!permission) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.text}>Đang kiểm tra quyền camera...</Text>
            </SafeAreaView>
        );
    }

    if (!permission.granted) {
        return (
            <SafeAreaView style={styles.container}>
                <AppHeader
                    title="QR Scanner"
                    leftAction={{
                        icon: "arrow-back",
                        onPress: () => router.back(),
                    }}
                />
                <View style={styles.content}>
                    <Text style={styles.text}>
                        Cần cấp quyền camera để quét mã QR.
                    </Text>
                    <CustomButton
                        title="Cấp quyền"
                        onPress={requestPermission}
                    />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <AppHeader
                title="QR Scanner"
                leftAction={{
                    icon: "arrow-back",
                    onPress: () => router.back(),
                }}
            />
            <View style={styles.cameraWrap}>
                <CameraView
                    style={styles.camera}
                    barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                    onBarcodeScanned={scanned ? undefined : handleScanned}
                />
            </View>
            <View style={styles.footer}>
                <Text style={styles.text}>
                    Đưa mã QR vào giữa khung để quét.
                </Text>
                {scanned ? (
                    <CustomButton
                        title="Quét lại"
                        variant="outline"
                        onPress={() => setScanned(false)}
                    />
                ) : null}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.black,
    },
    content: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: spacing.lg,
    },
    cameraWrap: {
        flex: 1,
        margin: spacing.md,
        borderRadius: 12,
        overflow: "hidden",
    },
    camera: {
        flex: 1,
    },
    footer: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.lg,
        gap: spacing.sm,
    },
    text: {
        color: colors.white,
        textAlign: "center",
    },
});
