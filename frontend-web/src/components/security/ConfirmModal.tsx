import { AlertTriangle, X } from "lucide-react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  confirmBgColor?: string;
  confirmHoverColor?: string;
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  confirmBgColor = "bg-red-600",
  confirmHoverColor = "hover:bg-red-700",
  loading = false,
  error,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !loading && onClose()}
    >
      <div
        className="bg-white dark:bg-[#1a1a1a] rounded-2xl max-w-md w-full p-6 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626] disabled:opacity-50"
        >
          <X size={18} className="text-gray-500 dark:text-gray-400" />
        </button>

        <div className="flex flex-col items-center mb-4">
          <div className="p-3 rounded-full mb-3 bg-red-100 dark:bg-red-900/30">
            <AlertTriangle size={28} className="text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-lg font-bold dark:text-white text-center">{title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 text-center">
            {description}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300 text-center">{error}</p>
          </div>
        )}

        <button
          onClick={onConfirm}
          disabled={loading}
          className={`w-full py-3 rounded-full font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${confirmBgColor} ${confirmHoverColor}`}
        >
          {loading && (
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {loading ? "Đang xử lý..." : confirmLabel}
        </button>

        <button
          onClick={onClose}
          disabled={loading}
          className="w-full py-3 mt-2 text-gray-500 dark:text-gray-400 font-semibold hover:bg-gray-50 dark:hover:bg-[#262626] rounded-full transition-colors disabled:opacity-50"
        >
          Hủy
        </button>
      </div>
    </div>
  );
}
