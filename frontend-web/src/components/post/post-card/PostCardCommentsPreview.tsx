import type React from "react";
import CommentItemNormalized from "../post-comment/CommentItemNormalized";

interface PostCardCommentsPreviewProps {
  rootIds: string[];
  commentsCount: number;
  showFullCommentsPreview: boolean;
  recentCommentIds: string[];
  commentsById: any;
  expandedMap: any;
  loadingMap: any;
  postId: string;
  getDirectChildren: (commentId: string) => any[];
  onNavigateToPost: () => void;
  onNavigateToPostWithExpand: (commentId: string) => void;
  onCreateReply: () => void;
  allowComments?: boolean;
}

export default function PostCardCommentsPreview({
  rootIds,
  commentsCount,
  showFullCommentsPreview,
  recentCommentIds,
  commentsById,
  expandedMap,
  loadingMap,
  postId,
  getDirectChildren,
  onNavigateToPost,
  onNavigateToPostWithExpand,
  onCreateReply,
  allowComments,
}: PostCardCommentsPreviewProps) {
  const visibleCommentIds = showFullCommentsPreview
    ? Array.from(
        new Set([
          ...recentCommentIds,
          ...rootIds.filter((id) => !recentCommentIds.includes(id)).slice(0, 1),
        ])
      )
    : rootIds.slice(0, 1);

  return (
    <div className="mt-3 space-y-2">
      {rootIds.length > 1 && (
        <button
          onClick={onNavigateToPost}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-400 dark:hover:text-gray-300 font-semibold ml-4"
        >
          View all {commentsCount} comments
        </button>
      )}

      {visibleCommentIds.map((commentId) => (
        <CommentItemNormalized
          key={commentId}
          commentId={commentId}
          commentsById={commentsById}
          expandedMap={expandedMap}
          onToggleExpanded={(cId: string) => onNavigateToPostWithExpand(cId)}
          onLoadMore={(cId: string) => onNavigateToPostWithExpand(cId)}
          onReplyClick={(cId: string, e: React.MouseEvent) => {
            e.stopPropagation();
            onNavigateToPostWithExpand(cId);
          }}
          onDelete={onNavigateToPost}
          onCreateReply={onCreateReply}
          getDirectChildren={(cId) => getDirectChildren(cId).slice(0, 1)}
          hasMoreReplies={{}}
          loadingMap={loadingMap}
          postId={postId}
          level={0}
          allowComments={allowComments}
        />
      ))}
    </div>
  );
}
