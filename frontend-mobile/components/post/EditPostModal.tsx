import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { colors, spacing } from "@/constants";
import { Post, PrivacyType } from "@/types";
import * as postApi from "@/services/postService";
import { buildS3Url } from "@/utils/s3";
import type { MusicMetadata } from "@/services/musicService";
import StoryMusicPickerModal from "@/components/story/StoryMusicPickerModal";
import FriendSelectorModal from "@/components/post/FriendSelectorModal";
import LocationSearchModal from "@/components/post/LocationSearchModal";

const CAPTION_MAX = 2200;
const MAX_MEDIA = 10;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
const MAX_VIDEOS = 2;

// Helper to resolve media URL to full URL
const resolveMediaUrl = (rawUrl: string, userId?: string): string => {
    if (!rawUrl) return "";
    if (/^https?:\/\//i.test(rawUrl)) return rawUrl; // Already full URL
    if (rawUrl.includes("/")) return buildS3Url(rawUrl) || rawUrl; // Has path, try S3
    if (userId) {
        // Try posts/{userId}/images/{rawUrl} pattern
        return buildS3Url(`posts/${userId}/images/${rawUrl}`) || rawUrl;
    }
    return buildS3Url(rawUrl) || rawUrl;
};

const privacyOptions: Array<{ value: PrivacyType; label: string; icon: keyof typeof Ionicons.glyphMap; description: string }> = [
    { value: "PUBLIC", label: "Công khai", icon: "earth-outline", description: "Mọi người đều có thể xem" },
    { value: "FRIENDS", label: "Bạn bè", icon: "people-outline", description: "Chỉ bạn bè có thể xem" },
    { value: "ONLY_ME", label: "Chỉ mình tôi", icon: "lock-closed-outline", description: "Chỉ mình tôi" },
    { value: "SPECIFIC", label: "Bạn bè cụ thể", icon: "person-outline", description: "Chỉ những bạn được chọn" },
    { value: "EXCEPT", label: "Bạn bè ngoại trừ", icon: "person-remove-outline", description: "Trừ những bạn được chọn" },
];

interface Props {
    visible: boolean;
    onClose: () => void;
    post: Post;
    currentUserId: string;
    onUpdated?: (post: Post) => void;
}

export default function EditPostModal({ visible, onClose, post, currentUserId, onUpdated }: Props) {
    const insets = useSafeAreaInsets();

    const [caption, setCaption] = useState("");
    const [privacy, setPrivacy] = useState<PrivacyType>("PUBLIC");
    const [location, setLocation] = useState("");
    const [allowComments, setAllowComments] = useState(true);
    const [allowShares, setAllowShares] = useState(true);
    const [taggedUserIds, setTaggedUserIds] = useState<string[]>([]);
    const [music, setMusic] = useState<MusicMetadata | null>(null);

    // Media management
    const [existingMedia, setExistingMedia] = useState<Array<{ url: string; type: string }>>([]);
    const [newMedia, setNewMedia] = useState<ImagePicker.ImagePickerAsset[]>([]);

    // Privacy specific states
    const [specificViewerIds, setSpecificViewerIds] = useState<string[]>([]);
    const [excludedUserIds, setExcludedUserIds] = useState<string[]>([]);
    const [showSpecificViewerSelector, setShowSpecificViewerSelector] = useState(false);
    const [showExcludedSelector, setShowExcludedSelector] = useState(false);

    const [saving, setSaving] = useState(false);

    // Sub-modals
    const [showMusicPicker, setShowMusicPicker] = useState(false);
    const [showFriendSelector, setShowFriendSelector] = useState(false);
    const [showLocationSearch, setShowLocationSearch] = useState(false);

    // Get userId for resolving media URLs
    const userId = post.userId || (post as any).authorId;

    // Prefill from post
    useEffect(() => {
        if (!visible) return;
        setCaption(post.caption || "");
        setPrivacy((post.privacy as PrivacyType) || "PUBLIC");
        setLocation(typeof post.location === "string" ? post.location : post.location?.name || "");
        setAllowComments(post.allowComments !== false);
        setAllowShares(post.allowShares !== false);
        setTaggedUserIds(post.taggedUserIds || []);
        setMusic(post.music ? {
            id: String(post.music.trackId || ""),
            title: post.music.title || "",
            artist: post.music.artist || "",
            duration: post.music.duration || 0,
            imageUrl: post.music.thumbnail || "",
            audioUrl: post.music.audioUrl || "",
        } : null);

        // Resolve media URLs using userId
        const resolvedMedia = (post.media || []).map(m => ({
            url: resolveMediaUrl(m.url, userId),
            type: m.type || "image"
        }));
        setExistingMedia(resolvedMedia);
        setNewMedia([]);
    }, [visible, post, userId]);

    const totalMedia = existingMedia.length + newMedia.length;
    const videoCount = existingMedia.filter(m => m.type.includes("video")).length + newMedia.filter(a => a.type === "video").length;

    const isDirty = useMemo(() => {
        if (caption !== (post.caption || "")) return true;
        if (privacy !== (post.privacy || "PUBLIC")) return true;
        const origLoc = typeof post.location === "string" ? post.location : post.location?.name || "";
        if (location !== origLoc) return true;
        if (allowComments !== (post.allowComments !== false)) return true;
        if (allowShares !== (post.allowShares !== false)) return true;
        if (newMedia.length > 0) return true;
        if (existingMedia.length !== (post.media || []).length) return true;
        return false;
    }, [caption, privacy, location, allowComments, allowShares, newMedia, existingMedia, post]);

    const canSave = useMemo(() => {
        return isDirty && (caption.trim() || existingMedia.length > 0 || newMedia.length > 0) && !saving;
    }, [isDirty, caption, existingMedia, newMedia, saving]);

    const removeExistingMedia = (index: number) => {
        setExistingMedia(prev => prev.filter((_, i) => i !== index));
    };

    const removeNewMedia = (index: number) => {
        setNewMedia(prev => prev.filter((_, i) => i !== index));
    };

    const pickMedia = async () => {
        if (totalMedia >= MAX_MEDIA) {
            Alert.alert("Giới hạn", `Tối đa ${MAX_MEDIA} ảnh/video.`);
            return;
        }
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert("Quyền truy cập", "Bạn cần cấp quyền thư viện ảnh.");
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images", "videos"],
            allowsMultipleSelection: true,
            quality: 0.9,
        });
        if (!result.canceled && result.assets?.length) {
            const remaining = MAX_MEDIA - totalMedia;
            const assets = result.assets.slice(0, remaining);
            const validated = assets.filter(asset => {
                if (asset.type === "video") {
                    if (videoCount >= MAX_VIDEOS) return false;
                    if (asset.fileSize && asset.fileSize > MAX_VIDEO_SIZE) return false;
                }
                if (asset.type !== "video" && asset.fileSize && asset.fileSize > MAX_IMAGE_SIZE) return false;
                return true;
            });
            if (validated.length > 0) setNewMedia(prev => [...prev, ...validated]);
        }
    };

    const handleSave = async () => {
        if (!canSave) return;
        setSaving(true);
        try {
            const toUploadFile = (asset: ImagePicker.ImagePickerAsset) => ({
                uri: asset.uri,
                name: asset.fileName || asset.uri.split("/").pop() || `media-${Date.now()}.jpg`,
                type: asset.mimeType || (asset.type === "video" ? "video/mp4" : "image/jpeg"),
                mimeType: asset.mimeType,
                fileSize: asset.fileSize,
                width: asset.width,
                height: asset.height,
                duration: asset.duration,
            });

            // Only send new media files - backend should keep existing media by default
            // Do NOT send existingImageUrls to avoid duplication
            await postApi.updatePost(currentUserId, post.id, {
                content: caption,
                privacy,
                allowComments,
                allowShares,
                location: location.trim() || undefined,
                taggedUserIds: taggedUserIds.length > 0 ? taggedUserIds : [],
                music: music ? {
                    trackId: music.id,
                    title: music.title,
                    artist: music.artist,
                    thumbnail: music.imageUrl || "",
                    audioUrl: music.audioUrl,
                    duration: music.duration,
                } : undefined,
                mediaFiles: newMedia.length > 0 ? newMedia.map(toUploadFile) : undefined,
            });

            Alert.alert("Thành công", "Đã cập nhật bài viết");
            onUpdated?.({ ...post, caption, privacy: privacy as any, location, allowComments, allowShares });
            onClose();
        } catch (err: any) {
            Alert.alert("Lỗi", err?.response?.data?.message || "Không thể cập nhật bài viết");
        } finally {
            setSaving(false);
        }
    };

    const handleClose = () => {
        if (isDirty) {
            Alert.alert("Hủy chỉnh sửa?", "Thay đổi của bạn sẽ không được lưu.", [
                { text: "Tiếp tục chỉnh sửa", style: "cancel" },
                { text: "Hủy", style: "destructive", onPress: onClose },
            ]);
        } else {
            onClose();
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
            <View style={[s.container, { paddingTop: insets.top }]}>
                {/* Header */}
                <View style={s.header}>
                    <TouchableOpacity onPress={handleClose}><Text style={s.cancelText}>Hủy</Text></TouchableOpacity>
                    <Text style={s.title}>Chỉnh sửa bài viết</Text>
                    <TouchableOpacity onPress={handleSave} disabled={!canSave}>
                        {saving
                            ? <ActivityIndicator size="small" color={colors.primary} />
                            : <Text style={[s.saveText, !canSave && s.saveTextDisabled]}>Lưu</Text>
                        }
                    </TouchableOpacity>
                </View>

                <ScrollView style={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    {/* Caption */}
                    <View style={s.section}>
                        <View style={s.sectionHeader}>
                            <Text style={s.sectionLabel}>Nội dung</Text>
                            <Text style={[s.charCount, caption.length > CAPTION_MAX && s.charCountOver]}>
                                {caption.length}/{CAPTION_MAX}
                            </Text>
                        </View>
                        <TextInput
                            style={s.captionInput}
                            multiline
                            value={caption}
                            onChangeText={t => setCaption(t.slice(0, CAPTION_MAX))}
                            maxLength={CAPTION_MAX}
                            placeholder="Nội dung bài viết..."
                            placeholderTextColor={colors.textMuted}
                        />
                    </View>

                    {/* Media */}
                    <View style={s.section}>
                        <View style={s.sectionHeader}>
                            <Text style={s.sectionLabel}>Media</Text>
                            <Text style={s.mediaBadge}>{totalMedia}/{MAX_MEDIA}</Text>
                        </View>
                        {(existingMedia.length > 0 || newMedia.length > 0) && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.mediaRow}>
                                {existingMedia.map((m, i) => (
                                    <View key={`ex-${i}`} style={s.mediaThumb}>
                                        <Image source={{ uri: m.url }} style={s.mediaImg} />
                                        {m.type.includes("video") && <View style={s.videoBadge}><Ionicons name="play" size={10} color="#fff" /></View>}
                                        <TouchableOpacity style={s.removeBtn} onPress={() => removeExistingMedia(i)}>
                                            <Ionicons name="close" size={12} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                {newMedia.map((a, i) => (
                                    <View key={`new-${i}`} style={s.mediaThumb}>
                                        <Image source={{ uri: a.uri }} style={s.mediaImg} />
                                        {a.type === "video" && <View style={s.videoBadge}><Ionicons name="play" size={10} color="#fff" /></View>}
                                        <View style={s.newBadge}><Text style={s.newBadgeText}>MỚI</Text></View>
                                        <TouchableOpacity style={s.removeBtn} onPress={() => removeNewMedia(i)}>
                                            <Ionicons name="close" size={12} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </ScrollView>
                        )}
                        {totalMedia < MAX_MEDIA && (
                            <TouchableOpacity style={s.addMediaBtn} onPress={pickMedia}>
                                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                                <Text style={s.addMediaText}>Thêm ảnh/video</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Options */}
                    <View style={s.section}>
                        <Text style={s.sectionLabel}>Tùy chọn</Text>

                        <TouchableOpacity style={s.optionRow} onPress={() => setShowLocationSearch(true)}>
                            <Ionicons name="location-outline" size={20} color={colors.primary} />
                            <Text style={[s.optionText, !location && { color: colors.textMuted }]} numberOfLines={1}>
                                {location || "Thêm vị trí"}
                            </Text>
                            <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
                        </TouchableOpacity>

                        <TouchableOpacity style={s.optionRow} onPress={() => setShowFriendSelector(true)}>
                            <Ionicons name="person-add-outline" size={20} color={colors.primary} />
                            <Text style={[s.optionText, taggedUserIds.length === 0 && { color: colors.textMuted }]} numberOfLines={1}>
                                {taggedUserIds.length > 0 ? `Đã tag ${taggedUserIds.length} bạn bè` : "Tag bạn bè"}
                            </Text>
                            <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
                        </TouchableOpacity>

                        <TouchableOpacity style={s.optionRow} onPress={() => setShowMusicPicker(true)}>
                            <Ionicons name="musical-note-outline" size={20} color={colors.primary} />
                            <Text style={[s.optionText, !music && { color: colors.textMuted }]} numberOfLines={1}>
                                {music ? `${music.title} • ${music.artist}` : "Thêm nhạc"}
                            </Text>
                            {music ? (
                                <TouchableOpacity onPress={() => setMusic(null)} hitSlop={8}>
                                    <Ionicons name="close-circle" size={18} color="#FF3B30" />
                                </TouchableOpacity>
                            ) : (
                                <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
                            )}
                        </TouchableOpacity>

                        <View style={s.optionRow}>
                            <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
                            <Text style={s.optionText}>Cho phép bình luận</Text>
                            <Switch value={allowComments} onValueChange={setAllowComments} />
                        </View>
                        <View style={s.optionRow}>
                            <Ionicons name="paper-plane-outline" size={20} color={colors.primary} />
                            <Text style={s.optionText}>Cho phép chia sẻ</Text>
                            <Switch value={allowShares} onValueChange={setAllowShares} />
                        </View>
                    </View>

                    {/* Privacy */}
                    <View style={s.section}>
                        <Text style={s.sectionLabel}>Hiển thị cho</Text>
                        <View style={s.privacyGroup}>
                            {privacyOptions.map(item => {
                                const active = privacy === item.value;
                                const showCount = item.value === "SPECIFIC" ? specificViewerIds.length : item.value === "EXCEPT" ? excludedUserIds.length : 0;
                                return (
                                    <TouchableOpacity
                                        key={item.value}
                                        style={[s.privacyBtn, active && s.privacyBtnActive]}
                                        onPress={() => {
                                            setPrivacy(item.value);
                                            if (item.value === "SPECIFIC") setShowSpecificViewerSelector(true);
                                            else if (item.value === "EXCEPT") setShowExcludedSelector(true);
                                        }}
                                    >
                                        <Ionicons name={item.icon} size={16} color={active ? colors.white : colors.textMuted} />
                                        <View style={s.privacyTextContainer}>
                                            <Text style={[s.privacyBtnText, active && s.privacyBtnTextActive]}>{item.label}</Text>
                                            <Text style={[s.privacyBtnSubtext, active && s.privacyBtnSubtextActive]}>
                                                {showCount > 0 ? `${showCount} người` : item.description}
                                            </Text>
                                        </View>
                                        {active && <Ionicons name="checkmark" size={16} color={colors.white} />}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Selected info for specific/excluded */}
                        {(privacy === "SPECIFIC" || privacy === "EXCEPT") && (
                            <View style={s.selectedInfo}>
                                <Text style={s.selectedInfoText}>
                                    {privacy === "SPECIFIC"
                                        ? `Đã chọn ${specificViewerIds.length} người có thể xem`
                                        : `Đã chọn ${excludedUserIds.length} người không thể xem`}
                                </Text>
                                <TouchableOpacity onPress={() => {
                                    if (privacy === "SPECIFIC") setShowSpecificViewerSelector(true);
                                    else setShowExcludedSelector(true);
                                }}>
                                    <Text style={s.changeText}>Thay đổi</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    <View style={{ height: 40 }} />
                </ScrollView>

                {/* Sub modals */}
                <StoryMusicPickerModal visible={showMusicPicker} onClose={() => setShowMusicPicker(false)} onSelect={setMusic} />
                <FriendSelectorModal visible={showFriendSelector} onClose={() => setShowFriendSelector(false)} onDone={setTaggedUserIds} currentUserId={currentUserId} initialSelected={taggedUserIds} />
                <FriendSelectorModal
                    visible={showSpecificViewerSelector}
                    onClose={() => setShowSpecificViewerSelector(false)}
                    onDone={(selected) => { setSpecificViewerIds(selected); setShowSpecificViewerSelector(false); }}
                    currentUserId={currentUserId}
                    initialSelected={specificViewerIds}
                    title="Chọn người được xem"
                    description="Chỉ những bạn được chọn mới có thể xem bài viết"
                />
                <FriendSelectorModal
                    visible={showExcludedSelector}
                    onClose={() => setShowExcludedSelector(false)}
                    onDone={(selected) => { setExcludedUserIds(selected); setShowExcludedSelector(false); }}
                    currentUserId={currentUserId}
                    initialSelected={excludedUserIds}
                    title="Chọn người bị ẩn"
                    description="Những bạn được chọn sẽ không thể xem bài viết"
                />
                <LocationSearchModal visible={showLocationSearch} onClose={() => setShowLocationSearch(false)} onSelect={setLocation} initialValue={location} />
            </View>
        </Modal>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E5E5EA" },
    cancelText: { fontSize: 16, color: "#8E8E93" },
    title: { fontSize: 17, fontWeight: "700" },
    saveText: { fontSize: 16, fontWeight: "600", color: "#0095F6" },
    saveTextDisabled: { color: "#C7C7CC" },
    content: { flex: 1, padding: 16 },
    section: { marginBottom: 24 },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    sectionLabel: { fontSize: 14, fontWeight: "600", color: colors.text },
    charCount: { fontSize: 12, color: colors.textMuted },
    charCountOver: { color: "#FF3B30" },
    mediaBadge: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
    captionInput: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, fontSize: 15, color: colors.text, textAlignVertical: "top", minHeight: 100, backgroundColor: "#FAFAFA" },
    mediaRow: { gap: 8, paddingBottom: 12 },
    mediaThumb: { width: 80, height: 80, borderRadius: 10, overflow: "hidden", backgroundColor: "#F2F2F7" },
    mediaImg: { width: "100%", height: "100%" },
    videoBadge: { position: "absolute", left: 4, bottom: 4, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.55)" },
    newBadge: { position: "absolute", left: 4, top: 4, backgroundColor: "#0095F6", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
    newBadgeText: { color: "#fff", fontSize: 8, fontWeight: "700" },
    removeBtn: { position: "absolute", right: 4, top: 4, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.6)" },
    addMediaBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 },
    addMediaText: { fontSize: 14, color: colors.primary, fontWeight: "500" },
    optionRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#F2F2F7" },
    optionText: { fontSize: 14, color: colors.text, flex: 1 },
    privacyGroup: { gap: 8 },
    privacyBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    privacyBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    privacyBtnText: { fontSize: 13, fontWeight: "600", color: colors.text },
    privacyBtnTextActive: { color: colors.white },
    privacyTextContainer: { flex: 1, marginRight: 8 },
    privacyBtnSubtext: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
    privacyBtnSubtextActive: { color: "rgba(255,255,255,0.8)" },
    selectedInfo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, padding: 12, backgroundColor: colors.surface, borderRadius: 8 },
    selectedInfoText: { fontSize: 12, color: colors.textMuted },
    changeText: { fontSize: 12, color: colors.primary, fontWeight: "600" },
});
