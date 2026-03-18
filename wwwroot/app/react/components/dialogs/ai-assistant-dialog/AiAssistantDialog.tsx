/**
 * AI Assistant Dialog
 *
 * Chat interface for the AI dispatch assistant.
 * Supports streaming responses and suggested prompts.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AssistantIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import ClearIcon from '@mui/icons-material/DeleteSweep';
import SendIcon from '@mui/icons-material/Send';
import StopIcon from '@mui/icons-material/Stop';
import { AiAssistantDialogProps, AiMessage, SUGGESTED_PROMPTS } from './types';
import { useAiAssistant } from './useAiAssistant';

/** Must match AiInputGuard.cs constants */
const MAX_MESSAGE_LENGTH = 2000;
const MAX_CONVERSATION_MESSAGES = 40;

/** Lightweight markdown-ish rendering: bold, inline code, and line breaks */
function renderMessageContent(content: string): React.ReactNode {
    if (!content) return null;

    const lines = content.split('\n');
    return lines.map((line, lineIdx) => {
        // Process inline formatting
        const parts: React.ReactNode[] = [];
        let remaining = line;
        let partKey = 0;

        while (remaining.length > 0) {
            // Bold: **text**
            const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
            // Inline code: `text`
            const codeMatch = remaining.match(/`(.+?)`/);

            const firstMatch = [boldMatch, codeMatch]
                .filter(Boolean)
                .sort((a, b) => (a!.index ?? 0) - (b!.index ?? 0))[0];

            if (!firstMatch || firstMatch.index === undefined) {
                parts.push(<span key={partKey}>{remaining}</span>);
                break;
            }

            // Text before the match
            if (firstMatch.index > 0) {
                parts.push(<span key={partKey++}>{remaining.slice(0, firstMatch.index)}</span>);
            }

            if (firstMatch === boldMatch) {
                parts.push(<strong key={partKey++}>{firstMatch[1]}</strong>);
            } else {
                parts.push(
                    <code
                        key={partKey++}
                        style={{
                            backgroundColor: 'rgba(0,0,0,0.06)',
                            padding: '1px 4px',
                            borderRadius: 3,
                            fontSize: '0.85em',
                        }}
                    >
                        {firstMatch[1]}
                    </code>
                );
            }

            remaining = remaining.slice(firstMatch.index + firstMatch[0].length);
        }

        return (
            <React.Fragment key={lineIdx}>
                {parts}
                {lineIdx < lines.length - 1 && <br />}
            </React.Fragment>
        );
    });
}

/** Streaming dots indicator */
const StreamingIndicator: React.FC = () => (
    <Box sx={{ display: 'inline-flex', gap: 0.5, ml: 0.5, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
            <Box
                key={i}
                sx={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    bgcolor: 'info.main',
                    animation: 'pulse 1.2s ease-in-out infinite',
                    animationDelay: `${i * 0.2}s`,
                    '@keyframes pulse': {
                        '0%, 80%, 100%': { opacity: 0.3, transform: 'scale(0.8)' },
                        '40%': { opacity: 1, transform: 'scale(1)' },
                    },
                }}
            />
        ))}
    </Box>
);

/** Individual chat message bubble */
const MessageBubble: React.FC<{ message: AiMessage }> = React.memo(({ message }) => {
    const isUser = message.role === 'user';

    return (
        <Box
            sx={{
                display: 'flex',
                justifyContent: isUser ? 'flex-end' : 'flex-start',
                mb: 1.5,
                px: 1,
            }}
        >
            <Paper
                elevation={0}
                sx={{
                    maxWidth: '80%',
                    px: 2,
                    py: 1.25,
                    borderRadius: 2,
                    bgcolor: isUser ? 'info.lighter' : 'grey.100',
                    border: '1px solid',
                    borderColor: isUser ? 'info.light' : 'divider',
                }}
            >
                <Typography
                    variant="body2"
                    sx={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        lineHeight: 1.6,
                        '& ul, & ol': { pl: 2, my: 0.5 },
                    }}
                >
                    {renderMessageContent(message.content)}
                    {message.isStreaming && !message.content && <StreamingIndicator />}
                    {message.isStreaming && message.content && <StreamingIndicator />}
                </Typography>
            </Paper>
        </Box>
    );
});

/** Empty state with suggested prompts */
const EmptyState: React.FC<{ onSelectPrompt: (prompt: string) => void }> = React.memo(({ onSelectPrompt }) => (
    <Box
        sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 2,
            px: 3,
        }}
    >
        <AssistantIcon sx={{ fontSize: 48, color: 'info.main', opacity: 0.7 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400 }}>
                Dispatch Assistant
            </Typography>
            <Chip
                label="BETA"
                size="small"
                sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    bgcolor: 'info.main',
                    color: 'info.contrastText',
                    letterSpacing: '0.05em',
                }}
            />
        </Box>
        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ maxWidth: 360 }}>
            Ask questions about jobs, couriers, and operations. I can look up data and provide summaries.
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1, justifyContent: 'center' }}>
            {SUGGESTED_PROMPTS.map((prompt, i) => (
                <Chip
                    key={i}
                    label={prompt}
                    variant="outlined"
                    size="small"
                    onClick={() => onSelectPrompt(prompt)}
                    sx={{
                        cursor: 'pointer',
                        borderColor: 'info.light',
                        color: 'info.dark',
                        '&:hover': {
                            bgcolor: 'info.lighter',
                            borderColor: 'info.main',
                        },
                    }}
                />
            ))}
        </Box>
    </Box>
));

export const AiAssistantDialog: React.FC<AiAssistantDialogProps> = ({
    open,
    onClose,
    showToast}) => {
    const { messages, isLoading, sendMessage, clearConversation, cancelResponse } = useAiAssistant();
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input when dialog opens
    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [open]);

    const isConversationFull = messages.length >= MAX_CONVERSATION_MESSAGES;

    const handleSend = useCallback(async () => {
        if (!inputValue.trim() || isLoading || isConversationFull) return;
        if (inputValue.trim().length > MAX_MESSAGE_LENGTH) {
            showToast(`Message too long (max ${MAX_MESSAGE_LENGTH} characters)`, 'warning');
            return;
        }
        const value = inputValue;
        setInputValue('');
       await  sendMessage(value);
    }, [inputValue, isLoading, isConversationFull, sendMessage, showToast]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                return handleSend();
            }
        },
        [handleSend]
    );

    const handleSelectPrompt = useCallback(
        (prompt: string) => {
            setInputValue(prompt);
            setTimeout(() => inputRef.current?.focus(), 50);
        },
        []
    );

    const handleClear = useCallback(() => {
        clearConversation();
        showToast('Conversation cleared', 'success');
    }, [clearConversation, showToast]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            slotProps={{
                paper: {
                    sx: {
                        height: '70vh',
                        maxHeight: 640,
                        display: 'flex',
                        flexDirection: 'column',
                    },
                },
            }}
        >
            {/* Header */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 2.5,
                    py: 1.5,
                    bgcolor: 'info.main',
                    color: 'info.contrastText',
                }}
            >
                <AssistantIcon sx={{ fontSize: 22 }} />
                <Typography variant="h6" sx={{ flex: 1, fontSize: '1.05rem', fontWeight: 500 }}>
                    AI Assistant
                </Typography>
                <Chip
                    label="BETA"
                    size="small"
                    sx={{
                        height: 20,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        bgcolor: 'rgba(255,255,255,0.2)',
                        color: 'inherit',
                        letterSpacing: '0.05em',
                    }}
                />
                {messages.length > 0 && (
                    <Tooltip title="Clear conversation">
                        <IconButton
                            size="small"
                            onClick={handleClear}
                            sx={{ color: 'inherit', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}
                        >
                            <ClearIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                )}
                <Tooltip title="Close">
                    <IconButton
                        size="small"
                        onClick={onClose}
                        sx={{ color: 'inherit', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}
                    >
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Messages area */}
            <DialogContent
                sx={{
                    flex: 1,
                    overflow: 'auto',
                    p: 1.5,
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {messages.length === 0 ? (
                    <EmptyState onSelectPrompt={handleSelectPrompt} />
                ) : (
                    <>
                        {messages.map(msg => (
                            <MessageBubble key={msg.id} message={msg} />
                        ))}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </DialogContent>

            <Divider />

            {/* Input area */}
            <Box sx={{ p: 1.5, display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                <TextField
                    inputRef={inputRef}
                    fullWidth
                    size="small"
                    placeholder={
                        isConversationFull
                            ? 'Conversation limit reached. Please clear and start a new conversation.'
                            : 'Ask about jobs, couriers, or operations...'
                    }
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                    onKeyDown={handleKeyDown}
                    multiline
                    maxRows={3}
                    disabled={isLoading || isConversationFull}
                    slotProps={{
                        input: {
                            endAdornment: (
                                <InputAdornment position="end">
                                    {isLoading ? (
                                        <Tooltip title="Stop generating">
                                            <IconButton
                                                size="small"
                                                onClick={cancelResponse}
                                                color="error"
                                            >
                                                <StopIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    ) : (
                                        <Tooltip title="Send (Enter)">
                                            <span>
                                                <IconButton
                                                    size="small"
                                                    onClick={handleSend}
                                                    disabled={!inputValue.trim()}
                                                    color="info"
                                                >
                                                    <SendIcon fontSize="small" />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                    )}
                                </InputAdornment>
                            ),
                        },
                    }}
                />
            </Box>
        </Dialog>
    );
};

export default AiAssistantDialog;
