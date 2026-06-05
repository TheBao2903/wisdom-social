import { useEffect, useRef } from 'react';
import websocketService from '../services/websocket';

export interface PagePostRealtimeEvent {
    eventType: "PAGE_POST_SUBMITTED" | "PAGE_POST_APPROVED" | "PAGE_POST_REJECTED" | "PAGE_POST_REMOVED";
    pageId: number;
    postId: string;
    post?: Record<string, unknown>;
    userId?: number;
}

interface UseRealtimePagePostsProps {
    pageId: number | null;
    onPostSubmitted?: (postId: string, post?: Record<string, unknown>) => void;
    onPostApproved?: (postId: string, post?: Record<string, unknown>) => void;
    onPostRejected?: (postId: string) => void;
    onPostRemoved?: (postId: string) => void;
}

/**
 * useRealtimePagePosts
 *
 * Subscribe WebSocket topic `/topic/page/{pageId}/posts` để nhận real-time
 * events cho bài viết của page:
 *  - PAGE_POST_SUBMITTED : bài viết mới được gửi lên (vào pending queue)
 *  - PAGE_POST_APPROVED  : bài viết được admin duyệt → chuyển sang approved
 *  - PAGE_POST_REJECTED  : bài viết bị từ chối → xóa khỏi pending queue
 *  - PAGE_POST_REMOVED   : bài viết bị xóa khỏi approved list
 *
 * Dùng useRef cho callbacks để tránh re-subscribe khi callbacks thay đổi.
 */
export function useRealtimePagePosts({
    pageId,
    onPostSubmitted,
    onPostApproved,
    onPostRejected,
    onPostRemoved,
}: UseRealtimePagePostsProps) {
    // Giữ callbacks trong ref để tránh re-subscribe mỗi lần render
    const callbacksRef = useRef({ onPostSubmitted, onPostApproved, onPostRejected, onPostRemoved });
    callbacksRef.current = { onPostSubmitted, onPostApproved, onPostRejected, onPostRemoved };

    useEffect(() => {
        if (!pageId) return;

        let cancelled = false;

        const handleEvent = (event: PagePostRealtimeEvent) => {
            console.log('📡 [Web] Realtime Page Post Event:', event);
            const { eventType, postId, post } = event;

            switch (eventType) {
                case 'PAGE_POST_SUBMITTED':
                    callbacksRef.current.onPostSubmitted?.(postId, post);
                    break;
                case 'PAGE_POST_APPROVED':
                    callbacksRef.current.onPostApproved?.(postId, post);
                    break;
                case 'PAGE_POST_REJECTED':
                    callbacksRef.current.onPostRejected?.(postId);
                    break;
                case 'PAGE_POST_REMOVED':
                    callbacksRef.current.onPostRemoved?.(postId);
                    break;
            }
        };

        const setup = async () => {
            try {
                if (!websocketService.isConnected()) {
                    await websocketService.connect();
                }
                if (cancelled) return;
                websocketService.subscribeToPagePosts(pageId, handleEvent as any);
            } catch (err) {
                console.error(`❌ [Web] WebSocket setup failed for page posts ${pageId}:`, err);
            }
        };

        void setup();

        return () => {
            cancelled = true;
            websocketService.unsubscribeFromPagePosts(pageId);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageId]);
}

export default useRealtimePagePosts;
