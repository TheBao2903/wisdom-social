import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Lock } from "lucide-react";
import { resetPassword } from "../utils/auth";
import { validateResetPasswordForm } from "../utils/validation";

export default function ResetPassword() {
    const location = useLocation();
    const navigate = useNavigate();
    const { phone } = location.state || {};
    
    const [otp, setOtp] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!phone) {
            navigate("/forgot-password");
        }
    }, [phone, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!otp || otp.length !== 6) {
            setError("Vui lòng nhập mã OTP gồm 6 chữ số");
            return;
        }

        const validation = validateResetPasswordForm(password, confirmPassword);
        if (!validation.isValid) {
            setError(validation.error || "Vui lòng kiểm tra thông tin");
            return;
        }

        setLoading(true);
        try {
            await resetPassword(phone, otp, password, confirmPassword);
            alert("Đặt lại mật khẩu thành công! Vui lòng đăng nhập.");
            navigate("/login", { replace: true });
        } catch (err: any) {
            setError(err.message || "Đặt lại mật khẩu thất bại. Vui lòng thử lại.");
        } finally {
            setLoading(false);
        }
    };

    return (
            <div className="space-y-8 rounded-2xl border border-blue-100 bg-linear-to-b from-blue-50 via-white to-slate-50 p-8 text-gray-900 shadow-sm">
                <div className="text-center">
                    <h2 className="text-3xl font-bold">Đặt lại mật khẩu</h2>
                    <p className="mt-2 text-gray-600">
                        Nhập OTP và mật khẩu mới của bạn
                    </p>
                </div>
                <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                    {error && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                            {error}
                        </div>
                    )}
                    <div className="flex items-center rounded-xl border border-gray-200 bg-white px-3">
                        <KeyRound className="h-4 w-4 text-blue-500" />
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="Mã OTP"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            disabled={loading}
                            className="w-full bg-transparent px-3 py-3.5 text-gray-800 outline-none"
                        />
                    </div>
                    <div className="flex items-center rounded-xl border border-gray-200 bg-white px-3">
                        <Lock className="h-4 w-4 text-blue-500" />
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Mật khẩu mới"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loading}
                            className="w-full bg-transparent px-3 py-3.5 text-gray-800 outline-none"
                        />
                        <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="text-gray-500">
                            {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </button>
                    </div>
                    <div className="flex items-center rounded-xl border border-gray-200 bg-white px-3">
                        <Lock className="h-4 w-4 text-blue-500" />
                        <input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Nhập lại mật khẩu mới"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={loading}
                            className="w-full bg-transparent px-3 py-3.5 text-gray-800 outline-none"
                        />
                        <button type="button" onClick={() => setShowConfirmPassword((prev) => !prev)} className="text-gray-500">
                            {showConfirmPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </button>
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 py-3.5 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {loading ? "Đang xử lý..." : "Cập nhật mật khẩu"}
                        {!loading && <CheckCircle2 className="h-4 w-4" />}
                    </button>
                </form>
                <div className="text-center">
                    <Link to="/login" className="inline-flex items-center gap-2 text-blue-500 hover:underline">
                        <ArrowLeft className="h-4 w-4" />
                        Quay lại đăng nhập
                    </Link>
                </div>
            </div>
    );
}
