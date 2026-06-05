import React, { useCallback, useEffect, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing } from "@/constants";
import friendService, { FriendUser } from "@/services/friendService";
import { buildS3Url } from "@/utils/s3";

interface Props {
    visible: boolean;
    onClose: () => void;
    onDone: (selectedIds: string[]) => void;
    currentUserId: string;
    initialSelected?: string[];
    title?: string;
    description?: string;
}

export default function FriendSelectorModal({
    visible,
    onClose,
    onDone,
    currentUserId,
    initialSelected = [],
    title = "Tag bạn bè",
    description = "Tìm kiếm bạn bè để gắn thẻ"
}: Props) {
    const [friends, setFriends] = useState<FriendUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!visible) return;
        setSelected(new Set(initialSelected));
        setQuery("");
        const load = async () => {
            setLoading(true);
            try {
                const list = await friendService.getFriends(Number(currentUserId));
                setFriends(list);
            } catch { /* silent */ } finally {
                setLoading(false);
            }
        };
        void load();
    }, [visible, currentUserId, initialSelected]);

    const filtered = query.trim()
        ? friends.filter(f => {
            const q = query.toLowerCase();
            return (f.name || "").toLowerCase().includes(q) || (f.username || "").toLowerCase().includes(q);
        })
        : friends;

    const toggle = useCallback((id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    const handleDone = () => {
        onDone(Array.from(selected));
        onClose();
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={s.container}>
                <View style={s.header}>
                    <TouchableOpacity onPress={onClose}><Text style={s.cancel}>Hủy</Text></TouchableOpacity>
                    <Text style={s.title}>{title}</Text>
                    <TouchableOpacity onPress={handleDone}><Text style={s.done}>Xong ({selected.size})</Text></TouchableOpacity>
                </View>

                {description && (
                    <Text style={s.description}>{description}</Text>
                )}

                <View style={s.searchBox}>
                    <Ionicons name="search" size={16} color="#8E8E93" />
                    <TextInput
                        style={s.searchInput}
                        placeholder="Tìm bạn bè..."
                        placeholderTextColor="#8E8E93"
                        value={query}
                        onChangeText={setQuery}
                    />
                </View>

                {loading ? (
                    <ActivityIndicator style={s.loader} color={colors.primary} />
                ) : (
                    <FlatList
                        data={filtered}
                        keyExtractor={item => String(item.id)}
                        renderItem={({ item }) => {
                            const id = String(item.id);
                            const isSelected = selected.has(id);
                            const avatarUri = item.avatarUrl || item.avatar;
                            return (
                                <TouchableOpacity style={s.row} onPress={() => toggle(id)}>
                                    {avatarUri ? (
                                        <Image source={{ uri: buildS3Url(avatarUri) || avatarUri }} style={s.avatar} />
                                    ) : (
                                        <View style={[s.avatar, s.avatarFallback]}>
                                            <Ionicons name="person" size={18} color="#C7C7CC" />
                                        </View>
                                    )}
                                    <View style={s.info}>
                                        <Text style={s.name} numberOfLines={1}>{item.name || item.username || `user${item.id}`}</Text>
                                        {item.username ? <Text style={s.username}>@{item.username}</Text> : null}
                                    </View>
                                    <View style={[s.checkbox, isSelected && s.checkboxActive]}>
                                        {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                                    </View>
                                </TouchableOpacity>
                            );
                        }}
                        ListEmptyComponent={<Text style={s.empty}>Không tìm thấy bạn bè</Text>}
                    />
                )}
            </View>
        </Modal>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E5E5EA" },
    cancel: { fontSize: 16, color: "#8E8E93" },
    title: { fontSize: 17, fontWeight: "700" },
    description: { fontSize: 13, color: "#8E8E93", paddingHorizontal: 16, paddingBottom: 8 },
    done: { fontSize: 16, fontWeight: "600", color: "#0095F6" },
    searchBox: { flexDirection: "row", alignItems: "center", gap: 8, margin: 12, paddingHorizontal: 12, height: 38, borderRadius: 10, backgroundColor: "#F2F2F7" },
    searchInput: { flex: 1, fontSize: 14, color: "#000" },
    loader: { marginTop: 40 },
    row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
    avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#F2F2F7" },
    avatarFallback: { alignItems: "center", justifyContent: "center" },
    info: { flex: 1 },
    name: { fontSize: 15, fontWeight: "600", color: "#000" },
    username: { fontSize: 13, color: "#8E8E93", marginTop: 1 },
    checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: "#C7C7CC", alignItems: "center", justifyContent: "center" },
    checkboxActive: { backgroundColor: "#0095F6", borderColor: "#0095F6" },
    empty: { textAlign: "center", color: "#8E8E93", marginTop: 40, fontSize: 14 },
});
