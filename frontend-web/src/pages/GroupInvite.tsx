import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, ShieldCheck, Users } from "lucide-react";
import toast from "react-hot-toast";
import chatService, {
    type Conversation,
    type ConversationPreview,
    type InviteUserStatus,
} from "../services/chatService";
import { DEFAULT_GROUP_AVATAR_URL } from "../constants/ui";

function resolveConversationId(payload: Conversation | { message?: string }) {
    if (!payload || typeof payload !== "object") return null;
    const record = payload as Record<string, unknown>;
    const id = Number(record.conversationId ?? record.id);
    return Number.isFinite(id) ? id : null;
}

export default function GroupInvite() {
    const { token } = useParams();
    const navigate = useNavigate();
    const [joining, setJoining] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [error, setError] = useState("");
    const [preview, setPreview] = useState<ConversationPreview | null>(null);
    const [userStatus, setUserStatus] = useState<InviteUserStatus | null>(null);

    useEffect(() => {
        if (!token) return;

        let cancelled = false;

        chatService
            .previewInvite(token)
            .then((data) => {
                if (cancelled) return;
                if (data.userStatus === "ACTIVE") {
                    navigate(`/messages/${data.conversationId}`, {
                        replace: true,
                    });
                    return;
                }
                setPreview(data);
                setUserStatus(data.userStatus);
            })
            .catch(() => {
                if (cancelled) return;
                setError("Link tham gia không hợp lệ hoặc đã bị vô hiệu hóa.");
            });

        return () => {
            cancelled = true;
        };
    }, [navigate, token]);

    const invalidTokenError = !token
        ? "Link tham gia không hợp lệ hoặc đã bị vô hiệu hóa."
        : "";
    const resolvedError = invalidTokenError || error;
    const loading = Boolean(token) && !preview && !resolvedError;

    const handleJoin = useCallback(async () => {
        if (!token || userStatus !== "NOT_MEMBER") return;
        try {
            setJoining(true);
            const response = await chatService.joinByInvite(token);
            const conversationId = resolveConversationId(response);
            if (conversationId) {
                navigate(`/messages/${conversationId}`, { replace: true });
                return;
            }
            setUserStatus("PENDING");
            toast.success("Đã gửi yêu cầu tham gia nhóm.");
        } catch (err) {
            const message =
                err &&
                typeof err === "object" &&
                "response" in (err as Record<string, unknown>)
                    ? (
                          err as {
                              response?: { data?: { message?: string } };
                          }
                      ).response?.data?.message
                    : null;
            toast.error(message || "Bạn đã bị chặn khỏi nhóm.");
        } finally {
            setJoining(false);
        }
    }, [navigate, token, userStatus]);

    const handleCancelRequest = useCallback(async () => {
        if (!preview || userStatus !== "PENDING") return;
        try {
            setCancelling(true);
            await chatService.cancelMyJoinRequest(preview.conversationId);
            setUserStatus("NOT_MEMBER");
            toast.success("Đã hủy yêu cầu tham gia nhóm.");
        } catch (err) {
            const message =
                err &&
                typeof err === "object" &&
                "response" in (err as Record<string, unknown>)
                    ? (
                          err as {
                              response?: { data?: { message?: string } };
                          }
                      ).response?.data?.message
                    : null;
            toast.error(message || "Không thể hủy yêu cầu tham gia.");
        } finally {
            setCancelling(false);
        }
    }, [preview, userStatus]);

    if (loading) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white dark:bg-black">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            </div>
        );
    }

    if (resolvedError) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-black">
                <section className="w-full max-w-md text-center">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-950/30">
                        <ShieldCheck size={28} />
                    </div>
                    <h1 className="text-xl font-bold text-gray-950 dark:text-white">
                        Link không khả dụng
                    </h1>
                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                        {resolvedError}
                    </p>
                    <Link
                        to="/"
                        className="mt-7 inline-flex h-11 items-center justify-center rounded-md bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                    >
                        Quay về trang chủ
                    </Link>
                </section>
            </main>
        );
    }

    if (!preview) return null;

    const isPending = userStatus === "PENDING";

    return (
        <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-black">
            <section className="w-full max-w-md rounded-md bg-white p-7 text-center shadow-xl ring-1 ring-gray-200 dark:bg-[#111111] dark:ring-[#262626]">
                <img
                    src={preview.imageUrl || DEFAULT_GROUP_AVATAR_URL}
                    alt={preview.name}
                    onError={(event) => {
                        event.currentTarget.src = DEFAULT_GROUP_AVATAR_URL;
                    }}
                    className="mx-auto h-24 w-24 rounded-full object-cover ring-1 ring-gray-200 dark:ring-[#262626]"
                />
                <h1 className="mt-5 text-2xl font-bold text-gray-950 dark:text-white">
                    {preview.name}
                </h1>
                <p className="mt-2 inline-flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <Users size={16} />
                    {preview.memberCount} thành viên
                </p>
                {preview.isJoinApprovalRequired && (
                    <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/25 dark:text-amber-300">
                        Nhóm này yêu cầu Quản trị viên phê duyệt
                    </p>
                )}
                <button
                    type="button"
                    disabled={joining || cancelling}
                    onClick={isPending ? handleCancelRequest : handleJoin}
                    className={`mt-7 h-11 w-full rounded-md text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
                        isPending
                            ? "bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-70 dark:bg-[#262626] dark:text-gray-200 dark:hover:bg-[#333333]"
                            : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-70"
                    }`}
                >
                    {isPending
                        ? cancelling
                            ? "Đang hủy..."
                            : "Hủy yêu cầu"
                        : joining
                          ? "Đang tham gia..."
                          : "Tham gia nhóm"}
                </button>
            </section>
        </main>
    );
}
