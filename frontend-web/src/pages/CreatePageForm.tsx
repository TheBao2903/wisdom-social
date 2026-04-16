import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Upload, X, Globe, Lock } from "lucide-react";
import pageService from "../services/pageService";
import { useCurrentUser } from "../hooks/useCurrentUser";

const CATEGORIES = [
    "Kinh doanh",
    "Giải trí",
    "Thể thao",
    "Giáo dục",
    "Công nghệ",
    "Âm nhạc",
    "Nghệ thuật",
    "Ẩm thực",
    "Du lịch",
    "Sức khỏe",
    "Thời trang",
    "Khác",
];

export default function CreatePage() {
    const navigate = useNavigate();
    const currentUser = useCurrentUser();
    const [loading, setLoading] = useState(false);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);

    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    
    const [formData, setFormData] = useState({
        name: "",
        username: "",
        category: "",
        description: "",
        phone: "",
        email: "",
        website: "",
        address: "",
        status: "PUBLIC" as "PUBLIC" | "PRIVATE",
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Clear error when user types
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: "" }));
        }
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setCoverFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setCoverPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const removeAvatar = () => {
        setAvatarFile(null);
        setAvatarPreview(null);
    };

    const removeCover = () => {
        setCoverFile(null);
        setCoverPreview(null);
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};
        
        if (!formData.name.trim()) {
            newErrors.name = "Tên page là bắt buộc";
        }
        if (!formData.username.trim()) {
            newErrors.username = "Username là bắt buộc";
        } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
            newErrors.username = "Username chỉ chứa chữ cái, số và dấu gạch dưới";
        }
        if (!formData.category) {
            newErrors.category = "Vui lòng chọn danh mục";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validate()) return;
        if (!currentUser?.id) {
            alert("Vui lòng đăng nhập để tạo page");
            return;
        }

        setLoading(true);
        try {
            let avatarUrl = "";
            let coverUrl = "";

            // Upload avatar if selected
            if (avatarFile) {
                const extension = avatarFile.name.split('.').pop() || 'jpg';
                const { uploadUrl, uuid } = await pageService.generateUploadUrl('pages', extension);

                // Upload to S3
                await fetch(uploadUrl, {
                    method: 'PUT',
                    body: avatarFile,
                    headers: {
                        'Content-Type': avatarFile.type,
                    },
                });

                // Store only uuid.extension (backend will construct full path)
                avatarUrl = uuid + '.' + extension;
            }

            // Upload cover if selected
            if (coverFile) {
                const extension = coverFile.name.split('.').pop() || 'jpg';
                const { uploadUrl, uuid } = await pageService.generateUploadUrl('pages', extension);

                // Upload to S3
                await fetch(uploadUrl, {
                    method: 'PUT',
                    body: coverFile,
                    headers: {
                        'Content-Type': coverFile.type,
                    },
                });

                // Store only uuid.extension (backend will construct full path)
                coverUrl = uuid + '.' + extension;
            }

            // Create page
            await pageService.createPage({
                name: formData.name,
                username: formData.username,
                category: formData.category,
                description: formData.description || undefined,
                phone: formData.phone || undefined,
                email: formData.email || undefined,
                website: formData.website || undefined,
                address: formData.address || undefined,
                avatarUrl: avatarUrl || undefined,
                coverUrl: coverUrl || undefined,
                status: formData.status,
            });

            alert("Tạo page thành công!");
            navigate("/pages");
        } catch (error: any) {
            console.error("Error creating page:", error);
            alert(error.response?.data?.message || "Không thể tạo page. Vui lòng thử lại.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto p-4 md:p-6">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-[#363636] rounded-full transition-colors"
                >
                    <ArrowLeft size={24} className="dark:text-white" />
                </button>
                <h1 className="text-2xl font-bold dark:text-white">Tạo Page mới</h1>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Cover Upload */}
                <div>
                    <label className="block text-sm font-medium dark:text-white mb-2">
                        Ảnh bìa
                    </label>
                    <div className="relative h-32 bg-gray-100 dark:bg-[#363636] rounded-xl overflow-hidden">
                        {coverPreview ? (
                            <img
                                src={coverPreview}
                                alt="Cover preview"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <span className="text-gray-400">Chưa có ảnh bìa</span>
                            </div>
                        )}
                        <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                            <Upload className="text-white" size={32} />
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleCoverChange}
                                className="hidden"
                            />
                        </label>
                        {coverPreview && (
                            <button
                                type="button"
                                onClick={removeCover}
                                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Avatar Upload */}
                <div className="flex flex-col items-center">
                    <div className="relative">
                        {avatarPreview ? (
                            <div className="relative">
                                <img
                                    src={avatarPreview}
                                    alt="Avatar preview"
                                    className="w-24 h-24 rounded-xl object-cover"
                                />
                                <button
                                    type="button"
                                    onClick={removeAvatar}
                                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <label className="flex flex-col items-center justify-center w-24 h-24 bg-gray-100 dark:bg-[#363636] rounded-xl cursor-pointer hover:bg-gray-200 dark:hover:bg-[#454545] transition-colors">
                                <Upload size={24} className="text-gray-400" />
                                <span className="text-xs text-gray-400 mt-1">Avatar</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleAvatarChange}
                                    className="hidden"
                                />
                            </label>
                        )}
                    </div>
                </div>

                {/* Name */}
                <div>
                    <label className="block text-sm font-medium dark:text-white mb-2">
                        Tên Page <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Nhập tên page"
                        className={`w-full px-4 py-3 bg-gray-100 dark:bg-[#262626] rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white ${
                            errors.name ? "ring-2 ring-red-500" : ""
                        }`}
                    />
                    {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                </div>

                {/* Username */}
                <div>
                    <label className="block text-sm font-medium dark:text-white mb-2">
                        Username <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center">
                        <span className="px-3 py-3 bg-gray-200 dark:bg-[#363636] text-gray-500 rounded-l-lg">@</span>
                        <input
                            type="text"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            placeholder="username"
                            className={`flex-1 px-4 py-3 bg-gray-100 dark:bg-[#262626] rounded-r-lg focus:ring-2 focus:ring-blue-500 dark:text-white ${
                                errors.username ? "ring-2 ring-red-500" : ""
                            }`}
                        />
                    </div>
                    {errors.username && <p className="text-red-500 text-sm mt-1">{errors.username}</p>}
                </div>

                {/* Category */}
                <div>
                    <label className="block text-sm font-medium dark:text-white mb-2">
                        Danh mục <span className="text-red-500">*</span>
                    </label>
                    <select
                        name="category"
                        value={formData.category}
                        onChange={handleChange}
                        className={`w-full px-4 py-3 bg-gray-100 dark:bg-[#262626] rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white ${
                            errors.category ? "ring-2 ring-red-500" : ""
                        }`}
                    >
                        <option value="">Chọn danh mục</option>
                        {CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                    {errors.category && <p className="text-red-500 text-sm mt-1">{errors.category}</p>}
                </div>

                {/* Privacy Status */}
                <div>
                    <label className="block text-sm font-medium dark:text-white mb-2">
                        Quyền riêng tư <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, status: "PUBLIC" }))}
                            className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                                formData.status === "PUBLIC"
                                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                                    : "border-gray-200 dark:border-[#363636] hover:border-gray-300 dark:hover:border-[#454545]"
                            }`}
                        >
                            <Globe size={20} />
                            <div className="text-left">
                                <div className="font-medium dark:text-white">Công khai</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Ai cũng có thể tham gia</div>
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, status: "PRIVATE" }))}
                            className={`flex-1 flex items-center justify-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                                formData.status === "PRIVATE"
                                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                                    : "border-gray-200 dark:border-[#363636] hover:border-gray-300 dark:hover:border-[#454545]"
                            }`}
                        >
                            <Lock size={20} />
                            <div className="text-left">
                                <div className="font-medium dark:text-white">Riêng tư</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Cần duyệt để tham gia</div>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Description */}
                <div>
                    <label className="block text-sm font-medium dark:text-white mb-2">
                        Mô tả
                    </label>
                    <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        placeholder="Mô tả về page của bạn..."
                        rows={4}
                        className="w-full px-4 py-3 bg-gray-100 dark:bg-[#262626] rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white resize-none"
                    />
                </div>

                {/* Contact Info */}
                <div className="border-t border-gray-200 dark:border-[#363636] pt-6">
                    <h3 className="text-lg font-medium dark:text-white mb-4">Thông tin liên hệ (tùy chọn)</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium dark:text-white mb-2">
                                Số điện thoại
                            </label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                placeholder="0123 456 789"
                                className="w-full px-4 py-3 bg-gray-100 dark:bg-[#262626] rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium dark:text-white mb-2">
                                Email
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="contact@example.com"
                                className="w-full px-4 py-3 bg-gray-100 dark:bg-[#262626] rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium dark:text-white mb-2">
                                Website
                            </label>
                            <input
                                type="url"
                                name="website"
                                value={formData.website}
                                onChange={handleChange}
                                placeholder="https://example.com"
                                className="w-full px-4 py-3 bg-gray-100 dark:bg-[#262626] rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium dark:text-white mb-2">
                                Địa chỉ
                            </label>
                            <input
                                type="text"
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                placeholder="123 Đường ABC, Quận XYZ"
                                className="w-full px-4 py-3 bg-gray-100 dark:bg-[#262626] rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                            />
                        </div>
                    </div>
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <>
                            <Loader2 className="animate-spin" size={20} />
                            Đang tạo...
                        </>
                    ) : (
                        "Tạo Page"
                    )}
                </button>
            </form>
        </div>
    );
}
