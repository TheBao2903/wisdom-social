import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef } from "react";
import {
    Animated,
    Image,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { colors } from "@/constants";
import type { Message } from "@/types/chat";
import {
    buildReplyPreview,
    contextActions,
    ContextMenuState,
    formatMessageTime,
    MENU_WIDTH,
    resolveAttachmentUrls,
} from "@/utils/messageUtils";

const CONTEXT_MENU_OPEN_SOUND_URI =
    "data:audio/wav;base64," +
    "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";
const REACTION_BAR_HEIGHT = 48;
const REACTION_TO_PREVIEW_GAP = 8;
const PREVIEW_TO_MENU_GAP = 3;
const TEXT_PREVIEW_HEIGHT = 62;
const MEDIA_PREVIEW_HEIGHT = 148;

type Props = {
    contextMenu: ContextMenuState | null;
    selectedMessage?: Message | null;
    closeContextMenu: () => void;
    handleContextAction: (actionKey: string) => void;
    onReaction: (messageId: string, emoji: string) => void;
    selectedMessagePinned: boolean;
    canRecallOwnMessages: boolean;
};

export function MessageContextMenu({
    contextMenu,
    selectedMessage,
    closeContextMenu,
    handleContextAction,
    onReaction,
    selectedMessagePinned,
    canRecallOwnMessages,
}: Props) {
    const openProgress = useRef(new Animated.Value(0)).current;
    const openSoundRef = useRef<Audio.Sound | null>(null);
    const hasMediaPreview =
        selectedMessage &&
        (selectedMessage.type === "IMAGE" ||
            selectedMessage.type === "VIDEO" ||
            selectedMessage.type === "FILE" ||
            selectedMessage.type === "AUDIO") &&
        resolveAttachmentUrls(selectedMessage).length > 0;
    const previewHeight = hasMediaPreview
        ? MEDIA_PREVIEW_HEIGHT
        : TEXT_PREVIEW_HEIGHT;
    const reactionTop = contextMenu
        ? Math.max(
              contextMenu.minStackTop,
              contextMenu.top -
                  previewHeight -
                  REACTION_BAR_HEIGHT -
                  REACTION_TO_PREVIEW_GAP -
                  PREVIEW_TO_MENU_GAP,
          )
        : 0;
    const previewTop = contextMenu
        ? reactionTop + REACTION_BAR_HEIGHT + REACTION_TO_PREVIEW_GAP
        : 0;
    const menuTop = contextMenu
        ? previewTop + previewHeight + PREVIEW_TO_MENU_GAP
        : 0;

    const actionsToRender = useMemo(
        () =>
            contextActions.filter((action) => {
                if (!contextMenu) return false;
                if (
                    action.key === "unsend" &&
                    (!contextMenu.mine || !canRecallOwnMessages)
                ) {
                    return false;
                }
                if (
                    action.key === "forward" &&
                    (selectedMessage?.isRecalled ||
                        selectedMessage?.type?.startsWith("SYSTEM_"))
                ) {
                    return false;
                }
                return true;
            }),
        [canRecallOwnMessages, contextMenu, selectedMessage],
    );

    useEffect(() => {
        if (!contextMenu) return;

        const playOpenSound = async () => {
            try {
                const previousSound = openSoundRef.current;
                openSoundRef.current = null;
                await previousSound?.unloadAsync();

                const { sound } = await Audio.Sound.createAsync(
                    { uri: CONTEXT_MENU_OPEN_SOUND_URI },
                    { shouldPlay: true, volume: 0.35 },
                );
                openSoundRef.current = sound;
                sound.setOnPlaybackStatusUpdate((status) => {
                    if (status.isLoaded && status.didJustFinish) {
                        openSoundRef.current = null;
                        void sound.unloadAsync();
                    }
                });
            } catch {
                openSoundRef.current = null;
            }
        };

        openProgress.setValue(0);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        void playOpenSound();
        Animated.spring(openProgress, {
            toValue: 1,
            damping: 18,
            stiffness: 260,
            mass: 0.75,
            useNativeDriver: true,
        }).start();
    }, [contextMenu, openProgress]);

    useEffect(() => {
        return () => {
            void openSoundRef.current?.unloadAsync();
            openSoundRef.current = null;
        };
    }, []);

    return (
        <Modal
            visible={Boolean(contextMenu)}
            transparent
            animationType="none"
            onRequestClose={closeContextMenu}
        >
            <Pressable style={styles.menuOverlay} onPress={closeContextMenu}>
                {contextMenu ? (
                    <>
                        <Animated.View
                            style={[
                                styles.previewWrap,
                                contextMenu.mine
                                    ? styles.previewWrapMine
                                    : styles.previewWrapOther,
                                {
                                    top: previewTop,
                                    left: contextMenu.left,
                                    opacity: openProgress,
                                    transform: [
                                        {
                                            translateY:
                                                openProgress.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: [12, 0],
                                                }),
                                        },
                                        {
                                            scale: openProgress.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0.94, 1],
                                            }),
                                        },
                                    ],
                                },
                            ]}
                            pointerEvents="none"
                        >
                            <SelectedMessagePreview
                                message={selectedMessage}
                                mine={contextMenu.mine}
                            />
                        </Animated.View>

                        <Animated.View
                            style={[
                                styles.reactionBar,
                                {
                                    top: reactionTop,
                                    left: contextMenu.left,
                                    opacity: openProgress,
                                    transform: [
                                        {
                                            translateY:
                                                openProgress.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: [10, 0],
                                                }),
                                        },
                                        {
                                            scale: openProgress.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0.92, 1],
                                            }),
                                        },
                                    ],
                                },
                            ]}
                        >
                            {[
                                "\u2764\uFE0F",
                                "\uD83D\uDE02",
                                "\uD83D\uDE2E",
                                "\uD83D\uDE22",
                                "\uD83D\uDE21",
                                "\uD83D\uDC4D",
                            ].map((emoji) => (
                                <Pressable
                                    key={emoji}
                                    style={({ pressed }) => [
                                        styles.reactionButton,
                                        pressed && styles.reactionButtonPressed,
                                    ]}
                                    onPress={(event) => {
                                        event.stopPropagation();
                                        onReaction(contextMenu.messageId, emoji);
                                        closeContextMenu();
                                    }}
                                >
                                    <Text style={styles.reactionEmoji}>
                                        {emoji}
                                    </Text>
                                </Pressable>
                            ))}
                        </Animated.View>

                        <Animated.View
                            style={[
                                styles.contextMenuCard,
                                {
                                    top: menuTop,
                                    left: contextMenu.left,
                                    opacity: openProgress,
                                    transform: [
                                        {
                                            translateY:
                                                openProgress.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: [12, 0],
                                                }),
                                        },
                                        {
                                            scale: openProgress.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0.96, 1],
                                            }),
                                        },
                                    ],
                                },
                            ]}
                        >
                            {actionsToRender.map((action) => {
                                if ("divider" in action) {
                                    return (
                                        <View
                                            key={action.key}
                                            style={styles.contextDivider}
                                        />
                                    );
                                }

                                const isDestructive =
                                    "destructive" in action &&
                                    Boolean(action.destructive);
                                const hasArrow =
                                    "hasArrow" in action &&
                                    Boolean(action.hasArrow);
                                const iconName =
                                    action.key === "pin"
                                        ? selectedMessagePinned
                                            ? "pin"
                                            : "pin-outline"
                                        : action.icon;
                                const labelText =
                                    action.key === "pin"
                                        ? selectedMessagePinned
                                            ? "Bo ghim"
                                            : "Ghim tin nhan"
                                        : action.label;

                                return (
                                    <Pressable
                                        key={action.key}
                                        style={styles.contextItem}
                                        onPress={(event) => {
                                            event.stopPropagation();
                                            handleContextAction(action.key);
                                        }}
                                    >
                                        <Ionicons
                                            name={iconName}
                                            size={16}
                                            color={
                                                isDestructive
                                                    ? "#EF4444"
                                                    : "#1F2937"
                                            }
                                        />
                                        <Text
                                            style={[
                                                styles.contextLabel,
                                                isDestructive &&
                                                    styles.contextLabelDanger,
                                            ]}
                                        >
                                            {labelText}
                                        </Text>
                                        {hasArrow ? (
                                            <Ionicons
                                                name="chevron-forward"
                                                size={15}
                                                color={colors.textMuted}
                                                style={styles.contextChevron}
                                            />
                                        ) : null}
                                    </Pressable>
                                );
                            })}
                        </Animated.View>
                    </>
                ) : null}
            </Pressable>
        </Modal>
    );
}

function SelectedMessagePreview({
    message,
    mine,
}: {
    message?: Message | null;
    mine: boolean;
}) {
    if (!message) return null;

    const attachmentUrls = resolveAttachmentUrls(message);
    const firstAttachmentUrl = attachmentUrls[0];
    const isImagePreview =
        message.type === "IMAGE" && attachmentUrls.length > 0;
    const isVideoPreview =
        message.type === "VIDEO" && Boolean(firstAttachmentUrl);
    const isMediaPreview =
        (message.type === "IMAGE" || message.type === "VIDEO") &&
        firstAttachmentUrl;
    const isAttachmentPreview =
        !message.isRecalled &&
        (isMediaPreview ||
            message.type === "FILE" ||
            message.type === "AUDIO");
    const label = message.isRecalled
        ? "Tin nhan da duoc thu hoi"
        : buildReplyPreview(message);

    return (
        <View
            style={[
                styles.previewBubble,
                mine ? styles.previewBubbleMine : styles.previewBubbleOther,
                isAttachmentPreview && styles.previewBubbleMedia,
            ]}
        >
            {isImagePreview ? (
                <View
                    style={[
                        styles.previewMediaFrame,
                        attachmentUrls.length > 1 &&
                            styles.previewMediaGrid,
                    ]}
                >
                    {attachmentUrls.slice(0, 4).map((url, index) => {
                        const remaining = attachmentUrls.length - 4;
                        const showMoreBadge =
                            index === 3 && remaining > 0;
                        return (
                            <View
                                key={`${message.id}-preview-image-${index}`}
                                style={[
                                    styles.previewImageCell,
                                    attachmentUrls.length === 1 &&
                                        styles.previewImageCellSingle,
                                    attachmentUrls.length === 2 &&
                                        styles.previewImageCellTwo,
                                ]}
                            >
                                <Image
                                    source={{ uri: url }}
                                    style={styles.previewImage}
                                    resizeMode="cover"
                                />
                                {showMoreBadge ? (
                                    <View style={styles.previewMoreOverlay}>
                                        <Text style={styles.previewMoreText}>
                                            +{remaining}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>
                        );
                    })}
                </View>
            ) : isVideoPreview ? (
                <View style={styles.previewMediaFrame}>
                    <Image
                        source={{ uri: firstAttachmentUrl }}
                        style={styles.previewImage}
                        resizeMode="cover"
                    />
                    <View style={styles.previewVideoBadge}>
                        <Ionicons
                            name="play"
                            size={14}
                            color={colors.white}
                        />
                    </View>
                </View>
            ) : isAttachmentPreview ? (
                <View style={styles.previewAttachmentCard}>
                    <View style={styles.previewAttachmentIcon}>
                        <Ionicons
                            name={
                                message.type === "AUDIO"
                                    ? "mic-outline"
                                    : "document-attach-outline"
                            }
                            size={20}
                            color="#2563EB"
                        />
                    </View>
                    <Text style={styles.previewAttachmentText} numberOfLines={2}>
                        {label}
                    </Text>
                </View>
            ) : (
                <Text
                    style={[
                        styles.previewText,
                        mine ? styles.previewTextMine : styles.previewTextOther,
                    ]}
                    numberOfLines={2}
                >
                    {label}
                </Text>
            )}
            {!isAttachmentPreview ? (
                <Text
                    style={[
                        styles.previewTime,
                        mine ? styles.previewTimeMine : styles.previewTimeOther,
                    ]}
                >
                    {formatMessageTime(message.createdAt)}
                </Text>
            ) : isMediaPreview ? (
                <View style={styles.previewMediaHint}>
                    <Ionicons
                        name={
                            isImagePreview && attachmentUrls.length > 1
                                ? "images-outline"
                                : "expand-outline"
                        }
                        size={13}
                        color={colors.white}
                    />
                    <Text style={styles.previewMediaHintText}>
                        {isImagePreview && attachmentUrls.length > 1
                            ? `${attachmentUrls.length} anh`
                            : formatMessageTime(message.createdAt)}
                    </Text>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    menuOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.34)",
    },
    previewWrap: {
        position: "absolute",
        width: MENU_WIDTH,
    },
    previewWrapMine: {
        alignItems: "flex-end",
    },
    previewWrapOther: {
        alignItems: "flex-start",
    },
    previewBubble: {
        maxWidth: 210,
        minHeight: 42,
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 9,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.14,
        shadowRadius: 18,
        elevation: 14,
    },
    previewBubbleMine: {
        backgroundColor: "#0A7CFF",
        borderTopRightRadius: 8,
    },
    previewBubbleOther: {
        backgroundColor: colors.white,
        borderTopLeftRadius: 8,
    },
    previewBubbleMedia: {
        padding: 0,
        overflow: "hidden",
        backgroundColor: "transparent",
        shadowOpacity: 0,
        elevation: 0,
    },
    previewText: {
        fontSize: 16,
        lineHeight: 21,
    },
    previewTextMine: {
        color: colors.white,
    },
    previewTextOther: {
        color: "#111827",
    },
    previewTime: {
        marginTop: 3,
        fontSize: 10,
        alignSelf: "flex-end",
    },
    previewTimeMine: {
        color: "rgba(255, 255, 255, 0.72)",
    },
    previewTimeOther: {
        color: colors.textMuted,
    },
    previewMediaFrame: {
        height: 124,
        width: 198,
        borderRadius: 17,
        overflow: "hidden",
        backgroundColor: "#E5E7EB",
    },
    previewMediaGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 3,
        padding: 3,
        backgroundColor: "rgba(15, 23, 42, 0.08)",
    },
    previewImageCell: {
        width: 94,
        height: 58,
        borderRadius: 13,
        overflow: "hidden",
        backgroundColor: "#E5E7EB",
    },
    previewImageCellSingle: {
        width: "100%",
        height: "100%",
        borderRadius: 17,
    },
    previewImageCellTwo: {
        width: 94,
        height: 118,
    },
    previewImage: {
        height: "100%",
        width: "100%",
    },
    previewMoreOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.48)",
    },
    previewMoreText: {
        color: colors.white,
        fontSize: 18,
        fontWeight: "800",
    },
    previewMediaHint: {
        position: "absolute",
        right: 8,
        bottom: 8,
        minHeight: 24,
        borderRadius: 999,
        paddingHorizontal: 8,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(15, 23, 42, 0.72)",
    },
    previewMediaHintText: {
        marginLeft: 4,
        color: colors.white,
        fontSize: 11,
        fontWeight: "700",
    },
    previewAttachmentCard: {
        width: 198,
        minHeight: 64,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: "#E5E7EB",
    },
    previewAttachmentIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#EFF6FF",
    },
    previewAttachmentText: {
        marginLeft: 10,
        flex: 1,
        color: colors.text,
        fontSize: 14,
        fontWeight: "700",
    },
    previewVideoBadge: {
        position: "absolute",
        left: "50%",
        top: "50%",
        height: 34,
        width: 34,
        marginLeft: -17,
        marginTop: -17,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    reactionBar: {
        position: "absolute",
        width: MENU_WIDTH,
        minHeight: 48,
        paddingHorizontal: 8,
        borderRadius: 999,
        backgroundColor: colors.white,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.16,
        shadowRadius: 18,
        elevation: 16,
    },
    reactionButton: {
        height: 36,
        width: 34,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
    },
    reactionButtonPressed: {
        transform: [{ scale: 1.18 }],
        backgroundColor: "#F3F4F6",
    },
    reactionEmoji: {
        fontSize: 24,
    },
    contextMenuCard: {
        position: "absolute",
        width: MENU_WIDTH,
        backgroundColor: colors.white,
        borderRadius: 18,
        paddingVertical: 6,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
        elevation: 18,
    },
    contextItem: {
        minHeight: 42,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 14,
    },
    contextLabel: {
        marginLeft: 11,
        fontSize: 14,
        color: "#111827",
        flex: 1,
    },
    contextLabelDanger: {
        color: "#EF4444",
    },
    contextChevron: {
        marginLeft: 8,
    },
    contextDivider: {
        height: 1,
        backgroundColor: "#EEF0F3",
        marginVertical: 5,
    },
});
