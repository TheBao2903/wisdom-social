import { useState, useRef, useEffect } from "react";

export function useStoryMediaDrag(selectedMedia: File | null) {
    const [mediaPositionX, setMediaPositionX] = useState(0);
    const [mediaPositionY, setMediaPositionY] = useState(0);
    const [mediaScale, setMediaScale] = useState(1);

    const isDraggingRef = useRef(false);
    const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
    const positionRef = useRef({ x: mediaPositionX, y: mediaPositionY });

    useEffect(() => {
        positionRef.current = { x: mediaPositionX, y: mediaPositionY };
    }, [mediaPositionX, mediaPositionY]);

    const handleMediaMouseDown = (e: any) => {
        if (!selectedMedia) return;
        isDraggingRef.current = true;
        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            posX: positionRef.current.x,
            posY: positionRef.current.y,
        };
    };

    const handleMediaTouchStart = (e: any) => {
        if (!selectedMedia || !e.touches || e.touches.length !== 1) return;
        isDraggingRef.current = true;
        dragStartRef.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
            posX: positionRef.current.x,
            posY: positionRef.current.y,
        };
    };

    useEffect(() => {
        const CANVAS_WIDTH = 360;
        const CANVAS_HEIGHT = 640;

        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current) return;
            const deltaX = e.clientX - dragStartRef.current.x;
            const deltaY = e.clientY - dragStartRef.current.y;

            const maxOffsetX = Math.max(
                0,
                (CANVAS_WIDTH * mediaScale - CANVAS_WIDTH) / 2
            );
            const maxOffsetY = Math.max(
                0,
                (CANVAS_HEIGHT * mediaScale - CANVAS_HEIGHT) / 2
            );

            let newOffsetX = dragStartRef.current.posX + deltaX;
            let newOffsetY = dragStartRef.current.posY + deltaY;

            newOffsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, newOffsetX));
            newOffsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, newOffsetY));

            setMediaPositionX(newOffsetX);
            setMediaPositionY(newOffsetY);
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isDraggingRef.current || !e.touches[0]) return;
            const deltaX = e.touches[0].clientX - dragStartRef.current.x;
            const deltaY = e.touches[0].clientY - dragStartRef.current.y;

            const maxOffsetX = Math.max(
                0,
                (CANVAS_WIDTH * mediaScale - CANVAS_WIDTH) / 2
            );
            const maxOffsetY = Math.max(
                0,
                (CANVAS_HEIGHT * mediaScale - CANVAS_HEIGHT) / 2
            );

            let newOffsetX = dragStartRef.current.posX + deltaX;
            let newOffsetY = dragStartRef.current.posY + deltaY;

            newOffsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, newOffsetX));
            newOffsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, newOffsetY));

            setMediaPositionX(newOffsetX);
            setMediaPositionY(newOffsetY);
        };

        const handleMouseUp = () => {
            isDraggingRef.current = false;
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            document.removeEventListener("touchmove", handleTouchMove);
            document.removeEventListener("touchend", handleMouseUp);
        };

        if (isDraggingRef.current) {
            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
            document.addEventListener("touchmove", handleTouchMove);
            document.addEventListener("touchend", handleMouseUp);
        }

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            document.removeEventListener("touchmove", handleTouchMove);
            document.removeEventListener("touchend", handleMouseUp);
        };
    }, [mediaScale]);

    const handleMediaWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        if (!selectedMedia) return;
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        setMediaScale((prev) => Math.max(0.5, Math.min(3, prev + delta)));
    };

    const handleZoomIn = () => {
        setMediaScale((prev) => Math.min(3, prev + 0.2));
    };

    const handleZoomOut = () => {
        setMediaScale((prev) => Math.max(0.5, prev - 0.2));
    };

    const handleResetMediaPosition = () => {
        setMediaPositionX(0);
        setMediaPositionY(0);
        setMediaScale(1);
    };

    return {
        mediaPositionX,
        mediaPositionY,
        mediaScale,
        setMediaScale,
        handleMediaMouseDown,
        handleMediaTouchStart,
        handleMediaWheel,
        handleZoomIn,
        handleZoomOut,
        handleResetMediaPosition,
    };
}
