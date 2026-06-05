export function validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export interface ValidationResult {
    isValid: boolean;
    error?: string;
}

export function validatePassword(password: string): boolean {
    return password.trim().length >= 6;
}

export function validateRequired(value: string): boolean {
    return value.trim().length > 0;
}

export function validatePhone(phone: string): ValidationResult {
    if (!phone) {
        return { isValid: false, error: "Số điện thoại không được để trống" };
    }

    if (!/^[0-9]{10}$/.test(phone.trim())) {
        return { isValid: false, error: "Số điện thoại phải là 10 chữ số" };
    }

    return { isValid: true };
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

export type PasswordStrengthLevel =
    | "empty"
    | "weak"
    | "medium"
    | "strong"
    | "very-strong";

export interface PasswordStrength {
    level: PasswordStrengthLevel;
    score: number; // 0-4 satisfied character-type criteria
    label: string;
    checks: {
        length: boolean;
        lowercase: boolean;
        uppercase: boolean;
        number: boolean;
        special: boolean;
    };
}

export function getPasswordStrength(password: string): PasswordStrength {
    const checks = {
        length: password.length >= 8,
        lowercase: /[a-z]/.test(password),
        uppercase: /[A-Z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[^A-Za-z0-9]/.test(password),
    };

    if (!password) {
        return { level: "empty", score: 0, label: "", checks };
    }

    const typeScore =
        (checks.lowercase ? 1 : 0) +
        (checks.uppercase ? 1 : 0) +
        (checks.number ? 1 : 0) +
        (checks.special ? 1 : 0);

    const lengthBonus = password.length >= 12 ? 1 : 0;

    let level: PasswordStrengthLevel;
    let label: string;

    if (!checks.length || typeScore <= 1) {
        level = "weak";
        label = "Yếu";
    } else if (typeScore === 2) {
        level = "medium";
        label = "Trung bình";
    } else if (typeScore === 3 || (typeScore === 4 && lengthBonus === 0)) {
        level = "strong";
        label = "Mạnh";
    } else {
        level = "very-strong";
        label = "Rất mạnh";
    }

    return { level, score: typeScore, label, checks };
}

export function validateUsername(username: string): ValidationResult {
    if (!username || username.trim() === "") {
        return { isValid: false, error: "Tên người dùng không được để trống" };
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        return {
            isValid: false,
            error: "Tên người dùng phải từ 3-20 ký tự (chữ, số, gạch dưới)",
        };
    }

    return { isValid: true };
}

export function validateFullName(name: string): ValidationResult {
    if (!name || name.trim() === "") {
        return { isValid: false, error: "Họ và tên không được để trống" };
    }

    if (name.trim().length < 2) {
        return { isValid: false, error: "Họ và tên phải ít nhất 2 ký tự" };
    }

    if (name.trim().length > 50) {
        return { isValid: false, error: "Họ và tên không được vượt quá 50 ký tự" };
    }

    return { isValid: true };
}

export function validateBirthday(birthday: string): ValidationResult {
    if (!birthday || birthday.trim() === "") {
        return { isValid: false, error: "Ngày sinh không được để trống" };
    }

    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = birthday.match(dateRegex);

    if (!match) {
        return { isValid: false, error: "Ngày sinh phải có định dạng DD/MM/YYYY" };
    }

    const [, day, month, year] = match;
    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);

    if (monthNum < 1 || monthNum > 12) {
        return { isValid: false, error: "Tháng phải từ 01 đến 12" };
    }

    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (yearNum % 4 === 0 && (yearNum % 100 !== 0 || yearNum % 400 === 0)) {
        daysInMonth[1] = 29;
    }

    if (dayNum < 1 || dayNum > daysInMonth[monthNum - 1]) {
        return {
            isValid: false,
            error: `Ngày phải từ 01 đến ${daysInMonth[monthNum - 1]}`,
        };
    }

    const birthDate = new Date(yearNum, monthNum - 1, dayNum);
    const today = new Date();

    if (birthDate > today) {
        return {
            isValid: false,
            error: "Ngày sinh không được lớn hơn ngày hiện tại",
        };
    }

    const age = today.getFullYear() - birthDate.getFullYear();
    if (age < 13) {
        return { isValid: false, error: "Phải ít nhất 13 tuổi để sử dụng" };
    }

    return { isValid: true };
}

export function validateGender(gender: string): ValidationResult {
    if (!gender || gender.trim() === "") {
        return { isValid: false, error: "Giới tính không được để trống" };
    }

    const validGenders = ["MALE", "FEMALE", "HIDDEN"];
    if (!validGenders.includes(gender)) {
        return { isValid: false, error: "Giới tính không hợp lệ" };
    }

    return { isValid: true };
}

// ==================== Authentication Form Validators ====================

/**
 * Confirm password validation
 */
export function validateConfirmPassword(
    password: string,
    confirmPassword: string
): ValidationResult {
    if (!confirmPassword) {
        return { isValid: false, error: "Vui lòng xác nhận mật khẩu" };
    }

    if (password !== confirmPassword) {
        return { isValid: false, error: "Mật khẩu xác nhận không khớp" };
    }

    return { isValid: true };
}

/**
 * OTP validation - exactly 6 digits
 */
export function validateOTP(otp: string): ValidationResult {
    if (!otp) {
        return { isValid: false, error: "Mã OTP không được để trống" };
    }

    if (!/^[0-9]{6}$/.test(otp.trim())) {
        return { isValid: false, error: "Mã OTP phải là 6 chữ số" };
    }

    return { isValid: true };
}

/**
 * Login form validation
 */
export function validateLoginForm(
    phone: string,
    password: string
): ValidationResult {
    if (!phone) {
        return { isValid: false, error: "Số điện thoại không được để trống" };
    }

    if (!/^[0-9]{10}$/.test(phone.trim())) {
        return { isValid: false, error: "Số điện thoại phải là 10 chữ số" };
    }

    if (!password) {
        return { isValid: false, error: "Mật khẩu không được để trống" };
    }

    return { isValid: true };
}

/**
 * Signup form validation
 */
export function validateSignupForm(
    phone: string,
    password: string,
    confirmPassword: string
): ValidationResult {
    if (!phone) {
        return { isValid: false, error: "Số điện thoại không được để trống" };
    }

    if (!/^[0-9]{10}$/.test(phone.trim())) {
        return { isValid: false, error: "Số điện thoại phải là 10 chữ số" };
    }

    if (!password) {
        return { isValid: false, error: "Mật khẩu không được để trống" };
    }

    if (password.length < 8) {
        return { isValid: false, error: "Mật khẩu phải có ít nhất 8 ký tự" };
    }

    if (password.length > 50) {
        return { isValid: false, error: "Mật khẩu không được vượt quá 50 ký tự" };
    }

    if (!/[a-z]/.test(password)) {
        return { isValid: false, error: "Mật khẩu phải có ít nhất 1 chữ thường" };
    }

    if (!/[A-Z]/.test(password)) {
        return { isValid: false, error: "Mật khẩu phải có ít nhất 1 chữ hoa" };
    }

    if (!/[0-9]/.test(password)) {
        return { isValid: false, error: "Mật khẩu phải có ít nhất 1 số" };
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
        return { isValid: false, error: "Mật khẩu phải có ít nhất 1 ký tự đặc biệt" };
    }

    const confirmValidation = validateConfirmPassword(password, confirmPassword);
    if (!confirmValidation.isValid) {
        return confirmValidation;
    }

    return { isValid: true };
}

/**
 * Reset password form validation
 */
export function validateResetPasswordForm(
    password: string,
    confirmPassword: string
): ValidationResult {
    if (!password) {
        return { isValid: false, error: "Mật khẩu không được để trống" };
    }

    if (password.length < 8) {
        return { isValid: false, error: "Mật khẩu phải có ít nhất 8 ký tự" };
    }

    if (password.length > 50) {
        return { isValid: false, error: "Mật khẩu không được vượt quá 50 ký tự" };
    }

    if (!/[a-z]/.test(password)) {
        return { isValid: false, error: "Mật khẩu phải có ít nhất 1 chữ thường" };
    }

    if (!/[A-Z]/.test(password)) {
        return { isValid: false, error: "Mật khẩu phải có ít nhất 1 chữ hoa" };
    }

    if (!/[0-9]/.test(password)) {
        return { isValid: false, error: "Mật khẩu phải có ít nhất 1 số" };
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
        return { isValid: false, error: "Mật khẩu phải có ít nhất 1 ký tự đặc biệt" };
    }

    const confirmValidation = validateConfirmPassword(password, confirmPassword);
    if (!confirmValidation.isValid) {
        return confirmValidation;
    }

    return { isValid: true };
}

/**
 * Profile form validation
 */
export function validateProfileForm(
    name: string,
    username: string,
    birthday: string,
    gender: string
): ValidationResult {
    const nameValidation = validateFullName(name);
    if (!nameValidation.isValid) {
        return nameValidation;
    }

    const usernameValidation = validateUsername(username);
    if (!usernameValidation.isValid) {
        return usernameValidation;
    }

    const birthdayValidation = validateBirthday(birthday);
    if (!birthdayValidation.isValid) {
        return birthdayValidation;
    }

    const genderValidation = validateGender(gender);
    if (!genderValidation.isValid) {
        return genderValidation;
    }

    return { isValid: true };
}
