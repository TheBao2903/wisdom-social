import {} from "react";
import { X, Edit2, Trash2 } from "lucide-react";

interface HighlightOptionsBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onRemove: () => void;
  isRemoving: boolean;
}

export default function HighlightOptionsBottomSheet({
  isOpen,
  onClose,
  onEdit,
  onRemove,
  isRemoving,
}: HighlightOptionsBottomSheetProps) {
  if (!isOpen) return null;

  return (
    <div
      className="absolute inset-0 bg-black/65 backdrop-blur-xs z-50 flex items-end"
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
      
      {/* Click outside to close */}
      <div className="absolute inset-0 cursor-default" onClick={onClose} />

      {/* Bottom Sheet Card */}
      <div className="relative w-full bg-zinc-900/95 backdrop-blur-md rounded-t-2xl border-t border-white/10 p-5 pb-8 flex flex-col gap-4 shadow-2xl animate-slide-up z-10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <h4 className="text-white text-xs font-bold font-sans">Tùy chọn tin nổi bật</h4>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white bg-white/5 p-1.5 rounded-full cursor-pointer transition-all duration-200"
          >
            <X size={14} />
          </button>
        </div>

        {/* Main Options Screen */}
        <div className="flex flex-col gap-2">
          {/* Edit option */}
          <button
            onClick={onEdit}
            className="w-full py-3 bg-white/5 hover:bg-white/10 active:scale-98 text-white rounded-xl text-xs font-semibold font-sans transition-all cursor-pointer flex items-center justify-center gap-2 border border-white/5"
          >
            <Edit2 size={14} /> Chỉnh sửa tin nổi bật
          </button>

          {/* Remove option */}
          <button
            disabled={isRemoving}
            onClick={onRemove}
            className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 active:scale-98 text-red-500 rounded-xl text-xs font-semibold font-sans transition-all cursor-pointer flex items-center justify-center gap-2 border border-red-500/25 mt-2"
          >
            <Trash2 size={14} /> {isRemoving ? "Đang gỡ..." : "Gỡ khỏi tin nổi bật"}
          </button>
        </div>
      </div>
    </div>
  );
}
