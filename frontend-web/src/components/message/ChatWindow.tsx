import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Send,
  Calendar,
  CheckCircle2,
  Phone,
  Video,
  Info,
  ChevronDown,
  ArrowDown,
  ArrowUp,
  Plus,
  X,
  MoreVertical,
  MessageCircle,
  Mic,
  Square,
  Paperclip,
  Sparkles,
  WandSparkles,
  Film,
  Smile,
  Search,
  UserRound,
  UserPlus,
} from "lucide-react";
import EmojiPicker, {
  Emoji,
  EmojiStyle,
  type EmojiClickData,
  Theme,
} from "emoji-picker-react";
import { useChatWindowController } from "../../hooks/useChatWindowController";
import { MessageBubble } from "./MessageBubble";
import MediaViewer, { type MediaViewerImage } from "./MediaViewer";
import chatService, {
  type ChatUserSearchResult,
  type ConversationMember,
  type ConversationSidebar,
  type Message,
} from "../../services/chatService";
import blockService from "../../services/blockService";
import { buildConversationDisplayInfo } from "../../utils/conversationDisplayInfo";
import {
  LOCKED_ACCOUNT_AVATAR_URL,
  maskAvatarUrl,
  maskDisplayName,
} from "../../utils/lockedAccount";
import { useCall, type CallSignalPayload } from "../../hooks/useCall";
import { useFriendStatus } from "../../hooks/useFriendStatus";
import { useFriendDataSafe } from "../../contexts/FriendDataContext";
import IncomingCallModal from "./IncomingCallModal";
import CallScreen from "./CallScreen";
import { useChatAI } from "../../features/chat-ai/hooks/useChatAI";
import AIConsentModal from "../../features/chat-ai/components/AIConsentModal";
import AIResultPanel from "../../features/chat-ai/components/AIResultPanel";
import type { MessagePreviewDTO } from "../../features/chat-ai/types/chatAI";
import { usePresenceStatus } from "../../hooks/usePresenceStatus";
import { formatLastActiveText } from "../../utils/presenceText";
import {
  ConversationSearchProvider,
  useConversationSearch,
} from "../../contexts/ConversationSearchContext";
import chatRuntimeStore from "../../stores/chatRuntimeStore";

interface ChatWindowProps {
  conversationId: number;
  onMarkAsRead?: (conversationId: number) => void;
  onToggleInfoPanel?: () => void;
  showInfoPanel?: boolean;
  forcedReadOnlyNotice?: string | null;
  onForbidden?: () => void;
  // Fallback props for Header when conversation fetch fails (e.g. disbanded/kicked)
  name?: string;
  avatarUrl?: string;
  compositeAvatarUrls?: string[];
  conversationType?: "DIRECT" | "GROUP";
  conversationMembers?: ConversationMember[];
  directPartnerId?: number;
  openPollMessageId?: string | null;
  openPollModalToken?: number;
  onPollModalClose?: () => void;
  searchOpenSignal?: number;
  onActiveCallChange?: (conversationId: number, active: boolean) => void;
  peerRelationshipInfo?: {
    friendStatus?: string | null;
    mutualGroupsCount?: number | null;
  } | null;
}

function createClientFileId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatMessageMetaTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isAccessBlockedNotice(value?: string | null): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return (
    normalized.includes("chặn khỏi nhóm") ||
    normalized.includes("chan khoi nhom") ||
    normalized.includes("bị xóa khỏi nhóm") ||
    normalized.includes("đã rời khỏi nhóm") ||
    normalized.includes("nhóm đã bị giải tán") ||
    normalized.includes("không có quyền truy cập")
  );
}

const FORWARD_BLOCKED_MEMBER_STATUSES = new Set([
  "LEFT",
  "KICKED",
  "BLOCKED",
  "GROUP_DISBANDED",
]);
const PENDING_INCOMING_CALL_KEY = "pending_incoming_call";
const CALL_BLOCKED_MEMBER_STATUSES = new Set([
  "LEFT",
  "KICKED",
  "BLOCKED",
  "GROUP_DISBANDED",
]);

function canForwardToConversation(
  conversation: ConversationSidebar,
  currentUserId: number
): boolean {
  if (conversation.lastMessage?.lastMessageType === "SYSTEM_DISBAND_GROUP") {
    return false;
  }

  const currentMember = conversation.members?.find(
    (member) => Number(member.userId) === Number(currentUserId)
  );

  if (!currentMember) return true;
  return !FORWARD_BLOCKED_MEMBER_STATUSES.has(String(currentMember.status));
}

function AccessBlockedState({ message }: { message: string }) {
  return (
    <div className="flex h-full w-full flex-1 items-center justify-center bg-white px-6 text-center dark:bg-black">
      <div className="max-w-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-300">
          <X size={28} />
        </div>
        <p className="text-base font-semibold text-gray-900 dark:text-white">
          {message}
        </p>
      </div>
    </div>
  );
}

function getLocalDateStart(dateValue: string): string | null {
  if (!dateValue) return null;
  const [year, month, day] = dateValue.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
}

function getLocalDateEndExclusive(dateValue: string): string | null {
  if (!dateValue) return null;
  const [year, month, day] = dateValue.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day + 1, 0, 0, 0, 0).toISOString();
}

function formatDateInput(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isInvalidDateRange(fromValue: string, toValue: string): boolean {
  return Boolean(fromValue && toValue && toValue < fromValue);
}

function formatSearchResultDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  if (targetDay === today) {
    return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  }
  if (targetDay === today - oneDay) return "Hôm qua";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

function getMessageImageUrls(message: Message): string[] {
  if (message.type !== "IMAGE") return [];
  const attachmentUrls = Array.isArray(message.attachments)
    ? message.attachments
        .map((attachment) => attachment.url)
        .filter((url): url is string => Boolean(url))
    : [];
  if (attachmentUrls.length > 0) return attachmentUrls;
  return message.content ? [message.content] : [];
}

function renderHighlightedContent(content: string, keyword: string): ReactNode {
  const normalizedKeyword = keyword.trim();
  if (!normalizedKeyword) return content;

  const lowerContent = content.toLowerCase();
  const lowerKeyword = normalizedKeyword.toLowerCase();
  const chunks: ReactNode[] = [];
  let cursor = 0;
  let matchIndex = lowerContent.indexOf(lowerKeyword);

  while (matchIndex >= 0) {
    if (matchIndex > cursor) {
      chunks.push(content.slice(cursor, matchIndex));
    }
    chunks.push(
      <mark key={`${matchIndex}-${chunks.length}`} className="rounded bg-transparent font-semibold text-blue-600 dark:text-blue-300">
        {content.slice(matchIndex, matchIndex + normalizedKeyword.length)}
      </mark>,
    );
    cursor = matchIndex + normalizedKeyword.length;
    matchIndex = lowerContent.indexOf(lowerKeyword, cursor);
  }

  if (cursor < content.length) {
    chunks.push(content.slice(cursor));
  }

  return chunks;
}

function ConversationSearchPanel({
  members,
  currentUserId,
  fallbackAvatarUrl,
  onClose,
}: {
  members: ConversationMember[];
  currentUserId: number;
  fallbackAvatarUrl: string;
  onClose: () => void;
}) {
  const [inputValue, setInputValue] = useState("");
  const [senderMenuOpen, setSenderMenuOpen] = useState(false);
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const [senderQuery, setSenderQuery] = useState("");
  const [fromDateValue, setFromDateValue] = useState("");
  const [toDateValue, setToDateValue] = useState("");
  const {
    keyword,
    senderId,
    fromDate,
    toDate,
    results,
    currentIndex,
    hasMore,
    loading,
    search,
    setSenderFilter,
    setDateFilter,
    selectResult,
    loadMore,
    next,
    prev,
    clear,
  } = useConversationSearch();
  const selectedSender = senderId
    ? members.find((member) => Number(member.userId) === Number(senderId))
    : null;
  const senderLabel = selectedSender
    ? selectedSender.userId === currentUserId
      ? "Bạn"
      : selectedSender.nickname || selectedSender.username || `User ${selectedSender.userId}`
    : "Tất cả";
  const normalizedSenderQuery = senderQuery.trim().toLowerCase();
  const filteredMembers = normalizedSenderQuery
    ? members.filter((member) =>
        [
          member.nickname,
          member.username,
          member.userId === currentUserId ? "Bạn" : "",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSenderQuery),
      )
    : members;
  const applyDateRange = useCallback(
    (nextFromValue: string, nextToValue: string) => {
      if (isInvalidDateRange(nextFromValue, nextToValue)) {
        void setDateFilter(null, null);
        return;
      }
      const nextFrom = getLocalDateStart(nextFromValue);
      const nextTo = getLocalDateEndExclusive(nextToValue);
      void setDateFilter(nextFrom, nextTo);
    },
    [setDateFilter],
  );

  const applyPresetDays = useCallback(
    (days: number) => {
      const to = new Date();
      const from = new Date();
      from.setDate(to.getDate() - days);
      const fromValue = formatDateInput(from);
      const toValue = formatDateInput(to);
      setFromDateValue(fromValue);
      setToDateValue(toValue);
      applyDateRange(fromValue, toValue);
      setDateMenuOpen(false);
    },
    [applyDateRange],
  );

  const dateLabel =
    fromDateValue || toDateValue
      ? `${fromDateValue || "..."} - ${toDateValue || "..."}`
      : "Ngày gửi";
  const invalidDateRange = isInvalidDateRange(fromDateValue, toDateValue);

  const statusText =
    results.length === 0
      ? keyword
        ? "Không có kết quả"
        : "Nhập từ khóa"
      : hasMore
        ? `${currentIndex + 1} / ${results.length}+ kết quả`
        : `${currentIndex + 1} / ${results.length} kết quả`;

  return (
    <form
      className="flex h-full w-[360px] max-w-[42vw] shrink-0 flex-col border-l border-gray-200 bg-[#fbfcfe] dark:border-gray-800 dark:bg-black"
      onSubmit={(event) => {
        event.preventDefault();
        void search(inputValue);
      }}
    >
      <div className="flex h-14 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          Tìm kiếm tin nhắn
        </h2>
        <button
          type="button"
          onClick={() => {
            clear();
            onClose();
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          title="Đóng tìm kiếm"
        >
          <X size={17} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4">
      <div className="flex min-w-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-black">
        <Search size={16} className="shrink-0 text-gray-500" />
        <input
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
          placeholder="Tìm tin nhắn"
          autoFocus
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
        <span className="shrink-0">Lọc theo:</span>
      <div className="relative min-w-0 flex-1">
        <button
          type="button"
          onClick={() => setSenderMenuOpen((prev) => !prev)}
          className="inline-flex h-9 w-full items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-black dark:text-gray-200"
          title="Lọc theo người gửi"
        >
          <UserRound size={14} className="shrink-0 text-gray-500" />
          <span className="truncate">{senderLabel}</span>
          <ChevronDown size={14} className="ml-auto shrink-0 text-gray-500" />
        </button>
        {senderMenuOpen && (
          <div className="absolute left-0 top-10 z-50 w-64 rounded-xl border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-1 flex items-center gap-2 rounded-lg bg-gray-100 px-2 py-1.5 dark:bg-gray-800">
              <Search size={14} className="text-gray-500" />
              <input
                value={senderQuery}
                onChange={(event) => setSenderQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-xs text-gray-900 outline-none placeholder:text-gray-500 dark:text-white"
                placeholder="Tìm người gửi"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setSenderMenuOpen(false);
                setSenderQuery("");
                void setSenderFilter(null);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                All
              </span>
              <span>Tất cả</span>
            </button>
            {filteredMembers.map((member) => {
              const name =
                member.userId === currentUserId
                  ? "Bạn"
                  : member.nickname || member.username || `User ${member.userId}`;
              return (
                <button
                  key={member.userId}
                  type="button"
                  onClick={() => {
                    setSenderMenuOpen(false);
                    setSenderQuery("");
                    void setSenderFilter(member.userId);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <img
                    src={member.avatar || fallbackAvatarUrl}
                    alt={name}
                    className="h-7 w-7 rounded-full object-cover"
                  />
                  <span className="truncate">{name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
        <div className="relative min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setDateMenuOpen((prev) => !prev)}
            className="inline-flex h-9 w-full items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-black dark:text-gray-200"
            title={dateLabel}
          >
            <Calendar size={14} className="shrink-0 text-gray-500" />
            <span className="truncate">{dateLabel}</span>
            <ChevronDown size={14} className="ml-auto shrink-0 text-gray-500" />
          </button>
          {dateMenuOpen && (
            <div className="absolute right-0 top-10 z-50 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-900">
              <div className="grid grid-cols-1 gap-1 border-b border-gray-100 pb-2 text-sm dark:border-gray-800">
                <button type="button" onClick={() => applyPresetDays(7)} className="rounded-lg px-2 py-2 text-left text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800">
                  7 ngày trước
                </button>
                <button type="button" onClick={() => applyPresetDays(30)} className="rounded-lg px-2 py-2 text-left text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800">
                  30 ngày trước
                </button>
                <button type="button" onClick={() => applyPresetDays(90)} className="rounded-lg px-2 py-2 text-left text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800">
                  3 tháng trước
                </button>
              </div>
              <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200">
                Chọn khoảng thời gian
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={fromDateValue}
                  max={toDateValue || undefined}
                  onChange={(event) => {
                    const value = event.target.value;
                    setFromDateValue(value);
                    applyDateRange(value, toDateValue);
                  }}
                  className={`h-10 rounded-lg border bg-white px-2 text-xs text-gray-700 outline-none dark:bg-black dark:text-gray-200 ${
                    invalidDateRange
                      ? "border-red-400 dark:border-red-500"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                />
                <input
                  type="date"
                  value={toDateValue}
                  min={fromDateValue || undefined}
                  onChange={(event) => {
                    const value = event.target.value;
                    setToDateValue(value);
                    applyDateRange(fromDateValue, value);
                  }}
                  className={`h-10 rounded-lg border bg-white px-2 text-xs text-gray-700 outline-none dark:bg-black dark:text-gray-200 ${
                    invalidDateRange
                      ? "border-red-400 dark:border-red-500"
                      : "border-gray-200 dark:border-gray-700"
                  }`}
                />
              </div>
              {invalidDateRange && (
                <p className="mt-2 text-xs font-medium text-red-500">
                  Ngày kết thúc không được trước ngày bắt đầu.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      {(fromDate || toDate) && (
        <button
          type="button"
          onClick={() => {
            setFromDateValue("");
            setToDateValue("");
            void setDateFilter(null, null);
          }}
          className="text-left text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          Bỏ lọc ngày
        </button>
      )}
      <div className="flex items-center justify-between rounded-lg bg-gray-100 px-3 py-2 dark:bg-gray-900">
        <span className="text-xs text-gray-600 dark:text-gray-300">
          {loading ? "Đang tìm..." : statusText}
        </span>
        <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => void prev()}
        disabled={loading || currentIndex <= 0}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-800"
        title="Kết quả trước"
      >
        <ArrowUp size={17} />
      </button>
      <button
        type="button"
        onClick={() => void next()}
        disabled={loading || (currentIndex >= results.length - 1 && !hasMore)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-800"
        title="Kết quả tiếp theo"
      >
        <ArrowDown size={17} />
      </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1 pt-2">
        {keyword && results.length > 0 && (
          <div className="space-y-1">
            <p className="px-1 pb-1 text-xs font-semibold text-gray-700 dark:text-gray-200">
              Tin nhắn
            </p>
            {results.map((result, index) => {
              const member = members.find(
                (item) => Number(item.userId) === Number(result.senderId),
              );
              const senderName =
                Number(result.senderId) === Number(currentUserId)
                  ? "Bạn"
                  : result.senderName ||
                    member?.nickname ||
                    member?.username ||
                    `User ${result.senderId}`;
              const active = index === currentIndex;

              return (
                <button
                  key={result.messageId}
                  type="button"
                  onClick={() => void selectResult(index)}
                  className={`flex w-full gap-3 rounded-lg border-b border-gray-200 px-1 py-2.5 text-left transition-colors dark:border-gray-800 ${
                    active
                      ? "bg-blue-50 dark:bg-blue-950/30"
                      : "hover:bg-gray-100 dark:hover:bg-gray-900"
                  }`}
                >
                  <img
                    src={member?.avatar || fallbackAvatarUrl}
                    alt={senderName}
                    className="mt-0.5 h-9 w-9 shrink-0 rounded-full object-cover"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                        {senderName}
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                        {formatSearchResultDate(result.createdAt)}
                      </span>
                    </span>
                    <span className="mt-0.5 line-clamp-2 text-sm leading-5 text-slate-700 dark:text-slate-200">
                      {renderHighlightedContent(result.content || "[Tin nhắn]", keyword)}
                    </span>
                  </span>
                </button>
              );
            })}
            {hasMore && (
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loading}
                className="mt-2 h-9 w-full rounded-md bg-gray-200 text-sm font-semibold text-slate-700 hover:bg-gray-300 disabled:opacity-60 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                {loading ? "Đang tải..." : "Xem thêm"}
              </button>
            )}
          </div>
        )}
        {keyword && results.length === 0 && !loading && (
          <div className="rounded-lg bg-gray-100 px-3 py-4 text-sm text-gray-500 dark:bg-gray-900 dark:text-gray-400">
            Không có kết quả
          </div>
        )}
      {!keyword && (
        <p className="pt-28 text-center text-sm text-gray-500 dark:text-gray-400">
          Hãy nhập từ khóa để tìm kiếm trong cuộc trò chuyện.
        </p>
      )}
      </div>
      </div>
    </form>
  );
}

function ChatWindowContent({
  conversationId,
  onMarkAsRead,
  onToggleInfoPanel,
  showInfoPanel = true,
  forcedReadOnlyNotice = null,
  onForbidden,
  name,
  avatarUrl,
  conversationType,
  conversationMembers,
  directPartnerId,
  openPollMessageId = null,
  openPollModalToken = 0,
  onPollModalClose,
  searchOpenSignal = 0,
  onActiveCallChange,
  peerRelationshipInfo = null,
}: ChatWindowProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [internalOpenPollMessageId, setInternalOpenPollMessageId] = useState<string | null>(null);
  const [internalOpenPollModalToken, setInternalOpenPollModalToken] = useState(0);

  useEffect(() => {
    if (!searchOpenSignal) return undefined;
    const timer = window.setTimeout(() => setSearchOpen(true), 0);
    return () => window.clearTimeout(timer);
  }, [searchOpenSignal]);
  const [loadedRelationshipInfo, setLoadedRelationshipInfo] =
    useState<ChatUserSearchResult | null>(null);
  const [friendRequestSending, setFriendRequestSending] = useState(false);
  const [friendRequestSent, setFriendRequestSent] = useState(false);
  const [forceStrangerAfterBlock, setForceStrangerAfterBlock] = useState(false);
  const effectiveRelationshipInfo =
    peerRelationshipInfo ?? loadedRelationshipInfo;
  const relationshipText = useMemo(() => {
    if (!effectiveRelationshipInfo) return null;
    const parts = [
      effectiveRelationshipInfo.friendStatus === "FRIEND"
        ? "Bạn bè"
        : "Người lạ",
    ];
    const mutualGroupsCount = Number(effectiveRelationshipInfo.mutualGroupsCount ?? 0);
    if (mutualGroupsCount > 0) {
      parts.push(`Nhóm chung (${mutualGroupsCount})`);
    }
    return parts.join(" · ");
  }, [effectiveRelationshipInfo]);

  const {
    conversation,
    membersById,
    messages,
    pinnedMessages,
    loading,
    loadingMore,
    sending,
    uploading,
    uploadProgressPercent,
    uploadProgressLabel,
    uploadFileProgressMap,
    uploadFailedFileNames,
    error,

    displayName,
    displayAvatar,

    messageText,
    setMessageText,

    messagesEndRef,
    messagesContainerRef,

    showScrollToBottomButton,
    pendingNewMessages,

    isHistoricalMode,
    handleJumpToMessage,
    handleScroll,
    handleScrollToBottomClick,
    handleSend,
    handleSendMixedMedia,
    handlePinMessage,
    handleUnpinMessage,
    handleRecall,
    canRecallOwnMessages,
    handleDeleteMessageForMe,
    addReaction,
    appendRealtimeMessage,
    scrollToBottom,
    recallToast,

    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    cancelRecording,

    defaultAvatarUrl,
    defaultAvatarSmallUrl,

    isNearBottom,
    isInitialLoad,
    shouldScrollOnMediaLoad,
    shouldForceAutoScroll,
    stabilizeMediaLayoutOnMediaLoad,

    readReceipts,
    typingUsers,
    sendTypingSignal,
    userId,
    readOnlyNotice,
  } = useChatWindowController({ conversationId, onMarkAsRead, forcedReadOnlyNotice, onForbidden });

  const headerDisplayName = displayName || name || "Conversation";
  const headerDisplayAvatar = displayAvatar || avatarUrl || defaultAvatarUrl;
  const isConversationReadOnly = Boolean(readOnlyNotice);
  const isAccessBlocked =
    isAccessBlockedNotice(error) || isAccessBlockedNotice(readOnlyNotice);
  const conversationImages = useMemo<MediaViewerImage[]>(
    () =>
      messages.flatMap((message) =>
        getMessageImageUrls(message).map((url) => ({
          url,
          messageId: message.id,
          senderId: message.senderId,
          senderName:
            message.senderName ||
            membersById[Number(message.senderId)]?.nickname ||
            undefined,
          createdAt: message.createdAt,
        }))
      ),
    [membersById, messages]
  );
  const [mediaViewerIndex, setMediaViewerIndex] = useState<number | null>(null);
  const [mediaViewerImages, setMediaViewerImages] = useState<MediaViewerImage[]>([]);
  const [mediaViewerCursor, setMediaViewerCursor] = useState<string | null>(null);
  const [mediaViewerHasMore, setMediaViewerHasMore] = useState(false);
  const [mediaViewerLoadingMore, setMediaViewerLoadingMore] = useState(false);
  const mergeMediaViewerImages = useCallback(
    (base: MediaViewerImage[], incoming: MediaViewerImage[]) => {
      const seen = new Set<string>();
      return [...base, ...incoming].filter((item) => {
        if (!item.url || seen.has(item.url)) return false;
        seen.add(item.url);
        return true;
      });
    },
    []
  );
  const loadMoreViewerImages = useCallback(
    async (cursor: string | null = mediaViewerCursor) => {
      if (mediaViewerLoadingMore) return;

      setMediaViewerLoadingMore(true);
      try {
        const response = await chatService.getConversationMedia(
          conversationId,
          "MEDIA",
          cursor,
          20
        );
        const incoming = response.items
          .filter((item) => item.type === "IMAGE" && Boolean(item.url))
          .map((item) => ({
            url: item.url,
            messageId: item.messageId,
            senderId: item.senderId,
            senderName:
              membersById[Number(item.senderId)]?.nickname ||
              `Người dùng ${item.senderId}`,
            createdAt: item.createdAt,
          }));
        setMediaViewerImages((prev) => mergeMediaViewerImages(prev, incoming));
        setMediaViewerCursor(response.nextCursor);
        setMediaViewerHasMore(response.hasMore);
      } catch {
        setMediaViewerHasMore(false);
      } finally {
        setMediaViewerLoadingMore(false);
      }
    },
    [
      conversationId,
      mediaViewerCursor,
      mediaViewerLoadingMore,
      membersById,
      mergeMediaViewerImages,
    ]
  );
  const openMediaViewer = useCallback(
    (url: string) => {
      const initialImages = mergeMediaViewerImages(conversationImages, [{ url }]);
      setMediaViewerImages(initialImages);
      setMediaViewerCursor(null);
      setMediaViewerHasMore(true);
      void loadMoreViewerImages(null);
      const index = initialImages.findIndex((image) => image.url === url);
      setMediaViewerIndex(index >= 0 ? index : 0);
    },
    [conversationImages, loadMoreViewerImages, mergeMediaViewerImages]
  );
  const closeMediaViewer = useCallback(() => {
    setMediaViewerIndex(null);
  }, []);


  const otherMember = useMemo(
    () => Object.values(membersById).find((m) => m.userId !== userId),
    [membersById, userId]
  );
  const otherMemberUserId = Number(otherMember?.userId);
  const directTargetUserId = useMemo(() => {
    const fromMember = Number(otherMember?.userId);
    if (Number.isFinite(fromMember) && fromMember !== userId) return fromMember;

    const fromProp = Number(directPartnerId);
    if (Number.isFinite(fromProp) && fromProp !== userId) return fromProp;

    const fromConversationMembers = Number(
      conversationMembers?.find((member) => Number(member.userId) !== userId)
        ?.userId
    );
    if (
      Number.isFinite(fromConversationMembers) &&
      fromConversationMembers !== userId
    ) {
      return fromConversationMembers;
    }

    const fromLoadedConversationMembers = Number(
      conversation?.members?.find((member) => Number(member.userId) !== userId)
        ?.userId
    );
    if (
      Number.isFinite(fromLoadedConversationMembers) &&
      fromLoadedConversationMembers !== userId
    ) {
      return fromLoadedConversationMembers;
    }

    const fromConversation = Number(conversation?.directPartnerId);
    if (Number.isFinite(fromConversation) && fromConversation !== userId) {
      return fromConversation;
    }

    return undefined;
  }, [
    conversation?.directPartnerId,
    conversation?.members,
    conversationMembers,
    directPartnerId,
    otherMember?.userId,
    userId,
  ]);
  const isDirectConversation =
    String(conversationType ?? conversation?.type ?? "").toUpperCase() ===
    "DIRECT";
  // Hội thoại DIRECT với tài khoản đã bị khóa: dùng cả cờ trên member lẫn
  // directPartnerLocked (DB tươi) để chắc chắn nhận diện kể cả khi cache members cũ.
  const isPartnerAccountLocked =
    isDirectConversation &&
    (Boolean(conversation?.directPartnerLocked) ||
      Boolean(otherMember?.accountLocked));
  const isDirectBlockedByMe =
    isDirectConversation && Boolean(conversation?.directBlockedByMe);
  const isDirectBlockedMe =
    isDirectConversation && Boolean(conversation?.directBlockedMe);
  const isDirectChatBlocked = isDirectBlockedByMe || isDirectBlockedMe;

  const handleUnblockDirectPartner = useCallback(async () => {
    if (!directTargetUserId || !userId) return;
    try {
      await blockService.unblockUser(Number(userId), Number(directTargetUserId));
      toast.success("Đã bỏ chặn");
      chatRuntimeStore.setConversation(conversationId, {
        ...(conversation as ConversationSidebar),
        directBlockedByMe: false,
      });
      setForceStrangerAfterBlock(true);
      setLoadedRelationshipInfo((previous) =>
        previous
          ? { ...previous, friendStatus: "STRANGER" }
          : directTargetUserId
            ? {
                userId: Number(directTargetUserId),
                name:
                  otherMember?.nickname ||
                  otherMember?.username ||
                  "",
                friendStatus: "STRANGER",
                mutualGroupsCount: 0,
              }
            : previous,
      );
      window.dispatchEvent(
        new CustomEvent("user-block-status-changed", {
          detail: {
            blockerId: Number(userId),
            blockedId: Number(directTargetUserId),
            blocked: false,
          },
        }),
      );
    } catch {
      toast.error("Không thể bỏ chặn");
    }
  }, [
    conversation,
    conversationId,
    directTargetUserId,
    otherMember?.nickname,
    otherMember?.username,
    userId,
  ]);

  useEffect(() => {
    const handleBlockStatusChanged = (event: Event) => {
      if (!userId || !directTargetUserId) return;
      const detail = (event as CustomEvent<{
        blockerId?: number | null;
        blockedId?: number | null;
      }>).detail;
      const blockerId = Number(detail?.blockerId);
      const blockedId = Number(detail?.blockedId);
      const matchesDirectPartner =
        (blockerId === Number(userId) &&
          blockedId === Number(directTargetUserId)) ||
        (blockerId === Number(directTargetUserId) &&
          blockedId === Number(userId));
      if (!matchesDirectPartner) return;

      setForceStrangerAfterBlock(true);
      setLoadedRelationshipInfo((previous) =>
        previous
          ? { ...previous, friendStatus: "STRANGER" }
          : {
              userId: Number(directTargetUserId),
              name: otherMember?.nickname || otherMember?.username || "",
              friendStatus: "STRANGER",
              mutualGroupsCount: 0,
            },
      );
    };

    window.addEventListener("user-block-status-changed", handleBlockStatusChanged);
    return () =>
      window.removeEventListener(
        "user-block-status-changed",
        handleBlockStatusChanged,
      );
  }, [
    directTargetUserId,
    otherMember?.nickname,
    otherMember?.username,
    userId,
  ]);

  useEffect(() => {
    const handleFriendStatusChanged = (event: Event) => {
      if (!userId || !directTargetUserId) return;
      const detail = (event as CustomEvent<{
        event?: string;
        senderId?: number | null;
        receiverId?: number | null;
      }>).detail;
      if (detail?.event !== "friend-accept") return;

      const senderId = Number(detail.senderId);
      const receiverId = Number(detail.receiverId);
      const matchesDirectPartner =
        (senderId === Number(userId) &&
          receiverId === Number(directTargetUserId)) ||
        (senderId === Number(directTargetUserId) &&
          receiverId === Number(userId));
      if (!matchesDirectPartner) return;

      setForceStrangerAfterBlock(false);
      setFriendRequestSent(false);
      setLoadedRelationshipInfo((previous) =>
        previous
          ? { ...previous, friendStatus: "FRIEND" }
          : {
              userId: Number(directTargetUserId),
              name: otherMember?.nickname || otherMember?.username || "",
              friendStatus: "FRIEND",
              mutualGroupsCount: 0,
            },
      );
    };

    window.addEventListener("friend-status-changed", handleFriendStatusChanged);
    return () =>
      window.removeEventListener(
        "friend-status-changed",
        handleFriendStatusChanged,
      );
  }, [
    directTargetUserId,
    otherMember?.nickname,
    otherMember?.username,
    userId,
  ]);

  // Helper dùng chung: 1 user có đang bị khóa tài khoản không.
  // - Ưu tiên cờ trên member (membersById).
  // - Với DIRECT: mọi user KHÔNG phải mình đều là đối phương -> bám
  //   directPartnerLocked (DB tươi), không phụ thuộc cache members hay
  //   việc resolve otherMember (có thể lẫn referenceUsers).
  const isUserAccountLocked = useCallback(
    (targetUserId?: number | null) => {
      if (targetUserId == null || Number.isNaN(Number(targetUserId)))
        return false;
      if (membersById[Number(targetUserId)]?.accountLocked) return true;
      return (
        isDirectConversation &&
        Boolean(conversation?.directPartnerLocked) &&
        Number(targetUserId) !== Number(userId)
      );
    },
    [membersById, isDirectConversation, conversation?.directPartnerLocked, userId],
  );
  const presenceByUserId = usePresenceStatus([otherMemberUserId]);
  const otherMemberPresence = Number.isFinite(otherMemberUserId)
    ? presenceByUserId[otherMemberUserId]
    : undefined;
  const otherMemberPresenceOnline = Boolean(
    conversation?.type === "DIRECT" &&
      !isDirectChatBlocked &&
      Number.isFinite(otherMemberUserId) &&
      otherMemberPresence?.online
  );
  const [presenceNow, setPresenceNow] = useState(() => Date.now());
  useEffect(() => {
    if (otherMemberPresenceOnline || !otherMemberPresence?.lastActiveAt) return;

    // Offline text tự nhảy phút/giờ ở client, không cần backend bắn event mỗi phút.
    const timer = window.setInterval(() => setPresenceNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, [otherMemberPresenceOnline, otherMemberPresence?.lastActiveAt]);
  const otherMemberLastActiveText = formatLastActiveText(
    otherMemberPresence?.lastActiveAt,
    presenceNow
  );
  const {
    status: friendshipStatus,
    loading: friendActionLoading,
    sendRequest: sendFriendRequest,
    acceptRequest: acceptFriendRequest,
    cancelRequest: cancelFriendRequest,
  } = useFriendStatus(otherMember?.userId);
  const {
    friends: contextFriends,
    sentRequests: contextSentRequests,
    friendRequests: contextFriendRequests,
  } = useFriendDataSafe();
  const isFriendInContext = useMemo(
    () =>
      contextFriends.some(
        (friend: any) => String(friend.id) === String(otherMember?.userId)
      ),
    [contextFriends, otherMember?.userId]
  );
  const isSentRequestInContext = useMemo(
    () =>
      contextSentRequests.some(
        (request: any) => String(request.id) === String(otherMember?.userId)
      ),
    [contextSentRequests, otherMember?.userId]
  );
  const isReceivedRequestInContext = useMemo(
    () =>
      contextFriendRequests.some(
        (request: any) => String(request.id) === String(otherMember?.userId)
      ),
    [contextFriendRequests, otherMember?.userId]
  );
  const isFriend =
    !isDirectChatBlocked &&
    !forceStrangerAfterBlock &&
    (friendshipStatus === "friends" ||
      isFriendInContext ||
      effectiveRelationshipInfo?.friendStatus === "FRIEND");
  const otherMemberOnline = Boolean(isFriend && otherMemberPresenceOnline);
  const isPendingReceived =
    friendshipStatus === "pending_received" || isReceivedRequestInContext;
  const isPendingSent =
    friendshipStatus === "pending_sent" ||
    friendRequestSent ||
    isSentRequestInContext;
  const resolvedRelationshipText = useMemo(() => {
    if (!effectiveRelationshipInfo || !isFriend) {
      return relationshipText;
    }

    const mutualGroupsCount = Number(
      effectiveRelationshipInfo.mutualGroupsCount ?? 0
    );
    return mutualGroupsCount > 0
      ? `Bạn bè · Nhóm chung (${mutualGroupsCount})`
      : "Bạn bè";
  }, [effectiveRelationshipInfo, isFriend, relationshipText]);
  const headerStatusText =
    conversation?.type === "DIRECT"
      ? isDirectChatBlocked
        ? "Người lạ"
        : forceStrangerAfterBlock
        ? "Người lạ"
        : !isFriend
        ? resolvedRelationshipText || relationshipText || "Người lạ"
        : otherMemberOnline
        ? "Đang hoạt động"
        : otherMemberLastActiveText || resolvedRelationshipText || "Không hoạt động"
      : null;
  const canShowFriendBanner =
    !isDirectChatBlocked &&
    Boolean(effectiveRelationshipInfo) &&
    !isFriend &&
    (forceStrangerAfterBlock ||
      effectiveRelationshipInfo?.friendStatus !== "FRIEND");

  useEffect(() => {
    setFriendRequestSent(false);
    setFriendRequestSending(false);
    setForceStrangerAfterBlock(false);
  }, [otherMember?.userId]);

  useEffect(() => {
    if (friendshipStatus !== "pending_sent") {
      setFriendRequestSent(false);
    }
  }, [friendshipStatus]);

  const handleSendFriendRequest = useCallback(async () => {
    if (!userId || !otherMember?.userId || friendRequestSending) {
      return;
    }

    setFriendRequestSending(true);
    try {
      if (isPendingSent) {
        setFriendRequestSent(false);
        const ok = await cancelFriendRequest();
        if (!ok) throw new Error("cancel failed");
      } else {
        const ok = await sendFriendRequest();
        if (!ok) throw new Error("send failed");
        setForceStrangerAfterBlock(false);
        setFriendRequestSent(true);
      }
    } catch {
      if (isPendingSent) {
        setFriendRequestSent(true);
      }
      window.alert(
        isPendingSent
          ? "Không thể hủy lời mời kết bạn. Vui lòng thử lại."
          : "Không thể gửi lời mời kết bạn. Vui lòng thử lại.",
      );
    } finally {
      setFriendRequestSending(false);
    }
  }, [
    cancelFriendRequest,
    friendRequestSending,
    isPendingSent,
    otherMember?.userId,
    sendFriendRequest,
    userId,
  ]);

  const handleAcceptFriendRequest = useCallback(async () => {
    if (!userId || !otherMember?.userId || friendRequestSending) {
      return;
    }

    setFriendRequestSending(true);
    try {
      const ok = await acceptFriendRequest();
      if (!ok) throw new Error("accept failed");
      setForceStrangerAfterBlock(false);
      setFriendRequestSent(false);
      setLoadedRelationshipInfo((previous) =>
        previous
          ? { ...previous, friendStatus: "FRIEND" }
          : previous,
      );
    } catch {
      window.alert("Khong the chap nhan loi moi ket ban. Vui long thu lai.");
    } finally {
      setFriendRequestSending(false);
    }
  }, [
    acceptFriendRequest,
    friendRequestSending,
    otherMember?.userId,
    userId,
  ]);

  useEffect(() => {
    if (peerRelationshipInfo) {
      setLoadedRelationshipInfo(null);
      return;
    }
    if (conversation?.type !== "DIRECT" || !otherMember?.userId) {
      setLoadedRelationshipInfo(null);
      return;
    }

    let cancelled = false;
    chatService
      .getChatUserRelationship(otherMember.userId)
      .then((result) => {
        if (!cancelled) setLoadedRelationshipInfo(result);
      })
      .catch(() => {
        if (!cancelled) setLoadedRelationshipInfo(null);
      });

    return () => {
      cancelled = true;
    };
  }, [conversation?.type, otherMember?.userId, peerRelationshipInfo]);

  const callMemberSource = useMemo(() => {
    if (conversationMembers?.length) {
      return conversationMembers
        .filter((member) => {
          const status = String(member.status ?? "ACTIVE").toUpperCase();
          return status === "ACTIVE";
        })
        .map((member) => {
          const realtimeMember = membersById[Number(member.userId)];
          return realtimeMember
            ? {
                ...member,
                accountLocked: realtimeMember.accountLocked ?? member.accountLocked,
                role: realtimeMember.role ?? member.role,
                nickname: realtimeMember.nickname || member.nickname,
                avatar: realtimeMember.avatar || member.avatar,
                username: realtimeMember.username || member.username,
              }
            : member;
        });
    }

    const mergedMembers = new Map<number, ConversationMember>();
    for (const member of conversation?.members ?? []) {
      if (Number.isFinite(Number(member.userId))) {
        mergedMembers.set(Number(member.userId), member);
      }
    }
    for (const member of Object.values(membersById)) {
      if (Number.isFinite(Number(member.userId))) {
        mergedMembers.set(Number(member.userId), {
          ...mergedMembers.get(Number(member.userId)),
          ...member,
        });
      }
    }
    return Array.from(mergedMembers.values());
  }, [conversation?.members, conversationMembers, membersById]);

  const isGroupConversation =
    String(conversationType ?? conversation?.type ?? "").toUpperCase() === "GROUP" ||
    callMemberSource.length > 2;

  const callableMembers = useMemo(
    () =>
      callMemberSource.filter((member) => {
        const status = String(member.status ?? "ACTIVE").toUpperCase();
        return (
          member.userId !== userId &&
          !CALL_BLOCKED_MEMBER_STATUSES.has(status) &&
          !member.accountLocked
        );
      }),
    [callMemberSource, userId]
  );

  const targetMemberIds = useMemo(
    () => callableMembers.map((member) => member.userId),
    [callableMembers]
  );

  const [pendingIncomingCall, setPendingIncomingCall] =
    useState<CallSignalPayload | null>(() => {
      if (typeof sessionStorage === "undefined") return null;
      const raw = sessionStorage.getItem(PENDING_INCOMING_CALL_KEY);
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as CallSignalPayload;
        return parsed?.conversationId === conversationId ? parsed : null;
      } catch {
        return null;
      }
    });

  const consumePendingIncomingCall = useCallback(() => {
    sessionStorage.removeItem(PENDING_INCOMING_CALL_KEY);
    setPendingIncomingCall(null);
  }, []);

  const {
    incomingCall,
    activeCall,
    localStream,
    remoteStream,
    remoteStreams,
    callDurationText,
    micEnabled,
    cameraEnabled,
    isScreenSharing,
    canToggleCamera,
    canShareScreen,
    rejoinableCall,
    busyCallUserId,
    startCall,
    rejoinActiveCall,
    clearBusyCallNotice,
    acceptIncomingCall,
    rejectIncomingCall,
    endCall,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    inviteUsersToCall,
    maxCallParticipants,
  } = useCall({
    conversationId,
    userId,
    callerName:
      membersById[userId]?.nickname ||
      membersById[userId]?.username ||
      `Người dùng ${userId}`,
    callerAvatar: membersById[userId]?.avatar,
    targetUserIds: targetMemberIds,
    targetUserId: directTargetUserId,
    targetName: otherMember?.nickname,
    targetAvatar: otherMember?.avatar,
    pendingIncomingCall,
    onPendingIncomingCallConsumed: consumePendingIncomingCall,
    onCallMessageSaved: appendRealtimeMessage,
  });

  useEffect(() => {
    if (!busyCallUserId) return;
    const member = membersById[busyCallUserId];
    const name =
      member?.nickname || member?.username || `Người dùng ${busyCallUserId}`;
    toast.error(`${name} đang bận trong cuộc gọi khác`);
    clearBusyCallNotice();
  }, [busyCallUserId, clearBusyCallNotice, membersById]);

  const {
    consentLoading,
    consentModalOpen,
    summary,
    suggestions,
    aiError,
    isSummarizing,
    isSuggesting,
    acceptAIConsent,
    declineAIConsent,
    summarizeConversation,
    suggestReplies,
  } = useChatAI({ conversationId });

  useEffect(() => {
    onActiveCallChange?.(conversationId, Boolean(activeCall));
  }, [activeCall, conversationId, onActiveCallChange]);

  useEffect(() => {
    const callPath = `/messages/${conversationId}/call`;
    const messagePath = `/messages/${conversationId}`;

    if (
      !activeCall &&
      !incomingCall &&
      !pendingIncomingCall &&
      location.pathname === callPath
    ) {
      navigate(messagePath, { replace: true });
    }
  }, [
    activeCall,
    conversationId,
    incomingCall,
    location.pathname,
    navigate,
    pendingIncomingCall,
  ]);

  const callParticipants = useMemo(() => {
    if (!activeCall || !isGroupConversation) return [];

    const callMemberIds = new Set<number>(
      activeCall.participantUserIds?.length
        ? activeCall.participantUserIds
        : activeCall.remoteUserIds
    );
    callMemberIds.add(userId);

    return Object.values(membersById)
      .filter((member) => callMemberIds.has(member.userId))
      .map((member) => ({
        userId: member.userId,
        name: member.nickname || member.username || "NgÆ°á»i dÃ¹ng",
        avatar: member.avatar,
      }));
  }, [activeCall, isGroupConversation, membersById, userId]);

  const [callPickerOpen, setCallPickerOpen] = useState(false);
  const [callPickerMode, setCallPickerMode] = useState<"start" | "invite">("start");
  const [callPickerType, setCallPickerType] = useState<"audio" | "video">("audio");
  const [selectedCallMemberIds, setSelectedCallMemberIds] = useState<Set<number>>(new Set());
  const callPickerLimit = Math.max(
    0,
    maxCallParticipants - (callPickerMode === "invite" ? 1 + (activeCall?.remoteUserIds.length ?? 0) : 1)
  );
  const showAlreadyInCallError = useCallback(() => {
    toast.error("Bạn đang trong một cuộc gọi khác. Hãy kết thúc cuộc gọi hiện tại trước.");
  }, []);

  const isStartingAnotherCall = useCallback(() => {
    if (activeCall) return true;
    const runtimeCall = chatRuntimeStore.getActiveCall();
    return Boolean(runtimeCall && runtimeCall.userId === userId);
  }, [activeCall, userId]);

  const openStartCallPicker = useCallback(
    (callType: "audio" | "video") => {
      if (isStartingAnotherCall()) {
        showAlreadyInCallError();
        return;
      }

      if (!isGroupConversation) {
        void startCall(callType);
        return;
      }
      if (callableMembers.length === 0) {
        void startCall(callType);
        return;
      }
      setCallPickerMode("start");
      setCallPickerType(callType);
      setSelectedCallMemberIds(new Set());
      setCallPickerOpen(true);
    },
    [
      callableMembers.length,
      isGroupConversation,
      isStartingAnotherCall,
      showAlreadyInCallError,
      startCall,
    ]
  );

  const openInviteCallPicker = useCallback(() => {
    if (!activeCall) return;
    setCallPickerMode("invite");
    setCallPickerType(activeCall.callType);
    setSelectedCallMemberIds(new Set());
    setCallPickerOpen(true);
  }, [activeCall]);

  const toggleCallMember = useCallback(
    (memberId: number) => {
      setSelectedCallMemberIds((prev) => {
        const next = new Set(prev);
        if (next.has(memberId)) {
          next.delete(memberId);
          return next;
        }
        if (next.size >= callPickerLimit) return next;
        next.add(memberId);
        return next;
      });
    },
    [callPickerLimit]
  );

  const submitCallPicker = useCallback(async () => {
    const ids = Array.from(selectedCallMemberIds);
    if (!ids.length) return;
    if (callPickerMode === "invite") {
      await inviteUsersToCall(ids);
    } else {
      if (isStartingAnotherCall()) {
        showAlreadyInCallError();
        return;
      }
      await startCall(callPickerType, ids);
    }
    setCallPickerOpen(false);
    setSelectedCallMemberIds(new Set());
  }, [
    callPickerMode,
    callPickerType,
    isStartingAnotherCall,
    inviteUsersToCall,
    selectedCallMemberIds,
    showAlreadyInCallError,
    startCall,
  ]);

  const callPickerMembers = useMemo(() => {
    const activeRemoteIds = new Set(activeCall?.remoteUserIds ?? []);
    return callableMembers.filter((member) =>
      callPickerMode === "invite" ? !activeRemoteIds.has(member.userId) : true
    );
  }, [activeCall?.remoteUserIds, callableMembers, callPickerMode]);

  const hasInviteCallCandidates = useMemo(() => {
    const activeRemoteIds = new Set(activeCall?.remoteUserIds ?? []);
    return callableMembers.some((member) => !activeRemoteIds.has(member.userId));
  }, [activeCall?.remoteUserIds, callableMembers]);

  // UI state cho khu vực banner ghim:
  // - false: hiển thị dạng gọn (1 item chính)
  // - true: bung danh sách các item ghim còn lại
  const [showPinnedList, setShowPinnedList] = useState(false);
  const [openPinnedMenuId, setOpenPinnedMenuId] = useState<string | null>(null);

  // State quản lý việc thu gọn tin nhắn hệ thống liên tiếp (3 tin trở lên)
  const [expandedSystemGroups, setExpandedSystemGroups] = useState<Set<string>>(
    new Set()
  );

  const toggleSystemGroup = useCallback((firstMsgId: string) => {
    setExpandedSystemGroups((prev) => {
      const next = new Set(prev);
      if (next.has(firstMsgId)) next.delete(firstMsgId);
      else next.add(firstMsgId);
      return next;
    });
  }, []);

  const pinnedBannerItems = useMemo(() => {
    // Chuẩn hoá text preview theo loại tin nhắn để banner dễ đọc.
    const previewText = (type?: string, content?: string) => {
      if (type === "IMAGE") return "[Hình ảnh]";
      if (type === "VIDEO") return "[Video]";
      if (type === "AUDIO") return "[Tin nhắn thoại]";
      if (type === "FILE") return "[Tệp đính kèm]";
      if (type === "CALL") return "[Cuộc gọi]";
      return content || "Tin nhắn";
    };

    return pinnedMessages.map((pin) => {
      const matchedMessage = messages.find(
        (message) => message.id === pin.messageId
      );

      // Ưu tiên thông tin từ tin nhắn đã tải, nếu không có thì lấy từ dữ liệu ghim
      const msgType = matchedMessage?.type || pin.type;
      const msgContent = matchedMessage?.content || pin.content;
      const senderId = matchedMessage?.senderId || pin.originalSenderId;

      const originalSender = senderId ? membersById[senderId] : undefined;
      const senderName = maskDisplayName(
        isUserAccountLocked(senderId),
        originalSender?.nickname || "Người dùng",
      );

      // Nếu tin ghim là ảnh thì hiện thumbnail nhỏ trong banner/list.
      const thumbUrl = msgType === "IMAGE" ? msgContent : undefined;

      return {
        ...pin,
        preview: previewText(msgType, msgContent),
        thumbUrl,
        senderName,
      };
    });
  }, [membersById, messages, pinnedMessages]);

  // Item ghim đầu tiên luôn hiển thị ở banner dạng gọn.
  const primaryPinnedItem = pinnedBannerItems[0];
  const hiddenPinnedItems = pinnedBannerItems.slice(1);
  const hiddenPinnedCount = hiddenPinnedItems.length;
  const canExpandPinnedList = hiddenPinnedCount > 0;

  useEffect(() => {
    if (!canExpandPinnedList && showPinnedList) {
      setShowPinnedList(false);
    }
  }, [canExpandPinnedList, showPinnedList]);

  useEffect(() => {
    function handlePinnedMenuOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("[data-pin-menu='true']")) return;
      setOpenPinnedMenuId(null);
    }

    document.addEventListener("mousedown", handlePinnedMenuOutside);
    return () =>
      document.removeEventListener("mousedown", handlePinnedMenuOutside);
  }, []);

  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<{
    id: string;
    senderName: string;
    content: string;
  } | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const [jumpRequestToken, setJumpRequestToken] = useState(0);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const pendingJumpMessageIdRef = useRef<string | null>(null);
  const messageElementRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [selectedFiles, setSelectedFiles] = useState<
    Array<{ id: string; file: File }>
  >([]);
  const [selectedImagePreviewUrls, setSelectedImagePreviewUrls] = useState<
    Record<string, string>
  >({});
  const selectedImagePreviewUrlsRef = useRef<Record<string, string>>({});
  const [forwardSourceMessage, setForwardSourceMessage] = useState<Message | null>(null);
  const [forwardConversations, setForwardConversations] = useState<ConversationSidebar[]>([]);
  const [forwardSelectedIds, setForwardSelectedIds] = useState<Set<number>>(new Set());
  const [forwardLoading, setForwardLoading] = useState(false);
  const [forwardSubmitting, setForwardSubmitting] = useState(false);
  const [forwardError, setForwardError] = useState<string | null>(null);

  useEffect(() => {
    if (!plusMenuOpen) return;
    function handleOutside(e: MouseEvent) {
      if (
        plusMenuRef.current &&
        !plusMenuRef.current.contains(e.target as Node)
      ) {
        setPlusMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [plusMenuOpen]);

  // Click outside để đóng emoji picker
  useEffect(() => {
    if (!emojiPickerOpen) return;
    function handleOutside(e: MouseEvent) {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target as Node)
      ) {
        setEmojiPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [emojiPickerOpen]);

  // Handle emoji click
  const onEmojiClick = useCallback(
    (emojiData: EmojiClickData) => {
      setMessageText((prev) => prev + emojiData.emoji);
      messageInputRef.current?.focus();
    },
    [setMessageText]
  );

  // Refs cho hidden file inputs (Đính kèm file / Chọn GIF)
  const attachInputRef = useRef<HTMLInputElement>(null);
  const gifInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  const handleApplySuggestion = useCallback(
    (suggestion: string) => {
      setMessageText(suggestion);
      requestAnimationFrame(() => {
        messageInputRef.current?.focus();
      });
    },
    [setMessageText]
  );

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files ?? []);
    if (incoming.length === 0) return;

    setSelectedFiles((prev) => [
      ...prev,
      ...incoming.map((file) => ({
        id: createClientFileId(),
        file,
      })),
    ]);
    e.target.value = ""; // reset để cho phép chọn lại cùng file

    // Giữ trải nghiệm chat liên tục: chọn file xong vẫn focus vào ô nhập.
    requestAnimationFrame(() => {
      messageInputRef.current?.focus();
    });
  }, []);

  const selectedFileItems = useMemo(
    () =>
      selectedFiles.map((item) => ({
        key: item.id,
        file: item.file,
        isImage: item.file.type.startsWith("image/"),
      })),
    [selectedFiles]
  );

  const removeSelectedFile = useCallback((key: string) => {
    setSelectedFiles((prev) => prev.filter((item) => item.id !== key));
  }, []);

  useEffect(() => {
    setSelectedImagePreviewUrls((prev) => {
      const next = { ...prev };

      for (const [key, url] of Object.entries(next)) {
        const stillUsed = selectedFileItems.some(
          (item) => item.key === key && item.isImage
        );
        if (!stillUsed) {
          URL.revokeObjectURL(url);
          delete next[key];
        }
      }

      for (const item of selectedFileItems) {
        if (!item.isImage) continue;
        if (!next[item.key]) {
          next[item.key] = URL.createObjectURL(item.file);
        }
      }

      return next;
    });
  }, [selectedFileItems]);

  useEffect(() => {
    selectedImagePreviewUrlsRef.current = selectedImagePreviewUrls;
  }, [selectedImagePreviewUrls]);

  useEffect(() => {
    return () => {
      for (const url of Object.values(selectedImagePreviewUrlsRef.current)) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const getMessagePreviewText = useCallback(
    (message: (typeof messages)[number]) => {
      if (message.type === "IMAGE") return "[Hình ảnh]";
      if (message.type === "VIDEO") return "[Video]";
      if (message.type === "AUDIO") return "[Tin nhắn thoại]";
      if (message.type === "FILE") return "[Tệp đính kèm]";
      if (message.type === "CALL") return "[Cuộc gọi]";
      return message.content || "Tin nhắn";
    },
    []
  );

  const handleReplyMessage = useCallback(
    (message: (typeof messages)[number]) => {
      const sender = membersById[message.senderId];
      setReplyToMessage({
        id: message.id,
        senderName: maskDisplayName(
          isUserAccountLocked(message.senderId),
          sender?.nickname || "Người dùng",
        ),
        content: getMessagePreviewText(message),
      });

      // Click menu có thể làm input blur, nên refocus ở frame kế tiếp.
      requestAnimationFrame(() => {
        messageInputRef.current?.focus();
      });
    },
    [getMessagePreviewText, membersById, isUserAccountLocked]
  );

  const openForwardModal = useCallback(
    async (message: Message) => {
      setForwardSourceMessage(message);
      setForwardSelectedIds(new Set());
      setForwardError(null);
      setForwardLoading(true);

      try {
        const response = await chatService.getForwardableConversations();
        setForwardConversations(
          (response.data ?? []).filter((item) =>
            canForwardToConversation(item, userId)
          )
        );
      } catch {
        setForwardError("Khong the tai danh sach hoi thoai");
      } finally {
        setForwardLoading(false);
      }
    },
    [userId]
  );

  const forwardViewerImage = useCallback(
    (image: MediaViewerImage) => {
      const sourceMessage =
        messages.find((message) => message.id === image.messageId) ||
        messages.find((message) => getMessageImageUrls(message).includes(image.url));
      if (sourceMessage) {
        void openForwardModal(sourceMessage);
        return;
      }
      if (image.messageId) {
        void openForwardModal({
          id: image.messageId,
          conversationId,
          content: image.url,
          type: "IMAGE",
          createdAt: image.createdAt || new Date().toISOString(),
          senderId: image.senderId || userId,
          senderName: image.senderName,
          attachments: [{ url: image.url }],
        });
      }
    },
    [conversationId, messages, openForwardModal, userId]
  );

  const closeForwardModal = useCallback(() => {
    if (forwardSubmitting) return;
    setForwardSourceMessage(null);
    setForwardSelectedIds(new Set());
    setForwardError(null);
  }, [forwardSubmitting]);

  const toggleForwardTarget = useCallback((targetId: number) => {
    setForwardSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(targetId)) next.delete(targetId);
      else next.add(targetId);
      return next;
    });
  }, []);

  const submitForwardMessage = useCallback(async () => {
    if (!forwardSourceMessage || forwardSelectedIds.size === 0) return;

    try {
      setForwardSubmitting(true);
      setForwardError(null);
      await chatService.forwardMessage({
        sourceMessageId: forwardSourceMessage.id,
        targetConversationIds: Array.from(forwardSelectedIds),
      });
      setForwardSourceMessage(null);
      setForwardSelectedIds(new Set());
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message || "Khong the chuyen tiep tin nhan";
      setForwardError(message);
    } finally {
      setForwardSubmitting(false);
    }
  }, [forwardSelectedIds, forwardSourceMessage]);

  const focusAndHighlightMessage = useCallback((messageId: string): boolean => {
    const tryHighlight = (attempt: number) => {
      const target = messageElementRefs.current[messageId];
      if (!target) {
        if (attempt < 12) {
          requestAnimationFrame(() => tryHighlight(attempt + 1));
        }
        return;
      }

      target.scrollIntoView({ behavior: "auto", block: "center" });
      setHighlightedMessageId(messageId);

      setTimeout(() => {
        setHighlightedMessageId((prev) => (prev === messageId ? null : prev));
      }, 2400);
    };

    requestAnimationFrame(() => tryHighlight(0));
    return true;
  }, []);

  const requestJumpToMessage = useCallback(
    async (messageId: string) => {
      pendingJumpMessageIdRef.current = messageId;

      const jumpOk = await handleJumpToMessage(messageId);
      if (!jumpOk) {
        pendingJumpMessageIdRef.current = null;
        return;
      }

      setJumpRequestToken((token) => token + 1);
    },
    [handleJumpToMessage]
  );

  // Click vào item ghim ở banner/list sẽ cuộn tới đúng tin gốc trong đoạn chat.
  const handleOpenPinnedMessage = useCallback(
    (messageId: string) => {
      void requestJumpToMessage(messageId);
    },
    [requestJumpToMessage]
  );

  const requestOpenPollMessage = useCallback(
    (messageId: string) => {
      setInternalOpenPollMessageId(messageId);
      setInternalOpenPollModalToken((token) => token + 1);
      if (!messageElementRefs.current[messageId]) {
        void requestJumpToMessage(messageId);
      }
    },
    [requestJumpToMessage]
  );

  const activeOpenPollMessageId = openPollMessageId ?? internalOpenPollMessageId;
  const activeOpenPollModalToken = openPollMessageId
    ? openPollModalToken
    : internalOpenPollModalToken;

  useEffect(() => {
    if (!activeOpenPollMessageId || !activeOpenPollModalToken) return;
    if (messageElementRefs.current[activeOpenPollMessageId]) return;
    void requestJumpToMessage(activeOpenPollMessageId);
  }, [activeOpenPollMessageId, activeOpenPollModalToken, requestJumpToMessage]);

  // Focus vào input khi component mount hoặc chuyển conversation
  useEffect(() => {
    // Timeout nhỏ để đảm bảo input đã render xong
    const timer = setTimeout(() => {
      messageInputRef.current?.focus();
    }, 100);

    return () => clearTimeout(timer);
  }, [conversationId]);

  // Focus vào input sau khi gửi tin nhắn thành công
  useEffect(() => {
    if (!sending && !uploading) {
      messageInputRef.current?.focus();
    }
  }, [sending, uploading]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  // ====== Render messages theo nhóm ngày (Zalo-style) ======
  // Yêu cầu:
  // - Nhãn ngày nằm giữa luồng chat
  // - Xuất hiện trước tin nhắn đầu tiên của ngày đó
  // - Nội dung: Hôm nay / Hôm qua / dd/MM / dd/MM/yyyy (nếu khác năm)
  // - Mỗi ngày chỉ hiển thị 1 lần
  //
  // Ghi chú: logic này giả định `messages` được sắp theo thời gian tăng dần
  // (tin cũ -> tin mới) để nhãn ngày hiển thị đúng vị trí.
  const messageItems = useMemo(() => {
    const items: ReactNode[] = [];
    const messageById = new Map(messages.map((msg) => [msg.id, msg]));

    // Chuẩn hoá về "đầu ngày" (00:00) để so sánh hôm nay/hôm qua chính xác.
    const startOfDay = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate());

    // Format nhãn ngày theo quy tắc sản phẩm.
    const formatDateLabel = (date: Date) => {
      const now = new Date();
      const todayStart = startOfDay(now);
      const dateStart = startOfDay(date);

      const diffDays = Math.round(
        (todayStart.getTime() - dateStart.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays === 0) return "Hôm nay";
      if (diffDays === 1) return "Hôm qua";

      const dd = String(date.getDate()).padStart(2, "0");
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const yyyy = date.getFullYear();

      if (yyyy !== now.getFullYear()) return `${dd}/${mm}/${yyyy}`;
      return `${dd}/${mm}`;
    };

    // Khoá ngày ổn định để phát hiện "tin nhắn đầu tiên của ngày".
    const getDayKey = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(date.getDate()).padStart(2, "0")}`;

    let previousDayKey: string | null = null;
    const isSystemMessageType = (type?: string) => type?.startsWith("SYSTEM_");
    const shouldHideMessageMeta = (type?: string) =>
      isSystemMessageType(type) || type === "POLL";

    for (let idx = 0; idx < messages.length; idx++) {
      const message = messages[idx];
      const stableMessageKey =
        message.id ||
        `${message.senderId}-${message.createdAt || "unknown"}-${idx}`;

      const createdAt = new Date(message.createdAt);
      const validDate = Number.isFinite(createdAt.getTime());
      const dayKey = validDate ? getDayKey(createdAt) : "invalid-date";

      // Nhãn ngày: chỉ chèn khi "đổi ngày" so với message trước đó.
      if (dayKey !== previousDayKey) {
        items.push(
          <div
            key={`date-sep-${stableMessageKey}-${dayKey}`}
            className="flex justify-center py-2 mt-4 first:mt-0"
          >
            <div className="px-3 py-1 rounded-md bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-100 text-xs">
              {validDate ? formatDateLabel(createdAt) : ""}
            </div>
          </div>
        );
        previousDayKey = dayKey;
      }

      const isCurrentSystem = isSystemMessageType(message.type);
      const hideMessageMeta = shouldHideMessageMeta(message.type);
      const prevMsg = messages[idx - 1];

      // --- LOGIC GOM NHÓM TIN NHẮN HỆ THỐNG ---
      // Chỉ kiểm tra gom nhóm nếu đây là tin nhắn hệ thống ĐẦU TIÊN của một chuỗi
      const isStartOfSystemSequence =
        isCurrentSystem &&
        (!prevMsg ||
          !isSystemMessageType(prevMsg.type) ||
          getDayKey(new Date(prevMsg.createdAt)) !== dayKey);

      if (isStartOfSystemSequence) {
        let groupEnd = idx;
        // Tìm chuỗi tin nhắn hệ thống liên tiếp TRONG CÙNG MỘT NGÀY
        while (
          groupEnd + 1 < messages.length &&
          isSystemMessageType(messages[groupEnd + 1].type) &&
          getDayKey(new Date(messages[groupEnd + 1].createdAt)) === dayKey
        ) {
          groupEnd++;
        }

        const groupCount = groupEnd - idx + 1;
        const groupFirstMsgId =
          messages[idx].id || `sys-group-${stableMessageKey}`;

        // Nếu có từ 3 tin trở lên và chưa được mở rộng -> Hiện nút bấm và nhảy qua cả nhóm
        if (groupCount >= 3 && !expandedSystemGroups.has(groupFirstMsgId)) {
          items.push(
            <div
              key={`sys-group-btn-${groupFirstMsgId}`}
              className="flex justify-center my-2"
            >
              <button
                type="button"
                onClick={() => toggleSystemGroup(groupFirstMsgId)}
                className="px-6 py-2 rounded-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all group"
              >
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400 group-hover:text-blue-700">
                  Xem cập nhật trước
                </span>
              </button>
            </div>
          );
          idx = groupEnd; // Nhảy qua cả nhóm
          continue;
        }
        // Nếu group < 3 hoặc ĐÃ MỞ RỘNG -> Cho phép vòng lặp tiếp tục để render từng tin
      }

      const nextMsg = messages[idx + 1];

      // Tính group: cùng người gửi & cùng ngày → gộp nhóm
      const prevDayKey = prevMsg
        ? getDayKey(new Date(prevMsg.createdAt))
        : null;
      const nextDayKey = nextMsg
        ? getDayKey(new Date(nextMsg.createdAt))
        : null;

      const isPrevContinuousMessage =
        !!prevMsg &&
        !isCurrentSystem &&
        !isSystemMessageType(prevMsg.type) &&
        prevMsg.senderId === message.senderId &&
        prevDayKey === dayKey;
      const isNextContinuousMessage =
        !!nextMsg &&
        !isCurrentSystem &&
        !isSystemMessageType(nextMsg.type) &&
        nextMsg.senderId === message.senderId &&
        nextDayKey === dayKey;

      const isFirstInGroup = !isPrevContinuousMessage;
      const isLastInGroup = !isNextContinuousMessage;

      // Tin nhắn: dùng MessageBubble để handle recalled state + hover menu.
      const isOwn = message.senderId === userId;

      // Kiểm tra xem tin nhắn này có được ghim không
      const isPinned = pinnedMessages.some(
        (pin) => pin.messageId === message.id
      );

      const senderInfo = membersById[message.senderId];
      // Tài khoản bị khóa -> mask tên + avatar (kể cả tin nhắn cũ).
      const senderLocked = isUserAccountLocked(Number(message.senderId));
      const senderName = maskDisplayName(
        senderLocked,
        senderInfo?.nickname || "Người dùng",
      );
      const senderAvatar = senderLocked
        ? LOCKED_ACCOUNT_AVATAR_URL
        : senderInfo?.avatar;

      const repliedSenderId = message.replyInfo?.senderId;
      const repliedSender =
        typeof repliedSenderId === "number"
          ? membersById[repliedSenderId]
          : undefined;
      const repliedMessage = message.replyInfo?.messageId
        ? messageById.get(message.replyInfo.messageId)
        : undefined;
      const repliedAttachment = Array.isArray(repliedMessage?.attachments)
        ? repliedMessage.attachments[0]
        : undefined;

      const replyInfoContent = (message.replyInfo?.content || "").trim();
      const repliedMessageContent = (repliedMessage?.content || "").trim();
      const resolvedReplyContent =
        replyInfoContent ||
        repliedAttachment?.url ||
        repliedMessageContent ||
        "Tin nhắn";

      const repliedAttachmentMeta = repliedAttachment as
        | (typeof repliedAttachment & Record<string, unknown>)
        | undefined;
      const resolvedReplyThumbnailUrl =
        (typeof repliedAttachmentMeta?.thumbnailUrl === "string" &&
          repliedAttachmentMeta.thumbnailUrl) ||
        (typeof repliedAttachmentMeta?.thumbnail === "string" &&
          repliedAttachmentMeta.thumbnail) ||
        undefined;
      const resolvedReplyPosterUrl =
        (typeof repliedAttachmentMeta?.posterUrl === "string" &&
          repliedAttachmentMeta.posterUrl) ||
        (typeof repliedAttachmentMeta?.poster === "string" &&
          repliedAttachmentMeta.poster) ||
        undefined;

      // Luôn hiện tên người gửi tin gốc được reply (mask nếu tài khoản bị khóa)
      const repliedSenderName = maskDisplayName(
        isUserAccountLocked(repliedSenderId),
        repliedSender?.nickname || "Người dùng",
      );

      const replyPreview = message.replyInfo
        ? {
            messageId: message.replyInfo.messageId,
            senderId: repliedSenderId,
            senderName: repliedSenderName,
            content: resolvedReplyContent,
            type: message.replyInfo.type || repliedMessage?.type,
            fileName: repliedAttachment?.fileName,
            mimeType: repliedAttachment?.type,
            thumbnailUrl: resolvedReplyThumbnailUrl,
            posterUrl: resolvedReplyPosterUrl,
          }
        : null;

      // Tìm các read receipts có lastMessageId trùng với tin nhắn này
      // Chỉ hiển thị cho tin nhắn KHÔNG bị thu hồi và là tin của mình
      const receiptsForThisMessage =
        isOwn && !message.isRecalled && !hideMessageMeta
          ? readReceipts.filter((r) => {
              if (r.lastMessageId === message.id) return true;

              const readIndex = messages.findIndex((item) => item.id === r.lastMessageId);
              if (readIndex < 0 || readIndex < idx) return false;

              const latestOwnReadableIndex = messages
                .slice(0, readIndex + 1)
                .map((item, messageIndex) => ({ item, messageIndex }))
                .filter(
                  ({ item }) =>
                    Number(item.senderId) === Number(userId) &&
                    !item.isRecalled &&
                    !shouldHideMessageMeta(item.type),
                )
                .at(-1)?.messageIndex;

              return latestOwnReadableIndex === idx;
            })
          : [];

      items.push(
        <div
          key={stableMessageKey}
          data-message-id={message.id}
          className={isFirstInGroup ? "mt-3 px-1 sm:px-2" : "mt-2 px-1 sm:px-2"}
          ref={(element) => {
            messageElementRefs.current[message.id] = element;
          }}
        >
          <MessageBubble
            message={message}
            isOwn={isOwn}
            senderName={senderName}
            senderAvatar={senderAvatar}
            replyPreview={replyPreview}
            currentUserId={userId}
            conversationType={conversation?.type}
            defaultAvatarSmallUrl={defaultAvatarSmallUrl}
            isPinned={isPinned}
            onPin={(messageId) => void handlePinMessage(messageId)}
            onUnpin={(messageId) => void handleUnpinMessage(messageId)}
            onReply={handleReplyMessage}
            onForward={openForwardModal}
            onJumpToMessage={requestJumpToMessage}
            onRecall={handleRecall}
            canRecallOwnMessages={canRecallOwnMessages}
            onRecallCall={(callType) => openStartCallPicker(callType)}
            onDeleteForMe={handleDeleteMessageForMe}
            onReaction={addReaction}
            onOpenRequireApprovalDetails={onToggleInfoPanel}
            onOpenPollMessage={requestOpenPollMessage}
            openPollModalToken={
              activeOpenPollMessageId === message.id ? activeOpenPollModalToken : undefined
            }
            onPollModalClose={() => {
              setInternalOpenPollMessageId(null);
              onPollModalClose?.();
            }}
            onOpenMediaViewer={openMediaViewer}
            onMediaLoad={() => {
              stabilizeMediaLayoutOnMediaLoad();
              // Chỉ cuộn xuống cuối khi:
              // 1. Đang trong giai đoạn initial load (F5/mở chat)
              // 2. User đang ở gần cuối (đang xem tin mới)
              // 3. Vừa nhận tin nhắn mới IMAGE/VIDEO (flag được set trong handleNewMessage)
              // KHÔNG dùng isOwn vì sẽ gây scroll khi load tin cũ từ pagination
              if (
                isInitialLoad() ||
                isNearBottom() ||
                shouldScrollOnMediaLoad()
              ) {
                scrollToBottom(shouldForceAutoScroll() ? "auto" : "smooth");
              }
            }}
            isHighlighted={highlightedMessageId === message.id}
            isFirstInGroup={isFirstInGroup}
            isLastInGroup={isLastInGroup}
            membersById={membersById}
          />

          {isOwn && isLastInGroup && !message.isRecalled && !hideMessageMeta && (
            <div className="mt-1 mr-1 flex justify-end gap-1.5">
              {formatMessageMetaTime(message.createdAt) && (
                <span className="inline-flex h-5 items-center rounded-full bg-gray-300 px-2 text-[11px] font-semibold leading-none text-white shadow-sm dark:bg-gray-700 dark:text-gray-200">
                  {formatMessageMetaTime(message.createdAt)}
                </span>
              )}
              {receiptsForThisMessage.length > 0 ? (
                  <span className="flex h-5 items-center -space-x-1">
                    {receiptsForThisMessage.map((receipt) => {
                      const member = membersById[receipt.userId];
                      const receiptLocked = isUserAccountLocked(receipt.userId);
                      const receiptName = maskDisplayName(
                        receiptLocked,
                        member?.nickname || "User",
                      );
                      const receiptAvatar =
                        maskAvatarUrl(receiptLocked, member?.avatar) ||
                        defaultAvatarSmallUrl;
                      return (
                        <img
                          key={receipt.userId}
                          src={receiptAvatar}
                          alt={receiptName}
                          title={`Đã xem bởi ${receiptName}`}
                          className="h-5 w-5 rounded-full border border-white object-cover shadow-sm dark:border-gray-800"
                        />
                      );
                    })}
                  </span>
                ) : (
                  <span
                    className={`inline-flex h-5 min-w-0 items-center rounded-full px-2 text-[11px] font-semibold leading-none shadow-sm ${
                      (message.deliveryStatus ?? "sent") === "failed"
                        ? "bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300"
                        : "bg-gray-300 text-white dark:bg-gray-700 dark:text-gray-200"
                    }`}
                  >
                    {(message.deliveryStatus ?? "sent") === "sending"
                      ? "Đang gửi"
                      : (message.deliveryStatus ?? "sent") === "failed"
                        ? "Chưa gửi"
                        : "Đã gửi"}
                  </span>
                )}
            </div>
          )}

          {/* Read Receipt Avatars - hiển thị avatar "đã xem" bên dưới tin nhắn */}
          {false && receiptsForThisMessage.length > 0 && (
            <div className="flex justify-end mt-1 mr-1 gap-1">
              {receiptsForThisMessage.map((receipt) => {
                // Lấy thông tin member từ conversation
                const member = membersById[receipt.userId];
                return (
                  <img
                    key={receipt.userId}
                    src={member?.avatar || defaultAvatarSmallUrl}
                    alt={member?.nickname || "User"}
                    title={`Đã xem bởi ${member?.nickname || "User"}`}
                    className="w-4 h-4 rounded-full object-cover border border-white dark:border-gray-800"
                  />
                );
              })}
            </div>
          )}
          {false && receiptsForThisMessage.length === 0 &&
            isOwn &&
            isLastInGroup && (
              <div className="mt-1 mr-1 text-right text-[11px] text-gray-400 dark:text-gray-500">
                {(message.deliveryStatus ?? "sent") === "sending"
                  ? "Dang gui..."
                  : (message.deliveryStatus ?? "sent") === "failed"
                    ? "Chua gui duoc"
                    : "Da gui"}
              </div>
            )}
        </div>
      );
    }

    return items;
  }, [
    conversation?.type,
    defaultAvatarSmallUrl,
    handlePinMessage,
    handleDeleteMessageForMe,
    handleReplyMessage,
    openForwardModal,
    handleRecall,
    highlightedMessageId,
    isInitialLoad,
    isNearBottom,
    membersById,
    messageElementRefs,
    shouldScrollOnMediaLoad,
    messages,
    readReceipts,
    requestJumpToMessage,
    scrollToBottom,
    startCall,
    userId,
    expandedSystemGroups,
    toggleSystemGroup,
  ]);

  const currentMessagesForAISummary = useMemo<MessagePreviewDTO[]>(() => {
    const recentMessages = messages.slice(-100);

    return recentMessages.reduce<MessagePreviewDTO[]>((result, message) => {
      const previewContent = getMessagePreviewText(message);
      if (!previewContent?.trim()) {
        return result;
      }

      result.push({
        senderRole: message.senderId === userId ? "me" : "other",
        content: previewContent,
        createdAt: message.createdAt,
      });

      return result;
    }, []);
  }, [messages, userId, getMessagePreviewText]);

  useEffect(() => {
    const pendingId = pendingJumpMessageIdRef.current;
    if (!pendingId) return;

    const focused = focusAndHighlightMessage(pendingId);
    if (focused) {
      pendingJumpMessageIdRef.current = null;
    }
  }, [focusAndHighlightMessage, jumpRequestToken, messageItems.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Đang tải...</p>
      </div>
    );
  }

  if (!conversation) {
    if (isAccessBlocked) {
      return (
        <AccessBlockedState
          message={
            error ||
            readOnlyNotice ||
            "Khong the truy cap cuoc tro chuyen nay."
          }
        />
      );
    }

    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">
          {error || "Không tìm thấy cuộc trò chuyện"}
        </p>
      </div>
    );
  }

  if (isAccessBlocked) {
    return (
      <div className="flex h-full w-full flex-1 items-center justify-center bg-white px-6 text-center dark:bg-black">
        <div className="max-w-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-950/30 dark:text-red-300">
            <X size={28} />
          </div>
          <p className="text-base font-semibold text-gray-900 dark:text-white">
            {error ||
              readOnlyNotice ||
              "Khong the truy cap cuoc tro chuyen nay."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ConversationSearchProvider
      conversationId={conversationId}
      jumpToMessage={requestJumpToMessage}
    >
    <div className="flex h-full w-full flex-1 min-w-0 overflow-hidden">
    <div className="relative flex flex-col h-full min-w-0 flex-1">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200/80 dark:border-gray-700 px-5 py-3.5 bg-white dark:bg-black backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={headerDisplayAvatar}
              alt={headerDisplayName}
              className="h-10 w-10 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-700"
            />
            {otherMemberOnline && (
              <span
                className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500 dark:border-black"
                title="Đang hoạt động"
              />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {headerDisplayName}
            </p>
            {headerStatusText && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {headerStatusText}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
              searchOpen
                ? "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
            }`}
            onClick={() => {
              if (!searchOpen && showInfoPanel) {
                onToggleInfoPanel?.();
              }
              setSearchOpen((prev) => !prev);
            }}
            title="Tìm tin nhắn"
            type="button"
          >
            <Search size={18} />
          </button>
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white disabled:opacity-40"
            onClick={() => openStartCallPicker("audio")}
            disabled={
              isGroupConversation
                ? false
                : !directTargetUserId || isPartnerAccountLocked || isDirectChatBlocked
            }
            title="Gọi thoại"
          >
            <Phone size={18} />
          </button>
          {/* {rejoinableCall && !activeCall && (
            <button
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-green-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-green-700"
              onClick={() => void rejoinActiveCall()}
              title="Tham gia lại cuộc gọi"
              type="button"
            >
              <Phone size={16} />
              Tham gia lại
            </button>
          )} */}
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white disabled:opacity-40"
            onClick={() => openStartCallPicker("video")}
            disabled={
              isGroupConversation
                ? false
                : !directTargetUserId || isPartnerAccountLocked || isDirectChatBlocked
            }
            title="Gọi video"
          >
            <Video size={18} />
          </button>
          <button
            type="button"
            onClick={onToggleInfoPanel}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
              showInfoPanel
                ? "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/40"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
            }`}
            title={showInfoPanel ? "Ẩn thông tin" : "Hiện thông tin"}
          >
            <Info size={18} />
          </button>
        </div>
      </div>

      {canShowFriendBanner && (
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-2.5 dark:border-[#262626] dark:bg-[#080808]">
          <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 shadow-sm dark:bg-black">
            <div className="flex min-w-0 items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
              <Plus size={18} />
              <span>
                {isPendingReceived
                  ? "Người này đã gửi lời mời kết bạn cho bạn"
                  : "Gửi yêu cầu kết bạn tới người này"}
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                isPendingReceived
                  ? void handleAcceptFriendRequest()
                  : void handleSendFriendRequest()
              }
              disabled={friendRequestSending || friendActionLoading}
              className="rounded-lg bg-gray-200 px-3.5 py-1.5 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-300 disabled:cursor-default disabled:opacity-70 dark:bg-gray-800 dark:text-gray-100"
            >
              {isPendingReceived
                ? friendRequestSending || friendActionLoading
                  ? "Đang chấp nhận..."
                  : "Chấp nhận yêu cầu"
                : isPendingSent
                ? friendRequestSending || friendActionLoading
                  ? "Đang hủy..."
                  : "Hủy yêu cầu"
                : friendRequestSending || friendActionLoading
                  ? "Đang gửi..."
                  : "Gửi kết bạn"}
            </button>
          </div>
        </div>
      )}

      {pinnedBannerItems.length > 0 && (
        <div className="bg-gray-50 px-2.5 py-2 border-b border-gray-200 dark:bg-black dark:border-[#262626]">
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-2.5 py-2 shadow-sm dark:border-[#303030] dark:bg-gray-900">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-gray-800 dark:text-blue-300">
              <MessageCircle size={16} />
            </span>

            {primaryPinnedItem && (
              <button
                type="button"
                onClick={() =>
                  handleOpenPinnedMessage(primaryPinnedItem.messageId)
                }
                className="min-w-0 flex-1 rounded-md px-1 py-0.5 text-left text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
                title="Đi tới tin nhắn đã ghim"
              >
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Tin nhắn
                </p>
                <p className="truncate text-sm text-gray-600 dark:text-gray-300">
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    {primaryPinnedItem.senderName}:
                  </span>{" "}
                  {primaryPinnedItem.preview}
                </p>
              </button>
            )}

            {canExpandPinnedList && (
              <button
                type="button"
                onClick={() => setShowPinnedList((prev) => !prev)}
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-[#3a3a3a] dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
                title={
                  showPinnedList
                    ? "Thu gọn danh sách ghim"
                    : "Mở danh sách ghim"
                }
                aria-expanded={showPinnedList}
                aria-label="Hiện danh sách tin nhắn ghim"
              >
                <span>+{hiddenPinnedCount} ghim</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform ${
                    showPinnedList ? "rotate-180" : "rotate-0"
                  }`}
                />
              </button>
            )}

            {primaryPinnedItem && (
              <div className="relative shrink-0" data-pin-menu="true">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const key = `${primaryPinnedItem.messageId}-${primaryPinnedItem.pinnedAt}`;
                    setOpenPinnedMenuId((prev) => (prev === key ? null : key));
                  }}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  title="Tùy chọn ghim"
                >
                  <MoreVertical size={16} />
                </button>

                {openPinnedMenuId ===
                  `${primaryPinnedItem.messageId}-${primaryPinnedItem.pinnedAt}` && (
                  <div className="absolute right-0 top-full mt-1 min-w-24 rounded-lg border border-gray-200 dark:border-[#303030] bg-white dark:bg-gray-900 shadow-lg z-20 py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenPinnedMenuId(null);
                        void handleUnpinMessage(primaryPinnedItem.messageId);
                      }}
                      className="w-full px-3 py-1.5 text-left text-xs text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      Bỏ ghim
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {showPinnedList && canExpandPinnedList && (
            <div className="mt-2 space-y-1.5">
              {hiddenPinnedItems.map((pin) => (
                <div
                  key={`${pin.messageId}-${pin.pinnedAt}`}
                  className="w-full flex items-center gap-1"
                >
                  <button
                    type="button"
                    onClick={() => handleOpenPinnedMessage(pin.messageId)}
                    className="flex-1 min-w-0 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-left text-xs text-gray-800 hover:bg-gray-50 dark:border-[#303030] dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                  >
                    {pin.thumbUrl ? (
                      <img
                        src={pin.thumbUrl}
                        alt="Ảnh ghim"
                        className="h-9 w-9 rounded object-cover shrink-0"
                      />
                    ) : (
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-blue-600 dark:text-blue-400">
                        <MessageCircle size={16} />
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                        {pin.senderName}
                      </p>
                      <p className="truncate text-xs">{pin.preview}</p>
                    </div>
                  </button>

                  <div className="relative shrink-0" data-pin-menu="true">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const key = `${pin.messageId}-${pin.pinnedAt}`;
                        setOpenPinnedMenuId((prev) =>
                          prev === key ? null : key
                        );
                      }}
                      className="h-7 w-7 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      title="Tùy chọn ghim"
                    >
                      <MoreVertical size={14} />
                    </button>

                    {openPinnedMenuId ===
                      `${pin.messageId}-${pin.pinnedAt}` && (
                      <div className="absolute right-0 top-full mt-1 min-w-24 rounded-lg border border-gray-200 dark:border-[#303030] bg-white dark:bg-gray-900 shadow-lg z-20 py-1">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenPinnedMenuId(null);
                            void handleUnpinMessage(pin.messageId);
                          }}
                          className="w-full px-3 py-1.5 text-left text-xs text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          Bỏ ghim
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="relative flex-1 min-h-0">
        {error && (
          <div className="px-4 py-2 text-xs text-red-600 dark:text-red-400 border-b border-gray-200 dark:border-gray-700">
            {error}
          </div>
        )}

        {/* Toast thu hồi: hiện 2s rồi tự biến mất */}
        {recallToast && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-gray-800 dark:bg-gray-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg pointer-events-none whitespace-nowrap">
            {recallToast}
          </div>
        )}

        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="relative h-full overflow-y-auto p-4 pb-4 flex flex-col"
          style={{ overflowAnchor: "none" }}
        >
          {/* Loading more indicator (hiện khi kéo lên load tin cũ) */}
          {loadingMore && (
            <div
              className="pointer-events-none absolute top-2 left-0 right-0 z-10 flex justify-center"
              style={{ overflowAnchor: "none" }}
            >
              <div className="inline-flex items-center rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm px-3 py-2">
                <span className="h-4 w-4 rounded-full border-2 border-gray-300 dark:border-gray-600 border-t-gray-600 dark:border-t-gray-200 animate-spin" />
              </div>
            </div>
          )}

          {messageItems}

          {/* Typing Indicator - Dummy message bubble khi có người đang gõ */}
          {typingUsers.size > 0 && (
            <div className="flex items-end gap-2 mt-3 px-1 sm:px-2">
              {/* Avatar của người đang gõ */}
              {Array.from(typingUsers).map((typingUserId) => {
                const typingMember = membersById[typingUserId];
                return (
                  <img
                    key={typingUserId}
                    src={typingMember?.avatar || defaultAvatarSmallUrl}
                    alt={typingMember?.nickname || "User"}
                    className="w-7 h-7 rounded-full object-cover"
                  />
                );
              })}
              {/* Bubble với 3 chấm nhấp nháy */}
              <div className="bg-gray-200 dark:bg-gray-700 rounded-2xl px-3 py-3 max-w-20">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} className="h-1 scroll-mb-6" />
        </div>

        {/* Nút cuộn xuống cuối (Messenger/Zalo style) */}
        {(showScrollToBottomButton ||
          (isHistoricalMode && !isNearBottom())) && (
          <button
            type="button"
            onClick={handleScrollToBottomClick}
            className="absolute bottom-4 right-4 h-11 w-11 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 z-20"
            aria-label={
              isHistoricalMode
                ? "Trở về hiện tại"
                : "Cuộn xuống tin nhắn mới nhất"
            }
            title={
              isHistoricalMode
                ? "Trở về hiện tại"
                : "Cuộn xuống tin nhắn mới nhất"
            }
          >
            <ArrowDown size={18} className="text-gray-700 dark:text-gray-200" />

            {pendingNewMessages > 0 && (
              <span className="absolute -top-1 -left-1 min-w-5 h-5 px-1 rounded-full bg-blue-500 text-white text-[10px] leading-5 text-center">
                {pendingNewMessages > 99 ? "99+" : pendingNewMessages}
              </span>
            )}
          </button>
        )}
      </div>

      {isAiPanelOpen && (
        <div className="bg-white px-4 pb-0.5 pt-1.5 dark:bg-black">
          <div className="rounded-md bg-gray-50 px-2 py-1.5 dark:bg-gray-900">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-sm bg-blue-100/80 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  <Sparkles size={12} />
                </span>
                <p className="text-[10px] font-semibold tracking-wide text-gray-700 dark:text-gray-200">
                  AI CHAT
                </p>
                <span className="hidden truncate text-[10px] text-gray-500 dark:text-gray-400 sm:inline">
                  Tóm tắt nhanh hoặc gợi ý phản hồi
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAiPanelOpen(false)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-gray-500 hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                title="Đóng AI"
              >
                <X size={13} />
              </button>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={uploading || sending || isSummarizing}
                onClick={() => {
                  void summarizeConversation(currentMessagesForAISummary);
                }}
                className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-[10px] font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-60 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
              >
                <Sparkles size={12} />
                {isSummarizing ? "Đang tóm tắt..." : "Tóm tắt"}
              </button>

              <button
                type="button"
                disabled={uploading || sending || isSuggesting}
                onClick={() => {
                  void suggestReplies();
                }}
                className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-60 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
              >
                <WandSparkles size={12} />
                {isSuggesting ? "Đang tạo gợi ý..." : "Gợi ý trả lời"}
              </button>
            </div>
          </div>

          <AIResultPanel
            summary={summary}
            suggestions={suggestions}
            error={aiError}
            isSummarizing={isSummarizing}
            isSuggesting={isSuggesting}
            onSuggestionClick={handleApplySuggestion}
          />
        </div>
      )}

      {/* Input */}
      <div className=" bg-white px-4 pb-3.5 pt-2.5 dark:border-gray-700/70 dark:bg-black">
        {/* Hidden file inputs */}
        <input
          ref={attachInputRef}
          type="file"
          accept="*/*"
          multiple
          className="hidden"
          onChange={onFileChange}
        />
        <input
          ref={gifInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={onFileChange}
        />

        {isConversationReadOnly || isPartnerAccountLocked || isDirectChatBlocked ? (
          /* Restriction notice — replaces composer entirely */
          <div className="flex flex-wrap items-center justify-center gap-2 rounded-full bg-gray-100 px-4 py-2.5 dark:bg-gray-800/60">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 h-4 w-4 text-gray-500 dark:text-gray-400"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {isPartnerAccountLocked ? (
              <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                Tài khoản đã bị khóa
              </span>
            ) : isDirectBlockedByMe ? (
              <>
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                  Bạn đã chặn người này.
                </span>
                <button
                  type="button"
                  onClick={() => void handleUnblockDirectPartner()}
                  className="rounded-full bg-gray-900 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
                >
                  Bỏ chặn
                </button>
              </>
            ) : isDirectBlockedMe ? (
              <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                Bạn không thể nhắn tin với người này.
              </span>
            ) : (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {readOnlyNotice || (
                  <>
                    Chỉ{" "}
                    <span className="font-semibold text-gray-700 dark:text-gray-200">
                      trưởng/phó nhóm
                    </span>{" "}
                    mới được gửi tin nhắn
                  </>
                )}
              </span>
            )}
          </div>
        ) : isRecording ? (

          /* Recording overlay */
          <div className="flex items-center gap-3 px-2 py-1">
            {/* Pulsing red dot */}
            <span className="shrink-0 h-3 w-3 rounded-full bg-red-500 animate-pulse" />

            {/* Duration */}
            <span className="text-sm font-mono text-red-500 w-12 shrink-0">
              {formatDuration(recordingDuration)}
            </span>

            {/* Label */}
            <span className="flex-1 text-sm text-gray-500 dark:text-gray-400 truncate">
              Đang ghi âm...
            </span>

            {/* Cancel */}
            <button
              type="button"
              onClick={cancelRecording}
              title="Huỷ"
              className="shrink-0 p-1.5 text-gray-500 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
            >
              <X size={22} />
            </button>

            {/* Stop & send */}
            <button
              type="button"
              onClick={stopRecording}
              title="Dừng và gửi"
              className="shrink-0 p-1.5 text-white bg-blue-500 hover:bg-blue-600 rounded-full"
            >
              <Square size={20} fill="currentColor" />
            </button>
          </div>
        ) : (
          <div>
            {selectedFileItems.length > 0 && (
              <div className="mb-2 flex items-center gap-2 overflow-x-auto pb-1">
                {selectedFileItems.map((item) => (
                  <div key={item.key} className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => removeSelectedFile(item.key)}
                      className="absolute -top-2 -right-2 z-10 h-5 w-5 rounded-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-500 flex items-center justify-center text-gray-600 dark:text-gray-200"
                      title="Xóa tệp"
                    >
                      <X size={12} />
                    </button>

                    {item.isImage ? (
                      <div className="relative h-16 w-16 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                        {selectedImagePreviewUrls[item.key] ? (
                          <img
                            src={selectedImagePreviewUrls[item.key]}
                            alt={item.file.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="h-full w-full block bg-gray-100 dark:bg-gray-800" />
                        )}

                        {uploading && (
                          <span className="absolute inset-x-0 bottom-0 h-1 bg-white/40 dark:bg-black/30">
                            <span
                              className="block h-full bg-blue-500 transition-all duration-150"
                              style={{
                                width: `${
                                  uploadFileProgressMap[item.key] ?? 0
                                }%`,
                              }}
                            />
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="h-16 min-w-40 max-w-44 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 px-2 py-1.5 flex items-center gap-2">
                        <span className="h-8 w-8 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center shrink-0">
                          <Paperclip size={14} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-xs text-gray-700 dark:text-gray-200">
                            {item.file.name}
                          </span>
                          {uploading && (
                            <span className="block text-[10px] text-gray-500 dark:text-gray-400">
                              {uploadFileProgressMap[item.key] ?? 0}%
                            </span>
                          )}
                          {!uploading &&
                            uploadFailedFileNames.includes(item.file.name) && (
                              <span className="block text-[10px] text-red-500">
                                Upload lỗi
                              </span>
                            )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {uploading && uploadProgressPercent !== null && (
              <div className="mb-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2 py-2">
                <div className="flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300">
                  <span>{uploadProgressLabel || "Đang tải tệp"}</span>
                  <span>{uploadProgressPercent}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all duration-150"
                    style={{
                      width: `${uploadProgressPercent}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {replyToMessage && (
              <div className="mb-2 flex items-start justify-between gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                    Trả lời {replyToMessage.senderName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {replyToMessage.content}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyToMessage(null)}
                  className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              {/* Plus / X — mở popup menu */}
              <div ref={plusMenuRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setPlusMenuOpen((v) => !v)}
                  disabled={uploading}
                  className="rounded-full p-1.5 text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-50"
                >
                  {plusMenuOpen ? <X size={21} /> : <Plus size={21} />}
                </button>

                {/* Popup menu */}
                {plusMenuOpen && (
                  <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-xl py-1.5 w-72 z-40">
                    <button
                      type="button"
                      onClick={() => {
                        setPlusMenuOpen(false);
                        void startRecording();
                      }}
                      className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <Mic
                        size={20}
                        className="text-gray-700 dark:text-gray-300 shrink-0"
                      />
                      <span className="text-sm text-gray-800 dark:text-gray-100">
                        Gửi clip âm thanh
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPlusMenuOpen(false);
                        attachInputRef.current?.click();
                      }}
                      className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <Paperclip
                        size={20}
                        className="text-gray-700 dark:text-gray-300 shrink-0"
                      />
                      <span className="text-sm text-gray-800 dark:text-gray-100">
                        Đính kèm file (tối đa 100MB)
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPlusMenuOpen(false);
                        setIsAiPanelOpen(true);
                      }}
                      className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <Sparkles
                        size={20}
                        className="text-blue-600 dark:text-blue-300 shrink-0"
                      />
                      <span className="text-sm text-gray-800 dark:text-gray-100">
                        Sử dụng AI
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPlusMenuOpen(false);
                        gifInputRef.current?.click();
                      }}
                      className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <Film
                        size={20}
                        className="text-gray-700 dark:text-gray-300 shrink-0"
                      />
                      <span className="text-sm text-gray-800 dark:text-gray-100">
                        Chọn file GIF / Ảnh / Video
                      </span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-gray-100 px-2 py-1.5 transition-colors focus-within:bg-gray-50 dark:bg-gray-900 dark:focus-within:bg-gray-800">
                {/* Input text */}
                <textarea
                  ref={messageInputRef}
                  value={messageText}
                  onChange={(e) => {
                    setMessageText(e.target.value);
                    // Gửi typing signal
                    if (e.target.value.trim()) {
                      sendTypingSignal(true);
                    } else {
                      sendTypingSignal(false);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !sending &&
                      !uploading
                    ) {
                      e.preventDefault();
                      sendTypingSignal(false); // Ngừng typing khi gửi
                      if (selectedFiles.length > 0) {
                        void handleSendMixedMedia(
                          selectedFiles.map((item) => item.file),
                          undefined,
                          replyToMessage?.id
                        ).then((ok) => {
                          if (!ok) return;
                          setSelectedFiles([]);
                          setReplyToMessage(null);
                        });
                      } else {
                        void handleSend(undefined, replyToMessage?.id).then(
                          () => setReplyToMessage(null)
                        );
                      }
                    }
                  }}
                  onBlur={() => sendTypingSignal(false)} // Ngừng typing khi blur
                  placeholder={
                    uploading ? "Đang tải file lên..." : "Nhập tin nhắn..."
                  }
                  disabled={sending || uploading}
                  rows={1}
                  className="max-h-28 min-h-[34px] min-w-0 flex-1 resize-none bg-transparent px-2.5 py-1.5 text-sm leading-5 text-gray-900 placeholder:text-gray-500 focus:outline-none dark:text-white dark:placeholder-gray-400 disabled:opacity-50"
                />

                {/* Uploading spinner */}
                {uploading && (
                  <span className="shrink-0 h-5 w-5 rounded-full border-2 border-gray-300 dark:border-gray-600 border-t-gray-700 dark:border-t-gray-200 animate-spin" />
                )}

                {/* Emoji — luôn hiện (trừ khi đang upload) */}
                {!uploading && (
                  <div ref={emojiPickerRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setEmojiPickerOpen(!emojiPickerOpen)}
                      className={`shrink-0 rounded-full p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 ${
                        emojiPickerOpen
                          ? "text-blue-500"
                          : "text-gray-800 dark:text-gray-200"
                      }`}
                    >
                      <Smile size={21} />
                    </button>

                    {/* Emoji Picker Popup */}
                    {emojiPickerOpen && (
                      <div
                        ref={emojiPickerRef}
                        className="absolute bottom-full right-0 mb-2 z-50 emoji-picker-custom"
                      >
                        <EmojiPicker
                          onEmojiClick={onEmojiClick}
                          theme={
                            document.documentElement.classList.contains("dark")
                              ? Theme.DARK
                              : Theme.LIGHT
                          }
                          width={350}
                          height={435}
                          searchPlaceholder="Tìm kiếm biểu tượng cảm xúc"
                          previewConfig={{
                            showPreview: false,
                          }}
                          emojiStyle={EmojiStyle.FACEBOOK}
                          skinTonesDisabled
                          lazyLoadEmojis
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Thumbs up khi trống, Send khi có text */}
              {!uploading &&
                (messageText.trim() || selectedFiles.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedFiles.length > 0) {
                        void handleSendMixedMedia(
                          selectedFiles.map((item) => item.file),
                          undefined,
                          replyToMessage?.id
                        ).then((ok) => {
                          if (!ok) return;
                          setSelectedFiles([]);
                          setReplyToMessage(null);
                        });
                        return;
                      }

                      void handleSend(undefined, replyToMessage?.id).then(() =>
                        setReplyToMessage(null)
                      );
                    }}
                    disabled={sending}
                    className="shrink-0 rounded-full p-1.5 text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 disabled:opacity-50"
                  >
                    <Send size={22} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      void handleSend("👍", replyToMessage?.id).then(() =>
                        setReplyToMessage(null)
                      )
                    }
                    disabled={sending}
                    className="shrink-0 rounded-full p-0.5 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                  >
                    <Emoji
                      unified="1f44d"
                      size={28}
                      emojiStyle={EmojiStyle.APPLE}
                    />
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      {forwardSourceMessage && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/45 px-4 py-6">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-700">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-gray-950 dark:text-white">
                  Chuyen tiep tin nhan
                </h3>
                <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                  {getMessagePreviewText(forwardSourceMessage)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeForwardModal}
                className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[55vh] overflow-y-auto px-2 py-2">
              {forwardLoading ? (
                <div className="flex h-36 items-center justify-center">
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800 dark:border-gray-700 dark:border-t-white" />
                </div>
              ) : forwardConversations.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-gray-500">
                  Khong co hoi thoai phu hop
                </p>
              ) : (
                forwardConversations.map((item) => {
                  const selected = forwardSelectedIds.has(item.id);
                  const displayInfo = buildConversationDisplayInfo({
                    conversation: item,
                    currentUserId: userId,
                  });
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleForwardTarget(item.id)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <img
                        src={displayInfo.avatarUrl || defaultAvatarSmallUrl}
                        alt={displayInfo.name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {displayInfo.name}
                        </span>
                      </span>
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                          selected
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        {selected ? <CheckCircle2 size={14} /> : null}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {forwardError && (
              <p className="border-t border-gray-100 px-4 py-2 text-sm text-red-500 dark:border-gray-800">
                {forwardError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
              <button
                type="button"
                onClick={closeForwardModal}
                disabled={forwardSubmitting}
                className="rounded-md px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Huy
              </button>
              <button
                type="button"
                onClick={() => void submitForwardMessage()}
                disabled={forwardSelectedIds.size === 0 || forwardSubmitting}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {forwardSubmitting ? "Dang gui..." : "Chuyen tiep"}
              </button>
            </div>
          </div>
        </div>
      )}

      {callPickerOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  {callPickerMode === "invite"
                    ? "Mời thêm người"
                    : "Chọn người để gọi"}
                </h3>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  Đã chọn {selectedCallMemberIds.size}/{callPickerLimit}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCallPickerOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                title="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[55vh] overflow-y-auto px-2 py-2">
              {callPickerMembers.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  Không còn thành viên phù hợp để gọi.
                </div>
              ) : (
                callPickerMembers.map((member) => {
                  const checked = selectedCallMemberIds.has(member.userId);
                  const disabled = !checked && selectedCallMemberIds.size >= callPickerLimit;
                  return (
                    <button
                      key={member.userId}
                      type="button"
                      onClick={() => toggleCallMember(member.userId)}
                      disabled={disabled}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                        checked
                          ? "bg-blue-50 dark:bg-blue-950/35"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800"
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      <img
                        src={member.avatar || "https://cdn-icons-png.flaticon.com/512/149/149071.png"}
                        alt={member.nickname || member.username || "Thành viên"}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                          {member.nickname || member.username || "Thành viên"}
                        </p>
                        {member.username && (
                          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                            @{member.username}
                          </p>
                        )}
                      </div>
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                          checked
                            ? "border-blue-600 bg-blue-600"
                            : "border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        {checked && <CheckCircle2 size={14} className="text-white" />}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setCallPickerOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void submitCallPicker()}
                disabled={selectedCallMemberIds.size === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {callPickerMode === "invite" ? <UserPlus size={16} /> : callPickerType === "video" ? <Video size={16} /> : <Phone size={16} />}
                {callPickerMode === "invite" ? "Mời" : "Gọi"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <IncomingCallModal
        open={Boolean(incomingCall)}
        callerName={
          (incomingCall?.fromUserId
            ? membersById[incomingCall.fromUserId]?.nickname
            : undefined) || `Người dùng ${incomingCall?.fromUserId ?? ""}`
        }
        callType={incomingCall?.callType || "audio"}
        onAccept={() => void acceptIncomingCall()}
        onReject={rejectIncomingCall}
      />

      <AIConsentModal
        open={consentModalOpen}
        loading={consentLoading}
        error={aiError}
        onAccept={() => {
          void acceptAIConsent();
        }}
        onDecline={declineAIConsent}
      />

      <CallScreen
        open={Boolean(activeCall)}
        callType={activeCall?.callType || "audio"}
        remoteName={
          activeCall?.remoteName || otherMember?.nickname || "Người dùng"
        }
        remoteAvatar={activeCall?.remoteAvatar || otherMember?.avatar}
        status={activeCall?.status || "calling"}
        durationText={callDurationText}
        localStream={localStream}
        localUserId={userId}
        remoteStream={remoteStream}
        remoteStreams={remoteStreams}
        participants={callParticipants}
        micEnabled={micEnabled}
        cameraEnabled={cameraEnabled}
        isScreenSharing={isScreenSharing}
        canToggleCamera={canToggleCamera}
        canShareScreen={canShareScreen}
        onInviteParticipants={
          isGroupConversation && hasInviteCallCandidates
            ? openInviteCallPicker
            : undefined
        }
        onToggleMic={toggleMic}
        onToggleCamera={toggleCamera}
        onToggleScreenShare={() => void toggleScreenShare()}
        onEndCall={() => void endCall()}
      />
    </div>
      <MediaViewer
        open={mediaViewerIndex !== null}
        images={mediaViewerImages.length > 0 ? mediaViewerImages : conversationImages}
        currentIndex={mediaViewerIndex ?? 0}
        onClose={closeMediaViewer}
        onIndexChange={setMediaViewerIndex}
        onForward={forwardViewerImage}
        hasMore={mediaViewerHasMore}
        loadingMore={mediaViewerLoadingMore}
        onLoadMore={() => void loadMoreViewerImages()}
      />
      {searchOpen && (
        <ConversationSearchPanel
          members={Object.values(membersById)}
          currentUserId={userId}
          fallbackAvatarUrl={defaultAvatarSmallUrl}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
    </ConversationSearchProvider>
  );
}

export default function ChatWindow(props: ChatWindowProps) {
  return <ChatWindowContent {...props} />;
}
