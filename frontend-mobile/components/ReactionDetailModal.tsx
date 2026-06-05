import React, { useMemo, useState } from "react";
import {
    Modal,
    View,
    Text,
    StyleSheet,
    Pressable,
    ScrollView,
    Image,
    Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MessageReaction } from "@/types/chat";
import { MembersByUserId } from "@/stores/chatRuntimeStore";
import { colors } from "@/constants";

interface ReactionDetailModalProps {
    visible: boolean;
    onClose: () => void;
    reactions: MessageReaction[];
    membersById: MembersByUserId;
}

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export const ReactionDetailModal = ({
    visible,
    onClose,
    reactions = [],
    membersById,
}: ReactionDetailModalProps) => {
    const [activeTab, setActiveTab] = useState<string>("all");

    const tabs = useMemo(() => {
        const result = [{ id: "all", label: "Tat ca", count: 0 }];
        let total = 0;

        reactions.forEach((reaction) => {
            const count = reaction.user.reduce((sum, u) => sum + u.quantity, 0);
            total += count;
            result.push({
                id: reaction.name,
                label: reaction.name,
                count: count,
            });
        });

        result[0].count = total;
        return result;
    }, [reactions]);

    const usersToDisplay = useMemo(() => {
        if (activeTab === "all") {
            const userMap = new Map<number, { userId: number; emojis: string[]; total: number }>();
            reactions.forEach((reaction) => {
                reaction.user.forEach((u) => {
                    const existing = userMap.get(u.userId) || {
                        userId: u.userId,
                        emojis: [],
                        total: 0,
                    };
                    if (!existing.emojis.includes(reaction.name)) {
                        existing.emojis.push(reaction.name);
                    }
                    existing.total += u.quantity;
                    userMap.set(u.userId, existing);
                });
            });
            return Array.from(userMap.values());
        } else {
            const reaction = reactions.find((r) => r.name === activeTab);
            if (!reaction) return [];
            return reaction.user.map((u) => ({
                userId: u.userId,
                emojis: [reaction.name],
                total: u.quantity,
            }));
        }
    }, [activeTab, reactions]);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Bieu cam</Text>
                        <Pressable onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#6B7280" />
                        </Pressable>
                    </View>

                    <View style={styles.body}>
                        {/* Sidebar Tabs */}
                        <View style={styles.sidebar}>
                            <ScrollView showsVerticalScrollIndicator={false}>
                                {tabs.map((tab) => (
                                    <Pressable
                                        key={tab.id}
                                        onPress={() => setActiveTab(tab.id)}
                                        style={[
                                            styles.tab,
                                            activeTab === tab.id && styles.activeTab,
                                        ]}
                                    >
                                        <Text style={styles.tabIcon}>
                                            {tab.id === "all" ? "📊" : tab.label}
                                        </Text>
                                        <Text style={[
                                            styles.tabCount,
                                            activeTab === tab.id && styles.activeTabCount
                                        ]}>
                                            {tab.count}
                                        </Text>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        </View>

                        {/* User List */}
                        <View style={styles.userListContainer}>
                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.userList}>
                                {usersToDisplay.map((u) => {
                                    const member = membersById[u.userId];
                                    return (
                                        <View key={u.userId} style={styles.userItem}>
                                            <View style={styles.userInfo}>
                                                <Image
                                                    source={{ uri: member?.avatar || "https://i.pravatar.cc/150" }}
                                                    style={styles.avatar}
                                                />
                                                <View>
                                                    <Text style={styles.userName} numberOfLines={1}>
                                                        {member?.nickname || member?.username || `User ${u.userId}`}
                                                    </Text>
                                                    <Text style={styles.userHandle} numberOfLines={1}>
                                                        @{member?.username || "unknown"}
                                                    </Text>
                                                </View>
                                            </View>
                                            <View style={styles.userReactions}>
                                                <View style={styles.emojisRow}>
                                                    {u.emojis.map((emoji, idx) => (
                                                        <Text key={idx} style={styles.reactionEmoji}>
                                                            {emoji}
                                                        </Text>
                                                    ))}
                                                </View>
                                                {u.total > 1 && (
                                                    <Text style={styles.totalCount}>{u.total}</Text>
                                                )}
                                            </View>
                                        </View>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    content: {
        width: "100%",
        maxWidth: 400,
        height: SCREEN_HEIGHT * 0.6,
        backgroundColor: "white",
        borderRadius: 24,
        overflow: "hidden",
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#F3F4F6",
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: "700",
        color: "#111827",
    },
    closeButton: {
        padding: 4,
    },
    body: {
        flex: 1,
        flexDirection: "row",
    },
    sidebar: {
        width: 80,
        backgroundColor: "#F9FAFB",
        borderRightWidth: 1,
        borderRightColor: "#F3F4F6",
    },
    tab: {
        alignItems: "center",
        paddingVertical: 16,
        borderLeftWidth: 3,
        borderLeftColor: "transparent",
    },
    activeTab: {
        backgroundColor: "white",
        borderLeftColor: "#3B82F6",
    },
    tabIcon: {
        fontSize: 20,
        marginBottom: 4,
    },
    tabCount: {
        fontSize: 12,
        fontWeight: "600",
        color: "#6B7280",
    },
    activeTabCount: {
        color: "#3B82F6",
    },
    userListContainer: {
        flex: 1,
    },
    userList: {
        padding: 16,
    },
    userItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 20,
    },
    userInfo: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        marginRight: 12,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: 12,
        backgroundColor: "#F3F4F6",
    },
    userName: {
        fontSize: 15,
        fontWeight: "600",
        color: "#111827",
        marginBottom: 2,
    },
    userHandle: {
        fontSize: 12,
        color: "#6B7280",
    },
    userReactions: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F3F4F6",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
    },
    emojisRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    reactionEmoji: {
        fontSize: 16,
        marginLeft: -2,
    },
    totalCount: {
        fontSize: 12,
        fontWeight: "700",
        color: "#4B5563",
        marginLeft: 6,
    },
});
