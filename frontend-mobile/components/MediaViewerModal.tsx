import React from "react";
import { Ionicons } from "@expo/vector-icons";
import {
    Dimensions,
    FlatList,
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ResizeMode, Video } from "expo-av";
import { colors, spacing } from "@/constants";
import chatService from "@/services/chatService";
import { MediaViewerState } from "@/utils/messageUtils";

type Props = {
    mediaViewer: MediaViewerState | null;
    closeMediaViewer: () => void;
    onForwardImage?: (url: string) => void;
};

export function MediaViewerModal({
    mediaViewer,
    closeMediaViewer,
    onForwardImage,
}: Props) {
    const listRef = React.useRef<FlatList<string>>(null);
    const thumbnailScrollRef = React.useRef<ScrollView>(null);
    const lastTapRef = React.useRef(0);
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [scale, setScale] = React.useState(1);
    const [rotation, setRotation] = React.useState(0);
    const [loadedMap, setLoadedMap] = React.useState<Record<string, boolean>>({});
    const [viewerImages, setViewerImages] = React.useState<string[]>([]);
    const [nextCursor, setNextCursor] = React.useState<string | null>(null);
    const [hasMore, setHasMore] = React.useState(false);
    const [loadingMore, setLoadingMore] = React.useState(false);
    const imageItems = viewerImages;
    const initialIndex =
        mediaViewer?.type === "IMAGE"
            ? Math.max(0, Math.min(mediaViewer.index ?? 0, imageItems.length - 1))
            : 0;
    const screenWidth = Dimensions.get("window").width;
    const canNavigate = imageItems.length > 1;

    const mergeImages = React.useCallback((base: string[], incoming: string[]) => {
        const seen = new Set<string>();
        return [...base, ...incoming].filter((url) => {
            if (!url || seen.has(url)) return false;
            seen.add(url);
            return true;
        });
    }, []);

    const loadMoreImages = React.useCallback(
        async (cursor: string | null = nextCursor) => {
            if (
                !mediaViewer?.conversationId ||
                mediaViewer.type !== "IMAGE" ||
                loadingMore
            ) {
                return;
            }

            setLoadingMore(true);
            try {
                const response = await chatService.getConversationMedia(
                    mediaViewer.conversationId,
                    "MEDIA",
                    cursor,
                    20,
                );
                const incoming = response.items
                    .filter((item) => item.type === "IMAGE" && Boolean(item.url))
                    .map((item) => item.url);
                setViewerImages((prev) => mergeImages(prev, incoming));
                setNextCursor(response.nextCursor);
                setHasMore(response.hasMore);
            } catch {
                // Viewer should stay usable with the images already loaded.
            } finally {
                setLoadingMore(false);
            }
        },
        [
            loadingMore,
            mediaViewer?.conversationId,
            mediaViewer?.type,
            mergeImages,
            nextCursor,
        ],
    );

    React.useEffect(() => {
        if (!mediaViewer || mediaViewer.type !== "IMAGE") return;
        const initialItems =
            mediaViewer.items?.length ? mediaViewer.items : [mediaViewer.url];
        const startIndex = Math.max(
            0,
            initialItems.indexOf(mediaViewer.url) >= 0
                ? initialItems.indexOf(mediaViewer.url)
                : mediaViewer.index ?? 0,
        );
        setViewerImages(mergeImages(initialItems, [mediaViewer.url]));
        setNextCursor(null);
        setHasMore(Boolean(mediaViewer.conversationId));
        setCurrentIndex(startIndex);
        setScale(1);
        setRotation(0);
        requestAnimationFrame(() => {
            listRef.current?.scrollToIndex({
                index: startIndex,
                animated: false,
            });
        });
    }, [
        mediaViewer?.conversationId,
        mediaViewer?.index,
        mediaViewer?.items,
        mediaViewer?.type,
        mediaViewer?.url,
        mergeImages,
    ]);

    React.useEffect(() => {
        if (mediaViewer?.type !== "IMAGE") return;
        if (hasMore && currentIndex >= imageItems.length - 3) {
            void loadMoreImages(nextCursor);
        }
    }, [currentIndex, hasMore, imageItems.length, loadMoreImages, mediaViewer?.type, nextCursor]);

    React.useEffect(() => {
        thumbnailScrollRef.current?.scrollTo({
            x: Math.max(0, currentIndex * 62 - 120),
            animated: true,
        });
    }, [currentIndex]);

    const resetTransform = () => {
        setScale(1);
        setRotation(0);
    };

    const goToIndex = (index: number) => {
        if (!imageItems.length) return;
        const nextIndex = Math.max(0, Math.min(index, imageItems.length - 1));
        setCurrentIndex(nextIndex);
        resetTransform();
        listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    };

    const handleDoubleTap = () => {
        const now = Date.now();
        if (now - lastTapRef.current < 260) {
            setScale((value) => (value > 1 ? 1 : 2));
        }
        lastTapRef.current = now;
    };

    const forwardCurrentImage = () => {
        const url = imageItems[currentIndex];
        if (!url) return;
        onForwardImage?.(url);
    };

    return (
        <Modal
            visible={Boolean(mediaViewer)}
            transparent
            animationType="fade"
            onRequestClose={closeMediaViewer}
        >
            <SafeAreaView style={styles.mediaViewerOverlay} edges={["top", "right", "bottom", "left"]}>
                <Pressable
                    style={styles.mediaViewerCloseBtn}
                    onPress={closeMediaViewer}
                    hitSlop={10}
                >
                    <Ionicons name="close" size={24} color={colors.white} />
                </Pressable>

                <View style={styles.mediaViewerContent}>
                    {mediaViewer?.type === "IMAGE" ? (
                        <>
                        <View style={styles.viewerTopBar}>
                            <Text style={styles.viewerIndexText}>
                                {currentIndex + 1} / {imageItems.length}
                            </Text>
                            <View style={styles.viewerTopActions}>
                                <Pressable
                                    style={styles.viewerToolBtn}
                                    onPress={forwardCurrentImage}
                                    hitSlop={8}
                                >
                                    <Ionicons name="return-up-forward-outline" size={20} color={colors.white} />
                                </Pressable>
                            </View>
                        </View>
                        <FlatList
                            ref={listRef}
                            key={mediaViewer.url}
                            data={imageItems}
                            horizontal
                            pagingEnabled
                            initialScrollIndex={initialIndex}
                            onMomentumScrollEnd={(event) => {
                                const nextIndex = Math.round(
                                    event.nativeEvent.contentOffset.x / screenWidth,
                                );
                                if (nextIndex !== currentIndex) {
                                    setCurrentIndex(nextIndex);
                                    resetTransform();
                                }
                            }}
                            onScrollToIndexFailed={({ index }) => {
                                requestAnimationFrame(() =>
                                    listRef.current?.scrollToIndex({
                                        index,
                                        animated: false,
                                    }),
                                );
                            }}
                            getItemLayout={(_, index) => ({
                                length: screenWidth,
                                offset: screenWidth * index,
                                index,
                            })}
                            showsHorizontalScrollIndicator={false}
                            keyExtractor={(url, index) => `${url}-${index}`}
                            renderItem={({ item }) => (
                                <View style={[styles.mediaViewerPage, { width: screenWidth }]}>
                                    {!loadedMap[item] ? (
                                        <View style={styles.viewerSkeleton} />
                                    ) : null}
                                    <ScrollView
                                        style={styles.zoomScroll}
                                        contentContainerStyle={styles.zoomScrollContent}
                                        maximumZoomScale={4}
                                        minimumZoomScale={1}
                                        showsHorizontalScrollIndicator={false}
                                        showsVerticalScrollIndicator={false}
                                        centerContent
                                    >
                                        <Pressable onPress={handleDoubleTap}>
                                            <Image
                                                source={{ uri: item }}
                                                style={[
                                                    styles.mediaViewerImage,
                                                    {
                                                        width: screenWidth - spacing.md * 2,
                                                        transform: [
                                                            { scale },
                                                            { rotate: `${rotation}deg` },
                                                        ],
                                                    },
                                                ]}
                                                resizeMode="contain"
                                                onLoad={() =>
                                                    setLoadedMap((prev) => ({
                                                        ...prev,
                                                        [item]: true,
                                                    }))
                                                }
                                            />
                                        </Pressable>
                                    </ScrollView>
                                </View>
                            )}
                        />
                        {canNavigate ? (
                            <>
                                <Pressable
                                    style={[styles.navBtn, styles.navBtnLeft]}
                                    onPress={() => goToIndex(currentIndex - 1)}
                                    disabled={currentIndex <= 0}
                                >
                                    <Ionicons name="chevron-back" size={28} color={colors.white} />
                                </Pressable>
                                <Pressable
                                    style={[styles.navBtn, styles.navBtnRight]}
                                    onPress={() => goToIndex(currentIndex + 1)}
                                    disabled={currentIndex >= imageItems.length - 1}
                                >
                                    <Ionicons name="chevron-forward" size={28} color={colors.white} />
                                </Pressable>
                            </>
                        ) : null}
                        <View style={styles.viewerToolbar}>
                            <Pressable style={styles.viewerToolBtn} onPress={() => setScale((value) => Math.max(0.75, value - 0.25))}>
                                <Ionicons name="remove" size={20} color={colors.white} />
                            </Pressable>
                            <Pressable style={styles.viewerToolBtn} onPress={() => setScale((value) => Math.min(4, value + 0.25))}>
                                <Ionicons name="add" size={20} color={colors.white} />
                            </Pressable>
                            <Pressable style={styles.viewerToolBtn} onPress={resetTransform}>
                                <Ionicons name="scan-outline" size={20} color={colors.white} />
                            </Pressable>
                            <Pressable style={styles.viewerToolBtn} onPress={() => setRotation((value) => value + 90)}>
                                <Ionicons name="refresh" size={20} color={colors.white} />
                            </Pressable>
                        </View>
                        <View style={styles.thumbnailStrip}>
                            <ScrollView
                                ref={thumbnailScrollRef}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                            >
                                {imageItems.map((item, index) => (
                                    <Pressable
                                        key={`${item}-${index}-thumb`}
                                        style={[
                                            styles.thumbnailButton,
                                            index === currentIndex && styles.thumbnailButtonActive,
                                        ]}
                                        onPress={() => goToIndex(index)}
                                    >
                                        <Image source={{ uri: item }} style={styles.thumbnailImage} />
                                    </Pressable>
                                ))}
                            </ScrollView>
                            {loadingMore ? (
                                <Text style={styles.thumbnailLoading}>Đang tải thêm...</Text>
                            ) : null}
                        </View>
                        </>
                    ) : mediaViewer?.type === "VIDEO" ? (
                        <Video
                            source={{ uri: mediaViewer.url }}
                            style={styles.mediaViewerVideo}
                            useNativeControls
                            shouldPlay
                            resizeMode={ResizeMode.CONTAIN}
                        />
                    ) : null}
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    mediaViewerOverlay: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.95)",
    },
    mediaViewerCloseBtn: {
        position: "absolute",
        zIndex: 20,
        top: 28,
        right: spacing.md,
        alignSelf: "flex-end",
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255, 255, 255, 0.16)",
    },
    mediaViewerContent: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    mediaViewerPage: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 0,
    },
    mediaViewerImage: {
        height: "100%",
    },
    mediaViewerVideo: {
        width: "100%",
        height: "78%",
        backgroundColor: "#000",
    },
    viewerTopBar: {
        position: "absolute",
        top: 28,
        left: spacing.md,
        right: 56,
        zIndex: 15,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    viewerIndexText: {
        color: colors.white,
        fontSize: 14,
        fontWeight: "700",
        backgroundColor: "rgba(255, 255, 255, 0.14)",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 18,
        overflow: "hidden",
    },
    viewerTopActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    viewerToolBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255, 255, 255, 0.16)",
    },
    zoomScroll: {
        width: "100%",
        height: "100%",
    },
    zoomScrollContent: {
        flexGrow: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    viewerSkeleton: {
        position: "absolute",
        width: 96,
        height: 96,
        borderRadius: 18,
        backgroundColor: "rgba(255, 255, 255, 0.14)",
    },
    navBtn: {
        position: "absolute",
        top: "48%",
        zIndex: 12,
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.35)",
    },
    navBtnLeft: {
        left: spacing.sm,
    },
    navBtnRight: {
        right: spacing.sm,
    },
    viewerToolbar: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 82,
        zIndex: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
    },
    thumbnailStrip: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 12,
        zIndex: 14,
        paddingHorizontal: spacing.md,
    },
    thumbnailButton: {
        width: 54,
        height: 54,
        marginRight: 8,
        borderRadius: 8,
        overflow: "hidden",
        borderWidth: 2,
        borderColor: "transparent",
        opacity: 0.7,
    },
    thumbnailButtonActive: {
        borderColor: colors.white,
        opacity: 1,
    },
    thumbnailImage: {
        width: "100%",
        height: "100%",
    },
    thumbnailLoading: {
        marginTop: 8,
        color: colors.white,
        fontSize: 12,
        fontWeight: "600",
        opacity: 0.75,
    },
});
