import { useEffect, useRef, useState } from "react";
import { Lock, X, Eye, EyeOff, ShieldCheck, KeyRound } from "lucide-react";
import toast from "react-hot-toast";
import { forgotPassword, resetPassword, AuthError } from "../../utils/auth";
import { validateResetPasswordForm } from "../../utils/validation";
import securityService from "../../services/securityService";

interface ChangePasswordModalProps {
  open: boolean;
  /** Phone of the currently logged-in user — OTP is sent here. */
  phone: string;
  /** Whether the user has the 2-layer PIN enabled (extra confirm step). */
  hasPinCode?: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const RESEND_COOLDOWN = 30; // seconds

const maskPhone = (phone: string): string => {
  if (!phone) return "";
  const tail = phone.slice(-3);
  return `${"*".repeat(Math.max(0, phone.length - 3))}${tail}`;
};

type Step = "form" | "pin";

export default function ChangePasswordModal({
  open,
  phone,
  hasPinCode = false,
  onClose,
  onSuccess,
}: ChangePasswordModalProps) {
  const [step, setStep] = useState<Step>("form");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pin, setPin] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const sentRef = useRef(false);

  // Reset state + auto-send OTP whenever the modal opens.
  useEffect(() => {
    if (!open) {
      sentRef.current = false;
      setStep("form");
      setOtp("");
      setPassword("");
      setConfirmPassword("");
      setPin("");
      setShowPassword(false);
      setError(null);
      setInfo(null);
      setCooldown(0);
      return;
    }
    if (sentRef.current) return;
    sentRef.current = true;
    if (phone) {
      toast(`Mã OTP sẽ được gửi về số điện thoại ${maskPhone(phone)} của bạn.`, {
        icon: "📱",
      });
    }
    void sendOtp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Resend cooldown ticker.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const sendOtp = async () => {
    if (!phone) {
      setError("Không tìm thấy số điện thoại của tài khoản.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await forgotPassword(phone);
      setInfo(`Đã gửi mã OTP đến số ${maskPhone(phone)}.`);
      setCooldown(RESEND_COOLDOWN);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gửi OTP thất bại. Vui lòng thử lại.";
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  // Thực hiện đổi mật khẩu (đã xác minh OTP + PIN nếu cần) rồi báo thành công.
  const doReset = async () => {
    setLoading(true);
    try {
      await resetPassword(phone, otp, password, confirmPassword);
      onSuccess("Đổi mật khẩu thành công.");
    } catch (err: unknown) {
      if (err instanceof AuthError && err.remainingSeconds) {
        const minutes = Math.ceil(err.remainingSeconds / 60);
        setError(`Nhập sai OTP quá nhiều lần. Thử lại sau ${minutes} phút.`);
      } else {
        const msg = err instanceof Error ? err.message : "Đổi mật khẩu thất bại.";
        setError(msg);
      }
      // Quay lại bước form để người dùng sửa OTP/mật khẩu.
      setStep("form");
    } finally {
      setLoading(false);
    }
  };

  // Bấm "Đổi mật khẩu": validate xong -> nếu có PIN thì sang bước 2FA, ngược lại đổi luôn.
  const handleSubmit = async () => {
    setError(null);

    if (!/^[0-9]{6}$/.test(otp)) {
      setError("Mã OTP phải gồm 6 chữ số.");
      return;
    }
    const validation = validateResetPasswordForm(password, confirmPassword);
    if (!validation.isValid) {
      setError(validation.error ?? "Thông tin không hợp lệ.");
      return;
    }

    if (hasPinCode) {
      setPin("");
      setStep("pin");
      return;
    }
    await doReset();
  };

  // Bước 2FA: xác thực PIN rồi mới đổi mật khẩu.
  const handleVerifyPin = async () => {
    setError(null);
    if (!/^[0-9]{6}$/.test(pin)) {
      setError("Mã PIN phải gồm 6 chữ số.");
      return;
    }
    setLoading(true);
    const result = await securityService.verifyPin(pin);
    if (!result.success) {
      setError(result.message || "Mã PIN không chính xác.");
      setLoading(false);
      return;
    }
    setLoading(false);
    await doReset();
  };

  if (!open) return null;

  const busy = loading || sending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        className="bg-white dark:bg-[#1a1a1a] rounded-2xl max-w-md w-full p-6 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          disabled={busy}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626] disabled:opacity-50"
        >
          <X size={18} className="text-gray-500 dark:text-gray-400" />
        </button>

        {step === "form" ? (
          <>
            <div className="flex flex-col items-center mb-4">
              <div className="p-3 rounded-full mb-3 bg-blue-100 dark:bg-blue-900/30">
                <Lock size={28} className="text-blue-500" />
              </div>
              <h3 className="text-lg font-bold dark:text-white text-center">Đổi mật khẩu</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 text-center">
                Nhập mã OTP đã gửi và mật khẩu mới của bạn.
              </p>
            </div>

            {info && !error && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-2">
                <ShieldCheck size={18} className="text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <p className="text-sm text-green-700 dark:text-green-300">{info}</p>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-300 text-center">{error}</p>
              </div>
            )}

            {/* OTP */}
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Mã OTP
            </label>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="6 chữ số"
                className="flex-1 px-3 py-2.5 rounded-lg border border-gray-300 dark:border-[#363636] bg-white dark:bg-[#0f0f0f] dark:text-white tracking-[0.3em] outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={sendOtp}
                disabled={sending || cooldown > 0}
                className="px-3 py-2.5 text-sm font-semibold text-blue-500 disabled:text-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {cooldown > 0 ? `Gửi lại (${cooldown}s)` : sending ? "Đang gửi..." : "Gửi lại"}
              </button>
            </div>

            {/* New password */}
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Mật khẩu mới
            </label>
            <div className="relative mb-3">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu mới"
                className="w-full px-3 py-2.5 pr-10 rounded-lg border border-gray-300 dark:border-[#363636] bg-white dark:bg-[#0f0f0f] dark:text-white outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute top-1/2 right-2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Confirm password */}
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Xác nhận mật khẩu mới
            </label>
            <div className="relative mb-2">
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-[#363636] bg-white dark:bg-[#0f0f0f] dark:text-white outline-none focus:border-blue-500"
              />
            </div>

            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-4">
              Mật khẩu 8-50 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.
            </p>

            <button
              onClick={handleSubmit}
              disabled={busy}
              className="w-full py-3 rounded-full font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600"
            >
              {loading && (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {loading ? "Đang xử lý..." : hasPinCode ? "Tiếp tục" : "Đổi mật khẩu"}
            </button>

            <button
              onClick={onClose}
              disabled={busy}
              className="w-full py-3 mt-2 text-gray-500 dark:text-gray-400 font-semibold hover:bg-gray-50 dark:hover:bg-[#262626] rounded-full transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
          </>
        ) : (
          /* ── Bước 2FA: xác thực mã PIN ───────────────────────────────── */
          <>
            <div className="flex flex-col items-center mb-4">
              <div className="p-3 rounded-full mb-3 bg-blue-100 dark:bg-blue-900/30">
                <KeyRound size={28} className="text-blue-500" />
              </div>
              <h3 className="text-lg font-bold dark:text-white text-center">Xác thực 2 yếu tố</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 text-center">
                Nhập mã PIN 6 chữ số để xác nhận đổi mật khẩu.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-300 text-center">{error}</p>
              </div>
            )}

            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="• • • • • •"
              className="w-full px-3 py-3 mb-4 text-center text-2xl tracking-[0.5em] rounded-lg border border-gray-300 dark:border-[#363636] bg-white dark:bg-[#0f0f0f] dark:text-white outline-none focus:border-blue-500"
            />

            <button
              onClick={handleVerifyPin}
              disabled={busy}
              className="w-full py-3 rounded-full font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600"
            >
              {loading && (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {loading ? "Đang xử lý..." : "Xác nhận & đổi mật khẩu"}
            </button>

            <button
              onClick={() => {
                setError(null);
                setPin("");
                setStep("form");
              }}
              disabled={busy}
              className="w-full py-3 mt-2 text-gray-500 dark:text-gray-400 font-semibold hover:bg-gray-50 dark:hover:bg-[#262626] rounded-full transition-colors disabled:opacity-50"
            >
              Quay lại
            </button>
          </>
        )}
      </div>
    </div>
  );
}
