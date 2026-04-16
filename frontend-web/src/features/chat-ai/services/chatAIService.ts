import axiosClient from "../../../api/axiosClient";
import type { ApiResponse } from "../../../types";
import type {
    AISuggestionRequest,
    AISuggestionResponse,
    AISummarizeRequest,
    AISummarizeResponse,
    ConfirmAIRequest,
    ConfirmAIResponse,
} from "../types/chatAI";

const chatAIService = {
    async getConsentStatus(): Promise<ConfirmAIResponse> {
        const response = await axiosClient.get<ApiResponse<ConfirmAIResponse>>(
            "/users/me/confirm-ai",
        );
        if (!response.data.success || !response.data.data) {
            throw new Error(response.data.message || "Không thể lấy trạng thái AI");
        }
        return response.data.data;
    },

    async updateConsentStatus(
        request: ConfirmAIRequest,
    ): Promise<ConfirmAIResponse> {
        const response = await axiosClient.patch<ApiResponse<ConfirmAIResponse>>(
            "/users/me/confirm-ai",
            request,
        );
        if (!response.data.success || !response.data.data) {
            throw new Error(response.data.message || "Không thể cập nhật trạng thái AI");
        }
        return response.data.data;
    },

    async summarizeConversation(
        request: AISummarizeRequest,
    ): Promise<AISummarizeResponse> {
        const response = await axiosClient.post<ApiResponse<AISummarizeResponse>>(
            "/ai/summarize",
            request,
        );
        if (!response.data.success || !response.data.data) {
            throw new Error(response.data.message || "Không thể tóm tắt hội thoại");
        }
        return response.data.data;
    },

    async suggestReplies(
        request: AISuggestionRequest,
    ): Promise<AISuggestionResponse> {
        const response = await axiosClient.post<ApiResponse<AISuggestionResponse>>(
            "/ai/suggestions",
            request,
        );
        if (!response.data.success || !response.data.data) {
            throw new Error(response.data.message || "Không thể lấy gợi ý trả lời");
        }
        return response.data.data;
    },
};

export default chatAIService;
