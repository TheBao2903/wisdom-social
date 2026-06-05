import {
  Type,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  CaseSensitive,
  Layers,
} from "lucide-react";
import type {
  TextLayer,
  StoryTextManager,
} from "../../hooks/useStoryTextManager";
import { useState } from "react";

interface Props {
  manager: StoryTextManager;
}

const COLOR_PRESETS = [
  "#ffffff",
  "#000000",
  "#f43f5e",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#6b7280",
];

const FONT_SIZES = [16, 20, 24, 28, 32, 40, 48, 56, 64, 72];

export default function StoryToolbar({ manager }: Props) {
  const {
    selectedLayer,
    selectedId,
    addLayer,
    updateLayer,
    removeLayer,
    duplicateLayer,
    bringForward,
    sendBackward,
    FONT_FAMILIES,
  } = manager;

  const [activePanel, setActivePanel] = useState<
    "none" | "color" | "font" | "size" | "bg"
  >("none");

  const togglePanel = (panel: typeof activePanel) => {
    setActivePanel((prev) => (prev === panel ? "none" : panel));
  };

  const handleAddText = () => {
    addLayer();
    setActivePanel("none");
  };

  return (
    <div
      className="flex flex-col items-center gap-3"
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Main Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl">
        {/* Add Text */}
        <button
          onClick={handleAddText}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white/90 hover:text-white hover:bg-white/10 transition-all text-xs font-medium"
          title="Thêm văn bản"
        >
          <Type size={16} />
          <span className="hidden sm:inline">Aa</span>
        </button>

        {selectedLayer && (
          <>
            <div className="w-px h-5 bg-white/15 mx-1" />

            {/* Text Color */}
            <button
              onClick={() => togglePanel("color")}
              className={`p-2 rounded-xl transition-all ${
                activePanel === "color"
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
              title="Màu chữ"
            >
              <div
                className="w-4 h-4 rounded-full border-2 border-white/40"
                style={{ backgroundColor: selectedLayer.color }}
              />
            </button>

            {/* Background Color */}
            <button
              onClick={() => togglePanel("bg")}
              className={`p-2 rounded-xl transition-all ${
                activePanel === "bg"
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
              title="Nền văn bản"
            >
              <Palette size={16} />
            </button>

            {/* Font Family */}
            <button
              onClick={() => togglePanel("font")}
              className={`p-2 rounded-xl transition-all ${
                activePanel === "font"
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
              title="Font chữ"
            >
              <CaseSensitive size={16} />
            </button>

            {/* Font Size */}
            <button
              onClick={() => togglePanel("size")}
              className={`p-2 rounded-xl transition-all text-xs font-bold ${
                activePanel === "size"
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
              title="Cỡ chữ"
            >
              {selectedLayer.fontSize}
            </button>

            <div className="w-px h-5 bg-white/15 mx-1" />

            {/* Bold */}
            <button
              onClick={() =>
                updateLayer(selectedId!, {
                  fontWeight:
                    selectedLayer.fontWeight === "bold" ? "normal" : "bold",
                })
              }
              className={`p-2 rounded-xl transition-all ${
                selectedLayer.fontWeight === "bold"
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
              title="In đậm"
            >
              <Bold size={15} />
            </button>

            {/* Italic */}
            <button
              onClick={() =>
                updateLayer(selectedId!, {
                  fontStyle:
                    selectedLayer.fontStyle === "italic" ? "normal" : "italic",
                })
              }
              className={`p-2 rounded-xl transition-all ${
                selectedLayer.fontStyle === "italic"
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
              title="In nghiêng"
            >
              <Italic size={15} />
            </button>

            {/* Alignment */}
            <button
              onClick={() => {
                const aligns: TextLayer["align"][] = [
                  "left",
                  "center",
                  "right",
                ];
                const idx = aligns.indexOf(selectedLayer.align);
                updateLayer(selectedId!, {
                  align: aligns[(idx + 1) % aligns.length],
                });
              }}
              className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all"
              title="Căn chỉnh"
            >
              {selectedLayer.align === "left" && <AlignLeft size={15} />}
              {selectedLayer.align === "center" && <AlignCenter size={15} />}
              {selectedLayer.align === "right" && <AlignRight size={15} />}
            </button>

            {/* Text Shadow */}
            <button
              onClick={() =>
                updateLayer(selectedId!, {
                  textShadow: !selectedLayer.textShadow,
                })
              }
              className={`p-2 rounded-xl transition-all text-[10px] font-bold ${
                selectedLayer.textShadow
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
              title="Đổ bóng chữ"
            >
              S
            </button>

            <div className="w-px h-5 bg-white/15 mx-1" />

            {/* Duplicate */}
            <button
              onClick={() => duplicateLayer(selectedId!)}
              className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all"
              title="Nhân bản"
            >
              <Copy size={15} />
            </button>

            {/* Layer Order */}
            <button
              onClick={() => bringForward(selectedId!)}
              className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all"
              title="Đưa lên trên"
            >
              <ChevronUp size={15} />
            </button>
            <button
              onClick={() => sendBackward(selectedId!)}
              className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all"
              title="Đưa xuống dưới"
            >
              <ChevronDown size={15} />
            </button>

            {/* Delete */}
            <button
              onClick={() => removeLayer(selectedId!)}
              className="p-2 rounded-xl text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="Xóa"
            >
              <Trash2 size={15} />
            </button>
          </>
        )}
      </div>

      {/* Sub-panels */}
      {selectedLayer && activePanel !== "none" && (
        <div className="px-3 py-2.5 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl max-w-[400px]">
          {/* Color Picker */}
          {activePanel === "color" && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    onClick={() => updateLayer(selectedId!, { color })}
                    className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${
                      selectedLayer.color === color
                        ? "border-blue-400 scale-110 shadow-lg"
                        : "border-white/20"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={selectedLayer.color}
                  onChange={(e) =>
                    updateLayer(selectedId!, { color: e.target.value })
                  }
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <span className="text-white/50 text-[10px] uppercase tracking-wider">
                  Tùy chọn
                </span>
              </div>
            </div>
          )}

          {/* Background Color */}
          {activePanel === "bg" && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() =>
                    updateLayer(selectedId!, {
                      bgOpacity: 0,
                      backgroundColor: "transparent",
                    })
                  }
                  className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 relative overflow-hidden ${
                    selectedLayer.bgOpacity === 0
                      ? "border-blue-400 scale-110"
                      : "border-white/20"
                  }`}
                >
                  <div className="absolute inset-0 bg-white/10" />
                  <div className="absolute inset-0 flex items-center justify-center text-white/50 text-[8px]">
                    ✕
                  </div>
                </button>
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    onClick={() =>
                      updateLayer(selectedId!, {
                        backgroundColor: color,
                        bgOpacity: 0.7,
                      })
                    }
                    className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${
                      selectedLayer.backgroundColor === color &&
                      selectedLayer.bgOpacity > 0
                        ? "border-blue-400 scale-110 shadow-lg"
                        : "border-white/20"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              {selectedLayer.bgOpacity > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-white/50 text-[10px] w-16">
                    Opacity
                  </span>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={selectedLayer.bgOpacity}
                    onChange={(e) =>
                      updateLayer(selectedId!, {
                        bgOpacity: parseFloat(e.target.value),
                      })
                    }
                    className="flex-1 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-blue-500"
                  />
                  <span className="text-white/50 text-[10px] w-6 text-right">
                    {Math.round(selectedLayer.bgOpacity * 100)}%
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Font Family */}
          {activePanel === "font" && (
            <div className="flex flex-col gap-1 max-h-[180px] overflow-y-auto pr-1">
              {FONT_FAMILIES.map((font) => (
                <button
                  key={font}
                  onClick={() => updateLayer(selectedId!, { fontFamily: font })}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-all ${
                    selectedLayer.fontFamily === font
                      ? "bg-white/20 text-white"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                  style={{ fontFamily: `'${font}', sans-serif` }}
                >
                  {font}
                </button>
              ))}
            </div>
          )}

          {/* Font Size */}
          {activePanel === "size" && (
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap gap-1.5">
                {FONT_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => updateLayer(selectedId!, { fontSize: size })}
                    className={`w-10 h-8 rounded-lg text-xs font-medium transition-all ${
                      selectedLayer.fontSize === size
                        ? "bg-white/20 text-white"
                        : "text-white/60 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="range"
                  min="12"
                  max="80"
                  value={selectedLayer.fontSize}
                  onChange={(e) =>
                    updateLayer(selectedId!, {
                      fontSize: parseInt(e.target.value),
                    })
                  }
                  className="flex-1 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-blue-500"
                />
                <span className="text-white/40 text-[10px] w-6 text-right">
                  {selectedLayer.fontSize}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Layer count badge */}
      {manager.layers.length > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10">
          <Layers size={12} className="text-white/40" />
          <span className="text-[10px] text-white/40">
            {manager.layers.length} layer
            {manager.layers.length > 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  );
}
