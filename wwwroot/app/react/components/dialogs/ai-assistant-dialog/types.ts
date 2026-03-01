/**
 * AI Assistant Dialog Types
 */

export interface AiMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    isStreaming?: boolean;
}

export interface AiAssistantDialogProps {
    open: boolean;
    onClose: () => void;
    showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
    currentStaffName: string;
}

export interface OpenAiAssistantDialogOptions {
    toastService?: {
        showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
    };
}

export const SUGGESTED_PROMPTS = [
    'What jobs are currently open?',
    'Show today\'s active couriers',
    'Get overview stats for today',
    'Summarize notes for job ',
] as const;
