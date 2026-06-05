import { useEffect, useRef, useState } from "react";
import { AlertTriangle, KeyRound } from "lucide-react";
import toast from "react-hot-toast";
import { logout } from "../../utils/auth";
import userService from "../../services/userService";
import securityService, { computeDeletionStatus } from "../../services/securityService";
import PinInputModal from "./PinInputModal";

/**
 * Hiển thị cảnh báo "tài khoản đang chờ xóa" ngay khi vào app (giống mobile).
 * Nếu tài khoản có mã PIN 2 lớp, bấm "Hủy xóa" sẽ mở modal nhập PIN để xác nhận.
 */
export default function DeletionPendingNotice() {
  const [info, setInfo] = useState<{ remainingDays: number } | null>(null);
  const [hasPin, setHasPin] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    (async () => {
      try {
        const me: any = await userService.getCurrentUser();
        if (!me) return;
        const { pending, remainingDays } = computeDeletionStatus(me);
        if (pending) {
          setInfo({ remainingDays });
          setHasPin(!!me.hasPinCode);
        }
      } catch {
        /* bỏ qua nếu không lấy được trạng thái */
      }
    })();
  }, []);

  const doCancel = async (pin?: string) => {
    setLoading(true);
    setPinError(null);
    const result = await securityService.cancelAccountDeletion(pin);
    setLoading(false);
    if (result.success) {
      toast.success("Đã hủy yêu cầu xóa tài khoản. Tài khoản của bạn sẽ không bị xóa.");
      setShowPinModal(false);
      setInfo(null);
    } else if (showPinModal) {
      setPinError(result.message || "Mã PIN không chính xác.");
    } else {
      toast.error(result.message || "Không thể hủy yêu cầu xóa tài khoản.");
    }
  };

  const handleCancelClick = () => {
    // Có PIN 2 lớp -> mở modal nhập PIN để xác nhận; ngược lại hủy luôn.
    if (hasPin) {
      setPinError(null);
      setShowPinModal(true);
    } else {
      void doCancel();
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = "/login";
  };

  if (!info) return null;

  return (
    <>
      {!showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1a1a1a] p-6 shadow-2xl">
            <div className="mb-4 flex flex-col items-center">
              <div className="mb-3 rounded-full bg-orange-100 dark:bg-orange-900/30 p-3">
                <AlertTriangle className="h-7 w-7 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-center text-lg font-bold text-gray-800 dark:text-white">
                Tài khoản đang chờ xóa
              </h3>
              <p className="mt-1 text-center text-sm text-gray-600 dark:text-gray-400">
                Tài khoản của bạn sẽ bị xóa vĩnh viễn sau{" "}
                <span className="font-semibold">{info.remainingDays} ngày</span>. Bạn có muốn hủy
                yêu cầu xóa không?
              </p>
            </div>

            <button
              onClick={handleCancelClick}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-green-600 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? "Đang xử lý..." : "Hủy xóa tài khoản"}
            </button>
            <button
              onClick={() => setInfo(null)}
              disabled={loading}
              className="mt-2 w-full rounded-full py-3 font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50"
            >
              Tiếp tục dùng app
            </button>
            <button
              onClick={handleLogout}
              disabled={loading}
              className="mt-1 w-full rounded-full py-3 font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      )}

      {/* Có PIN 2 lớp -> nhập PIN để xác nhận hủy xóa */}
      <PinInputModal
        open={showPinModal}
        title="Xác nhận mã PIN"
        description="Nhập mã PIN 2 lớp để hủy yêu cầu xóa tài khoản."
        icon={KeyRound}
        iconColor="text-green-600 dark:text-green-400"
        iconBgColor="bg-green-100 dark:bg-green-900/30"
        confirmLabel="Hủy xóa tài khoản"
        confirmBgColor="bg-green-600"
        confirmHoverColor="hover:bg-green-700"
        loading={loading}
        error={pinError}
        onConfirm={(pin) => doCancel(pin)}
        onClose={() => setShowPinModal(false)}
      />
    </>
  );
}
