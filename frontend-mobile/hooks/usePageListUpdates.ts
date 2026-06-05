import { useEffect, useRef } from "react";
import pageWebsocketService, { type PageListEvent } from "@/services/pageWebsocketService";

/**
 * Subscribes to global page list updates (/topic/pages).
 * 
 * Triggers a callback when a specific page is updated/created/deleted.
 * Useful for page detail/edit screens to auto-refresh when page info changes.
 * 
 * @param options.pageId - Page ID to monitor for updates
 * @param options.onPageUpdated - Callback when monitored page is updated
 * @param options.onPageCreated - Callback when a page is created
 * @param options.onPageDeleted - Callback when monitored page is deleted
 */
export function usePageListUpdates(options: {
    pageId?: number;
    onPageUpdated?: (event: PageListEvent) => void;
    onPageCreated?: (event: PageListEvent) => void;
    onPageDeleted?: (event: PageListEvent) => void;
}): void {
    const { pageId, onPageUpdated, onPageCreated, onPageDeleted } = options;
    const handlerRef = useRef<(event: PageListEvent) => void>(() => {});

    useEffect(() => {
        let cancelled = false;

        const handler = (event: PageListEvent) => {
            console.log("📡 [Mobile] Page List Update received:", event);

            if (cancelled) return;

            // Only process events for this page (handle 0 as valid pageId)
            if (pageId !== undefined && pageId !== null && event.pageId !== pageId) {
                console.log(`⏭️ [Mobile] Skipping event - not for page ${pageId}:`, event.pageId);
                return;
            }

            switch (event.eventType) {
                case "PAGE_UPDATED":
                    console.log(`🔄 [Mobile] Page ${pageId} updated:`, event.page);
                    onPageUpdated?.(event);
                    break;
                case "PAGE_CREATED":
                    console.log(`✨ [Mobile] Page created:`, event.page);
                    onPageCreated?.(event);
                    break;
                case "PAGE_DELETED":
                    console.log(`🗑️ [Mobile] Page ${pageId} deleted`);
                    onPageDeleted?.(event);
                    break;
            }
        };

        handlerRef.current = handler;

        // Only subscribe if we have a pageId to monitor
        if (pageId) {
            pageWebsocketService.subscribeToPageList(handler);
        }

        return () => {
            cancelled = true;
            if (pageId) {
                pageWebsocketService.unsubscribeFromPageList(handler);
            }
        };
    }, [pageId, onPageUpdated, onPageCreated, onPageDeleted]);
}

export default usePageListUpdates;
