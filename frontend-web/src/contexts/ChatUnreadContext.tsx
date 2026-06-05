import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import chatService from "../services/chatService";
import websocketService, { type LastMessageUpdate, type MessageSeenEvent } from "../services/websocket";

interface ChatUnreadContextValue {
    unreadCount: number;
    refreshUnreadCount: () => Promise<void>;
    clearConversationUnread: (conversationId: number) => void;
}

const ChatUnreadContext = createContext<ChatUnreadContextValue>({
    unreadCount: 0,
    refreshUnreadCount: async () => {},
    clearConversationUnread: () => {},
});

function getSelectedMessagesConversationId(pathname: string): number | null {
    const match = pathname.match(/^\/messages\/(\d+)/);
    if (!match) return null;

    const conversationId = Number(match[1]);
    return Number.isFinite(conversationId) ? conversationId : null;
}

export function ChatUnreadProvider({ children }: { children: ReactNode }) {
    const { currentUser } = useAuth();
    const location = useLocation();
    const [unreadByConversation, setUnreadByConversation] = useState<Record<number, number>>({});
    const isMessagesRoute = location.pathname.startsWith("/messages");

    const refreshUnreadCount = useCallback(async () => {
        if (!currentUser?.id) {
            setUnreadByConversation({});
            return;
        }
        const response = await chatService.getConversations(currentUser.id);
        const conversations = response.data ?? [];
        const next: Record<number, number> = {};
        conversations.forEach((conversation) => {
            next[conversation.id] = conversation.unreadCount ?? 0;
        });
        setUnreadByConversation(next);
    }, [currentUser?.id]);

    const clearConversationUnread = useCallback((conversationId: number) => {
        setUnreadByConversation((prev) => {
            if ((prev[conversationId] ?? 0) === 0) {
                return prev;
            }
            return {
                ...prev,
                [conversationId]: 0,
            };
        });
    }, []);

    useEffect(() => {
        void refreshUnreadCount();
    }, [refreshUnreadCount, isMessagesRoute]);

    useEffect(() => {
        if (!currentUser?.id) return;
        const userId = Number(currentUser.id);
        let cancelled = false;

        const handleConversationUpdate = (
            conversationId: number,
            lastMessage: LastMessageUpdate,
        ) => {
            const lastSenderId = Number(lastMessage.lastSenderId ?? 0);
            if (lastSenderId === userId) {
                return;
            }
            const selectedConversationId = getSelectedMessagesConversationId(
                window.location.pathname,
            );
            if (selectedConversationId === conversationId) {
                setUnreadByConversation((prev) => ({
                    ...prev,
                    [conversationId]: 0,
                }));
                return;
            }
            setUnreadByConversation((prev) => ({
                ...prev,
                [conversationId]: (prev[conversationId] ?? 0) + 1,
            }));
        };

        const subscribe = async () => {
            await websocketService.connect();
            if (cancelled) return;
            websocketService.subscribeToUserConversations(userId, handleConversationUpdate);
        };

        void subscribe();

        return () => {
            cancelled = true;
            websocketService.unsubscribeFromUserConversations(userId, handleConversationUpdate);
        };
    }, [currentUser?.id]);

    useEffect(() => {
        if (!currentUser?.id) return;
        const userId = Number(currentUser.id);
        const unreadConversationIds = Object.entries(unreadByConversation)
            .filter(([, count]) => count > 0)
            .map(([conversationId]) => Number(conversationId))
            .filter((conversationId) => Number.isFinite(conversationId));

        if (unreadConversationIds.length === 0) return;

        let cancelled = false;
        const handleMessageSeen = (event: MessageSeenEvent) => {
            const payload = event.messageSeenResponse;
            if (Number(payload.userId) !== userId) return;
            clearConversationUnread(Number(payload.conversationId));
        };

        const subscribe = async () => {
            await websocketService.connect();
            if (cancelled) return;
            unreadConversationIds.forEach((conversationId) => {
                websocketService.subscribeToConversationSeen(
                    conversationId,
                    handleMessageSeen,
                );
            });
        };

        void subscribe();

        return () => {
            cancelled = true;
            unreadConversationIds.forEach((conversationId) => {
                websocketService.unsubscribeFromConversationSeen(
                    conversationId,
                    handleMessageSeen,
                );
            });
        };
    }, [clearConversationUnread, currentUser?.id, unreadByConversation]);

    const unreadCount = useMemo(
        () => Object.values(unreadByConversation).reduce((sum, count) => sum + count, 0),
        [unreadByConversation],
    );

    return (
        <ChatUnreadContext.Provider value={{ unreadCount, refreshUnreadCount, clearConversationUnread }}>
            {children}
        </ChatUnreadContext.Provider>
    );
}

export function useChatUnread() {
    return useContext(ChatUnreadContext);
}
