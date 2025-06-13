import dayjs from "dayjs";
import MessageDeliveryType from "../../../enums/message-delivery-type.enum";

export interface ChatMessageViewModel {
    messageId: number;
    staffId: number;
    courierId: number;
    message: string;
    messageTime: dayjs.Dayjs;
    read: boolean;
    readTime?: dayjs.Dayjs;
    sent: boolean;
}

export interface RecentMessageViewModel {
    courierId: number;
    courierName: string;
    initials: string;
    status: string;
    unreadCount: number;
    lastMessage: string;
    lastMessageTime: dayjs.Dayjs;
}

export interface SendMessageRequest {
    courierIds: number[];
    message: string;
    messageType: MessageDeliveryType;
}