import { ChevronDown, ChevronUp, Sparkles, WandSparkles } from "lucide-react";

interface AIActionPanelProps {
    isOpen: boolean;
    onToggle: () => void;
    disabled?: boolean;
    isSummarizing?: boolean;
    isSuggesting?: boolean;
    onSummarize: () => void;
    onSuggest: () => void;
}

export default function AIActionPanel({
    isOpen,
    onToggle,
    disabled = false,
    isSummarizing = false,
    isSuggesting = false,
    onSummarize,
    onSuggest,
}: AIActionPanelProps) {
    return (
        <div className="rounded-md  bg-gray-50 px-2 py-1.5 dark:border-gray-700/70 dark:bg-gray-900">
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-expanded={isOpen}
                aria-label={isOpen ? "Thu gọn AI CHAT" : "Mở AI CHAT"}
            >
                <div className="flex min-w-0 items-center gap-1.5">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm bg-blue-100/80 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                        <Sparkles size={11} />a
                    </span>
                    <p className="text-[10px] font-semibold tracking-wide text-gray-700 dark:text-gray-200">
                        AI CHAT
                    </p>
                    <span className="hidden truncate text-[10px] text-gray-500 dark:text-gray-400 sm:inline">
                        Tóm tắt nhanh hoặc gợi ý phản hồi
                    </span>
                </div>

                <span className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200">
                    {isOpen ? (
                        <ChevronUp size={13} />
                    ) : (
                        <ChevronDown size={13} />
                    )}
                </span>
            </button>

            <div
                className={`overflow-hidden transition-all duration-200 ease-out ${isOpen ? "max-h-20 opacity-100 pt-1.5" : "max-h-0 opacity-0"}`}
            >
                <div className="flex flex-wrap items-center gap-1.5">
                    <button
                        type="button"
                        disabled={disabled || isSummarizing}
                        onClick={onSummarize}
                        className="inline-flex items-center gap-1 rounded-md  bg-white px-2.5 py-1 text-[10px] font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700 disabled:opacity-60"
                    >
                        <Sparkles size={12} />
                        {isSummarizing ? "Đang tóm tắt..." : "Tóm tắt"}
                    </button>

                    <button
                        type="button"
                        disabled={disabled || isSuggesting}
                        onClick={onSuggest}
                        className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900 disabled:opacity-60"
                    >
                        <WandSparkles size={12} />
                        {isSuggesting ? "Đang tạo gợi ý..." : "Gợi ý trả lời"}
                    </button>
                </div>
            </div>
        </div>
    );
}
