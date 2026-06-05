import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Phone, ArrowRight } from "lucide-react";
import { login, AuthError } from "../utils/auth";
import { validatePhone } from "../utils/validation";

const formatCountdown = (totalSeconds: number): string => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export default function Login() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("0398721346");
  const [password, setPassword] = useState("Xen123123!");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lockCountdown, setLockCountdown] = useState(0);
  const [accountLocked, setAccountLocked] = useState(false);

  useEffect(() => {
    if (lockCountdown <= 0) return;
    const t = setTimeout(() => setLockCountdown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [lockCountdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockCountdown > 0 || accountLocked) return;
    setLoading(true);
    setError("");

    if (!phone || !password) {
      setError("Vui lòng nhập số điện thoại và mật khẩu.");
      setLoading(false);
      return;
    }

    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.isValid) {
      setError(phoneValidation.error || "Số điện thoại không hợp lệ");
      setLoading(false);
      return;
    }

    try {
      const success = await login(phone, password);
      console.log("Login result:", success);
      if (success) {
        navigate("/", { replace: true });
      }
    } catch (err: any) {
      console.error("Login error:", err);
      if (err instanceof AuthError) {
        if (err.remainingSeconds && err.remainingSeconds > 0) {
          setLockCountdown(err.remainingSeconds);
        }
        if (err.code === "ACCOUNT_LOCKED") {
          setAccountLocked(true);
        }
      }
      setError(err.message || "Đăng nhập thất bại. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const isLocked = lockCountdown > 0 || accountLocked;


  return (
    <div className="rounded-2xl border border-blue-100 bg-linear-to-b from-blue-50 via-white to-slate-50 p-8 shadow-sm">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-gray-800">Chào mừng bạn trở lại</h2>
        <p className="mt-1 text-sm text-gray-500">Đăng nhập để tiếp tục hành trình kết nối</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-600">
            {error}
            {lockCountdown > 0 && (
              <div className="mt-1 font-semibold">
                Thử lại sau {formatCountdown(lockCountdown)}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center rounded-xl border border-gray-200 bg-white px-3">
          <Phone className="h-4 w-4 text-blue-500" />
          <input
            type="tel"
            placeholder="Số điện thoại"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-transparent px-3 py-3.5 text-gray-800 outline-none"
            required
            disabled={loading}
          />
        </div>

        <div className="flex items-center rounded-xl border border-gray-200 bg-white px-3">
          <Lock className="h-4 w-4 text-blue-500" />
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-transparent px-3 py-3.5 text-gray-800 outline-none"
            required
            disabled={loading}
          />
          <button
            type="button"
            className="text-gray-500"
            onClick={() => setShowPassword((prev) => !prev)}
          >
            {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </div>

        <div className="text-right">
          <Link to="/forgot-password" className="text-sm font-semibold text-blue-500 hover:text-blue-600">
            Quên mật khẩu?
          </Link>
        </div>

        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 py-3.5 font-semibold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={loading || isLocked}
        >
          {loading
            ? "Đang đăng nhập..."
            : lockCountdown > 0
              ? `Thử lại sau ${formatCountdown(lockCountdown)}`
              : accountLocked
                ? "Tài khoản đã khóa"
                : "Đăng nhập"}
          {!loading && !isLocked && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>

      <p className="mt-6 border-t border-gray-200 pt-5 text-center text-sm text-gray-600">
        Bạn chưa có tài khoản?{" "}
        <Link to="/signup" className="font-semibold text-blue-500 hover:text-blue-700">
          Đăng ký
        </Link>
      </p>

      <p className="mt-3 text-center text-sm text-gray-600">
        Hoặc đăng nhập bằng{" "}
        <Link to="/login/qr" className="font-semibold text-blue-500 hover:text-blue-700">
          QR Code
        </Link>
      </p>
    </div>
  );
}
