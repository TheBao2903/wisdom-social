export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export const validatePhone = (phone: string): ValidationResult => {
  const phoneRegex = /^[0-9]{10}$/;

  if (!phone) {
    return { isValid: false, error: "Số điện thoại không được để trống" };
  }

  if (!phoneRegex.test(phone)) {
    return { isValid: false, error: "Số điện thoại phải là 10 chữ số" };
  }

  return { isValid: true };
};

export const validatePassword = (password: string): ValidationResult => {
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

  return { isValid: true };
};

export const validateConfirmPassword = (
  password: string,
  confirmPassword: string
): ValidationResult => {
  if (!confirmPassword) {
    return { isValid: false, error: "Vui lòng xác nhận mật khẩu" };
  }

  if (password !== confirmPassword) {
    return { isValid: false, error: "Mật khẩu xác nhận không khớp" };
  }

  return { isValid: true };
};

export const validateSignupForm = (
  phone: string,
  password: string,
  confirmPassword: string
): ValidationResult => {
  const phoneValidation = validatePhone(phone);
  if (!phoneValidation.isValid) {
    return phoneValidation;
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    return passwordValidation;
  }

  const confirmValidation = validateConfirmPassword(password, confirmPassword);
  if (!confirmValidation.isValid) {
    return confirmValidation;
  }

  return { isValid: true };
};

export const validateResetPasswordForm = (
  password: string,
  confirmPassword: string
): ValidationResult => {
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    return passwordValidation;
  }

  const confirmValidation = validateConfirmPassword(password, confirmPassword);
  if (!confirmValidation.isValid) {
    return confirmValidation;
  }

  return { isValid: true };
};

// Profile edit validations
export const validateUsername = (username: string): ValidationResult => {
  if (!username || username.trim() === "") {
    return { isValid: false, error: "Tên người dùng không được để trống" };
  }

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return { isValid: false, error: "Tên người dùng phải từ 3-20 ký tự (chữ, số, gạch dưới)" };
  }

  return { isValid: true };
};

export const validateFullName = (name: string): ValidationResult => {
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
};

export const validateBirthday = (birthday: string): ValidationResult => {
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
    return { isValid: false, error: `Ngày phải từ 01 đến ${daysInMonth[monthNum - 1]}` };
  }

  const birthDate = new Date(yearNum, monthNum - 1, dayNum);
  const today = new Date();

  if (birthDate > today) {
    return { isValid: false, error: "Ngày sinh không được lớn hơn ngày hiện tại" };
  }

  const age = today.getFullYear() - birthDate.getFullYear();
  if (age < 13) {
    return { isValid: false, error: "Phải ít nhất 13 tuổi để sử dụng" };
  }

  return { isValid: true };
};

export const validateGender = (gender: string): ValidationResult => {
  if (!gender || gender.trim() === "") {
    return { isValid: false, error: "Giới tính không được để trống" };
  }

  const validGenders = ["MALE", "FEMALE", "HIDDEN"];
  if (!validGenders.includes(gender)) {
    return { isValid: false, error: "Giới tính không hợp lệ" };
  }

  return { isValid: true };
};

export const validateProfileForm = (
  name: string,
  username: string,
  birthday: string,
  gender: string
): ValidationResult => {
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
};
