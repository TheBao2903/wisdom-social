import chatWebsocketService from "@/services/chatWebsocketService";

export type PageEvent = {
    eventType:
        | "PAGE_MEMBER_JOINED"
        | "PAGE_MEMBER_LEFT"
        | "PAGE_MEMBER_BLOCKED"
        | "PAGE_MEMBER_UNBLOCKED"
        | "PAGE_MEMBER_ROLE_CHANGED"
        | "PAGE_JOIN_REQUESTED"
        | "PAGE_JOIN_APPROVED"
        | "PAGE_JOIN_REJECTED"
        | "PAGE_JOIN_CANCELLED";
    pageId: number;
    userId: number;
    newRole?: string;
    timestamp?: string;
};

export type PagePostEvent = {
    eventType:
        | "PAGE_POST_SUBMITTED"
        | "PAGE_POST_APPROVED"
        | "PAGE_POST_REJECTED"
        | "PAGE_POST_REMOVED";
    pageId: number;
    postId: string;
    post?: Record<string, unknown>;
    userId?: number;
    timestamp?: string;
};

export type PageListEvent = {
    eventType: "PAGE_CREATED" | "PAGE_UPDATED" | "PAGE_DELETED";
    pageId?: number;
    page?: Record<string, unknown>;
    timestamp?: string;
};

/**
 * Subscribes to real-time page events.
 * Reuses the existing ChatWebsocketService STOMP connection via the generic
 * subscribeToTopic / unsubscribeFromTopic methods.
 *
 * Topics:
 *   /topic/page/{pageId}/members      — member & join-request events for a page
 *   /topic/user/{userId}/page-events  — personal notifications for the current user
 *   /topic/page/{pageId}/posts        — post submitted/approved/rejected/removed
 *   /topic/pages                      — page created/updated/deleted (global list)
 *
 * Note: subscribeToTopic already parses the JSON body before calling the callback,
 * so callbacks here receive a Record<string, unknown> (not a raw string).
 */
class PageWebsocketService {
    private memberListeners = new Map<number, Set<(event: PageEvent) => void>>();
    private userEventsListeners = new Map<number, Set<(event: PageEvent) => void>>();
    private postListeners = new Map<number, Set<(event: PagePostEvent) => void>>();
    private listListeners = new Set<(event: PageListEvent) => void>();

    // ── Page Members ────────────────────────────────────────────────────────

    subscribeToPageMembers(
        pageId: number,
        onEvent: (event: PageEvent) => void,
    ): void {
        const existing = this.memberListeners.get(pageId);
        if (existing) {
            existing.add(onEvent);
        } else {
            this.memberListeners.set(pageId, new Set([onEvent]));
            const destination = `/topic/page/${pageId}/members`;
            chatWebsocketService.subscribeToTopic(destination, (body) => {
                try {
                    const parsed = JSON.parse(body) as PageEvent;
                    const listeners = this.memberListeners.get(pageId);
                    listeners?.forEach((cb) => cb(parsed));
                } catch {
                    // ignore malformed JSON
                }
            });
        }
    }

    unsubscribeFromPageMembers(pageId: number, onEvent?: (event: PageEvent) => void): void {
        const listeners = this.memberListeners.get(pageId);
        if (listeners && onEvent) {
            listeners.delete(onEvent);
            if (listeners.size > 0) return;
        }
        this.memberListeners.delete(pageId);
        chatWebsocketService.unsubscribeFromTopic(`/topic/page/${pageId}/members`);
    }

    // ── User Page Events ────────────────────────────────────────────────────

    subscribeToUserPageEvents(
        userId: number,
        onEvent: (event: PageEvent) => void,
    ): void {
        const existing = this.userEventsListeners.get(userId);
        if (existing) {
            existing.add(onEvent);
        } else {
            this.userEventsListeners.set(userId, new Set([onEvent]));
            const destination = `/topic/user/${userId}/page-events`;
            chatWebsocketService.subscribeToTopic(destination, (body) => {
                try {
                    const parsed = JSON.parse(body) as PageEvent;
                    const listeners = this.userEventsListeners.get(userId);
                    listeners?.forEach((cb) => cb(parsed));
                } catch {
                    // ignore malformed JSON
                }
            });
        }
    }

    unsubscribeFromUserPageEvents(userId: number, onEvent?: (event: PageEvent) => void): void {
        const listeners = this.userEventsListeners.get(userId);
        if (listeners && onEvent) {
            listeners.delete(onEvent);
            if (listeners.size > 0) return;
        }
        this.userEventsListeners.delete(userId);
        chatWebsocketService.unsubscribeFromTopic(`/topic/user/${userId}/page-events`);
    }

    // ── Page Posts ──────────────────────────────────────────────────────────

    subscribeToPagePosts(
        pageId: number,
        onEvent: (event: PagePostEvent) => void,
    ): void {
        const existing = this.postListeners.get(pageId);
        if (existing) {
            existing.add(onEvent);
        } else {
            this.postListeners.set(pageId, new Set([onEvent]));
            const destination = `/topic/page/${pageId}/posts`;
            chatWebsocketService.subscribeToTopic(destination, (body) => {
                try {
                    const parsed = JSON.parse(body) as PagePostEvent;
                    const listeners = this.postListeners.get(pageId);
                    listeners?.forEach((cb) => cb(parsed));
                } catch {
                    // ignore malformed JSON
                }
            });
        }
    }

    unsubscribeFromPagePosts(pageId: number, onEvent?: (event: PagePostEvent) => void): void {
        const listeners = this.postListeners.get(pageId);
        if (listeners && onEvent) {
            listeners.delete(onEvent);
            if (listeners.size > 0) return;
        }
        this.postListeners.delete(pageId);
        chatWebsocketService.unsubscribeFromTopic(`/topic/page/${pageId}/posts`);
    }

    // ── Page List ───────────────────────────────────────────────────────────

    subscribeToPageList(onEvent: (event: PageListEvent) => void): void {
        if (this.listListeners.size === 0) {
            this.listListeners.add(onEvent);
            const destination = `/topic/pages`;
            chatWebsocketService.subscribeToTopic(destination, (body) => {
                try {
                    const parsed = JSON.parse(body) as PageListEvent;
                    this.listListeners.forEach((cb) => cb(parsed));
                } catch {
                    // ignore malformed JSON
                }
            });
        } else {
            this.listListeners.add(onEvent);
        }
    }

    unsubscribeFromPageList(onEvent?: (event: PageListEvent) => void): void {
        if (onEvent) {
            this.listListeners.delete(onEvent);
            if (this.listListeners.size > 0) return;
        }
        this.listListeners.clear();
        chatWebsocketService.unsubscribeFromTopic(`/topic/pages`);
    }
}

const pageWebsocketService = new PageWebsocketService();
export default pageWebsocketService;
