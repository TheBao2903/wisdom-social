import { Link, useNavigate, useLocation } from "react-router-dom";
import type { Notification } from "../../types";
import { buildS3Url } from "../../utils/s3";

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead?: () => void;
}

export default function NotificationItem({
  notification,
  onMarkAsRead,
}: NotificationItemProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const primaryActorId =
    notification.actorIds && notification.actorIds.length > 0
      ? notification.actorIds[0]
      : "";
  const avatarUrl = notification.metadata?.imageUrl || "/default-avatar.png";
  // Page-centric outcomes already read as full sentences ("Bài viết của bạn đã được duyệt"),
  // so we only prefix the actor's name on actor-centric notifications.
  const hideActorName =
    notification.type === "PAGE_JOIN_APPROVED" ||
    notification.type === "PAGE_POST_APPROVED" ||
    notification.type === "PAGE_MEMBER_ADDED";
  const actorName = hideActorName
    ? undefined
    : notification.metadata?.actorName;

  const handleItemClick = () => {
    // 1. Mark as read
    if (!notification.isRead && onMarkAsRead) {
      onMarkAsRead();
    }

    // 2. Navigate
    const deepLink = notification.metadata?.deepLink;
    if (deepLink) {
      // Page notifications -> open the page detail
      if (deepLink.startsWith("/pages/") || deepLink.startsWith("/profile/")) {
        navigate(deepLink);
        return;
      }

      const postId = deepLink.split("/").pop();

      // Parse extraData for commentId
      let expandCommentId = undefined;
      if (notification.metadata?.extraData) {
        try {
          const extra = JSON.parse(notification.metadata.extraData);
          expandCommentId = extra.commentId;
        } catch (e) {
          console.warn("Failed to parse extraData", e);
        }
      }

      if (expandCommentId) {
        // Comment notification -> Open Modal
        navigate(deepLink, {
          state: {
            backgroundLocation: location,
            expandCommentId: expandCommentId,
          },
        });
      } else {
        // Post notification -> Go to Feed and boost post
        navigate("/", {
          state: {
            boostPostId: postId,
          },
        });
      }
    } else if (
      notification.type === "FRIEND_REQUEST" ||
      notification.type === "FRIEND_ACCEPT"
    ) {
      // Fallback for friend notifications if deepLink is missing
      navigate(`/profile/${primaryActorId}`);
    } else if (notification.targetType === "PAGE" && notification.targetId) {
      // Fallback for page notifications if deepLink is missing
      navigate(`/pages/${notification.targetId}`);
    }
  };

  return (
    <div
      onClick={handleItemClick}
      className={`flex items-center gap-3 px-4 py-3 cursor-pointer rounded-lg transition-colors ${
        !notification.isRead
          ? "bg-blue-50/50 dark:bg-blue-900/20 hover:bg-blue-50 dark:hover:bg-blue-900/30"
          : "hover:bg-gray-50 dark:hover:bg-[#262626]"
      }`}
    >
      <Link
        to={`/profile/${primaryActorId}`}
        className="flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={
            (avatarUrl.startsWith("http")
              ? avatarUrl
              : buildS3Url(avatarUrl)) || undefined
          }
          alt="Avatar"
          className="w-11 h-11 rounded-full object-cover"
        />
      </Link>

      <div className="flex-1 min-w-0">
        <p className="text-[14px] leading-[18px]">
          <span className="text-gray-900 dark:text-white">
            {actorName && <span className="font-semibold">{actorName} </span>}
            {notification.content || getNotificationText(notification.type)}
          </span>
          <br />
          <span
            className={`text-xs ${
              !notification.isRead
                ? "text-blue-600 font-medium"
                : "text-gray-500"
            }`}
          >
            {formatDate(notification.createdAt)}
          </span>
        </p>
      </div>

      {!notification.isRead && (
        <div className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0"></div>
      )}
    </div>
  );
}

function getNotificationText(type: string): string {
  switch (type) {
    case "REACTION_POST":
      return "Đã thích bài viết của bạn";
    case "COMMENT_POST":
      return "Đã bình luận bài viết của bạn";
    case "SHARE_POST":
      return "Đã chia sẻ bài viết của bạn";
    case "FRIEND_REQUEST":
      return "Đã gửi lời mời kết bạn";
    case "FRIEND_ACCEPT":
      return "Đã chấp nhận lời mời kết bạn";
    case "PAGE_JOIN_REQUEST":
      return "Đã yêu cầu tham gia trang của bạn";
    case "PAGE_POST_SUBMITTED":
      return "Đã đăng một bài viết chờ duyệt";
    case "PAGE_LIKE":
      return "Đã thích trang của bạn";
    case "PAGE_FOLLOW":
      return "Đã theo dõi trang của bạn";
    case "PAGE_JOIN_APPROVED":
      return "Yêu cầu tham gia trang của bạn đã được chấp nhận";
    case "PAGE_POST_APPROVED":
      return "Bài viết của bạn đã được duyệt";
    case "PAGE_MEMBER_ADDED":
      return "Bạn đã được thêm vào trang";
    case "REPORT_REVIEWED":
      return "Báo cáo của bạn đã được xem xét";
    default:
      return "Có thông báo mới";
  }
}

function formatDate(isoString: string): string {
  try {
    if (!isoString) return "Gần đây";
    const date = new Date(isoString);
    return (
      date.toLocaleDateString() +
      " " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  } catch {
    return "Gần đây";
  }
}
