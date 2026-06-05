import { useEffect, useState } from "react";
import { Flag, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import reportService, {
    REPORT_REASON_LABELS,
    type ReportReason,
    type ReportTargetType,
} from "../../services/reportService";

interface ReportModalProps {
    open: boolean;
    targetType: ReportTargetType;
    targetId: number;
    targetName?: string;
    onClose: () => void;
}

const REASONS = Object.keys(REPORT_REASON_LABELS) as ReportReason[];

export default function ReportModal({
    open,
    targetType,
    targetId,
    targetName,
    onClose,
}: ReportModalProps) {
    const [reason, setReason] = useState<ReportReason | null>(null);
    const [description, setDescription] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setReason(null);
            setDescription("");
            setSubmitting(false);
        }
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape" && !submitting) onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, submitting, onClose]);

    if (!open) return null;

    const targetLabel = targetType === "PAGE" ? "trang" : "tài khoản";

    const handleSubmit = async () => {
        if (!reason) {
            toast.error("Vui lòng chọn lý do báo cáo");
            return;
        }
        setSubmitting(true);
        try {
            await reportService.createReport({
                targetType,
                targetId,
                reason,
                description: description.trim() || undefined,
            });
            toast.success("Đã gửi báo cáo. Cảm ơn bạn đã phản hồi!");
            onClose();
        } catch (err: any) {
            const msg =
                err?.response?.data?.message ||
                "Không thể gửi báo cáo. Vui lòng thử lại.";
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
                onClick={submitting ? undefined : onClose}
            />
            <div className="relative z-10 bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-2xl mx-4 w-full max-w-md border border-gray-200 dark:border-[#333] flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-[#333]">
                    <div className="flex items-center gap-2">
                        <Flag size={18} className="text-red-500" />
                        <h3 className="text-base font-semibold dark:text-white">
                            Báo cáo {targetLabel}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={submitting}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-4 overflow-y-auto">
                    {targetName && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                            Bạn đang báo cáo {targetLabel}{" "}
                            <span className="font-semibold text-gray-700 dark:text-gray-200">
                                {targetName}
                            </span>
                        </p>
                    )}
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Lý do báo cáo <span className="text-red-500">*</span>
                    </p>
                    <div className="space-y-1.5 mb-4">
                        {REASONS.map((r) => (
                            <button
                                key={r}
                                type="button"
                                onClick={() => setReason(r)}
                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors border ${
                                    reason === r
                                        ? "border-red-500 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                                        : "border-gray-200 dark:border-[#363636] hover:bg-gray-50 dark:hover:bg-[#2a2a2a] text-gray-700 dark:text-gray-300"
                                }`}
                            >
                                <span
                                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                        reason === r
                                            ? "border-red-500"
                                            : "border-gray-400"
                                    }`}
                                >
                                    {reason === r && (
                                        <span className="w-2 h-2 rounded-full bg-red-500" />
                                    )}
                                </span>
                                {REPORT_REASON_LABELS[r]}
                            </button>
                        ))}
                    </div>

                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                        Mô tả chi tiết (tuỳ chọn)
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        maxLength={1000}
                        placeholder="Cung cấp thêm thông tin giúp quản trị viên xử lý..."
                        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-[#363636] bg-white dark:bg-[#2a2a2a] dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-red-500/40"
                    />
                </div>

                {/* Footer */}
                <div className="flex gap-2 justify-end px-5 py-4 border-t border-gray-200 dark:border-[#333]">
                    <button
                        onClick={onClose}
                        disabled={submitting}
                        className="px-4 py-2 text-sm font-medium bg-gray-100 dark:bg-[#363636] text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-[#454545] transition-colors disabled:opacity-50"
                    >
                        Huỷ
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || !reason}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {submitting && <Loader2 size={16} className="animate-spin" />}
                        Gửi báo cáo
                    </button>
                </div>
            </div>
        </div>
    );
}
