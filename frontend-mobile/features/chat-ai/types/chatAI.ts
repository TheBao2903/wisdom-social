export interface ConfirmAIRequest {
    confirmUseAI: boolean;
}

export interface ConfirmAIResponse {
    confirmUseAI: boolean;
}

export interface MessagePreviewDTO {
    senderRole: "me" | "other";
    content: string;
    createdAt?: string;
}

export interface AISummarizeRequest {
    conversationId: number;
    limit?: number;
    messages?: MessagePreviewDTO[];
}

export interface AISummarizeResponse {
    conversationId: number;
    summary: string;
    generatedAt: string;
}

export interface AISuggestionRequest {
    conversationId: number;
    limit?: number;
    suggestionCount?: 2 | 3;
    messages?: MessagePreviewDTO[];
}

export interface AISuggestionResponse {
    conversationId: number;
    suggestions: string[];
    generatedAt: string;
}
