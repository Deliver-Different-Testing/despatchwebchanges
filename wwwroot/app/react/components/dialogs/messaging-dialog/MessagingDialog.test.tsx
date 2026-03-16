/**
 * Tests for MessagingDialog component
 */

import React from 'react';
import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {MessagingDialog} from './MessagingDialog';
import {messagingApi} from '../../../services/messagingApi';
import {ChatMessage, MessageDeliveryType, OtherMessagePartyType, QuickResponse, RecentConversation} from './types';

// Mock the messagingApi service
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
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders dialog when open', async () => {
            setupApiDefaults();
            renderWithTheme(<MessagingDialog {...defaultProps} open={true} />);

            expect(await screen.findByRole('dialog')).toBeInTheDocument();
        });

        it('does not render dialog content when closed', () => {
            setupApiDefaults();
            const { container } = renderWithTheme(
                <MessagingDialog {...defaultProps} open={false} />
            );
            expect(container.querySelector('.MuiDialog-root')).toBeNull();
        });

        it('displays "Message Center" title', async () => {
            setupApiDefaults();
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            expect(await screen.findByText('Message Center')).toBeInTheDocument();
        });

        it('displays "Conversations" panel heading', async () => {
            setupApiDefaults();
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            expect(await screen.findByText('Conversations')).toBeInTheDocument();
        });

        it('calls onClose when close button is clicked', async () => {
            const user = userEvent.setup();
            setupApiDefaults();
            const onClose = jest.fn();
            renderWithTheme(<MessagingDialog {...defaultProps} onClose={onClose} />);

            expect(await screen.findByText('Message Center')).toBeInTheDocument();

            // The close button is the X icon button in the header
            const header = screen.getByText('Message Center').closest('div')!;
            const closeButton = within(header).getByRole('button');
            await user.click(closeButton);

            expect(onClose).toHaveBeenCalled();
        });
    });

    describe('Conversations Loading', () => {
        it('loads conversations on open', async () => {
            setupApiDefaults();
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            await waitFor(() => {
                expect(mockApi.getRecentList).toHaveBeenCalled();
            });
        });

        it('displays conversation names', async () => {
            const conversations = [
                createConversation({ otherPartyName: 'Alice Cooper', otherPartyInitials: 'AC' }),
                createConversation({ otherPartyId: 2, otherPartyName: 'Bob Smith', otherPartyInitials: 'BS' }),
            ];
            setupApiDefaults(conversations);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Alice Cooper')).toBeInTheDocument();
                expect(screen.getByText('Bob Smith')).toBeInTheDocument();
            });
        });

        it('displays unread count chips on conversations', async () => {
            const conversations = [
                createConversation({ otherPartyName: 'Alice', unreadCount: 5 }),
            ];
            setupApiDefaults(conversations);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            await waitFor(() => {
                // Unread count appears in the conversation Chip
                const chipElements = screen.getAllByText('5');
                expect(chipElements.length).toBeGreaterThanOrEqual(1);
            });
        });

        it('displays 99+ for high unread counts', async () => {
            const conversations = [
                createConversation({ otherPartyName: 'Spammer', unreadCount: 150 }),
            ];
            setupApiDefaults(conversations);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            await waitFor(() => {
                // Chip displays 99+ for counts over 99
                const chipElements = screen.getAllByText('99+');
                expect(chipElements.length).toBeGreaterThanOrEqual(1);
            });
        });

        it('shows empty state when no conversations exist', async () => {
            setupApiDefaults([]);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('No conversations yet')).toBeInTheDocument();
                expect(screen.getByText('Start Conversation')).toBeInTheDocument();
            });
        });

        it('shows last message preview in conversation list', async () => {
            const conversations = [
                createConversation({ lastMessage: 'See you tomorrow' }),
            ];
            setupApiDefaults(conversations);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            expect(await screen.findByText(/See you tomorrow/)).toBeInTheDocument();
        });

        it('truncates long last messages at 40 characters', async () => {
            const longMessage = 'A'.repeat(50);
            const conversations = [
                createConversation({ lastMessage: longMessage }),
            ];
            setupApiDefaults(conversations);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            expect(await screen.findByText(new RegExp('A{40}\\.\\.\\.'))).toBeInTheDocument();
        });
    });

    describe('Error State', () => {
        it('displays error state when conversations fail to load', async () => {
            mockApi.getRecentList.mockRejectedValue(new Error('Server error'));
            mockApi.getQuickResponses.mockResolvedValue([]);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('Unable to load messages')).toBeInTheDocument();
                expect(screen.getByText('Server error')).toBeInTheDocument();
            });
        });

        it('shows Retry button on error', async () => {
            mockApi.getRecentList.mockRejectedValue(new Error('Server error'));
            mockApi.getQuickResponses.mockResolvedValue([]);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            expect(await screen.findByRole('button', {name: /Retry/i})).toBeInTheDocument();
        });

        it('retries loading when Retry is clicked', async () => {
            const user = userEvent.setup();
            mockApi.getRecentList.mockRejectedValueOnce(new Error('Server error'));
            mockApi.getQuickResponses.mockResolvedValue([]);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            expect(await screen.findByText('Unable to load messages')).toBeInTheDocument();

            // Now mock a successful response for retry
            mockApi.getRecentList.mockResolvedValueOnce([
                createConversation({ otherPartyName: 'Recovered' }),
            ]);

            await user.click(screen.getByRole('button', { name: /Retry/i }));

            expect(await screen.findByText('Recovered')).toBeInTheDocument();
        });
    });

    describe('Chat Panel - No Conversation Selected', () => {
        it('shows placeholder when no conversation is selected', async () => {
            setupApiDefaults([createConversation()]);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            expect(await screen.findByText('Select a conversation or start a new one')).toBeInTheDocument();
        });
    });

    describe('Chat Panel - Conversation Selected', () => {
        it('shows conversation header when a conversation is selected', async () => {
            const user = userEvent.setup();
            const conversations = [
                createConversation({ otherPartyName: 'Alice', otherPartyInitials: 'AL' }),
            ];
            setupApiDefaults(conversations);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            expect(await screen.findByText('Alice')).toBeInTheDocument();

            await user.click(screen.getByText('Alice'));

            await waitFor(() => {
                // Alice should appear in both the conversation list and the chat header
                const aliceElements = screen.getAllByText('Alice');
                expect(aliceElements.length).toBeGreaterThanOrEqual(2);
            });
        });

        it('shows party type label in chat header', async () => {
            const user = userEvent.setup();
            const conversations = [
                createConversation({
                    otherPartyName: 'Alice',
                    otherPartyType: OtherMessagePartyType.Courier,
                    otherPartyStatus: 'online',
                }),
            ];
            setupApiDefaults(conversations);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            expect(await screen.findByText('Alice')).toBeInTheDocument();

            await user.click(screen.getByText('Alice'));

            expect(await screen.findByText(/Courier/)).toBeInTheDocument();
        });

        it('loads messages when a conversation is selected', async () => {
            const user = userEvent.setup();
            const conversations = [createConversation({ otherPartyId: 10 })];
            const messages = [
                createMessage({ messageId: 1, message: 'Hello from me', isSender: true }),
                createMessage({ messageId: 2, message: 'Hello back', isSender: false }),
            ];
            setupApiDefaults(conversations);
            mockApi.getMessages.mockResolvedValue(messages);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            expect(await screen.findByText('John Driver')).toBeInTheDocument();

            await user.click(screen.getByText('John Driver'));

            await waitFor(() => {
                expect(mockApi.getMessages).toHaveBeenCalledWith(10, OtherMessagePartyType.Courier, 42);
            });

            await waitFor(() => {
                expect(screen.getByText('Hello from me')).toBeInTheDocument();
                expect(screen.getByText('Hello back')).toBeInTheDocument();
            });
        });

        it('shows "Start the conversation" when conversation has no messages', async () => {
            const user = userEvent.setup();
            const conversations = [createConversation()];
            setupApiDefaults(conversations);
            mockApi.getMessages.mockResolvedValue([]);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            expect(await screen.findByText('John Driver')).toBeInTheDocument();

            await user.click(screen.getByText('John Driver'));

            expect(await screen.findByText('Start the conversation')).toBeInTheDocument();
        });

        it('marks messages as read when selecting a conversation with unread messages', async () => {
            const user = userEvent.setup();
            const conversations = [
                createConversation({ otherPartyId: 5, unreadCount: 3 }),
            ];
            setupApiDefaults(conversations);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            expect(await screen.findByText('John Driver')).toBeInTheDocument();

            await user.click(screen.getByText('John Driver'));

            await waitFor(() => {
                expect(mockApi.markMessagesAsRead).toHaveBeenCalledWith(
                    5,
                    OtherMessagePartyType.Courier
                );
            });
        });

        it('shows message input placeholder', async () => {
            const user = userEvent.setup();
            const conversations = [createConversation()];
            setupApiDefaults(conversations);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            expect(await screen.findByText('John Driver')).toBeInTheDocument();

            await user.click(screen.getByText('John Driver'));

            expect(await screen.findByPlaceholderText('Type a message...')).toBeInTheDocument();
        });

        it('shows delivery type selector for courier conversations', async () => {
            const user = userEvent.setup();
            const conversations = [
                createConversation({ otherPartyType: OtherMessagePartyType.Courier }),
            ];
            setupApiDefaults(conversations);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            expect(await screen.findByText('John Driver')).toBeInTheDocument();

            await user.click(screen.getByText('John Driver'));

            // Default delivery type is SmartDelivery shown as "Smart"
            expect(await screen.findByText('Smart')).toBeInTheDocument();
        });
    });

    describe('Sending Messages', () => {
        it('sends a message when send button is clicked', async () => {
            const user = userEvent.setup();
            const conversations = [createConversation({ otherPartyId: 10 })];
            setupApiDefaults(conversations);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            expect(await screen.findByText('John Driver')).toBeInTheDocument();

            await user.click(screen.getByText('John Driver'));

            expect(await screen.findByPlaceholderText('Type a message...')).toBeInTheDocument();

            const input = screen.getByPlaceholderText('Type a message...');
            await user.type(input, 'Hello driver!');

            // Click send button (the colored icon button)
            const sendButtons = screen.getAllByRole('button');
            const sendButton = sendButtons.find(btn =>
                btn.querySelector('[data-testid="SendIcon"]')
            );
            expect(sendButton).toBeDefined();
            await user.click(sendButton!);

            await waitFor(() => {
                expect(mockApi.sendMessage).toHaveBeenCalledWith(
                    expect.objectContaining({
                        sendToCourierId: 10,
                        message: 'Hello driver!',
                        messageType: MessageDeliveryType.SmartDelivery,
                    })
                );
            });
        });

        it('shows success toast after sending', async () => {
            const user = userEvent.setup();
            const showToast = jest.fn();
            const conversations = [createConversation({ otherPartyId: 10 })];
            setupApiDefaults(conversations);
            renderWithTheme(<MessagingDialog {...defaultProps} showToast={showToast} />);

            expect(await screen.findByText('John Driver')).toBeInTheDocument();

            await user.click(screen.getByText('John Driver'));

            expect(await screen.findByPlaceholderText('Type a message...')).toBeInTheDocument();

            const input = screen.getByPlaceholderText('Type a message...');
            await user.type(input, 'Hi!');

            const sendButton = screen.getAllByRole('button').find(btn =>
                btn.querySelector('[data-testid="SendIcon"]')
            );
            await user.click(sendButton!);

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith('Message sent', 'success');
            });
        });

        it('shows error toast when sending fails', async () => {
            const user = userEvent.setup();
            const showToast = jest.fn();
            const conversations = [createConversation({ otherPartyId: 10 })];
            setupApiDefaults(conversations);
            mockApi.sendMessage.mockRejectedValueOnce(new Error('Send failed'));
            renderWithTheme(<MessagingDialog {...defaultProps} showToast={showToast} />);

            expect(await screen.findByText('John Driver')).toBeInTheDocument();

            await user.click(screen.getByText('John Driver'));

            expect(await screen.findByPlaceholderText('Type a message...')).toBeInTheDocument();

            const input = screen.getByPlaceholderText('Type a message...');
            await user.type(input, 'Fail');

            const sendButton = screen.getAllByRole('button').find(btn =>
                btn.querySelector('[data-testid="SendIcon"]')
            );
            await user.click(sendButton!);

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith('Failed to send message', 'error');
            });
        }, 30000);

        it('does not send empty messages', async () => {
            const user = userEvent.setup();
            const conversations = [createConversation({ otherPartyId: 10 })];
            setupApiDefaults(conversations);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            expect(await screen.findByText('John Driver')).toBeInTheDocument();

            await user.click(screen.getByText('John Driver'));

            expect(await screen.findByPlaceholderText('Type a message...')).toBeInTheDocument();

            // Send button should be disabled when input is empty
            const sendButton = screen.getAllByRole('button').find(btn =>
                btn.querySelector('[data-testid="SendIcon"]')
            );
            expect(sendButton).toBeDisabled();
        });
    });

    describe('Quick Responses', () => {
        it('toggles quick responses panel', async () => {
            const user = userEvent.setup();
            const conversations = [createConversation()];
            const quickResponses: QuickResponse[] = [
                { id: 1, text: 'On my way!' },
                { id: 2, text: 'Delivered' },
            ];
            setupApiDefaults(conversations);
            mockApi.getQuickResponses.mockResolvedValue(quickResponses);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            expect(await screen.findByText('John Driver')).toBeInTheDocument();

            await user.click(screen.getByText('John Driver'));

            expect(await screen.findByPlaceholderText('Type a message...')).toBeInTheDocument();

            // Click the quick reply toggle button
            const quickReplyButton = screen.getAllByRole('button').find(btn =>
                btn.querySelector('[data-testid="QuickreplyOutlinedIcon"]')
            );
            expect(quickReplyButton).toBeDefined();
            await user.click(quickReplyButton!);

            expect(await screen.findByText('Quick Responses')).toBeInTheDocument();
        });
    });

    describe('New Chat View', () => {
        it('switches to New Conversation view when new chat button is clicked', async () => {
            const user = userEvent.setup();
            setupApiDefaults([createConversation()]);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            expect(await screen.findByText('Conversations')).toBeInTheDocument();

            // Click the new chat (AddComment) icon button
            const addChatButton = screen.getAllByRole('button').find(btn =>
                btn.querySelector('[data-testid="AddCommentIcon"]')
            );
            expect(addChatButton).toBeDefined();
            await user.click(addChatButton!);

            await waitFor(() => {
                expect(screen.getByText('New Conversation')).toBeInTheDocument();
                expect(screen.getByPlaceholderText('Search by name or ID...')).toBeInTheDocument();
            });
        });

        it('shows back button in New Conversation view', async () => {
            const user = userEvent.setup();
            setupApiDefaults([createConversation()]);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            expect(await screen.findByText('Conversations')).toBeInTheDocument();

            const addChatButton = screen.getAllByRole('button').find(btn =>
                btn.querySelector('[data-testid="AddCommentIcon"]')
            );
            await user.click(addChatButton!);

            expect(await screen.findByText('New Conversation')).toBeInTheDocument();

            // Should have back arrow button
            const backButton = screen.getAllByRole('button').find(btn =>
                btn.querySelector('[data-testid="ArrowBackIcon"]')
            );
            expect(backButton).toBeDefined();
        });

        it('returns to Message Center when back button is clicked', async () => {
            const user = userEvent.setup();
            setupApiDefaults([createConversation()]);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            expect(await screen.findByText('Conversations')).toBeInTheDocument();

            // Go to new chat view
            const addChatButton = screen.getAllByRole('button').find(btn =>
                btn.querySelector('[data-testid="AddCommentIcon"]')
            );
            await user.click(addChatButton!);

            expect(await screen.findByText('New Conversation')).toBeInTheDocument();

            // Click back
            const backButton = screen.getAllByRole('button').find(btn =>
                btn.querySelector('[data-testid="ArrowBackIcon"]')
            );
            await user.click(backButton!);

            expect(await screen.findByText('Message Center')).toBeInTheDocument();
        });

        it('shows Multi button for multi-select mode', async () => {
            const user = userEvent.setup();
            setupApiDefaults([createConversation()]);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            expect(await screen.findByText('Conversations')).toBeInTheDocument();

            const addChatButton = screen.getAllByRole('button').find(btn =>
                btn.querySelector('[data-testid="AddCommentIcon"]')
            );
            await user.click(addChatButton!);

            expect(await screen.findByText('Multi')).toBeInTheDocument();
        });

        it('shows search empty state when no search term', async () => {
            const user = userEvent.setup();
            setupApiDefaults([]); // No conversations
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            expect(await screen.findByText('No conversations yet')).toBeInTheDocument();

            // Click "Start Conversation" in empty state
            await user.click(screen.getByText('Start Conversation'));

            expect(await screen.findByText('Search to start a conversation')).toBeInTheDocument();
        });

        it('shows recent conversations in new chat view', async () => {
            const user = userEvent.setup();
            const conversations = [
                createConversation({ otherPartyId: 1, otherPartyName: 'Recent Alice' }),
                createConversation({ otherPartyId: 2, otherPartyName: 'Recent Bob' }),
            ];
            setupApiDefaults(conversations);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            expect(await screen.findByText('Recent Alice')).toBeInTheDocument();

            const addChatButton = screen.getAllByRole('button').find(btn =>
                btn.querySelector('[data-testid="AddCommentIcon"]')
            );
            await user.click(addChatButton!);

            expect(await screen.findByText('Recent')).toBeInTheDocument();
        });
    });

    describe('Message Bubbles', () => {
        it('renders sent messages with message content', async () => {
            const user = userEvent.setup();
            const conversations = [createConversation({ otherPartyId: 10 })];
            const messages = [
                createMessage({ messageId: 1, message: 'I sent this', isSender: true }),
            ];
            setupApiDefaults(conversations);
            mockApi.getMessages.mockResolvedValue(messages);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            expect(await screen.findByText('John Driver')).toBeInTheDocument();

            await user.click(screen.getByText('John Driver'));

            expect(await screen.findByText('I sent this')).toBeInTheDocument();
        });

        it('renders received messages with message content', async () => {
            const user = userEvent.setup();
            const conversations = [createConversation({ otherPartyId: 10 })];
            const messages = [
                createMessage({
                    messageId: 1,
                    message: 'They sent this',
                    isSender: false,
                    sendFromCourierId: 10,
                }),
            ];
            setupApiDefaults(conversations);
            mockApi.getMessages.mockResolvedValue(messages);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            expect(await screen.findByText('John Driver')).toBeInTheDocument();

            await user.click(screen.getByText('John Driver'));

            expect(await screen.findByText('They sent this')).toBeInTheDocument();
        });

        it('shows read status indicator for sent read messages', async () => {
            const user = userEvent.setup();
            const conversations = [createConversation({ otherPartyId: 10 })];
            const messages = [
                createMessage({ messageId: 1, message: 'Read message', isSender: true, read: true, sent: true }),
            ];
            setupApiDefaults(conversations);
            mockApi.getMessages.mockResolvedValue(messages);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            expect(await screen.findByText('John Driver')).toBeInTheDocument();

            await user.click(screen.getByText('John Driver'));

            await waitFor(() => {
                expect(screen.getByText('Read message')).toBeInTheDocument();
                // DoneAllIcon should be present for read sent messages
                expect(screen.getByTestId('DoneAllIcon')).toBeInTheDocument();
            });
        });

        it('shows sent status indicator for unread sent messages', async () => {
            const user = userEvent.setup();
            const conversations = [createConversation({ otherPartyId: 10 })];
            const messages = [
                createMessage({ messageId: 1, message: 'Sent message', isSender: true, read: false, sent: true }),
            ];
            setupApiDefaults(conversations);
            mockApi.getMessages.mockResolvedValue(messages);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            expect(await screen.findByText('John Driver')).toBeInTheDocument();

            await user.click(screen.getByText('John Driver'));

            await waitFor(() => {
                expect(screen.getByText('Sent message')).toBeInTheDocument();
                // DoneIcon (single check) for sent but not read
                expect(screen.getByTestId('DoneIcon')).toBeInTheDocument();
            });
        });
    });

    describe('Conversation Last Message Preview', () => {
        it('shows "You: " prefix for read conversations', async () => {
            const conversations = [
                createConversation({
                    otherPartyName: 'Alice',
                    unreadCount: 0,
                    lastMessage: 'See you later',
                }),
            ];
            setupApiDefaults(conversations);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            expect(await screen.findByText('You:')).toBeInTheDocument();
        });

        it('shows sender name prefix for unread conversations', async () => {
            const conversations = [
                createConversation({
                    otherPartyName: 'Alice',
                    unreadCount: 2,
                    lastMessage: 'New message from me',
                }),
            ];
            setupApiDefaults(conversations);
            renderWithTheme(<MessagingDialog {...defaultProps} />);

            expect(await screen.findByText('Alice:')).toBeInTheDocument();
        });
    });
});
