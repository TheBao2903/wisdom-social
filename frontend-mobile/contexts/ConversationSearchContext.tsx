import chatService from "@/services/chatService";
import type { MessageSearchResult } from "@/types/chat";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";

interface ConversationSearchContextValue {
    keyword: string;
    results: MessageSearchResult[];
    currentIndex: number;
    senderId: number | null;
    fromDate: string | null;
    toDate: string | null;
    nextCursor: string | null;
    hasMore: boolean;
    loading: boolean;
    search: (keyword: string) => Promise<void>;
    setSenderFilter: (senderId: number | null) => Promise<void>;
    setDateFilter: (fromDate: string | null, toDate: string | null) => Promise<void>;
    selectResult: (index: number) => Promise<void>;
    loadMore: () => Promise<void>;
    next: () => Promise<void>;
    prev: () => Promise<void>;
    clear: () => void;
}

const ConversationSearchContext =
    createContext<ConversationSearchContextValue | null>(null);

const SEARCH_LIMIT = 5;

export function ConversationSearchProvider({
    conversationId,
    jumpToMessage,
    children,
}: {
    conversationId: number;
    jumpToMessage: (messageId: string) => Promise<void>;
    children: ReactNode;
}) {
    const [keyword, setKeyword] = useState("");
    const [results, setResults] = useState<MessageSearchResult[]>([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [senderId, setSenderId] = useState<number | null>(null);
    const [fromDate, setFromDate] = useState<string | null>(null);
    const [toDate, setToDate] = useState<string | null>(null);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(false);
    const requestIdRef = useRef(0);

    const clear = useCallback(() => {
        requestIdRef.current += 1;
        setKeyword("");
        setResults([]);
        setCurrentIndex(-1);
        setSenderId(null);
        setFromDate(null);
        setToDate(null);
        setNextCursor(null);
        setHasMore(false);
        setLoading(false);
    }, []);

    useEffect(() => {
        const timer = setTimeout(clear, 0);
        return () => clearTimeout(timer);
    }, [clear, conversationId]);

    const search = useCallback(
        async (nextKeyword: string) => {
            const trimmed = nextKeyword.trim();
            requestIdRef.current += 1;
            const requestId = requestIdRef.current;
            if (!trimmed) {
                clear();
                return;
            }

            setLoading(true);
            setKeyword(trimmed);
            try {
                const response = await chatService.searchMessages(
                    conversationId,
                    trimmed,
                    senderId,
                    fromDate,
                    toDate,
                    null,
                    SEARCH_LIMIT,
                );
                if (requestId !== requestIdRef.current) return;

                setResults(response.items);
                setNextCursor(response.nextCursor);
                setHasMore(response.hasMore);
                setCurrentIndex(response.items.length > 0 ? 0 : -1);

                if (response.items[0]) {
                    await jumpToMessage(response.items[0].messageId);
                }
            } finally {
                if (requestId === requestIdRef.current) {
                    setLoading(false);
                }
            }
        },
        [clear, conversationId, fromDate, jumpToMessage, senderId, toDate],
    );

    const runFreshSearch = useCallback(
        async (
            activeKeyword: string,
            activeSenderId: number | null,
            activeFromDate: string | null,
            activeToDate: string | null,
        ) => {
            requestIdRef.current += 1;
            const requestId = requestIdRef.current;
            setLoading(true);
            try {
                const response = await chatService.searchMessages(
                    conversationId,
                    activeKeyword,
                    activeSenderId,
                    activeFromDate,
                    activeToDate,
                    null,
                    SEARCH_LIMIT,
                );
                if (requestId !== requestIdRef.current) return;

                setResults(response.items);
                setNextCursor(response.nextCursor);
                setHasMore(response.hasMore);
                setCurrentIndex(response.items.length > 0 ? 0 : -1);

                if (response.items[0]) {
                    await jumpToMessage(response.items[0].messageId);
                }
            } finally {
                if (requestId === requestIdRef.current) {
                    setLoading(false);
                }
            }
        },
        [conversationId, jumpToMessage],
    );

    const setSenderFilter = useCallback(
        async (nextSenderId: number | null) => {
            setSenderId(nextSenderId);
            if (!keyword.trim()) {
                setResults([]);
                setCurrentIndex(-1);
                setNextCursor(null);
                setHasMore(false);
                return;
            }

            await runFreshSearch(keyword, nextSenderId, fromDate, toDate);
        },
        [fromDate, keyword, runFreshSearch, toDate],
    );

    const setDateFilter = useCallback(
        async (nextFromDate: string | null, nextToDate: string | null) => {
            setFromDate(nextFromDate);
            setToDate(nextToDate);
            if (!keyword.trim()) {
                setResults([]);
                setCurrentIndex(-1);
                setNextCursor(null);
                setHasMore(false);
                return;
            }

            await runFreshSearch(keyword, senderId, nextFromDate, nextToDate);
        },
        [keyword, runFreshSearch, senderId],
    );

    const selectResult = useCallback(async (index: number) => {
        if (loading) return;
        const selected = results[index];
        if (!selected) return;
        setCurrentIndex(index);
        await jumpToMessage(selected.messageId);
    }, [jumpToMessage, loading, results]);

    const loadMore = useCallback(async () => {
        if (loading || !hasMore || !nextCursor || !keyword.trim()) return;

        setLoading(true);
        try {
            const response = await chatService.searchMessages(
                conversationId,
                keyword,
                senderId,
                fromDate,
                toDate,
                nextCursor,
                SEARCH_LIMIT,
            );
            const appendedIndex = results.length;
            const nextResults = [...results, ...response.items];
            setResults(nextResults);
            setNextCursor(response.nextCursor);
            setHasMore(response.hasMore);

            const appended = nextResults[appendedIndex];
            if (appended) {
                setCurrentIndex(appendedIndex);
                await jumpToMessage(appended.messageId);
            }
        } finally {
            setLoading(false);
        }
    }, [conversationId, fromDate, hasMore, jumpToMessage, keyword, loading, nextCursor, results, senderId, toDate]);

    const next = useCallback(async () => {
        if (loading) return;
        const loadedNextIndex = currentIndex + 1;
        const loadedResult = results[loadedNextIndex];
        if (loadedResult) {
            await selectResult(loadedNextIndex);
            return;
        }

        await loadMore();
    }, [currentIndex, loadMore, loading, results, selectResult]);

    const prev = useCallback(async () => {
        if (loading || currentIndex <= 0) return;
        const previousIndex = currentIndex - 1;
        const previous = results[previousIndex];
        if (!previous) return;
        setCurrentIndex(previousIndex);
        await jumpToMessage(previous.messageId);
    }, [currentIndex, jumpToMessage, loading, results]);

    const value = useMemo(
        () => ({
            keyword,
            results,
            currentIndex,
            senderId,
            fromDate,
            toDate,
            nextCursor,
            hasMore,
            loading,
            search,
            setSenderFilter,
            setDateFilter,
            selectResult,
            loadMore,
            next,
            prev,
            clear,
        }),
        [clear, currentIndex, fromDate, hasMore, keyword, loading, loadMore, next, nextCursor, prev, results, search, selectResult, senderId, setDateFilter, setSenderFilter, toDate],
    );

    return (
        <ConversationSearchContext.Provider value={value}>
            {children}
        </ConversationSearchContext.Provider>
    );
}

export function useConversationSearch() {
    const context = useContext(ConversationSearchContext);
    if (!context) {
        throw new Error("useConversationSearch must be used inside ConversationSearchProvider");
    }
    return context;
}
