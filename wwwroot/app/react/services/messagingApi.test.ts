/** @jest-environment jest-environment-jsdom */
/**
 * Messaging API Service Tests
 */

import {messagingApi, MessagingApiService} from './messagingApi';
import {apiClient} from './apiClient';
import {createMockApiError} from '../__testUtils__';
import {MessageDeliveryType, OtherMessagePartyType,} from '../components/dialogs/messaging-dialog/types';

// Mock the messaging dialog module to avoid window.angular dependency
jest.mock('../components/dialogs/messaging-dialog/messaging-dialog-react.module', () => ({
    openMessagingDialog: jest.fn(),
}));

// Mock the apiClient
jest.mock('./apiClient', () => ({
    apiClient: {
        get: jest.fn(),
        post: jest.fn(),
        delete: jest.fn(),
    },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('MessagingApiService', () => {
    describe('getRecentList', () => {
        it('should call apiClient.get with correct URL', async () => {
            const mockConversations = [
                {
                    otherPartyId: 1,
                    otherPartyType: OtherMessagePartyType.Courier,
                    otherPartyName: 'John Doe',
                    otherPartyInitials: 'JD',
                    otherPartyStatus: 'online',
                    unreadCount: 3,
                    lastMessage: 'Hello',
                    lastMessageTime: '2024-01-15T10:00:00Z',
                },
            ];
            mockApiClient.get.mockResolvedValueOnce(mockConversations);

            const result = await messagingApi.getRecentList();

            expect(mockApiClient.get).toHaveBeenCalledWith('messages/GetRecentList');
            expect(result).toEqual(mockConversations);
        });

        it('should propagate errors from apiClient', async () => {
            const error = createMockApiError();
            mockApiClient.get.mockRejectedValueOnce(error);

            await expect(messagingApi.getRecentList()).rejects.toEqual(error);
        });
    });

    describe('getMessages', () => {
        const mockMessages = [
            {
                messageId: 1,
                sendFromStaffId: 100,
                sendToCourierId: 200,
                message: 'Test message',
                messageTime: '2024-01-15T10:00:00Z',
                read: true,
                sent: true,
                isSender: true,
            },
        ];

        it('should call GetMessages endpoint for Courier type', async () => {
            mockApiClient.get.mockResolvedValueOnce(mockMessages);

            const result = await messagingApi.getMessages(200, OtherMessagePartyType.Courier, 100);

            expect(mockApiClient.get).toHaveBeenCalledWith('messages/GetMessages', {
                courierId: 200,
                otherStaffId: undefined,
                staffId: 100,
                currentStaffId: 100,
            });
            expect(result).toEqual(mockMessages);
        });

        it('should call GetMessagesByStaff endpoint for Staff type', async () => {
            mockApiClient.get.mockResolvedValueOnce(mockMessages);

            const result = await messagingApi.getMessages(300, OtherMessagePartyType.Staff, 100);

            expect(mockApiClient.get).toHaveBeenCalledWith('messages/GetMessagesByStaff', {
                courierId: undefined,
                otherStaffId: 300,
                staffId: 100,
                currentStaffId: 100,
            });
            expect(result).toEqual(mockMessages);
        });

        it('should propagate errors from apiClient', async () => {
            const error = createMockApiError();
            mockApiClient.get.mockRejectedValueOnce(error);

            await expect(
                messagingApi.getMessages(200, OtherMessagePartyType.Courier, 100)
            ).rejects.toEqual(error);
        });
    });

    describe('sendMessage', () => {
        it('should call apiClient.post with correct URL and data', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            const data = {
                sendToCourierId: 200,
                message: 'Test message',
                messageType: MessageDeliveryType.SmartDelivery,
            };

            await messagingApi.sendMessage(data);

            expect(mockApiClient.post).toHaveBeenCalledWith('messages/SendMessage', data);
        });

        it('should propagate errors from apiClient', async () => {
            const error = createMockApiError();
            mockApiClient.post.mockRejectedValueOnce(error);

            await expect(
                messagingApi.sendMessage({
                    sendToCourierId: 200,
                    message: 'Test',
                    messageType: MessageDeliveryType.App,
                })
            ).rejects.toEqual(error);
        });
    });

    describe('sendMultiMessage', () => {
        it('should call apiClient.post with correct URL and data', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            const data = {
                sendToCourierIds: [200, 201],
                sendToStaffIds: [300],
                message: 'Broadcast message',
                messageType: MessageDeliveryType.SmartDelivery,
            };

            await messagingApi.sendMultiMessage(data);

            expect(mockApiClient.post).toHaveBeenCalledWith('messages/SendMultiMessage', data);
        });

        it('should propagate errors from apiClient', async () => {
            const error = createMockApiError();
            mockApiClient.post.mockRejectedValueOnce(error);

            await expect(
                messagingApi.sendMultiMessage({
                    sendToCourierIds: [200],
                    message: 'Test',
                    messageType: MessageDeliveryType.App,
                })
            ).rejects.toEqual(error);
        });
    });

    describe('markMessagesAsRead', () => {
        it('should call apiClient.post with correct URL and params', async () => {
            mockApiClient.post.mockResolvedValueOnce(undefined);

            await messagingApi.markMessagesAsRead(200, OtherMessagePartyType.Courier);

            expect(mockApiClient.post).toHaveBeenCalledWith(
                'messages/MarkMessagesAsRead',
                null,
                {
                    params: {
                        otherPartyId: 200,
                        otherPartyType: OtherMessagePartyType.Courier,
                    },
                }
            );
        });

        it('should propagate errors from apiClient', async () => {
            const error = createMockApiError();
            mockApiClient.post.mockRejectedValueOnce(error);

            await expect(
                messagingApi.markMessagesAsRead(200, OtherMessagePartyType.Courier)
            ).rejects.toEqual(error);
        });
    });

    describe('getMessageContactOptions', () => {
        it('should call apiClient.get with correct URL and params', async () => {
            const mockContacts = [
                {
                    id: 'courier-200',
                    recordId: 200,
                    name: 'John Driver',
                    otherMessagePartyType: OtherMessagePartyType.Courier,
                    status: 'online',
                },
            ];
            mockApiClient.get.mockResolvedValueOnce(mockContacts);

            const result = await messagingApi.getMessageContactOptions('john');

            expect(mockApiClient.get).toHaveBeenCalledWith('messages/GetMessageContactOptions', {
                searchTerm: 'john',
            });
            expect(result).toEqual(mockContacts);
        });

        it('should propagate errors from apiClient', async () => {
            const error = createMockApiError();
            mockApiClient.get.mockRejectedValueOnce(error);

            await expect(messagingApi.getMessageContactOptions('test')).rejects.toEqual(error);
        });
    });

    describe('getQuickResponses', () => {
        it('should call apiClient.get with correct URL', async () => {
            const mockResponses = [
                { id: 1, text: 'On my way!' },
                { id: 2, text: 'Delivered' },
            ];
            mockApiClient.get.mockResolvedValueOnce(mockResponses);

            const result = await messagingApi.getQuickResponses();

            expect(mockApiClient.get).toHaveBeenCalledWith('messages/GetQuickResponses');
            expect(result).toEqual(mockResponses);
        });

        it('should propagate errors from apiClient', async () => {
            const error = createMockApiError();
            mockApiClient.get.mockRejectedValueOnce(error);

            await expect(messagingApi.getQuickResponses()).rejects.toEqual(error);
        });
    });

    describe('addQuickResponse', () => {
        it('should call apiClient.post with correct URL and data', async () => {
            mockApiClient.post.mockResolvedValueOnce(123);

            const result = await messagingApi.addQuickResponse({ message: 'New response' });

            expect(mockApiClient.post).toHaveBeenCalledWith('messages/AddQuickResponse', {
                message: 'New response',
            });
            expect(result).toBe(123);
        });

        it('should propagate errors from apiClient', async () => {
            const error = createMockApiError();
            mockApiClient.post.mockRejectedValueOnce(error);

            await expect(
                messagingApi.addQuickResponse({ message: 'Test' })
            ).rejects.toEqual(error);
        });
    });

    describe('deleteQuickResponse', () => {
        it('should call apiClient.delete with correct URL and params', async () => {
            mockApiClient.delete.mockResolvedValueOnce(undefined);

            await messagingApi.deleteQuickResponse(123);

            expect(mockApiClient.delete).toHaveBeenCalledWith('messages/DeleteQuickResponse', {
                params: { responseId: 123 },
            });
        });

        it('should propagate errors from apiClient', async () => {
            const error = createMockApiError();
            mockApiClient.delete.mockRejectedValueOnce(error);

            await expect(messagingApi.deleteQuickResponse(123)).rejects.toEqual(error);
        });
    });

    describe('messagingApi singleton', () => {
        it('should be an instance of MessagingApiService', () => {
            expect(messagingApi).toBeInstanceOf(MessagingApiService);
        });
    });
});
