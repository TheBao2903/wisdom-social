import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/constants";
import pageService from "@/services/pageService";
import type { CreatePageRequest, PageStatus } from "@/services/pageService";

const FB_BG = "#F0F2F5";
const FB_BLUE = colors.primary;

const STATUS_OPTIONS: { label: string; value: PageStatus; icon: string; desc: string }[] = [
    { label: "Công khai", value: "PUBLIC", icon: "earth-outline", desc: "Mọi người đều thấy và tham gia" },
    { label: "Riêng tư", value: "PRIVATE", icon: "lock-closed-outline", desc: "Chỉ thành viên được duyệt" },
];

const CATEGORIES = [
    "Giải trí", "Giáo dục", "Công nghệ", "Thể thao",
    "Ẩm thực", "Du lịch", "Kinh doanh", "Âm nhạc",
    "Nghệ thuật", "Sức khỏe", "Thời trang", "Khác",
];

export default function CreatePageScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [avatarLocalUri, setAvatarLocalUri] = useState("");
    const [isUploadingCover, setIsUploadingCover] = useState(false);
    const [coverLocalUri, setCoverLocalUri] = useState("");
    const [pendingAvatarAsset, setPendingAvatarAsset] = useState<{ uri: string; mimeType: string; extension: string } | null>(null);
    const [pendingCoverAsset, setPendingCoverAsset] = useState<{ uri: string; mimeType: string; extension: string } | null>(null);
    const [form, setForm] = useState<CreatePageRequest>({
        name: "",
        username: "",
        category: "",
        description: "",
        avatarUrl: "",
        coverUrl: "",
        phone: "",
        email: "",
        website: "",
        address: "",
        status: "PUBLIC",
    });

    const update = (key: keyof CreatePageRequest, value: string) => {
        setForm(f => ({ ...f, [key]: value }));
    };

    const pickAvatarImage = async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            Alert.alert("Quyền truy cập", "Cần quyền truy cập thư viện ảnh để chọn ảnh.");
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
        if (result.canceled || !result.assets[0]) return;
        const asset = result.assets[0];
        const mimeType = asset.mimeType ?? "image/jpeg";
        const extension = mimeType.split("/")[1].replace("jpeg", "jpg");
        setAvatarLocalUri(asset.uri);
        setPendingAvatarAsset({ uri: asset.uri, mimeType, extension });
    };

    const pickCoverImage = async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            Alert.alert("Quyền truy cập", "Cần quyền truy cập thư viện ảnh để chọn ảnh.");
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
        if (result.canceled || !result.assets[0]) return;
        const asset = result.assets[0];
        const mimeType = asset.mimeType ?? "image/jpeg";
        const extension = mimeType.split("/")[1].replace("jpeg", "jpg");
        setCoverLocalUri(asset.uri);
        setPendingCoverAsset({ uri: asset.uri, mimeType, extension });
    };

    const handleSubmit = async () => {
        if (!form.name?.trim()) {
            Alert.alert("Thiếu thông tin", "Vui lòng nhập tên trang.");
            return;
        }
        setIsSubmitting(true);
        try {
            let finalAvatarUrl = form.avatarUrl;
            let finalCoverUrl = form.coverUrl;

            if (pendingAvatarAsset) {
                setIsUploadingAvatar(true);
                const urls = await pageService.getUploadUrl("pages", pendingAvatarAsset.extension);
                if (!urls) throw new Error("Không thể lấy URL upload ảnh đại diện.");
                const blob = await fetch(pendingAvatarAsset.uri).then(r => r.blob());
                const uploadRes = await fetch(urls.uploadUrl, {
                    method: "PUT",
                    headers: { "Content-Type": pendingAvatarAsset.mimeType },
                    body: blob,
                });
                if (!uploadRes.ok) throw new Error("Không thể tải lên ảnh đại diện.");
                finalAvatarUrl = urls.uuid + "." + urls.extension;
                setIsUploadingAvatar(false);
            }

            if (pendingCoverAsset) {
                setIsUploadingCover(true);
                const urls = await pageService.getUploadUrl("pages", pendingCoverAsset.extension);
                if (!urls) throw new Error("Không thể lấy URL upload ảnh bìa.");
                const blob = await fetch(pendingCoverAsset.uri).then(r => r.blob());
                const uploadRes = await fetch(urls.uploadUrl, {
                    method: "PUT",
                    headers: { "Content-Type": pendingCoverAsset.mimeType },
                    body: blob,
                });
                if (!uploadRes.ok) throw new Error("Không thể tải lên ảnh bìa.");
                finalCoverUrl = urls.uuid + "." + urls.extension;
                setIsUploadingCover(false);
            }

            await pageService.createPage({ ...form, avatarUrl: finalAvatarUrl, coverUrl: finalCoverUrl });
            Alert.alert("Trang đã được tạo!", "Mọi người có thể tìm thấy trang của bạn.", [
                { text: "OK", onPress: () => router.back() },
            ]);
        } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || "Không thể tạo trang. Vui lòng thử lại.";
            Alert.alert("Lỗi", msg);
        } finally {
            setIsSubmitting(false);
            setIsUploadingAvatar(false);
            setIsUploadingCover(false);
        }
    };

    const canSubmit = !!form.name?.trim() && !isSubmitting;

    return (
        <KeyboardAvoidingView
            style={[s.container, { paddingTop: insets.top }]}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.headerClose}>
                    <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={s.headerTitle}>Tạo trang mới</Text>
                <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={!canSubmit}
                    style={[s.submitBtn, !canSubmit && s.submitBtnDisabled]}
                    activeOpacity={0.8}
                >
                    {isSubmitting ? (
                        <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                        <Text style={s.submitBtnText}>Tạo</Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={s.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Cover photo picker */}
                <TouchableOpacity
                    onPress={pickCoverImage}
                    disabled={isUploadingCover}
                    style={s.coverPickerWrap}
                    activeOpacity={0.85}
                >
                    {coverLocalUri ? (
                        <Image source={{ uri: coverLocalUri }} style={s.coverPreview} resizeMode="cover" />
                    ) : (
                        <View style={s.coverPlaceholder}>
                            <Ionicons name="image-outline" size={32} color={colors.textMuted} />
                            <Text style={s.coverPlaceholderText}>Thêm ảnh bìa</Text>
                        </View>
                    )}
                    {/* Avatar overlapping cover */}
                    <TouchableOpacity
                        onPress={pickAvatarImage}
                        disabled={isUploadingAvatar}
                        style={s.avatarOverCover}
                        activeOpacity={0.85}
                    >
                        {avatarLocalUri ? (
                            <Image source={{ uri: avatarLocalUri }} style={s.avatarPreview} />
                        ) : (
                            <View style={s.avatarPlaceholder}>
                                <Ionicons name="camera" size={20} color={colors.textMuted} />
                            </View>
                        )}
                        <View style={s.avatarEditBadge}>
                            <Ionicons name="camera" size={10} color={colors.white} />
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>

                {/* Info tip */}
                <View style={s.tipRow}>
                    <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
                    <Text style={s.tipText}>Nhấn ảnh bìa để đổi ảnh bìa · Nhấn avatar để đổi ảnh đại diện</Text>
                </View>

                {/* Basic info section */}
                <SectionHeader icon="flag-outline" title="Thông tin cơ bản" />

                <View style={s.card}>
                    <FormField
                        label="Tên trang *"
                        value={form.name || ""}
                        onChange={v => update("name", v)}
                        placeholder="VD: Cộng đồng yêu du lịch"
                    />
                    {/* Username được tự gán = username người tạo ở backend (cho phép trùng) */}
                    <FormField
                        label="Mô tả"
                        value={form.description || ""}
                        onChange={v => update("description", v)}
                        placeholder="Mô tả ngắn về trang của bạn..."
                        multiline
                        last
                    />
                </View>

                {/* Category section */}
                <SectionHeader icon="grid-outline" title="Danh mục" />
                <View style={s.card}>
                    <Text style={s.categoryHint}>Chọn danh mục phù hợp nhất với trang của bạn</Text>
                    <View style={s.categoryGrid}>
                        {CATEGORIES.map(cat => {
                            const active = form.category === cat;
                            return (
                                <TouchableOpacity
                                    key={cat}
                                    onPress={() => update("category", active ? "" : cat)}
                                    style={[s.categoryChip, active && s.categoryChipActive]}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[s.categoryChipText, active && s.categoryChipTextActive]}>{cat}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Privacy section */}
                <SectionHeader icon="shield-outline" title="Quyền riêng tư" />
                <View style={s.card}>
                    {STATUS_OPTIONS.map((opt, idx) => {
                        const active = form.status === opt.value;
                        return (
                            <TouchableOpacity
                                key={opt.value}
                                onPress={() => update("status", opt.value)}
                                style={[s.privacyOption, active && s.privacyOptionActive, idx === 0 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
                                activeOpacity={0.7}
                            >
                                <View style={[s.privacyIconWrap, active && { backgroundColor: FB_BLUE }]}>
                                    <Ionicons name={opt.icon as any} size={20} color={active ? colors.white : colors.textMuted} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[s.privacyLabel, active && { color: FB_BLUE }]}>{opt.label}</Text>
                                    <Text style={s.privacyDesc}>{opt.desc}</Text>
                                </View>
                                <View style={[s.radioOuter, active && { borderColor: FB_BLUE }]}>
                                    {active && <View style={s.radioInner} />}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Contact section */}
                <SectionHeader icon="call-outline" title="Thông tin liên hệ (tùy chọn)" />
                <View style={s.card}>
                    <FormField label="Điện thoại" value={form.phone || ""} onChange={v => update("phone", v)} placeholder="+84..." icon="call-outline" />
                    <FormField label="Email" value={form.email || ""} onChange={v => update("email", v)} placeholder="page@example.com" autoCapitalize="none" icon="mail-outline" />
                    <FormField label="Website" value={form.website || ""} onChange={v => update("website", v)} placeholder="https://..." autoCapitalize="none" icon="globe-outline" />
                    <FormField label="Địa chỉ" value={form.address || ""} onChange={v => update("address", v)} placeholder="Địa chỉ trang..." icon="location-outline" last />
                </View>

                {/* Create button at bottom */}
                <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={!canSubmit}
                    style={[s.createBtn, !canSubmit && s.submitBtnDisabled]}
                    activeOpacity={0.85}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color={colors.white} />
                    ) : (
                        <Text style={s.createBtnText}>Tạo trang</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

function SectionHeader({ icon, title }: { icon: string; title: string }) {
    return (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>
            <Ionicons name={icon as any} size={16} color={colors.textMuted} />
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {title}
            </Text>
        </View>
    );
}

function FormField({
    label,
    value,
    onChange,
    placeholder,
    multiline,
    autoCapitalize,
    hint,
    icon,
    last,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    multiline?: boolean;
    autoCapitalize?: "none" | "sentences";
    hint?: string;
    icon?: string;
    last?: boolean;
}) {
    return (
        <View style={[
            { paddingVertical: 12 },
            !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        ]}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textMuted, marginBottom: 6 }}>{label}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {icon && <Ionicons name={icon as any} size={16} color={colors.textMuted} />}
                <TextInput
                    style={[
                        { flex: 1, fontSize: 15, color: colors.text, padding: 0 },
                        multiline && { minHeight: 72, textAlignVertical: "top" as any },
                    ]}
                    value={value}
                    onChangeText={onChange}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textMuted}
                    multiline={multiline}
                    autoCapitalize={autoCapitalize}
                />
            </View>
            {hint && (
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4 }}>{hint}</Text>
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: FB_BG },

    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: colors.white,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    headerClose: { padding: 4, marginRight: 4 },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: colors.text },
    submitBtn: {
        paddingHorizontal: 20,
        paddingVertical: 9,
        borderRadius: 8,
        backgroundColor: FB_BLUE,
        minWidth: 56,
        alignItems: "center",
    },
    submitBtnDisabled: { opacity: 0.45 },
    submitBtnText: { fontSize: 15, fontWeight: "700", color: colors.white },

    scrollContent: { paddingBottom: 40 },

    // Cover + Avatar photo pickers
    coverPickerWrap: {
        position: "relative",
        height: 180,
        backgroundColor: "#E4E6EB",
        marginBottom: 0,
    },
    coverPreview: { width: "100%", height: "100%" },
    coverPlaceholder: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    coverPlaceholderText: { fontSize: 14, color: colors.textMuted, fontWeight: "600" },

    avatarOverCover: {
        position: "absolute",
        bottom: -28,
        left: 20,
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 4,
        borderColor: FB_BG,
        overflow: "hidden",
        backgroundColor: "#E4E6EB",
    },
    avatarPreview: { width: "100%", height: "100%" },
    avatarPlaceholder: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#E4E6EB",
    },
    avatarEditBadge: {
        position: "absolute",
        bottom: 4,
        right: 4,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: colors.textMuted,
        alignItems: "center",
        justifyContent: "center",
    },

    tipRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 16,
        paddingTop: 36,
        paddingBottom: 4,
    },
    tipText: { fontSize: 12, color: colors.textMuted, flex: 1 },

    card: {
        backgroundColor: colors.white,
        marginHorizontal: 12,
        borderRadius: 12,
        paddingHorizontal: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },

    categoryHint: { fontSize: 13, color: colors.textMuted, marginTop: 12, marginBottom: 10 },
    categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 14 },
    categoryChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: colors.border,
        backgroundColor: FB_BG,
    },
    categoryChipActive: { backgroundColor: FB_BLUE, borderColor: FB_BLUE },
    categoryChipText: { fontSize: 13, fontWeight: "500", color: colors.textMuted },
    categoryChipTextActive: { color: colors.white, fontWeight: "700" },

    privacyOption: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 14,
    },
    privacyOptionActive: { },
    privacyIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: FB_BG,
        alignItems: "center",
        justifyContent: "center",
    },
    privacyLabel: { fontSize: 15, fontWeight: "700", color: colors.text },
    privacyDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    radioOuter: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: colors.border,
        alignItems: "center",
        justifyContent: "center",
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: FB_BLUE,
    },

    createBtn: {
        margin: 16,
        paddingVertical: 15,
        borderRadius: 12,
        backgroundColor: FB_BLUE,
        alignItems: "center",
    },
    createBtnText: { fontSize: 16, fontWeight: "700", color: colors.white },
});
