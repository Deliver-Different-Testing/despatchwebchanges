import {
    ChatMessageViewModel,
    RecentMessageViewModel,
    SendMessageRequest, SaveQuickResponseRequest, MessageContactOption, SendMultipleMessageRequest
} from "../components/dialogs/messaging-dialog/messaging-dialog.interfaces";
import {ISuggestion} from "../interfaces/job.interface";
import {OtherMessagePartyType} from "../components/dialogs/messaging-dialog/messaging-dailog.enums";

class MessagingService implements angular.IServiceProvider {
    static $inject = [
        '$http',
    ];

    constructor(
        private $http: angular.IHttpService,
    ) {}

    $get() {
        return this;
    }

    async getUnreadMessageCount(): Promise<number> {
        const response = await this.$http.get<number>(`messages/GetUnreadMessageCount`);
        return response.data;
    }

    async getRecentList(): Promise<RecentMessageViewModel[]> {
        const response = await this.$http.get<RecentMessageViewModel[]>(`messages/GetRecentList`);
        return response.data;
    }

    async getMessages(otherPartyId: number, otherPartyType: OtherMessagePartyType, staffId: number): Promise<ChatMessageViewModel[]> {
        let url: string;

        if (otherPartyType === OtherMessagePartyType.Courier) {
            url = `messages/GetMessages`;
        } else {
            url = `messages/GetMessagesByStaff`;
        }

        const response = await this.$http.get<ChatMessageViewModel[]>(url, {
            params: {
                courierId: otherPartyType === OtherMessagePartyType.Courier ? otherPartyId : undefined,
                otherStaffId: otherPartyType === OtherMessagePartyType.Staff ? otherPartyId : undefined,
                staffId: staffId,
                currentStaffId: staffId,
            }
        });

        return response.data;
    }

    async sendMessage(data: SendMessageRequest) {
        await this.$http.post('messages/SendMessage', data);
    }

    async sendMultiMessage(data: SendMultipleMessageRequest) {
        await this.$http.post('messages/SendMultiMessage', data);
    }

    async markAsRead(otherPartyId: number, otherPartyType: OtherMessagePartyType) {
        await this.$http.post('messages/MarkMessagesAsRead', null, {
            params: {
                otherPartyId,
                otherPartyType,
            }
        });
    }

    async getMessageContactOptions(searchTerm: string): Promise<MessageContactOption[]> {
        const response = await this.$http.get<MessageContactOption[]>(`messages/GetMessageContactOptions`, {
            params: {
                searchTerm,
            }
        });
        return response.data;
    }

    async getQuickResponses(): Promise<ISuggestion[]> {
        const response = await this.$http.get<ISuggestion[]>(`messages/GetQuickResponses`);
        return response.data;
    }

    async addQuickResponse(data: SaveQuickResponseRequest): Promise<number> {
        const response = await this.$http.post<number>('messages/AddQuickResponse', data);
        return response.data;
    }

    async deleteQuickResponse(responseId: number) {
        await this.$http.delete('messages/DeleteQuickResponse', {
            params: {
                responseId,
            }
        });
    }
}

export default MessagingService;