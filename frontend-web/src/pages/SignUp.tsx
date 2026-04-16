import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { CheckCircle2, Eye, EyeOff, Lock, Phone } from "lucide-react";
import { register } from "../utils/auth";
import { validateSignupForm } from "../utils/validation";

export default function SignUp() {
    const navigate = useNavigate();
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        const validation = validateSignupForm(phone, password, confirmPassword);
        if (!validation.isValid) {
            setError(validation.error || "Vui lòng kiểm tra thông tin");
            return;
        }

        setLoading(true);
        try {
            await register(phone, password, confirmPassword);
            navigate("/verify-otp", {
                state: { phone, type: "register" }
            });
        } catch (err: any) {
            setError(err.message || "Đăng ký thất bại. Vui lòng thử lại.");
        } finally {
            setLoading(false);
        }
    };

    return (
            <div className="space-y-8 rounded-2xl border border-blue-100 bg-linear-to-b from-blue-50 via-white to-slate-50 p-8 shadow-sm">
                <div className="text-center">
                    <h2 className="text-3xl font-bold text-gray-800">Tạo tài khoản mới</h2>
                    <p className="mt-2 text-gray-500">
                        Đăng ký bằng số điện thoại để bắt đầu
                    </p>
                </div>
                <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                    {error && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                            {error}
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
                            disabled={loading}
                        />
                        <button type="button" onClick={() => setShowPassword((prev) => !prev)} className="text-gray-500">
                            {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </button>
                    </div>
                    <div className="flex items-center rounded-xl border border-gray-200 bg-white px-3">
                        <Lock className="h-4 w-4 text-blue-500" />
                        <input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Nhập lại mật khẩu"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-transparent px-3 py-3.5 text-gray-800 outline-none"
                            disabled={loading}
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
                        {loading ? "Đang xử lý..." : "Đăng ký"}
                        {!loading && <CheckCircle2 className="h-4 w-4" />}
                    </button>
                </form>

                <p className="text-center text-xs text-gray-500">
                    Khi đăng ký, bạn đồng ý với Điều khoản sử dụng, Chính sách bảo mật và Chính sách cookie.
                </p>

                <div className="border-t border-gray-200 pt-5 text-center">
                    <span className="text-gray-600">
                        Bạn đã có tài khoản?{" "}
                    </span>
                    <Link to="/login" className="font-semibold text-blue-500 hover:underline">
                        Đăng nhập
                    </Link>
                </div>
            </div>
    );
}
