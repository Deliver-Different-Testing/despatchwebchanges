/**
 * Messaging API Handlers
 *
 * MSW handlers for messaging API endpoints.
 */

import { http, HttpResponse } from 'msw';
import type { RecentConversation, ChatMessage, QuickResponse, MessageContactOption } from '../../../components/dialogs/messaging-dialog/types';
import { OtherMessagePartyType } from '../../../components/dialogs/messaging-dialog/types';

// Mock data
export const mockRecentConversations: RecentConversation[] = [
    {
        otherPartyId: 1,
        otherPartyType: OtherMessagePartyType.Courier,
        otherPartyName: 'John Smith',
        otherPartyInitials: 'JS',
        otherPartyStatus: 'Available',
        unreadCount: 3,
        lastMessage: 'On my way to pickup',
        lastMessageTime: '2024-01-15T10:00:00Z',
    },
    {
        otherPartyId: 2,
        otherPartyType: OtherMessagePartyType.Staff,
        otherPartyName: 'Jane Doe',
        otherPartyInitials: 'JD',
        otherPartyStatus: 'Online',
        unreadCount: 0,
        lastMessage: 'Thanks for the update',
        lastMessageTime: '2024-01-15T09:30:00Z',
    },
];

export const mockChatMessages: ChatMessage[] = [
    {
        messageId: 1,
        sendToCourierId: 1,
        sendFromStaffId: 100,
        message: 'Please confirm pickup',
        messageTime: '2024-01-15T09:00:00Z',
        read: true,
        readTime: '2024-01-15T09:01:00Z',
        sent: true,
        isSender: true,
    },
    {
        messageId: 2,
        sendFromCourierId: 1,
        sendToStaffId: 100,
        message: 'On my way to pickup',
        messageTime: '2024-01-15T10:00:00Z',
        read: true,
        readTime: '2024-01-15T10:01:00Z',
        sent: true,
        isSender: false,
    },
];

export const mockQuickResponses: QuickResponse[] = [
    { id: 1, text: 'On my way!' },
    { id: 2, text: 'Delivered successfully' },
];

export const mockContactOptions: MessageContactOption[] = [
    {
        id: 'courier-1',
        recordId: 1,
        name: 'John Smith',
        otherMessagePartyType: OtherMessagePartyType.Courier,
        status: 'Available',
    },
    {
        id: 'staff-1',
        recordId: 101,
        name: 'Admin User',
        otherMessagePartyType: OtherMessagePartyType.Staff,
        status: 'Online',
    },
];

export const messagingHandlers = [
    // Get recent conversations list
    http.get('*/messages/GetRecentList', () => {
        return HttpResponse.json(mockRecentConversations);
    }),

    // Get messages for courier
    http.get('*/messages/GetMessages', ({ request }) => {
        const url = new URL(request.url);
        const courierId = url.searchParams.get('courierId');

        if (!courierId) {
            return new HttpResponse('Missing courierId parameter', { status: 400 });
        }

        return HttpResponse.json(mockChatMessages);
    }),

    // Get messages for staff
    http.get('*/messages/GetMessagesByStaff', ({ request }) => {
        const url = new URL(request.url);
        const otherStaffId = url.searchParams.get('otherStaffId');

        if (!otherStaffId) {
            return new HttpResponse('Missing otherStaffId parameter', { status: 400 });
        }

        return HttpResponse.json(mockChatMessages);
    }),

    // Send a message
    http.post('*/messages/SendMessage', async ({ request }) => {
        // Verify CSRF header
        if (request.headers.get('X-Requested-With') !== 'XMLHttpRequest') {
            return new HttpResponse('Missing CSRF header', { status: 400 });
        }

        const body = await request.json();
        if (!body || typeof body !== 'object') {
            return new HttpResponse('Invalid request body', { status: 400 });
        }

        return new HttpResponse(null, { status: 200 });
    }),

    // Send message to multiple recipients
    http.post('*/messages/SendMultiMessage', async ({ request }) => {
        // Verify CSRF header
        if (request.headers.get('X-Requested-With') !== 'XMLHttpRequest') {
            return new HttpResponse('Missing CSRF header', { status: 400 });
        }

        const body = await request.json();
        if (!body || typeof body !== 'object') {
            return new HttpResponse('Invalid request body', { status: 400 });
        }

        return new HttpResponse(null, { status: 200 });
    }),

    // Mark messages as read
    http.post('*/messages/MarkMessagesAsRead', ({ request }) => {
        // Verify CSRF header
        if (request.headers.get('X-Requested-With') !== 'XMLHttpRequest') {
            return new HttpResponse('Missing CSRF header', { status: 400 });
        }

        const url = new URL(request.url);
        const otherPartyId = url.searchParams.get('otherPartyId');
        const otherPartyType = url.searchParams.get('otherPartyType');

        if (!otherPartyId || !otherPartyType) {
            return new HttpResponse('Missing required parameters', { status: 400 });
        }

        return new HttpResponse(null, { status: 200 });
    }),

    // Search contacts
    http.get('*/messages/GetMessageContactOptions', ({ request }) => {
        const url = new URL(request.url);
        const searchTerm = url.searchParams.get('searchTerm');

        if (!searchTerm) {
            return HttpResponse.json([]);
        }

        const filtered = mockContactOptions.filter(c =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        return HttpResponse.json(filtered);
    }),

    // Get quick responses
    http.get('*/messages/GetQuickResponses', () => {
        return HttpResponse.json(mockQuickResponses);
    }),

    // Add quick response
    http.post('*/messages/AddQuickResponse', async ({ request }) => {
        // Verify CSRF header
        if (request.headers.get('X-Requested-With') !== 'XMLHttpRequest') {
            return new HttpResponse('Missing CSRF header', { status: 400 });
        }

        const body = await request.json();
        if (!body || typeof body !== 'object' || !('message' in (body as object))) {
            return new HttpResponse('Invalid request body', { status: 400 });
        }

        // Return new ID
        return HttpResponse.json(3);
    }),

    // Delete quick response
    http.delete('*/messages/DeleteQuickResponse', ({ request }) => {
        // Verify CSRF header
        if (request.headers.get('X-Requested-With') !== 'XMLHttpRequest') {
            return new HttpResponse('Missing CSRF header', { status: 400 });
        }

        const url = new URL(request.url);
        const responseId = url.searchParams.get('responseId');

        if (!responseId) {
            return new HttpResponse('Missing responseId parameter', { status: 400 });
        }

        return new HttpResponse(null, { status: 200 });
    }),
];
