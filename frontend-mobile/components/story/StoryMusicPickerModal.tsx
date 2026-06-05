import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { colors, spacing } from "@/constants";
import {
    formatDuration,
    getAllMusic,
    playAudioPreview,
    resolveMusicMediaUrl,
    searchMusicByTitle,
    stopAudioPreview,
} from "@/services/musicService";
import type { MusicMetadata } from "@/services/musicService";

const SEARCH_DEBOUNCE_MS = 300;

type ModalRequestClose = NonNullable<ComponentProps<typeof Modal>["onRequestClose"]>;

type Props = {
    visible: boolean;
    onClose: () => void;
    onSelect: (music: MusicMetadata) => void;
};

export default function StoryMusicPickerModal({ visible, onClose, onSelect }: Props) {
    const [query, setQuery] = useState("");
    const [tracks, setTracks] = useState<MusicMetadata[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(0);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const flatListRef = useRef<FlatList>(null);

    const loadTracks = useCallback(async (resetPage = false) => {
        const currentPage = resetPage ? 0 : page;
        const isSearch = query.trim().length > 0;

        if (resetPage) {
            setPage(0);
            setHasMore(true);
        }

        if (currentPage === 0) {
            setLoading(true);
        } else {
            setLoadingMore(true);
        }

        try {
            let result: { tracks: MusicMetadata[]; hasMore: boolean };

            if (isSearch) {
                result = await searchMusicByTitle(query.trim(), currentPage, 20);
            } else {
                result = await getAllMusic(currentPage, 20);
            }

            if (currentPage === 0) {
                setTracks(result.tracks);
            } else {
                setTracks(prev => [...prev, ...result.tracks]);
            }
            setHasMore(result.hasMore);
            setPage(currentPage + 1);
        } catch (error) {
            console.error("Error loading music:", error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [query, page]);

    const handleLoadMore = () => {
        if (!loadingMore && hasMore) {
            loadTracks(false);
        }
    };

    useEffect(() => {
        if (!visible) return;

        const timeout = setTimeout(() => {
            void loadTracks(true);
        }, 0);

        return () => clearTimeout(timeout);
    }, [visible, query]);

    useEffect(() => {
        if (!visible) return;

        setQuery("");
        setPlayingId(null);
        setTracks([]);
        setPage(0);
        setHasMore(true);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            void stopAudioPreview();
        };
    }, [visible]);

    const togglePlay = async (track: MusicMetadata) => {
        if (playingId === track.id) {
            await stopAudioPreview();
            setPlayingId(null);
            return;
        }
        await stopAudioPreview();
        const audioUrl = resolveMusicMediaUrl(track.audioUrl);
        if (!audioUrl) return;
        await playAudioPreview(audioUrl, { onEnded: () => setPlayingId(null) });
        setPlayingId(track.id);
    };

    const handleSelect = async (track: MusicMetadata) => {
        // Keep audio playing when adding to story
        setPlayingId(null);
        onSelect(track);
    };

    const handleClose = useCallback<ModalRequestClose>(() => {
        void stopAudioPreview();
        setPlayingId(null);
        onClose();
    }, [onClose]);

    const handleSearch = (text: string) => {
        setQuery(text);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            void loadTracks(true);
        }, SEARCH_DEBOUNCE_MS);
    };

    const renderTrack = ({ item }: { item: MusicMetadata }) => {
        const isPlaying = playingId === item.id;
        return (
            <TouchableOpacity
                style={[styles.trackRow, isPlaying && styles.trackRowActive]}
                onPress={() => handleSelect(item)}
            >
                <View style={styles.coverWrap}>
                    {item.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} style={styles.coverImage} />
                    ) : (
                        <View style={styles.coverFallback}>
                            <Text style={styles.coverFallbackText}>♪</Text>
                        </View>
                    )}
                </View>
                <View style={styles.trackInfo}>
                    <Text style={styles.trackTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.trackArtist} numberOfLines={1}>{item.artist}</Text>
                    <Text style={styles.trackDuration}>{formatDuration(item.duration)}</Text>
                </View>
                <TouchableOpacity
                    style={[styles.playButton, isPlaying && styles.playButtonActive]}
                    onPress={() => togglePlay(item)}
                >
                    <Ionicons name={isPlaying ? "pause" : "play"} size={15} color={colors.white} />
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    const renderFooter = () => {
        if (!loadingMore) return null;
        return (
            <View style={styles.footer}>
                <ActivityIndicator color={colors.primary} />
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
            <View style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
                <View style={styles.sheet}>
                    <View style={styles.header}>
                        <View style={styles.titleRow}>
                            <Ionicons name="musical-notes" size={19} color="#C084FC" />
                            <Text style={styles.title}>Chọn nhạc</Text>
                        </View>
                        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                            <Ionicons name="close" size={20} color={colors.white} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.searchBox}>
                        <Ionicons name="search" size={17} color="rgba(255,255,255,0.35)" />
                        <TextInput
                            style={styles.searchInput}
                            value={query}
                            onChangeText={handleSearch}
                            placeholder="Tìm bài hát, nghệ sĩ..."
                            placeholderTextColor="rgba(255,255,255,0.35)"
                            autoCorrect={false}
                        />
                        {query ? (
                            <TouchableOpacity onPress={() => handleSearch("")}>
                                <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.35)" />
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    {loading ? (
                        <View style={styles.loaderWrap}>
                            <ActivityIndicator color={colors.primary} />
                            <Text style={styles.mutedText}>Đang tải danh sách nhạc...</Text>
                        </View>
                    ) : (
                        <FlatList
                            ref={flatListRef}
                            data={tracks}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={tracks.length ? styles.listContent : styles.emptyContent}
                            ListEmptyComponent={<Text style={styles.mutedText}>Không tìm thấy bài hát nào</Text>}
                            renderItem={renderTrack}
                            onEndReached={handleLoadMore}
                            onEndReachedThreshold={0.5}
                            ListFooterComponent={renderFooter}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.62)" },
    sheet: { maxHeight: "78%", backgroundColor: "#18181B", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.lg },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    title: { color: colors.white, fontSize: 15, fontWeight: "800" },
    closeButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" },
    searchBox: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, height: 44, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", marginVertical: spacing.md },
    searchInput: { flex: 1, color: colors.white, fontSize: 14 },
    loaderWrap: { alignItems: "center", justifyContent: "center", paddingVertical: spacing.xl, gap: 10 },
    mutedText: { color: "rgba(255,255,255,0.48)", textAlign: "center", fontSize: 13 },
    listContent: { paddingBottom: spacing.md, gap: 6 },
    emptyContent: { paddingVertical: spacing.xl },
    footer: { paddingVertical: spacing.md, alignItems: "center" },
    trackRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "transparent" },
    trackRowActive: { backgroundColor: "rgba(168,85,247,0.14)", borderColor: "rgba(168,85,247,0.28)" },
    coverWrap: { width: 48, height: 48, borderRadius: 14, overflow: "hidden" },
    coverImage: { width: "100%", height: "100%" },
    coverFallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#7C3AED" },
    coverFallbackText: { color: colors.white, fontSize: 24, fontWeight: "900" },
    trackInfo: { flex: 1, minWidth: 0 },
    trackTitle: { color: colors.white, fontSize: 13, fontWeight: "800" },
    trackArtist: { color: "rgba(255,255,255,0.52)", fontSize: 11, marginTop: 2 },
    trackDuration: { color: "rgba(255,255,255,0.32)", fontSize: 10, marginTop: 2 },
    playButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.1)" },
    playButtonActive: { backgroundColor: "#A855F7" },
});