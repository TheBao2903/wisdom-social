import React, { useState, useEffect, useMemo } from "react";
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    FlatList,
    Image,
    ActivityIndicator,
    Alert,
    Dimensions,
    Pressable,
    ScrollView
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/constants";
import { HighlightStory, StoryHighlight } from "@/types";
import {
    createHighlight,
    updateHighlight,
    deleteHighlight,
    getAllUserStories
} from "@/services/highlightService";
import { buildS3Url } from "@/utils/s3";

const { width: SW } = Dimensions.get("window");
const GRID_GAP = 2;
const GRID_SIZE = (SW - GRID_GAP * 3) / 4;

const TEXT_GRADIENTS: readonly [string, string][] = [
    ["#7C3AED", "#EF4444"],
    ["#2563EB", "#14B8A6"],
    ["#F97316", "#FACC15"],
    ["#059669", "#84CC16"],
    ["#4F46E5", "#EC4899"],
];

const getGradientIndex = (text: string) => {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % TEXT_GRADIENTS.length;
};

interface HighlightModalProps {
    visible: boolean;
    onClose: () => void;
    onSaveSuccess: () => void;
    currentUserId: string;
    highlight?: StoryHighlight | null;
}

export default function HighlightModal({
    visible,
    onClose,
    onSaveSuccess,
    currentUserId,
    highlight
}: HighlightModalProps) {
    const insets = useSafeAreaInsets();
    const isEditMode = !!highlight;

    const [title, setTitle] = useState("");
    const [selectedStoryIds, setSelectedStoryIds] = useState<string[]>([]);
    const [coverImageUrl, setCoverImageUrl] = useState("");
    const [allStories, setAllStories] = useState<HighlightStory[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isChoosingCover, setIsChoosingCover] = useState(false);

    // Load user stories
    useEffect(() => {
        if (!visible) return;

        const loadStories = async () => {
            setLoading(true);
            try {
                const stories = await getAllUserStories(currentUserId);
                // Sort stories descending by createdAt
                const sorted = stories.sort(
                    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
                setAllStories(sorted);

                if (isEditMode && highlight) {
                    setTitle(highlight.title);
                    const ids = highlight.stories.map((s) => s.id);
                    setSelectedStoryIds(ids);
                    setCoverImageUrl(highlight.coverImageUrl || "");
                } else {
                    setTitle("");
                    setSelectedStoryIds([]);
                    setCoverImageUrl("");
                }
            } catch (err) {
                console.error("Error loading user stories:", err);
                Alert.alert("Lỗi", "Không thể tải danh sách tin");
            } finally {
                setLoading(false);
            }
        };

        void loadStories();
    }, [visible, currentUserId, highlight, isEditMode]);

    // Map selected IDs back to HighlightStory objects
    const selectedStories = useMemo(() => {
        return allStories.filter((s) => selectedStoryIds.includes(s.id));
    }, [allStories, selectedStoryIds]);

    // Auto-update cover if it's no longer selected, or set initial cover
    useEffect(() => {
        if (selectedStoryIds.length === 0) {
            setCoverImageUrl("");
            return;
        }

        // Check if the current coverImageUrl corresponds to a selected story
        const stillSelected = selectedStories.some((story) => {
            const storyUrl = story.media?.url || story.text ? `text-story:${story.text || ""}` : "";
            return (
                coverImageUrl === storyUrl ||
                buildS3Url(coverImageUrl) === buildS3Url(story.media?.url)
            );
        });

        if (!stillSelected || !coverImageUrl) {
            // Set cover to the first selected story
            const first = selectedStories[0];
            if (first) {
                if (first.media?.url) {
                    setCoverImageUrl(first.media.url);
                } else if (first.text) {
                    setCoverImageUrl(`text-story:${first.text}`);
                }
            }
        }
    }, [selectedStoryIds, selectedStories, coverImageUrl]);

    const handleToggleStory = (storyId: string) => {
        setSelectedStoryIds((prev) => {
            if (prev.includes(storyId)) {
                return prev.filter((id) => id !== storyId);
            } else {
                return [...prev, storyId];
            }
        });
    };

    const handleSelectCover = (story: HighlightStory) => {
        if (story.media?.url) {
            setCoverImageUrl(story.media.url);
        } else if (story.text) {
            setCoverImageUrl(`text-story:${story.text}`);
        }
        setIsChoosingCover(false);
    };

    const handleSave = async () => {
        if (!title.trim()) {
            Alert.alert("Thông báo", "Vui lòng nhập tiêu đề cho tin nổi bật");
            return;
        }
        if (selectedStoryIds.length === 0) {
            Alert.alert("Thông báo", "Vui lòng chọn ít nhất 1 tin");
            return;
        }

        setSaving(true);
        try {
            if (isEditMode && highlight) {
                await updateHighlight(highlight.id, {
                    title: title.trim(),
                    storyIds: selectedStoryIds,
                    coverImageUrl: coverImageUrl,
                });
                Alert.alert("Thành công", "Đã cập nhật tin nổi bật thành công");
            } else {
                await createHighlight(title.trim(), selectedStoryIds, coverImageUrl);
                Alert.alert("Thành công", "Đã tạo tin nổi bật thành công");
            }
            onSaveSuccess();
            onClose();
        } catch (err: any) {
            Alert.alert("Lỗi", err.message || "Đã xảy ra lỗi khi lưu");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteHighlight = () => {
        if (!highlight) return;
        Alert.alert(
            "Xóa tin nổi bật",
            "Bạn có chắc chắn muốn xóa tin nổi bật này không?",
            [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Xóa",
                    style: "destructive",
                    onPress: async () => {
                        setSaving(true);
                        try {
                            await deleteHighlight(highlight.id);
                            Alert.alert("Thành công", "Đã xóa tin nổi bật");
                            onSaveSuccess();
                            onClose();
                        } catch (err: any) {
                            Alert.alert("Lỗi", err.message || "Không thể xóa tin nổi bật");
                        } finally {
                            setSaving(false);
                        }
                    }
                }
            ]
        );
    };

    const renderCoverPreview = () => {
        if (!coverImageUrl) {
            return (
                <View style={s.coverFallback}>
                    <Ionicons name="camera-outline" size={32} color="#8E8E93" />
                </View>
            );
        }

        if (coverImageUrl.startsWith("text-story:")) {
            const text = coverImageUrl.replace("text-story:", "");
            const gradIdx = getGradientIndex(text);
            return (
                <LinearGradient colors={TEXT_GRADIENTS[gradIdx]} style={s.coverPreview}>
                    <Text numberOfLines={3} style={s.coverText}>
                        {text}
                    </Text>
                </LinearGradient>
            );
        }

        return <Image source={{ uri: buildS3Url(coverImageUrl) }} style={s.coverPreview} />;
    };

    const renderStoryGridItem = ({ item }: { item: HighlightStory }) => {
        const isSelected = selectedStoryIds.includes(item.id);
        const hasMedia = !!item.media?.url;

        return (
            <TouchableOpacity
                style={s.gridItem}
                onPress={() => handleToggleStory(item.id)}
                activeOpacity={0.8}
            >
                {hasMedia ? (
                    <Image source={{ uri: buildS3Url(item.media?.url) }} style={s.gridItemMedia} />
                ) : (
                    <LinearGradient
                        colors={TEXT_GRADIENTS[getGradientIndex(item.text || "")]}
                        style={s.gridItemMedia}
                    >
                        <Text numberOfLines={4} style={s.gridItemText}>
                            {item.text}
                        </Text>
                    </LinearGradient>
                )}

                {/* Selection Overlay */}
                <View style={[s.checkboxContainer, isSelected && s.checkboxSelected]}>
                    {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={[s.container, { paddingTop: insets.top }]}>
                {/* Header */}
                <View style={s.header}>
                    <TouchableOpacity onPress={onClose} disabled={saving}>
                        <Text style={s.cancelText}>Hủy</Text>
                    </TouchableOpacity>
                    <Text style={s.title}>
                        {isChoosingCover
                            ? "Chọn ảnh bìa"
                            : isEditMode
                              ? "Chỉnh sửa tin nổi bật"
                              : "Tin nổi bật mới"}
                    </Text>
                    <TouchableOpacity onPress={isChoosingCover ? () => setIsChoosingCover(false) : handleSave} disabled={saving}>
                        {saving ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <Text style={s.doneText}>Xong</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {isChoosingCover ? (
                    /* Choose Cover View */
                    <View style={s.coverChooserContainer}>
                        <Text style={s.chooserSub}>Chọn một tin từ danh sách đã chọn làm ảnh bìa</Text>
                        {selectedStories.length === 0 ? (
                            <View style={s.center}>
                                <Text style={s.emptyText}>Chưa có tin nào được chọn</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={selectedStories}
                                keyExtractor={(item) => item.id}
                                numColumns={4}
                                renderItem={({ item }) => {
                                    const isCurrentCover =
                                        item.media?.url === coverImageUrl ||
                                        (item.text && coverImageUrl === `text-story:${item.text}`);
                                    return (
                                        <TouchableOpacity
                                            style={s.gridItem}
                                            onPress={() => handleSelectCover(item)}
                                        >
                                            {item.media?.url ? (
                                                <Image
                                                    source={{ uri: buildS3Url(item.media.url) }}
                                                    style={s.gridItemMedia}
                                                />
                                            ) : (
                                                <LinearGradient
                                                    colors={TEXT_GRADIENTS[getGradientIndex(item.text || "")]}
                                                    style={s.gridItemMedia}
                                                >
                                                    <Text numberOfLines={4} style={s.gridItemText}>
                                                        {item.text}
                                                    </Text>
                                                </LinearGradient>
                                            )}
                                            {isCurrentCover && (
                                                <View style={s.coverBadge}>
                                                    <Text style={s.coverBadgeText}>Bìa</Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                }}
                            />
                        )}
                    </View>
                ) : (
                    /* Main View */
                    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
                        {/* Cover image preview */}
                        <View style={s.coverSection}>
                            {renderCoverPreview()}
                            <TouchableOpacity onPress={() => setIsChoosingCover(true)}>
                                <Text style={s.editCoverText}>Chỉnh sửa ảnh bìa</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Title input */}
                        <View style={s.inputSection}>
                            <Text style={s.label}>Tiêu đề</Text>
                            <TextInput
                                style={s.input}
                                placeholder="Nhập tiêu đề..."
                                placeholderTextColor="#8E8E93"
                                value={title}
                                onChangeText={setTitle}
                                maxLength={25}
                            />
                        </View>

                        {/* Story Selection Grid */}
                        <View style={s.storiesSection}>
                            <Text style={s.label}>Chọn tin ({selectedStoryIds.length})</Text>
                            {loading ? (
                                <ActivityIndicator style={s.loader} color={colors.primary} />
                            ) : allStories.length === 0 ? (
                                <View style={s.emptyStoriesWrap}>
                                    <Text style={s.emptyText}>Bạn chưa có tin lưu trữ nào</Text>
                                </View>
                            ) : (
                                <View style={s.gridContainer}>
                                    {allStories.map((story) => (
                                        <View key={story.id}>
                                            {renderStoryGridItem({ item: story })}
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>

                        {/* Delete Button */}
                        {isEditMode && (
                            <TouchableOpacity
                                style={s.deleteButton}
                                onPress={handleDeleteHighlight}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                <Text style={s.deleteText}>Xóa tin nổi bật</Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>
                )}
            </View>
        </Modal>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#E5E5EA",
    },
    cancelText: { fontSize: 16, color: "#8E8E93" },
    title: { fontSize: 17, fontWeight: "700", color: "#000" },
    doneText: { fontSize: 16, fontWeight: "600", color: "#0095F6" },
    content: { paddingBottom: 40 },
    coverSection: {
        alignItems: "center",
        paddingVertical: 20,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#E5E5EA",
    },
    coverPreview: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 2,
        borderColor: "#EFEFEF",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
    },
    coverText: {
        color: "#fff",
        fontSize: 11,
        fontWeight: "700",
        textAlign: "center",
        paddingHorizontal: 8,
    },
    coverFallback: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: "#F2F2F7",
        alignItems: "center",
        justifyContent: "center",
    },
    editCoverText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#0095F6",
        marginTop: 12,
    },
    inputSection: {
        padding: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#E5E5EA",
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
        color: "#8E8E93",
        marginBottom: 8,
    },
    input: {
        fontSize: 16,
        color: "#000",
        paddingVertical: 6,
    },
    storiesSection: {
        padding: 16,
    },
    loader: {
        marginTop: 20,
    },
    emptyStoriesWrap: {
        paddingVertical: 40,
        alignItems: "center",
    },
    emptyText: {
        fontSize: 14,
        color: "#8E8E93",
    },
    gridContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: GRID_GAP,
    },
    gridItem: {
        width: GRID_SIZE,
        height: GRID_SIZE * 1.3,
        marginBottom: GRID_GAP,
        position: "relative",
    },
    gridItemMedia: {
        width: "100%",
        height: "100%",
        backgroundColor: "#EFEFEF",
        justifyContent: "center",
        alignItems: "center",
    },
    gridItemText: {
        color: "#fff",
        fontSize: 10,
        fontWeight: "600",
        textAlign: "center",
        paddingHorizontal: 4,
    },
    checkboxContainer: {
        position: "absolute",
        top: 6,
        right: 6,
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: "#fff",
        backgroundColor: "rgba(0,0,0,0.15)",
        alignItems: "center",
        justifyContent: "center",
    },
    checkboxSelected: {
        backgroundColor: "#0095F6",
        borderColor: "#0095F6",
    },
    coverBadge: {
        position: "absolute",
        bottom: 6,
        left: 6,
        right: 6,
        backgroundColor: "rgba(0,0,0,0.65)",
        borderRadius: 4,
        paddingVertical: 2,
        alignItems: "center",
    },
    coverBadgeText: {
        color: "#fff",
        fontSize: 9,
        fontWeight: "700",
    },
    deleteButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginHorizontal: 16,
        marginTop: 20,
        paddingVertical: 12,
        backgroundColor: "#FFF0F0",
        borderWidth: 1,
        borderColor: "#FFD5D5",
        borderRadius: 8,
    },
    deleteText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#FF3B30",
    },
    coverChooserContainer: {
        flex: 1,
        padding: 16,
    },
    chooserSub: {
        fontSize: 14,
        color: "#8E8E93",
        marginBottom: 16,
    },
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
});
