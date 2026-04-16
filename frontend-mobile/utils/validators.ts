export function validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validatePassword(password: string): boolean {
    return password.trim().length >= 6;
}

export function validateRequired(value: string): boolean {
    return value.trim().length > 0;
}

export function validatePhone(phone: string): boolean {
    return /^\d{10}$/.test(phone.trim());
}

export function validateOtp(otp: string): boolean {
    return /^\d{6}$/.test(otp.trim());
}

export function validateStrongPassword(password: string): {
    valid: boolean;
    message?: string;
} {
    const value = password.trim();

    if (value.length < 8) {
        return { valid: false, message: "Mật khẩu phải có ít nhất 8 ký tự." };
    }

    if (!/[a-z]/.test(value)) {
        return {
            valid: false,
            message: "Mật khẩu phải có ít nhất 1 chữ thường.",
        };
    }

    if (!/[A-Z]/.test(value)) {
        return {
            valid: false,
            message: "Mật khẩu phải có ít nhất 1 chữ hoa.",
        };
    }

    if (!/\d/.test(value)) {
        return { valid: false, message: "Mật khẩu phải có ít nhất 1 chữ số." };
    }

    if (!/[^A-Za-z0-9]/.test(value)) {
        return {
            valid: false,
            message: "Mật khẩu phải có ít nhất 1 ký tự đặc biệt.",
        };
    }

    return { valid: true };
}
