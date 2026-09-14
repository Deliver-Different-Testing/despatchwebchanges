/**
 * React Messaging Dialogue
 *
 * A modern replacement for the AngularJS messaging-dialog using MUI components.
 * Features real-time messaging, conversation list, quick responses, and multi-recipient support.
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
    ActionIcon,
    Avatar,
    Badge,
    Box,
    Button,
    Checkbox,
    Chip,
    CloseButton,
    Drawer,
    Group,
    Indicator,
    Loader,
    Paper,
    Select,
    Stack,
    Text,
    Textarea,
    TextInput,
    ThemeIcon,
    Title,
} from '@mantine/core';
import {
    ArrowLeft,
    Check,
    CheckCheck,
    CircleAlert,
    Clock,
    MessageCircle,
    MessageCirclePlus,
    MessageSquare,
    RefreshCw,
    Search,
    SearchX,
    Square,
    SquareCheckBig,
    Send,
    UserSearch,
    Zap,
} from 'lucide-react';
import {Icon} from '../../common/icon/Icon';
import {
    headerChipProps,
    headerChromeStyle,
    headerOnColor,
} from '../shared/mantine';
import styles from './MessagingDialog.module.css';
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
import {AiDraftButton} from '../../common/ai-draft-button/mantine/AiDraftButton';
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
/*
 * The MUI version hoisted seventeen `sx` objects to module scope so they were
 * not rebuilt per render. Mantine props are plain attributes, so nearly all of
 * them simply disappear; what is left is the two the message bubble reuses.
 */
import {useInboxTriage, triageKey} from '../../../hooks/useInboxTriage';
import {TriageChip} from './TriageChip';
import {InboxTriageItem} from '../../../interfaces/ai';

const MESSAGE_BODY_STYLE = {whiteSpace: 'pre-wrap', wordBreak: 'break-word'} as const;
const EMPTY_GLYPH_SIZE = 48;

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

    /* One Auto-mate pass over the whole inbox when it opens, not one per thread. */
    const {triage} = useInboxTriage(open, conversations.length > 0);

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

        const lastMessageIsOwn = messages[messages.length - 1]?.isSender;

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
                <Box component="section" style={{display: 'flex', flex: 1, overflow: 'hidden'}}>
                    {conversationsError ? (
                        <ErrorState
                            message={conversationsError}
                            onRetry={() => loadConversations()}
                        />
                    ) : (
                        <Box style={{display: 'flex', flex: 1, minHeight: 0}}>
                            {/* Conversations Panel */}
                            <ConversationsPanel
                                conversations={conversations}
                                triage={triage}
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
            opened={open}
            onClose={onClose}
            position="right"
            withCloseButton={false}
            padding={0}
            size={1000}
            /*
              * The Message Center is a working surface, not a quick confirm, so an
              * outside click must not throw away what is being typed. MUI needed a
              * reason check inside onClose to say this; Mantine says it as a prop.
              */
            closeOnClickOutside={false}
            overlayProps={{'data-testid': 'messaging-overlay'} as React.ComponentProps<typeof Drawer>['overlayProps']}
            styles={{
                content: {display: 'flex', flexDirection: 'column', overflow: 'hidden'},
                body: {display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0},
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

/**
 * The drawer's own header bar. Not the shared `<DialogHeader>`: this one swaps
 * its leading chip for a Back button, which that component has no slot for.
 * Built from the same style helpers, so the bar itself stays in step.
 */
function DialogHeader({title, subtitle, showBackButton, onBack, onClose}: DialogHeaderProps) {
    return (
        <Box style={{...headerChromeStyle(), gap: 'var(--mantine-spacing-sm)', flexShrink: 0}}>
            {showBackButton ? (
                <ActionIcon
                    variant="subtle"
                    aria-label="Back"
                    onClick={onBack}
                    c={headerOnColor()}
                >
                    <Icon lucide={ArrowLeft}/>
                </ActionIcon>
            ) : (
                <ThemeIcon {...headerChipProps('primary', 36)}>
                    <Icon lucide={MessageCircle}/>
                </ThemeIcon>
            )}
            <Box style={{flex: 1}}>
                <Title order={5} fw={600}>{title}</Title>
                {subtitle && <Text fz="sm" opacity={0.85} mt={2}>{subtitle}</Text>}
            </Box>
            <CloseButton
                aria-label="Close message center"
                onClick={onClose}
                c={headerOnColor()}
            />
        </Box>
    );
}

interface ConversationsPanelProps {
    conversations: RecentConversation[];
    /** Auto-mate's read of each conversation, keyed by id-and-type. Empty when off. */
    triage: Map<string, InboxTriageItem>;
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
                                triage,
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
            return !(term && !conv.otherPartyName.toLowerCase().includes(term));
        });
    }, [conversations, filterText, unreadOnly]);

    return (
        <Box
            w={320}
            bg="var(--mantine-color-gray-0)"
            style={{
                display: 'flex',
                flexDirection: 'column',
                borderRight: '1px solid var(--mantine-color-default-border)',
            }}
        >
            {/* Panel Header */}
            <Group
                gap={8}
                p={12}
                wrap="nowrap"
                bg="var(--mantine-color-body)"
                style={{borderBottom: '1px solid var(--mantine-color-default-border)'}}
            >
                <Text fz="md" fw={600}>Conversations</Text>
                {totalUnreadCount > 0 && (
                    <Badge color="red" size="sm" circle>{totalUnreadCount}</Badge>
                )}
                <Box style={{flex: 1}}/>
                <ActionIcon
                    variant="subtle"
                    color="gray"
                    onClick={onRefresh}
                    disabled={isLoading}
                    aria-label="Refresh conversations"
                >
                    <Icon lucide={RefreshCw} className={isLoading ? styles.spinning : undefined}/>
                </ActionIcon>
                <ActionIcon variant="subtle" onClick={onNewChat} aria-label="New conversation">
                    <Icon lucide={MessageCirclePlus}/>
                </ActionIcon>
            </Group>

            {/* Filter row */}
            {conversations.length > 0 && (
                <Group
                    gap={8}
                    px={12}
                    py={8}
                    wrap="nowrap"
                    bg="var(--mantine-color-body)"
                    style={{borderBottom: '1px solid var(--mantine-color-default-border)'}}
                >
                    <TextInput
                        size="sm"
                        radius="xl"
                        style={{flex: 1}}
                        placeholder="Filter conversations"
                        aria-label="Filter conversations"
                        value={filterText}
                        onChange={(e) => setFilterText(e.currentTarget.value)}
                        leftSection={<Icon lucide={Search} size={16}/>}
                        rightSection={filterText
                            ? <CloseButton size="sm" aria-label="Clear filter" onClick={() => setFilterText('')}/>
                            : null}
                    />
                    {/* A real toggle: Chip reports aria-checked, where the MUI Chip
                        was a clickable label wearing a hand-set aria-pressed. */}
                    <Chip
                        size="sm"
                        checked={unreadOnly}
                        onChange={() => setUnreadOnly((v) => !v)}
                    >
                        Unread
                    </Chip>
                </Group>
            )}

            {/* Loading indicator */}
            {isLoading && conversations.length === 0 && (
                <Group justify="center" p={32}>
                    <Loader size={32} aria-label="Loading conversations"/>
                </Group>
            )}

            {/* Conversations List */}
            {filteredConversations.length > 0 && (
                <Box component="ul" m={0} p={0} style={{flex: 1, overflow: 'auto', listStyle: 'none'}}>
                    {filteredConversations.map((conv) => {
                        const isSelected = selectedConversation?.otherPartyId === conv.otherPartyId
                            && selectedConversation?.otherPartyType === conv.otherPartyType;
                        return (
                            <Box
                                component="li"
                                key={`${conv.otherPartyId}-${conv.otherPartyType}`}
                                className={styles.conversationRow}
                                onClick={() => onSelectConversation(conv)}
                                px={12}
                                py={8}
                                bg={isSelected ? 'var(--mantine-color-gray-1)' : undefined}
                                style={{
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    borderLeft: `3px solid ${isSelected ? 'var(--mantine-primary-color-filled)' : 'transparent'}`,
                                }}
                            >
                                <Indicator
                                    size={10}
                                    offset={4}
                                    position="bottom-end"
                                    withBorder
                                    color={getStatusColor(conv.otherPartyStatus)}
                                >
                                    <Avatar color="brand" radius="xl">
                                        {conv.otherPartyInitials || generateInitials(conv.otherPartyName)}
                                    </Avatar>
                                </Indicator>

                                <Box style={{flex: 1, minWidth: 0}}>
                                    <Group justify="space-between" align="baseline" wrap="nowrap" gap={8}>
                                        <Text fz="sm" fw={500} truncate maw={140}>{conv.otherPartyName}</Text>
                                        <Text fz="xs" c="dimmed">{formatLastMessageTime(conv.lastMessageTime)}</Text>
                                    </Group>
                                    <Group gap={8} wrap="nowrap">
                                        <Text fz="xs" c="dimmed" truncate style={{flex: 1}}>
                                            {conv.lastMessage ? (
                                                <>
                                                    <Text component="span" fz="xs" fw={500}>
                                                        {conv.unreadCount > 0 ? `${conv.otherPartyName}: ` : 'You: '}
                                                    </Text>
                                                    {conv.lastMessage.substring(0, 40)}
                                                    {conv.lastMessage.length > 40 ? '...' : ''}
                                                </>
                                            ) : null}
                                        </Text>
                                        {conv.unreadCount > 0 && (
                                            <Badge color="red" size="sm">
                                                {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                                            </Badge>
                                        )}
                                    </Group>
                                    {(() => {
                                        const item = triage.get(
                                            triageKey(conv.otherPartyId, conv.otherPartyType));
                                        return item ? <TriageChip item={item}/> : null;
                                    })()}
                                </Box>

                                {conv.unreadCount > 0 && (
                                    <ActionIcon
                                        className={styles.markRead}
                                        variant="subtle"
                                        color="gray"
                                        size="sm"
                                        aria-label={`Mark conversation with ${conv.otherPartyName} as read`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onMarkRead(conv);
                                        }}
                                    >
                                        <Icon lucide={CheckCheck} size={16}/>
                                    </ActionIcon>
                                )}
                            </Box>
                        );
                    })}
                </Box>
            )}

            {/* Empty State */}
            {!isLoading && conversations.length === 0 && (
                <EmptyState
                    icon={<Icon lucide={MessageSquare} size={EMPTY_GLYPH_SIZE}/>}
                    message="No conversations yet"
                    action={
                        <Button
                            leftSection={<Icon lucide={MessageCirclePlus} size={16}/>}
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
                    icon={<Icon lucide={SearchX} size={EMPTY_GLYPH_SIZE}/>}
                    message={unreadOnly && !filterText.trim()
                        ? 'No unread conversations'
                        : 'No matching conversations'}
                    action={
                        <Button
                            variant="subtle"
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
            <Stack flex={1} align="center" justify="center" gap={16}>
                <Box c="dimmed" opacity={0.5}>
                    <Icon lucide={MessageCircle} size={64}/>
                </Box>
                <Text c="dimmed">Select a conversation or start a new one</Text>
            </Stack>
        );
    }

    return (
        <Box style={{flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0}}>
            {/* Chat Header */}
            <Group
                gap={12}
                p={12}
                wrap="nowrap"
                style={{borderBottom: '1px solid var(--mantine-color-default-border)'}}
            >
                <Avatar color="brand" radius="xl">{selectedConversation.otherPartyInitials}</Avatar>
                <Box style={{flex: 1, minWidth: 0}}>
                    <Text fz="md" fw={500} truncate>{selectedConversation.otherPartyName}</Text>
                    <Text fz="xs" c="dimmed" tt="capitalize">
                        {selectedConversation.otherPartyType === OtherMessagePartyType.Courier ? 'Courier' : 'Staff'}
                        {' · '}{selectedConversation.otherPartyStatus}
                    </Text>
                </Box>
                <ActionIcon
                    variant="subtle"
                    color="gray"
                    onClick={onRefreshMessages}
                    disabled={isMessagesLoading}
                    aria-label="Refresh messages"
                >
                    <Icon lucide={RefreshCw} className={isMessagesLoading ? styles.spinning : undefined}/>
                </ActionIcon>
            </Group>

            {/* Messages Area */}
            <Box
                ref={messagesContainerRef}
                onScroll={onMessagesScroll}
                role="log"
                aria-live="polite"
                aria-label="Messages"
                p={16}
                bg="var(--mantine-color-gray-1)"
                style={{flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column'}}
            >
                {isMessagesLoading && messages.length === 0 ? (
                    <Group justify="center" p={32}>
                        <Loader size={32} aria-label="Loading messages"/>
                    </Group>
                ) : messages.length === 0 ? (
                    <EmptyState
                        icon={<Icon lucide={MessageSquare} size={EMPTY_GLYPH_SIZE}/>}
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
                                        <Paper
                                            withBorder
                                            radius="md"
                                            px={16}
                                            py={4}
                                            my={16}
                                            style={{alignSelf: 'center'}}
                                        >
                                            <Text fz="xs" c="dimmed">{formatDateSeparator(msg.messageTime)}</Text>
                                        </Paper>
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
                    p={12}
                    bg="var(--mantine-color-gray-0)"
                    style={{borderTop: '1px solid var(--mantine-color-default-border)'}}
                >
                    <Group justify="space-between" mb={8}>
                        <Text fz="xs" fw={500} c="dimmed" tt="uppercase">Quick Responses</Text>
                        <CloseButton size="sm" aria-label="Hide quick responses" onClick={onToggleQuickResponses}/>
                    </Group>
                    <Group gap={8}>
                        {quickResponses.map((response) => (
                            <Button
                                key={response.id}
                                size="compact-sm"
                                variant="default"
                                radius="xl"
                                onClick={() => onSelectQuickResponse(response)}
                            >
                                {response.text}
                            </Button>
                        ))}
                    </Group>
                </Box>
            )}

            {/* Message Input */}
            <Group
                gap={8}
                p={12}
                align="flex-end"
                wrap="nowrap"
                style={{borderTop: '1px solid var(--mantine-color-default-border)'}}
            >
                <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="lg"
                    onClick={onToggleQuickResponses}
                    aria-label="Quick responses"
                >
                    <Icon lucide={Zap}/>
                </ActionIcon>
                <Textarea
                    style={{flex: 1}}
                    radius="xl"
                    autosize
                    maxRows={4}
                    placeholder="Type a message..."
                    aria-label="Type a message"
                    value={newMessage}
                    onChange={(e) => onMessageChange(e.currentTarget.value)}
                    onKeyDown={onKeyPress}
                />
                <AiDraftButton category="writing" onClick={onDraft} isDrafting={isDrafting} />
                {selectedConversation.otherPartyType === OtherMessagePartyType.Courier && (
                    <Select
                        size="sm"
                        w={92}
                        aria-label="Delivery method"
                        allowDeselect={false}
                        comboboxProps={{keepMounted: false}}
                        /* The delivery type is a numeric enum and Select speaks
                           strings, so the id round-trips through String/Number. */
                        value={String(messageDeliveryType)}
                        onChange={(value) => value && onDeliveryTypeChange(Number(value) as MessageDeliveryType)}
                        data={[
                            {value: String(MessageDeliveryType.App), label: 'App'},
                            {value: String(MessageDeliveryType.Sms), label: 'SMS'},
                            {value: String(MessageDeliveryType.SmartDelivery), label: 'Smart'},
                        ]}
                    />
                )}
                <ActionIcon
                    size="lg"
                    onClick={onSendMessage}
                    disabled={!newMessage.trim() || isSending}
                    aria-label="Send message"
                    loading={isSending}
                >
                    <Icon lucide={Send}/>
                </ActionIcon>
            </Group>
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

    /** Timestamp and delivery ticks, right-aligned under the message. */
    const meta = (children: React.ReactNode) => (
        <Group gap={4} mt={4} justify="flex-end" wrap="nowrap">{children}</Group>
    );

    return (
        <Group
            gap={8}
            align="flex-end"
            wrap="nowrap"
            justify={isSent ? 'flex-end' : 'flex-start'}
            mb={isLastInGroup ? 8 : 2}
        >
            {!isSent && (
                isLastInGroup
                    ? (
                        <Avatar color="brand" radius="xl" size={28} style={{flexShrink: 0, fontSize: 12}}>
                            {avatarInitials}
                        </Avatar>
                    )
                    : <Box w={28} style={{flexShrink: 0}}/>
            )}
            <Box
                px={16}
                py={8}
                style={{
                    maxWidth: '70%',
                    borderRadius,
                    /* The filled brand is too light to carry white text, so a sent
                       bubble uses the darker brand step — the same reason the MUI
                       version reached past primary.main for primary.dark. */
                    background: isSent
                        ? 'var(--mantine-color-brand-8)'
                        : 'var(--mantine-color-body)',
                    color: isSent ? 'var(--mantine-color-white)' : undefined,
                    border: isSent ? 'none' : '1px solid var(--mantine-color-default-border)',
                }}
            >
                <Text fz="sm" style={MESSAGE_BODY_STYLE}>{message.message}</Text>
                {isFailed ? meta(
                    <>
                        <Box c="red.5" style={{display: 'flex'}}>
                            <Icon lucide={CircleAlert} size={14} aria-label="Failed to send"/>
                        </Box>
                        <Text fz="xs">Failed</Text>
                        <Button
                            variant="transparent"
                            size="compact-xs"
                            c="inherit"
                            onClick={() => onRetry?.(message)}
                            aria-label="Retry sending message"
                            style={{textDecoration: 'underline'}}
                        >
                            Retry
                        </Button>
                    </>
                ) : showMeta && meta(
                    <>
                        {isLastInGroup && (
                            <Text fz="xs" opacity={isSent ? 0.8 : 0.6}>
                                {formatMessageTime(message.messageTime)}
                            </Text>
                        )}
                        {isSent && isSending && (
                            <Icon lucide={Clock} size={14} aria-label="Sending" style={{opacity: 0.8}}/>
                        )}
                        {isSent && !isSending && message.read && (
                            <Icon lucide={CheckCheck} size={14} aria-label="Read" style={{opacity: 0.8}}/>
                        )}
                        {isSent && !isSending && !message.read && message.sent && (
                            <Icon lucide={Check} size={14} aria-label="Sent" style={{opacity: 0.8}}/>
                        )}
                    </>
                )}
            </Box>
        </Group>
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
    /** The uppercase label above each group of results. */
    const groupLabel = (text: string) => (
        <Text fz="xs" fw={600} c="dimmed" px={16} tt="uppercase" style={{letterSpacing: 0.5}}>
            {text}
        </Text>
    );

    return (
        <Box
            component="section"
            style={{display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden'}}
        >
            {/* Multi-select Header */}
            {isMultiSelectMode && (
                <Group
                    justify="space-between"
                    p={12}
                    bg="var(--mantine-primary-color-light)"
                    style={{borderBottom: '1px solid var(--mantine-color-default-border)'}}
                >
                    <Text fw={500}>{selectedContacts.length} selected</Text>
                    <Group gap={8}>
                        <Button
                            size="xs"
                            variant="subtle"
                            onClick={onClearSelectedContacts}
                            disabled={selectedContacts.length === 0}
                        >
                            Clear
                        </Button>
                        <Button size="xs" variant="subtle" color="red" onClick={onToggleMultiSelect}>
                            Cancel
                        </Button>
                    </Group>
                </Group>
            )}

            {/* Search Section */}
            <Group
                gap={12}
                p={16}
                wrap="nowrap"
                bg="var(--mantine-color-gray-0)"
                style={{borderBottom: '1px solid var(--mantine-color-default-border)'}}
            >
                <TextInput
                    size="sm"
                    radius="xl"
                    style={{flex: 1}}
                    placeholder="Search by name or ID..."
                    aria-label="Search by name or ID"
                    value={searchTerm}
                    onChange={(e) => onSearch(e.currentTarget.value)}
                    leftSection={<Icon lucide={Search} size={16}/>}
                    rightSection={searchTerm
                        ? <CloseButton size="sm" aria-label="Clear search" onClick={onClearSearch}/>
                        : null}
                />
                <Button
                    size="sm"
                    variant={isMultiSelectMode ? 'filled' : 'default'}
                    onClick={onToggleMultiSelect}
                    aria-pressed={isMultiSelectMode}
                    leftSection={<Icon lucide={isMultiSelectMode ? SquareCheckBig : Square} size={16}/>}
                >
                    Multi
                </Button>
            </Group>

            {/* Loading */}
            {isSearching && (
                <Group justify="center" gap={12} p={24}>
                    <Loader size={24} aria-label="Searching"/>
                    <Text c="dimmed">Searching...</Text>
                </Group>
            )}

            {/* Results */}
            <Box style={{flex: 1, overflow: 'auto'}}>
                {/* Recent Conversations */}
                {!searchTerm && recentConversations.length > 0 && (
                    <Box py={16}>
                        {groupLabel('Recent')}
                        <Box component="ul" m={0} p={0} style={{listStyle: 'none'}}>
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
                        </Box>
                    </Box>
                )}

                {/* Search Results */}
                {searchTerm && searchResults.length > 0 && (
                    <Box py={16}>
                        {groupLabel(`Results (${searchResults.length})`)}
                        <Box component="ul" m={0} p={0} style={{listStyle: 'none'}}>
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
                        </Box>
                    </Box>
                )}

                {/* No Results */}
                {searchTerm && !isSearching && searchResults.length === 0 && (
                    <EmptyState
                        icon={<Icon lucide={SearchX} size={EMPTY_GLYPH_SIZE}/>}
                        message={`No results for "${searchTerm}"`}
                    />
                )}

                {/* Empty State */}
                {!searchTerm && recentConversations.length === 0 && (
                    <EmptyState
                        icon={<Icon lucide={UserSearch} size={EMPTY_GLYPH_SIZE}/>}
                        message="Search to start a conversation"
                    />
                )}

                {/* Multi-select Compose */}
                {isMultiSelectMode && selectedContacts.length > 0 && (
                    <Paper m={16} p={16} radius="md" bg="var(--mantine-color-gray-1)">
                        <Text fw={500} mb={12}>
                            Send to {selectedContacts.length} contact{selectedContacts.length !== 1 ? 's' : ''}
                        </Text>
                        <Textarea
                            rows={3}
                            mb={12}
                            placeholder="Type your message..."
                            aria-label="Message to selected contacts"
                            value={newMessage}
                            onChange={(e) => onMessageChange(e.currentTarget.value)}
                        />
                        <Group justify="flex-end">
                            <Button
                                leftSection={<Icon lucide={Send} size={16}/>}
                                loading={isSending}
                                onClick={onSendMultiMessage}
                                disabled={!newMessage.trim() || isSending}
                            >
                                Send
                            </Button>
                        </Group>
                    </Paper>
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
        <Box
            component="li"
            onClick={onSelect}
            px={16}
            py={8}
            bg={isSelected ? 'var(--mantine-color-gray-1)' : undefined}
            style={{cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12}}
        >
            {isMultiSelectMode && (
                <Checkbox
                    checked={isSelected}
                    aria-label={`Select ${name}`}
                    onChange={onToggleSelection}
                    onClick={(e) => e.stopPropagation()}
                />
            )}
            <Avatar color="brand" radius="xl">{initials}</Avatar>
            <Box style={{flex: 1, minWidth: 0}}>
                <Text fz="sm" truncate>
                    {highlightTerm
                        ? <span dangerouslySetInnerHTML={{__html: highlightSearchTerm(name, highlightTerm)}}/>
                        : name}
                </Text>
                <Text fz="xs" c="dimmed">
                    {type === OtherMessagePartyType.Courier ? 'Courier' : 'Staff'}
                </Text>
            </Box>
            {status && (
                <Box
                    w={10}
                    h={10}
                    style={{
                        borderRadius: '50%',
                        background: `var(--mantine-color-${getStatusColor(status)}-filled)`,
                        flexShrink: 0,
                    }}
                />
            )}
        </Box>
    );
}

interface EmptyStateProps {
    icon: React.ReactNode;
    message: string;
    action?: React.ReactNode;
}

function EmptyState({icon, message, action}: EmptyStateProps) {
    return (
        <Stack flex={1} align="center" justify="center" gap={16} p={40}>
            <Box c="dimmed" opacity={0.5}>{icon}</Box>
            <Text c="dimmed">{message}</Text>
            {action}
        </Stack>
    );
}

interface ErrorStateProps {
    message: string;
    onRetry: () => void;
}

function ErrorState({message, onRetry}: ErrorStateProps) {
    return (
        <Stack flex={1} align="center" justify="center" gap={16} p={40}>
            <Box c="red.6">
                <Icon lucide={CircleAlert} size={64}/>
            </Box>
            <Title order={5}>Unable to load messages</Title>
            <Text c="dimmed">{message}</Text>
            <Button leftSection={<Icon lucide={RefreshCw} size={16}/>} onClick={onRetry}>
                Retry
            </Button>
        </Stack>
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

/** A Mantine palette key — Indicator takes it directly, the dot builds a var from it. */
function getStatusColor(status: string): string {
    const normalizedStatus = status?.toLowerCase() || '';
    if (normalizedStatus === 'online' || normalizedStatus === 'active') return 'green';
    if (normalizedStatus === 'away' || normalizedStatus === 'busy') return 'yellow';
    return 'gray';
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
    return escapedText.replace(regex, '<mark>$1</mark>');
}

export default MessagingDialog;
