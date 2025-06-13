import "./messaging-dialog.styles.less";
import BaseController from "../../base-controller";
import dayjs from "dayjs";
import {ChatMessageViewModel, RecentMessageViewModel, SendMessageRequest} from "./messaging-dialog.interfaces";
import MessagingService from "../../../services/messaging.service";
import DispatchCoreService from "../../../services/dispatch-core.service";
import {Suggestion} from "../../../interfaces/job.interface";
import ToastrService from "../../../services/toastr.service";

class MessagingDialogController extends BaseController {
    static $inject = [
        '$mdDialog',
        'messagingService',
        '$mdToast',
        'DispatchData',
        'toastrService',
        '$interval',
        '$timeout',
        '$scope',
    ];

    // Main properties
    selectedCourier?: RecentMessageViewModel;
    couriers: RecentMessageViewModel[] = [];
    messages: ChatMessageViewModel[] = [];
    newMessage: string = '';
    messageDeliveryType: number = 3; // SmartDelivery by default

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

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private messagingService: MessagingService,
        private $mdToast: angular.material.IToastService,
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

        if (!this.currentStaffId) {
            this.error = 'Unable to determine current staff member';
            return;
        }
    }

    $onInit() {
        this.loadRecentCouriers();
        this.setupAutoRefresh();
    }

    private setupAutoRefresh(): void {
        // Refresh conversations every 30 seconds
        this.registerInterval(async () => {
            await this.loadRecentCouriers(true);
        }, 30000);

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
            if (!silent) this.showToast('Failed to load conversations');
        } finally {
            if (!silent) this.isLoading = false;
        }
    }

    private async loadMessages(courierId: number, silent: boolean = false): Promise<void> {
        if (!silent) this.isMessagesLoading = true;

        try {
            const messages = await this.messagingService.getMessages(courierId, this.currentStaffId);

            this.messages = messages.map(message => ({
                ...message,
                messageTime: dayjs(message.messageTime),
                readTime: message.readTime ? dayjs(message.readTime) : undefined,
                sent: message.staffId === this.currentStaffId
            }));

            this.scrollToBottom();

        } catch (error) {
            console.error('Failed to load messages:', error);
            if (!silent) this.showToast('Failed to load messages');
        } finally {
            if (!silent) this.isMessagesLoading = false;
        }
    }

    async selectCourier(courier: RecentMessageViewModel): Promise<void> {
        if (this.selectedCourier?.courierId === courier.courierId) return;

        this.selectedCourier = courier;
        this.messages = [];
        courier.unreadCount = 0; // Clear unread count

        await this.loadMessages(courier.courierId);
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

            // Add an optimistic message to UI
            const optimisticMessage: ChatMessageViewModel = {
                messageId: -Date.now(),
                staffId: this.currentStaffId,
                courierId: this.selectedCourier.courierId,
                message: messageContent,
                messageTime: dayjs(),
                read: false,
                sent: true
            };

            this.messages.push(optimisticMessage);
            this.newMessage = '';

            // Update conversation preview
            this.selectedCourier.lastMessage = messageContent;
            this.selectedCourier.lastMessageTime = dayjs();

            this.scrollToBottom();
            this.showToast('Message sent');

        } catch (error) {
            console.error('Failed to send message:', error);
            this.showToast('Failed to send message', 'error');
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
                lastMessageTime: dayjs()
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

    private showToast(message: string, type: string = 'success'): void {
        const toast = this.$mdToast.simple()
            .textContent(message)
            .position('bottom left')
            .hideDelay(3000);

        this.$mdToast.show(toast);
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
        this.clearSearchTimeout();
    }

    titleCase(input: string): string {
        if (!input) return '';
        return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
    }
}

export default MessagingDialogController;