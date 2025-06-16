import "./messaging-dialog.styles.less";
import BaseController from "../../base-controller";
import dayjs from "dayjs";
import {ChatMessageViewModel, RecentMessageViewModel, SendMessageRequest} from "./messaging-dialog.interfaces";
import MessagingService from "../../../services/messaging.service";
import DispatchCoreService from "../../../services/dispatch-core.service";
import {Suggestion} from "../../../interfaces/job.interface";
import ToastrService from "../../../services/toastr.service";
import calendar from "dayjs/plugin/calendar";
import relativeTime from "dayjs/plugin/relativeTime";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import {MessageDirection} from "./messaging-dailog.enums";

class MessagingDialogController extends BaseController {
    static $inject = [
        '$mdDialog',
        'messagingService',
        'DispatchData',
        'toastrService',
        '$interval',
        '$timeout',
        '$scope',
    ];

    // Main properties
    timeZone: string;
    selectedCourier?: RecentMessageViewModel;
    couriers: RecentMessageViewModel[] = [];
    messages: ChatMessageViewModel[] = [];
    newMessage: string = '';
    messageDeliveryType: number = 3;

    // Loading states
    isLoading: boolean = false;
    isMessagesLoading: boolean = false;
    isSending: boolean = false;

    // User info
    currentStaffId: number;
    currentStaffName: string;

    // Error handling
    error: string = '';

    // New chat dialog
    showNewChatView: boolean = false;
    courierSearchTerm: string = '';
    courierSuggestions: Suggestion[] = [];
    recentCouriers: RecentMessageViewModel[] = [];
    isSearching: boolean = false;
    private searchTimeout: any = null;

    // Message direction enum for template access
    MessageDirection = MessageDirection;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private messagingService: MessagingService,
        private DispatchData: DispatchCoreService,
        private toastrService: ToastrService,
        $interval: angular.IIntervalService,
        $timeout: angular.ITimeoutService,
        $scope: angular.IScope,
    ) {
        super();
        this.initServices($timeout, $interval, $scope);
        this.currentStaffId = ContactID;
        this.currentStaffName = FullName;

        dayjs.extend(calendar);
        dayjs.extend(relativeTime);
        dayjs.extend(isSameOrAfter);

        this.timeZone = TimeZone;

        if (!this.currentStaffId) {
            this.error = 'Unable to determine current staff member';
            return;
        }
    }

    $onInit() {
        this.loadRecentCouriers().then(() => {
            this.setupAutoRefresh();
        });
    }

    private setupAutoRefresh(): void {
        // Refresh conversations every 20 seconds
        this.registerInterval(async () => {
            await this.loadRecentCouriers(true);
        }, 20000);

        // Refresh messages every 10 seconds if chat is open
        this.registerInterval(async () => {
            if (this.selectedCourier) {
                await this.loadMessages(this.selectedCourier.courierId, true);
            }
        }, 10000);
    }

    // === CORE MESSAGING FUNCTIONS ===

    private async loadRecentCouriers(silent: boolean = false): Promise<void> {
        if (!silent) this.isLoading = true;

        try {
            const couriers = await this.messagingService.getRecentList(this.currentStaffId);

            this.couriers = couriers.map(courier => ({
                ...courier,
                lastMessageTime: dayjs(courier.lastMessageTime),
                initials: courier.initials || this.generateInitials(courier.courierName)
            }));

            // Update selected courier if exists
            if (this.selectedCourier) {
                const updated = this.couriers.find(c => c.courierId === this.selectedCourier!.courierId);
                if (updated) this.selectedCourier = updated;
            }
        } catch (error) {
            console.error('Failed to load conversations:', error);
            if (!silent) this.toastrService.showErrorToast('Failed to load conversations');
        } finally {
            if (!silent) this.isLoading = false;
        }
    }

    private async loadMessages(courierId: number, silent: boolean = false): Promise<void> {
        if (!silent) this.isMessagesLoading = true;

        try {
            const messages = await this.messagingService.getMessages(courierId, this.currentStaffId);

            this.messages = messages
                .map(message => {
                    // Messages TO courier are sent BY staff (right side)
                    // Messages TO staff are sent BY courier (left side)
                    const isSentByCurrentStaff = message.messageDirection === MessageDirection.StaffToCourier;

                    return {
                        ...message,
                        messageTime: dayjs(message.messageTime),
                        readTime: message.readTime ? dayjs(message.readTime) : undefined,
                        sent: isSentByCurrentStaff
                    };
                })
                .sort((a, b) => a.messageTime.valueOf() - b.messageTime.valueOf()); // Sort chronologically (oldest first)

            this.scrollToBottom();

        } catch (error) {
            console.error('Failed to load messages:', error);
            if (!silent) this.toastrService.showErrorToast('Failed to load messages');
        } finally {
            if (!silent) this.isMessagesLoading = false;
        }
    }

    async selectCourier(courier: RecentMessageViewModel): Promise<void> {
        if (this.selectedCourier?.courierId === courier.courierId) return;

        this.selectedCourier = courier;
        this.messages = [];

        await this.loadMessages(courier.courierId);

        // Mark messages as read if there are unread messages
        if (courier.unreadCount > 0) {
            await this.markMessagesAsRead(courier.courierId);
            courier.unreadCount = 0; // Clear unread count immediately
        }
    }

    async sendMessage(): Promise<void> {
        if (!this.newMessage.trim() || !this.selectedCourier || this.isSending) return;

        const messageContent = this.newMessage.trim();
        this.isSending = true;

        try {
            const data: SendMessageRequest = {
                courierIds: [this.selectedCourier.courierId],
                message: messageContent,
                messageType: this.messageDeliveryType
            };

            await this.messagingService.sendMessage(data);

            // Add an optimistic message to UI (insert at the end since messages are chronological)
            const optimisticMessage: ChatMessageViewModel = {
                messageId: -Date.now(),
                staffId: this.currentStaffId,
                courierId: this.selectedCourier.courierId,
                message: messageContent,
                messageTime: dayjs(),
                read: false,
                sent: true,
                messageDirection: MessageDirection.StaffToCourier
            };

            this.messages.push(optimisticMessage); // Add to end of array
            this.newMessage = '';

            // Update conversation preview
            this.selectedCourier.lastMessage = messageContent;
            this.selectedCourier.lastMessageTime = dayjs();
            this.selectedCourier.messageDirection = MessageDirection.StaffToCourier;

            this.scrollToBottom();
            this.toastrService.showSuccessToast('Message sent');

        } catch (error) {
            console.error('Failed to send message:', error);
            this.toastrService.showErrorToast('Failed to send message');
        } finally {
            this.isSending = false;
        }
    }

    async onMessageKeyPress(event: KeyboardEvent): Promise<void> {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            await this.sendMessage();
        }
    }

    private async markMessagesAsRead(courierId: number): Promise<void> {
        try {
            await this.messagingService.markAsRead(courierId);

            // Update local messages to show as read - only messages received FROM courier (TO staff)
            this.messages.forEach(message => {
                if (message.messageDirection === MessageDirection.CourierToStaff && !message.read) {
                    message.read = true;
                    message.readTime = dayjs();
                }
            });

            // Update conversation unread count
            if (this.selectedCourier) {
                this.selectedCourier.unreadCount = 0;
            }

            // Update in conversation list
            const conversation = this.couriers.find(c => c.courierId === courierId);
            if (conversation) {
                conversation.unreadCount = 0;
            }

        } catch (error) {
            console.error('Failed to mark messages as read:', error);
            // Don't show error toast for this as it's not critical to user experience
        }
    }

    // Helper method to determine if message was sent by current user
    isSentByCurrentUser(message: ChatMessageViewModel): boolean {
        // Messages TO courier are sent BY staff (current user)
        return message.messageDirection === MessageDirection.StaffToCourier;
    }

    // Helper method to determine if message was received from courier
    isReceivedFromCourier(message: ChatMessageViewModel): boolean {
        // Messages TO staff are sent BY courier
        return message.messageDirection === MessageDirection.CourierToStaff;
    }

    // Helper method to get sender name for display
    getSenderName(message: ChatMessageViewModel): string {
        if (message.messageDirection === MessageDirection.StaffToCourier) {
            return 'You'; // Staff sent TO courier
        } else if (message.messageDirection === MessageDirection.CourierToStaff) {
            return this.selectedCourier?.courierName || 'Courier'; // Courier sent TO staff
        }
        return 'Unknown';
    }

    // Helper method to get message direction icon
    getMessageDirectionIcon(message: ChatMessageViewModel): string {
        switch (message.messageDirection) {
            case MessageDirection.StaffToCourier:
                return 'send';
            case MessageDirection.CourierToStaff:
                return 'reply';
            default:
                return 'help';
        }
    }

    // Helper method to get last message direction text for conversation list
    getLastMessageDirectionText(conversation: RecentMessageViewModel): string {
        switch (conversation.messageDirection) {
            case MessageDirection.StaffToCourier:
                return 'You: '; // Staff sent TO courier
            case MessageDirection.CourierToStaff:
                return `${conversation.courierName}: `; // Courier sent TO staff
            default:
                return '';
        }
    }

    // === NEW CHAT VIEW ===

    async showNewChat(): Promise<void> {
        this.showNewChatView = true;
        this.courierSearchTerm = '';
        this.courierSuggestions = [];
        await this.loadRecentForNewChat();
    }

    backToMessaging(): void {
        this.showNewChatView = false;
        this.courierSearchTerm = '';
        this.courierSuggestions = [];
        this.clearSearchTimeout();
    }

    async onSearchKeyup(event: KeyboardEvent): Promise<void> {
        this.clearSearchTimeout();

        if (event.keyCode === 27) { // Escape
            this.backToMessaging();
            return;
        }

        if (event.keyCode === 13 && this.courierSuggestions.length > 0) { // Enter
            await this.startConversationWith(this.courierSuggestions[0]);
            return;
        }

        const searchTerm = this.courierSearchTerm?.trim();
        if (!searchTerm) {
            this.courierSuggestions = [];
            this.isSearching = false;
            return;
        }

        this.searchTimeout = this.registerTimeout(async () => {
            await this.searchCouriers(searchTerm);
        }, 300);
    }

    async onSearchFocus(): Promise<void> {
        if (!this.courierSearchTerm && this.recentCouriers.length === 0) {
            await this.loadRecentForNewChat();
        }
    }

    clearSearch(): void {
        this.courierSearchTerm = '';
        this.courierSuggestions = [];
        this.clearSearchTimeout();
    }

    private clearSearchTimeout(): void {
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = null;
        }
    }

    private async searchCouriers(searchTerm: string): Promise<void> {
        if (!searchTerm?.trim()) return;

        try {
            this.isSearching = true;
            this.courierSuggestions = await this.searchCouriersAPI(searchTerm);

        } catch (error) {
            console.error('Search failed:', error);
            this.courierSuggestions = [];
        } finally {
            this.isSearching = false;
        }
    }

    private async loadRecentForNewChat(): Promise<void> {
        this.recentCouriers = this.couriers
            .filter(c => c.lastMessageTime)
            .sort((a, b) => b.lastMessageTime.valueOf() - a.lastMessageTime.valueOf())
            .slice(0, 5);
    }

    async startConversationWith(courier: any): Promise<void> {
        // Handle both RecentMessageViewModel and Suggestion interfaces
        const courierId = courier.courierId || courier.id;
        const courierName = courier.courierName || courier.text || 'Unknown';

        const existing = this.couriers.find(c => c.courierId === courierId);
        if (existing) {
            await this.selectCourier(existing);
        } else {
            const newCourier: RecentMessageViewModel = {
                courierId: courierId,
                courierName: courierName,
                initials: this.generateInitials(courierName),
                status: courier.status || 'offline',
                unreadCount: 0,
                lastMessage: '',
                lastMessageTime: dayjs(),
                messageDirection: MessageDirection.StaffToCourier // Default direction for new conversations
            };

            this.couriers.unshift(newCourier);
            await this.selectCourier(newCourier);
        }

        // Go back to the main messaging view
        this.backToMessaging();
    }

    highlightSearchTerm(text: string, searchTerm: string): string {
        if (!searchTerm || !text) return text;
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        return text.replace(regex, '<span class="highlight">$1</span>');
    }

    getInitials(name: string): string {
        return this.generateInitials(name);
    }

    // === API CALLS ===

    async refreshCouriers(): Promise<void> {
        await this.loadRecentCouriers();
    }

    async refreshMessages(): Promise<void> {
        if (this.selectedCourier) {
            await this.loadMessages(this.selectedCourier.courierId);
        }
    }

    private async searchCouriersAPI(searchTerm: string): Promise<Suggestion[]> {
        if (!searchTerm || searchTerm.length < 2) return [];

        try {
            const url = "/courier/AllActiveSearch";
            return await this.DispatchData.autocompleteSearch(searchTerm, url);
        } catch (error: any) {
            this.toastrService.showErrorToast(error.message);
            return [];
        }
    }

    // === UTILITY FUNCTIONS ===

    private scrollToBottom(): void {
        this.registerTimeout(() => {
            const container = document.querySelector('.messages-container');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }, 50);
    }

    private generateInitials(name: string): string {
        if (!name) return '??';
        const parts = name.split(' ').filter(p => p.length > 0);
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }

    // === FORMATTING FUNCTIONS ===

    formatMessageTime(messageTime: dayjs.Dayjs): string {
        const now = dayjs();
        const diffInMinutes = now.diff(messageTime, 'minute');
        const diffInHours = now.diff(messageTime, 'hour');

        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        if (diffInHours < 24) return messageTime.format('HH:mm');
        if (diffInHours < 48) return `Yesterday ${messageTime.format('HH:mm')}`;
        return messageTime.format('MMM D, HH:mm');
    }

    formatLastMessageTime(lastMessageTime: dayjs.Dayjs): string {
        const now = dayjs();
        const diffInMinutes = now.diff(lastMessageTime, 'minute');
        const diffInHours = now.diff(lastMessageTime, 'hour');
        const diffInDays = now.diff(lastMessageTime, 'day');

        if (diffInMinutes < 1) return 'Now';
        if (diffInMinutes < 60) return `${diffInMinutes}m`;
        if (diffInHours < 24) return lastMessageTime.format('HH:mm');
        if (diffInDays < 7) return lastMessageTime.format('ddd');
        return lastMessageTime.format('MMM D');
    }

    getTotalUnreadCount(): number {
        return this.couriers.reduce((total, courier) => total + courier.unreadCount, 0);
    }

    // === DIALOG ACTIONS ===

    hasError(): boolean {
        return !!this.error;
    }

    getErrorMessage(): string {
        return this.error;
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }

    close(): void {
        this.$mdDialog.hide();
    }

    $onDestroy(): void {
        super.$onDestroy();
        this.clearSearchTimeout();
    }

    titleCase(input: string): string {
        if (!input) return '';
        return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
    }
}

export default MessagingDialogController;