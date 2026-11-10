export interface KbSource {
    articleId: string;
    title: string;
    isFaq: boolean;
}

export interface AutoMateStreamEvent {
    type: 'text_delta' | 'tool_use' | 'status' | 'done' | 'error';
    text?: string;
    toolName?: string;
    error?: string;
    /** Set on errors the chat shows differently, e.g. `not_connected`. */
    code?: string;
    sources?: KbSource[] | null;
}

export interface AutoMateChatRequest {
    messages: {role: string; content: string}[];
    pageContext?: string;
}

export interface SuggestedPrompt {
    label: string;
    prompt: string;
}
