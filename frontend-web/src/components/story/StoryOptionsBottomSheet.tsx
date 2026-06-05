import { useState, useEffect } from "react";
import { X, Globe, Users, Lock, Trash2 } from "lucide-react";

interface StoryOptionsBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeStory: any;
  isDeleting: boolean;
  isUpdating: boolean;
  onDelete: () => void;
  onUpdatePrivacy: (privacy: string) => void;
}

export default function StoryOptionsBottomSheet({
  isOpen,
  onClose,
  activeStory,
  isDeleting,
  isUpdating,
  onDelete,
  onUpdatePrivacy,
}: StoryOptionsBottomSheetProps) {
  const [showPrivacyOptions, setShowPrivacyOptions] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setShowPrivacyOptions(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="absolute inset-0 bg-black/65 backdrop-blur-xs z-[1000] flex items-end"
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
          <h4 className="text-white text-xs font-bold">Tùy chọn tin</h4>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white bg-white/5 p-1.5 rounded-full cursor-pointer transition-all duration-200"
          >
            <X size={14} />
          </button>
        </div>

        {showPrivacyOptions ? (
          /* Privacy Settings Screen */
          <div className="flex flex-col gap-2.5">
            <p className="text-white/50 text-[10px] font-bold uppercase tracking-wider mb-1">
              Ai có thể xem tin này?
            </p>
            {[
              { key: "PUBLIC", label: "Công khai", desc: "Bất kỳ ai trên hoặc ngoài hệ thống", icon: <Globe size={14} /> },
              { key: "FRIENDS", label: "Bạn bè", desc: "Chỉ bạn bè của bạn trên hệ thống", icon: <Users size={14} /> },
              { key: "ONLY_ME", label: "Chỉ mình tôi", desc: "Chỉ mình bạn có quyền xem", icon: <Lock size={14} /> },
            ].map((opt) => (
              <button
                key={opt.key}
                disabled={isUpdating}
                onClick={() => onUpdatePrivacy(opt.key)}
                className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  activeStory?.privacy === opt.key
                    ? "bg-blue-500/10 border-blue-500/40 text-blue-400"
                    : "bg-white/5 border-white/5 hover:bg-white/10 text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${activeStory?.privacy === opt.key ? "bg-blue-500/20" : "bg-white/5"}`}>
                    {opt.icon}
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{opt.label}</p>
                    <p className="text-[9px] text-white/50 mt-0.5">{opt.desc}</p>
                  </div>
                </div>
                {activeStory?.privacy === opt.key && (
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                )}
              </button>
            ))}
            <button
              onClick={() => setShowPrivacyOptions(false)}
              className="w-full py-2.5 mt-2 bg-white/5 hover:bg-white/10 active:scale-98 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer text-center"
            >
              Quay lại
            </button>
          </div>
        ) : (
          /* Main Options Screen */
          <div className="flex flex-col gap-2">
            <button
              disabled={isDeleting}
              onClick={() => setShowPrivacyOptions(true)}
              className="w-full py-3 bg-white/5 hover:bg-white/10 active:scale-98 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 border border-white/5"
            >
              <Lock size={14} /> Thay đổi quyền riêng tư
            </button>

            <button
              disabled={isDeleting}
              onClick={onDelete}
              className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 active:scale-98 text-red-500 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2 border border-red-500/25 mt-2"
            >
              <Trash2 size={14} /> {isDeleting ? "Đang xóa..." : "Xóa tin này"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
