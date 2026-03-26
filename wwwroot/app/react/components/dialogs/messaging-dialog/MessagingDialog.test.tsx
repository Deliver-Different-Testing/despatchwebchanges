/** @jest-environment jest-environment-jsdom */
/**
 * MessagingDialog Component Tests
 *
 * Optimised: read-only tests consolidated; fireEvent for simple clicks.
 */

import React from 'react';
import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {MessagingDialog} from './MessagingDialog';
import {messagingApi} from '../../../services/messagingApi';
import {suppressConsoleError} from '../../../__testUtils__';
import {ChatMessage, MessageDeliveryType, OtherMessagePartyType, QuickResponse, RecentConversation} from './types';

jest.mock('../../../services/messagingApi', () => ({
    messagingApi: {
        getRecentList: jest.fn(),
        getMessages: jest.fn(),
        sendMessage: jest.fn(),
        sendMultiMessage: jest.fn(),
        markMessagesAsRead: jest.fn(),
        getQuickResponses: jest.fn(),
        addQuickResponse: jest.fn(),
        deleteQuickResponse: jest.fn(),
        getMessageContactOptions: jest.fn(),
    },
}));

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
    it('renders dialog with title, conversations panel, and calls onClose on close button', async () => {
        const user = userEvent.setup();
        setupApiDefaults();
        const onClose = jest.fn();
        renderWithTheme(<MessagingDialog {...defaultProps} onClose={onClose} />);

        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Message Center')).toBeInTheDocument();
        expect(screen.getByText('Conversations')).toBeInTheDocument();

        // Close button — find within the dialog's gradient header (parent of the title)
        const header = screen.getByText('Message Center').closest('div')!.parentElement!;
        await user.click(within(header).getByRole('button'));
        expect(onClose).toHaveBeenCalled();
    });

    // ── Closed dialog ───────────────────────────────────────────────
    it('does not render dialog content when closed', () => {
        setupApiDefaults();
        renderWithTheme(<MessagingDialog {...defaultProps} open={false}/>);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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

        await waitFor(() => {
            expect(screen.getByText('Alice Cooper')).toBeInTheDocument();
            expect(screen.getByText('Bob Smith')).toBeInTheDocument();
            expect(screen.getByText('Spammer')).toBeInTheDocument();
        });

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
        const user = userEvent.setup();
        setupApiDefaults([]);
        renderWithTheme(<MessagingDialog {...defaultProps} />);

        await waitFor(() => {
            expect(screen.getByText('No conversations yet')).toBeInTheDocument();
            expect(screen.getByText('Start Conversation')).toBeInTheDocument();
        });

        await user.click(screen.getByText('Start Conversation'));
        expect(await screen.findByText('Search to start a conversation')).toBeInTheDocument();
    });

    // ── Error state + Retry ─────────────────────────────────────────
    it('displays error state with Retry button and recovers on retry', async () => {
        const user = userEvent.setup();
        mockApi.getRecentList.mockRejectedValueOnce(new Error('Server error'));
        mockApi.getQuickResponses.mockResolvedValue([]);
        renderWithTheme(<MessagingDialog {...defaultProps} />);

        await waitFor(() => {
            expect(screen.getByText('Unable to load messages')).toBeInTheDocument();
            expect(screen.getByText('Server error')).toBeInTheDocument();
        });
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
        const user = userEvent.setup();
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
        const user = userEvent.setup();
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
        await waitFor(() => {
            expect(screen.getByText('Read message')).toBeInTheDocument();
            expect(screen.getByText('Sent unread')).toBeInTheDocument();
            expect(screen.getByText('They sent this')).toBeInTheDocument();
            // DoneAllIcon for read, DoneIcon for sent-unread
            expect(screen.getByTestId('DoneAllIcon')).toBeInTheDocument();
            expect(screen.getByTestId('DoneIcon')).toBeInTheDocument();
        });
    });

    // ── Sending messages + empty check (single render) ──────────────
    describe('Sending Messages', () => {
        let errorSpy: jest.SpyInstance;
        beforeEach(() => { errorSpy = suppressConsoleError('Failed to send message'); });
        afterEach(() => { errorSpy.mockRestore(); });

        it('disables send for empty input, sends message, and shows success toast', async () => {
            const user = userEvent.setup();
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
            const user = userEvent.setup();
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
        const user = userEvent.setup();
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
        const user = userEvent.setup();
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

        await waitFor(() => {
            expect(screen.getByText('New Conversation')).toBeInTheDocument();
            expect(screen.getByPlaceholderText('Search by name or ID...')).toBeInTheDocument();
            expect(screen.getByText('Multi')).toBeInTheDocument();
        });

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
});
