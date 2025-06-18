import dayjs from "dayjs";
import MessageDeliveryType from "../../../enums/message-delivery-type.enum";
import { OtherMessagePartyType } from "./messaging-dailog.enums";

export interface ChatMessageViewModel {
    messageId: number;
    sendToStaffId?: number;
    sendFromStaffId?: number;
    sendToCourierId?: number;
    sendFromCourierId?: number;
    message: string;
    messageTime: dayjs.Dayjs;
    read: boolean;
    readTime?: dayjs.Dayjs;
    sent: boolean;
    isSender: boolean;
}

export interface RecentMessageViewModel {
    otherPartyId: number;
    otherPartyType: OtherMessagePartyType;
    otherPartyName: string;
    otherPartyInitials: string;
    otherPartyStatus: string;
    unreadCount: number;
    lastMessage: string;
    lastMessageTime: dayjs.Dayjs;
}

export interface SendMessageRequest {
    sendToStaffId?: number;
    sendToCourierId?: number;
    message: string;
    messageType: MessageDeliveryType;
}

export interface SaveQuickResponseRequest {
    message: string;
}

export interface MessageContactOption {
    id: string;
    recordId: number;
    name: string;
    otherMessagePartyType: OtherMessagePartyType;
    status: string;
}