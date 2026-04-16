import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import axios from "axios";
import { setCookie } from "../utils/cookies";

const API_BASE_URL = "http://localhost:8080/api";

export default function QRLogin() {
  const [sessionId, setSessionId] = useState<string>("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [countdownSeconds, setCountdownSeconds] = useState<number>(60);
  const [isRejected, setIsRejected] = useState(false);
  const hasRun = useRef(false);
  const pollRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const navigate = useNavigate();

  const clearTimers = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }

    if (countdownRef.current) {
      window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

  const startCountdown = (seconds: number) => {
    if (countdownRef.current) {
      window.clearInterval(countdownRef.current);
    }

    setCountdownSeconds(seconds);
    countdownRef.current = window.setInterval(() => {
      setCountdownSeconds((current) => {
        if (current <= 1) {
          if (countdownRef.current) {
            window.clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          setStatusMessage("Mã QR đã hết hạn. Vui lòng tạo lại.");
          setQrCodeUrl("");
          setIsRejected(false);
          if (pollRef.current) {
            window.clearInterval(pollRef.current);
            pollRef.current = null;
          }
          return 0;
        }

        return current - 1;
      });
    }, 1000);
  };

  const resetQrState = () => {
    clearTimers();
    setSessionId("");
    setQrCodeUrl("");
    setStatusMessage("");
    setCountdownSeconds(60);
    setIsRejected(false);
  };

  // Create QR code session
  const createQRSession = async () => {
    try {
      resetQrState();
      const response = await axios.get(`${API_BASE_URL}/session/qr-login/create`);
      const newSessionId = response.data;
      setSessionId(newSessionId);

      // Generate QR code with session ID
      const qrData = JSON.stringify({
        type: "qr_login",
        session_id: newSessionId,
        timestamp: Date.now(),
      });

      const qrUrl = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      setQrCodeUrl(qrUrl);
      setStatusMessage("");
      startCountdown(60);
    } catch (err) {
      setStatusMessage("Không thể tạo mã QR. Vui lòng thử lại!");
      console.error("Create QR error:", err);
    }
  };

  useEffect(() => {
      if (hasRun.current) return;
      hasRun.current = true;
      createQRSession();
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    pollRef.current = window.setInterval(async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/session/qr-login/status/${sessionId}`);
        console.log("QR status response:", response.data.data);
        const { status, expireAt } = response.data.data;

        if (expireAt) {
          const remaining = Math.max(
            0,
            Math.ceil((new Date(expireAt).getTime() - Date.now()) / 1000)
          );
          setCountdownSeconds(remaining);
        }

        if (status === "CONFIRMED") {
          clearTimers();

          const tokenResponse = await axios.get(`${API_BASE_URL}/session/qr-login/access-token/${sessionId}`);
          const rawTokenPayload = tokenResponse.data?.data ?? tokenResponse.data;

          // Accept multiple payload shapes from backend for safety.
          let accessToken: string | undefined;
          let refreshToken: string | undefined;

          if (typeof rawTokenPayload === "string") {
            accessToken = rawTokenPayload;
          } else if (rawTokenPayload && typeof rawTokenPayload === "object") {
            accessToken =
              rawTokenPayload.token ??
              rawTokenPayload.accessToken ??
              rawTokenPayload.idToken;
            refreshToken =
              rawTokenPayload.refreshToken ??
              rawTokenPayload.refreskToken;
          }

          if (typeof accessToken === "string") {
            accessToken = accessToken.replace(/^"|"$/g, "").trim();
          }

          if (typeof refreshToken === "string") {
            refreshToken = refreshToken.replace(/^"|"$/g, "").trim();
          }

          if (accessToken && accessToken.length > 20) {
            // Store tokens using cookies; QR flow uses a dedicated refresh token cookie.
            setCookie('accessToken', accessToken, 0.042); // 1 hour

            if (refreshToken && refreshToken.length > 20) {
              setCookie('refreshTokenQr', refreshToken, 7); // 7 days
            }

            localStorage.setItem('type', 'qr');
            localStorage.setItem('authed', 'true');

            clearTimers();
            navigate("/");
          } else {
            setStatusMessage("Không thể lấy token. Vui lòng thử lại!");
          }
        } else if (status === "REJECTED") {
          clearTimers();
          setIsRejected(true);
          setStatusMessage("Yêu cầu đăng nhập đã bị từ chối.");
          setQrCodeUrl("");
        }
      } catch (err) {
        console.error("Check QR status error:", err);
      }
    }, 2000);

    return () => {
      clearTimers();
    };
  }, [sessionId, navigate]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, []);


  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-purple-50 to-blue-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Đăng nhập bằng QR Code
          </h1>
          <p className="text-gray-600">
            Quét mã QR bằng ứng dụng di động để đăng nhập
          </p>
        </div>

          <div className="space-y-6">
            {qrCodeUrl && (
              <div className="flex flex-col items-center">
                <div className="bg-white p-4 rounded-lg border-4 border-gray-200 shadow-inner relative">
                  <img
                    src={qrCodeUrl}
                    alt="QR Code"
                    className="w-64 h-64"
                  />
                  <div className="mt-4 flex items-center justify-between gap-3 text-sm text-gray-600">
                    <span>
                      {countdownSeconds > 0
                        ? `Hết hạn sau ${Math.floor(countdownSeconds / 60)
                            .toString()
                            .padStart(2, '0')}:${(countdownSeconds % 60)
                            .toString()
                            .padStart(2, '0')}`
                        : 'Mã QR đã hết hạn'}
                    </span>
                    {isRejected && (
                      <span className="text-red-600 font-semibold">Bị từ chối</span>
                    )}
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <div className="flex items-center justify-center space-x-2">
                    <p className="text-lg font-semibold">
                      {isRejected ? 'Yêu cầu đăng nhập đã bị từ chối' : 'Chờ quét mã QR...'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {statusMessage && (
              <div
                className={`rounded-xl p-4 text-sm text-center ${
                  isRejected
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {statusMessage}
              </div>
            )}

            {(isRejected || !qrCodeUrl) && (
              <button
                onClick={createQRSession}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Tạo mã QR mới
              </button>
            )}
          </div>
        

        <div className="mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={() => navigate("/login")}
            className="w-full text-gray-600 hover:text-gray-800 transition-colors"
          >
            Quay lại đăng nhập thường
          </button>
        </div>

        <div className="mt-6 bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-gray-700 text-center">
            <strong>Hướng dẫn:</strong>
          </p>
          <ol className="text-sm text-gray-600 mt-2 space-y-1 list-decimal list-inside">
            <li>Mở ứng dụng di động</li>
            <li>Đăng nhập vào tài khoản của bạn</li>
            <li>Nhấn vào biểu tượng quét QR</li>
            <li>Quét mã QR này và xác nhận đăng nhập</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
