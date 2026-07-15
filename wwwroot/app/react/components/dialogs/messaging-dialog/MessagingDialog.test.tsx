/**
 * MessagingDialog Component Tests
 *
 * Optimised: read-only tests consolidated; fireEvent for simple clicks.
 */

import React from 'react';
import {render, screen, waitFor, within} from '@testing-library/react';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {MessagingDialog, isNearBottom} from './MessagingDialog';
import {dayjs} from '../../../utils/dateUtils';
import {messagingApi} from '../../../services/messagingApi';
import { suppressConsoleError } from '../../../__testUtils__';
import { setupUser } from '../../../__testUtils__/setupUser';
import {ChatMessage, MessageDeliveryType, OtherMessagePartyType, QuickResponse, RecentConversation} from './types';

jest.mock('../../../services/messagingApi', () => {
    const methods = {
        getRecentList: jest.fn(),
        getMessages: jest.fn(),
        sendMessage: jest.fn(),
        sendMultiMessage: jest.fn(),
        markMessagesAsRead: jest.fn(),
        getQuickResponses: jest.fn(),
        addQuickResponse: jest.fn(),
        deleteQuickResponse: jest.fn(),
        getMessageContactOptions: jest.fn(),
    };
    return {
        __esModule: true,
        default: methods,
        messagingApi: methods,
    };
});

const mockApi = messagingApi as jest.Mocked<typeof messagingApi>;
const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

const defaultProps = {
    open: true,
    onClose: jest.fn(),
    showToast: jest.fn(),
    currentStaffId: 42,
    currentStaffName: 'Test Staff',
    timeZone: 'Europe/London',
};

function createConversation(overrides?: Partial<RecentConversation>): RecentConversation {
    return {
        otherPartyId: 1,
        otherPartyType: OtherMessagePartyType.Courier,
        otherPartyName: 'John Driver',
        otherPartyInitials: 'JD',
        otherPartyStatus: 'online',
        unreadCount: 0,
        lastMessage: 'Hello there',
        lastMessageTime: '2024-06-01T10:00:00Z',
        ...overrides,
    };
}

function createMessage(overrides?: Partial<ChatMessage>): ChatMessage {
    return {
        messageId: 1,
        sendFromStaffId: 42,
        sendToCourierId: 1,
        message: 'Test message',
        messageTime: '2024-06-01T10:00:00Z',
        read: true,
        sent: true,
        isSender: true,
        ...overrides,
    };
}

function setupApiDefaults(conversations: RecentConversation[] = []) {
    mockApi.getRecentList.mockResolvedValue(conversations);
    mockApi.getMessages.mockResolvedValue([]);
    mockApi.getQuickResponses.mockResolvedValue([]);
    mockApi.markMessagesAsRead.mockResolvedValue(undefined);
    mockApi.sendMessage.mockResolvedValue(undefined);
    mockApi.sendMultiMessage.mockResolvedValue(undefined);
    mockApi.getMessageContactOptions.mockResolvedValue([]);
}

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = jest.fn();

describe('MessagingDialog', () => {
    // ── Rendering + close (single render) ───────────────────────────
    it('renders drawer with title, conversations panel, and calls onClose on close button', async () => {
        const user = setupUser();
        setupApiDefaults();
        const onClose = jest.fn();
        renderWithTheme(<MessagingDialog {...defaultProps} onClose={onClose} />);

        expect(await screen.findByText('Message Center')).toBeInTheDocument();
        expect(screen.getByText('Conversations')).toBeInTheDocument();

        // Close button — find within the drawer's gradient header (parent of the title)
        const header = screen.getByText('Message Center').closest('div')!.parentElement!;
        await user.click(within(header).getByRole('button'));
        expect(onClose).toHaveBeenCalled();
    });

    // ── Outside click does not dismiss ──────────────────────────────
    it('stays open on backdrop (outside) click but closes on the close button', async () => {
        const user = setupUser();
        setupApiDefaults();
        const onClose = jest.fn();
        renderWithTheme(<MessagingDialog {...defaultProps} onClose={onClose} />);

        expect(await screen.findByText('Message Center')).toBeInTheDocument();

        // Clicking the dimmed backdrop outside the panel must NOT close it.
        const backdrop = document.querySelector('.MuiBackdrop-root');
        expect(backdrop).not.toBeNull();
        await user.click(backdrop as Element);
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByText('Message Center')).toBeInTheDocument();

        // The header close button still dismisses.
        const header = screen.getByText('Message Center').closest('div')!.parentElement!;
        await user.click(within(header).getByRole('button'));
        expect(onClose).toHaveBeenCalled();
    });

    // ── Closed drawer ───────────────────────────────────────────────
    it('does not render drawer content when closed', () => {
        setupApiDefaults();
        renderWithTheme(<MessagingDialog {...defaultProps} open={false}/>);
        expect(screen.queryByText('Message Center')).not.toBeInTheDocument();
    });

    // ── Accessibility: labelled controls + live region ─────────────
    it('exposes accessible names on icon controls and a live region for messages', async () => {
        const user = setupUser();
        setupApiDefaults([createConversation({otherPartyId: 10})]);
        renderWithTheme(<MessagingDialog {...defaultProps} />);

        // Conversation-list controls are labelled
        expect(await screen.findByRole('button', {name: /close message center/i})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /refresh conversations/i})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /new conversation/i})).toBeInTheDocument();

        // Open a conversation to reveal the chat-panel controls + message log
        await user.click(await screen.findByText('John Driver'));

        expect(await screen.findByRole('button', {name: /send message/i})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /quick responses/i})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /refresh messages/i})).toBeInTheDocument();
        // Incoming messages are announced to screen readers
        expect(screen.getByRole('log')).toBeInTheDocument();
    });

    // ── Message grouping: consecutive same-sender messages share one timestamp ─
    it('groups consecutive same-sender messages so only the last shows a timestamp', async () => {
        const user = setupUser();
        setupApiDefaults([createConversation({otherPartyId: 10})]);
        // Two messages from the same sender, same minute → one group.
        mockApi.getMessages.mockResolvedValue([
            createMessage({messageId: 1, message: 'First', isSender: true, read: true, messageTime: '2020-01-15T09:00:00'}),
            createMessage({messageId: 2, message: 'Second', isSender: true, read: true, messageTime: '2020-01-15T09:00:00'}),
        ]);
        renderWithTheme(<MessagingDialog {...defaultProps} />);

        await user.click(await screen.findByText('John Driver'));

        // Both bubbles render…
        expect(await screen.findByText('First')).toBeInTheDocument();
        expect(screen.getByText('Second')).toBeInTheDocument();
        // …but the grouped run shows a single message timestamp (the last bubble's),
        // not one per message. (The "Jan 15, 2020" date separator is excluded by
        // matching the HH:mm time portion.)
        expect(screen.getAllByText(/\d{1,2}:\d{2}/)).toHaveLength(1);
    });

    // ── Conversations list: unread counts, previews, truncation, prefixes (single render) ─
    it('displays conversations with unread counts, 99+ cap, message previews, truncation, and sender prefixes', async () => {
        const longMessage = 'A'.repeat(50);
        const conversations = [
            createConversation({otherPartyName: 'Alice Cooper', otherPartyInitials: 'AC', unreadCount: 0, lastMessage: 'See you tomorrow'}),
            createConversation({otherPartyId: 2, otherPartyName: 'Bob Smith', otherPartyInitials: 'BS', unreadCount: 2, lastMessage: 'New message'}),
            createConversation({otherPartyId: 3, otherPartyName: 'Spammer', otherPartyInitials: 'SP', unreadCount: 150, lastMessage: longMessage}),
        ];
        setupApiDefaults(conversations);
        renderWithTheme(<MessagingDialog {...defaultProps} />);

        expect(await screen.findByText('Alice Cooper')).toBeInTheDocument();
        expect(screen.getByText('Bob Smith')).toBeInTheDocument();
        expect(screen.getByText('Spammer')).toBeInTheDocument();

        // Unread count chips
        expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
        // 99+ cap for high unread
        expect(screen.getAllByText('99+').length).toBeGreaterThanOrEqual(1);

        // Message previews
        expect(screen.getByText(/See you tomorrow/)).toBeInTheDocument();
        // Truncated long message
        expect(screen.getByText(new RegExp('A{40}\\.\\.\\.'))).toBeInTheDocument();

        // Sender prefixes: "You:" for read (unread=0), "Bob:" for unread >0
        expect(screen.getByText('You:')).toBeInTheDocument();
        expect(screen.getByText('Bob Smith:')).toBeInTheDocument();
    });

    // ── Empty state + Start Conversation → new chat search ──────────
    it('shows empty state and navigates to new conversation search view', async () => {
        const user = setupUser();
        setupApiDefaults([]);
        renderWithTheme(<MessagingDialog {...defaultProps} />);

        expect(await screen.findByText('No conversations yet')).toBeInTheDocument();
        expect(screen.getByText('Start Conversation')).toBeInTheDocument();

        await user.click(screen.getByText('Start Conversation'));
        expect(await screen.findByText('Search to start a conversation')).toBeInTheDocument();
    });

    // ── Error state + Retry ─────────────────────────────────────────
    it('displays error state with Retry button and recovers on retry', async () => {
        const user = setupUser();
        mockApi.getRecentList.mockRejectedValueOnce(new Error('Server error'));
        mockApi.getQuickResponses.mockResolvedValue([]);
        renderWithTheme(<MessagingDialog {...defaultProps} />);

        expect(await screen.findByText('Unable to load messages')).toBeInTheDocument();
        expect(screen.getByText('Server error')).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /Retry/i})).toBeInTheDocument();

        // Retry
        mockApi.getRecentList.mockResolvedValueOnce([createConversation({otherPartyName: 'Recovered'})]);
        mockApi.getMessages.mockResolvedValue([]);
        mockApi.markMessagesAsRead.mockResolvedValue(undefined);
        mockApi.sendMessage.mockResolvedValue(undefined);
        mockApi.sendMultiMessage.mockResolvedValue(undefined);
        mockApi.getMessageContactOptions.mockResolvedValue([]);

        await user.click(screen.getByRole('button', {name: /Retry/i}));
        expect(await screen.findByText('Recovered')).toBeInTheDocument();
    });

    // ── Chat Panel: placeholder → select conversation → header, type, empty messages (single render) ─
    it('shows placeholder, then header/input/party type/empty messages when conversation selected', async () => {
        const user = setupUser();
        setupApiDefaults([
            createConversation({
                otherPartyName: 'Alice',
                otherPartyType: OtherMessagePartyType.Courier,
                otherPartyStatus: 'online',
            }),
        ]);
        renderWithTheme(<MessagingDialog {...defaultProps} />);

        // Placeholder when no conversation selected
        expect(await screen.findByText('Select a conversation or start a new one')).toBeInTheDocument();

        // Select conversation (wait for conversations to load)
        await user.click(await screen.findByText('Alice'));

        // Header shows name in both list and chat panel
        await waitFor(() => {
            expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(2);
        });
        expect(await screen.findByText(/Courier/)).toBeInTheDocument();
        expect(await screen.findByPlaceholderText('Type a message...')).toBeInTheDocument();
        expect(await screen.findByText('Smart')).toBeInTheDocument();

        // Empty messages state
        expect(await screen.findByText('Start the conversation')).toBeInTheDocument();
    });

    // ── Messages + mark as read + bubble rendering (single render) ──
    it('loads messages, marks as read, and renders sent/received bubbles with status indicators', async () => {
        const user = setupUser();
        const conversations = [createConversation({otherPartyId: 10, unreadCount: 3})];
        const messages = [
            createMessage({messageId: 1, message: 'Read message', isSender: true, read: true, sent: true}),
            createMessage({messageId: 2, message: 'Sent unread', isSender: true, read: false, sent: true}),
            createMessage({messageId: 3, message: 'They sent this', isSender: false, sendFromCourierId: 10}),
        ];
        setupApiDefaults(conversations);
        mockApi.getMessages.mockResolvedValue(messages);
        renderWithTheme(<MessagingDialog {...defaultProps} />);

        expect(await screen.findByText('John Driver')).toBeInTheDocument();
        await user.click(screen.getByText('John Driver'));

        // API calls
        await waitFor(() => {
            expect(mockApi.getMessages).toHaveBeenCalledWith(10, OtherMessagePartyType.Courier, 42);
            expect(mockApi.markMessagesAsRead).toHaveBeenCalledWith(10, OtherMessagePartyType.Courier);
        });

        // Message bubbles
        expect(await screen.findByText('Read message')).toBeInTheDocument();
        expect(screen.getByText('Sent unread')).toBeInTheDocument();
        expect(screen.getByText('They sent this')).toBeInTheDocument();
        // DoneAllIcon for read, DoneIcon for sent-unread
        expect(screen.getByTestId('DoneAllIcon')).toBeInTheDocument();
        expect(screen.getByTestId('DoneIcon')).toBeInTheDocument();
    });

    // ── Sending messages + empty check (single render) ──────────────
    describe('Sending Messages', () => {
        let errorSpy: jest.SpyInstance;
        beforeEach(() => { errorSpy = suppressConsoleError('Failed to send message'); });
        afterEach(() => { errorSpy.mockRestore(); });

        it('disables send for empty input, sends message, and shows success toast', async () => {
            const user = setupUser();
            const showToast = jest.fn();
            setupApiDefaults([createConversation({otherPartyId: 10})]);
            renderWithTheme(<MessagingDialog {...defaultProps} showToast={showToast}/>);

            expect(await screen.findByText('John Driver')).toBeInTheDocument();
            await user.click(screen.getByText('John Driver'));
            expect(await screen.findByPlaceholderText('Type a message...')).toBeInTheDocument();

            // Send button disabled when empty
            const sendButton = screen.getAllByRole('button').find(btn =>
                btn.querySelector('[data-testid="SendIcon"]')
            );
            expect(sendButton).toBeDisabled();

            // Type and send
            await user.click(screen.getByPlaceholderText('Type a message...'));
            await user.paste('Hello driver!');

            await user.click(sendButton!);

            await waitFor(() => {
                expect(mockApi.sendMessage).toHaveBeenCalledWith(
                    expect.objectContaining({
                        sendToCourierId: 10,
                        message: 'Hello driver!',
                        messageType: MessageDeliveryType.SmartDelivery,
                    })
                );
                expect(showToast).toHaveBeenCalledWith('Message sent', 'success');
            });
        });

        it('shows error toast when sending fails', async () => {
            const user = setupUser();
            const showToast = jest.fn();
            setupApiDefaults([createConversation({otherPartyId: 10})]);
            mockApi.sendMessage.mockRejectedValueOnce(new Error('Send failed'));
            renderWithTheme(<MessagingDialog {...defaultProps} showToast={showToast} />);

            expect(await screen.findByText('John Driver')).toBeInTheDocument();
            await user.click(screen.getByText('John Driver'));
            expect(await screen.findByPlaceholderText('Type a message...')).toBeInTheDocument();

            await user.click(screen.getByPlaceholderText('Type a message...'));
            await user.paste('Fail');

            const sendButton = screen.getAllByRole('button').find(btn =>
                btn.querySelector('[data-testid="SendIcon"]')
            );
            await user.click(sendButton!);

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith('Failed to send message', 'error');
            });
        }, 30000);
    });

    // ── Quick Responses ─────────────────────────────────────────────
    it('toggles quick responses panel', async () => {
        const user = setupUser();
        const quickResponses: QuickResponse[] = [
            {id: 1, text: 'On my way!'},
            {id: 2, text: 'Delivered'},
        ];
        setupApiDefaults([createConversation()]);
        mockApi.getQuickResponses.mockResolvedValue(quickResponses);
        renderWithTheme(<MessagingDialog {...defaultProps} />);

        expect(await screen.findByText('John Driver')).toBeInTheDocument();
        await user.click(screen.getByText('John Driver'));
        expect(await screen.findByPlaceholderText('Type a message...')).toBeInTheDocument();

        const quickReplyButton = screen.getAllByRole('button').find(btn =>
            btn.querySelector('[data-testid="QuickreplyOutlinedIcon"]')
        );
        await user.click(quickReplyButton!);

        expect(await screen.findByText('Quick Responses')).toBeInTheDocument();
    });

    // ── New Chat View: navigation, back button, Multi mode, recent conversations (single render) ─
    it('opens new conversation view with search, Multi, back, and shows recent conversations', async () => {
        const user = setupUser();
        const conversations = [
            createConversation({otherPartyId: 1, otherPartyName: 'Recent Alice'}),
            createConversation({otherPartyId: 2, otherPartyName: 'Recent Bob'}),
        ];
        setupApiDefaults(conversations);
        renderWithTheme(<MessagingDialog {...defaultProps} />);

        expect(await screen.findByText('Recent Alice')).toBeInTheDocument();

        const addChatButton = screen.getAllByRole('button').find(btn =>
            btn.querySelector('[data-testid="AddCommentIcon"]')
        );
        await user.click(addChatButton!);

        expect(await screen.findByText('New Conversation')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Search by name or ID...')).toBeInTheDocument();
        expect(screen.getByText('Multi')).toBeInTheDocument();

        // Recent conversations shown
        expect(screen.getByText('Recent')).toBeInTheDocument();

        // Back button returns to main
        const backButton = screen.getAllByRole('button').find(btn =>
            btn.querySelector('[data-testid="ArrowBackIcon"]')
        );
        expect(backButton).toBeDefined();
        await user.click(backButton!);
        expect(await screen.findByText('Message Center')).toBeInTheDocument();
    });

    // ── Conversation list filter: by name and unread-only ───────────
    it('filters the conversation list by name and by unread', async () => {
        const user = setupUser();
        setupApiDefaults([
            createConversation({otherPartyId: 1, otherPartyName: 'Alice', unreadCount: 0}),
            createConversation({otherPartyId: 2, otherPartyName: 'Bob', unreadCount: 3}),
        ]);
        renderWithTheme(<MessagingDialog {...defaultProps} />);

        await screen.findByText('Alice');
        expect(screen.getByText('Bob')).toBeInTheDocument();

        // Filter by name
        await user.type(screen.getByLabelText('Filter conversations'), 'ali');
        await waitFor(() => expect(screen.queryByText('Bob')).not.toBeInTheDocument());
        expect(screen.getByText('Alice')).toBeInTheDocument();

        // Clear, then unread-only
        await user.click(screen.getByLabelText('Clear filter'));
        await user.click(screen.getByRole('button', {name: 'Unread'}));
        await waitFor(() => expect(screen.queryByText('Alice')).not.toBeInTheDocument());
        expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    // ── Mark-as-read quick action from the list ─────────────────────
    it('marks a conversation as read from the list quick action', async () => {
        const user = setupUser();
        setupApiDefaults([createConversation({otherPartyId: 10, otherPartyName: 'John Driver', unreadCount: 2})]);
        renderWithTheme(<MessagingDialog {...defaultProps} />);

        const markBtn = await screen.findByRole('button', {name: /mark conversation with john driver as read/i});
        await user.click(markBtn);

        await waitFor(() => {
            expect(mockApi.markMessagesAsRead).toHaveBeenCalledWith(10, OtherMessagePartyType.Courier);
        });
        // The action disappears once the conversation has no unread messages
        await waitFor(() =>
            expect(screen.queryByRole('button', {name: /mark conversation with john driver as read/i})).not.toBeInTheDocument()
        );
    });

    // ── Relative date separator ─────────────────────────────────────
    it('labels the date separator "Today" for messages sent today', async () => {
        const user = setupUser();
        // Build "today" from the same clock the component uses (dayjs, local
        // wall-clock) — not new Date().toISOString() (UTC), which is the
        // previous calendar day during NZ morning hours and mislabels the
        // separator as "Yesterday".
        const today = dayjs().format('YYYY-MM-DD');
        setupApiDefaults([createConversation({otherPartyId: 10})]);
        mockApi.getMessages.mockResolvedValue([
            createMessage({messageId: 1, message: 'Hi today', messageTime: `${today}T10:00:00`}),
        ]);
        renderWithTheme(<MessagingDialog {...defaultProps} />);

        await user.click(await screen.findByText('John Driver'));
        expect(await screen.findByText('Today')).toBeInTheDocument();
    });

    // ── Sending / failed message states ─────────────────────────────
    it('shows a sending indicator while a message is in flight', async () => {
        const user = setupUser();
        setupApiDefaults([createConversation({otherPartyId: 10})]);
        let resolveSend!: () => void;
        mockApi.sendMessage.mockImplementationOnce(
            () => new Promise<void>((res) => { resolveSend = () => res(); })
        );
        renderWithTheme(<MessagingDialog {...defaultProps} />);

        await user.click(await screen.findByText('John Driver'));
        await user.click(await screen.findByPlaceholderText('Type a message...'));
        await user.paste('Pending msg');
        await user.click(screen.getByRole('button', {name: /send message/i}));

        // Optimistic bubble appears immediately with a "Sending" indicator
        expect(await screen.findByText('Pending msg')).toBeInTheDocument();
        expect(screen.getByTitle('Sending')).toBeInTheDocument();

        resolveSend();
        await waitFor(() => expect(screen.queryByTitle('Sending')).not.toBeInTheDocument());
    });

    it('shows a failed state with retry when sending fails, and resends on retry', async () => {
        const user = setupUser();
        const errorSpy = suppressConsoleError('Failed to send message');
        setupApiDefaults([createConversation({otherPartyId: 10})]);
        mockApi.sendMessage.mockRejectedValueOnce(new Error('network down'));
        renderWithTheme(<MessagingDialog {...defaultProps} />);

        await user.click(await screen.findByText('John Driver'));
        await user.click(await screen.findByPlaceholderText('Type a message...'));
        await user.paste('Retry me');
        await user.click(screen.getByRole('button', {name: /send message/i}));

        const retry = await screen.findByRole('button', {name: /retry sending message/i});
        expect(screen.getByText('Retry me')).toBeInTheDocument();
        expect(screen.getByText('Failed')).toBeInTheDocument();

        // Second attempt uses the default resolved mock
        await user.click(retry);
        await waitFor(() => expect(screen.queryByText('Failed')).not.toBeInTheDocument());
        expect(mockApi.sendMessage).toHaveBeenCalledTimes(2);

        errorSpy.mockRestore();
    });
});

describe('isNearBottom', () => {
    it('is true at/near the bottom and false when scrolled up', () => {
        expect(isNearBottom({scrollHeight: 1000, scrollTop: 920, clientHeight: 100})).toBe(true);
        expect(isNearBottom({scrollHeight: 1000, scrollTop: 850, clientHeight: 100})).toBe(true);
        expect(isNearBottom({scrollHeight: 1000, scrollTop: 800, clientHeight: 100})).toBe(false);
        expect(isNearBottom({scrollHeight: 1000, scrollTop: 0, clientHeight: 100})).toBe(false);
    });
});
