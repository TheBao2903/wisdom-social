import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "wisdom.sidebarCollapsed";
const SIDEBAR_LAYOUT_EVENT = "wisdom:sidebar-layout-change";

const COLLAPSED_WIDTH = 88;
const EXPANDED_MD_WIDTH = 208;
const EXPANDED_LG_WIDTH = 272;

type SidebarLayoutEventDetail = {
    collapsed: boolean;
};

function getStoredCollapsed(): boolean {
    if (typeof window === "undefined") {
        return false;
    }

    return window.localStorage.getItem(STORAGE_KEY) === "1";
}

function getViewportWidth(): number {
    if (typeof window === "undefined") {
        return 0;
    }

    return window.innerWidth;
}

function computeSidebarWidth(collapsed: boolean, viewportWidth: number): number {
    if (viewportWidth < 768) {
        return 0;
    }

    if (collapsed) {
        return COLLAPSED_WIDTH;
    }

    return viewportWidth >= 1024 ? EXPANDED_LG_WIDTH : EXPANDED_MD_WIDTH;
}

export function useSidebarLayout() {
    const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() =>
        getStoredCollapsed(),
    );
    const [viewportWidth, setViewportWidth] = useState<number>(() =>
        getViewportWidth(),
    );

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const handleResize = () => {
            setViewportWidth(window.innerWidth);
        };

        window.addEventListener("resize", handleResize);
        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        window.localStorage.setItem(STORAGE_KEY, sidebarCollapsed ? "1" : "0");
        window.dispatchEvent(
            new CustomEvent<SidebarLayoutEventDetail>(SIDEBAR_LAYOUT_EVENT, {
                detail: { collapsed: sidebarCollapsed },
            }),
        );
    }, [sidebarCollapsed]);

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const handleSidebarLayoutChange = (event: Event) => {
            const customEvent = event as CustomEvent<SidebarLayoutEventDetail>;
            const nextCollapsed = customEvent.detail?.collapsed;

            if (typeof nextCollapsed === "boolean") {
                setSidebarCollapsed(nextCollapsed);
            }
        };

        const handleStorage = (event: StorageEvent) => {
            if (event.key !== STORAGE_KEY) {
                return;
            }

            setSidebarCollapsed(event.newValue === "1");
        };

        window.addEventListener(
            SIDEBAR_LAYOUT_EVENT,
            handleSidebarLayoutChange as EventListener,
        );
        window.addEventListener("storage", handleStorage);

        return () => {
            window.removeEventListener(
                SIDEBAR_LAYOUT_EVENT,
                handleSidebarLayoutChange as EventListener,
            );
            window.removeEventListener("storage", handleStorage);
        };
    }, []);

    const sidebarWidth = useMemo(
        () => computeSidebarWidth(sidebarCollapsed, viewportWidth),
        [sidebarCollapsed, viewportWidth],
    );

    const toggleSidebarCollapsed = useCallback(() => {
        setSidebarCollapsed((prev) => !prev);
    }, []);

    return {
        sidebarCollapsed,
        sidebarWidth,
        toggleSidebarCollapsed,
        setSidebarCollapsed,
    };
}
