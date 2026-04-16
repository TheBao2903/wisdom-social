import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, KeyRound, Phone, Send } from "lucide-react";
import { forgotPassword } from "../utils/auth";
import { validatePhone } from "../utils/validation";

export default function ForgotPassword() {
    const navigate = useNavigate();
    const [phone, setPhone] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        
        if (!phone) {
            setError("Vui lòng nhập số điện thoại");
            return;
        }

        const phoneValidation = validatePhone(phone);
        if (!phoneValidation.isValid) {
            setError(phoneValidation.error || "Số điện thoại không hợp lệ");
            return;
        }

        setLoading(true);
        try {
            await forgotPassword(phone);
            navigate("/reset-password", {
                state: { phone }
            });
        } catch (err: any) {
            setError(err.message || "Không thể gửi OTP. Vui lòng thử lại.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="rounded-2xl border border-blue-100 bg-linear-to-b from-blue-50 via-white to-slate-50 p-8 text-center shadow-sm">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
                    <KeyRound className="h-10 w-10 text-blue-500" />
                </div>
                <h2 className="mb-3 text-2xl font-semibold text-gray-800">Quên mật khẩu?</h2>
                <p className="mb-8 text-sm text-gray-500">
                    Nhập số điện thoại của bạn và chúng tôi sẽ gửi mã OTP để đặt lại mật khẩu.
                </p>

                {error && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="flex items-center rounded-xl border border-gray-200 bg-white px-3">
                        <Phone className="h-4 w-4 text-blue-500" />
                        <input
                            type="tel"
                            placeholder="Số điện thoại"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            disabled={loading}
                            className="w-full bg-transparent px-3 py-3.5 text-gray-800 outline-none"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 py-3.5 font-semibold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {loading ? "Đang gửi..." : "Gửi mã OTP"}
                        {!loading && <Send className="h-4 w-4" />}
                    </button>
                </form>

                <Link
                    to="/login"
                    className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-500 hover:text-blue-700"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Quay lại đăng nhập
                </Link>
        </div>
    );
}
