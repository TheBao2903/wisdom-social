import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, Loader2, AlertCircle } from "lucide-react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import userService from "../services/userService";
import { buildS3Url } from "../utils/s3";
import {
  validateUsername,
  validateFullName,
  validateBirthday,
  validateGender
} from "../utils/validation";
import axios from "axios";

interface FormErrors {
  name: string;
  username: string;
  birthday: string;
  gender: string;
}

interface FormState {
  name: string;
  username: string;
  bio: string;
  birthday: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  avatarUrl: string;
}

export default function EditProfile() {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<FormState>({
    name: "",
    username: "",
    bio: "",
    birthday: "",
    gender: "OTHER",
    avatarUrl: "",
  });

  const [formErrors, setFormErrors] = useState<FormErrors>({
    name: "",
    username: "",
    birthday: "",
    gender: "",
  });

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewAvatar, setPreviewAvatar] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'loading'; text: string } | null>(null);

  useEffect(() => {
    if (currentUser) {
      setFormData({
        name: currentUser.fullName ?? currentUser.name ?? "",
        username: currentUser.username ?? "",
        bio: currentUser.bio ?? "",
        birthday: currentUser.birthday ?? "",
        gender: (currentUser.gender?.toUpperCase() as "MALE" | "FEMALE" | "OTHER"),
        avatarUrl: currentUser.avatarUrl ?? "",
      });
      setPreviewAvatar(currentUser.avatarUrl ?? "");
    }
  }, [currentUser]);

  const validateField = (field: keyof FormState, value: string) => {
    let error = "";

    if (field === "name") {
      const validation = validateFullName(value);
      error = validation.error || "";
    } else if (field === "username") {
      const validation = validateUsername(value);
      error = validation.error || "";
    } else if (field === "birthday") {
      if (value) {
        const validation = validateBirthday(value);
        error = validation.error || "";
      }
    } else if (field === "gender") {
      const validation = validateGender(value);
      error = validation.error || "";
    }

    setFormErrors(prev => ({ ...prev, [field]: error }));
    return error === "";
  };

  const checkUsernameExists = async (username: string) => {
    if (!username || username === currentUser?.username) return false;
    try {
      const users = await userService.searchUserByUsername(username);
      return users && users.length > 0;
    } catch {
      return false;
    }
  };

  const validateUsernameAsync = async (value: string) => {
    const basicValidation = validateUsername(value);
    if (!basicValidation.isValid) {
      setFormErrors(prev => ({ ...prev, username: basicValidation.error || "" }));
      return false;
    }

    // Skip async check if username didn't change
    if (value === currentUser?.username) {
      setFormErrors(prev => ({ ...prev, username: "" }));
      return true;
    }

    const exists = await checkUsernameExists(value);
    if (exists) {
      const dupError = "Tên người dùng này đã tồn tại";
      setFormErrors(prev => ({ ...prev, username: dupError }));
      return false;
    }

    setFormErrors(prev => ({ ...prev, username: "" }));
    return true;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setMessage({ type: 'error', text: "Vui lòng chọn file ảnh (JPG, PNG, WEBP)" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: "Kích thước file không được vượt quá 5MB" });
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewAvatar(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadAvatar = async () => {
    if (!selectedFile || !currentUser) return;

    setUploading(true);
    try {
      const extension = selectedFile.name.split(".").pop() || "jpg";
      const uploadUrl = await userService.updateUploadAvatarUrl("users", extension);

      await axios.put(uploadUrl, selectedFile, {
        headers: { "Content-Type": selectedFile.type },
      });

      // Just reset state, don't reload
      setSelectedFile(null);
      setPreviewAvatar("");
    } catch (error: any) {
      console.error("Upload avatar error:", error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    // Validate all fields (sync validations are instant)
    const nameValid = validateField("name", formData.name);
    const birthdayValid = formData.birthday ? validateField("birthday", formData.birthday) : true;
    const genderValid = validateField("gender", formData.gender);

    if (!nameValid || !birthdayValid || !genderValid) {
      setMessage({ type: 'error', text: "Vui lòng kiểm tra thông tin form" });
      return;
    }

    // Skip async username check if it didn't change
    const usernameChanged = formData.username !== currentUser.username;
    if (usernameChanged) {
      const usernameValid = await validateUsernameAsync(formData.username);
      if (!usernameValid) {
        setMessage({ type: 'error', text: "Tên người dùng không hợp lệ" });
        return;
      }
    }

    // Disable button immediately
    setLoading(true);
    setMessage({ type: 'loading', text: "Đang lưu thông tin..." });

    try {
      const updateData = {
        name: formData.name,
        username: formData.username,
        bio: formData.bio,
        birthday: formData.birthday,
        gender: formData.gender,
      };

      // Parallelize: upload avatar and update profile simultaneously
      const uploadPromise = selectedFile ? handleUploadAvatar() : Promise.resolve();
      const updatePromise = userService.updateUser(currentUser.id, updateData);

      await Promise.all([uploadPromise, updatePromise]);

      setMessage({ type: 'success', text: "Cập nhật hồ sơ thành công!" });

      // Optimistic navigation - don't wait for getCurrentUser
      setTimeout(() => {
        navigate(`/profile/${currentUser.username}`);
      }, 800);
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage({ type: 'error', text: "Không thể cập nhật hồ sơ. Vui lòng thử lại." });
      setLoading(false);
    }
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#000]">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-[#262626] sticky top-0 bg-white dark:bg-[#000] z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center">
          <Link
            to={`/profile/${currentUser.username}`}
            className="mr-4 hover:opacity-70"
          >
            <ArrowLeft size={24} className="dark:text-white" />
          </Link>
          <h1 className="text-xl font-semibold dark:text-white">
            Chỉnh sửa hồ sơ
          </h1>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`border-b ${
          message.type === 'error' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' :
          message.type === 'success' ? 'border-green-500 bg-green-50 dark:bg-green-900/20' :
          'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
        }`}>
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2">
            {message.type === 'loading' && <Loader2 className="animate-spin" size={18} />}
            {message.type === 'error' && <AlertCircle size={18} className="text-red-500" />}
            <span className={
              message.type === 'error' ? 'text-red-800 dark:text-red-200' :
              message.type === 'success' ? 'text-green-800 dark:text-green-200' :
              'text-blue-800 dark:text-blue-200'
            }>
              {message.text}
            </span>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center gap-6 bg-gray-50 dark:bg-[#121212] rounded-2xl p-6">
            <div className="flex-shrink-0 relative">
              <img
                src={previewAvatar.startsWith('data:') ? previewAvatar : buildS3Url(previewAvatar)}
                alt="avatar"
                className="w-20 h-20 rounded-full object-cover"
              />
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full">
                  <Loader2 className="animate-spin text-white" size={24} />
                </div>
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold dark:text-white text-base">
                {currentUser.username}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {formData.name || currentUser.name}
              </p>
              {selectedFile && (
                <p className="text-xs text-blue-500 mt-1">
                  {selectedFile.name} đã chọn
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Upload size={16} />
                Chọn ảnh
              </button>
              
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-semibold mb-2 dark:text-white">
              Họ và tên
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, name: e.target.value }));
                validateField("name", e.target.value);
              }}
              className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-[#121212] dark:text-white focus:outline-none focus:ring-2 ${
                formErrors.name
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-[#262626] focus:ring-blue-500'
              }`}
              placeholder="Nhập họ tên"
              autoComplete="off"
            />
            {formErrors.name && (
              <p className="text-red-500 text-sm mt-1">{formErrors.name}</p>
            )}
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-semibold mb-2 dark:text-white">
              Tên người dùng
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, username: e.target.value }));
                validateField("username", e.target.value);
              }}
              className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-[#121212] dark:text-white focus:outline-none focus:ring-2 ${
                formErrors.username
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-[#262626] focus:ring-blue-500'
              }`}
              placeholder="@username"
              autoComplete="off"
            />
            {formErrors.username && (
              <p className="text-red-500 text-sm mt-1">{formErrors.username}</p>
            )}
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-semibold mb-2 dark:text-white">
              Tiểu sử
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, bio: e.target.value }));
              }}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 dark:border-[#262626] rounded-lg bg-white dark:bg-[#121212] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Giới thiệu bản thân..."
              autoComplete="off"
            />
          </div>

          {/* Birthday */}
          <div>
            <label className="block text-sm font-semibold mb-2 dark:text-white">
              Ngày sinh
            </label>
            <input
              type="text"
              value={formData.birthday}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, birthday: e.target.value }));
                if (e.target.value) validateField("birthday", e.target.value);
              }}
              className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-[#121212] dark:text-white focus:outline-none focus:ring-2 ${
                formErrors.birthday
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-[#262626] focus:ring-blue-500'
              }`}
              placeholder="DD/MM/YYYY"
              autoComplete="off"
            />
            {formErrors.birthday && (
              <p className="text-red-500 text-sm mt-1">{formErrors.birthday}</p>
            )}
          </div>

          {/* Gender */}
          <div>
            <label className="block text-sm font-semibold mb-2 dark:text-white">
              Giới tính
            </label>
            <div className="flex gap-3">
              {(['MALE', 'FEMALE', 'OTHER'] as const).map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, gender: option }));
                    validateField("gender", option);
                  }}
                  className={`flex-1 px-4 py-3 border-2 rounded-lg font-semibold transition-colors ${
                    formData.gender === option
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300'
                      : 'border-gray-300 dark:border-[#262626] bg-white dark:bg-[#121212] text-gray-700 dark:text-gray-300 hover:border-gray-400'
                  }`}
                >
                  {option === 'MALE' ? 'Nam' : option === 'FEMALE' ? 'Nữ' : 'Khác'}
                </button>
              ))}
            </div>
            {formErrors.gender && (
              <p className="text-red-500 text-sm mt-1">{formErrors.gender}</p>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={loading || uploading}
              className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg font-semibold transition-colors"
            >
              {loading ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
