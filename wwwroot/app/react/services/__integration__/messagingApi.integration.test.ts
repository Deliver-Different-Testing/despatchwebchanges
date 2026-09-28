/** @jest-environment jest-fixed-jsdom */
/**
 * Messaging API Integration Tests
 *
 * Tests the messagingApi service using MSW to intercept real HTTP requests.
 * Verifies correct endpoint URLs, request parameters, and response handling.
 */

// Mock the messaging dialog module to avoid window.angular dependency
jest.mock('../../components/dialogs/messaging-dialog/messaging-dialog-react.module', () => ({
    openMessagingDialog: jest.fn(),
}));

import {server} from '../../__testUtils__/msw/setupIntegration';
import {http, HttpResponse} from 'msw';
import {messagingApi} from '../messagingApi';
import {mockChatMessages,} from '../../__testUtils__/msw/handlers';
import {MessageDeliveryType, OtherMessagePartyType} from '../../components/dialogs/messaging-dialog';

describe('messagingApi integration', () => {
    describe('getRecentList', () => {
        it('fetches recent conversations via HTTP', async () => {
            const result = await messagingApi.getRecentList();

            expect(result).toHaveLength(2);
            expect(result[0].otherPartyName).toBe('John Smith');
            expect(result[0].unreadCount).toBe(3);
            expect(result[1].otherPartyName).toBe('Jane Doe');
        });

        it('handles server errors', async () => {
            server.use(
                http.get('*/messages/GetRecentList', () => {
                    return new HttpResponse('Database connection failed', { status: 500 });
                })
            );

            await expect(messagingApi.getRecentList()).rejects.toMatchObject({
                status: 500,
            });
        });
    });

    describe('getMessages', () => {
        it('fetches courier messages with correct parameters', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/messages/GetMessages', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockChatMessages);
                })
            );

            const result = await messagingApi.getMessages(
                1,
                OtherMessagePartyType.Courier,
                100
            );

            expect(capturedUrl).toContain('courierId=1');
            expect(capturedUrl).toContain('staffId=100');
            expect(result).toHaveLength(2);
        });

        it('fetches staff messages via different endpoint', async () => {
            let capturedEndpoint = '';

            server.use(
                http.get('*/messages/GetMessagesByStaff', ({ request }) => {
                    capturedEndpoint = new URL(request.url).pathname;
                    return HttpResponse.json(mockChatMessages);
                })
            );

            await messagingApi.getMessages(
                50,
                OtherMessagePartyType.Staff,
                100
            );

            expect(capturedEndpoint).toContain('GetMessagesByStaff');
        });
    });

    describe('sendMessage', () => {
        it('sends message to courier with CSRF header', async () => {
            let capturedBody: unknown = null;
            let capturedCsrfHeader: string | null = null;

            server.use(
                http.post('*/messages/SendMessage', async ({ request }) => {
                    capturedCsrfHeader = request.headers.get('X-Requested-With');
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await messagingApi.sendMessage({
                sendToCourierId: 1,
                message: 'Please confirm pickup',
                messageType: MessageDeliveryType.App,
            });

            expect(capturedCsrfHeader).toBe('XMLHttpRequest');
            expect(capturedBody).toMatchObject({
                sendToCourierId: 1,
                message: 'Please confirm pickup',
                messageType: MessageDeliveryType.App,
            });
        });

        it('sends message to staff member', async () => {
            let capturedBody: unknown = null;

            server.use(
                http.post('*/messages/SendMessage', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await messagingApi.sendMessage({
                sendToStaffId: 50,
                message: 'Update on delivery',
                messageType: MessageDeliveryType.Sms,
            });

            expect(capturedBody).toMatchObject({
                sendToStaffId: 50,
                message: 'Update on delivery',
                messageType: MessageDeliveryType.Sms,
            });
        });

        it('handles validation errors', async () => {
            server.use(
                http.post('*/messages/SendMessage', () => {
                    return HttpResponse.json(
                        { message: 'Message cannot be empty' },
                        { status: 400 }
                    );
                })
            );

            await expect(
                messagingApi.sendMessage({
                    sendToCourierId: 1,
                    message: '',
                    messageType: MessageDeliveryType.App,
                })
            ).rejects.toMatchObject({
                status: 400,
                message: 'Message cannot be empty',
            });
        });
    });

    describe('sendMultiMessage', () => {
        it('sends message to multiple couriers', async () => {
            let capturedBody: unknown = null;

            server.use(
                http.post('*/messages/SendMultiMessage', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await messagingApi.sendMultiMessage({
                sendToCourierIds: [1, 2, 3],
                message: 'Team update',
                messageType: MessageDeliveryType.SmartDelivery,
            });

            expect(capturedBody).toMatchObject({
                sendToCourierIds: [1, 2, 3],
                message: 'Team update',
            });
        });

        it('sends message to multiple staff members', async () => {
            let capturedBody: unknown = null;

            server.use(
                http.post('*/messages/SendMultiMessage', async ({ request }) => {
                    capturedBody = await request.json();
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await messagingApi.sendMultiMessage({
                sendToStaffIds: [10, 20],
                message: 'Office announcement',
                messageType: MessageDeliveryType.App,
            });

            expect(capturedBody).toMatchObject({
                sendToStaffIds: [10, 20],
            });
        });
    });

    describe('markMessagesAsRead', () => {
        it('marks courier messages as read', async () => {
            let capturedUrl = '';

            server.use(
                http.post('*/messages/MarkMessagesAsRead', ({ request }) => {
                    capturedUrl = request.url;
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await messagingApi.markMessagesAsRead(1, OtherMessagePartyType.Courier);

            expect(capturedUrl).toContain('otherPartyId=1');
            expect(capturedUrl).toContain('otherPartyType=0');
        });

        it('marks staff messages as read', async () => {
            let capturedUrl = '';

            server.use(
                http.post('*/messages/MarkMessagesAsRead', ({ request }) => {
                    capturedUrl = request.url;
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await messagingApi.markMessagesAsRead(50, OtherMessagePartyType.Staff);

            expect(capturedUrl).toContain('otherPartyId=50');
            expect(capturedUrl).toContain('otherPartyType=1');
        });
    });

    describe('getMessageContactOptions', () => {
        it('searches contacts by term', async () => {
            const result = await messagingApi.getMessageContactOptions('John');

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('John Smith');
        });

        it('returns empty array for no matches', async () => {
            const result = await messagingApi.getMessageContactOptions('xyz');

            expect(result).toHaveLength(0);
        });
    });

    describe('getQuickResponses', () => {
        it('fetches saved quick responses', async () => {
            const result = await messagingApi.getQuickResponses();

            expect(result).toHaveLength(2);
            expect(result[0].text).toBe('On my way!');
        });
    });

    describe('addQuickResponse', () => {
        it('adds new quick response and returns ID', async () => {
            const result = await messagingApi.addQuickResponse({
                message: 'New quick response',
            });

            expect(result).toBe(3);
        });

        it('validates request body', async () => {
            server.use(
                http.post('*/messages/AddQuickResponse', () => {
                    return HttpResponse.json(
                        { message: 'Message is required' },
                        { status: 400 }
                    );
                })
            );

            await expect(
                messagingApi.addQuickResponse({ message: '' })
            ).rejects.toMatchObject({
                status: 400,
            });
        });
    });

    describe('deleteQuickResponse', () => {
        it('deletes quick response by ID', async () => {
            let capturedUrl = '';

            server.use(
                http.delete('*/messages/DeleteQuickResponse', ({ request }) => {
                    capturedUrl = request.url;
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await messagingApi.deleteQuickResponse(5);

            expect(capturedUrl).toContain('responseId=5');
        });

        it('handles not found error', async () => {
            server.use(
                http.delete('*/messages/DeleteQuickResponse', () => {
                    return new HttpResponse('Quick response not found', { status: 404 });
                })
            );

            await expect(messagingApi.deleteQuickResponse(999)).rejects.toMatchObject({
                status: 404,
            });
        });
    });
});
