import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/constants";
import pageService from "@/services/pageService";
import { buildS3Url } from "@/utils/s3";
import type { PageStatus } from "@/services/pageService";

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

export default function PageEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { pageId } = useLocalSearchParams<{ pageId?: string }>();
  const numericPageId = Number(pageId ?? 0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<PageStatus>("PUBLIC");

  const [avatarLocalUri, setAvatarLocalUri] = useState("");
  const [coverLocalUri, setCoverLocalUri] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [pendingAvatarAsset, setPendingAvatarAsset] = useState<{
    uri: string; mimeType: string; extension: string;
  } | null>(null);
  const [pendingCoverAsset, setPendingCoverAsset] = useState<{
    uri: string; mimeType: string; extension: string;
  } | null>(null);
  const [existingAvatarUrl, setExistingAvatarUrl] = useState("");
  const [existingCoverUrl, setExistingCoverUrl] = useState("");

  useEffect(() => {
    if (!numericPageId) return;
    pageService
      .findPageById(numericPageId)
      .then((page) => {
        if (page) {
          setName(page.name ?? "");
          setUsername(page.username ?? "");
          setDescription(page.description ?? "");
          setCategory(page.category ?? "");
          setPhone(page.phone ?? "");
          setEmail(page.email ?? "");
          setWebsite(page.website ?? "");
          setAddress(page.address ?? "");
          setStatus(page.status ?? "PUBLIC");
          setExistingAvatarUrl(page.avatarUrl ?? "");
          setExistingCoverUrl(page.coverUrl ?? "");
        }
      })
      .finally(() => setLoading(false));
  }, [numericPageId]);

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

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập tên trang.");
      return;
    }
    setSaving(true);
    let uploadFailed = false;

    try {
      if (pendingAvatarAsset) {
        setIsUploadingAvatar(true);
        try {
          const uploadUrl = await pageService.getUploadAvatarUrl("pages", numericPageId, pendingAvatarAsset.extension);
          if (!uploadUrl) throw new Error("Không thể lấy URL upload ảnh đại diện.");
          const blob = await fetch(pendingAvatarAsset.uri).then(r => r.blob());
          const uploadRes = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": pendingAvatarAsset.mimeType },
            body: blob,
          });
          if (!uploadRes.ok) throw new Error("Không thể tải lên ảnh đại diện.");
          setPendingAvatarAsset(null);
        } catch (err) {
          uploadFailed = true;
          throw err;
        } finally {
          setIsUploadingAvatar(false);
        }
      }

      if (pendingCoverAsset) {
        setIsUploadingCover(true);
        try {
          const uploadUrl = await pageService.getUploadCoverUrl("pages", numericPageId, pendingCoverAsset.extension);
          if (!uploadUrl) throw new Error("Không thể lấy URL upload ảnh bìa.");
          const blob = await fetch(pendingCoverAsset.uri).then(r => r.blob());
          const uploadRes = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": pendingCoverAsset.mimeType },
            body: blob,
          });
          if (!uploadRes.ok) throw new Error("Không thể tải lên ảnh bìa.");
          setPendingCoverAsset(null);
        } catch (err) {
          uploadFailed = true;
          throw err;
        } finally {
          setIsUploadingCover(false);
        }
      }

      const ok = await pageService.updatePage(numericPageId, {
        name: name.trim(),
        username: username.trim() || undefined,
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        website: website.trim() || undefined,
        address: address.trim() || undefined,
        status,
      });

      if (ok) {
        Alert.alert("Đã cập nhật", "Thông tin trang đã được lưu.", [{ text: "OK", onPress: () => router.back() }]);
      } else {
        Alert.alert("Lỗi", "Không thể cập nhật trang. Vui lòng thử lại.");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Không thể cập nhật trang.";
      Alert.alert("Lỗi", msg);
      if (uploadFailed) {
        setAvatarLocalUri("");
        setCoverLocalUri("");
        setPendingAvatarAsset(null);
        setPendingCoverAsset(null);
        try {
          await pageService.updatePage(numericPageId, {
            avatarUrl: existingAvatarUrl || undefined,
            coverUrl: existingCoverUrl || undefined,
          });
        } catch { /* silent */ }
      }
    } finally {
      setSaving(false);
      setIsUploadingAvatar(false);
      setIsUploadingCover(false);
    }
  };

  if (loading) {
    return (
      <View style={[s.container, s.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={FB_BLUE} />
        <Text style={{ color: colors.textMuted, marginTop: 10 }}>Đang tải...</Text>
      </View>
    );
  }

  const avatarSource = avatarLocalUri || existingAvatarUrl;
  const coverSource = coverLocalUri || existingCoverUrl;

  return (
    <KeyboardAvoidingView
      style={[s.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Chỉnh sửa trang</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || !name.trim()}
          style={[s.saveBtn, (!name.trim() || saving) && s.saveBtnDisabled]}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={s.saveBtnText}>Lưu</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Cover + Avatar photo area */}
        <View style={s.photosSection}>
          {/* Cover picker */}
          <TouchableOpacity onPress={pickCoverImage} disabled={isUploadingCover} activeOpacity={0.85} style={s.coverWrap}>
            {coverSource ? (
              <Image key={`cover-${coverSource}`} source={{ uri: buildS3Url(coverSource) }} style={s.coverPreview} resizeMode="cover" />
            ) : (
              <View style={s.coverPlaceholder}>
                <Ionicons name="image-outline" size={28} color={colors.textMuted} />
                <Text style={s.coverPlaceholderText}>Thêm ảnh bìa</Text>
              </View>
            )}
            <View style={s.coverEditOverlay}>
              <Ionicons name="camera" size={16} color={colors.white} />
              <Text style={s.coverEditText}>Đổi ảnh bìa</Text>
            </View>
          </TouchableOpacity>

          {/* Avatar overlapping cover */}
          <TouchableOpacity onPress={pickAvatarImage} disabled={isUploadingAvatar} activeOpacity={0.85} style={s.avatarWrap}>
            {isUploadingAvatar ? (
              <View style={[s.avatarPreview, s.avatarFallback]}>
                <ActivityIndicator size="small" color={FB_BLUE} />
              </View>
            ) : avatarSource ? (
              <Image key={`avatar-${avatarSource}`} source={{ uri: buildS3Url(avatarSource) }} style={s.avatarPreview} />
            ) : (
              <View style={[s.avatarPreview, s.avatarFallback]}>
                <Ionicons name="flag" size={28} color={FB_BLUE} />
              </View>
            )}
            <View style={s.avatarEditBadge}>
              <Ionicons name="camera" size={11} color={colors.white} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Basic info */}
        <SectionHeader icon="flag-outline" title="Thông tin cơ bản" />
        <View style={s.card}>
          <FormField label="Tên trang *" value={name} onChange={setName} placeholder="Tên trang" />
          <FormField label="Username" value={username} onChange={setUsername} placeholder="@username" autoCapitalize="none" />
          <FormField label="Mô tả" value={description} onChange={setDescription} placeholder="Giới thiệu về trang..." multiline last />
        </View>

        {/* Category */}
        <SectionHeader icon="grid-outline" title="Danh mục" />
        <View style={s.card}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 10 }}>
            {CATEGORIES.map((cat) => {
              const active = category === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategory(active ? "" : cat)}
                  style={[s.chip, active && s.chipActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[s.chipText, active && s.chipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Privacy */}
        <SectionHeader icon="shield-outline" title="Quyền riêng tư" />
        <View style={s.card}>
          {STATUS_OPTIONS.map((opt, idx) => {
            const active = status === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setStatus(opt.value)}
                style={[
                  s.privacyOption,
                  idx === 0 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                ]}
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

        {/* Contact */}
        <SectionHeader icon="call-outline" title="Thông tin liên hệ" />
        <View style={s.card}>
          <FormField label="Điện thoại" value={phone} onChange={setPhone} placeholder="0912345678" icon="call-outline" />
          <FormField label="Email" value={email} onChange={setEmail} placeholder="contact@example.com" autoCapitalize="none" icon="mail-outline" />
          <FormField label="Website" value={website} onChange={setWebsite} placeholder="https://example.com" autoCapitalize="none" icon="globe-outline" />
          <FormField label="Địa chỉ" value={address} onChange={setAddress} placeholder="Địa chỉ trang" icon="location-outline" last />
        </View>

        {/* Save button at bottom */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || !name.trim()}
          style={[s.saveBottomBtn, (!name.trim() || saving) && s.saveBtnDisabled]}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={s.saveBottomBtnText}>Lưu thay đổi</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>
      <Ionicons name={icon as any} size={15} color={colors.textMuted} />
      <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 }}>
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
  icon,
  last,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoCapitalize?: "none" | "sentences";
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
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: FB_BG },
  center: { justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: colors.text, marginLeft: 12 },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: FB_BLUE,
    minWidth: 56,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { fontSize: 15, fontWeight: "700", color: colors.white },

  scrollContent: { paddingBottom: 40 },

  // Photo section
  photosSection: { position: "relative", marginBottom: 30 },
  coverWrap: {
    height: 180,
    backgroundColor: "#E4E6EB",
    position: "relative",
  },
  coverPreview: { width: "100%", height: "100%" },
  coverPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 180,
  },
  coverPlaceholderText: { fontSize: 14, color: colors.textMuted, fontWeight: "600" },
  coverEditOverlay: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  coverEditText: { fontSize: 12, fontWeight: "600", color: colors.white },

  avatarWrap: {
    position: "absolute",
    bottom: -32,
    left: 20,
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    borderColor: FB_BG,
    overflow: "hidden",
    backgroundColor: "#E4E6EB",
  },
  avatarPreview: { width: "100%", height: "100%" },
  avatarFallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.zalo50 },
  avatarEditBadge: {
    position: "absolute",
    bottom: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.textMuted,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: FB_BG,
  },

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

  chip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: FB_BG,
  },
  chipActive: { backgroundColor: FB_BLUE, borderColor: FB_BLUE },
  chipText: { fontSize: 13, fontWeight: "500", color: colors.textMuted },
  chipTextActive: { color: colors.white, fontWeight: "700" },

  privacyOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
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

  saveBottomBtn: {
    margin: 16,
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: FB_BLUE,
    alignItems: "center",
  },
  saveBottomBtnText: { fontSize: 16, fontWeight: "700", color: colors.white },
});
