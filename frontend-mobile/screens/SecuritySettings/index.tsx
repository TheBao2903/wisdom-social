import React, { useCallback, useEffect, useState, useRef } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    SafeAreaView,
    ActivityIndicator,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/constants";
import { useAppContext } from "@/context/AppContext";
import {
    cancelAccountDeletion,
    logoutAllDevices,
    requestAccountDeletion,
    setupPinCode,
    removePinCode,
    verifyPin,
} from "@/services/securityService";
import userService from "@/services/userService";
import { forgotPassword, resetPassword } from "@/services/authService";
import { validateOTP, validateResetPasswordForm } from "@/utils/validators";

const maskPhone = (phone?: string): string => {
    if (!phone) return "";
    const tail = phone.slice(-3);
    return `${"*".repeat(Math.max(0, phone.length - 3))}${tail}`;
};
const RESEND_COOLDOWN = 30;

type ProfilePrivacy = "PUBLIC" | "FRIENDS" | "ONLY_ME";

const PRIVACY_OPTIONS: { value: ProfilePrivacy; label: string; desc: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { value: "PUBLIC",   label: "Công khai",     desc: "Tất cả mọi người đều có thể xem hồ sơ",  icon: "globe-outline" },
    { value: "FRIENDS",  label: "Bạn bè",        desc: "Chỉ bạn bè mới có thể xem hồ sơ",        icon: "people-outline" },
    { value: "ONLY_ME",  label: "Chỉ mình tôi",  desc: "Hồ sơ hoàn toàn riêng tư",               icon: "lock-closed-outline" },
];

export default function SecuritySettingsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { currentUser, refreshCurrentUser, logout, deletionPending, deletionRemainingDays, clearDeletionPending } = useAppContext();

    const [loadingLogoutAll, setLoadingLogoutAll] = useState(false);
    const [loadingDelete, setLoadingDelete] = useState(false);
    const [loadingCancel, setLoadingCancel] = useState(false);

    // Profile Privacy State
    const [profilePrivacy, setProfilePrivacy] = useState<ProfilePrivacy>("PUBLIC");
    const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
    const [privacyLoading, setPrivacyLoading] = useState(false);

    useEffect(() => {
        if (!currentUser?.id) return;
        let cancelled = false;
        userService.getUserProfile(currentUser.id).then((profile) => {
            if (!cancelled && profile?.privacyProfile) {
                setProfilePrivacy(profile.privacyProfile as ProfilePrivacy);
            }
        }).catch(() => {});
        return () => { cancelled = true; };
    }, [currentUser?.id]);

    const handlePrivacyChange = useCallback(async (next: ProfilePrivacy) => {
        if (!currentUser?.id) return;
        setPrivacyLoading(true);
        try {
            await userService.updateUser(String(currentUser.id), { privacyProfile: next });
            setProfilePrivacy(next);
            setPrivacyModalVisible(false);
        } catch {
            Alert.alert("Lỗi", "Không thể cập nhật chế độ hồ sơ. Vui lòng thử lại.");
        } finally {
            setPrivacyLoading(false);
        }
    }, [currentUser?.id]);

    // PIN Setup State
    const [setupPinModalVisible, setSetupPinModalVisible] = useState(false);
    const [setupPin, setSetupPin] = useState(['', '', '', '', '', '']);
    const [setupPinError, setSetupPinError] = useState("");
    const [loadingSetupPin, setLoadingSetupPin] = useState(false);
    const setupInputRefs = useRef<Array<TextInput | null>>([]);

    // PIN Delete State
    const [deletePinModalVisible, setDeletePinModalVisible] = useState(false);
    const [deletePin, setDeletePin] = useState(['', '', '', '', '', '']);
    const [deletePinError, setDeletePinError] = useState("");
    const deleteInputRefs = useRef<Array<TextInput | null>>([]);

    // PIN Remove State
    const [removePinModalVisible, setRemovePinModalVisible] = useState(false);
    const [removePin, setRemovePin] = useState(['', '', '', '', '', '']);
    const [removePinError, setRemovePinError] = useState("");
    const [loadingRemovePin, setLoadingRemovePin] = useState(false);
    const removeInputRefs = useRef<Array<TextInput | null>>([]);

    // PIN Cancel Delete State
    const [cancelDeletePinModalVisible, setCancelDeletePinModalVisible] = useState(false);
    const [cancelDeletePin, setCancelDeletePin] = useState(['', '', '', '', '', '']);
    const [cancelDeletePinError, setCancelDeletePinError] = useState("");
    const cancelDeleteInputRefs = useRef<Array<TextInput | null>>([]);

    // Change Password State (OTP gửi về SĐT của chính mình)
    const [changePwModalVisible, setChangePwModalVisible] = useState(false);
    const [cpOtp, setCpOtp] = useState("");
    const [cpPassword, setCpPassword] = useState("");
    const [cpConfirm, setCpConfirm] = useState("");
    const [cpShowPassword, setCpShowPassword] = useState(false);
    const [cpError, setCpError] = useState("");
    const [cpInfo, setCpInfo] = useState("");
    const [cpLoading, setCpLoading] = useState(false);
    const [cpSending, setCpSending] = useState(false);
    const [cpCooldown, setCpCooldown] = useState(0);

    // 2FA: xác thực mã PIN trước khi đổi mật khẩu (chỉ khi user đã bật PIN)
    const [cpPinModalVisible, setCpPinModalVisible] = useState(false);
    const [cpPin, setCpPin] = useState("");
    const [cpPinError, setCpPinError] = useState("");
    const [cpPinLoading, setCpPinLoading] = useState(false);

    // Toast nhỏ tự ẩn (mobile chưa có hệ thống toast dùng chung)
    const [cpToast, setCpToast] = useState<string | null>(null);
    const cpToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const showCpToast = useCallback((msg: string) => {
        if (cpToastTimer.current) clearTimeout(cpToastTimer.current);
        setCpToast(msg);
        cpToastTimer.current = setTimeout(() => setCpToast(null), 4000);
    }, []);
    useEffect(() => () => { if (cpToastTimer.current) clearTimeout(cpToastTimer.current); }, []);

    // Resend cooldown ticker
    useEffect(() => {
        if (cpCooldown <= 0) return;
        const id = setInterval(() => setCpCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
        return () => clearInterval(id);
    }, [cpCooldown]);

    const sendChangePwOtp = useCallback(async () => {
        const phone = currentUser?.phone;
        if (!phone) {
            setCpError("Không tìm thấy số điện thoại của tài khoản.");
            return;
        }
        setCpSending(true);
        setCpError("");
        const result = await forgotPassword(phone);
        setCpSending(false);
        if (result.success) {
            setCpInfo(`Đã gửi mã OTP đến số ${maskPhone(phone)}.`);
            setCpCooldown(RESEND_COOLDOWN);
        } else {
            setCpError(result.message || "Gửi OTP thất bại. Vui lòng thử lại.");
        }
    }, [currentUser?.phone]);

    const openChangePwModal = useCallback(() => {
        setCpOtp("");
        setCpPassword("");
        setCpConfirm("");
        setCpShowPassword(false);
        setCpError("");
        setCpInfo("");
        setCpCooldown(0);
        setChangePwModalVisible(true);
        const phone = currentUser?.phone;
        showCpToast(
            phone
                ? `Mã OTP sẽ được gửi về số điện thoại ${maskPhone(phone)} của bạn.`
                : "Mã OTP sẽ được gửi về số điện thoại của bạn.",
        );
        void sendChangePwOtp();
    }, [sendChangePwOtp, currentUser?.phone, showCpToast]);

    // Thực hiện đổi mật khẩu (đã qua validate + 2FA nếu cần) rồi đăng xuất mọi thiết bị.
    const doChangePassword = useCallback(async () => {
        const phone = currentUser?.phone;
        if (!phone) {
            setCpError("Không tìm thấy số điện thoại của tài khoản.");
            return;
        }
        setCpLoading(true);
        const result = await resetPassword({
            phone,
            password: cpPassword,
            confirmPassword: cpConfirm,
            confirmationCode: cpOtp.trim(),
        });
        setCpLoading(false);

        if (result.success) {
            setCpPinModalVisible(false);
            setChangePwModalVisible(false);
            // Đổi mật khẩu xong -> đăng xuất tất cả thiết bị (web + mobile).
            try { await logoutAllDevices(); } catch { /* vẫn đăng xuất thiết bị này */ }
            await logout();
            Alert.alert(
                "Đổi mật khẩu thành công",
                "Tất cả thiết bị đã được đăng xuất. Vui lòng đăng nhập lại bằng mật khẩu mới.",
            );
            router.replace("/(auth)/login");
        } else {
            // Lỗi -> đóng modal PIN, quay lại form đổi mật khẩu để sửa.
            setCpPinModalVisible(false);
            setCpError(result.message || "Đổi mật khẩu thất bại.");
        }
    }, [currentUser?.phone, cpOtp, cpPassword, cpConfirm, logout, router]);

    // Bấm "Đổi mật khẩu": validate xong -> nếu đã bật PIN thì mở bước 2FA, ngược lại đổi luôn.
    const handleChangePassword = useCallback(() => {
        const phone = currentUser?.phone;
        if (!phone) {
            setCpError("Không tìm thấy số điện thoại của tài khoản.");
            return;
        }
        setCpError("");

        const otpCheck = validateOTP(cpOtp);
        if (!otpCheck.isValid) {
            setCpError(otpCheck.error || "Mã OTP không hợp lệ.");
            return;
        }
        const pwCheck = validateResetPasswordForm(cpPassword, cpConfirm);
        if (!pwCheck.isValid) {
            setCpError(pwCheck.error || "Thông tin không hợp lệ.");
            return;
        }

        if (currentUser?.hasPinCode) {
            setCpPin("");
            setCpPinError("");
            setCpPinModalVisible(true);
            return;
        }
        void doChangePassword();
    }, [currentUser?.phone, currentUser?.hasPinCode, cpOtp, cpPassword, cpConfirm, doChangePassword]);

    // Bước 2FA: xác thực mã PIN rồi mới đổi mật khẩu.
    const handleVerifyCpPin = useCallback(async () => {
        setCpPinError("");
        if (!/^\d{6}$/.test(cpPin)) {
            setCpPinError("Mã PIN phải gồm 6 chữ số.");
            return;
        }
        setCpPinLoading(true);
        const result = await verifyPin(cpPin);
        setCpPinLoading(false);
        if (!result.success) {
            setCpPinError(result.message || "Mã PIN không chính xác.");
            return;
        }
        await doChangePassword();
    }, [cpPin, doChangePassword]);

    const handleSetupPinChange = (value: string, index: number) => {
        if (value.length > 1) value = value[value.length - 1];
        const newPin = [...setupPin];
        newPin[index] = value;
        setSetupPin(newPin);
        setSetupPinError("");

        if (value && index < 5) {
            setupInputRefs.current[index + 1]?.focus();
        }
    };

    const handleSetupPinKeyPress = (key: string, index: number) => {
        if (key === 'Backspace' && !setupPin[index] && index > 0) {
            setupInputRefs.current[index - 1]?.focus();
        }
    };

    const handleDeletePinChange = (value: string, index: number) => {
        if (value.length > 1) value = value[value.length - 1];
        const newPin = [...deletePin];
        newPin[index] = value;
        setDeletePin(newPin);
        setDeletePinError("");

        if (value && index < 5) {
            deleteInputRefs.current[index + 1]?.focus();
        }
    };

    const handleDeletePinKeyPress = (key: string, index: number) => {
        if (key === 'Backspace' && !deletePin[index] && index > 0) {
            deleteInputRefs.current[index - 1]?.focus();
        }
    };

    const handleRemovePinChange = (value: string, index: number) => {
        if (value.length > 1) value = value[value.length - 1];
        const newPin = [...removePin];
        newPin[index] = value;
        setRemovePin(newPin);
        setRemovePinError("");

        if (value && index < 5) {
            removeInputRefs.current[index + 1]?.focus();
        }
    };

    const handleRemovePinKeyPress = (key: string, index: number) => {
        if (key === 'Backspace' && !removePin[index] && index > 0) {
            removeInputRefs.current[index - 1]?.focus();
        }
    };

    const handleCancelDeletePinChange = (value: string, index: number) => {
        if (value.length > 1) value = value[value.length - 1];
        const newPin = [...cancelDeletePin];
        newPin[index] = value;
        setCancelDeletePin(newPin);
        setCancelDeletePinError("");

        if (value && index < 5) {
            cancelDeleteInputRefs.current[index + 1]?.focus();
        }
    };

    const handleCancelDeletePinKeyPress = (key: string, index: number) => {
        if (key === 'Backspace' && !cancelDeletePin[index] && index > 0) {
            cancelDeleteInputRefs.current[index - 1]?.focus();
        }
    };

    const handleLogoutAll = useCallback(async () => {
        Alert.alert(
            "Đăng xuất tất cả thiết bị",
            "Tất cả các phiên đăng nhập sẽ bị hủy, bao gồm cả thiết bị này. Bạn sẽ cần đăng nhập lại.",
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Đăng xuất tất cả",
                    style: "destructive",
                    onPress: async () => {
                        setLoadingLogoutAll(true);
                        const result = await logoutAllDevices();
                        setLoadingLogoutAll(false);
                        if (result.success) {
                            await logout();
                            router.replace("/(auth)/login");
                        } else {
                            Alert.alert("Lỗi", result.message || "Không thể đăng xuất tất cả thiết bị.");
                        }
                    },
                },
            ],
        );
    }, [logout, router]);

    const handleSetupPin = useCallback(async () => {
        const pinCode = setupPin.join('');
        if (pinCode.length !== 6 || !/^\d+$/.test(pinCode)) {
            setSetupPinError("Mã PIN phải đủ 6 chữ số.");
            return;
        }
        setLoadingSetupPin(true);
        const result = await setupPinCode(pinCode);
        setLoadingSetupPin(false);
        if (result.success) {
            setSetupPinModalVisible(false);
            setSetupPin(['', '', '', '', '', '']);
            setSetupPinError("");
            await refreshCurrentUser();
            Alert.alert("Thành công", "Cài đặt mã PIN 2 lớp thành công.");
        } else {
            setSetupPinError(result.message || "Không thể cài đặt mã PIN.");
        }
    }, [setupPin, refreshCurrentUser]);

    const handleConfirmRemovePin = useCallback(async () => {
        const pinCode = removePin.join('');
        if (pinCode.length !== 6 || !/^\d+$/.test(pinCode)) {
            setRemovePinError("Mã PIN phải đủ 6 chữ số.");
            return;
        }
        setLoadingRemovePin(true);
        const result = await removePinCode(pinCode);
        setLoadingRemovePin(false);
        if (result.success) {
            setRemovePinModalVisible(false);
            setRemovePin(['', '', '', '', '', '']);
            setRemovePinError("");
            await refreshCurrentUser();
            Alert.alert("Thành công", "Xóa mã PIN 2 lớp thành công.");
        } else {
            setRemovePinError(result.message || "Không thể xóa mã PIN.");
        }
    }, [removePin, refreshCurrentUser]);

    const handleConfirmDeleteWithPin = useCallback(async () => {
        const pinCode = deletePin.join('');
        if (pinCode.length !== 6 || !/^\d+$/.test(pinCode)) {
            setDeletePinError("Mã PIN phải đủ 6 chữ số.");
            return;
        }
        setLoadingDelete(true);
        const result = await requestAccountDeletion(pinCode);
        setLoadingDelete(false);
        if (result.success) {
            setDeletePinModalVisible(false);
            setDeletePin(['', '', '', '', '', '']);
            await logout();
            router.replace("/(auth)/login");
        } else {
            setDeletePinError(result.message || "Mã PIN không chính xác hoặc chưa được cài đặt.");
        }
    }, [deletePin, logout, router]);

    const handleDeleteAccount = useCallback(() => {
        Alert.alert(
            "Xóa tài khoản",
            "Tài khoản của bạn sẽ bị xóa vĩnh viễn sau 30 ngày. Trong thời gian này bạn có thể đăng nhập lại để hủy yêu cầu xóa.\n\nBạn có chắc chắn muốn xóa tài khoản?",
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Xóa tài khoản",
                    style: "destructive",
                    onPress: async () => {
                        if (currentUser?.hasPinCode) {
                            setDeletePin(['', '', '', '', '', '']);
                            setDeletePinError("");
                            setDeletePinModalVisible(true);
                        } else {
                            setLoadingDelete(true);
                            const result = await requestAccountDeletion();
                            setLoadingDelete(false);
                            if (result.success) {
                                await logout();
                                router.replace("/(auth)/login");
                            } else {
                                Alert.alert("Lỗi", result.message || "Không thể yêu cầu xóa tài khoản.");
                            }
                        }
                    },
                },
            ],
        );
    }, []);

    const handleCancelDelete = useCallback(() => {
        Alert.alert(
            "Hủy xóa tài khoản",
            `Tài khoản của bạn đang được lên lịch xóa sau ${deletionRemainingDays ?? 30} ngày nữa. Bạn có muốn hủy yêu cầu xóa?`,
            [
                { text: "Không", style: "cancel" },
                {
                    text: "Hủy xóa tài khoản",
                    style: "default",
                    onPress: async () => {
                        if (currentUser?.hasPinCode) {
                            setCancelDeletePin(['', '', '', '', '', '']);
                            setCancelDeletePinError("");
                            setCancelDeletePinModalVisible(true);
                        } else {
                            setLoadingCancel(true);
                            const result = await cancelAccountDeletion();
                            setLoadingCancel(false);
                            if (result.success) {
                                clearDeletionPending();
                                Alert.alert(
                                    "Đã hủy thành công",
                                    "Yêu cầu xóa tài khoản đã được hủy. Tài khoản của bạn sẽ không bị xóa.",
                                    [{ text: "OK" }],
                                );
                            } else {
                                Alert.alert("Lỗi", result.message || "Không thể hủy yêu cầu xóa tài khoản.");
                            }
                        }
                    },
                },
            ],
        );
    }, [deletionRemainingDays, currentUser?.hasPinCode, clearDeletionPending]);

    const handleConfirmCancelDeleteWithPin = useCallback(async () => {
        const pinCode = cancelDeletePin.join('');
        if (pinCode.length !== 6 || !/^\d+$/.test(pinCode)) {
            setCancelDeletePinError("Mã PIN phải đủ 6 chữ số.");
            return;
        }
        setLoadingCancel(true);
        const result = await cancelAccountDeletion(pinCode);
        setLoadingCancel(false);
        if (result.success) {
            setCancelDeletePinModalVisible(false);
            setCancelDeletePin(['', '', '', '', '', '']);
            clearDeletionPending();
            Alert.alert(
                "Đã hủy thành công",
                "Yêu cầu xóa tài khoản đã được hủy. Tài khoản của bạn sẽ không bị xóa.",
                [{ text: "OK" }],
            );
        } else {
            setCancelDeletePinError(result.message || "Mã PIN không chính xác.");
        }
    }, [cancelDeletePin, clearDeletionPending]);

    return (
        <SafeAreaView style={styles.container}>
            {cpToast ? (
                <View style={[styles.toast, { top: insets.top + 10 }]} pointerEvents="none">
                    <Ionicons name="information-circle" size={18} color="#fff" />
                    <Text style={styles.toastText}>{cpToast}</Text>
                </View>
            ) : null}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Bảo mật</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.sectionTitle}>Quyền riêng tư</Text>
                <View style={styles.card}>
                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => setPrivacyModalVisible(true)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.settingInfo}>
                            <View style={[styles.iconWrap, { backgroundColor: "#EDE9FE" }]}>
                                <Ionicons
                                    name={PRIVACY_OPTIONS.find(o => o.value === profilePrivacy)?.icon ?? "globe-outline"}
                                    size={20}
                                    color="#7C3AED"
                                />
                            </View>
                            <View>
                                <Text style={styles.settingLabel}>Chế độ hồ sơ</Text>
                                <Text style={styles.settingDesc}>
                                    {PRIVACY_OPTIONS.find(o => o.value === profilePrivacy)?.label ?? "Công khai"}
                                </Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                </View>

                <Text style={styles.sectionTitle}>Phiên đăng nhập</Text>
                <View style={styles.card}>
                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={handleLogoutAll}
                        disabled={loadingLogoutAll}
                        activeOpacity={0.7}
                    >
                        <View style={styles.settingInfo}>
                            <View style={[styles.iconWrap, { backgroundColor: "#FFF3E0" }]}>
                                {loadingLogoutAll ? (
                                    <ActivityIndicator size="small" color="#F59E0B" />
                                ) : (
                                    <Ionicons name="log-out" size={20} color="#F59E0B" />
                                )}
                            </View>
                            <View>
                                <Text style={styles.settingLabel}>Đăng xuất tất cả thiết bị</Text>
                                <Text style={styles.settingDesc}>
                                    Hủy tất cả phiên đăng nhập trên các thiết bị khác
                                </Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                </View>

                <Text style={styles.sectionTitle}>Mật khẩu</Text>
                <View style={styles.card}>
                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={openChangePwModal}
                        activeOpacity={0.7}
                    >
                        <View style={styles.settingInfo}>
                            <View style={[styles.iconWrap, { backgroundColor: "#E3F2FD" }]}>
                                <Ionicons name="lock-closed" size={20} color="#3B82F6" />
                            </View>
                            <View>
                                <Text style={styles.settingLabel}>Đổi mật khẩu</Text>
                                <Text style={styles.settingDesc}>
                                    Xác minh bằng OTP gửi đến số điện thoại của bạn
                                </Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                </View>

                <Text style={styles.sectionTitle}>Mật khẩu 2 lớp (PIN)</Text>
                <View style={styles.card}>
                    {currentUser?.hasPinCode ? (
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => {
                                setRemovePin(['', '', '', '', '', '']);
                                setRemovePinError("");
                                setRemovePinModalVisible(true);
                            }}
                            activeOpacity={0.7}
                        >
                            <View style={styles.settingInfo}>
                                <View style={[styles.iconWrap, { backgroundColor: "#FFE5E5" }]}>
                                    <Ionicons name="keypad" size={20} color={colors.danger} />
                                </View>
                                <View>
                                    <Text style={[styles.settingLabel, { color: colors.danger }]}>Xóa mã PIN</Text>
                                    <Text style={styles.settingDesc}>
                                        Tắt bảo vệ tài khoản bằng mã PIN
                                    </Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => {
                                setSetupPin(['', '', '', '', '', '']);
                                setSetupPinError("");
                                setSetupPinModalVisible(true);
                            }}
                            activeOpacity={0.7}
                        >
                            <View style={styles.settingInfo}>
                                <View style={[styles.iconWrap, { backgroundColor: "#E3F2FD" }]}>
                                    <Ionicons name="keypad" size={20} color="#3B82F6" />
                                </View>
                                <View>
                                    <Text style={styles.settingLabel}>Cài đặt mã PIN</Text>
                                    <Text style={styles.settingDesc}>
                                        Bảo vệ tài khoản bằng mã PIN 6 chữ số
                                    </Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>

                <Text style={styles.sectionTitle}>Tài khoản</Text>
                <View style={styles.card}>
                    <View style={styles.policySection}>
                        <Text style={styles.policyTitle}>Chính sách xóa tài khoản</Text>
                        <Text style={styles.policyText}>
                            Khi yêu cầu xóa tài khoản, bạn sẽ có 30 ngày để hủy yêu cầu bằng cách đăng nhập lại.
                            Sau 30 ngày, tài khoản và toàn bộ dữ liệu sẽ bị xóa vĩnh viễn và không thể khôi phục.
                        </Text>
                    </View>

                    <View style={styles.divider} />

                    {deletionPending ? (
                        <>
                            {/* Banner cảnh báo trạng thái đang chờ xóa */}
                            <View style={styles.deletionWarningBanner}>
                                <Ionicons name="warning" size={16} color="#B45309" />
                                <Text style={styles.deletionWarningText}>
                                    Tài khoản sẽ bị xóa sau {deletionRemainingDays ?? 30} ngày nữa
                                </Text>
                            </View>

                            <View style={styles.divider} />

                            {/* Nút hủy xóa tài khoản */}
                            <TouchableOpacity
                                style={styles.menuItem}
                                onPress={handleCancelDelete}
                                disabled={loadingCancel}
                                activeOpacity={0.7}
                            >
                                <View style={styles.settingInfo}>
                                    <View style={[styles.iconWrap, { backgroundColor: "#E8F5E9" }]}>
                                        {loadingCancel ? (
                                            <ActivityIndicator size="small" color="#22C55E" />
                                        ) : (
                                            <Ionicons name="shield-checkmark" size={20} color="#22C55E" />
                                        )}
                                    </View>
                                    <View>
                                        <Text style={[styles.settingLabel, { color: "#22C55E" }]}>
                                            Hủy xóa tài khoản
                                        </Text>
                                        <Text style={styles.settingDesc}>
                                            Giữ lại tài khoản và toàn bộ dữ liệu
                                        </Text>
                                    </View>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                            </TouchableOpacity>
                        </>
                    ) : (
                        /* Nút xóa tài khoản bình thường */
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={handleDeleteAccount}
                            disabled={loadingDelete}
                            activeOpacity={0.7}
                        >
                            <View style={styles.settingInfo}>
                                <View style={[styles.iconWrap, { backgroundColor: "#FFE5E5" }]}>
                                    {loadingDelete ? (
                                        <ActivityIndicator size="small" color={colors.danger} />
                                    ) : (
                                        <Ionicons name="trash" size={20} color={colors.danger} />
                                    )}
                                </View>
                                <View>
                                    <Text style={[styles.settingLabel, { color: colors.danger }]}>
                                        Xóa tài khoản
                                    </Text>
                                    <Text style={styles.settingDesc}>
                                        Tài khoản sẽ bị xóa sau 30 ngày
                                    </Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>
            </ScrollView>

            {/* Modal Chế độ hồ sơ */}
            <Modal
                visible={privacyModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setPrivacyModalVisible(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setPrivacyModalVisible(false)}>
                    <Pressable style={[styles.modalSheet, { alignItems: "flex-start" }]}>
                        <View style={[styles.modalHandle, { alignSelf: "center" }]} />
                        <Text style={styles.modalTitle}>Chế độ hồ sơ</Text>
                        <Text style={[styles.modalDesc, { textAlign: "left", paddingHorizontal: 0, marginBottom: 16 }]}>
                            Chọn ai có thể xem thông tin hồ sơ của bạn
                        </Text>
                        {PRIVACY_OPTIONS.map((opt) => {
                            const selected = profilePrivacy === opt.value;
                            return (
                                <TouchableOpacity
                                    key={opt.value}
                                    style={[styles.privacyOption, selected && styles.privacyOptionSelected]}
                                    onPress={() => handlePrivacyChange(opt.value)}
                                    disabled={privacyLoading}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.iconWrap, selected ? { backgroundColor: "#EDE9FE" } : { backgroundColor: "#F3F4F6" }]}>
                                        <Ionicons name={opt.icon} size={20} color={selected ? "#7C3AED" : colors.textMuted} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.settingLabel, selected && { color: "#7C3AED" }]}>{opt.label}</Text>
                                        <Text style={styles.settingDesc}>{opt.desc}</Text>
                                    </View>
                                    {selected ? (
                                        <View style={styles.radioFilled}>
                                            <View style={styles.radioDot} />
                                        </View>
                                    ) : (
                                        <View style={styles.radioEmpty} />
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                        {privacyLoading && (
                            <ActivityIndicator color="#7C3AED" style={{ marginTop: 8, alignSelf: "center" }} />
                        )}
                        <TouchableOpacity
                            style={[styles.modalCancelBtn, { width: "100%", borderWidth: 1, borderColor: colors.border, borderRadius: 26, marginTop: 8 }]}
                            onPress={() => setPrivacyModalVisible(false)}
                            disabled={privacyLoading}
                        >
                            <Text style={styles.modalCancelText}>Đóng</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Modal Đổi mật khẩu */}
            <Modal
                visible={changePwModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => !cpLoading && setChangePwModalVisible(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => !cpLoading && setChangePwModalVisible(false)}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                        style={styles.modalKeyboard}
                    >
                        <Pressable style={styles.modalSheet}>
                            <View style={styles.modalHandle} />
                            <View style={styles.modalIconWrap}>
                                <Ionicons name="lock-closed" size={32} color={colors.primary} />
                            </View>
                            <Text style={styles.modalTitle}>Đổi mật khẩu</Text>
                            <Text style={styles.modalDesc}>
                                Nhập mã OTP đã gửi và mật khẩu mới của bạn.
                            </Text>

                            {cpInfo && !cpError ? (
                                <Text style={styles.cpInfoText}>{cpInfo}</Text>
                            ) : null}
                            {cpError ? (
                                <Text style={styles.passwordErrorText}>{cpError}</Text>
                            ) : null}

                            {/* OTP */}
                            <TextInput
                                style={styles.passwordInput}
                                value={cpOtp}
                                onChangeText={(v) => setCpOtp(v.replace(/[^0-9]/g, ""))}
                                placeholder="Mã OTP (6 chữ số)"
                                placeholderTextColor={colors.textMuted}
                                keyboardType="number-pad"
                                maxLength={6}
                            />

                            <TouchableOpacity
                                style={styles.cpResendBtn}
                                onPress={sendChangePwOtp}
                                disabled={cpSending || cpCooldown > 0}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.cpResendText, (cpSending || cpCooldown > 0) && { color: colors.textMuted }]}>
                                    {cpCooldown > 0 ? `Gửi lại mã (${cpCooldown}s)` : cpSending ? "Đang gửi..." : "Gửi lại mã OTP"}
                                </Text>
                            </TouchableOpacity>

                            {/* Mật khẩu mới */}
                            <View style={styles.cpPwRow}>
                                <TextInput
                                    style={styles.cpPwInput}
                                    value={cpPassword}
                                    onChangeText={setCpPassword}
                                    placeholder="Mật khẩu mới"
                                    placeholderTextColor={colors.textMuted}
                                    secureTextEntry={!cpShowPassword}
                                    autoCapitalize="none"
                                />
                                <TouchableOpacity onPress={() => setCpShowPassword((s) => !s)} hitSlop={8}>
                                    <Ionicons
                                        name={cpShowPassword ? "eye-off-outline" : "eye-outline"}
                                        size={20}
                                        color={colors.textMuted}
                                    />
                                </TouchableOpacity>
                            </View>

                            {/* Xác nhận mật khẩu */}
                            <View style={styles.cpPwRow}>
                                <TextInput
                                    style={styles.cpPwInput}
                                    value={cpConfirm}
                                    onChangeText={setCpConfirm}
                                    placeholder="Nhập lại mật khẩu mới"
                                    placeholderTextColor={colors.textMuted}
                                    secureTextEntry={!cpShowPassword}
                                    autoCapitalize="none"
                                />
                            </View>

                            <Text style={styles.cpHint}>
                                Mật khẩu 8-50 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.
                            </Text>

                            <TouchableOpacity
                                style={[styles.modalConfirmBtn, (cpLoading || cpSending) && { opacity: 0.7 }]}
                                onPress={handleChangePassword}
                                disabled={cpLoading || cpSending}
                                activeOpacity={0.8}
                            >
                                {cpLoading ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.modalConfirmText}>
                                        {currentUser?.hasPinCode ? "Tiếp tục" : "Đổi mật khẩu"}
                                    </Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => !cpLoading && setChangePwModalVisible(false)}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.modalCancelText}>Hủy</Text>
                            </TouchableOpacity>
                        </Pressable>
                    </KeyboardAvoidingView>
                </Pressable>
            </Modal>

            {/* Modal 2FA: xác thực mã PIN để đổi mật khẩu */}
            <Modal
                visible={cpPinModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => !cpPinLoading && setCpPinModalVisible(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => !cpPinLoading && setCpPinModalVisible(false)}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                        style={styles.modalKeyboard}
                    >
                        <Pressable style={styles.modalSheet}>
                            <View style={styles.modalHandle} />
                            <View style={styles.modalIconWrap}>
                                <Ionicons name="keypad" size={32} color={colors.primary} />
                            </View>
                            <Text style={styles.modalTitle}>Xác thực 2 yếu tố</Text>
                            <Text style={styles.modalDesc}>
                                Nhập mã PIN 6 chữ số để xác nhận đổi mật khẩu.
                            </Text>

                            <TextInput
                                style={[styles.passwordInput, cpPinError ? styles.passwordInputError : null]}
                                value={cpPin}
                                onChangeText={(v) => { setCpPin(v.replace(/[^0-9]/g, "")); setCpPinError(""); }}
                                placeholder="••••••"
                                placeholderTextColor={colors.textMuted}
                                keyboardType="number-pad"
                                maxLength={6}
                                secureTextEntry
                                autoFocus
                            />
                            {cpPinError ? (
                                <Text style={styles.passwordErrorText}>{cpPinError}</Text>
                            ) : null}

                            <TouchableOpacity
                                style={[styles.modalConfirmBtn, cpPinLoading && { opacity: 0.7 }]}
                                onPress={handleVerifyCpPin}
                                disabled={cpPinLoading}
                                activeOpacity={0.8}
                            >
                                {cpPinLoading ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.modalConfirmText}>Xác nhận & đổi mật khẩu</Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => !cpPinLoading && setCpPinModalVisible(false)}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.modalCancelText}>Hủy</Text>
                            </TouchableOpacity>
                        </Pressable>
                    </KeyboardAvoidingView>
                </Pressable>
            </Modal>

            {/* Modal Thiết lập mã PIN */}
            <Modal
                visible={setupPinModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setSetupPinModalVisible(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setSetupPinModalVisible(false)}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                        style={styles.modalKeyboard}
                    >
                        <Pressable style={styles.modalSheet}>
                            <View style={styles.modalHandle} />
                            <View style={styles.modalIconWrap}>
                                <Ionicons name="keypad" size={32} color={colors.primary} />
                            </View>
                            <Text style={styles.modalTitle}>Thiết lập mã PIN</Text>
                            <Text style={styles.modalDesc}>
                                Nhập mã PIN 6 chữ số để bảo vệ tài khoản của bạn.
                            </Text>

                            <View style={styles.otpContainer}>
                                {setupPin.map((digit, index) => (
                                    <TextInput
                                        key={index}
                                        ref={(ref) => { setupInputRefs.current[index] = ref; }}
                                        style={[styles.otpInput, setupPinError ? styles.passwordInputError : null]}
                                        value={digit}
                                        onChangeText={(value) => handleSetupPinChange(value, index)}
                                        onKeyPress={({ nativeEvent: { key } }) => handleSetupPinKeyPress(key, index)}
                                        keyboardType="number-pad"
                                        maxLength={1}
                                        selectTextOnFocus
                                        secureTextEntry
                                    />
                                ))}
                            </View>
                            {setupPinError ? (
                                <Text style={styles.passwordErrorText}>{setupPinError}</Text>
                            ) : null}

                            <TouchableOpacity
                                style={[styles.modalConfirmBtn, loadingSetupPin && { opacity: 0.7 }]}
                                onPress={handleSetupPin}
                                disabled={loadingSetupPin}
                                activeOpacity={0.8}
                            >
                                {loadingSetupPin ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.modalConfirmText}>Cài đặt</Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setSetupPinModalVisible(false)}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.modalCancelText}>Hủy</Text>
                            </TouchableOpacity>
                        </Pressable>
                    </KeyboardAvoidingView>
                </Pressable>
            </Modal>

            {/* Modal Nhập PIN để xoá tài khoản */}
            <Modal
                visible={deletePinModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setDeletePinModalVisible(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setDeletePinModalVisible(false)}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                        style={styles.modalKeyboard}
                    >
                        <Pressable style={styles.modalSheet}>
                            <View style={styles.modalHandle} />
                            <View style={[styles.modalIconWrap, { backgroundColor: "#FFE5E5" }]}>
                                <Ionicons name="warning" size={32} color={colors.danger} />
                            </View>
                            <Text style={styles.modalTitle}>Xác nhận mã PIN</Text>
                            <Text style={styles.modalDesc}>
                                Nhập mã PIN 2 lớp của bạn để xác nhận xóa tài khoản.
                            </Text>

                            <View style={styles.otpContainer}>
                                {deletePin.map((digit, index) => (
                                    <TextInput
                                        key={index}
                                        ref={(ref) => { deleteInputRefs.current[index] = ref; }}
                                        style={[styles.otpInput, deletePinError ? styles.passwordInputError : null]}
                                        value={digit}
                                        onChangeText={(value) => handleDeletePinChange(value, index)}
                                        onKeyPress={({ nativeEvent: { key } }) => handleDeletePinKeyPress(key, index)}
                                        keyboardType="number-pad"
                                        maxLength={1}
                                        selectTextOnFocus
                                        secureTextEntry
                                    />
                                ))}
                            </View>
                            {deletePinError ? (
                                <Text style={styles.passwordErrorText}>{deletePinError}</Text>
                            ) : null}

                            <TouchableOpacity
                                style={[styles.modalConfirmBtn, { backgroundColor: colors.danger }, loadingDelete && { opacity: 0.7 }]}
                                onPress={handleConfirmDeleteWithPin}
                                disabled={loadingDelete}
                                activeOpacity={0.8}
                            >
                                {loadingDelete ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.modalConfirmText}>Xác nhận xóa</Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setDeletePinModalVisible(false)}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.modalCancelText}>Hủy</Text>
                            </TouchableOpacity>
                        </Pressable>
                    </KeyboardAvoidingView>
                </Pressable>
            </Modal>

            {/* Modal Nhập PIN để xóa mã PIN */}
            <Modal
                visible={removePinModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setRemovePinModalVisible(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setRemovePinModalVisible(false)}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                        style={styles.modalKeyboard}
                    >
                        <Pressable style={styles.modalSheet}>
                            <View style={styles.modalHandle} />
                            <View style={[styles.modalIconWrap, { backgroundColor: "#FFE5E5" }]}>
                                <Ionicons name="trash" size={32} color={colors.danger} />
                            </View>
                            <Text style={styles.modalTitle}>Xóa mã PIN</Text>
                            <Text style={styles.modalDesc}>
                                Nhập mã PIN hiện tại để xác nhận tắt bảo mật 2 lớp.
                            </Text>

                            <View style={styles.otpContainer}>
                                {removePin.map((digit, index) => (
                                    <TextInput
                                        key={index}
                                        ref={(ref) => { removeInputRefs.current[index] = ref; }}
                                        style={[styles.otpInput, removePinError ? styles.passwordInputError : null]}
                                        value={digit}
                                        onChangeText={(value) => handleRemovePinChange(value, index)}
                                        onKeyPress={({ nativeEvent: { key } }) => handleRemovePinKeyPress(key, index)}
                                        keyboardType="number-pad"
                                        maxLength={1}
                                        selectTextOnFocus
                                        secureTextEntry
                                    />
                                ))}
                            </View>
                            {removePinError ? (
                                <Text style={styles.passwordErrorText}>{removePinError}</Text>
                            ) : null}

                            <TouchableOpacity
                                style={[styles.modalConfirmBtn, { backgroundColor: colors.danger }, loadingRemovePin && { opacity: 0.7 }]}
                                onPress={handleConfirmRemovePin}
                                disabled={loadingRemovePin}
                                activeOpacity={0.8}
                            >
                                {loadingRemovePin ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.modalConfirmText}>Xóa mã PIN</Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setRemovePinModalVisible(false)}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.modalCancelText}>Hủy</Text>
                            </TouchableOpacity>
                        </Pressable>
                    </KeyboardAvoidingView>
                </Pressable>
            </Modal>

            {/* Modal Nhập PIN để hủy xóa tài khoản */}
            <Modal
                visible={cancelDeletePinModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setCancelDeletePinModalVisible(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setCancelDeletePinModalVisible(false)}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                        style={styles.modalKeyboard}
                    >
                        <Pressable style={styles.modalSheet}>
                            <View style={styles.modalHandle} />
                            <View style={[styles.modalIconWrap, { backgroundColor: "#E8F5E9" }]}>
                                <Ionicons name="shield-checkmark" size={32} color="#22C55E" />
                            </View>
                            <Text style={styles.modalTitle}>Xác nhận hủy xóa</Text>
                            <Text style={styles.modalDesc}>
                                Nhập mã PIN 2 lớp của bạn để xác nhận hủy yêu cầu xóa tài khoản.
                            </Text>

                            <View style={styles.otpContainer}>
                                {cancelDeletePin.map((digit, index) => (
                                    <TextInput
                                        key={index}
                                        ref={(ref) => { cancelDeleteInputRefs.current[index] = ref; }}
                                        style={[styles.otpInput, cancelDeletePinError ? styles.passwordInputError : null]}
                                        value={digit}
                                        onChangeText={(value) => handleCancelDeletePinChange(value, index)}
                                        onKeyPress={({ nativeEvent: { key } }) => handleCancelDeletePinKeyPress(key, index)}
                                        keyboardType="number-pad"
                                        maxLength={1}
                                        selectTextOnFocus
                                        secureTextEntry
                                    />
                                ))}
                            </View>
                            {cancelDeletePinError ? (
                                <Text style={styles.passwordErrorText}>{cancelDeletePinError}</Text>
                            ) : null}

                            <TouchableOpacity
                                style={[styles.modalConfirmBtn, { backgroundColor: "#22C55E" }, loadingCancel && { opacity: 0.7 }]}
                                onPress={handleConfirmCancelDeleteWithPin}
                                disabled={loadingCancel}
                                activeOpacity={0.8}
                            >
                                {loadingCancel ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.modalConfirmText}>Hủy xóa tài khoản</Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setCancelDeletePinModalVisible(false)}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.modalCancelText}>Đóng</Text>
                            </TouchableOpacity>
                        </Pressable>
                    </KeyboardAvoidingView>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: colors.text,
    },
    scrollView: {
        flex: 1,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: "600",
        color: colors.textMuted,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginHorizontal: 20,
        marginTop: 24,
        marginBottom: 10,
    },
    card: {
        backgroundColor: colors.background,
        marginHorizontal: 14,
        borderRadius: 16,
        paddingVertical: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
        borderWidth: 1,
        borderColor: colors.border,
    },
    settingInfo: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        flex: 1,
    },
    iconWrap: {
        width: 38,
        height: 38,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
    },
    settingLabel: {
        fontSize: 15,
        fontWeight: "600",
        color: colors.text,
    },
    settingDesc: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 2,
    },
    menuItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        marginLeft: 66,
    },
    policySection: {
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    policyTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: colors.text,
        marginBottom: 8,
    },
    policyText: {
        fontSize: 13,
        color: colors.textMuted,
        lineHeight: 20,
    },
    deletionWarningBanner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: "#FFFBEB",
        marginHorizontal: 16,
        marginVertical: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#FDE68A",
    },
    deletionWarningText: {
        fontSize: 13,
        color: "#B45309",
        fontWeight: "500",
        flex: 1,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "flex-end",
    },
    modalKeyboard: {
        justifyContent: "flex-end",
    },
    modalSheet: {
        backgroundColor: colors.background,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: Platform.OS === "ios" ? 40 : 24,
        alignItems: "center",
    },
    modalHandle: {
        width: 40,
        height: 4,
        backgroundColor: colors.border,
        borderRadius: 2,
        marginBottom: 20,
    },
    modalIconWrap: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: "#E3F2FD",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: "700",
        color: colors.text,
        marginBottom: 8,
        textAlign: "center",
    },
    modalDesc: {
        fontSize: 14,
        color: colors.textMuted,
        textAlign: "center",
        marginBottom: 24,
        paddingHorizontal: 20,
    },
    passwordInput: {
        width: "100%",
        height: 52,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        color: colors.text,
        backgroundColor: colors.surface,
        marginBottom: 16,
        textAlign: "center",
        letterSpacing: 8,
    },
    passwordInputError: {
        borderColor: colors.danger,
    },
    toast: {
        position: "absolute",
        left: 16,
        right: 16,
        zIndex: 1000,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: "rgba(17,24,39,0.95)",
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
    toastText: {
        flex: 1,
        color: "#fff",
        fontSize: 13,
        fontWeight: "500",
    },
    cpInfoText: {
        color: "#059669",
        fontSize: 13,
        marginBottom: 12,
        alignSelf: "center",
        textAlign: "center",
    },
    cpResendBtn: {
        alignSelf: "flex-end",
        marginBottom: 16,
    },
    cpResendText: {
        color: colors.primary,
        fontSize: 13,
        fontWeight: "600",
    },
    cpPwRow: {
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
        height: 52,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        paddingHorizontal: 16,
        backgroundColor: colors.surface,
        marginBottom: 12,
    },
    cpPwInput: {
        flex: 1,
        fontSize: 16,
        color: colors.text,
    },
    cpHint: {
        fontSize: 11,
        color: colors.textMuted,
        alignSelf: "flex-start",
        marginBottom: 20,
    },
    passwordErrorText: {
        color: colors.danger,
        fontSize: 13,
        marginBottom: 16,
        alignSelf: "center",
    },
    otpContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 24,
        paddingHorizontal: 16,
    },
    otpInput: {
        width: 45,
        height: 55,
        borderWidth: 2,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        borderRadius: 12,
        fontSize: 24,
        textAlign: 'center',
        fontWeight: '700',
        color: colors.text,
    },
    modalConfirmBtn: {
        width: "100%",
        height: 52,
        backgroundColor: colors.primary,
        borderRadius: 26,
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
    },
    modalConfirmText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
    modalCancelBtn: {
        width: "100%",
        height: 52,
        borderRadius: 26,
        alignItems: "center",
        justifyContent: "center",
    },
    modalCancelText: {
        color: colors.textMuted,
        fontSize: 16,
        fontWeight: "600",
    },
    privacyOption: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        width: "100%",
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 8,
    },
    privacyOptionSelected: {
        borderColor: "#7C3AED",
        backgroundColor: "#F5F3FF",
    },
    radioEmpty: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: colors.border,
    },
    radioFilled: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: "#7C3AED",
        alignItems: "center",
        justifyContent: "center",
    },
    radioDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#fff",
    },
});
