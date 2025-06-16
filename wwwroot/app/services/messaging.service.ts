import {
    ChatMessageViewModel,
    RecentMessageViewModel, SendMessageRequest
} from "../components/dialogs/messaging-dialog/messaging-dialog.interfaces";

class MessagingService implements angular.IServiceProvider {
    static $inject = [
        '$http',
    ];

    constructor(
        private $http: angular.IHttpService,
    ) {
        console.log('ChatApiService: Service instantiated');
    }

    $get() {
        return this;
    }

    async getRecentList(staffId: number): Promise<RecentMessageViewModel[]> {
        const response = await this.$http.get<RecentMessageViewModel[]>(`messages/GetRecentList`, {
            params: {
                staffId,
            }
        });

        return response.data;
    }

    async getMessages(courierId: number, staffId: number): Promise<ChatMessageViewModel[]> {
        const response = await this.$http.get<ChatMessageViewModel[]>(`messages/GetMessages`, {
            params: {
                courierId,
                staffId,
            }
        });

        return response.data;
    }
    
    async sendMessage(data: SendMessageRequest) {
        await this.$http.post('messages/SendMessage', data);
    }
    
    async markAsRead(courierId: number) {
        await this.$http.get('messages/MarkAsRead', {
            params: {
                courierId,
            }
        })
    }
}

export default MessagingService;
