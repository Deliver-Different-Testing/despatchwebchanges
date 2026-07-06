/**
 * React Messaging Dialogue
 *
 * A modern replacement for the AngularJS messaging-dialog using MUI components.
 * Features real-time messaging, conversation list, quick responses, and multi-recipient support.
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {Theme} from '@mui/material/styles';
import {accentPalette, sharedColors} from '../../../theme/muiTheme';
import {headerChromeSx, headerChipSx, headerOnColor} from '../shared/styles';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Avatar from '@mui/material/Avatar';
import Badge from '@mui/material/Badge';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import Checkbox from '@mui/material/Checkbox';
import InputAdornment from '@mui/material/InputAdornment';
import CloseIcon from '@mui/icons-material/Close';
import ChatIcon from '@mui/icons-material/Chat';
import SendIcon from '@mui/icons-material/Send';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddCommentIcon from '@mui/icons-material/AddComment';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import QuickReplyIcon from '@mui/icons-material/QuickreplyOutlined';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import DoneIcon from '@mui/icons-material/Done';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import {
    ChatMessage,
    MessageContactOption,
    MessageDeliveryType,
    MessagingDialogProps,
    OtherMessagePartyType,
    QuickResponse,
    RecentConversation,
    SendMessageRequest,
    SendMultipleMessageRequest,
} from './types';
import {messagingApi} from '../../../services/messagingApi';
import {dayjs, parseDateFromApi} from '../../../utils/dateUtils';
import {AiDraftButton} from '../../common/ai-draft-button/AiDraftButton';
import {useAiDraft} from '../../../hooks/useAiDraft';
import {draftCourierMessage} from '../../../services/aiAssistantApi';
import {
    useAutoRefresh,
    useContactSearch,
    useConversations,
    useMessages,
    useQuickResponses
} from "../../../hooks/useMessaging";

// Static sx values hoisted to module scope. Hot paths inside .map() loops
// (conversations list, messages list) and the message bubble re-create these
// on every render; pinning them avoids redundant emotion cache lookups.
const SX_HEADER_ON = (theme: Theme) => ({color: headerOnColor(theme)});
const SX_FLEX_1 = {flex: 1} as const;
const SX_MR_1 = {mr: 1} as const;
const SX_PRIMARY_AVATAR = {bgcolor: 'primary.main'} as const;
const SX_DIALOG_CONTENT_ROW = {p: 0, display: 'flex', flex: 1, overflow: 'hidden'} as const;
const SX_DIALOG_CONTENT_COL = {
    p: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    flex: 1,
    overflow: 'hidden'
} as const;
const SX_CONV_NAME_ROW = {display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'} as const;
const SX_CONV_NAME_TEXT = {maxWidth: 140} as const;
const SX_CONV_SECONDARY_ROW = {display: 'flex', alignItems: 'center', gap: 1} as const;
const SX_UNREAD_CHIP = {height: 18, fontSize: 11} as const;
const SX_LIST_CONTAINER = {flex: 1, overflow: 'auto', p: 0} as const;
const SX_LOADING_BOX = {display: 'flex', justifyContent: 'center', p: 4} as const;
const SX_LARGE_ICON = {fontSize: 48} as const;
const SX_MSG_BODY = {whiteSpace: 'pre-wrap' as const, wordBreak: 'break-word' as const} as const;
const SX_MSG_META_ROW = {display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, justifyContent: 'flex-end'} as const;
const SX_MSG_TICK_ICON = {fontSize: 14, opacity: 0.8} as const;
const SX_HEADER_SUBTITLE = {opacity: 0.85, mt: 0.25} as const;

export const MessagingDialog: React.FC<MessagingDialogProps> = ({
                                                                    open,
                                                                    onClose,
                                                                    showToast,
                                                                    currentStaffId,
                                                                }) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    // Whether the user is parked at (or near) the bottom of the thread. When
    // they've scrolled up to read history we must NOT yank them back down on
    // the 10s auto-refresh — only follow new messages they're already tracking.
    const isNearBottomRef = useRef(true);
    const prevConversationKeyRef = useRef<string | null>(null);

    const [selectedConversation, setSelectedConversation] = useState<RecentConversation | null>(null);
    const [showNewChatView, setShowNewChatView] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [messageDeliveryType, setMessageDeliveryType] = useState<MessageDeliveryType>(MessageDeliveryType.SmartDelivery);
    const [isSending, setIsSending] = useState(false);
    const [showQuickResponses, setShowQuickResponses] = useState(false);
    const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
    const [selectedContacts, setSelectedContacts] = useState<MessageContactOption[]>([]);

    const {
        conversations,
        isLoading: isConversationsLoading,
        error: conversationsError,
        loadConversations,
        updateConversation,
        addConversation,
    } = useConversations();

    const {
        messages,
        isLoading: isMessagesLoading,
        loadMessages,
        addOptimisticMessage,
        updateMessage,
        clearMessages,
    } = useMessages(currentStaffId);

    const {
        quickResponses,
        loadQuickResponses,
    } = useQuickResponses();

    const {
        searchTerm,
        results: searchResults,
        isSearching,
        search,
        clearSearch,
    } = useContactSearch();

    // Load initial data
    useEffect(() => {
        if (open) {
            loadConversations().then(_ => {
                return loadQuickResponses();
            });
        }
    }, [open, loadConversations, loadQuickResponses]);

    // Auto-refresh conversations every 20 seconds
    useAutoRefresh(
        useCallback(async () => {
            await loadConversations(true);
        }, [loadConversations]),
        20000,
        open && !showNewChatView
    );

    // Auto-refresh messages every 10 seconds when a conversation is selected
    useAutoRefresh(
        useCallback(async () => {
            if (selectedConversation) {
                await loadMessages(
                    selectedConversation.otherPartyId,
                    selectedConversation.otherPartyType,
                    true
                );
            }
        }, [selectedConversation, loadMessages]),
        10000,
        open && !!selectedConversation
    );

    const handleMessagesScroll = useCallback(() => {
        const el = messagesContainerRef.current;
        if (el) {
            isNearBottomRef.current = isNearBottom(el);
        }
    }, []);

    // Follow the conversation as messages change, but respect the reader:
    // jump to the bottom when switching conversations, and on new messages only
    // when the user is already near the bottom or just sent the latest message.
    useEffect(() => {
        const conversationKey = selectedConversation
            ? `${selectedConversation.otherPartyType}-${selectedConversation.otherPartyId}`
            : null;
        const conversationChanged = conversationKey !== prevConversationKeyRef.current;
        prevConversationKeyRef.current = conversationKey;

        if (!messagesEndRef.current) return;

        const lastMessageIsOwn = messages[messages.length - 1]?.isSender === true;

        if (conversationChanged) {
            messagesEndRef.current.scrollIntoView({behavior: 'auto'});
            isNearBottomRef.current = true;
        } else if (isNearBottomRef.current || lastMessageIsOwn) {
            messagesEndRef.current.scrollIntoView({behavior: 'smooth'});
        }
    }, [messages, selectedConversation]);

    const handleSelectConversation = async (conversation: RecentConversation) => {
        if (
            selectedConversation?.otherPartyId === conversation.otherPartyId &&
            selectedConversation?.otherPartyType === conversation.otherPartyType
        ) {
            return;
        }

        setSelectedConversation(conversation);
        clearMessages();
        await loadMessages(conversation.otherPartyId, conversation.otherPartyType);

        // Mark messages as read
        if (conversation.unreadCount > 0) {
            try {
                await messagingApi.markMessagesAsRead(conversation.otherPartyId, conversation.otherPartyType);
                updateConversation(conversation.otherPartyId, conversation.otherPartyType, {unreadCount: 0});
            } catch (err) {
                console.error('Failed to mark messages as read:', err);
            }
        }
    };

    // Core send used by both the composer and the failed-message retry. The
    // bubble appears immediately as 'sending', then resolves to 'sent' or
    // 'failed' so the user can see progress and retry in place.
    const sendMessageContent = useCallback(async (content: string, retryMessageId?: number) => {
        if (!selectedConversation) return;

        const tempId = retryMessageId ?? -Date.now();
        const data: SendMessageRequest = {
            sendToCourierId: selectedConversation.otherPartyType === OtherMessagePartyType.Courier
                ? selectedConversation.otherPartyId : undefined,
            sendToStaffId: selectedConversation.otherPartyType === OtherMessagePartyType.Staff
                ? selectedConversation.otherPartyId : undefined,
            message: content,
            messageType: messageDeliveryType,
        };

        if (retryMessageId !== undefined) {
            updateMessage(tempId, {status: 'sending'});
        } else {
            addOptimisticMessage({
                messageId: tempId,
                sendFromStaffId: currentStaffId,
                sendToCourierId: data.sendToCourierId,
                sendToStaffId: data.sendToStaffId,
                message: content,
                messageTime: dayjs().format('YYYY-MM-DDTHH:mm:ss'),
                read: false,
                sent: false,
                isSender: true,
                status: 'sending',
            });
        }

        try {
            await messagingApi.sendMessage(data);
            updateMessage(tempId, {status: 'sent', sent: true});
            updateConversation(
                selectedConversation.otherPartyId,
                selectedConversation.otherPartyType,
                {
                    lastMessage: content,
                    lastMessageTime: dayjs().format('YYYY-MM-DDTHH:mm:ss'),
                }
            );
            showToast('Message sent', 'success');
        } catch (err) {
            console.error('Failed to send message:', err);
            updateMessage(tempId, {status: 'failed'});
            showToast('Failed to send message', 'error');
        }
    }, [selectedConversation, messageDeliveryType, currentStaffId, addOptimisticMessage, updateMessage, updateConversation, showToast]);

    const handleSendMessage = async () => {
        const content = newMessage.trim();
        if (!content || !selectedConversation || isSending) return;

        setIsSending(true);
        setNewMessage('');
        try {
            await sendMessageContent(content);
        } finally {
            setIsSending(false);
        }
    };

    const handleRetryMessage = useCallback((message: ChatMessage) => {
        void sendMessageContent(message.message, message.messageId);
    }, [sendMessageContent]);

    const handleSendMultiMessage = async () => {
        if (!newMessage.trim() || selectedContacts.length === 0 || isSending) return;

        const messageContent = newMessage.trim();
        setIsSending(true);

        try {
            const courierIds = selectedContacts
                .filter(c => c.otherMessagePartyType === OtherMessagePartyType.Courier)
                .map(c => c.recordId);

            const staffIds = selectedContacts
                .filter(c => c.otherMessagePartyType === OtherMessagePartyType.Staff)
                .map(c => c.recordId);

            const data: SendMultipleMessageRequest = {
                sendToCourierIds: courierIds.length > 0 ? courierIds : undefined,
                sendToStaffIds: staffIds.length > 0 ? staffIds : undefined,
                message: messageContent,
                messageType: messageDeliveryType,
            };

            await messagingApi.sendMultiMessage(data);

            setNewMessage('');
            setSelectedContacts([]);
            setIsMultiSelectMode(false);
            setShowNewChatView(false);

            showToast(`Message sent to ${courierIds.length + staffIds.length} contacts`, 'success');
        } catch (err) {
            console.error('Failed to send multi message:', err);
            showToast('Failed to send message to all contacts', 'error');
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyPress = async (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            await handleSendMessage();
        }
    };

    const handleShowNewChat = () => {
        setShowNewChatView(true);
        clearSearch();
    };

    const handleBackToMessaging = () => {
        setShowNewChatView(false);
        setSelectedContacts([]);
        setIsMultiSelectMode(false);
        clearSearch();
    };

    const handleStartConversationWith = async (contact: MessageContactOption | RecentConversation) => {
        const normalizedContact = normalizeContact(contact);
        const otherPartyId = normalizedContact.recordId;
        const otherPartyName = normalizedContact.name || 'Unknown';
        const otherPartyType = normalizedContact.otherMessagePartyType || OtherMessagePartyType.Courier;

        // Check if conversation already exists
        const existing = conversations.find(
            c => c.otherPartyId === otherPartyId && c.otherPartyType === otherPartyType
        );

        if (existing) {
            await handleSelectConversation(existing);
        } else {
            const newConversation: RecentConversation = {
                otherPartyId,
                otherPartyType,
                otherPartyName,
                otherPartyInitials: generateInitials(otherPartyName),
                otherPartyStatus: normalizedContact.status || 'offline',
                unreadCount: 0,
                lastMessage: '',
                lastMessageTime: dayjs().format('YYYY-MM-DDTHH:mm:ss'),
            };

            addConversation(newConversation);
            await handleSelectConversation(newConversation);
        }

        handleBackToMessaging();
    };

    const handleToggleContactSelection = (contact: MessageContactOption | RecentConversation) => {
        const normalizedContact = normalizeContact(contact);

        const index = selectedContacts.findIndex(
            c => c.recordId === normalizedContact.recordId &&
                c.otherMessagePartyType === normalizedContact.otherMessagePartyType
        );

        if (index > -1) {
            setSelectedContacts(selectedContacts.filter((_, i) => i !== index));
        } else {
            setSelectedContacts([...selectedContacts, normalizedContact]);
        }
    };

    const isContactSelected = (contact: MessageContactOption | RecentConversation): boolean => {
        const normalizedContact = normalizeContact(contact);
        return selectedContacts.some(
            c => c.recordId === normalizedContact.recordId &&
                c.otherMessagePartyType === normalizedContact.otherMessagePartyType
        );
    };

    const handleSelectQuickResponse = (response: QuickResponse) => {
        setNewMessage(response.text);
        setShowQuickResponses(false);
    };

    const {runDraft: runMessageDraft, isDrafting: isMessageDrafting} = useAiDraft();

    const handleDraftMessage = async () => {
        if (!selectedConversation) {
            return;
        }
        const recentMessages = messages
            .slice(-8)
            .map((m) => `${m.isSender ? 'Me' : selectedConversation.otherPartyName}: ${m.message}`);
        const result = await runMessageDraft((signal) =>
            draftCourierMessage(
                {
                    recipientName: selectedConversation.otherPartyName,
                    recipientType: selectedConversation.otherPartyType,
                    messageType: messageDeliveryType,
                    seed: newMessage,
                    recentMessages,
                },
                {signal},
            ),
        );
        if (result) {
            setNewMessage(result.draft);
        }
    };

    const handleMarkConversationRead = useCallback(async (conv: RecentConversation) => {
        try {
            await messagingApi.markMessagesAsRead(conv.otherPartyId, conv.otherPartyType);
            updateConversation(conv.otherPartyId, conv.otherPartyType, {unreadCount: 0});
        } catch (err) {
            console.error('Failed to mark conversation as read:', err);
        }
    }, [updateConversation]);

    const getTotalUnreadCount = (): number => {
        return conversations.reduce((total, conv) => total + conv.unreadCount, 0);
    };

    const recentForNewChat = conversations
        .filter(c => c.lastMessageTime)
        .sort((a, b) => dayjs(b.lastMessageTime).valueOf() - dayjs(a.lastMessageTime).valueOf())
        .slice(0, 5);

    const renderContent = () => {
        // Show New Chat View
        if (showNewChatView) {
            return (
                <>
                    <DialogHeader
                        title="New Conversation"
                        showBackButton
                        onBack={handleBackToMessaging}
                        onClose={onClose}
                    />
                    <NewChatView
                        searchTerm={searchTerm}
                        searchResults={searchResults}
                        isSearching={isSearching}
                        recentConversations={recentForNewChat}
                        isMultiSelectMode={isMultiSelectMode}
                        selectedContacts={selectedContacts}
                        newMessage={newMessage}
                        isSending={isSending}
                        onSearch={search}
                        onClearSearch={clearSearch}
                        onToggleMultiSelect={() => {
                            setIsMultiSelectMode(!isMultiSelectMode);
                            setSelectedContacts([]);
                        }}
                        onToggleContactSelection={handleToggleContactSelection}
                        onStartConversation={handleStartConversationWith}
                        onClearSelectedContacts={() => setSelectedContacts([])}
                        onMessageChange={(value) => setNewMessage(value)}
                        onSendMultiMessage={handleSendMultiMessage}
                        isContactSelected={isContactSelected}
                    />
                </>
            );
        }

        // Show Main Messaging View
        return (
            <>
                <DialogHeader
                    title="Message Center"
                    subtitle="Send and receive messages"
                    onClose={onClose}
                />
                <Box component="section" sx={SX_DIALOG_CONTENT_ROW}>
                    {conversationsError ? (
                        <ErrorState
                            message={conversationsError}
                            onRetry={() => loadConversations()}
                        />
                    ) : (
                        <Box sx={{display: 'flex', flex: 1, minHeight: 0}}>
                            {/* Conversations Panel */}
                            <ConversationsPanel
                                conversations={conversations}
                                selectedConversation={selectedConversation}
                                isLoading={isConversationsLoading}
                                totalUnreadCount={getTotalUnreadCount()}
                                onSelectConversation={handleSelectConversation}
                                onRefresh={() => loadConversations()}
                                onNewChat={handleShowNewChat}
                                onMarkRead={handleMarkConversationRead}
                            />

                            {/* Chat Panel */}
                            <ChatPanel
                                selectedConversation={selectedConversation}
                                messages={messages}
                                isMessagesLoading={isMessagesLoading}
                                newMessage={newMessage}
                                messageDeliveryType={messageDeliveryType}
                                isSending={isSending}
                                showQuickResponses={showQuickResponses}
                                quickResponses={quickResponses}
                                onMessageChange={(value) => setNewMessage(value)}
                                onDeliveryTypeChange={(value) => setMessageDeliveryType(value)}
                                onSendMessage={handleSendMessage}
                                onKeyPress={handleKeyPress}
                                onRefreshMessages={() => selectedConversation && loadMessages(
                                    selectedConversation.otherPartyId,
                                    selectedConversation.otherPartyType
                                )}
                                onToggleQuickResponses={() => setShowQuickResponses(!showQuickResponses)}
                                onSelectQuickResponse={handleSelectQuickResponse}
                                messagesEndRef={messagesEndRef}
                                messagesContainerRef={messagesContainerRef}
                                onMessagesScroll={handleMessagesScroll}
                                onRetryMessage={handleRetryMessage}
                                onDraft={handleDraftMessage}
                                isDrafting={isMessageDrafting}
                            />
                        </Box>
                    )}
                </Box>
            </>
        );
    };

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={(_event, reason) => {
                // Stay open on outside/backdrop click — the Message Center is a
                // working surface, not a quick confirm. Only the X button and
                // Escape dismiss it.
                if (reason === 'backdropClick') return;
                onClose();
            }}
            slotProps={{
                paper: {
                    elevation: 24,
                    sx: {
                        width: {xs: '100%', sm: '90vw'},
                        maxWidth: 1000,
                        minWidth: {sm: 700},
                        height: '100%',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                    },
                },
            }}
        >
            {renderContent()}
        </Drawer>
    );
};

// Helper Components

interface DialogHeaderProps {
    title: string;
    subtitle?: string;
    showBackButton?: boolean;
    onBack?: () => void;
    onClose: () => void;
}

function DialogHeader({title, subtitle, showBackButton, onBack, onClose}: DialogHeaderProps) {
    return (
        <Box
            sx={(theme) => ({
                ...headerChromeSx(theme),
                px: 2,
                gap: 1,
            })}
        >
            {showBackButton && (
                <IconButton onClick={onBack} sx={SX_HEADER_ON} aria-label="Back">
                    <ArrowBackIcon/>
                </IconButton>
            )}
            {!showBackButton && (
                <Box sx={(theme) => headerChipSx(theme, 'primary', 36)}>
                    <ChatIcon/>
                </Box>
            )}
            <Box sx={SX_FLEX_1}>
                <Typography variant="h6" sx={{
                    fontWeight: 600
                }}>
                    {title}
                </Typography>
                {subtitle && (
                    <Typography variant="body2" sx={SX_HEADER_SUBTITLE}>
                        {subtitle}
                    </Typography>
                )}
            </Box>
            <IconButton onClick={onClose} sx={SX_HEADER_ON} aria-label="Close message center">
                <CloseIcon/>
            </IconButton>
        </Box>
    );
}

interface ConversationsPanelProps {
    conversations: RecentConversation[];
    selectedConversation: RecentConversation | null;
    isLoading: boolean;
    totalUnreadCount: number;
    onSelectConversation: (conv: RecentConversation) => void;
    onRefresh: () => void;
    onNewChat: () => void;
    onMarkRead: (conv: RecentConversation) => void;
}

function ConversationsPanel({
                                conversations,
                                selectedConversation,
                                isLoading,
                                totalUnreadCount,
                                onSelectConversation,
                                onRefresh,
                                onNewChat,
                                onMarkRead,
                            }: ConversationsPanelProps) {
    const [filterText, setFilterText] = useState('');
    const [unreadOnly, setUnreadOnly] = useState(false);

    const filteredConversations = useMemo(() => {
        const term = filterText.trim().toLowerCase();
        return conversations.filter((conv) => {
            if (unreadOnly && conv.unreadCount === 0) return false;
            if (term && !conv.otherPartyName.toLowerCase().includes(term)) return false;
            return true;
        });
    }, [conversations, filterText, unreadOnly]);

    return (
        <Box
            sx={{
                width: 320,
                display: 'flex',
                flexDirection: 'column',
                borderRight: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.default',
            }}
        >
            {/* Panel Header */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 1.5,
                    bgcolor: 'background.paper',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                }}
            >
                <Typography variant="subtitle1" sx={{
                    fontWeight: 600
                }}>
                    Conversations
                </Typography>
                {totalUnreadCount > 0 && (
                    <Badge
                        badgeContent={totalUnreadCount}
                        color="error"
                        sx={{ml: 0.5}}
                    />
                )}
                <Box sx={SX_FLEX_1}/>
                <IconButton size="small" onClick={onRefresh} disabled={isLoading} aria-label="Refresh conversations">
                    <RefreshIcon sx={{animation: isLoading ? 'spin 1s linear infinite' : 'none'}}/>
                </IconButton>
                <IconButton size="small" color="primary" onClick={onNewChat} aria-label="New conversation">
                    <AddCommentIcon/>
                </IconButton>
            </Box>
            {/* Filter row */}
            {conversations.length > 0 && (
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 1.5,
                        py: 1,
                        bgcolor: 'background.paper',
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                    }}
                >
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Filter conversations"
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        slotProps={{
                            htmlInput: {'aria-label': 'Filter conversations'},
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon color="action" fontSize="small"/>
                                    </InputAdornment>
                                ),
                                endAdornment: filterText ? (
                                    <InputAdornment position="end">
                                        <IconButton size="small" onClick={() => setFilterText('')} aria-label="Clear filter">
                                            <CloseIcon fontSize="small"/>
                                        </IconButton>
                                    </InputAdornment>
                                ) : undefined,
                            },
                        }}
                        sx={{'& .MuiOutlinedInput-root': {borderRadius: 3}}}
                    />
                    <Chip
                        label="Unread"
                        size="small"
                        color={unreadOnly ? 'primary' : 'default'}
                        variant={unreadOnly ? 'filled' : 'outlined'}
                        onClick={() => setUnreadOnly((v) => !v)}
                        aria-pressed={unreadOnly}
                    />
                </Box>
            )}
            {/* Loading indicator */}
            {isLoading && conversations.length === 0 && (
                <Box sx={SX_LOADING_BOX}>
                    <CircularProgress size={32}/>
                </Box>
            )}
            {/* Conversations List */}
            {filteredConversations.length > 0 && (
            <List sx={SX_LIST_CONTAINER}>
                {filteredConversations.map((conv) => (
                    <ListItem
                        key={`${conv.otherPartyId}-${conv.otherPartyType}`}
                        onClick={() => onSelectConversation(conv)}
                        sx={{
                            cursor: 'pointer',
                            borderLeft: '3px solid',
                            borderLeftColor: selectedConversation?.otherPartyId === conv.otherPartyId &&
                            selectedConversation?.otherPartyType === conv.otherPartyType
                                ? 'primary.main' : 'transparent',
                            bgcolor: selectedConversation?.otherPartyId === conv.otherPartyId &&
                            selectedConversation?.otherPartyType === conv.otherPartyType
                                ? 'action.selected' : 'transparent',
                            '&:hover': {bgcolor: 'action.hover'},
                            '& .conv-mark-read': {opacity: 0, transition: 'opacity 0.15s'},
                            '&:hover .conv-mark-read': {opacity: 1},
                            '@media (hover: none)': {'& .conv-mark-read': {opacity: 1}},
                        }}
                    >
                        <ListItemAvatar>
                            <Badge
                                overlap="circular"
                                anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                                badgeContent={
                                    <Box
                                        sx={{
                                            width: 10,
                                            height: 10,
                                            borderRadius: '50%',
                                            bgcolor: getStatusColor(conv.otherPartyStatus),
                                            border: '2px solid white',
                                        }}
                                    />
                                }
                            >
                                <Avatar sx={SX_PRIMARY_AVATAR}>
                                    {conv.otherPartyInitials || generateInitials(conv.otherPartyName)}
                                </Avatar>
                            </Badge>
                        </ListItemAvatar>
                        <ListItemText
                            primary={
                                <Box sx={SX_CONV_NAME_ROW}>
                                    <Typography
                                        variant="body2"
                                        noWrap
                                        sx={[{
                                            fontWeight: 500
                                        }, ...(Array.isArray(SX_CONV_NAME_TEXT) ? SX_CONV_NAME_TEXT : [SX_CONV_NAME_TEXT])]}>
                                        {conv.otherPartyName}
                                    </Typography>
                                    <Typography variant="caption" sx={{
                                        color: "text.secondary"
                                    }}>
                                        {formatLastMessageTime(conv.lastMessageTime)}
                                    </Typography>
                                </Box>
                            }
                            secondary={
                                <Box sx={SX_CONV_SECONDARY_ROW}>
                                    <Typography
                                        variant="caption"
                                        noWrap
                                        sx={[{
                                            color: "text.secondary"
                                        }, ...(Array.isArray(SX_FLEX_1) ? SX_FLEX_1 : [SX_FLEX_1])]}>
                                        {conv.lastMessage ? (
                                            <>
                                                <Typography component="span" variant="caption" sx={{
                                                    fontWeight: 500
                                                }}>
                                                    {conv.unreadCount > 0 ? `${conv.otherPartyName}: ` : 'You: '}
                                                </Typography>
                                                {conv.lastMessage.substring(0, 40)}
                                                {conv.lastMessage.length > 40 ? '...' : ''}
                                            </>
                                        ) : null}
                                    </Typography>
                                    {conv.unreadCount > 0 && (
                                        <Chip
                                            label={conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                                            size="small"
                                            color="error"
                                            sx={SX_UNREAD_CHIP}
                                        />
                                    )}
                                </Box>
                            }
                        />
                        {conv.unreadCount > 0 && (
                            <IconButton
                                className="conv-mark-read"
                                size="small"
                                edge="end"
                                aria-label={`Mark conversation with ${conv.otherPartyName} as read`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onMarkRead(conv);
                                }}
                                sx={{ml: 0.5}}
                            >
                                <DoneAllIcon fontSize="small"/>
                            </IconButton>
                        )}
                    </ListItem>
                ))}
            </List>
            )}
            {/* Empty State */}
            {!isLoading && conversations.length === 0 && (
                <EmptyState
                    icon={<ChatBubbleOutlineIcon sx={SX_LARGE_ICON}/>}
                    message="No conversations yet"
                    action={
                        <Button
                            variant="contained"
                            startIcon={<AddCommentIcon/>}
                            onClick={onNewChat}
                        >
                            Start Conversation
                        </Button>
                    }
                />
            )}
            {/* No conversations match the current filter */}
            {!isLoading && conversations.length > 0 && filteredConversations.length === 0 && (
                <EmptyState
                    icon={<SearchOffIcon sx={SX_LARGE_ICON}/>}
                    message={unreadOnly && !filterText.trim()
                        ? 'No unread conversations'
                        : 'No matching conversations'}
                    action={
                        <Button
                            variant="text"
                            onClick={() => {
                                setFilterText('');
                                setUnreadOnly(false);
                            }}
                        >
                            Clear filters
                        </Button>
                    }
                />
            )}
        </Box>
    );
}

interface ChatPanelProps {
    selectedConversation: RecentConversation | null;
    messages: ChatMessage[];
    isMessagesLoading: boolean;
    newMessage: string;
    messageDeliveryType: MessageDeliveryType;
    isSending: boolean;
    showQuickResponses: boolean;
    quickResponses: QuickResponse[];
    onMessageChange: (value: string) => void;
    onDeliveryTypeChange: (value: MessageDeliveryType) => void;
    onSendMessage: () => void;
    onKeyPress: (e: React.KeyboardEvent) => void;
    onRefreshMessages: () => void;
    onToggleQuickResponses: () => void;
    onSelectQuickResponse: (response: QuickResponse) => void;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    messagesContainerRef: React.RefObject<HTMLDivElement | null>;
    onMessagesScroll: () => void;
    onRetryMessage: (message: ChatMessage) => void;
    onDraft: () => void;
    isDrafting: boolean;
}

function ChatPanel({
                       selectedConversation,
                       messages,
                       isMessagesLoading,
                       newMessage,
                       messageDeliveryType,
                       isSending,
                       showQuickResponses,
                       quickResponses,
                       onMessageChange,
                       onDeliveryTypeChange,
                       onSendMessage,
                       onKeyPress,
                       onRefreshMessages,
                       onToggleQuickResponses,
                       onSelectQuickResponse,
                       messagesEndRef,
                       messagesContainerRef,
                       onMessagesScroll,
                       onRetryMessage,
                       onDraft,
                       isDrafting,
                   }: ChatPanelProps) {
    if (!selectedConversation) {
        return (
            <Box sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <ChatIcon sx={{fontSize: 64, color: 'action.disabled', mb: 2}}/>
                <Typography sx={{
                    color: "text.secondary"
                }}>
                    Select a conversation or start a new one
                </Typography>
            </Box>
        );
    }

    return (
        <Box sx={{flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0}}>
            {/* Chat Header */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.5,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                }}
            >
                <Avatar sx={SX_PRIMARY_AVATAR}>
                    {selectedConversation.otherPartyInitials}
                </Avatar>
                <Box sx={SX_FLEX_1}>
                    <Typography variant="body1" sx={{
                        fontWeight: 500
                    }}>
                        {selectedConversation.otherPartyName}
                    </Typography>
                    <Typography
                        variant="caption"
                        sx={{
                            color: "text.secondary",
                            textTransform: 'capitalize'
                        }}>
                        {selectedConversation.otherPartyType === OtherMessagePartyType.Courier ? 'Courier' : 'Staff'}
                        {' · '}{selectedConversation.otherPartyStatus}
                    </Typography>
                </Box>
                <IconButton size="small" onClick={onRefreshMessages} disabled={isMessagesLoading} aria-label="Refresh messages">
                    <RefreshIcon sx={{animation: isMessagesLoading ? 'spin 1s linear infinite' : 'none'}}/>
                </IconButton>
            </Box>
            {/* Messages Area */}
            <Box
                ref={messagesContainerRef}
                onScroll={onMessagesScroll}
                role="log"
                aria-live="polite"
                aria-label="Messages"
                sx={{
                    flex: 1,
                    overflow: 'auto',
                    p: 2,
                    bgcolor: 'grey.100',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {isMessagesLoading && messages.length === 0 ? (
                    <Box sx={SX_LOADING_BOX}>
                        <CircularProgress size={32}/>
                    </Box>
                ) : messages.length === 0 ? (
                    <EmptyState
                        icon={<ChatBubbleOutlineIcon sx={SX_LARGE_ICON}/>}
                        message="Start the conversation"
                    />
                ) : (
                    <>
                        {messages.map((msg, index) => {
                            const prevMsg = index > 0 ? messages[index - 1] : null;
                            const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;
                            const showDateSeparator = !prevMsg ||
                                !isSameDay(prevMsg.messageTime, msg.messageTime);
                            // A run ends when the next message is from the other
                            // party, on a different day, or far enough apart in time
                            // to read as a separate burst.
                            const isLastInGroup = !nextMsg ||
                                nextMsg.isSender !== msg.isSender ||
                                !isSameDay(nextMsg.messageTime, msg.messageTime) ||
                                !withinGroupingWindow(msg.messageTime, nextMsg.messageTime);

                            return (
                                <React.Fragment key={msg.messageId}>
                                    {showDateSeparator && (
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                textAlign: 'center',
                                                color: 'text.secondary',
                                                my: 2,
                                                px: 2,
                                                py: 0.5,
                                                bgcolor: 'background.paper',
                                                alignSelf: 'center',
                                                borderRadius: 2,
                                                border: '1px solid',
                                                borderColor: 'divider',
                                            }}
                                        >
                                            {formatDateSeparator(msg.messageTime)}
                                        </Typography>
                                    )}
                                    <MessageBubble
                                        message={msg}
                                        isLastInGroup={isLastInGroup}
                                        onRetry={onRetryMessage}
                                        avatarInitials={selectedConversation.otherPartyInitials || generateInitials(selectedConversation.otherPartyName)}
                                    />
                                </React.Fragment>
                            );
                        })}
                        <div ref={messagesEndRef}/>
                    </>
                )}
            </Box>
            {/* Quick Responses Panel */}
            {showQuickResponses && (
                <Box
                    sx={{
                        borderTop: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.default',
                        p: 1.5,
                    }}
                >
                    <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1}}>
                        <Typography
                            variant="caption"
                            sx={{
                                fontWeight: 500,
                                color: "text.secondary",
                                textTransform: 'uppercase'
                            }}>
                            Quick Responses
                        </Typography>
                        <IconButton size="small" onClick={onToggleQuickResponses} aria-label="Hide quick responses">
                            <CloseIcon fontSize="small"/>
                        </IconButton>
                    </Box>
                    <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 1}}>
                        {quickResponses.map((response) => (
                            <Chip
                                key={response.id}
                                label={response.text}
                                onClick={() => onSelectQuickResponse(response)}
                                size="small"
                                sx={{
                                    '&:hover': {
                                        bgcolor: 'primary.main',
                                        color: 'primary.contrastText',
                                        borderColor: 'primary.main',
                                    },
                                }}
                            />
                        ))}
                    </Box>
                </Box>
            )}
            {/* Message Input */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 1,
                    p: 1.5,
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                }}
            >
                <IconButton onClick={onToggleQuickResponses} aria-label="Quick responses">
                    <QuickReplyIcon/>
                </IconButton>
                <TextField
                    fullWidth
                    multiline
                    maxRows={4}
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => onMessageChange(e.target.value)}
                    onKeyDown={onKeyPress}
                    size="small"
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            borderRadius: 3,
                        },
                    }}
                />
                <AiDraftButton onClick={onDraft} isDrafting={isDrafting} />
                {selectedConversation.otherPartyType === OtherMessagePartyType.Courier && (
                    <FormControl size="small" sx={{minWidth: 80}}>
                        <Select
                            value={messageDeliveryType}
                            onChange={(e) => onDeliveryTypeChange(e.target.value as MessageDeliveryType)}
                            sx={{borderRadius: 2, fontSize: 12}}
                        >
                            <MenuItem value={MessageDeliveryType.App}>App</MenuItem>
                            <MenuItem value={MessageDeliveryType.Sms}>SMS</MenuItem>
                            <MenuItem value={MessageDeliveryType.SmartDelivery}>Smart</MenuItem>
                        </Select>
                    </FormControl>
                )}
                <IconButton
                    color="primary"
                    onClick={onSendMessage}
                    disabled={!newMessage.trim() || isSending}
                    aria-label="Send message"
                    sx={{
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        '&:hover': {bgcolor: 'primary.dark'},
                        '&:disabled': {bgcolor: 'action.disabledBackground'},
                    }}
                >
                    {isSending ? <CircularProgress size={24} color="inherit"/> : <SendIcon/>}
                </IconButton>
            </Box>
        </Box>
    );
}

interface MessageBubbleProps {
    message: ChatMessage;
    // False when another message from the same party follows shortly after —
    // consecutive messages are grouped: only the last keeps its tail and timestamp.
    isLastInGroup?: boolean;
    onRetry?: (message: ChatMessage) => void;
    // Other party's initials, shown beside the last bubble of a received run.
    avatarInitials?: string;
}

function MessageBubble({message, isLastInGroup = true, onRetry, avatarInitials}: MessageBubbleProps) {
    const isSent = message.isSender;
    const isFailed = message.status === 'failed';
    const isSending = message.status === 'sending';
    // Tail (the 4px corner) only on the last bubble of a run; grouped bubbles
    // stay fully rounded so the run reads as a single block.
    const borderRadius = isLastInGroup
        ? (isSent ? '16px 16px 4px 16px' : '16px 16px 16px 4px')
        : '16px';
    // Timestamp only on the last bubble of a run; ticks stay per-message since
    // read/sent status is meaningful for each individual message.
    const showMeta = isSent || isLastInGroup;

    return (
        <Box
            sx={{
                display: 'flex',
                justifyContent: isSent ? 'flex-end' : 'flex-start',
                alignItems: 'flex-end',
                gap: 1,
                mb: isLastInGroup ? 1 : 0.25,
            }}
        >
            {!isSent && (
                isLastInGroup
                    ? (
                        <Avatar sx={{width: 28, height: 28, fontSize: 12, bgcolor: 'primary.main', flexShrink: 0}}>
                            {avatarInitials}
                        </Avatar>
                    )
                    : <Box sx={{width: 28, flexShrink: 0}}/>
            )}
            <Box
                sx={{
                    maxWidth: '70%',
                    px: 2,
                    py: 1,
                    borderRadius,
                    // primary.dark (not main) + theme contrastText keeps the sent
                    // bubble at WCAG AA: 4.60:1 on the blue theme, 9.06:1 on amber.
                    bgcolor: isSent ? 'primary.dark' : 'background.paper',
                    color: isSent ? 'primary.contrastText' : 'text.primary',
                    border: isSent ? 'none' : '1px solid',
                    borderColor: 'divider',
                }}
            >
                <Typography variant="body2" sx={SX_MSG_BODY}>
                    {message.message}
                </Typography>
                {isFailed ? (
                    <Box sx={SX_MSG_META_ROW}>
                        <ErrorOutlineIcon color="error" sx={{fontSize: 14}} titleAccess="Failed to send"/>
                        <Typography variant="caption">Failed</Typography>
                        <Button
                            size="small"
                            onClick={() => onRetry?.(message)}
                            aria-label="Retry sending message"
                            sx={{
                                minWidth: 0,
                                p: 0,
                                color: 'inherit',
                                fontSize: 12,
                                lineHeight: 1,
                                textDecoration: 'underline',
                            }}
                        >
                            Retry
                        </Button>
                    </Box>
                ) : showMeta && (
                    <Box sx={SX_MSG_META_ROW}>
                        {isLastInGroup && (
                            <Typography
                                variant="caption"
                                sx={{opacity: isSent ? 0.8 : 0.6}}
                            >
                                {formatMessageTime(message.messageTime)}
                            </Typography>
                        )}
                        {isSent && isSending && (
                            <ScheduleIcon sx={SX_MSG_TICK_ICON} titleAccess="Sending"/>
                        )}
                        {isSent && !isSending && message.read && (
                            <DoneAllIcon sx={SX_MSG_TICK_ICON}/>
                        )}
                        {isSent && !isSending && !message.read && message.sent && (
                            <DoneIcon sx={SX_MSG_TICK_ICON}/>
                        )}
                    </Box>
                )}
            </Box>
        </Box>
    );
}

interface NewChatViewProps {
    searchTerm: string;
    searchResults: MessageContactOption[];
    isSearching: boolean;
    recentConversations: RecentConversation[];
    isMultiSelectMode: boolean;
    selectedContacts: MessageContactOption[];
    newMessage: string;
    isSending: boolean;
    onSearch: (term: string) => void;
    onClearSearch: () => void;
    onToggleMultiSelect: () => void;
    onToggleContactSelection: (contact: MessageContactOption | RecentConversation) => void;
    onStartConversation: (contact: MessageContactOption | RecentConversation) => void;
    onClearSelectedContacts: () => void;
    onMessageChange: (value: string) => void;
    onSendMultiMessage: () => void;
    isContactSelected: (contact: MessageContactOption | RecentConversation) => boolean;
}

function NewChatView({
                         searchTerm,
                         searchResults,
                         isSearching,
                         recentConversations,
                         isMultiSelectMode,
                         selectedContacts,
                         newMessage,
                         isSending,
                         onSearch,
                         onClearSearch,
                         onToggleMultiSelect,
                         onToggleContactSelection,
                         onStartConversation,
                         onClearSelectedContacts,
                         onMessageChange,
                         onSendMultiMessage,
                         isContactSelected,
                     }: NewChatViewProps) {
    return (
        <Box component="section" sx={SX_DIALOG_CONTENT_COL}>
            {/* Multi-select Header */}
            {isMultiSelectMode && (
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1.5,
                        bgcolor: 'primary.light',
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                    }}
                >
                    <Typography
                        sx={{
                            fontWeight: 500,
                            color: "primary.main"
                        }}>
                        {selectedContacts.length} selected
                    </Typography>
                    <Box sx={{display: 'flex', gap: 1}}>
                        <Button
                            size="small"
                            onClick={onClearSelectedContacts}
                            disabled={selectedContacts.length === 0}
                        >
                            Clear
                        </Button>
                        <Button
                            size="small"
                            color="error"
                            onClick={onToggleMultiSelect}
                        >
                            Cancel
                        </Button>
                    </Box>
                </Box>
            )}
            {/* Search Section */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 2,
                    bgcolor: 'background.default',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                }}
            >
                <TextField
                    fullWidth
                    placeholder="Search by name or ID..."
                    value={searchTerm}
                    onChange={(e) => onSearch(e.target.value)}
                    size="small"
                    slotProps={{
                        input: {
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon color="action"/>
                                </InputAdornment>
                            ),
                            endAdornment: searchTerm && (
                                <InputAdornment position="end">
                                    <IconButton size="small" onClick={onClearSearch}>
                                        <CloseIcon fontSize="small"/>
                                    </IconButton>
                                </InputAdornment>
                            ),
                        },
                    }}
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            borderRadius: 3,
                            bgcolor: 'background.paper',
                        },
                    }}
                />
                <Button
                    variant={isMultiSelectMode ? 'contained' : 'outlined'}
                    size="small"
                    onClick={onToggleMultiSelect}
                    startIcon={isMultiSelectMode ? <CheckBoxIcon/> : <CheckBoxOutlineBlankIcon/>}
                >
                    Multi
                </Button>
            </Box>
            {/* Loading */}
            {isSearching && (
                <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, p: 3}}>
                    <CircularProgress size={24}/>
                    <Typography sx={{
                        color: "text.secondary"
                    }}>Searching...</Typography>
                </Box>
            )}
            {/* Results */}
            <Box sx={{flex: 1, overflow: 'auto'}}>
                {/* Recent Conversations */}
                {!searchTerm && recentConversations.length > 0 && (
                    <Box sx={{py: 2}}>
                        <Typography
                            variant="caption"
                            sx={{
                                fontWeight: 600,
                                color: "text.secondary",
                                px: 2,
                                textTransform: 'uppercase',
                                letterSpacing: 0.5
                            }}>
                            Recent
                        </Typography>
                        <List>
                            {recentConversations.map((conv) => (
                                <ContactListItem
                                    key={`${conv.otherPartyId}-${conv.otherPartyType}`}
                                    contact={conv}
                                    isMultiSelectMode={isMultiSelectMode}
                                    isSelected={isContactSelected(conv)}
                                    onSelect={() => isMultiSelectMode
                                        ? onToggleContactSelection(conv)
                                        : onStartConversation(conv)
                                    }
                                    onToggleSelection={() => onToggleContactSelection(conv)}
                                />
                            ))}
                        </List>
                    </Box>
                )}

                {/* Search Results */}
                {searchTerm && searchResults.length > 0 && (
                    <Box sx={{py: 2}}>
                        <Typography
                            variant="caption"
                            sx={{
                                fontWeight: 600,
                                color: "text.secondary",
                                px: 2,
                                textTransform: 'uppercase',
                                letterSpacing: 0.5
                            }}>
                            Results ({searchResults.length})
                        </Typography>
                        <List>
                            {searchResults.map((contact) => (
                                <ContactListItem
                                    key={contact.id}
                                    contact={contact}
                                    isMultiSelectMode={isMultiSelectMode}
                                    isSelected={isContactSelected(contact)}
                                    onSelect={() => isMultiSelectMode
                                        ? onToggleContactSelection(contact)
                                        : onStartConversation(contact)
                                    }
                                    onToggleSelection={() => onToggleContactSelection(contact)}
                                    highlightTerm={searchTerm}
                                />
                            ))}
                        </List>
                    </Box>
                )}

                {/* No Results */}
                {searchTerm && !isSearching && searchResults.length === 0 && (
                    <EmptyState
                        icon={<SearchOffIcon sx={SX_LARGE_ICON}/>}
                        message={`No results for "${searchTerm}"`}
                    />
                )}

                {/* Empty State */}
                {!searchTerm && recentConversations.length === 0 && (
                    <EmptyState
                        icon={<PersonSearchIcon sx={SX_LARGE_ICON}/>}
                        message="Search to start a conversation"
                    />
                )}

                {/* Multi-select Compose */}
                {isMultiSelectMode && selectedContacts.length > 0 && (
                    <Box sx={{m: 2, p: 2, bgcolor: 'grey.100', borderRadius: 2}}>
                        <Typography
                            sx={{
                                fontWeight: 500,
                                mb: 1.5
                            }}>
                            Send to {selectedContacts.length} contact{selectedContacts.length !== 1 ? 's' : ''}
                        </Typography>
                        <TextField
                            fullWidth
                            multiline
                            rows={3}
                            placeholder="Type your message..."
                            value={newMessage}
                            onChange={(e) => onMessageChange(e.target.value)}
                            sx={{mb: 1.5}}
                        />
                        <Box sx={{display: 'flex', justifyContent: 'flex-end'}}>
                            <Button
                                variant="contained"
                                startIcon={isSending ? <CircularProgress size={16} color="inherit"/> : <SendIcon/>}
                                onClick={onSendMultiMessage}
                                disabled={!newMessage.trim() || isSending}
                            >
                                Send
                            </Button>
                        </Box>
                    </Box>
                )}
            </Box>
        </Box>
    );
}

interface ContactListItemProps {
    contact: MessageContactOption | RecentConversation;
    isMultiSelectMode: boolean;
    isSelected: boolean;
    onSelect: () => void;
    onToggleSelection: () => void;
    highlightTerm?: string;
}

function ContactListItem({
                             contact,
                             isMultiSelectMode,
                             isSelected,
                             onSelect,
                             onToggleSelection,
                             highlightTerm,
                         }: ContactListItemProps) {
    const name = 'otherPartyName' in contact ? contact.otherPartyName : contact.name;
    const initials = 'otherPartyInitials' in contact ? contact.otherPartyInitials : generateInitials(name);
    const type = 'otherPartyType' in contact ? contact.otherPartyType : contact.otherMessagePartyType;
    const status = 'otherPartyStatus' in contact ? contact.otherPartyStatus : contact.status;

    return (
        <ListItem
            onClick={onSelect}
            sx={{
                cursor: 'pointer',
                bgcolor: isSelected ? 'action.selected' : 'transparent',
                '&:hover': {bgcolor: 'action.hover'},
            }}
        >
            {isMultiSelectMode && (
                <Checkbox
                    checked={isSelected}
                    onChange={onToggleSelection}
                    onClick={(e) => e.stopPropagation()}
                    sx={SX_MR_1}
                />
            )}
            <ListItemAvatar>
                <Avatar sx={SX_PRIMARY_AVATAR}>
                    {initials}
                </Avatar>
            </ListItemAvatar>
            <ListItemText
                primary={
                    highlightTerm ? (
                        <span dangerouslySetInnerHTML={{__html: highlightSearchTerm(name, highlightTerm)}}/>
                    ) : name
                }
                secondary={type === OtherMessagePartyType.Courier ? 'Courier' : 'Staff'}
            />
            {status && (
                <Box
                    sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: getStatusColor(status),
                    }}
                />
            )}
        </ListItem>
    );
}

interface EmptyStateProps {
    icon: React.ReactNode;
    message: string;
    action?: React.ReactNode;
}

function EmptyState({icon, message, action}: EmptyStateProps) {
    return (
        <Box
            sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                p: 5,
                color: 'text.secondary',
            }}
        >
            <Box sx={{color: 'action.disabled', mb: 2}}>{icon}</Box>
            <Typography
                sx={{
                    color: "text.secondary",
                    mb: action ? 2 : 0
                }}>
                {message}
            </Typography>
            {action}
        </Box>
    );
}

interface ErrorStateProps {
    message: string;
    onRetry: () => void;
}

function ErrorState({message, onRetry}: ErrorStateProps) {
    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                p: 5,
            }}
        >
            <ErrorOutlineIcon sx={{fontSize: 64, color: 'error.main', mb: 2}}/>
            <Typography variant="h6" gutterBottom>
                Unable to load messages
            </Typography>
            <Typography
                sx={{
                    color: "text.secondary",
                    mb: 3
                }}>
                {message}
            </Typography>
            <Button variant="contained" startIcon={<RefreshIcon/>} onClick={onRetry}>
                Retry
            </Button>
        </Box>
    );
}

// Utility Functions

function normalizeContact(contact: MessageContactOption | RecentConversation): MessageContactOption {
    if ('otherPartyId' in contact) {
        return {
            id: `${contact.otherPartyId}-${contact.otherPartyType}`,
            recordId: contact.otherPartyId,
            name: contact.otherPartyName,
            otherMessagePartyType: contact.otherPartyType,
            status: contact.otherPartyStatus || 'unknown',
        };
    }
    return contact;
}

function generateInitials(name: string): string {
    if (!name) return '??';
    const parts = name.split(' ').filter(p => p.length > 0);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getStatusColor(status: string): string {
    const normalizedStatus = status?.toLowerCase() || '';
    if (normalizedStatus === 'online' || normalizedStatus === 'active') return sharedColors.success.main;
    if (normalizedStatus === 'away' || normalizedStatus === 'busy') return sharedColors.warning.main;
    return accentPalette[400];
}

function formatMessageTime(messageTime: string): string {
    const time = parseDateFromApi(messageTime);
    const now = dayjs();
    const diffInMinutes = now.diff(time, 'minute');
    const diffInHours = now.diff(time, 'hour');

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return time.format('HH:mm');
    if (diffInHours < 48) return `Yesterday ${time.format('HH:mm')}`;
    return time.format('MMM D, HH:mm');
}

function formatLastMessageTime(lastMessageTime: string): string {
    if (!lastMessageTime) return '';
    const time = parseDateFromApi(lastMessageTime);
    const now = dayjs();
    const diffInMinutes = now.diff(time, 'minute');
    const diffInHours = now.diff(time, 'hour');
    const diffInDays = now.diff(time, 'day');

    if (diffInMinutes < 1) return 'Now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInHours < 24) return time.format('HH:mm');
    if (diffInDays < 7) return time.format('ddd');
    return time.format('MMM D');
}

function formatDateSeparator(messageTime: string): string {
    const time = parseDateFromApi(messageTime);
    const now = dayjs();
    if (time.isSame(now, 'day')) return 'Today';
    if (time.isSame(now.subtract(1, 'day'), 'day')) return 'Yesterday';
    if (now.diff(time, 'day') < 7) return time.format('dddd');
    if (time.isSame(now, 'year')) return time.format('MMM D');
    return time.format('MMM D, YYYY');
}

function isSameDay(time1: string, time2: string): boolean {
    const date1 = parseDateFromApi(time1);
    const date2 = parseDateFromApi(time2);
    return date1.isSame(date2, 'day');
}

// How close to the bottom (in px) still counts as "following" the thread.
const NEAR_BOTTOM_THRESHOLD_PX = 80;

export function isNearBottom(
    el: Pick<HTMLElement, 'scrollHeight' | 'scrollTop' | 'clientHeight'>,
    threshold = NEAR_BOTTOM_THRESHOLD_PX,
): boolean {
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
}

// Consecutive messages from the same party within this window are grouped
// into a single visual run (shared timestamp, tighter spacing).
const MESSAGE_GROUP_WINDOW_MINUTES = 5;

function withinGroupingWindow(earlier: string, later: string): boolean {
    const a = parseDateFromApi(earlier);
    const b = parseDateFromApi(later);
    return Math.abs(b.diff(a, 'minute')) <= MESSAGE_GROUP_WINDOW_MINUTES;
}

function highlightSearchTerm(text: string, searchTerm: string): string {
    if (!searchTerm || !text) return text;
    const escapeHtml = (str: string) => str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedText = escapeHtml(text);
    const escapedSearchTerm = escapeRegex(searchTerm);
    const regex = new RegExp(`(${escapedSearchTerm})`, 'gi');
    return escapedText.replace(regex, '<span style="background: rgba(33, 150, 243, 0.2); padding: 0 2px; border-radius: 2px;">$1</span>');
}

// Add CSS keyframes for spinning animation
const styleElement = document.createElement('style');
styleElement.textContent = `
@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
`;
if (!document.querySelector('style[data-messaging-dialog]')) {
    styleElement.setAttribute('data-messaging-dialog', 'true');
    document.head.appendChild(styleElement);
}

export default MessagingDialog;
