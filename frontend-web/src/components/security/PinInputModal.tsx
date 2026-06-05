import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface PinInputModalProps {
  open: boolean;
  title: string;
  description: string;
  icon: LucideIcon;
  iconColor: string; // tailwind text color class, e.g. "text-blue-500"
  iconBgColor: string; // tailwind bg color class, e.g. "bg-blue-100"
  confirmLabel: string;
  confirmBgColor: string; // tailwind bg color, e.g. "bg-blue-500"
  confirmHoverColor: string; // hover, e.g. "hover:bg-blue-600"
  loading?: boolean;
  error?: string | null;
  onConfirm: (pin: string) => void;
  onClose: () => void;
}

export default function PinInputModal({
  open,
  title,
  description,
  icon: Icon,
  iconColor,
  iconBgColor,
  confirmLabel,
  confirmBgColor,
  confirmHoverColor,
  loading = false,
  error,
  onConfirm,
  onClose,
}: PinInputModalProps) {
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (open) {
      setPin(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    }
  }, [open]);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) value = value[value.length - 1];
    if (!/^\d*$/.test(value)) return;
    const next = [...pin];
    next[index] = value;
    setPin(next);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").slice(0, 6);
    if (!/^\d+$/.test(pasted)) return;
    const next = [...pin];
    for (let i = 0; i < pasted.length && i < 6; i++) next[i] = pasted[i];
    setPin(next);
    const nextIndex = Math.min(pasted.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleSubmit = () => {
    const pinCode = pin.join("");
    if (pinCode.length !== 6) return;
    onConfirm(pinCode);
  };

  if (!open) return null;

  const pinComplete = pin.join("").length === 6;

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
          <div className={`p-3 rounded-full mb-3 ${iconBgColor}`}>
            <Icon size={28} className={iconColor} />
          </div>
          <h3 className="text-lg font-bold dark:text-white text-center">{title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 text-center">
            {description}
          </p>
        </div>

        <div className="flex justify-center gap-2 mb-3" onPaste={handlePaste}>
          {pin.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => { inputRefs.current[idx] = el; }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              disabled={loading}
              className={`w-11 h-13 border-2 rounded-lg text-center text-2xl font-bold focus:outline-none transition-colors dark:bg-[#000] dark:text-white ${
                error
                  ? "border-red-500"
                  : "border-gray-300 dark:border-[#262626] focus:border-blue-500"
              }`}
              style={{ height: "52px" }}
            />
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 text-center mb-3">
            {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !pinComplete}
          className={`w-full py-3 rounded-full font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${confirmBgColor} ${confirmHoverColor}`}
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
