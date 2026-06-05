import { useState, useEffect } from "react";
import { ArrowLeft, Lock, UserMinus } from "lucide-react";
import chatService, { type Conversation } from "../../services/chatService";

interface GroupSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    conversation: Conversation;
    canManageSettings: boolean;
    canDisbandGroup: boolean;
    isDisbandingGroup: boolean;
    isLeavingGroup: boolean;
    isUpdatingMessageRestriction: boolean;
    isUpdatingJoinApproval: boolean;
    onSetConfirmDisbandModalOpen: (open: boolean) => void;
    onUpdateMessageRestriction: (isRestricted: boolean) => Promise<boolean>;
    onUpdateJoinApproval: (isRequired: boolean) => Promise<boolean>;
}

export default function GroupSettingsModal({
    isOpen,
    onClose,
    conversation,
    canManageSettings,
    canDisbandGroup,
    isDisbandingGroup,
    isLeavingGroup,
    isUpdatingMessageRestriction,
    isUpdatingJoinApproval,
    onSetConfirmDisbandModalOpen,
    onUpdateMessageRestriction,
    onUpdateJoinApproval,
}: GroupSettingsModalProps) {
    const [localCanSendMessage, setLocalCanSendMessage] = useState(!conversation.isMessageRestricted);
    const [localJoinApprovalRequired, setLocalJoinApprovalRequired] = useState(
        Boolean(conversation.isJoinApprovalRequired),
    );
    const [showDisableApprovalConfirm, setShowDisableApprovalConfirm] =
        useState(false);
    const [disableApprovalPendingCount, setDisableApprovalPendingCount] =
        useState(0);
    const pendingJoinRequestCount =
        disableApprovalPendingCount || conversation.pendingRequests?.length || 0;

    useEffect(() => {
        setLocalCanSendMessage(!conversation.isMessageRestricted);
    }, [conversation.isMessageRestricted]);

    useEffect(() => {
        setLocalJoinApprovalRequired(Boolean(conversation.isJoinApprovalRequired));
    }, [conversation.isJoinApprovalRequired]);

    if (!isOpen) return null;

    const handleToggleSendMessage = async () => {
        if (!canManageSettings || isUpdatingMessageRestriction) return;
        const currentCanSend = localCanSendMessage;
        const nextCanSend = !currentCanSend;
        const nextIsRestricted = !nextCanSend;
        
        setLocalCanSendMessage(nextCanSend);
        const success = await onUpdateMessageRestriction(nextIsRestricted);
        if (!success) {
            setLocalCanSendMessage(currentCanSend);
        }
    };

    const handleToggleJoinApproval = async () => {
        if (!canManageSettings || isUpdatingJoinApproval) return;
        const currentRequired = localJoinApprovalRequired;
        const nextRequired = !currentRequired;

        if (currentRequired && !nextRequired) {
            const localPendingCount = conversation.pendingRequests?.length ?? 0;
            const latestPendingCount =
                localPendingCount > 0
                    ? localPendingCount
                    : await chatService
                          .getPendingJoinRequests(conversation.id)
                          .then((requests) => requests.length)
                          .catch(() => 0);

            if (latestPendingCount > 0) {
                setDisableApprovalPendingCount(latestPendingCount);
                setShowDisableApprovalConfirm(true);
                return;
            }
        }

        await commitJoinApprovalChange(nextRequired, currentRequired);
    };

    const commitJoinApprovalChange = async (
        nextRequired: boolean,
        previousRequired: boolean,
    ) => {
        setLocalJoinApprovalRequired(nextRequired);
        const success = await onUpdateJoinApproval(nextRequired);
        if (!success) {
            setLocalJoinApprovalRequired(previousRequired);
        }
    };

    const handleConfirmDisableJoinApproval = async () => {
        setShowDisableApprovalConfirm(false);
        setDisableApprovalPendingCount(0);
        await commitJoinApprovalChange(false, true);
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 dark:bg-black/80 transition-opacity">
            <div className="w-full max-w-md bg-[#f4f5f7] dark:bg-[#111111] h-full flex flex-col animate-in slide-in-from-right-full duration-300">
                {/* Header */}
                <div className="flex items-center h-14 border-b border-gray-200 dark:border-[#262626] bg-white dark:bg-black px-4 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626] text-gray-700 dark:text-gray-300 transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <h2 className="ml-2 text-base font-semibold text-gray-900 dark:text-white">
                        Quản lý nhóm
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {/* Admin notice */}
                   {!canManageSettings &&  <div className="bg-gray-200/60 dark:bg-[#1a1a1a] px-4 py-2.5 flex items-center gap-2">
                        <Lock size={14} className="text-gray-600 dark:text-gray-400" />
                        <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Tính năng chỉ dành cho quản trị viên</span>
                    </div>}

                    <div className="mt-2 bg-white dark:bg-black">
                        <div className="px-4 py-3 border-b border-gray-100 dark:border-[#262626]">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Cho phép các thành viên trong nhóm:</h3>
                        </div>
                        
                        <div className="flex flex-col">
                            
                            
                            {/* Active setting for messaging */}
                            <ToggleRow 
                                label="Gửi tin nhắn" 
                                checked={localCanSendMessage}
                                onChange={handleToggleSendMessage}
                                disabled={!canManageSettings || isUpdatingMessageRestriction}
                                isStaff={canManageSettings}
                            />
                        </div>
                    </div>

                    <div className="mt-2 bg-white dark:bg-black">
                        <div className="flex flex-col">
                            <ToggleRow
                                label="Chế độ phê duyệt thành viên mới"
                                checked={localJoinApprovalRequired}
                                onChange={handleToggleJoinApproval}
                                disabled={!canManageSettings || isUpdatingJoinApproval}
                                isStaff={canManageSettings}
                            />
                            
                        </div>
                    </div>

                    {canDisbandGroup && (
                        <div className="mt-2 bg-white dark:bg-black px-4 py-3">
                            <button
                                type="button"
                                onClick={() => onSetConfirmDisbandModalOpen(true)}
                                disabled={isDisbandingGroup || isLeavingGroup}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-50 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                            >
                                <UserMinus size={18} />
                                {isDisbandingGroup ? "Đang giải tán..." : "Giải tán nhóm"}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {showDisableApprovalConfirm && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 px-4">
                    <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl dark:bg-[#1f1f1f]">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                            Tắt chế độ phê duyệt?
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                            Hiện có {pendingJoinRequestCount} yêu cầu tham gia đang chờ. Nếu tắt chế độ phê duyệt, tất cả các yêu cầu này sẽ bị hủy.
                        </p>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowDisableApprovalConfirm(false)}
                                className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-[#2a2a2a]"
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDisableJoinApproval}
                                disabled={isUpdatingJoinApproval}
                                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Tắt và hủy yêu cầu
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ToggleRow({ 
    label, 
    checked, 
    disabled, 
    onChange,
    isStaff 
}: { 
    label: string; 
    checked: boolean; 
    disabled?: boolean; 
    onChange?: () => void;
    isStaff?: boolean;
}) {
    // Nếu là Admin/Deputy (isStaff), chúng ta không muốn UI bị mờ hoặc có cursor 'cấm' 
    // ngay cả khi tính năng đang bị disabled (ví dụ: do đang xử lý hoặc chưa được implement).
    const showDisabledStyles = disabled && !isStaff;

    return (
        <label className={`flex items-center justify-between px-4 py-3.5 border-b border-gray-100 dark:border-[#262626] last:border-0 ${showDisabledStyles ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-[#161616]'}`}>
            <span className="text-sm text-gray-900 dark:text-white font-medium">{label}</span>
            <div className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${checked ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}>
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <input type="checkbox" className="sr-only" checked={checked} disabled={disabled} onChange={onChange} />
        </label>
    );
}
