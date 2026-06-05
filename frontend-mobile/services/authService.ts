import apiClient from "@/api/apiClient";
import { getDeviceInfo } from "@/utils/deviceInfo";
import {
    clearStorage,
    saveIdToken,
    saveRefreshToken,
    saveToken,
    saveUser,
} from "@/utils/storage";

type LoginPayload = {
    email: string;
    password: string;
};

type SignupPayload = {
    fullName: string;
    username: string;
    email: string;
    password: string;
};

export type PhoneLoginPayload = {
    phone: string;
    password: string;
};

export type PhoneRegisterPayload = {
    phone: string;
    password: string;
    confirmPassword: string;
};

export type ResetPasswordPayload = {
    phone: string;
    password: string;
    confirmPassword: string;
    confirmationCode: string;
};

export type ApiAuthUser = {
    id: number;
    phone: string;
    name?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
    birthday?: string | null;
    bio?: string | null;
    gender?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    confirmUseAI?: boolean;
    deletionRequestedAt?: string | null;
    deletionScheduledFor?: string | null;
    // Computed from deletionScheduledFor - populated by getCurrentUser()
    deletionPending?: boolean;
    deletionRemainingDays?: number;
    hasPinCode?: boolean;
};

const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

const mapResetPasswordError = (rawMessage?: string): string => {
    const message = rawMessage || "";
    const lower = message.toLowerCase();

    if (lower.includes("invalid code provided")) {
        return "Mã OTP không đúng. Vui lòng kiểm tra lại OTP mới nhất.";
    }

    if (lower.includes("expired") || lower.includes("codeexpired")) {
        return "Mã OTP đã hết hạn. Vui lòng yêu cầu gửi lại OTP.";
    }

    return "Đặt lại mật khẩu thất bại. Vui lòng thử lại.";
};

const mapLoginError = (rawMessage?: string): string => {
    const message = rawMessage || "";
    const lower = message.toLowerCase();

    if (
        lower.includes("notauthorizedexception") ||
        lower.includes("incorrect username or password")
    ) {
        return "Tên đăng nhập hoặc mật khẩu không đúng.";
    }

    return "Đăng nhập thất bại. Vui lòng thử lại.";
};

const mapRegisterError = (rawMessage?: string): string => {
    const message = rawMessage || "";
    const lower = message.toLowerCase();

    if (
        lower.includes("user already exists") ||
        lower.includes("usernameexistsexception") ||
        lower.includes("already exists")
    ) {
        return "Số điện thoại đã được đăng ký. Vui lòng dùng số khác hoặc đăng nhập.";
    }

    return "Đăng ký thất bại. Vui lòng thử lại.";
};

export async function fakeLogin(
    payload: LoginPayload,
): Promise<{ success: boolean; message?: string }> {
    await sleep(600);
    if (!payload.email || !payload.password) {
        return { success: false, message: "Please fill in all fields." };
    }

    return { success: true };
}

export async function fakeSignup(
    payload: SignupPayload,
): Promise<{ success: boolean; message?: string }> {
    await sleep(700);

    if (
        !payload.email ||
        !payload.password ||
        !payload.fullName ||
        !payload.username
    ) {
        return { success: false, message: "Please fill in all fields." };
    }

    return { success: true };
}

export async function registerWithPhone(
    data: PhoneRegisterPayload,
): Promise<{ success: boolean; message?: string }> {
    try {
        const device = await getDeviceInfo();
        await apiClient.post("/auth/register", {
            ...data,
            deviceType: device.deviceType,
            deviceName: device.deviceName,
            ipAddress: device.ipAddress,
        });
        return { success: true };
    } catch (error: unknown) {
        const backendMessage =
            error && typeof error === "object"
                ? (error as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message ||
                (error as { message?: string }).message
                : undefined;
        return { success: false, message: mapRegisterError(backendMessage) };
    }
}

export type OtpResult = {
    success: boolean;
    message?: string;
    remainingSeconds?: number;
};

export async function confirmRegisterOtp(
    phone: string,
    otp: string,
): Promise<OtpResult> {
    try {
        await apiClient.post("/auth/confirm", { phone, otp });
        return { success: true };
    } catch (error: any) {
        const status = error?.response?.status;
        const errors = error?.response?.data?.errors;

        if (status === 429 && errors?.remainingSeconds) {
            const minutes = Math.ceil(errors.remainingSeconds / 60);
            return {
                success: false,
                message: `Nhập sai OTP quá nhiều lần. Thử lại sau ${minutes} phút.`,
                remainingSeconds: errors.remainingSeconds,
            };
        }

        const msg: string = (error?.response?.data?.message || error?.message || '').toLowerCase();
        if (msg.includes('expired') || msg.includes('codeexpired')) {
            return { success: false, message: "Mã xác thực đã hết hạn. Vui lòng yêu cầu gửi lại." };
        }
        return { success: false, message: "Mã xác thực không đúng, vui lòng thử lại." };
    }
}

export type LoginResult = {
    success: boolean;
    message?: string;
    user?: ApiAuthUser;
    remainingSeconds?: number;
    lockReason?: string;
    deletionPending?: boolean;
    deletionRemainingDays?: number;
};

export async function loginWithPhone(
    data: PhoneLoginPayload,
): Promise<LoginResult> {
    try {
        const device = await getDeviceInfo();
        const response = await apiClient.post("/auth/login", {
            ...data,
            deviceType: device.deviceType,
            deviceName: device.deviceName,
            ipAddress: device.ipAddress,
        });

        const loginData = response.data?.data ?? response.data;
        const accessToken: string | undefined = loginData?.token;
        const refreshToken: string | undefined =
            loginData?.refreskToken ?? loginData?.refreshToken;
        const idToken: string | undefined = loginData?.idToken;

        if (accessToken) {
            await saveToken(accessToken);
        }
        if (refreshToken) {
            await saveRefreshToken(refreshToken);
        }
        if (idToken) {
            await saveIdToken(idToken);
        } else if (accessToken) {
            await saveIdToken(accessToken);
        }

        const userProfile = await getCurrentUser();
        if (userProfile) {
            await saveUser(userProfile);
        }

        const result: LoginResult = { success: true, user: userProfile ?? undefined };
        if (loginData?.deletionPending) {
            result.deletionPending = true;
            result.deletionRemainingDays = loginData.deletionRemainingDays;
        }
        return result;
    } catch (error: unknown) {
        const err = error as { response?: { status?: number; data?: { message?: string; errors?: { remainingSeconds?: number; lockReason?: string; code?: string } } } };
        const status = err?.response?.status;
        const errors = err?.response?.data?.errors;
        const backendMessage = err?.response?.data?.message;

        if (status === 429 && errors?.remainingSeconds) {
            const minutes = Math.ceil(errors.remainingSeconds / 60);
            return {
                success: false,
                message: `Tài khoản bị khóa tạm do nhập sai quá nhiều lần. Thử lại sau ${minutes} phút.`,
                remainingSeconds: errors.remainingSeconds,
            };
        }

        if (status === 403 && errors?.code === 'ACCOUNT_LOCKED') {
            return {
                success: false,
                message: `Tài khoản đã bị khóa: ${errors.lockReason || 'Vi phạm chính sách'}`,
                remainingSeconds: errors.remainingSeconds,
                lockReason: errors.lockReason,
            };
        }

        return { success: false, message: mapLoginError(backendMessage) };
    }
}

const mapResendOtpError = (rawMessage?: string): string => {
    const lower = (rawMessage || '').toLowerCase();
    if (lower.includes('attempt limit exceeded')) {
        return 'Bạn đã gửi lại quá nhiều lần. Vui lòng thử lại sau ít phút.';
    }
    return 'Không thể gửi lại mã OTP. Vui lòng thử lại.';
};

export async function resendRegisterOtp(
    phone: string,
): Promise<{ success: boolean; message?: string }> {
    try {
        await apiClient.post("/auth/resend-otp", { phone });
        return { success: true };
    } catch (error: any) {
        const msg = error?.response?.data?.message || error?.message || '';
        return { success: false, message: mapResendOtpError(msg) };
    }
}

export async function forgotPassword(
    phone: string,
): Promise<{ success: boolean; message?: string }> {
    try {
        await apiClient.post("/auth/forgot-password", {
            phone,
            instant: new Date().toISOString(),
        });
        return { success: true };
    } catch (error: any) {
        const msg = error?.response?.data?.message || error?.message || '';
        return { success: false, message: mapResendOtpError(msg) };
    }
}

export async function resetPassword(
    data: ResetPasswordPayload,
): Promise<OtpResult> {
    try {
        await apiClient.post("/auth/reset-password", {
            ...data,
            instant: new Date().toISOString(),
        });
        return { success: true };
    } catch (error: any) {
        const status = error?.response?.status;
        const errors = error?.response?.data?.errors;

        if (status === 429 && errors?.remainingSeconds) {
            const minutes = Math.ceil(errors.remainingSeconds / 60);
            return {
                success: false,
                message: `Nhập sai OTP quá nhiều lần. Thử lại sau ${minutes} phút.`,
                remainingSeconds: errors.remainingSeconds,
            };
        }

        const backendMessage = error?.response?.data?.message || error?.message;
        return {
            success: false,
            message: mapResetPasswordError(backendMessage),
        };
    }
}

export async function getCurrentUser(): Promise<ApiAuthUser | null> {
    try {
        const response = await apiClient.get("/auth/me");
        const userData: ApiAuthUser | null = response.data?.data ?? null;
        if (!userData) return null;

        // Compute deletionPending from server fields so bootstrap can also detect it
        if (userData.deletionScheduledFor) {
            const scheduledFor = new Date(userData.deletionScheduledFor);
            const now = new Date();
            if (scheduledFor > now) {
                const msRemaining = scheduledFor.getTime() - now.getTime();
                userData.deletionPending = true;
                userData.deletionRemainingDays = Math.max(
                    0,
                    Math.floor(msRemaining / (1000 * 60 * 60 * 24)),
                );
            }
        }

        return userData;
    } catch {
        return null;
    }
}

export async function logoutApi(): Promise<void> {
    try {
        await apiClient.post("/auth/logout");
    } catch (error: any) {
        // 401/403 means token already invalidated (e.g. after logout-all) — not an error
        if (error?.response?.status !== 401 && error?.response?.status !== 403) {
            throw error;
        }
    } finally {
        await clearStorage();
    }
}
