import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Upload, X, Save, Globe, Lock, ShieldAlert } from "lucide-react";
import pageService, { type Page } from "../services/pageService";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { buildS3Url } from "../utils/s3";

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

export default function EditPage() {
    const { pageId } = useParams();
    const navigate = useNavigate();
    const currentUser = useCurrentUser();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [page, setPage] = useState<Page | null>(null);
    const [accessDenied, setAccessDenied] = useState(false);

    // Avatar
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    
    // Cover
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

    const loadPage = useCallback(async () => {
        if (!pageId || !currentUser?.id) return;

        setLoading(true);
        try {
            const data = await pageService.getPageById(Number(pageId));

            // Check if current user is owner - support both userId and createdBy.id
            const currentUserId = Number(currentUser.id);
            const pageOwnerId = data.createdBy?.id 
                ? Number(data.createdBy.id) 
                : (data.userId ? Number(data.userId) : null);
            
            if (pageOwnerId !== currentUserId) {
                setAccessDenied(true);
                setLoading(false);
                return;
            }

            setPage(data);
            setFormData({
                name: data.name || "",
                username: data.username || "",
                category: data.category || "",
                description: data.description || "",
                phone: data.phone || "",
                email: data.email || "",
                website: data.website || "",
                address: data.address || "",
                status: (data.status as "PUBLIC" | "PRIVATE") || "PUBLIC",
            });
            if (data.avatarUrl) {
                setAvatarPreview(buildS3Url(data.avatarUrl) || data.avatarUrl);
            }
            if (data.coverUrl) {
                setCoverPreview(buildS3Url(data.coverUrl) || data.coverUrl);
            }
        } catch (error) {
            console.error("Error loading page:", error);
        } finally {
            setLoading(false);
        }
    }, [pageId, currentUser?.id]);

    useEffect(() => {
        loadPage();
    }, [loadPage]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
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

        if (!validate() || !pageId) return;

        setSaving(true);
        try {
            // Upload new avatar if selected
            if (avatarFile) {
                const extension = avatarFile.name.split('.').pop() || 'jpg';
                const uploadUrl = await pageService.getUploadAvatarUrl('pages', Number(pageId), extension);

                await fetch(uploadUrl, {
                    method: 'PUT',
                    body: avatarFile,
                    headers: {
                        'Content-Type': avatarFile.type,
                    },
                });
            }

            // Upload new cover if selected
            if (coverFile) {
                const extension = coverFile.name.split('.').pop() || 'jpg';
                const uploadUrl = await pageService.getUploadCoverUrl('pages', Number(pageId), extension);

                await fetch(uploadUrl, {
                    method: 'PUT',
                    body: coverFile,
                    headers: {
                        'Content-Type': coverFile.type,
                    },
                });
            }

            // Update page info (images already updated by backend when we called getUploadAvatarUrl/getUploadCoverUrl)
            await pageService.updatePage(Number(pageId), {
                name: formData.name,
                username: formData.username,
                category: formData.category,
                description: formData.description || undefined,
                phone: formData.phone || undefined,
                email: formData.email || undefined,
                website: formData.website || undefined,
                address: formData.address || undefined,
                status: formData.status,
            });

            alert("Cập nhật page thành công!");
            navigate(`/pages/${pageId}`);
        } catch (error: any) {
            console.error("Error updating page:", error);
            alert(error.response?.data?.message || "Không thể cập nhật page. Vui lòng thử lại.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="animate-spin text-blue-500" size={40} />
            </div>
        );
    }

    // Access denied view
    if (accessDenied) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <ShieldAlert size={64} className="text-red-500 mb-4" />
                <h2 className="text-xl font-semibold dark:text-white mb-2">Không có quyền truy cập</h2>
                <p className="text-gray-500 dark:text-gray-400 mb-4 text-center">
                    Chỉ chủ sở hữu page mới có thể chỉnh sửa thông tin
                </p>
                <button
                    onClick={() => navigate(`/pages/${pageId}`)}
                    className="text-blue-500 hover:underline"
                >
                    Quay lại trang page
                </button>
            </div>
        );
    }

    if (!page) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <p className="text-gray-500 dark:text-gray-400 mb-4">Page không tồn tại</p>
                <button onClick={() => navigate("/pages")} className="text-blue-500 hover:underline">
                    Quay lại danh sách
                </button>
            </div>
        );
    }

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
                <h1 className="text-2xl font-bold dark:text-white">Chỉnh sửa Page</h1>
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
                    </div>
                </div>

                {/* Avatar Upload */}
                <div className="flex flex-col items-center">
                    <label className="block text-sm font-medium dark:text-white mb-2">
                        Avatar
                    </label>
                    <div className="relative">
                        {avatarPreview ? (
                            <div className="relative">
                                <img
                                    src={avatarPreview}
                                    alt="Avatar preview"
                                    className="w-24 h-24 rounded-xl object-cover"
                                />
                                <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                                    <Upload className="text-white" size={24} />
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleAvatarChange}
                                        className="hidden"
                                    />
                                </label>
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
                    <h3 className="text-lg font-medium dark:text-white mb-4">Thông tin liên hệ</h3>
                    
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
                    disabled={saving}
                    className="w-full py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {saving ? (
                        <>
                            <Loader2 className="animate-spin" size={20} />
                            Đang lưu...
                        </>
                    ) : (
                        <>
                            <Save size={20} />
                            Lưu thay đổi
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}
