import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@/constants";
import type { PinnedBannerItem } from "@/utils/messageUtils";

type Props = {
    pinnedBannerItems: PinnedBannerItem[];
    primaryPinnedItem?: PinnedBannerItem;
    showPinnedList: boolean;
    canExpandPinnedList: boolean;
    setShowPinnedList: React.Dispatch<React.SetStateAction<boolean>>;
    handleOpenPinnedMessage: (messageId: string) => void;
    handleUnpinMessage: (messageId: string) => Promise<void>;
};

export function PinnedBanner({
    pinnedBannerItems,
    primaryPinnedItem,
    showPinnedList,
    canExpandPinnedList,
    setShowPinnedList,
    handleOpenPinnedMessage,
    handleUnpinMessage,
}: Props) {
    if (pinnedBannerItems.length === 0) return null;

    return (
        <View style={styles.pinnedBannerWrap}>
            <View style={styles.pinnedBannerHeaderRow}>
                <Ionicons name="pin-outline" size={14} color="#4B5563" />

                {primaryPinnedItem && (!showPinnedList || !canExpandPinnedList) ? (
                    <Pressable
                        style={styles.pinnedPrimaryPressable}
                        onPress={() => handleOpenPinnedMessage(primaryPinnedItem.messageId)}
                    >
                        {primaryPinnedItem.thumbUrl ? (
                            <Image
                                source={{ uri: primaryPinnedItem.thumbUrl }}
                                style={styles.pinnedThumb}
                            />
                        ) : (
                            <View style={styles.pinnedThumbPlaceholder} />
                        )}

                        <View style={styles.pinnedPrimaryTextWrap}>
                            <Text style={styles.pinnedSenderText} numberOfLines={1}>
                                {primaryPinnedItem.senderName}
                            </Text>
                            <Text style={styles.pinnedPreviewText} numberOfLines={1}>
                                {primaryPinnedItem.preview}
                            </Text>
                        </View>
                    </Pressable>
                ) : (
                    <Text style={styles.pinnedCountText}>
                        {`Tin nhan da ghim (${pinnedBannerItems.length})`}
                    </Text>
                )}

                {canExpandPinnedList ? (
                    <Pressable
                        style={styles.pinnedToggleBtn}
                        onPress={() => setShowPinnedList((prev) => !prev)}
                    >
                        <Ionicons
                            name={showPinnedList ? "chevron-up" : "chevron-down"}
                            size={16}
                            color="#4B5563"
                        />
                    </Pressable>
                ) : null}

                {!canExpandPinnedList && primaryPinnedItem ? (
                    <Pressable
                        style={styles.pinnedUnpinBtn}
                        hitSlop={8}
                        onPress={() => void handleUnpinMessage(primaryPinnedItem.messageId)}
                    >
                        <Ionicons name="close" size={14} color="#DC2626" />
                    </Pressable>
                ) : null}
            </View>

            {showPinnedList && canExpandPinnedList ? (
                <View style={styles.pinnedListWrap}>
                    {pinnedBannerItems.map((pinItem) => (
                        <View
                            key={`${pinItem.messageId}-${pinItem.pinnedAt}`}
                            style={styles.pinnedListItemRow}
                        >
                            <Pressable
                                style={styles.pinnedListMainPressable}
                                onPress={() => handleOpenPinnedMessage(pinItem.messageId)}
                            >
                                {pinItem.thumbUrl ? (
                                    <Image
                                        source={{ uri: pinItem.thumbUrl }}
                                        style={styles.pinnedThumb}
                                    />
                                ) : (
                                    <View style={styles.pinnedThumbPlaceholder} />
                                )}

                                <View style={styles.pinnedPrimaryTextWrap}>
                                    <Text style={styles.pinnedSenderText} numberOfLines={1}>
                                        {pinItem.senderName}
                                    </Text>
                                    <Text style={styles.pinnedPreviewText} numberOfLines={1}>
                                        {pinItem.preview}
                                    </Text>
                                </View>
                            </Pressable>

                            <Pressable
                                style={styles.pinnedUnpinBtn}
                                hitSlop={8}
                                onPress={() => void handleUnpinMessage(pinItem.messageId)}
                            >
                                <Ionicons name="close" size={14} color="#DC2626" />
                            </Pressable>
                        </View>
                    ))}
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    pinnedBannerWrap: {
        backgroundColor: "#F8F9FA",
        borderBottomColor: colors.border,
        paddingHorizontal: spacing.md,
        paddingVertical: 8,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 3,
        zIndex: 10,
    },
    pinnedBannerHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    pinnedPrimaryPressable: {
        flex: 1,
        marginLeft: 8,
        marginRight: 6,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    pinnedThumb: {
        width: 24,
        height: 24,
        borderRadius: 6,
        backgroundColor: "#D1D5DB",
    },
    pinnedThumbPlaceholder: {
        width: 24,
        height: 24,
        borderRadius: 6,
    },
    pinnedPrimaryTextWrap: {
        flex: 1,
        minWidth: 0,
        marginLeft: 8,
    },
    pinnedSenderText: {
        fontSize: 11,
        fontWeight: "700",
        color: "#4B5563",
    },
    pinnedPreviewText: {
        marginTop: 1,
        fontSize: 12,
        color: "#111827",
    },
    pinnedCountText: {
        flex: 1,
        marginLeft: 8,
        fontSize: 12,
        color: "#4B5563",
        fontWeight: "600",
    },
    pinnedToggleBtn: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    pinnedListWrap: {
        marginTop: 8,
        gap: 6,
    },
    pinnedListItemRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    pinnedListMainPressable: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 10,
        backgroundColor: "#F9FAFB",
        borderWidth: 1,
        borderColor: "#E5E7EB",
        paddingHorizontal: 10,
        paddingVertical: 7,
    },
    pinnedUnpinBtn: {
        width: 26,
        height: 26,
        borderRadius: 13,
        marginLeft: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FEE2E2",
    },
});
