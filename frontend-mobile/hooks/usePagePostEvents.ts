import { useEffect, useRef } from "react";
import chatWebsocketService from "@/services/chatWebsocketService";
import pageWebsocketService, { type PagePostEvent } from "@/services/pageWebsocketService";

/**
 * usePagePostEvents
 *
 * Subscribe WebSocket topic `/topic/page/{pageId}/posts` để nhận real-time
 * events cho bài viết của page — theo đúng pattern của usePageEvents.ts:
 *   setup → connect → subscribeToPagePosts → cleanup khi unmount/pageId thay đổi
 *
 * Callbacks:
 *  - onPostSubmitted : bài viết mới gửi lên (vào pending queue)
 *  - onPostApproved  : bài viết được admin duyệt
 *  - onPostRejected  : bài viết bị từ chối
 *  - onPostRemoved   : bài viết bị xóa khỏi approved list
 */
export function usePagePostEvents(options: {
    pageId?: number;
    onPostSubmitted?: (postId: string, post?: Record<string, unknown>) => void;
    onPostApproved?: (postId: string, post?: Record<string, unknown>) => void;
    onPostRejected?: (postId: string) => void;
    onPostRemoved?: (postId: string) => void;
}): void {
    const { pageId } = options;
    const callbacksRef = useRef(options);
    callbacksRef.current = options;

    useEffect(() => {
        if (!pageId) return;

        let cancelled = false;
        let currentHandler: ((event: PagePostEvent) => void) | null = null;

        const setup = async () => {
            try {
                await chatWebsocketService.connect();
            } catch {
                // connect() may throw if all candidates fail; subscriptions will
                // be synced on the next reconnect.
            }

            if (cancelled) return;

            const handler = (event: PagePostEvent) => {
                console.log("📡 [Mobile] Realtime Page Post Event:", event);
                const { eventType, postId, post } = event;

                switch (eventType) {
                    case "PAGE_POST_SUBMITTED":
                        callbacksRef.current.onPostSubmitted?.(postId, post);
                        break;
                    case "PAGE_POST_APPROVED":
                        callbacksRef.current.onPostApproved?.(postId, post);
                        break;
                    case "PAGE_POST_REJECTED":
                        callbacksRef.current.onPostRejected?.(postId);
                        break;
                    case "PAGE_POST_REMOVED":
                        callbacksRef.current.onPostRemoved?.(postId);
                        break;
                }
            };

            currentHandler = handler;
            pageWebsocketService.subscribeToPagePosts(pageId, handler);
        };

        void setup();

        return () => {
            cancelled = true;
            if (pageId && currentHandler) {
                pageWebsocketService.unsubscribeFromPagePosts(pageId, currentHandler);
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageId]);
}
