import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "@/constants";
import userService from "@/services/userService";
import pageService from "@/services/pageService";
import { buildS3Url } from "@/utils/s3";

type SearchResult = {
  id: string;
  type: "user" | "page";
  name: string;
  username?: string;
  avatarUrl?: string;
};

export default function ZaloTopBar() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchFocused, setSearchFocused] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const [users, pages] = await Promise.all([
        userService.searchUserByUsername(q).catch(() => []),
        pageService.getAllPages().catch(() => []),
      ]);

      const userResults: SearchResult[] = (Array.isArray(users) ? users : []).map(
        (u: any) => ({
          id: String(u.id),
          type: "user" as const,
          name: u.name || u.fullName || u.username,
          username: u.username,
          avatarUrl: u.avatarUrl,
        })
      );

      const pageResults: SearchResult[] = (Array.isArray(pages) ? pages : [])
        .filter((p: any) =>
          p.name?.toLowerCase().includes(q.toLowerCase()) ||
          p.username?.toLowerCase().includes(q.toLowerCase())
        )
        .slice(0, 5)
        .map((p: any) => ({
          id: String(p.id),
          type: "page" as const,
          name: p.name,
          username: p.username,
          avatarUrl: p.avatarUrl,
        }));

      setResults([...userResults.slice(0, 5), ...pageResults]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  const handleSelect = (item: SearchResult) => {
    setSearchFocused(false);
    setQuery("");
    setResults([]);
    if (item.type === "user") {
      router.push({
        pathname: "/(tabs)/user-profile",
        params: { userId: item.id, username: item.username },
      });
    } else {
      router.push({
        pathname: "/(stack)/page-detail",
        params: { pageId: item.id },
      });
    }
  };

  return (
    <View style={[s.wrapper, { paddingTop: insets.top }]}>
      <View style={s.bar}>
        {/* Logo */}
        <Text style={s.logo}>Wisdom</Text>

        {/* Search */}
        <View style={s.searchWrap}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Tim kiem..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
          />
        </View>

        {/* Actions */}
        <View style={s.actions}>
          <TouchableOpacity
            style={s.iconBtn}
            onPress={() => router.push("/(stack)/create-post")}
          >
            <Ionicons name="add-circle-outline" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.iconBtn}
            onPress={() => router.push("/(stack)/pages")}
          >
            <Ionicons name="flag-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.iconBtn}
            onPress={() => router.push("/(stack)/notifications")}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search dropdown */}
      {searchFocused && (query.length >= 2 || results.length > 0) && (
        <View style={s.dropdown}>
          {searching ? (
            <View style={s.dropdownCenter}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : results.length === 0 ? (
            <View style={s.dropdownCenter}>
              <Text style={s.noResult}>Khong tim thay ket qua</Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => `${item.type}-${item.id}`}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.resultRow}
                  onPress={() => handleSelect(item)}
                >
                  {item.avatarUrl ? (
                    <Image
                      source={{ uri: buildS3Url(item.avatarUrl) }}
                      style={s.resultAvatar}
                    />
                  ) : (
                    <View style={s.resultAvatarFallback}>
                      <Ionicons
                        name={item.type === "user" ? "person" : "flag"}
                        size={16}
                        color={colors.textMuted}
                      />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={s.resultName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.username && (
                      <Text style={s.resultSub}>@{item.username}</Text>
                    )}
                  </View>
                  <View
                    style={[
                      s.typeBadge,
                      item.type === "page" && { backgroundColor: colors.zalo50 },
                    ]}
                  >
                    <Text
                      style={[
                        s.typeBadgeText,
                        item.type === "page" && { color: colors.primary },
                      ]}
                    >
                      {item.type === "user" ? "Nguoi dung" : "Trang"}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    zIndex: 100,
  },
  bar: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
  },
  logo: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.primary,
  },
  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F0F0",
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 36,
  },
  searchInput: {
    flex: 1,
    marginLeft: 6,
    fontSize: 14,
    color: colors.text,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    maxHeight: 320,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 200,
  },
  dropdownCenter: {
    paddingVertical: 24,
    alignItems: "center",
  },
  noResult: {
    fontSize: 14,
    color: colors.textMuted,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  resultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  resultAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  resultName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  resultSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.textMuted,
  },
});
