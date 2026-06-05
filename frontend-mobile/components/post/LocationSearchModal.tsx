import React, { useCallback, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants";

interface LocationResult {
    display_name: string;
    lat: string;
    lon: string;
}

interface Props {
    visible: boolean;
    onClose: () => void;
    onSelect: (location: string) => void;
    initialValue?: string;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export default function LocationSearchModal({ visible, onClose, onSelect, initialValue = "" }: Props) {
    const [query, setQuery] = useState(initialValue);
    const [results, setResults] = useState<LocationResult[]>([]);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const search = useCallback(async (text: string) => {
        const q = text.trim();
        if (!q || q.length < 2) { setResults([]); return; }
        setLoading(true);
        try {
            const res = await fetch(`${NOMINATIM_URL}?format=json&q=${encodeURIComponent(q)}&limit=8&accept-language=vi`, {
                headers: { "User-Agent": "WisdomSocialApp/1.0" },
            });
            const data: LocationResult[] = await res.json();
            setResults(data);
        } catch {
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleChange = (text: string) => {
        setQuery(text);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => void search(text), 500);
    };

    const handleSelect = (loc: LocationResult) => {
        onSelect(loc.display_name);
        onClose();
    };

    const handleClear = () => {
        onSelect("");
        onClose();
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <View style={s.container}>
                <View style={s.header}>
                    <TouchableOpacity onPress={onClose}><Text style={s.cancel}>Hủy</Text></TouchableOpacity>
                    <Text style={s.title}>Thêm vị trí</Text>
                    <TouchableOpacity onPress={handleClear}><Text style={s.clearText}>Xóa</Text></TouchableOpacity>
                </View>

                <View style={s.searchBox}>
                    <Ionicons name="search" size={16} color="#8E8E93" />
                    <TextInput
                        style={s.searchInput}
                        placeholder="Tìm vị trí..."
                        placeholderTextColor="#8E8E93"
                        value={query}
                        onChangeText={handleChange}
                        autoFocus
                    />
                    {query ? (
                        <TouchableOpacity onPress={() => { setQuery(""); setResults([]); }}>
                            <Ionicons name="close-circle" size={16} color="#8E8E93" />
                        </TouchableOpacity>
                    ) : null}
                </View>

                {loading ? (
                    <ActivityIndicator style={s.loader} color={colors.primary} />
                ) : (
                    <FlatList
                        data={results}
                        keyExtractor={(item, i) => `${item.lat}-${item.lon}-${i}`}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={s.row} onPress={() => handleSelect(item)}>
                                <Ionicons name="location-outline" size={20} color={colors.primary} />
                                <Text style={s.locText} numberOfLines={2}>{item.display_name}</Text>
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={
                            query.trim().length >= 2
                                ? <Text style={s.empty}>Không tìm thấy vị trí phù hợp</Text>
                                : <Text style={s.empty}>Nhập từ khóa để tìm vị trí</Text>
                        }
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
    clearText: { fontSize: 16, fontWeight: "600", color: "#FF3B30" },
    searchBox: { flexDirection: "row", alignItems: "center", gap: 8, margin: 12, paddingHorizontal: 12, height: 38, borderRadius: 10, backgroundColor: "#F2F2F7" },
    searchInput: { flex: 1, fontSize: 14, color: "#000" },
    loader: { marginTop: 40 },
    row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#F2F2F7" },
    locText: { flex: 1, fontSize: 14, color: "#000", lineHeight: 20 },
    empty: { textAlign: "center", color: "#8E8E93", marginTop: 40, fontSize: 14 },
});
