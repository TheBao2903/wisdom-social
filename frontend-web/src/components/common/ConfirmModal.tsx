import { useEffect } from "react";
import { AlertTriangle, Info } from "lucide-react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "default";
  onConfirm: () => void;
  onCancel?: () => void;
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmText = "Xác nhận",
  cancelText,
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const isAlertMode = !cancelText;

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (onCancel) onCancel();
        else onConfirm();
      }
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  const confirmBtnClass =
    variant === "danger"
      ? "bg-red-500 hover:bg-red-600 text-white"
      : variant === "warning"
        ? "bg-yellow-500 hover:bg-yellow-600 text-white"
        : "bg-blue-500 hover:bg-blue-600 text-white";

  const Icon = variant === "danger" || variant === "warning" ? AlertTriangle : Info;
  const iconClass =
    variant === "danger"
      ? "text-red-500"
      : variant === "warning"
        ? "text-yellow-500"
        : "text-blue-500";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={isAlertMode ? onConfirm : onCancel}
      />
      <div className="relative z-10 bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl p-6 mx-4 w-full max-w-sm border border-gray-200 dark:border-[#333]">
        <div className="flex items-start gap-3 mb-4">
          <div className={`mt-0.5 shrink-0 ${iconClass}`}>
            <Icon size={22} />
          </div>
          <div>
            <h3 className="text-base font-semibold dark:text-white">{title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{message}</p>
          </div>
        </div>

        <div className={`flex gap-2 ${isAlertMode ? "justify-center" : "justify-end"}`}>
          {!isAlertMode && onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium bg-gray-100 dark:bg-[#363636] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-[#454545] transition-colors"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${confirmBtnClass}`}
          >
            {isAlertMode ? "OK" : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
