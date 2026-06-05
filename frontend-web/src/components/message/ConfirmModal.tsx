import { Loader2, X } from "lucide-react";
import type React from "react";

interface ConfirmModalProps {
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel?: string;
    loading?: boolean;
    isDanger?: boolean;
    onClose: () => void;
    onConfirm: () => void;
    children?: React.ReactNode;
}

export default function ConfirmModal({
    open,
    title,
    description,
    confirmLabel,
    cancelLabel = "Hủy",
    loading = false,
    isDanger = false,
    onClose,
    onConfirm,
    children,
}: ConfirmModalProps) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 px-4 py-6 animate-in fade-in duration-200">
            <div className="w-full max-w-md overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200 dark:border-[#303030] dark:bg-[#111111]">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-[#2a2a2a]">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {title}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-[#232323] dark:hover:text-gray-100"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="px-5 py-6">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        {description}
                    </p>
                    {children}
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-5 py-4 dark:border-[#2a2a2a]">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-[#232323]"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className={`inline-flex items-center rounded-lg px-5 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
                            isDanger
                                ? "bg-red-600 hover:bg-red-700"
                                : "bg-blue-600 hover:bg-blue-700"
                        }`}
                    >
                        {loading && (
                            <Loader2 size={16} className="mr-2 animate-spin" />
                        )}
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
