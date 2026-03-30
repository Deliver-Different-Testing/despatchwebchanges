/**
 * React Messaging Dialog
 *
 * A modern replacement for the AngularJS messaging-dialog using MUI components.
 * Features real-time messaging, conversation list, quick responses, and multi-recipient support.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {accentPalette, sharedColors} from '../../../theme/muiTheme';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
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
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
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
import {
    useAutoRefresh,
    useContactSearch,
    useConversations,
    useMessages,
    useQuickResponses
} from "../../../hooks/useMessaging";

export const MessagingDialog: React.FC<MessagingDialogProps> = ({
                                                                    open,
                                                                    onClose,
                                                                    showToast,
                                                                    currentStaffId,
                                                                }) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

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

    // Scroll to bottom when messages change
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({behavior: 'smooth'});
        }
    }, [messages]);

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

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !selectedConversation || isSending) return;

        const messageContent = newMessage.trim();
        setIsSending(true);

        try {
            const data: SendMessageRequest = {
                sendToCourierId: selectedConversation.otherPartyType === OtherMessagePartyType.Courier
                    ? selectedConversation.otherPartyId : undefined,
                sendToStaffId: selectedConversation.otherPartyType === OtherMessagePartyType.Staff
                    ? selectedConversation.otherPartyId : undefined,
                message: messageContent,
                messageType: messageDeliveryType,
            };

            await messagingApi.sendMessage(data);

            // Add optimistic message
            const optimisticMessage: ChatMessage = {
                messageId: -Date.now(),
                sendFromStaffId: currentStaffId,
                sendToCourierId: data.sendToCourierId,
                sendToStaffId: data.sendToStaffId,
                message: messageContent,
                messageTime: dayjs().format('YYYY-MM-DDTHH:mm:ss'),
                read: false,
                sent: true,
                isSender: true,
            };

            addOptimisticMessage(optimisticMessage);
            setNewMessage('');

            // Update conversation preview
            updateConversation(
                selectedConversation.otherPartyId,
                selectedConversation.otherPartyType,
                {
                    lastMessage: messageContent,
                    lastMessageTime: dayjs().format('YYYY-MM-DDTHH:mm:ss'),
                }
            );

            showToast('Message sent', 'success');
        } catch (err) {
            console.error('Failed to send message:', err);
            showToast('Failed to send message', 'error');
        } finally {
            setIsSending(false);
        }
    };

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
                <DialogContent sx={{p: 0, display: 'flex', flex: 1, overflow: 'hidden'}}>
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
                            />
                        </Box>
                    )}
                </DialogContent>
            </>
        );
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth={false}
            slotProps={{
                paper: {
                    sx: {
                        width: '90vw',
                        maxWidth: 1100,
                        height: '80vh',
                        maxHeight: 800,
                        minWidth: 700,
                        minHeight: 500,
                        borderRadius: 2,
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                    },
                },
            }}
        >
            {renderContent()}
        </Dialog>
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
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                color: 'white',
                px: 2,
                py: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
            })}
        >
            {showBackButton && (
                <IconButton onClick={onBack} sx={{color: 'white'}}>
                    <ArrowBackIcon/>
                </IconButton>
            )}
            {!showBackButton && <ChatIcon sx={{mr: 1}}/>}
            <Box sx={{flex: 1}}>
                <Typography variant="h6" fontWeight={600}>
                    {title}
                </Typography>
                {subtitle && (
                    <Typography variant="body2" sx={{opacity: 0.85, mt: 0.25}}>
                        {subtitle}
                    </Typography>
                )}
            </Box>
            <IconButton onClick={onClose} sx={{color: 'white'}}>
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
}

function ConversationsPanel({
                                conversations,
                                selectedConversation,
                                isLoading,
                                totalUnreadCount,
                                onSelectConversation,
                                onRefresh,
                                onNewChat,
                            }: ConversationsPanelProps) {
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
                <Typography variant="subtitle1" fontWeight={600}>
                    Conversations
                </Typography>
                {totalUnreadCount > 0 && (
                    <Badge
                        badgeContent={totalUnreadCount}
                        color="error"
                        sx={{ml: 0.5}}
                    />
                )}
                <Box sx={{flex: 1}}/>
                <IconButton size="small" onClick={onRefresh} disabled={isLoading}>
                    <RefreshIcon sx={{animation: isLoading ? 'spin 1s linear infinite' : 'none'}}/>
                </IconButton>
                <IconButton size="small" color="primary" onClick={onNewChat}>
                    <AddCommentIcon/>
                </IconButton>
            </Box>

            {/* Loading indicator */}
            {isLoading && conversations.length === 0 && (
                <Box sx={{display: 'flex', justifyContent: 'center', p: 4}}>
                    <CircularProgress size={32}/>
                </Box>
            )}

            {/* Conversations List */}
            <List sx={{flex: 1, overflow: 'auto', p: 0}}>
                {conversations.map((conv) => (
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
                                <Avatar sx={{bgcolor: 'primary.main'}}>
                                    {conv.otherPartyInitials || generateInitials(conv.otherPartyName)}
                                </Avatar>
                            </Badge>
                        </ListItemAvatar>
                        <ListItemText
                            primary={
                                <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
                                    <Typography variant="body2" fontWeight={500} noWrap sx={{maxWidth: 140}}>
                                        {conv.otherPartyName}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {formatLastMessageTime(conv.lastMessageTime)}
                                    </Typography>
                                </Box>
                            }
                            secondary={
                                <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        noWrap
                                        sx={{flex: 1}}
                                    >
                                        {conv.lastMessage ? (
                                            <>
                                                <Typography component="span" variant="caption" fontWeight={500}>
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
                                            sx={{height: 18, fontSize: 11}}
                                        />
                                    )}
                                </Box>
                            }
                        />
                    </ListItem>
                ))}
            </List>

            {/* Empty State */}
            {!isLoading && conversations.length === 0 && (
                <EmptyState
                    icon={<ChatBubbleOutlineIcon sx={{fontSize: 48}}/>}
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
                <Typography color="text.secondary">
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
                <Avatar sx={{bgcolor: 'primary.main'}}>
                    {selectedConversation.otherPartyInitials}
                </Avatar>
                <Box sx={{flex: 1}}>
                    <Typography variant="body1" fontWeight={500}>
                        {selectedConversation.otherPartyName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{textTransform: 'capitalize'}}>
                        {selectedConversation.otherPartyType === OtherMessagePartyType.Courier ? 'Courier' : 'Staff'}
                        {' · '}{selectedConversation.otherPartyStatus}
                    </Typography>
                </Box>
                <IconButton size="small" onClick={onRefreshMessages} disabled={isMessagesLoading}>
                    <RefreshIcon sx={{animation: isMessagesLoading ? 'spin 1s linear infinite' : 'none'}}/>
                </IconButton>
            </Box>

            {/* Messages Area */}
            <Box
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
                    <Box sx={{display: 'flex', justifyContent: 'center', p: 4}}>
                        <CircularProgress size={32}/>
                    </Box>
                ) : messages.length === 0 ? (
                    <EmptyState
                        icon={<ChatBubbleOutlineIcon sx={{fontSize: 48}}/>}
                        message="Start the conversation"
                    />
                ) : (
                    <>
                        {messages.map((msg, index) => {
                            const showDateSeparator = index === 0 ||
                                !isSameDay(messages[index - 1].messageTime, msg.messageTime);

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
                                                bgcolor: 'grey.100',
                                                alignSelf: 'center',
                                                borderRadius: 2,
                                                border: '1px solid',
                                                borderColor: 'divider',
                                            }}
                                        >
                                            {formatDateSeparator(msg.messageTime)}
                                        </Typography>
                                    )}
                                    <MessageBubble message={msg}/>
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
                        <Typography variant="caption" fontWeight={500} color="text.secondary"
                                    sx={{textTransform: 'uppercase'}}>
                            Quick Responses
                        </Typography>
                        <IconButton size="small" onClick={onToggleQuickResponses}>
                            <CloseIcon fontSize="small"/>
                        </IconButton>
                    </Box>
                    <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 1}}>
                        {quickResponses.map((response) => (
                            <Chip
                                key={response.id}
                                label={response.text}
                                onClick={() => onSelectQuickResponse(response)}
                                variant="outlined"
                                size="small"
                                sx={{
                                    '&:hover': {
                                        bgcolor: 'primary.main',
                                        color: 'white',
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
                <IconButton onClick={onToggleQuickResponses}>
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
                    sx={{
                        bgcolor: 'primary.main',
                        color: 'white',
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
}

function MessageBubble({message}: MessageBubbleProps) {
    const isSent = message.isSender;

    return (
        <Box
            sx={{
                display: 'flex',
                justifyContent: isSent ? 'flex-end' : 'flex-start',
                mb: 1,
            }}
        >
            <Box
                sx={{
                    maxWidth: '70%',
                    px: 2,
                    py: 1,
                    borderRadius: isSent ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    bgcolor: isSent ? 'primary.main' : 'background.paper',
                    color: isSent ? 'white' : 'text.primary',
                    border: isSent ? 'none' : '1px solid',
                    borderColor: 'divider',
                }}
            >
                <Typography variant="body2" sx={{whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>
                    {message.message}
                </Typography>
                <Box sx={{display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, justifyContent: 'flex-end'}}>
                    <Typography
                        variant="caption"
                        sx={{opacity: isSent ? 0.8 : 0.6}}
                    >
                        {formatMessageTime(message.messageTime)}
                    </Typography>
                    {isSent && message.read && (
                        <DoneAllIcon sx={{fontSize: 14, opacity: 0.8}}/>
                    )}
                    {isSent && !message.read && message.sent && (
                        <DoneIcon sx={{fontSize: 14, opacity: 0.8}}/>
                    )}
                </Box>
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
        <DialogContent sx={{p: 0, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden'}}>
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
                    <Typography fontWeight={500} color="primary.main">
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
                    <Typography color="text.secondary">Searching...</Typography>
                </Box>
            )}

            {/* Results */}
            <Box sx={{flex: 1, overflow: 'auto'}}>
                {/* Recent Conversations */}
                {!searchTerm && recentConversations.length > 0 && (
                    <Box sx={{py: 2}}>
                        <Typography
                            variant="caption"
                            fontWeight={600}
                            color="text.secondary"
                            sx={{px: 2, textTransform: 'uppercase', letterSpacing: 0.5}}
                        >
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
                            fontWeight={600}
                            color="text.secondary"
                            sx={{px: 2, textTransform: 'uppercase', letterSpacing: 0.5}}
                        >
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
                        icon={<SearchOffIcon sx={{fontSize: 48}}/>}
                        message={`No results for "${searchTerm}"`}
                    />
                )}

                {/* Empty State */}
                {!searchTerm && recentConversations.length === 0 && (
                    <EmptyState
                        icon={<PersonSearchIcon sx={{fontSize: 48}}/>}
                        message="Search to start a conversation"
                    />
                )}

                {/* Multi-select Compose */}
                {isMultiSelectMode && selectedContacts.length > 0 && (
                    <Box sx={{m: 2, p: 2, bgcolor: 'grey.100', borderRadius: 2}}>
                        <Typography fontWeight={500} sx={{mb: 1.5}}>
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
        </DialogContent>
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
                    sx={{mr: 1}}
                />
            )}
            <ListItemAvatar>
                <Avatar sx={{bgcolor: 'primary.main'}}>
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
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                p: 5,
                color: 'text.secondary',
            }}
        >
            <Box sx={{color: 'action.disabled', mb: 2}}>{icon}</Box>
            <Typography color="text.secondary" sx={{mb: action ? 2 : 0}}>
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
            <Typography color="text.secondary" sx={{mb: 3}}>
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
    return time.format('MMM D, YYYY');
}

function isSameDay(time1: string, time2: string): boolean {
    const date1 = parseDateFromApi(time1);
    const date2 = parseDateFromApi(time2);
    return date1.isSame(date2, 'day');
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
