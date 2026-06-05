import StoryMusicPickerModal from "@/components/story/StoryMusicPickerModal";
import { useAppContext } from "@/context/AppContext";
import type { MusicMetadata } from "@/services/musicService";
import { createStory, uploadStoryMediaAndGetFormat } from "@/services/storyService";
import { playAudioPreview, stopAudioPreview } from "@/services/musicService";
import { PrivacyType, TextLayer, TextLayerStyle, MusicSticker, MusicStickerStyle } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState, useRef } from "react";
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Video, ResizeMode } from "expo-av";
import { colors, spacing } from "@/constants";
import { buildS3Url } from "@/utils/s3";

const BG_GRADIENTS: readonly [string, string][] = [
    ["#7C3AED", "#EF4444"],
    ["#2563EB", "#14B8A6"],
    ["#F97316", "#FACC15"],
    ["#059669", "#84CC16"],
    ["#4F46E5", "#EC4899"],
    ["#E11D48", "#FB923C"],
    ["#1F2937", "#71717A"],
    ["#38BDF8", "#4F46E5"],
];

const privacyOptions: Array<{ value: PrivacyType; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { value: "PUBLIC", label: "Công khai", icon: "earth-outline" },
    { value: "FRIENDS", label: "Bạn bè", icon: "people-outline" },
    { value: "ONLY_ME", label: "Chỉ mình tôi", icon: "lock-closed-outline" },
];

const generateId = () => Math.random().toString(36).substring(2, 9);

export default function CreateStoryScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { currentUser } = useAppContext();

    // Editor states
    const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
    const [selectedTextId, setSelectedTextId] = useState<string | null>(null);

    const [musicSticker, setMusicSticker] = useState<MusicSticker | null>(null);
    const [musicStickerSelected, setMusicStickerSelected] = useState(false);

    // Background media states
    const [media, setMedia] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [bgOffsetX, setBgOffsetX] = useState(0);
    const [bgOffsetY, setBgOffsetY] = useState(0);
    const [bgScale, setBgScale] = useState(1);

    const [selectedBgIndex, setSelectedBgIndex] = useState(0);
    const [privacy, setPrivacy] = useState<PrivacyType>("PUBLIC");
    const [muteOriginal, setMuteOriginal] = useState(false);
    const [selectedMusic, setSelectedMusic] = useState<MusicMetadata | null>(null);
    const [musicPickerOpen, setMusicPickerOpen] = useState(false);
    const [posting, setPosting] = useState(false);

    // Layout dimensions for touch-to-drag math
    const [canvasWidth, setCanvasWidth] = useState(280);
    const [canvasHeight, setCanvasHeight] = useState(498);
    const [scrollEnabled, setScrollEnabled] = useState(true);

    // Text edit modal states
    const [textEditModalVisible, setTextEditModalVisible] = useState(false);
    const [editingTextId, setEditingTextId] = useState<string | null>(null);
    const [editingTextValue, setEditingTextValue] = useState("");
    const lastTapRef = useRef<{ id: string; time: number; baseSize?: number } | null>(null);

    // Ref to manage drag interaction coordinates
    const dragStartRef = useRef<{
        x: number;
        y: number;
        itemX: number;
        itemY: number;
        type: "text" | "music" | "background";
        id?: string;
    } | null>(null);

    // Play music when sticker added, stop when component unmounts or sticker removed
    useEffect(() => {
        if (musicSticker?.meta?.audio_url) {
            let audioPath = musicSticker.meta.audio_url;
            if (!audioPath.startsWith("http")) {
                audioPath = buildS3Url(musicSticker.meta.audio_url) || "";
            }
            if (audioPath) {
                playAudioPreview(audioPath).catch(() => {});
            }
        }
        return () => {
            stopAudioPreview().catch(() => {});
        };
    }, [musicSticker?.meta?.audio_url]);

    const isVideo = media?.type === "video";
    const canSubmit = useMemo(
        () => (textLayers.length > 0 || media !== null || musicSticker !== null) && !posting,
        [textLayers, media, musicSticker, posting]
    );

    const pickMedia = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert("Quyền truy cập", "Bạn cần cấp quyền thư viện ảnh để chọn ảnh/video.");
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images", "videos"],
            allowsEditing: false,
            quality: 0.9,
            videoMaxDuration: 60,
        });
        if (!result.canceled && result.assets[0]) {
            setMedia(result.assets[0]);
            // Reset background offsets
            setBgOffsetX(0);
            setBgOffsetY(0);
            setBgScale(1);
        }
    };

    const addTextLayer = () => {
        const id = generateId();
        const newLayer: TextLayer = {
            id,
            content: "",
            x_pct: 0.5,
            y_pct: 0.45,
            style: {
                fontSize: 24,
                fontFamily: "Arial",
                color: "#FFFFFF",
                align: "center",
                rotation: 0,
                bold: true,
                shadow: true,
            },
            z_index: textLayers.length + 1,
        };
        setTextLayers(prev => [...prev, newLayer]);
        setSelectedTextId(id);
        setMusicStickerSelected(false);

        // Open editing modal directly
        setEditingTextId(id);
        setEditingTextValue("");
        setTextEditModalVisible(true);
    };

    const selectedTextLayer = textLayers.find(l => l.id === selectedTextId);

    const updateTextLayerStyle = (updatedStyle: Partial<TextLayerStyle>) => {
        if (!selectedTextId) return;
        setTextLayers(prev => prev.map(l => l.id === selectedTextId ? {
            ...l,
            style: { ...l.style, ...updatedStyle }
        } : l));
    };

    const updateFontSize = (amount: number) => {
        if (!selectedTextLayer) return;
        const currentSize = selectedTextLayer.style.fontSize;
        const nextSize = Math.max(12, Math.min(60, currentSize + amount));
        updateTextLayerStyle({ fontSize: nextSize });
    };

    const cycleAlignment = () => {
        if (!selectedTextLayer) return;
        const current = selectedTextLayer.style.align;
        const aligns: Array<"left" | "center" | "right"> = ["left", "center", "right"];
        const next = aligns[(aligns.indexOf(current) + 1) % aligns.length];
        updateTextLayerStyle({ align: next });
    };

    const handlePost = async () => {
        if (!canSubmit) return;
        setPosting(true);
        try {
            let mediaUrls: string[] = [];
            if (media) {
                const name = media.fileName || media.uri.split("/").pop() || `story-${Date.now()}.${isVideo ? "mp4" : "jpg"}`;
                const type = media.mimeType || (isVideo ? "video/mp4" : "image/jpeg");
                const key = await uploadStoryMediaAndGetFormat({ uri: media.uri, name, type });
                mediaUrls = [key];
            }

            // Build fallback content text
            const joinedText = textLayers.map(l => l.content.trim()).filter(Boolean).join("\n");
            const textPayload = joinedText
                ? `${joinedText}${!media ? ` [bg:${selectedBgIndex}]` : ""}`
                : !media
                  ? `[bg:${selectedBgIndex}]`
                  : undefined;

            // Map and prepare structures to exact backend expectation
            const preparedTextLayers = textLayers.map(layer => ({
                id: layer.id,
                content: layer.content,
                x_pct: layer.x_pct,
                y_pct: layer.y_pct,
                z_index: layer.z_index,
                style: {
                    fontSize: layer.style.fontSize,
                    fontFamily: layer.style.fontFamily,
                    color: layer.style.color,
                    align: layer.style.align,
                    rotation: layer.style.rotation || 0,
                    bold: layer.style.bold,
                    shadow: layer.style.shadow,
                }
            }));

            const preparedMusicStickers = musicSticker ? [{
                id: musicSticker.id,
                x_pct: musicSticker.x_pct,
                y_pct: musicSticker.y_pct,
                rotation_deg: musicSticker.rotation_deg || 0,
                style: musicSticker.style || "rectangle",
                z_index: musicSticker.z_index,
                meta: {
                    track_id: musicSticker.meta.track_id,
                    title: musicSticker.meta.title,
                    artist: musicSticker.meta.artist,
                    cover_url: musicSticker.meta.cover_url,
                }
            }] : [];

            await createStory({
                content: textPayload,
                privacy,
                mediaUrls,
                musicId: selectedMusic?.id,
                musicStartTime: selectedMusic ? 0 : undefined,
                muteOriginal,
                textLayers: preparedTextLayers,
                musicStickers: preparedMusicStickers,
            });
            router.back();
        } catch (error: any) {
            Alert.alert("Lỗi", error?.response?.data?.message || error?.message || "Không thể tạo story");
        } finally {
            setPosting(false);
        }
    };

    const renderMusicStickerContent = (sticker: MusicSticker) => {
        const title = sticker.meta.title;
        const artist = sticker.meta.artist;
        const coverUrl = sticker.meta.cover_url ? buildS3Url(sticker.meta.cover_url) : null;
        const style = sticker.style || "rectangle";

        if (style === "compact") {
            return (
                <View style={styles.compactSticker}>
                    <Ionicons name="musical-notes" size={14} color={colors.white} />
                    <View style={styles.compactTextWrap}>
                        <Text numberOfLines={1} style={styles.compactTitle}>{title}</Text>
                        <Text numberOfLines={1} style={styles.compactArtist}>{artist}</Text>
                    </View>
                </View>
            );
        }
        if (style === "square") {
            return (
                <View style={styles.squareSticker}>
                    {coverUrl ? (
                        <Image source={{ uri: coverUrl }} style={styles.squareImage} />
                    ) : (
                        <View style={styles.squarePlaceholder}><Text style={{ color: "#fff" }}>♪</Text></View>
                    )}
                    <Text numberOfLines={1} style={styles.squareTitle}>{title}</Text>
                </View>
            );
        }
        if (style === "vinyl") {
            return (
                <View style={styles.vinylSticker}>
                    <View style={styles.vinylDisc}>
                        {coverUrl ? (
                            <Image source={{ uri: coverUrl }} style={styles.vinylImage} />
                        ) : (
                            <View style={styles.vinylPlaceholder}><Text style={{ color: "#fff" }}>♪</Text></View>
                        )}
                    </View>
                    <Text numberOfLines={1} style={styles.vinylTitle}>{title}</Text>
                </View>
            );
        }
        if (style === "hidden") {
            return (
                <View style={styles.hiddenSticker}>
                    <Ionicons name="volume-medium" size={16} color={colors.white} />
                    <Text style={styles.hiddenText}>Nhạc nền</Text>
                </View>
            );
        }

        // Default rectangle style
        return (
            <View style={styles.rectangleSticker}>
                {coverUrl ? (
                    <Image source={{ uri: coverUrl }} style={styles.rectangleImage} />
                ) : (
                    <View style={styles.rectanglePlaceholder}><Text style={{ color: "#fff" }}>♪</Text></View>
                )}
                <View style={styles.rectangleTextWrap}>
                    <Text numberOfLines={1} style={styles.rectangleTitle}>{title}</Text>
                    <Text numberOfLines={1} style={styles.rectangleArtist}>{artist}</Text>
                </View>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView style={[styles.container, { paddingTop: insets.top }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <Ionicons name="close" size={24} color={colors.white} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Tạo tin</Text>
                <TouchableOpacity style={[styles.shareButton, !canSubmit && styles.shareButtonDisabled]} disabled={!canSubmit} onPress={handlePost}>
                    <Text style={[styles.shareText, !canSubmit && styles.shareTextDisabled]}>{posting ? "Đang chia sẻ..." : "Chia sẻ"}</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                scrollEnabled={scrollEnabled}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Drag-and-drop interactive preview frame */}
                <View 
                    style={styles.previewFrame}
                    onLayout={(e) => {
                        const { width, height } = e.nativeEvent.layout;
                        setCanvasWidth(width);
                        setCanvasHeight(height);
                    }}
                >
                    {media ? (
                        isVideo ? (
                            <Video 
                                source={{ uri: media.uri }} 
                                style={[
                                    styles.previewMedia,
                                    {
                                        transform: [
                                            { translateX: bgOffsetX },
                                            { translateY: bgOffsetY },
                                            { scale: bgScale }
                                        ]
                                    }
                                ]} 
                                resizeMode={ResizeMode.COVER} 
                                shouldPlay 
                                isLooping 
                                isMuted={muteOriginal} 
                            />
                        ) : (
                            <Image 
                                source={{ uri: media.uri }} 
                                style={[
                                    styles.previewMedia,
                                    {
                                        transform: [
                                            { translateX: bgOffsetX },
                                            { translateY: bgOffsetY },
                                            { scale: bgScale }
                                        ]
                                    }
                                ]} 
                                resizeMode="cover" 
                            />
                        )
                    ) : (
                        <LinearGradient colors={BG_GRADIENTS[selectedBgIndex]} style={styles.previewMedia} />
                    )}

                    {/* Touch overlay to drag background media */}
                    {media && (
                        <View 
                            style={StyleSheet.absoluteFill}
                            onTouchStart={(e) => {
                                setScrollEnabled(false);
                                dragStartRef.current = {
                                    x: e.nativeEvent.pageX,
                                    y: e.nativeEvent.pageY,
                                    itemX: bgOffsetX,
                                    itemY: bgOffsetY,
                                    type: "background"
                                };
                            }}
                            onTouchMove={(e) => {
                                if (dragStartRef.current?.type === "background") {
                                    const dx = e.nativeEvent.pageX - dragStartRef.current.x;
                                    const dy = e.nativeEvent.pageY - dragStartRef.current.y;
                                    setBgOffsetX(dragStartRef.current.itemX + dx);
                                    setBgOffsetY(dragStartRef.current.itemY + dy);
                                }
                            }}
                            onTouchEnd={() => setScrollEnabled(true)}
                            onTouchCancel={() => setScrollEnabled(true)}
                        />
                    )}

                    {/* Draggable Text Layers */}
                    {textLayers.map((layer) => {
                        const isSelected = selectedTextId === layer.id;

                        return (
                            <View
                                key={layer.id}
                                style={[
                                    styles.textLayerWrapper,
                                    {
                                        left: `${layer.x_pct * 100}%`,
                                        top: `${layer.y_pct * 100}%`,
                                    },
                                    isSelected && styles.layerSelectedBorder
                                ]}
                                onTouchStart={(e) => {
                                    e.stopPropagation(); // Prevent background drag trigger
                                    setScrollEnabled(false);
                                    dragStartRef.current = {
                                        x: e.nativeEvent.pageX,
                                        y: e.nativeEvent.pageY,
                                        itemX: layer.x_pct,
                                        itemY: layer.y_pct,
                                        type: "text",
                                        id: layer.id
                                    };
                                    setSelectedTextId(layer.id);
                                    setMusicStickerSelected(false);

                                    // Double tap detection
                                    const now = Date.now();
                                    if (lastTapRef.current && lastTapRef.current.id === layer.id && (now - lastTapRef.current.time) < 300) {
                                        setEditingTextId(layer.id);
                                        setEditingTextValue(layer.content);
                                        setTextEditModalVisible(true);
                                        lastTapRef.current = null;
                                    } else {
                                        lastTapRef.current = { id: layer.id, time: now };
                                    }
                                }}
                                onTouchMove={(e) => {
                                    e.stopPropagation();
                                    if (dragStartRef.current?.id === layer.id) {
                                        const dx = e.nativeEvent.pageX - dragStartRef.current.x;
                                        const dy = e.nativeEvent.pageY - dragStartRef.current.y;
                                        // Keep coordinates relative inside the frame boundary
                                        const newX = Math.max(0.05, Math.min(0.95, dragStartRef.current.itemX + dx / canvasWidth));
                                        const newY = Math.max(0.05, Math.min(0.95, dragStartRef.current.itemY + dy / canvasHeight));
                                        setTextLayers(prev => prev.map(l => l.id === layer.id ? { ...l, x_pct: newX, y_pct: newY } : l));
                                    }
                                }}
                                onTouchEnd={(e) => {
                                    e.stopPropagation();
                                    setScrollEnabled(true);
                                }}
                                onTouchCancel={(e) => {
                                    e.stopPropagation();
                                    setScrollEnabled(true);
                                }}
                            >
                                <Text
                                    style={[
                                        styles.textLayerText,
                                        {
                                            color: layer.style.color,
                                            fontSize: layer.style.fontSize,
                                            fontFamily: layer.style.fontFamily,
                                            fontWeight: layer.style.bold ? "bold" : "normal",
                                            textAlign: layer.style.align,
                                        },
                                        layer.style.shadow && styles.textShadow
                                    ]}
                                >
                                    {layer.content}
                                </Text>
                            </View>
                        );
                    })}

                    {/* Draggable Music Sticker */}
                    {musicSticker && (
                        <View
                            style={[
                                styles.musicStickerWrapper,
                                {
                                    left: `${musicSticker.x_pct * 100}%`,
                                    top: `${musicSticker.y_pct * 100}%`,
                                },
                                musicStickerSelected && styles.layerSelectedBorder
                            ]}
                            onTouchStart={(e) => {
                                e.stopPropagation(); // Prevent background drag trigger
                                setScrollEnabled(false);
                                dragStartRef.current = {
                                    x: e.nativeEvent.pageX,
                                    y: e.nativeEvent.pageY,
                                    itemX: musicSticker.x_pct,
                                    itemY: musicSticker.y_pct,
                                    type: "music",
                                    id: musicSticker.id
                                };
                                setMusicStickerSelected(true);
                                setSelectedTextId(null);
                            }}
                            onTouchMove={(e) => {
                                e.stopPropagation();
                                if (dragStartRef.current?.id === musicSticker.id) {
                                    const dx = e.nativeEvent.pageX - dragStartRef.current.x;
                                    const dy = e.nativeEvent.pageY - dragStartRef.current.y;
                                    const newX = Math.max(0.05, Math.min(0.95, dragStartRef.current.itemX + dx / canvasWidth));
                                    const newY = Math.max(0.05, Math.min(0.95, dragStartRef.current.itemY + dy / canvasHeight));
                                    setMusicSticker(prev => prev ? { ...prev, x_pct: newX, y_pct: newY } : null);
                                }
                            }}
                            onTouchEnd={(e) => {
                                e.stopPropagation();
                                setScrollEnabled(true);
                            }}
                            onTouchCancel={(e) => {
                                e.stopPropagation();
                                setScrollEnabled(true);
                            }}
                        >
                            {renderMusicStickerContent(musicSticker)}
                        </View>
                    )}

                    <View style={styles.userChip}>
                        <Text style={styles.userChipText}>{currentUser?.username || "Tin của bạn"}</Text>
                    </View>
                </View>

                {/* Background Zoom Controls */}
                {media && (
                    <View style={styles.zoomPanel}>
                        <Text style={styles.zoomLabel}>Vị trí & Tỷ lệ Ảnh/Video</Text>
                        <View style={styles.zoomRow}>
                            <TouchableOpacity onPress={() => setBgScale(prev => Math.max(0.5, prev - 0.1))} style={styles.zoomBtn}>
                                <Ionicons name="remove-circle-outline" size={20} color={colors.white} />
                            </TouchableOpacity>
                            <Text style={styles.zoomValue}>{Math.round(bgScale * 100)}%</Text>
                            <TouchableOpacity onPress={() => setBgScale(prev => Math.min(3, prev + 0.1))} style={styles.zoomBtn}>
                                <Ionicons name="add-circle-outline" size={20} color={colors.white} />
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => {
                                    setBgOffsetX(0);
                                    setBgOffsetY(0);
                                    setBgScale(1);
                                }} 
                                style={styles.resetBtn}
                            >
                                <Text style={styles.resetBtnText}>Đặt lại</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Quick Editor Actions */}
                <View style={styles.quickBar}>
                    <TouchableOpacity style={styles.quickBtn} onPress={addTextLayer}>
                        <Ionicons name="text-outline" size={18} color={colors.white} />
                        <Text style={styles.quickBtnText}>Thêm chữ</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickBtn} onPress={() => setMusicPickerOpen(true)}>
                        <Ionicons name="musical-notes-outline" size={18} color={colors.white} />
                        <Text style={styles.quickBtnText}>Thêm nhạc</Text>
                    </TouchableOpacity>
                </View>

                {/* Text Layer Formatting Styles Panel */}
                {selectedTextLayer && (
                    <View style={[styles.panel, { borderColor: "rgba(96,165,250,0.5)" }]}>
                        <Text style={styles.label}>Nội dung văn bản</Text>
                        <TextInput
                            style={styles.textLayerInput}
                            value={selectedTextLayer.content}
                            onChangeText={(txt) => {
                                setTextLayers(prev => prev.map(l => l.id === selectedTextId ? { ...l, content: txt } : l));
                            }}
                            placeholder="Nhập nội dung chữ..."
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            multiline
                        />
                        
                        <Text style={[styles.label, { marginTop: 10 }]}>Định dạng chữ</Text>
                        <View style={styles.rowControls}>
                            <TouchableOpacity onPress={() => updateFontSize(-2)} style={styles.sizeBtn}>
                                <Text style={styles.btnText}>A-</Text>
                            </TouchableOpacity>
                            <Text style={styles.sizeVal}>{selectedTextLayer.style.fontSize}px</Text>
                            <TouchableOpacity onPress={() => updateFontSize(2)} style={styles.sizeBtn}>
                                <Text style={styles.btnText}>A+</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={() => updateTextLayerStyle({ bold: !selectedTextLayer.style.bold } as Partial<TextLayerStyle>)}
                                style={[styles.styleBtn, selectedTextLayer.style.bold && styles.styleBtnActive]}
                            >
                                <Text style={{ color: colors.white, fontWeight: "bold", fontSize: 12 }}>B</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={cycleAlignment}
                                style={[styles.styleBtn, { width: 44 }]}
                            >
                                <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "bold" }}>
                                    {selectedTextLayer.style.align === "left" 
                                        ? "Trái" 
                                        : selectedTextLayer.style.align === "right" 
                                        ? "Phải" 
                                        : "Giữa"}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={[styles.label, { marginTop: 10 }]}>Màu sắc</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorRow}>
                            {["#FFFFFF", "#000000", "#FF3B30", "#FF9500", "#FFCC00", "#4CD964", "#5AC8FA", "#007AFF", "#5856D6", "#FF2D55"].map((c) => (
                                <TouchableOpacity 
                                    key={c} 
                                    onPress={() => updateTextLayerStyle({ color: c })}
                                    style={[
                                        styles.colorDot, 
                                        { backgroundColor: c },
                                        selectedTextLayer.style.color === c && styles.colorDotActive
                                    ]} 
                                />
                            ))}
                        </ScrollView>

                        <TouchableOpacity 
                            style={styles.deleteLayerBtn} 
                            onPress={() => {
                                setTextLayers(prev => prev.filter(l => l.id !== selectedTextId));
                                setSelectedTextId(null);
                            }}
                        >
                            <Ionicons name="trash-outline" size={16} color="#F87171" />
                            <Text style={styles.deleteLayerText}>Xóa chữ</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Music Sticker Styling Options */}
                {musicStickerSelected && musicSticker && (
                    <View style={[styles.panel, { borderColor: "rgba(168,85,247,0.5)" }]}>
                        <Text style={styles.label}>Tùy chỉnh nhãn nhạc</Text>
                        <View style={styles.musicStickerPreview}>
                            <Text style={styles.musicStickerTitle} numberOfLines={1}>{musicSticker.meta.title}</Text>
                            <Text style={styles.musicStickerArtist} numberOfLines={1}>{musicSticker.meta.artist}</Text>
                        </View>
                        
                        <Text style={[styles.label, { marginTop: 10 }]}>Kiểu hiển thị</Text>
                        <View style={styles.styleGrid}>
                            {(["rectangle", "compact", "square", "vinyl", "hidden"] as MusicStickerStyle[]).map((styleOpt) => (
                                <TouchableOpacity 
                                    key={styleOpt}
                                    onPress={() => {
                                        setMusicSticker(prev => prev ? { ...prev, style: styleOpt } : null);
                                    }}
                                    style={[styles.styleOptionBtn, musicSticker.style === styleOpt && styles.styleOptionBtnActive]}
                                >
                                    <Text style={[styles.styleOptionText, musicSticker.style === styleOpt && styles.styleOptionTextActive]}>{styleOpt}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity 
                            style={styles.deleteLayerBtn} 
                            onPress={() => {
                                setMusicSticker(null);
                                setSelectedMusic(null);
                                setMusicStickerSelected(false);
                            }}
                        >
                            <Ionicons name="close-circle-outline" size={16} color="#F87171" />
                            <Text style={styles.deleteLayerText}>Gỡ nhạc nền</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Background Gradient Chooser */}
                {!media && (
                    <View style={styles.panel}>
                        <Text style={styles.label}>Màu Nền</Text>
                        <View style={styles.gradientRow}>
                            {BG_GRADIENTS.map((gradient, index) => (
                                <TouchableOpacity key={index} onPress={() => setSelectedBgIndex(index)} style={[styles.gradientDotWrap, selectedBgIndex === index && styles.gradientDotActive]}>
                                    <LinearGradient colors={gradient} style={styles.gradientDot} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* Media Picker Section */}
                <View style={styles.panel}>
                    <Text style={styles.label}>Ảnh / Video</Text>
                    <TouchableOpacity style={styles.mediaButton} onPress={pickMedia} disabled={posting}>
                        <Ionicons name="image-outline" size={20} color={colors.white} />
                        <Text style={styles.mediaButtonText}>{media ? media.fileName || "Thay thế ảnh/video" : "Tải lên ảnh hoặc video"}</Text>
                    </TouchableOpacity>
                    {media ? (
                        <TouchableOpacity style={styles.removeMediaButton} onPress={() => {
                            setMedia(null);
                            setBgOffsetX(0);
                            setBgOffsetY(0);
                            setBgScale(1);
                        }}>
                            <Ionicons name="trash-outline" size={16} color="#F87171" />
                            <Text style={styles.removeMediaText}>Gỡ media nền</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>

                {/* Video original sound control */}
                {isVideo && (
                    <View style={styles.panel}>
                        <View style={styles.settingRow}>
                            <Text style={styles.settingText}>Tắt tiếng video gốc</Text>
                            <Switch value={muteOriginal} onValueChange={setMuteOriginal} />
                        </View>
                    </View>
                )}

                {/* Privacy Option List */}
                <View style={styles.panel}>
                    <Text style={styles.label}>Quyền riêng tư</Text>
                    {privacyOptions.map((item) => {
                        const active = privacy === item.value;
                        return (
                            <TouchableOpacity key={item.value} style={[styles.optionRow, active && styles.optionRowActive]} onPress={() => setPrivacy(item.value)}>
                                <Ionicons name={item.icon} size={19} color={active ? "#60A5FA" : colors.white} />
                                <Text style={styles.optionText}>{item.label}</Text>
                                {active ? <View style={styles.selectedDot} /> : null}
                            </TouchableOpacity>
                        );
                    })}
                </View>

            </ScrollView>

            <StoryMusicPickerModal
                visible={musicPickerOpen}
                onClose={() => setMusicPickerOpen(false)}
                onSelect={(music) => {
                    setSelectedMusic(music);
                    setMusicPickerOpen(false);
                    // Add new music sticker
                    const id = generateId();
                    const newSticker: MusicSticker = {
                        id,
                        x_pct: 0.5,
                        y_pct: 0.35,
                        width_pct: 0.7,
                        height_pct: 0.12,
                        rotation_deg: 0,
                        style: "rectangle",
                        meta: {
                            track_id: String(music.id),
                            title: music.title,
                            artist: music.artist,
                            cover_url: music.imageUrl || "",
                            audio_url: music.audioUrl || "",
                        },
                        z_index: 10,
                    };
                    setMusicSticker(newSticker);
                    setMusicStickerSelected(true);
                    setSelectedTextId(null);
                    // Stop any preview audio from modal when selecting
                    stopAudioPreview();
                    // Note: Music will play when story is viewed in StoryViewer, not here
                }}
            />

            {/* Modal to edit text layer in fullscreen with autoFocus */}
            <Modal
                visible={textEditModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => {
                    // Delete the layer if empty on close
                    if (editingTextId) {
                        const target = textLayers.find(l => l.id === editingTextId);
                        if (target && !target.content) {
                            setTextLayers(prev => prev.filter(l => l.id !== editingTextId));
                            setSelectedTextId(null);
                        }
                    }
                    setTextEditModalVisible(false);
                }}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.textEditModalContainer}
                >
                    <View style={styles.textEditHeader}>
                        <TouchableOpacity 
                            onPress={() => {
                                // Delete new layer if canceling empty content
                                if (editingTextId) {
                                    const target = textLayers.find(l => l.id === editingTextId);
                                    if (target && !target.content) {
                                        setTextLayers(prev => prev.filter(l => l.id !== editingTextId));
                                        setSelectedTextId(null);
                                    }
                                }
                                setTextEditModalVisible(false);
                            }}
                            style={styles.textEditHeaderBtn}
                        >
                            <Text style={styles.textEditCancelText}>Hủy</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={() => {
                                if (editingTextId) {
                                    const trimmed = editingTextValue.trim();
                                    if (!trimmed) {
                                        setTextLayers(prev => prev.filter(l => l.id !== editingTextId));
                                        setSelectedTextId(null);
                                    } else {
                                        setTextLayers(prev => prev.map(l => l.id === editingTextId ? { ...l, content: trimmed } : l));
                                    }
                                }
                                setTextEditModalVisible(false);
                            }}
                            style={styles.textEditSaveBtn}
                        >
                            <Text style={styles.textEditSaveText}>Xong</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.textEditInputContainer}>
                        <TextInput
                            style={styles.textEditBigInput}
                            value={editingTextValue}
                            onChangeText={setEditingTextValue}
                            placeholder="Nhập chữ..."
                            placeholderTextColor="rgba(255, 255, 255, 0.4)"
                            multiline
                            autoFocus
                            maxLength={150}
                        />
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#111111" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
    headerBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" },
    headerTitle: { color: colors.white, fontSize: 16, fontWeight: "800" },
    shareButton: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.primary },
    shareButtonDisabled: { backgroundColor: "rgba(255,255,255,0.1)" },
    shareText: { color: colors.white, fontSize: 13, fontWeight: "800" },
    shareTextDisabled: { color: "rgba(255,255,255,0.35)" },
    content: { padding: spacing.md, paddingBottom: 40 },
    previewFrame: { alignSelf: "center", width: "78%", maxWidth: 340, aspectRatio: 9 / 16, borderRadius: 24, overflow: "hidden", backgroundColor: "#09090B", marginBottom: spacing.sm, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", position: "relative" },
    previewMedia: { flex: 1, alignItems: "center", justifyContent: "center" },
    
    // Zoom control panel
    zoomPanel: { alignSelf: "center", width: "78%", backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 8, marginBottom: spacing.md, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
    zoomLabel: { color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: "700", textAlign: "center", marginBottom: 6 },
    zoomRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
    zoomBtn: { padding: 4 },
    zoomValue: { color: "#FFF", fontSize: 12, fontWeight: "800", minWidth: 40, textAlign: "center" },
    resetBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.15)" },
    resetBtnText: { color: "#FFF", fontSize: 10, fontWeight: "700" },

    // Quick Action Bar
    quickBar: { flexDirection: "row", justifyContent: "center", gap: 16, marginBottom: spacing.md },
    quickBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.12)" },
    quickBtnText: { color: colors.white, fontSize: 12, fontWeight: "700" },

    // Draggable Wrapper positioning (using absolute top/left percentage)
    textLayerWrapper: {
        position: "absolute",
        transform: [{ translateX: -90 }, { translateY: -20 }],
        width: 180,
        alignItems: "stretch",
        justifyContent: "center",
        padding: 4,
        borderRadius: 6,
    },
    textLayerText: {
        color: "#FFF",
        fontWeight: "bold",
        textAlignVertical: "center",
    },
    textShadow: {
        textShadowColor: "rgba(0,0,0,0.85)",
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    layerSelectedBorder: {
        borderWidth: 1,
        borderColor: "#60A5FA",
        borderStyle: "dashed",
        backgroundColor: "rgba(96,165,250,0.18)",
    },

    musicStickerWrapper: {
        position: "absolute",
        transform: [{ translateX: -100 }, { translateY: -28 }],
        width: 200,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
        overflow: "hidden",
    },

    // Music sticker shapes styling
    rectangleSticker: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.65)",
        borderRadius: 12,
        padding: 8,
        gap: 8,
        width: "100%",
    },
    rectangleImage: {
        width: 32,
        height: 32,
        borderRadius: 6,
    },
    rectanglePlaceholder: {
        width: 32,
        height: 32,
        borderRadius: 6,
        backgroundColor: "rgba(255,255,255,0.2)",
        alignItems: "center",
        justifyContent: "center",
    },
    rectangleTextWrap: {
        flex: 1,
    },
    rectangleTitle: {
        color: "#FFF",
        fontSize: 11,
        fontWeight: "bold",
    },
    rectangleArtist: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 9,
    },
    
    compactSticker: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.65)",
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 6,
        gap: 6,
    },
    compactTextWrap: {
        maxWidth: 120,
    },
    compactTitle: {
        color: "#FFF",
        fontSize: 10,
        fontWeight: "bold",
    },
    compactArtist: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 8,
    },

    squareSticker: {
        backgroundColor: "rgba(0,0,0,0.65)",
        borderRadius: 12,
        padding: 8,
        alignItems: "center",
        gap: 6,
        width: 90,
    },
    squareImage: {
        width: 74,
        height: 74,
        borderRadius: 6,
    },
    squarePlaceholder: {
        width: 74,
        height: 74,
        borderRadius: 6,
        backgroundColor: "rgba(255,255,255,0.2)",
        alignItems: "center",
        justifyContent: "center",
    },
    squareTitle: {
        color: "#FFF",
        fontSize: 9,
        fontWeight: "bold",
        textAlign: "center",
        width: "100%",
    },

    vinylSticker: {
        backgroundColor: "rgba(0,0,0,0.65)",
        borderRadius: 12,
        padding: 8,
        alignItems: "center",
        gap: 6,
        width: 90,
    },
    vinylDisc: {
        width: 74,
        height: 74,
        borderRadius: 37,
        backgroundColor: "#000",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: "#333",
    },
    vinylImage: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    vinylPlaceholder: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.2)",
        alignItems: "center",
        justifyContent: "center",
    },
    vinylTitle: {
        color: "#FFF",
        fontSize: 9,
        fontWeight: "bold",
        textAlign: "center",
        width: "100%",
    },

    hiddenSticker: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.45)",
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 4,
        gap: 4,
    },
    hiddenText: {
        color: "rgba(255,255,255,0.8)",
        fontSize: 9,
    },

    userChip: { position: "absolute", top: 14, left: 14, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.45)" },
    userChipText: { color: colors.white, fontSize: 11, fontWeight: "800" },

    // Panels & inputs
    panel: { padding: 14, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.06)", marginBottom: spacing.md, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
    label: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: "800", textTransform: "uppercase", marginBottom: 10 },
    
    textLayerInput: { color: colors.white, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10, padding: 10, fontSize: 14, minHeight: 48, textAlignVertical: "top" },
    rowControls: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
    sizeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
    btnText: { color: "#FFF", fontSize: 12, fontWeight: "bold" },
    sizeVal: { color: "#FFF", fontSize: 13, minWidth: 44, textAlign: "center" },
    styleBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
    styleBtnActive: { backgroundColor: "#60A5FA" },
    colorRow: { gap: 10, paddingVertical: 4 },
    colorDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: "transparent" },
    colorDotActive: { borderColor: "#60A5FA" },
    deleteLayerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 14, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
    deleteLayerText: { color: "#F87171", fontSize: 12, fontWeight: "bold" },

    // Music sticker styling controls
    musicStickerPreview: { padding: 12, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10, marginBottom: 10 },
    musicStickerTitle: { color: "#FFF", fontSize: 13, fontWeight: "bold" },
    musicStickerArtist: { color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 2 },
    styleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    styleOptionBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "transparent" },
    styleOptionBtnActive: { backgroundColor: "rgba(168,85,247,0.2)", borderColor: "rgba(168,85,247,0.5)" },
    styleOptionText: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "700" },
    styleOptionTextActive: { color: "#D8B4FE" },

    gradientRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    gradientDotWrap: { padding: 3, borderRadius: 999, borderWidth: 2, borderColor: "transparent" },
    gradientDotActive: { borderColor: "#60A5FA" },
    gradientDot: { width: 36, height: 36, borderRadius: 18 },
    mediaButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.24)", backgroundColor: "rgba(255,255,255,0.06)" },
    mediaButtonText: { color: colors.white, fontWeight: "700", flexShrink: 1 },
    removeMediaButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10, padding: 10 },
    removeMediaText: { color: "#F87171", fontWeight: "700" },
    optionRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.05)", marginBottom: 8 },
    optionRowActive: { backgroundColor: "rgba(59,130,246,0.16)", borderWidth: 1, borderColor: "rgba(96,165,250,0.5)" },
    optionText: { color: colors.white, fontWeight: "700", flex: 1 },
    selectedDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#60A5FA" },
    settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, gap: 12 },
    settingText: { color: colors.white, fontSize: 14, fontWeight: "600", flex: 1 },

    // Text edit modal
    textEditModalContainer: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.88)",
        paddingTop: Platform.OS === "ios" ? 50 : 20,
    },
    textEditHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        height: 60,
    },
    textEditHeaderBtn: {
        padding: 10,
    },
    textEditCancelText: {
        color: "#FFF",
        fontSize: 16,
        fontWeight: "600",
    },
    textEditSaveBtn: {
        backgroundColor: colors.primary,
        paddingHorizontal: 18,
        paddingVertical: 8,
        borderRadius: 20,
    },
    textEditSaveText: {
        color: "#FFF",
        fontSize: 14,
        fontWeight: "bold",
    },
    textEditInputContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 24,
    },
    textEditBigInput: {
        color: "#FFF",
        fontSize: 26,
        fontWeight: "bold",
        textAlign: "center",
        width: "100%",
        maxHeight: 250,
    },
});
