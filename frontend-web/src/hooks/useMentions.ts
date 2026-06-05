import { useState, useCallback, useRef, useEffect } from "react";
import * as postApi from "../services/postService";
import type { UserData } from "../types/post";

/**
 * Structured mention data for backend
 */
export interface MentionData {
    userId: string;
    username: string;
}

/**
 * Production-ready hook for managing mention suggestions with pagination (friends only)
 */
export function useMentions(viewerId: string) {
    const [mentionUsers, setMentionUsers] = useState<UserData[]>([]);
    const [showMentionDropdown, setShowMentionDropdown] = useState(false);
    const [mentionQuery, setMentionQuery] = useState("");
    const [mentionStartIndex, setMentionStartIndex] = useState(-1);

    // Pagination & Loading state
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);

    // Store all mentions that were explicitly selected from the dropdown
    const [activeMentions, setActiveMentions] = useState<MentionData[]>([]);

    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    /**
     * Fetches users from the API
     */
    const fetchUsers = useCallback(async (query: string, pageNum: number) => {
        setLoading(true);
        try {
            const res = await postApi.searchMentionUsers(viewerId, query, pageNum, 10);

            setMentionUsers(prev => {
                if (pageNum === 0) return res.data;
                // Filter unique to avoid duplicates on scroll
                const existingIds = new Set(prev.map(u => u.id));
                const newUsers = res.data.filter(u => !existingIds.has(u.id));
                return [...prev, ...newUsers];
            });

            setHasMore(res.hasMore);
            setPage(pageNum + 1);
        } catch (error) {
            console.error("❌ Error fetching users for mention:", error);
        } finally {
            setLoading(false);
        }
    }, [viewerId]);

    /**
     * Detects if cursor is at a mention point (@keyword)
     */
    const handleTextChange = useCallback((text: string, cursorPos: number) => {
        // 1. Real-time pruning of active mentions
        setActiveMentions(prev => prev.filter(m => {
            const escapedUsername = m.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const mentionText = `@${escapedUsername}`;
            // Exact match followed by whitespace, punctuation, or end of string
            // Removed 'g' flag and added 'u' flag for better Unicode support
            const regex = new RegExp(`${mentionText}(\\s|$|[.,!?;:])`, 'u');
            return regex.test(text);
        }));

        const textBeforeCursor = text.substring(0, cursorPos);
        // Regex: Matches @ followed by any non-whitespace characters at the end of the string
        const match = textBeforeCursor.match(/@([^\s@]*)$/);

        if (match) {
            const query = match[1];
            const lastAtIndex = textBeforeCursor.lastIndexOf("@");

            // Check if query changed to reset pagination
            if (query !== mentionQuery || !showMentionDropdown) {
                setMentionQuery(query);
                setMentionStartIndex(lastAtIndex);
                setShowMentionDropdown(true);

                // Reset pagination for new search
                setPage(0);
                setHasMore(true);
                setMentionUsers([]);

                // ⚡ Debounce API search (300ms)
                if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

                searchTimeoutRef.current = setTimeout(() => {
                    fetchUsers(query, 0);
                }, 300);
            }
        } else {
            setShowMentionDropdown(false);
            setMentionQuery("");
            setMentionStartIndex(-1);
            setMentionUsers([]);
            setPage(0);
            setHasMore(true);
        }
    }, [mentionQuery, showMentionDropdown, fetchUsers]);

    /**
     * Load more users for current query (infinite scroll)
     */
    const loadMore = useCallback(() => {
        if (!loading && hasMore && mentionQuery !== null) {
            fetchUsers(mentionQuery, page);
        }
    }, [loading, hasMore, mentionQuery, page, fetchUsers]);

    /**
     * Replaces the @keyword with @username and tracks the mention
     */
    const selectUser = useCallback((text: string, user: UserData) => {
        if (mentionStartIndex === -1) return { newValue: text, newCursorPos: text.length };

        const textBeforeMention = text.substring(0, mentionStartIndex);
        const textAfterMention = text.substring(mentionStartIndex + mentionQuery.length + 1);

        const newValue = textBeforeMention + `@${user.username} ` + textAfterMention;
        const newCursorPos = mentionStartIndex + user.username.length + 2;

        setActiveMentions(prev => {
            const exists = prev.some(m => m.userId === user.id.toString());
            if (exists) return prev;
            return [...prev, { userId: user.id.toString(), username: user.username }];
        });

        setShowMentionDropdown(false);
        setMentionUsers([]);
        setMentionStartIndex(-1);
        setMentionQuery("");
        setPage(0);
        setHasMore(true);

        return { newValue, newCursorPos };
    }, [mentionStartIndex, mentionQuery]);

    const getFinalMentions = useCallback((finalText: string): MentionData[] => {
        return activeMentions.filter(m => {
            const escapedUsername = m.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const mentionText = `@${escapedUsername}`;
            // Exact match followed by whitespace, punctuation, or end of string
            const regex = new RegExp(`${mentionText}(\\s|$|[.,!?;:])`, 'u');
            return regex.test(finalText);
        });
    }, [activeMentions]);

    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        };
    }, []);

    return {
        mentionUsers,
        showMentionDropdown,
        activeMentions,
        mentionLoading: loading,
        mentionHasMore: hasMore,
        mentionQuery,
        handleTextChange,
        selectUser,
        getFinalMentions,
        setActiveMentions,
        loadMoreMentions: loadMore
    };
}

export default useMentions;
