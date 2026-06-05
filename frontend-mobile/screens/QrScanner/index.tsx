import React, { useState, useEffect, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    Alert,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    Linking,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants";
import { extractGroupInviteToken } from "@/utils/groupInvite";

export default function QrScannerScreen() {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const scanLockRef = useRef(false);
    const router = useRouter();

    useEffect(() => {
        const checkAndRequestPermission = async () => {
            if (!permission) return;

            if (!permission.granted && permission.canAskAgain) {
                await requestPermission();
            }
        };

        checkAndRequestPermission();
    }, [permission]);

    useEffect(() => {
        setScanned(false);
        setIsProcessing(false);
        scanLockRef.current = false;
    }, []);

    const handleBarCodeScanned = ({ data }: { type: string; data: string }) => {
        if (scanLockRef.current || scanned || isProcessing) return;

        scanLockRef.current = true;
        setScanned(true);
        setIsProcessing(true);

        try {
            const inviteToken = extractGroupInviteToken(data);
            if (inviteToken) {
                setTimeout(() => {
                    router.replace({
                        pathname: "/(stack)/group-invite/[token]" as any,
                        params: {
                            token: inviteToken,
                            returnTo: "messages",
                        },
                    } as any);
                }, 100);
                return;
            }

            const qrData = JSON.parse(data);

            if (qrData.type === "qr_login" && qrData.session_id) {
                setTimeout(() => {
                    router.push({
                        pathname: "/(stack)/qr-confirm",
                        params: { session_id: qrData.session_id },
                    });
                }, 100);
            } else {
                Alert.alert("Lỗi", "Mã QR không hợp lệ. Vui lòng quét mã QR đăng nhập.", [
                    {
                        text: "OK",
                        onPress: () => {
                            scanLockRef.current = false;
                            setScanned(false);
                            setIsProcessing(false);
                        },
                    },
                ]);
            }
        } catch (error) {
            Alert.alert("Lỗi", "Không thể đọc mã QR. Vui lòng thử lại.", [
                {
                    text: "OK",
                onPress: () => {
                    scanLockRef.current = false;
                    setScanned(false);
                    setIsProcessing(false);
                },
                },
            ]);
        }
    };

    if (!permission) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!permission.granted) {
        const canRequest = permission.canAskAgain;
        const isPermanentlyDenied = !canRequest && !permission.granted;

        return (
            <View style={styles.container}>
                <Ionicons name="camera-outline" size={64} color="#999" />
                <Text style={styles.permissionText}>
                    Cần quyền truy cập camera để quét mã QR
                </Text>

                {isPermanentlyDenied && (
                    <Text style={styles.permissionSubtext}>
                        Quyền camera đã bị từ chối. Vui lòng bật trong Settings.
                    </Text>
                )}

                {canRequest ? (
                    <TouchableOpacity style={styles.button} onPress={requestPermission}>
                        <Text style={styles.buttonText}>Cấp quyền</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={styles.button}
                        onPress={() => {
                            if (Platform.OS === "ios") {
                                Linking.openURL("app-settings:");
                            } else {
                                Linking.openSettings();
                            }
                        }}
                    >
                        <Text style={styles.buttonText}>Mở Settings</Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    style={[styles.button, styles.secondaryButton]}
                    onPress={() => router.back()}
                >
                    <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                        Quay lại
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                    disabled={isProcessing}
                >
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Quét mã QR</Text>
                <View style={styles.placeholder} />
            </View>

            <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerSettings={{
                    barcodeTypes: ["qr"],
                }}
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            >
                <View style={styles.overlay}>
                    <View style={styles.unfocusedContainer}></View>
                    <View style={styles.middleContainer}>
                        <View style={styles.unfocusedContainer}></View>
                        <View style={styles.focusedContainer}>
                            <View style={styles.scannerCorner} />
                            <View style={[styles.scannerCorner, styles.topRight]} />
                            <View style={[styles.scannerCorner, styles.bottomLeft]} />
                            <View style={[styles.scannerCorner, styles.bottomRight]} />
                        </View>
                        <View style={styles.unfocusedContainer}></View>
                    </View>
                    <View style={styles.unfocusedContainer}></View>
                </View>

                {isProcessing && (
                    <View style={styles.processingOverlay}>
                        <ActivityIndicator size="large" color="#fff" />
                        <Text style={styles.processingText}>Đang xử lý...</Text>
                    </View>
                )}
            </CameraView>

            <View style={styles.instructionContainer}>
                <Text style={styles.instructionTitle}>Hướng dẫn quét mã QR</Text>
                <Text style={styles.instructionText}>
                    1. Đảm bảo mã QR nằm trong khung vuông
                </Text>
                <Text style={styles.instructionText}>
                    2. Giữ điện thoại ổn định và đủ ánh sáng
                </Text>
                <Text style={styles.instructionText}>
                    3. Mã QR sẽ được quét tự động
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
        justifyContent: "center",
        alignItems: "center",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingTop: Platform.OS === "ios" ? 60 : 40,
        paddingBottom: 16,
        backgroundColor: "#000",
        width: "100%",
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#fff",
    },
    placeholder: {
        width: 40,
    },
    camera: {
        flex: 1,
        width: "100%",
    },
    overlay: {
        flex: 1,
        backgroundColor: "transparent",
    },
    unfocusedContainer: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.7)",
    },
    middleContainer: {
        flexDirection: "row",
        height: 250,
    },
    focusedContainer: {
        width: 250,
        height: 250,
        position: "relative",
    },
    scannerCorner: {
        position: "absolute",
        width: 30,
        height: 30,
        borderColor: "#fff",
        borderWidth: 3,
        top: 0,
        left: 0,
        borderBottomWidth: 0,
        borderRightWidth: 0,
    },
    topRight: {
        left: undefined,
        right: 0,
        borderLeftWidth: 0,
        borderRightWidth: 3,
    },
    bottomLeft: {
        top: undefined,
        bottom: 0,
        borderTopWidth: 0,
        borderBottomWidth: 3,
    },
    bottomRight: {
        top: undefined,
        bottom: 0,
        left: undefined,
        right: 0,
        borderTopWidth: 0,
        borderLeftWidth: 0,
        borderBottomWidth: 3,
        borderRightWidth: 3,
    },
    processingOverlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.7)",
        justifyContent: "center",
        alignItems: "center",
    },
    processingText: {
        color: "#fff",
        marginTop: 16,
        fontSize: 16,
        fontWeight: "500",
    },
    instructionContainer: {
        backgroundColor: "#f5f5f5",
        paddingHorizontal: 20,
        paddingVertical: 20,
        paddingBottom: 30,
    },
    instructionTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: colors.text,
        marginBottom: 12,
    },
    instructionText: {
        fontSize: 14,
        color: colors.textMuted,
        marginBottom: 8,
        lineHeight: 20,
    },
    permissionText: {
        fontSize: 16,
        fontWeight: "600",
        color: colors.text,
        marginTop: 20,
        textAlign: "center",
        paddingHorizontal: 20,
    },
    permissionSubtext: {
        fontSize: 14,
        color: colors.textMuted,
        marginTop: 8,
        textAlign: "center",
        paddingHorizontal: 20,
    },
    button: {
        backgroundColor: colors.primary,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        marginTop: 16,
        minWidth: 120,
        alignItems: "center",
    },
    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
    secondaryButton: {
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: colors.border,
    },
    secondaryButtonText: {
        color: colors.text,
    },
});
