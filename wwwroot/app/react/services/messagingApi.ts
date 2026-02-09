/**
 * Messaging API Service
 *
 * React-native API service for messaging operations.
 * Used by the messaging-dialog for real-time messaging.
 */

import { apiClient } from './apiClient';
import {
    ChatMessage,
    RecentConversation,
    SendMessageRequest,
    SendMultipleMessageRequest,
    SaveQuickResponseRequest,
    MessageContactOption,
    QuickResponse,
    OtherMessagePartyType,
} from '../components/dialogs/messaging-dialog/types';

/**
 * Messaging API Service Class
 * Handles all messaging-related API operations.
 */
export class MessagingApiService {
    /**
     * Get the list of recent conversations
     */
    async getRecentList(): Promise<RecentConversation[]> {
        return apiClient.get<RecentConversation[]>('messages/GetRecentList');
    }

    /**
     * Get messages for a specific contact
     */
    async getMessages(
        otherPartyId: number,
        otherPartyType: OtherMessagePartyType,
        staffId: number
    ): Promise<ChatMessage[]> {
        const url = otherPartyType === OtherMessagePartyType.Courier
            ? 'messages/GetMessages'
            : 'messages/GetMessagesByStaff';

        return apiClient.get<ChatMessage[]>(url, {
            courierId: otherPartyType === OtherMessagePartyType.Courier ? otherPartyId : undefined,
            otherStaffId: otherPartyType === OtherMessagePartyType.Staff ? otherPartyId : undefined,
            staffId,
            currentStaffId: staffId,
        });
    }

    /**
     * Send a message to a single recipient
     */
    async sendMessage(data: SendMessageRequest): Promise<void> {
        await apiClient.post('messages/SendMessage', data);
    }

    /**
     * Send a message to multiple recipients
     */
    async sendMultiMessage(data: SendMultipleMessageRequest): Promise<void> {
        await apiClient.post('messages/SendMultiMessage', data);
    }

    /**
     * Mark messages as read for a conversation
     */
    async markMessagesAsRead(
        otherPartyId: number,
        otherPartyType: OtherMessagePartyType
    ): Promise<void> {
        await apiClient.post('messages/MarkMessagesAsRead', null, {
            params: {
                otherPartyId,
                otherPartyType,
            },
        });
    }

    /**
     * Search for contacts to message
     */
    async getMessageContactOptions(searchTerm: string): Promise<MessageContactOption[]> {
        return apiClient.get<MessageContactOption[]>('messages/GetMessageContactOptions', {
            searchTerm,
        });
    }

    /**
     * Get saved quick responses
     */
    async getQuickResponses(): Promise<QuickResponse[]> {
        return apiClient.get<QuickResponse[]>('messages/GetQuickResponses');
    }

    /**
     * Add a new quick response
     */
    async addQuickResponse(data: SaveQuickResponseRequest): Promise<number> {
        return apiClient.post<number>('messages/AddQuickResponse', data);
    }

    /**
     * Delete a quick response
     */
    async deleteQuickResponse(responseId: number): Promise<void> {
        await apiClient.delete('messages/DeleteQuickResponse', {
            params: { responseId },
        });
    }
}

export const messagingApi = new MessagingApiService();

export default messagingApi;
