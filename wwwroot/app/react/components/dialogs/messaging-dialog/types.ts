/**
 * Messaging Dialog Types
 *
 * TypeScript interfaces for the Messaging Dialog component.
 */

import type {ShowToastFn, ToastService} from '../../../services/toastService';

/**
 * Enum for the type of message party (Courier or Staff)
 */
export enum OtherMessagePartyType {
    Courier = 0,
    Staff = 1
}

/**
 * Enum for message delivery method
 */
export enum MessageDeliveryType {
    App = 1,
    Sms = 2,
    SmartDelivery = 3
}

/**
 * Represents a single chat message from the API.
 */
export interface ChatMessage {
    messageId: number;
    sendToStaffId?: number;
    sendFromStaffId?: number;
    sendToCourierId?: number;
    sendFromCourierId?: number;
    message: string;
    messageTime: string;
    read: boolean;
    readTime?: string;
    sent: boolean;
    isSender: boolean;
}

/**
 * Represents a recent conversation/message thread.
 */
export interface RecentConversation {
    otherPartyId: number;
    otherPartyType: OtherMessagePartyType;
    otherPartyName: string;
    otherPartyInitials: string;
    otherPartyStatus: string;
    unreadCount: number;
    lastMessage: string;
    lastMessageTime: string;
}

/**
 * Request payload for sending a single message.
 */
export interface SendMessageRequest {
    sendToStaffId?: number;
    sendToCourierId?: number;
    message: string;
    messageType: MessageDeliveryType;
}

/**
 * Request payload for sending messages to multiple recipients.
 */
export interface SendMultipleMessageRequest {
    sendToStaffIds?: number[];
    sendToCourierIds?: number[];
    message: string;
    messageType: MessageDeliveryType;
}

/**
 * Request payload for saving a quick response.
 */
export interface SaveQuickResponseRequest {
    message: string;
}

/**
 * Represents a contact option from search results.
 */
export interface MessageContactOption {
    id: string;
    recordId: number;
    name: string;
    otherMessagePartyType: OtherMessagePartyType;
    status: string;
}

/**
 * Represents a quick response / suggestion.
 */
export interface QuickResponse {
    id: number;
    text: string;
}

/**
 * Default quick responses available in the messaging dialog.
 */
export const DEFAULT_QUICK_RESPONSES: QuickResponse[] = [
    { id: -1, text: 'On my way!' },
    { id: -2, text: 'Delivered successfully' },
    { id: -3, text: 'Unable to deliver - will retry' },
    { id: -4, text: 'Customer not available' },
    { id: -5, text: 'Need assistance' },
    { id: -6, text: 'ETA 5 minutes' },
    { id: -7, text: 'Package left at door' },
    { id: -8, text: 'Delivery complete' },
    { id: -9, text: 'Having trouble finding the address' },
    { id: -10, text: 'Customer requested different time' },
    { id: -11, text: 'Delayed due to weather conditions' },
    { id: -12, text: 'Delayed due to traffic' },
    { id: -13, text: 'Arrived at delivery location' },
    { id: -14, text: 'Attempting to contact customer' },
    { id: -15, text: 'Returning package to depot' },
];

export type {ToastService};

/**
 * Options for opening the Messaging Dialog.
 */
export interface OpenMessagingDialogOptions {
    toastService?: ToastService;
}

/**
 * Props for the MessagingDialog component.
 */
export interface MessagingDialogProps {
    open: boolean;
    onClose: () => void;
    showToast: ShowToastFn;
    currentStaffId: number;
    currentStaffName: string;
    timeZone: string;
}
