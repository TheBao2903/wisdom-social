import { useRef, useState } from "react";
import { Smile, Loader2, Send } from "lucide-react";
import { type EmojiClickData, Theme } from "emoji-picker-react";
import IconModal from "../../icon-modal/IconModal";
import useMentions from "../../../hooks/useMentions";
import { getAvatarUrl } from "../../../utils/s3";


interface PostCardCommentInputProps {
  currentUserAvatarUrl: string;
  commentInput: string;
  submittingComment: boolean;
  onChangeCommentInput: (value: string) => void;
  onSubmitComment: (mentions?: any[]) => void;
  currentUserId?: string;
}

export default function PostCardCommentInput({
  currentUserAvatarUrl,
  commentInput,
  submittingComment,
  onChangeCommentInput,
  onSubmitComment,
  currentUserId,
}: PostCardCommentInputProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  const emojiButtonRef = useRef<HTMLButtonElement | null>(null);
  const commentInputRef = useRef<HTMLInputElement | null>(null);

  // ============ MENTIONS HOOK ============
  const {
    mentionUsers,
    showMentionDropdown,
    handleTextChange: handleMentionChange,
    selectUser,
    getFinalMentions,
    mentionLoading,
    loadMoreMentions,
  } = useMentions(currentUserId || "");

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const selectionPos = commentInputRef.current?.selectionStart;
    const safeCursorPos = Math.min(
      Math.max(selectionPos ?? cursorPos, 0),
      commentInput.length
    );
    const nextValue =
      commentInput.slice(0, safeCursorPos) +
      emojiData.emoji +
      commentInput.slice(safeCursorPos);
    const nextCursorPos = safeCursorPos + emojiData.emoji.length;

    onChangeCommentInput(nextValue);
    setCursorPos(nextCursorPos);
    setShowEmojiPicker(false);

    requestAnimationFrame(() => {
      if (commentInputRef.current) {
        commentInputRef.current.focus();
        commentInputRef.current.setSelectionRange(nextCursorPos, nextCursorPos);
      }
    });
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const selectionStart = e.target.selectionStart || 0;
    onChangeCommentInput(value);
    setCursorPos(selectionStart);
    handleMentionChange(value, selectionStart);
  };

  const handleSubmit = () => {
    const finalMentions = getFinalMentions(commentInput);
    onSubmitComment(finalMentions);
  };

  return (
    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-800 flex gap-2 items-center">
      <img
        src={currentUserAvatarUrl}
        alt="Your avatar"
        className="w-8 h-8 rounded-full shrink-0"
      />
      <div className="flex flex-1 gap-2">
        <div className="relative">
          <button
            ref={emojiButtonRef}
            type="button"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-[#363636]"
            title="Insert emoji"
            aria-label="Insert emoji"
          >
            <Smile size={20} className="text-gray-500 dark:text-gray-400" />
          </button>

          <IconModal
            open={showEmojiPicker}
            onClose={() => setShowEmojiPicker(false)}
            onEmojiClick={handleEmojiClick}
            theme={
              document.documentElement.classList.contains("dark")
                ? Theme.DARK
                : Theme.LIGHT
            }
            anchorRef={emojiButtonRef}
            containerClassName="absolute bottom-full left-0 mb-2 z-50"
            pickerProps={{
              width: 300,
              height: 350,
            }}
          />
        </div>

        <div className="relative flex-1">
          <input
            ref={commentInputRef}
            type="text"
            value={commentInput}
            onChange={handleTextChange}
            onClick={(e) => {
              const start = e.currentTarget.selectionStart || 0;
              setCursorPos(start);
              handleMentionChange(commentInput, start);
            }}
            onKeyUp={(e) => {
              const start = e.currentTarget.selectionStart || 0;
              setCursorPos(start);
              handleMentionChange(commentInput, start);
            }}
            onSelect={(e) => {
              const start = e.currentTarget.selectionStart || commentInput.length;
              setCursorPos(start);
              handleMentionChange(commentInput, start);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Write a comment..."
            className="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-full outline-none focus:border-blue-500 dark:text-white"
            disabled={submittingComment}
          />

          {/* Mention Dropdown */}
          {showMentionDropdown && mentionUsers.length > 0 && (
            <div 
              className="absolute bottom-full left-0 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border dark:border-gray-700 mb-2 overflow-hidden z-50 flex flex-col max-h-64"
              onScroll={(e) => {
                const target = e.currentTarget;
                if (target.scrollHeight - target.scrollTop <= target.clientHeight + 10) {
                  loadMoreMentions();
                }
              }}
            >
              <div className="px-4 py-2 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  Gợi ý bạn bè
                </span>
              </div>
              
              <div className="overflow-y-auto flex-1">
                {mentionUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => {
                      const { newValue, newCursorPos } = selectUser(commentInput, user);
                      onChangeCommentInput(newValue);
                      setCursorPos(newCursorPos);
                      setTimeout(() => {
                        if (commentInputRef.current) {
                          commentInputRef.current.focus();
                          commentInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
                        }
                      }, 0);
                    }}
                    className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-left transition-colors border-b last:border-none dark:border-gray-700 group"
                  >
                    <div className="relative">
                      <img
                        src={getAvatarUrl(user.avatarUrl) || "https://i.pravatar.cc/150?img=5"}
                        alt={user.username}
                        className="w-9 h-9 rounded-full object-cover border dark:border-gray-700 group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold dark:text-white truncate group-hover:text-blue-500">
                        {user.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        @{user.username}
                      </p>
                    </div>
                  </button>
                ))}
                
                {mentionLoading && (
                  <div className="p-3 flex justify-center border-t dark:border-gray-700">
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!commentInput.trim() || submittingComment}
          className="text-blue-500 hover:text-blue-600 disabled:opacity-35 disabled:cursor-not-allowed transition-colors p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/30 flex items-center justify-center"
          title="Gửi bình luận"
          aria-label="Gửi bình luận"
        >
          {submittingComment ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </div>
    </div>
  );
}
