import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import { confirmRegister, forgotPassword } from "../utils/auth";

export default function VerifyOTP() {
    const location = useLocation();
    const navigate = useNavigate();
    const { phone, type } = location.state || {};
    const isRegisterFlow = type === "register";
    
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [countdown, setCountdown] = useState(60);
    const [canResend, setCanResend] = useState(false);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (!phone) {
            navigate(type === "reset-password" ? "/forgot-password" : "/signup");
            return;
        }
        inputRefs.current[0]?.focus();
    }, [phone, navigate, type]);

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            setCanResend(true);
        }
    }, [countdown]);

    const handleChange = (index: number, value: string) => {
        if (value.length > 1) value = value[0];
        if (!/^\d*$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData("text").slice(0, 6);
        if (!/^\d+$/.test(pastedData)) return;

        const newOtp = [...otp];
        for (let i = 0; i < pastedData.length && i < 6; i++) {
            newOtp[i] = pastedData[i];
        }
        setOtp(newOtp);
        
        const nextIndex = Math.min(pastedData.length, 5);
        inputRefs.current[nextIndex]?.focus();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const otpCode = otp.join("");
        
        if (otpCode.length !== 6) {
            setError("Vui lòng nhập đủ 6 số OTP");
            return;
        }

        setLoading(true);
        setError("");

        try {
            if (type === "register") {
                await confirmRegister(phone, otpCode);
                navigate("/login", { replace: true });
            } else if (type === "reset-password") {
                navigate("/reset-password", {
                    state: { phone, otp: otpCode }
                });
            }
        } catch (err: any) {
            setError(err.message || "Mã OTP không đúng. Vui lòng thử lại.");
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (!canResend) return;
        
        setLoading(true);
        setError("");
        try {
            if (type === "register") {
                setError("Vui lòng quay lại trang đăng ký để gửi lại OTP");
            } else if (type === "reset-password") {
                await forgotPassword(phone);
            }
            setCountdown(60);
            setCanResend(false);
        } catch (err: any) {
            setError(err.message || "Không thể gửi lại OTP");
        } finally {
            setLoading(false);
        }
    };

    return (
            <div className="space-y-8 rounded-2xl border border-blue-100 bg-linear-to-b from-blue-50 via-white to-slate-50 p-8 text-gray-900 shadow-sm">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
                        <ShieldCheck className="h-10 w-10 text-blue-500" />
                    </div>
                    <h2 className="text-3xl font-bold">
                        {isRegisterFlow ? "Xác thực đăng ký" : "Xác thực đặt lại mật khẩu"}
                    </h2>
                    <p className="mt-2 text-gray-600">
                        {isRegisterFlow
                            ? `Nhập mã OTP gồm 6 chữ số đã gửi đến ${phone}`
                            : `Nhập mã OTP gồm 6 chữ số để đặt lại mật khẩu cho ${phone}`}
                    </p>
                </div>
                <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                    {error && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-600">
                            {error}
                        </div>
                    )}
                    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
                        {otp.map((digit, index) => (
                            <input
                                key={index}
                                ref={(el) => (inputRefs.current[index] = el)}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleChange(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                disabled={loading}
                                className="h-14 w-12 rounded-lg border border-gray-300 bg-white text-center text-2xl focus:border-blue-500 focus:outline-none"
                            />
                        ))}
                    </div>
                    
                    <div className="text-center text-sm text-gray-600">
                        {countdown > 0 ? (
                            <span>Gửi lại OTP sau {countdown}s</span>
                        ) : (
                            <button
                                type="button"
                                onClick={handleResend}
                                disabled={loading}
                                className="text-blue-500 hover:underline disabled:opacity-50"
                            >
                                Gửi lại OTP
                            </button>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading || otp.join("").length !== 6}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 py-3.5 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {loading ? "Đang xác nhận..." : "Xác nhận mã"}
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
