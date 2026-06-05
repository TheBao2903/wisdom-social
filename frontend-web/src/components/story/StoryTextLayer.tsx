import { useRef, useCallback, useEffect, useState } from "react";
import type { TextLayer } from "../../hooks/useStoryTextManager";

type ResizeDirection = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | null;

interface Props {
  layer: TextLayer;
  isSelected: boolean;
  isEditing: boolean;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (id: string) => void;
  onStartEdit: (id: string) => void;
  onEndEdit: (id: string) => void;
  onUpdate: (id: string, updates: Partial<TextLayer>) => void;
}

const HANDLE_CURSORS: Record<string, string> = {
  nw: "nwse-resize",
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
};

export default function StoryTextLayer({
  layer,
  isSelected,
  isEditing,
  canvasRef,
  onSelect,
  onStartEdit,
  onEndEdit,
  onUpdate,
}: Props) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, layerX: 0, layerY: 0 });
  const resizeStart = useRef({ x: 0, y: 0, fontSize: 0, scale: 1 });

  // Auto-focus textarea when editing starts
  useEffect(() => {
    if (isEditing && textRef.current) {
      textRef.current.focus();
      const len = textRef.current.value.length;
      textRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  // Auto-resize textarea
  useEffect(() => {
    if (textRef.current) {
      textRef.current.style.height = "auto";
      textRef.current.style.height = textRef.current.scrollHeight + "px";
    }
  }, [layer.text, layer.fontSize, layer.fontFamily, isEditing]);

  // --- Drag logic ---
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isEditing) return;
      e.preventDefault();
      e.stopPropagation();

      onSelect(layer.id);

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      setIsDragging(true);
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        layerX: layer.x,
        layerY: layer.y,
      };

      const handleMouseMove = (ev: MouseEvent) => {
        const dx = ((ev.clientX - dragStart.current.x) / rect.width) * 100;
        const dy = ((ev.clientY - dragStart.current.y) / rect.height) * 100;
        const newX = Math.max(0, Math.min(100, dragStart.current.layerX + dx));
        const newY = Math.max(0, Math.min(100, dragStart.current.layerY + dy));
        onUpdate(layer.id, { x: newX, y: newY });
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [isEditing, layer.id, layer.x, layer.y, canvasRef, onSelect, onUpdate]
  );

  // --- Resize logic ---
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, direction: ResizeDirection) => {
      e.preventDefault();
      e.stopPropagation();
      if (!direction) return;

      setIsResizing(true);
      resizeStart.current = {
        x: e.clientX,
        y: e.clientY,
        fontSize: layer.fontSize,
        scale: layer.scale,
      };

      const handleMouseMove = (ev: MouseEvent) => {
        const dx = ev.clientX - resizeStart.current.x;
        const dy = ev.clientY - resizeStart.current.y;

        let delta = 0;

        // Corners: use the larger movement with proper sign
        if (direction === "se") {
          delta = Math.max(dx, dy);
        } else if (direction === "sw") {
          delta = Math.max(-dx, dy);
        } else if (direction === "ne") {
          delta = Math.max(dx, -dy);
        } else if (direction === "nw") {
          delta = Math.max(-dx, -dy);
        }
        // Horizontal edges: only horizontal movement
        else if (direction === "e") {
          delta = dx;
        } else if (direction === "w") {
          delta = -dx;
        }
        // Vertical edges: only vertical movement
        else if (direction === "s") {
          delta = dy;
        } else if (direction === "n") {
          delta = -dy;
        }

        // Scale the font size based on drag distance
        const scaleFactor = 1 + delta / 200;
        const newFontSize = Math.round(
          Math.max(12, resizeStart.current.fontSize * scaleFactor)
        );
        onUpdate(layer.id, { fontSize: newFontSize });
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [layer.id, layer.fontSize, layer.scale, onUpdate]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onStartEdit(layer.id);
    },
    [layer.id, onStartEdit]
  );

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onUpdate(layer.id, { text: e.target.value });
    },
    [layer.id, onUpdate]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onSelect(layer.id);
      }
    },
    [layer.id, onSelect]
  );

  const handleTextBlur = useCallback(() => {
    onEndEdit(layer.id);
  }, [layer.id, onEndEdit]);

  const textStyle: React.CSSProperties = {
    color: layer.color,
    fontSize: `${layer.fontSize}px`,
    fontFamily: `'${layer.fontFamily}', sans-serif`,
    fontWeight: layer.fontWeight,
    fontStyle: layer.fontStyle,
    textTransform: layer.textTransform,
    textAlign: layer.align,
    textShadow: layer.textShadow
      ? "0 2px 8px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.3)"
      : "none",
    lineHeight: 1.3,
    letterSpacing: "0.01em",
  };

  const bgStyle: React.CSSProperties =
    layer.bgOpacity > 0
      ? {
          backgroundColor: layer.backgroundColor,
          opacity: layer.bgOpacity,
        }
      : {};

  const showHandles = (isSelected || isHovered) && !isEditing && !isDragging;

  // Resize handle positions
  const handles: { dir: ResizeDirection; className: string }[] = [
    // Corners
    {
      dir: "nw",
      className: "-top-[5px] -left-[5px]",
    },
    {
      dir: "ne",
      className: "-top-[5px] -right-[5px]",
    },
    {
      dir: "se",
      className: "-bottom-[5px] -right-[5px]",
    },
    {
      dir: "sw",
      className: "-bottom-[5px] -left-[5px]",
    },
    // Edges
    {
      dir: "n",
      className: "-top-[5px] left-1/2 -translate-x-1/2",
    },
    {
      dir: "e",
      className: "top-1/2 -right-[5px] -translate-y-1/2",
    },
    {
      dir: "s",
      className: "-bottom-[5px] left-1/2 -translate-x-1/2",
    },
    {
      dir: "w",
      className: "top-1/2 -left-[5px] -translate-y-1/2",
    },
  ];

  return (
    <div
      ref={layerRef}
      className={`absolute select-none group ${
        isDragging
          ? "cursor-grabbing"
          : isResizing
          ? ""
          : isEditing
          ? "cursor-text"
          : "cursor-grab"
      }`}
      style={{
        left: `${layer.x}%`,
        top: `${layer.y}%`,
        transform: `translate(-50%, -50%) rotate(${layer.rotation}deg) scale(${layer.scale})`,
        zIndex: layer.zIndex + 10,
        transition: isDragging || isResizing ? "none" : "box-shadow 0.2s ease",
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onClick={(e) => {
        if (isEditing) {
          e.stopPropagation();
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Selection / hover frame + Resize Handles */}
      {(isSelected || isHovered) && !isEditing && (
        <div className="absolute -inset-2 rounded-lg pointer-events-none">
          {/* Border */}
          <div
            className={`absolute inset-0 rounded-lg transition-all duration-150 ${
              isSelected
                ? "border-2 border-white/60"
                : "border border-white/25 border-dashed"
            }`}
          />

          {/* Resize Handles — positioned relative to frame */}
          {showHandles &&
            handles.map((handle) => (
              <div
                key={handle.dir}
                className={`absolute z-50 pointer-events-auto ${handle.className}`}
                style={{ cursor: HANDLE_CURSORS[handle.dir!] }}
                onMouseDown={(e) => handleResizeStart(e, handle.dir)}
              >
                <div
                  className={`w-[10px] h-[10px] rounded-full bg-white border-2 border-blue-400 shadow-md transition-transform duration-150 hover:scale-125 ${
                    isSelected ? "opacity-100" : "opacity-60"
                  }`}
                />
              </div>
            ))}
        </div>
      )}

      {/* Editing border */}
      {isEditing && (
        <div className="absolute -inset-2 border-2 border-blue-400/80 rounded-lg pointer-events-none shadow-[0_0_12px_rgba(59,130,246,0.3)]" />
      )}

      {/* Background layer */}
      {layer.bgOpacity > 0 && (
        <div
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            ...bgStyle,
            margin: "-6px -10px",
            padding: "6px 10px",
            borderRadius: "8px",
          }}
        />
      )}

      {/* Text content */}
      {isEditing ? (
        <textarea
          ref={textRef}
          value={layer.text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          onBlur={handleTextBlur}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          placeholder="Nhập văn bản..."
          className="bg-transparent outline-none resize-none w-full min-w-[120px] placeholder-white/30"
          style={{
            ...textStyle,
            caretColor: layer.color,
          }}
          rows={1}
          autoFocus
        />
      ) : (
        <div
          className="whitespace-pre-wrap break-words min-w-[40px] min-h-[20px]"
          style={textStyle}
        >
          {layer.text || (
            <span className="opacity-30 italic">Nhập văn bản...</span>
          )}
        </div>
      )}

      {/* Drag handle indicator */}
      {isSelected && !isEditing && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex gap-0.5">
          <div className="w-1 h-1 rounded-full bg-white/50" />
          <div className="w-1 h-1 rounded-full bg-white/50" />
          <div className="w-1 h-1 rounded-full bg-white/50" />
        </div>
      )}
    </div>
  );
}
