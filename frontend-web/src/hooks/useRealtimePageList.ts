import { useEffect, useRef } from 'react';
import websocketService from '../services/websocket';

export interface PageListRealtimeEvent {
    eventType: "PAGE_CREATED" | "PAGE_UPDATED" | "PAGE_DELETED";
    pageId: number;
    page?: Record<string, unknown>;
    timestamp?: string;
}

interface UseRealtimePageListProps {
    onPageCreated?: (pageId: number, page?: Record<string, unknown>) => void;
    onPageUpdated?: (pageId: number, page?: Record<string, unknown>) => void;
    onPageDeleted?: (pageId: number) => void;
}

/**
 * useRealtimePageList
 *
 * Subscribe WebSocket topic `/topic/pages` để nhận real-time events
 * khi page được tạo mới / cập nhật / xóa.
 *
 * Dùng useRef cho callbacks để tránh re-subscribe mỗi lần render.
 */
export function useRealtimePageList({
    onPageCreated,
    onPageUpdated,
    onPageDeleted,
}: UseRealtimePageListProps) {
    const callbacksRef = useRef({ onPageCreated, onPageUpdated, onPageDeleted });
    callbacksRef.current = { onPageCreated, onPageUpdated, onPageDeleted };

    useEffect(() => {
        let cancelled = false;

        const handleEvent = (event: PageListRealtimeEvent) => {
            console.log('📡 [Web] Realtime Event received:', event);
            if (event.page) {
                console.log('📡 [Web] Page object in event:', {
                    id: (event.page as any)?.id,
                    name: (event.page as any)?.name,
                    avatarUrl: (event.page as any)?.avatarUrl,
                    coverUrl: (event.page as any)?.coverUrl,
                    updatedAt: (event.page as any)?.updatedAt,
                });
            }
            const { eventType, pageId, page } = event;

            switch (eventType) {
                case 'PAGE_CREATED':
                    console.log('📡 [Web] Dispatching PAGE_CREATED callback');
                    callbacksRef.current.onPageCreated?.(pageId, page);
                    break;
                case 'PAGE_UPDATED':
                    console.log('📡 [Web] Dispatching PAGE_UPDATED callback');
                    callbacksRef.current.onPageUpdated?.(pageId, page);
                    break;
                case 'PAGE_DELETED':
                    console.log('📡 [Web] Dispatching PAGE_DELETED callback');
                    callbacksRef.current.onPageDeleted?.(pageId);
                    break;
            }
        };

        const setup = async () => {
            try {
                if (!websocketService.isConnected()) {
                    await websocketService.connect();
                }
                if (cancelled) return;
                websocketService.subscribeToPageList(handleEvent as any);
            } catch (err) {
                console.error('❌ [Web] WebSocket setup failed for page list:', err);
            }
        };

        void setup();

        return () => {
            cancelled = true;
            websocketService.unsubscribeFromPageList();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}

export default useRealtimePageList;
