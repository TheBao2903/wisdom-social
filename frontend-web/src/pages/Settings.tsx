import { useEffect, useState } from "react";
import {
  Settings as SettingsIcon,
  Shield,
  Bell,
  Lock,
  HelpCircle,
  Info,
  LogOut,
  KeyRound,
  Trash2,
  ShieldCheck,
  AlertTriangle,

} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { logout, logoutAllDevices } from "../utils/auth";
import securityService, { computeDeletionStatus } from "../services/securityService";
import userService from "../services/userService";
import PinInputModal from "../components/security/PinInputModal";
import ConfirmModal from "../components/security/ConfirmModal";
import ChangePasswordModal from "../components/security/ChangePasswordModal";

type ModalKind =
  | "logoutAll"
  | "requestDeletion"
  | "cancelDeletion"
  | "setupPin"
  | "removePin"
  | "changePassword"
  | null;

interface SettingRow {
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  title: string;
  titleColor?: string;
  description: string;
  actionLabel: string;
  actionColor?: string;
  onClick: () => void;
}

export default function SettingsPage() {
  const navigate = useNavigate();

  const [modal, setModal] = useState<ModalKind>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [deletionPending, setDeletionPending] = useState(false);
  const [deletionRemainingDays, setDeletionRemainingDays] = useState(0);
  const [hasPinCode, setHasPinCode] = useState(false);
  const [userPhone, setUserPhone] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me: any = await userService.getCurrentUser();
        if (cancelled || !me) return;
        const { pending, remainingDays } = computeDeletionStatus(me);
        setDeletionPending(pending);
        setDeletionRemainingDays(remainingDays);
        setHasPinCode(!!me.hasPinCode);
        setUserPhone(me.phone ?? "");
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const closeModal = () => {
    if (actionLoading) return;
    setModal(null);
    setActionError(null);
  };

  const openModal = (kind: ModalKind) => {
    setActionError(null);
    setSuccessMsg(null);
    setModal(kind);
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  const handleLogoutAllDevices = async () => {
    setActionLoading(true);
    setActionError(null);
    const result = await logoutAllDevices();
    setActionLoading(false);
    if (result.success) {
      window.location.href = "/login";
    } else {
      setActionError(result.message || "Không thể đăng xuất tất cả thiết bị.");
    }
  };

  const handleRequestDeletion = async (pinCode?: string) => {
    setActionLoading(true);
    setActionError(null);
    const result = await securityService.requestAccountDeletion(pinCode);
    setActionLoading(false);
    if (result.success) {
      setDeletionPending(true);
      setDeletionRemainingDays(result.remainingDays ?? 15);
      setModal(null);
      setSuccessMsg(
        `Tài khoản sẽ bị xóa sau ${result.remainingDays ?? 15} ngày. Bạn có thể hủy yêu cầu bất cứ lúc nào.`,
      );
    } else {
      setActionError(
        result.message ||
          (pinCode ? "Mã PIN không chính xác." : "Không thể yêu cầu xóa tài khoản."),
      );
    }
  };

  const handleCancelDeletion = async (pinCode?: string) => {
    setActionLoading(true);
    setActionError(null);
    const result = await securityService.cancelAccountDeletion(pinCode);
    setActionLoading(false);
    if (result.success) {
      setDeletionPending(false);
      setDeletionRemainingDays(0);
      setModal(null);
      setSuccessMsg(result.message || "Đã hủy yêu cầu xóa tài khoản.");
    } else {
      setActionError(
        result.message ||
          (pinCode ? "Mã PIN không chính xác." : "Không thể hủy yêu cầu xóa tài khoản."),
      );
    }
  };

  const handleSetupPin = async (pinCode: string) => {
    setActionLoading(true);
    setActionError(null);
    const result = await securityService.setupPinCode(pinCode);
    setActionLoading(false);
    if (result.success) {
      setHasPinCode(true);
      setModal(null);
      setSuccessMsg("Cài đặt mã PIN 2 lớp thành công.");
    } else {
      setActionError(result.message || "Không thể cài đặt mã PIN.");
    }
  };

  const handleRemovePin = async (pinCode: string) => {
    setActionLoading(true);
    setActionError(null);
    const result = await securityService.removePinCode(pinCode);
    setActionLoading(false);
    if (result.success) {
      setHasPinCode(false);
      setModal(null);
      setSuccessMsg("Đã tắt bảo mật 2 lớp.");
    } else {
      setActionError(result.message || "Mã PIN không chính xác.");
    }
  };

  const pinRow: SettingRow = hasPinCode
    ? {
        icon: KeyRound,
        iconColor: "text-red-500",
        iconBg: "bg-red-100 dark:bg-red-900/30",
        title: "Mật khẩu 2 lớp",
        description: "Đang bật - Bảo vệ tài khoản bằng mã PIN 6 chữ số",
        actionLabel: "Tắt",
        actionColor: "text-red-500 hover:text-red-600",
        onClick: () => openModal("removePin"),
      }
    : {
        icon: KeyRound,
        iconColor: "text-blue-500",
        iconBg: "bg-blue-100 dark:bg-blue-900/30",
        title: "Mật khẩu 2 lớp",
        description: "Bảo vệ tài khoản bằng mã PIN 6 chữ số",
        actionLabel: "Cài đặt",
        onClick: () => openModal("setupPin"),
      };

  const deletionRow: SettingRow = deletionPending
    ? {
        icon: ShieldCheck,
        iconColor: "text-green-600",
        iconBg: "bg-green-100 dark:bg-green-900/30",
        title: "Hủy xóa tài khoản",
        titleColor: "text-green-600 dark:text-green-400",
        description: `Tài khoản sẽ bị xóa sau ${deletionRemainingDays} ngày`,
        actionLabel: "Hủy xóa",
        actionColor: "text-green-600 hover:text-green-700",
        onClick: () => openModal("cancelDeletion"),
      }
    : {
        icon: Trash2,
        iconColor: "text-red-500",
        iconBg: "bg-red-100 dark:bg-red-900/30",
        title: "Xóa tài khoản",
        titleColor: "text-red-500 dark:text-red-400",
        description: "Tài khoản sẽ bị xóa vĩnh viễn sau 15 ngày",
        actionLabel: "Yêu cầu xóa",
        actionColor: "text-red-500 hover:text-red-600",
        onClick: () => openModal("requestDeletion"),
      };

  const settingsRows: SettingRow[] = [
    {
      icon: SettingsIcon,
      iconColor: "text-gray-700 dark:text-gray-300",
      iconBg: "bg-gray-100 dark:bg-[#262626]",
      title: "Chỉnh sửa hồ sơ",
      description: "Tên, tiểu sử, ảnh đại diện",
      actionLabel: "Chỉnh sửa",
      onClick: () => navigate("/edit-profile"),
    },
    {
      icon: Shield,
      iconColor: "text-gray-700 dark:text-gray-300",
      iconBg: "bg-gray-100 dark:bg-[#262626]",
      title: "Quyền riêng tư & Bảo mật",
      description: "Tài khoản đã chặn",
      actionLabel: "Quản lý",
      onClick: () => navigate("/blocked-users"),
    },
    {
      icon: Bell,
      iconColor: "text-gray-700 dark:text-gray-300",
      iconBg: "bg-gray-100 dark:bg-[#262626]",
      title: "Thông báo",
      description: "Thông báo đẩy, email, SMS",
      actionLabel: "Cài đặt",
      onClick: () => {},
    },
    {
      icon: Lock,
      iconColor: "text-gray-700 dark:text-gray-300",
      iconBg: "bg-gray-100 dark:bg-[#262626]",
      title: "Mật khẩu",
      description: "Thay đổi mật khẩu của bạn",
      actionLabel: "Cập nhật",
      onClick: () => openModal("changePassword"),
    },
    pinRow,
    {
      icon: LogOut,
      iconColor: "text-orange-500",
      iconBg: "bg-orange-100 dark:bg-orange-900/30",
      title: "Đăng xuất khỏi tất cả thiết bị",
      description: "Hủy phiên đăng nhập trên các thiết bị khác",
      actionLabel: "Đăng xuất",
      onClick: () => openModal("logoutAll"),
    },
    deletionRow,
    {
      icon: HelpCircle,
      iconColor: "text-gray-700 dark:text-gray-300",
      iconBg: "bg-gray-100 dark:bg-[#262626]",
      title: "Trợ giúp",
      description: "Hỗ trợ và câu hỏi thường gặp",
      actionLabel: "Xem",
      onClick: () => {},
    },
    {
      icon: Info,
      iconColor: "text-gray-700 dark:text-gray-300",
      iconBg: "bg-gray-100 dark:bg-[#262626]",
      title: "Giới thiệu",
      description: "Phiên bản ứng dụng và điều khoản",
      actionLabel: "Xem",
      onClick: () => {},
    },
  ];

  return (
    <div className="max-w-[600px] mx-auto px-4 sm:px-6 md:px-8 py-6">
      <div className="bg-white dark:bg-[#000]">
        <div className="pb-8">
          <h1 className="text-2xl font-bold mb-2 dark:text-white p-4">Cài đặt</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm px-4">
            Quản lý cài đặt tài khoản và tùy chọn của bạn
          </p>
        </div>

        {/* Banner: xóa tài khoản đang chờ */}
        {deletionPending && (
          <div className="mb-4 mx-4 rounded-lg border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle
                size={22}
                className="text-orange-600 dark:text-orange-400 shrink-0 mt-0.5"
              />
              <div className="flex-1">
                <p className="text-sm font-semibold text-orange-900 dark:text-orange-200">
                  Tài khoản sẽ bị xóa sau {deletionRemainingDays} ngày
                </p>
                <p className="text-xs text-orange-800 dark:text-orange-300 mt-1">
                  Dữ liệu sẽ bị xóa vĩnh viễn khi hết thời gian. Nhấn "Hủy xóa" trong danh sách
                  bên dưới để giữ lại tài khoản.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Banner thành công */}
        {successMsg && (
          <div className="mb-4 mx-4 rounded-lg border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 p-3 flex items-start justify-between gap-2">
            <p className="text-sm text-green-800 dark:text-green-200">{successMsg}</p>
            <button
              onClick={() => setSuccessMsg(null)}
              className="text-sm text-green-700 dark:text-green-300 hover:underline shrink-0"
            >
              Đóng
            </button>
          </div>
        )}

        {/* Danh sách cài đặt */}
        <div className="space-y-1">
          {settingsRows.map((row, index) => {
            const Icon = row.icon;
            return (
              <div
                key={index}
                onClick={row.onClick}
                className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-[#1a1a1a] rounded-lg transition-colors cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-[#262626]"
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className={`p-2 rounded-full shrink-0 ${row.iconBg}`}>
                    <Icon size={20} className={row.iconColor} />
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-semibold ${
                        row.titleColor ?? "dark:text-white"
                      }`}
                    >
                      {row.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {row.description}
                    </p>
                  </div>
                </div>
                <button
                  className={`text-sm font-semibold shrink-0 ml-2 ${
                    row.actionColor ?? "text-[#0095f6] hover:text-[#00376b] dark:hover:text-[#0095f6]"
                  }`}
                >
                  {row.actionLabel}
                </button>
              </div>
            );
          })}
        </div>

        {/* Nút đăng xuất duy nhất ở cuối */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-[#262626]">
          <button
            onClick={handleLogout}
            className="w-full py-3 px-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg font-semibold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          >
            Đăng xuất
          </button>
        </div>
      </div>

      {/* Modal: Đăng xuất tất cả thiết bị */}
      <ConfirmModal
        open={modal === "logoutAll"}
        title="Đăng xuất khỏi tất cả thiết bị?"
        description="Bạn sẽ bị đăng xuất khỏi tất cả các thiết bị, bao gồm cả thiết bị này. Bạn cần đăng nhập lại để tiếp tục sử dụng."
        confirmLabel="Đăng xuất tất cả"
        loading={actionLoading}
        error={actionError}
        onConfirm={handleLogoutAllDevices}
        onClose={closeModal}
      />

      {/* Modal: Yêu cầu xóa tài khoản */}
      {hasPinCode ? (
        <PinInputModal
          open={modal === "requestDeletion"}
          title="Xác nhận mã PIN"
          description="Nhập mã PIN 2 lớp để xác nhận yêu cầu xóa tài khoản. Tài khoản sẽ bị xóa vĩnh viễn sau 15 ngày."
          icon={AlertTriangle}
          iconColor="text-red-600 dark:text-red-400"
          iconBgColor="bg-red-100 dark:bg-red-900/30"
          confirmLabel="Xác nhận xóa"
          confirmBgColor="bg-red-600"
          confirmHoverColor="hover:bg-red-700"
          loading={actionLoading}
          error={actionError}
          onConfirm={handleRequestDeletion}
          onClose={closeModal}
        />
      ) : (
        <ConfirmModal
          open={modal === "requestDeletion"}
          title="Xóa tài khoản sau 15 ngày?"
          description="Tài khoản và toàn bộ dữ liệu (bài viết, tin nhắn, bạn bè) sẽ bị xóa vĩnh viễn sau 15 ngày. Bạn có thể đăng nhập lại trong thời gian này để hủy yêu cầu xóa."
          confirmLabel="Yêu cầu xóa"
          loading={actionLoading}
          error={actionError}
          onConfirm={() => handleRequestDeletion()}
          onClose={closeModal}
        />
      )}

      {/* Modal: Hủy xóa tài khoản */}
      {hasPinCode ? (
        <PinInputModal
          open={modal === "cancelDeletion"}
          title="Xác nhận hủy xóa"
          description="Nhập mã PIN 2 lớp để xác nhận hủy yêu cầu xóa tài khoản."
          icon={ShieldCheck}
          iconColor="text-green-600 dark:text-green-400"
          iconBgColor="bg-green-100 dark:bg-green-900/30"
          confirmLabel="Hủy xóa tài khoản"
          confirmBgColor="bg-green-600"
          confirmHoverColor="hover:bg-green-700"
          loading={actionLoading}
          error={actionError}
          onConfirm={handleCancelDeletion}
          onClose={closeModal}
        />
      ) : (
        <ConfirmModal
          open={modal === "cancelDeletion"}
          title="Hủy yêu cầu xóa tài khoản?"
          description="Tài khoản của bạn sẽ không bị xóa nữa. Bạn có thể yêu cầu xóa lại bất cứ lúc nào."
          confirmLabel="Hủy xóa tài khoản"
          confirmBgColor="bg-green-600"
          confirmHoverColor="hover:bg-green-700"
          loading={actionLoading}
          error={actionError}
          onConfirm={() => handleCancelDeletion()}
          onClose={closeModal}
        />
      )}

      {/* Modal: Thiết lập mã PIN */}
      <PinInputModal
        open={modal === "setupPin"}
        title="Thiết lập mã PIN"
        description="Nhập mã PIN 6 chữ số để bảo vệ tài khoản. Bạn sẽ cần mã này khi xóa hoặc khôi phục tài khoản."
        icon={KeyRound}
        iconColor="text-blue-500"
        iconBgColor="bg-blue-100 dark:bg-blue-900/30"
        confirmLabel="Cài đặt"
        confirmBgColor="bg-blue-500"
        confirmHoverColor="hover:bg-blue-600"
        loading={actionLoading}
        error={actionError}
        onConfirm={handleSetupPin}
        onClose={closeModal}
      />

      {/* Modal: Xóa mã PIN */}
      <PinInputModal
        open={modal === "removePin"}
        title="Tắt bảo mật 2 lớp"
        description="Nhập mã PIN hiện tại để xác nhận tắt bảo mật 2 lớp."
        icon={KeyRound}
        iconColor="text-red-600 dark:text-red-400"
        iconBgColor="bg-red-100 dark:bg-red-900/30"
        confirmLabel="Tắt bảo mật"
        confirmBgColor="bg-red-600"
        confirmHoverColor="hover:bg-red-700"
        loading={actionLoading}
        error={actionError}
        onConfirm={handleRemovePin}
        onClose={closeModal}
      />

      {/* Modal: Đổi mật khẩu (OTP về SĐT của chính mình) */}
      <ChangePasswordModal
        open={modal === "changePassword"}
        phone={userPhone}
        hasPinCode={hasPinCode}
        onClose={() => setModal(null)}
        onSuccess={async () => {
          // Đổi mật khẩu xong -> đăng xuất tất cả thiết bị (web + mobile).
          // Phiên hiện tại vẫn còn token hợp lệ để gọi logout-all; các thiết bị
          // khác sẽ bị đẩy ra ở request/refresh kế tiếp.
          setModal(null);
          try {
            await logoutAllDevices();
          } catch {
            /* vẫn đăng xuất thiết bị này */
          }
          window.location.href = "/login";
        }}
      />
    </div>
  );
}
