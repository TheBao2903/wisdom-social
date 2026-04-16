import React from "react";
import {
    View,
    Text,
    Pressable,
    TextInput,
    Modal,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "@/constants";
import { formatDurationMillis } from "@/utils/messageUtils";

const RIGHT_SCROLL_CUE_HEIGHT = 38;

export type ReplyPreview = {
    id: string;
    senderName: string;
    content: string;
};

export interface MessageComposerProps {
    replyToMessage: ReplyPreview | null;
    setReplyToMessage: (val: ReplyPreview | null) => void;
    isRecordingVoice: boolean;
    onCancelRecording: () => void;
    onStopRecordingAndSend: () => void;
    onStartRecording: () => void;
    uploading: boolean;
    sending: boolean;
    recordingSeconds: number;
    messageInputRef: React.RefObject<TextInput | null>;
    messageText: string;
    setMessageText: (text: string) => void;
    sendTypingSignal: (isTyping: boolean) => void;
    inputSelection: { start: number; end: number };
    setInputSelection: (selection: { start: number; end: number }) => void;
    onSend: () => void;
    hasTypedText: boolean;
    emojiPickerOpen: boolean;
    setEmojiPickerOpen: (open: boolean) => void;
    onToggleEmojiPicker: () => void;
    onCapturePhotoAndSend: () => void;
    onCaptureVideoAndSend: () => void;
    onPickMediaAndSend: () => void;
    onPickDocumentAndSend: () => void;
    loading: boolean;
    uploadProgressLabel: string;
    uploadProgressPercent: number | null;
    uploadFailedFileNames: string[];
    error: string | null;
    onPickEmoji: (emoji: string) => void;
}

const QUICK_EMOJIS = [
    "👍",
    "❤️",
    "😂",
    "😮",
    "😢",
    "🙏",
    "👏",
    "🔥",
    "🎉",
    "💯",
    "✅",
    "✨",
    "🤔",
    "👀",
    "🙌",
    "😅",
    "🥰",
    "😎",
];

export const MessageComposer = React.memo(
    ({
        replyToMessage,
        setReplyToMessage,
        isRecordingVoice,
        onCancelRecording,
        onStopRecordingAndSend,
        onStartRecording,
        uploading,
        sending,
        recordingSeconds,
        messageInputRef,
        messageText,
        setMessageText,
        sendTypingSignal,
        inputSelection,
        setInputSelection,
        onSend,
        hasTypedText,
        emojiPickerOpen,
        setEmojiPickerOpen,
        onToggleEmojiPicker,
        onCapturePhotoAndSend,
        onCaptureVideoAndSend,
        onPickMediaAndSend,
        onPickDocumentAndSend,
        loading,
        uploadProgressLabel,
        uploadProgressPercent,
        uploadFailedFileNames,
        error,
        onPickEmoji,
    }: MessageComposerProps) => {
        const cameraLongPressTriggeredRef = React.useRef(false);

        return (
            <View style={{ flexShrink: 0 }}>
                <View style={styles.composerWrap}>
                    {replyToMessage ? (
                        <View style={styles.replyComposerBox}>
                            <View style={styles.replyComposerTextWrap}>
                                <Text style={styles.replyComposerSender}>
                                    {replyToMessage.senderName}
                                </Text>
                                <Text
                                    style={styles.replyComposerContent}
                                    numberOfLines={1}
                                >
                                    {replyToMessage.content}
                                </Text>
                            </View>
                            <Pressable
                                onPress={() => setReplyToMessage(null)}
                                hitSlop={8}
                            >
                                <Ionicons
                                    name="close"
                                    size={18}
                                    color={colors.textMuted}
                                />
                            </Pressable>
                        </View>
                    ) : null}

                    <View style={styles.composerBar}>
                        {isRecordingVoice ? (
                            <View style={styles.recordingComposerRow}>
                                <Pressable
                                    style={styles.recordingSideBtn}
                                    hitSlop={8}
                                    onPress={onCancelRecording}
                                    disabled={uploading || sending}
                                >
                                    <Ionicons
                                        name="trash"
                                        size={24}
                                        color="#1D4ED8"
                                    />
                                </Pressable>

                                <View style={styles.recordingPill}>
                                    <Ionicons
                                        name="pause"
                                        size={18}
                                        color={colors.white}
                                    />
                                    <View style={styles.recordingWaveTrack}>
                                        {Array.from({ length: 20 }).map(
                                            (_, index) => (
                                                <View
                                                    key={`wave-${index}`}
                                                    style={[
                                                        styles.recordingWaveBar,
                                                        {
                                                            height:
                                                                index % 5 === 0
                                                                    ? 18
                                                                    : index %
                                                                            2 ===
                                                                        0
                                                                      ? 12
                                                                      : 8,
                                                        },
                                                    ]}
                                                />
                                            ),
                                        )}
                                    </View>
                                    <Text style={styles.recordingPillTime}>
                                        {formatDurationMillis(
                                            recordingSeconds * 1000,
                                        )}
                                    </Text>
                                </View>

                                <Pressable
                                    style={styles.recordingSideBtn}
                                    hitSlop={8}
                                    onPress={onStopRecordingAndSend}
                                    disabled={uploading || sending}
                                >
                                    <Ionicons
                                        name="send"
                                        size={24}
                                        color="#1D4ED8"
                                    />
                                </Pressable>
                            </View>
                        ) : (
                            <>
                                <Pressable
                                    style={styles.cameraBtn}
                                    hitSlop={8}
                                    onPress={() => {
                                        if (
                                            cameraLongPressTriggeredRef.current
                                        ) {
                                            cameraLongPressTriggeredRef.current = false;
                                            return;
                                        }
                                        onCapturePhotoAndSend();
                                    }}
                                    onLongPress={() => {
                                        cameraLongPressTriggeredRef.current = true;
                                        onCaptureVideoAndSend();
                                    }}
                                    delayLongPress={220}
                                    disabled={uploading || sending}
                                >
                                    <Ionicons
                                        name="camera"
                                        size={20}
                                        color={colors.white}
                                    />
                                </Pressable>

                                <TextInput
                                    ref={messageInputRef}
                                    value={messageText}
                                    onChangeText={(value) => {
                                        setMessageText(value);
                                        sendTypingSignal(Boolean(value.trim()));
                                    }}
                                    onBlur={() => sendTypingSignal(false)}
                                    onSelectionChange={(event) => {
                                        setInputSelection(
                                            event.nativeEvent.selection,
                                        );
                                    }}
                                    selection={inputSelection}
                                    placeholder={
                                        uploading
                                            ? "Dang tai tep..."
                                            : "Nhan tin..."
                                    }
                                    placeholderTextColor={colors.textMuted}
                                    style={styles.input}
                                    returnKeyType="send"
                                    onSubmitEditing={onSend}
                                    editable={!uploading && !sending}
                                />

                                <View style={styles.composerActions}>
                                    {hasTypedText ? (
                                        <>
                                            <Pressable
                                                style={styles.composerActionBtn}
                                                hitSlop={8}
                                                onPress={onToggleEmojiPicker}
                                                disabled={uploading || sending}
                                            >
                                                <Ionicons
                                                    name={
                                                        emojiPickerOpen
                                                            ? "happy"
                                                            : "happy-outline"
                                                    }
                                                    size={23}
                                                    color="#1D4ED8"
                                                />
                                            </Pressable>
                                            <Pressable
                                                style={styles.sendArrowBtn}
                                                hitSlop={8}
                                                onPress={onSend}
                                                disabled={uploading || sending}
                                            >
                                                <Ionicons
                                                    name="send"
                                                    size={24}
                                                    color="#1D4ED8"
                                                />
                                            </Pressable>
                                        </>
                                    ) : (
                                        <>
                                            <Pressable
                                                style={styles.composerActionBtn}
                                                hitSlop={8}
                                                onPress={onStartRecording}
                                                disabled={uploading || sending}
                                            >
                                                <Ionicons
                                                    name="mic-outline"
                                                    size={24}
                                                    color={colors.text}
                                                />
                                            </Pressable>
                                            <Pressable
                                                style={styles.composerActionBtn}
                                                hitSlop={8}
                                                onPress={onPickMediaAndSend}
                                                disabled={uploading || sending}
                                            >
                                                <Ionicons
                                                    name="image-outline"
                                                    size={24}
                                                    color={colors.text}
                                                />
                                            </Pressable>
                                            <Pressable
                                                style={styles.composerActionBtn}
                                                hitSlop={8}
                                                onPress={onPickDocumentAndSend}
                                                disabled={uploading || sending}
                                            >
                                                <Ionicons
                                                    name="document-outline"
                                                    size={24}
                                                    color={colors.text}
                                                />
                                            </Pressable>
                                            <Pressable
                                                style={styles.composerActionBtn}
                                                hitSlop={8}
                                                onPress={onToggleEmojiPicker}
                                                disabled={uploading || sending}
                                            >
                                                <Ionicons
                                                    name={
                                                        emojiPickerOpen
                                                            ? "happy"
                                                            : "happy-outline"
                                                    }
                                                    size={23}
                                                    color="#1D4ED8"
                                                />
                                            </Pressable>
                                        </>
                                    )}
                                </View>
                            </>
                        )}
                    </View>
                    {loading ? (
                        <Text style={styles.statusText}>
                            Dang tai tin nhan...
                        </Text>
                    ) : null}
                    {sending ? (
                        <Text style={styles.statusText}>Dang gui...</Text>
                    ) : null}
                    {uploading ? (
                        <Text style={styles.statusText}>
                            {uploadProgressLabel || "Dang tai tep..."}
                            {typeof uploadProgressPercent === "number"
                                ? ` (${uploadProgressPercent}%)`
                                : ""}
                        </Text>
                    ) : null}
                    {uploadFailedFileNames.length > 0 ? (
                        <Text style={styles.errorText}>
                            Tai tep that bai: {uploadFailedFileNames.join(", ")}
                        </Text>
                    ) : null}
                    {error ? (
                        <Text style={styles.errorText}>{error}</Text>
                    ) : null}
                </View>

                <Modal
                    visible={emojiPickerOpen && !isRecordingVoice}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setEmojiPickerOpen(false)}
                >
                    <Pressable
                        style={styles.emojiPickerOverlay}
                        onPress={() => setEmojiPickerOpen(false)}
                    >
                        <Pressable
                            style={styles.emojiPickerCard}
                            onPress={() => undefined}
                        >
                            <View style={styles.emojiPickerHeader}>
                                <Text style={styles.emojiPickerTitle}>
                                    Emoji
                                </Text>
                                <Pressable
                                    hitSlop={8}
                                    onPress={() => setEmojiPickerOpen(false)}
                                >
                                    <Ionicons
                                        name="close"
                                        size={18}
                                        color={colors.textMuted}
                                    />
                                </Pressable>
                            </View>

                            <View style={styles.emojiGrid}>
                                {QUICK_EMOJIS.map((emoji) => (
                                    <Pressable
                                        key={emoji}
                                        style={styles.emojiCell}
                                        onPress={() => onPickEmoji(emoji)}
                                    >
                                        <Text style={styles.emojiCellText}>
                                            {emoji}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </Pressable>
                    </Pressable>
                </Modal>
            </View>
        );
    },
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "white",
    },
    flex: { flex: 1 },
    header: {
        backgroundColor: colors.white,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.sm,
        paddingVertical: 10,
    },
    headerBackBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        marginRight: spacing.xs,
    },
    headerIdentity: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        minWidth: 0,
    },
    headerMeta: {
        marginLeft: spacing.sm,
        minWidth: 0,
    },
    headerName: {
        fontSize: 17,
        fontWeight: "700",
        color: colors.text,
    },
    headerStatus: {
        marginTop: 2,
        fontSize: 13,
        color: colors.textMuted,
    },
    headerActions: {
        flexDirection: "row",
        alignItems: "center",
        marginLeft: spacing.xs,
    },
    headerActionBtn: {
        width: 34,
        height: 34,
        alignItems: "center",
        justifyContent: "center",
        marginLeft: spacing.xs,
    },
    listContent: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        gap: 0,
    },
    messageItemWrap: {
        width: "100%",
    },
    row: {
        flexDirection: "row",
        alignItems: "flex-end",
    },
    rowGroupStart: {
        marginTop: 9,
    },
    rowGrouped: {
        marginTop: 2,
    },
    rowGroupedRecalled: {
        marginTop: 8,
    },
    rowGroupedWithReply: {
        marginTop: 8,
    },
    rowMine: {
        justifyContent: "flex-end",
    },
    rowOther: {
        justifyContent: "flex-start",
    },
    avatarSpacer: {
        width: 30,
    },
    messageColumn: {
        maxWidth: "80%",
    },
    messageColumnMine: {
        alignItems: "flex-end",
    },
    messageColumnOther: {
        alignItems: "flex-start",
        marginLeft: spacing.sm,
    },
    groupSenderLabel: {
        maxWidth: 180,
        marginBottom: 4,
        marginLeft: 2,
        fontSize: 11,
        fontWeight: "700",
        color: "#6B7280",
    },
    replyRelationRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        maxWidth: "92%",
        marginTop: 2,
        marginBottom: 2,
        marginLeft: 2,
    },
    replyRelationRowMine: {
        alignSelf: "flex-start",
    },
    replyRelationLabel: {
        fontSize: 11,
        fontWeight: "600",
        color: "#6B7280",
        flexShrink: 1,
        minWidth: 0,
    },
    replyRelationLabelMine: {
        color: "#6B7280",
    },
    bubble: {
        borderRadius: 18,
        paddingHorizontal: 13,
        paddingVertical: 9,
        maxWidth: "100%",
    },
    bubbleAlignMine: {
        alignSelf: "flex-end",
    },
    bubbleAlignOther: {
        alignSelf: "flex-start",
    },
    bubbleWithReply: {
        marginTop: -4,
        position: "relative",
        zIndex: 3,
    },
    bubbleWithReplyMine: {
        borderTopRightRadius: 12,
    },
    bubbleWithReplyOther: {
        borderTopLeftRadius: 12,
    },
    bubblePlain: {
        borderRadius: 0,
        paddingHorizontal: 0,
        paddingVertical: 0,
        backgroundColor: "transparent",
    },
    highlightedBubble: {
        borderWidth: 2,
        borderColor: "#F59E0B",
    },
    bubbleMine: {
        backgroundColor: "#1D4ED8",
    },
    bubbleMineSingle: {
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 6,
    },
    bubbleMineFirst: {
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 6,
    },
    bubbleMineMiddle: {
        borderTopLeftRadius: 18,
        borderTopRightRadius: 8,
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 8,
    },
    bubbleMineLast: {
        borderTopLeftRadius: 18,
        borderTopRightRadius: 8,
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 6,
    },
    bubbleOther: {
        backgroundColor: "#FFFFFF",

        borderColor: "#E5E7EB",
    },
    bubbleOtherSingle: {
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        borderBottomLeftRadius: 6,
        borderBottomRightRadius: 18,
    },
    bubbleOtherFirst: {
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        borderBottomLeftRadius: 6,
        borderBottomRightRadius: 18,
    },
    bubbleOtherMiddle: {
        borderTopLeftRadius: 8,
        borderTopRightRadius: 18,
        borderBottomLeftRadius: 8,
        borderBottomRightRadius: 18,
    },
    bubbleOtherLast: {
        borderTopLeftRadius: 8,
        borderTopRightRadius: 18,
        borderBottomLeftRadius: 6,
        borderBottomRightRadius: 18,
    },
    bubbleRecalled: {
        backgroundColor: "#F3F4F6",
    },
    cardShadow: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 1,
    },
    messageText: {
        color: colors.text,
        fontSize: 15,
        lineHeight: 21,
    },
    messageTextMine: {
        color: colors.white,
    },
    recalledText: {
        fontStyle: "italic",
        color: "#6B7280",
    },
    emojiOnlyText: {
        fontSize: 36,
        lineHeight: 42,
        paddingHorizontal: 4,
        paddingVertical: 2,
    },
    replyPreview: {
        alignSelf: "flex-start",
        maxWidth: "92%",
        borderRadius: 13,
        backgroundColor: "rgba(243, 244, 246, 0.92)",
        borderColor: "rgba(203, 213, 225, 0.75)",
        borderLeftColor: "rgba(203, 213, 225, 0.75)",
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 1,
    },
    replyPreviewOverlay: {
        paddingBottom: 6,
        marginBottom: -4,
        zIndex: 1,
    },
    replyPreviewMine: {
        backgroundColor: "rgba(243, 244, 246, 0.95)",
        borderColor: "rgba(203, 213, 225, 0.78)",
        borderLeftColor: "rgba(203, 213, 225, 0.78)",
    },
    replyPreviewConnectedMine: {
        borderBottomRightRadius: 10,
    },
    replyPreviewConnectedOther: {
        borderBottomLeftRadius: 10,
    },
    replyPreviewBody: {
        flexDirection: "row",
        alignItems: "center",
    },
    replyPreviewThumb: {
        width: 42,
        height: 42,
        borderRadius: 8,
        backgroundColor: "#CBD5E1",
    },
    replyPreviewIconBox: {
        width: 42,
        height: 42,
        borderRadius: 10,
        backgroundColor: "#E5E7EB",
        alignItems: "center",
        justifyContent: "center",
    },
    replyPreviewIconBoxMine: {
        backgroundColor: "#E5E7EB",
    },
    replyPreviewTextWrap: {
        marginLeft: 8,
        flexShrink: 1,
        minWidth: 0,
    },
    replyPreviewTextWrapNoLead: {
        marginLeft: 0,
    },
    replyFileInline: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    replyContentOnly: {
        color: "#4B5563",
        fontSize: 14,
        lineHeight: 20,
    },
    replyContentOnlyMine: {
        color: "#4B5563",
    },
    bubbleMainContent: {
        zIndex: 0,
    },
    bubbleMainContentLifted: {
        marginTop: 0,
    },
    imageGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 7,
        marginTop: 0,
        marginBottom: 4,
    },
    imageAttachment: {
        width: 138,
        height: 138,
        borderRadius: 16,
        backgroundColor: "#D1D5DB",
        borderWidth: 1,
    },
    imageAttachmentLarge: {
        width: 248,
        height: 286,
    },
    mediaCardMine: {
        borderColor: "rgba(255,255,255,0.35)",
    },
    mediaCardOther: {
        borderColor: "#E5E7EB",
    },
    videoList: {
        marginBottom: 4,
    },
    videoWrap: {
        marginTop: 6,
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 1,
    },
    videoAttachment: {
        width: 248,
        height: 176,
        backgroundColor: "#111827",
    },
    videoExpandBtn: {
        position: "absolute",
        top: 8,
        right: 8,
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(15, 23, 42, 0.7)",
    },
    audioList: {
        marginBottom: 4,
    },
    audioItem: {
        marginTop: 6,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#E5E7EB",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#CBD5E1",
        paddingHorizontal: 10,
        paddingVertical: 9,
        minWidth: 220,
    },
    audioItemMine: {
        backgroundColor: "#3B82F6",
        borderColor: "rgba(255,255,255,0.28)",
    },
    audioPlayBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#111827",
    },
    audioPlayBtnMine: {
        backgroundColor: "rgba(255, 255, 255, 0.2)",
    },
    audioPlayIconWrap: {
        width: 20,
        height: 20,
        alignItems: "center",
        justifyContent: "center",
    },
    audioMeta: {
        marginLeft: 8,
        flex: 1,
        minWidth: 0,
        flexDirection: "row",
        alignItems: "center",
    },
    audioWaveformTrack: {
        flex: 1,
        height: 32,
        flexDirection: "row",
        alignItems: "center",
        gap: 1,
        overflow: "hidden",
    },
    audioWaveformTrackMine: {
        opacity: 1,
    },
    audioWaveBar: {
        flex: 1,
        borderRadius: 999,
        minHeight: 4,
        overflow: "hidden",
    },
    audioWaveBarFill: {
        position: "absolute",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
    },
    audioWaveBarPlayedMine: {
        backgroundColor: colors.white,
    },
    audioWaveBarPlayedOther: {
        backgroundColor: "#111827",
    },
    audioWaveBarIdleMine: {
        backgroundColor: "rgba(255, 255, 255, 0.35)",
    },
    audioWaveBarIdleOther: {
        backgroundColor: "#D1D5DB",
    },
    audioTimeText: {
        marginLeft: 8,
        color: "#374151",
        fontSize: 11,
        fontWeight: "600",
        fontVariant: ["tabular-nums"],
    },
    audioTimeTextMine: {
        color: "#E0E7FF",
    },
    fileList: {
        marginBottom: 4,
    },
    fileItem: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 6,
        backgroundColor: "#F3F4F6",
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: "#E5E7EB",
    },
    fileItemMine: {
        backgroundColor: "#1D4ED8",
        borderColor: "rgba(255, 255, 255, 0.28)",
    },
    fileBadge: {
        width: 32,
        height: 32,
        borderRadius: 9,
        backgroundColor: "#111827",
        alignItems: "center",
        justifyContent: "center",
    },
    fileBadgeText: {
        fontSize: 10,
        fontWeight: "700",
        color: colors.white,
    },
    fileMeta: {
        marginLeft: 8,
        flex: 1,
        minWidth: 0,
    },
    fileName: {
        color: colors.text,
        fontSize: 13,
        fontWeight: "600",
    },
    fileNameMine: {
        color: colors.white,
    },
    fileSize: {
        marginTop: 2,
        color: colors.textMuted,
        fontSize: 11,
    },
    fileSizeMine: {
        color: "#DBEAFE",
    },
    fileActionIconWrap: {
        marginLeft: 8,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: "#E2E8F0",
        alignItems: "center",
        justifyContent: "center",
    },
    fileActionIconWrapMine: {
        backgroundColor: "rgba(255, 255, 255, 0.2)",
    },
    callCard: {
        marginTop: 6,
        borderRadius: 14,
        backgroundColor: "#F8FAFC",
        paddingHorizontal: 10,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    callCardMine: {
        backgroundColor: "#1D4ED8",
        borderColor: "rgba(255,255,255,0.28)",
    },
    callMainRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    callIconWrap: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.85)",
    },
    callIconWrapMine: {
        backgroundColor: "rgba(255,255,255,0.2)",
    },
    callMeta: {
        marginLeft: 8,
        flex: 1,
        minWidth: 0,
    },
    callTitle: {
        fontSize: 13,
        fontWeight: "700",
        color: "#111827",
    },
    callTitleMine: {
        color: colors.white,
    },
    callSubtitle: {
        marginTop: 1,
        fontSize: 11,
        color: "#6B7280",
    },
    callSubtitleMine: {
        color: "#DBEAFE",
    },
    callRecallBadge: {
        alignSelf: "flex-start",
        marginTop: 8,
        borderRadius: 999,
        backgroundColor: "#E5E7EB",
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    callRecallBadgeMine: {
        backgroundColor: "rgba(255, 255, 255, 0.2)",
    },
    callRecallText: {
        fontSize: 11,
        fontWeight: "700",
        color: "#1F2937",
    },
    callRecallTextMine: {
        color: colors.white,
    },
    attachmentCaptionBubble: {
        marginTop: 7,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E5E7EB",
    },
    attachmentCaptionBubbleMine: {
        backgroundColor: "#1D4ED8",
        borderColor: "rgba(255,255,255,0.28)",
    },
    attachmentCaptionText: {
        fontSize: 14,
        lineHeight: 20,
        color: colors.text,
    },
    attachmentCaptionTextMine: {
        color: colors.white,
    },
    messageTime: {
        marginTop: 3,
        fontSize: 11,
        color: "#6B7280",
    },
    messageTimeMine: {
        color: "#6B7280",
        marginRight: 2,
    },
    messageMetaRow: {
        width: "100%",
        marginTop: 1,
    },
    messageMetaRowMine: {
        alignItems: "flex-end",
        paddingRight: 2,
    },
    messageMetaRowOther: {
        alignItems: "flex-start",
        paddingLeft: 30 + spacing.sm,
    },
    systemMessageRow: {
        width: "100%",
        alignItems: "center",
        marginTop: 14,
    },
    systemMessageBadge: {
        maxWidth: "88%",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: "#E5E7EB",
        flexDirection: "row",
        alignItems: "center",
    },
    systemMessageText: {
        marginLeft: 6,
        fontSize: 12,
        color: "#4B5563",
        flexShrink: 1,
    },
    systemCollapsedBtn: {
        maxWidth: "88%",
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: "#EFF6FF",
        borderWidth: 1,
        borderColor: "#BFDBFE",
        flexDirection: "row",
        alignItems: "center",
    },
    systemCollapsedBtnText: {
        marginLeft: 6,
        fontSize: 12,
        fontWeight: "700",
        color: "#2563EB",
    },
    seenReceiptsRow: {
        marginTop: 4,
        marginRight: 2,
        alignSelf: "flex-end",
        flexDirection: "row",
        gap: 4,
    },
    loadingOlderText: {
        alignSelf: "center",
        marginBottom: spacing.sm,
        fontSize: 12,
        color: colors.textMuted,
    },
    loadingNewerText: {
        alignSelf: "center",
        marginTop: spacing.sm,
        fontSize: 12,
        color: colors.textMuted,
    },
    scrollToBottomFab: {
        position: "absolute",
        right: spacing.md,
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        backgroundColor: colors.white,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 20,
    },
    scrollToBottomBadge: {
        position: "absolute",
        top: -4,
        left: -4,
        minWidth: 18,
        height: 18,
        paddingHorizontal: 4,
        borderRadius: 9,
        backgroundColor: "#2563EB",
        alignItems: "center",
        justifyContent: "center",
    },
    scrollToBottomBadgeText: {
        fontSize: 10,
        fontWeight: "700",
        color: colors.white,
    },
    rightScrollCue: {
        position: "absolute",
        right: 4,
        width: 4,
        height: RIGHT_SCROLL_CUE_HEIGHT,
        borderRadius: 999,
        backgroundColor: "rgba(75, 85, 99, 0.55)",
        zIndex: 18,
    },
    composerWrap: {
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingHorizontal: spacing.md,
        paddingVertical: 10,
    },
    replyComposerBox: {
        backgroundColor: "#f5f5f5ff",
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 15,
        marginBottom: 8,
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
    },
    replyComposerTextWrap: {
        flex: 1,
        minWidth: 0,
    },
    replyComposerSender: {
        color: "#1b1b1dff",
        fontSize: 12,
        fontWeight: "700",
    },
    replyComposerContent: {
        marginTop: 2,
        color: "#374151",
        fontSize: 12,
    },
    composerBar: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F0F1F3",
        borderRadius: 26,
        minHeight: 48,
        paddingLeft: 6,
        paddingRight: spacing.sm,
    },
    cameraBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "#5B5CF0",
        alignItems: "center",
        justifyContent: "center",
    },
    composerActions: {
        flexDirection: "row",
        alignItems: "center",
        marginLeft: spacing.xs,
    },
    composerActionBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 2,
    },
    sendArrowBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 4,
        backgroundColor: "transparent",
    },
    emojiPickerOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.2)",
        justifyContent: "flex-end",
        paddingHorizontal: spacing.md,
        paddingBottom: 76,
    },
    emojiPickerCard: {
        backgroundColor: colors.white,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    emojiPickerHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    emojiPickerTitle: {
        fontSize: 13,
        fontWeight: "700",
        color: colors.text,
    },
    emojiGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
    },
    emojiCell: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F3F4F6",
    },
    emojiCellText: {
        fontSize: 20,
    },
    recordingComposerRow: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
    },
    recordingSideBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
    },
    recordingPill: {
        flex: 1,
        marginHorizontal: 6,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#1D4ED8",
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
    },
    recordingWaveTrack: {
        flex: 1,
        marginLeft: 10,
        marginRight: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    recordingWaveBar: {
        width: 3,
        borderRadius: 999,
        backgroundColor: "#BFDBFE",
    },
    recordingPillTime: {
        color: colors.white,
        fontSize: 12,
        fontWeight: "700",
        minWidth: 34,
        textAlign: "right",
    },
    input: {
        flex: 1,
        color: colors.text,
        fontSize: 15,
        paddingHorizontal: spacing.sm,
        paddingVertical: Platform.OS === "ios" ? 11 : 9,
        gap: spacing.sm,
    },
    statusText: {
        marginTop: spacing.xs,
        fontSize: 12,
        color: colors.textMuted,
    },
    typingIndicatorRow: {
        flexDirection: "row",
        alignItems: "flex-end",
        marginTop: 8,
        marginBottom: 4,
        paddingHorizontal: spacing.md,
    },
    typingAvatarRow: {
        flexDirection: "row",
        alignItems: "center",
        marginRight: 8,
    },
    typingBubble: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        backgroundColor: "#E5E7EB",
        alignSelf: "flex-start",
    },
    typingDot: {
        width: 7,
        height: 7,
        borderRadius: 999,
        backgroundColor: "#6B7280",
    },
    typingDotOffsetOne: {
        marginLeft: 4,
    },
    typingDotOffsetTwo: {
        marginLeft: 4,
    },
    errorText: {
        marginTop: spacing.xs,
        fontSize: 12,
        color: "#EF4444",
    },
});
