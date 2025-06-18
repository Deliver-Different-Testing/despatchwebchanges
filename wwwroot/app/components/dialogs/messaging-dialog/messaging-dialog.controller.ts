import "./messaging-dialog.styles.less";
import BaseController from "../../base-controller";
import dayjs from "dayjs";
import {
    ChatMessageViewModel,
    MessageContactOption,
    RecentMessageViewModel,
    SaveQuickResponseRequest,
    SendMessageRequest, SendMultipleMessageRequest
} from "./messaging-dialog.interfaces";
import MessagingService from "../../../services/messaging.service";
import {Suggestion} from "../../../interfaces/job.interface";
import ToastrService from "../../../services/toastr.service";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import {OtherMessagePartyType} from "./messaging-dailog.enums";
import {DEFAULT_QUICK_RESPONSES} from "./DEFAULT_QUICK_RESPONSES";

class MessagingDialogController extends BaseController {
    static $inject = [
        '$mdDialog',
        'messagingService',
        'toastrService',
        '$interval',
        '$timeout',
        '$scope',
    ];

    // Main properties
    timeZone: string;
    selectedConversation?: RecentMessageViewModel;
    conversations: RecentMessageViewModel[] = [];
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
    contactSearchTerm: string = '';
    contactOptions: MessageContactOption[] = [];
    recentConversations: RecentMessageViewModel[] = [];
    isSearching: boolean = false;
    private searchTimeout: any = null;

    OtherMessagePartyType = OtherMessagePartyType;

    // Quick 
    isLoadingQuickResponses: boolean = false;
    showQuickResponses: boolean = false;
    quickResponses: Suggestion[] = [];
    showSaveAsQuickResponse: boolean = false;
    isSavingQuickResponse: boolean = false;
    
    // Multi-messaging
    isMultiSelectMode: boolean = false;
    selectedContacts: MessageContactOption[] = [];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private messagingService: MessagingService,
        private toastrService: ToastrService,
        $interval: angular.IIntervalService,
        $timeout: angular.ITimeoutService,
        $scope: angular.IScope,
    ) {
        super();
        this.initServices($timeout, $interval, $scope);
        this.currentStaffId = ContactID;
        this.currentStaffName = FullName;

        dayjs.extend(isSameOrAfter);

        this.timeZone = TimeZone;

        if (!this.currentStaffId) {
            this.error = 'Unable to determine current staff member';
            return;
        }
    }

    $onInit() {
        this.loadRecentConversations().then(() => {
            this.loadQuickResponses().then(() => {
                this.setupAutoRefresh();

                this.applyScope();
            })
        });
    }

    private setupAutoRefresh(): void {
        // Refresh conversations every 20 seconds
        this.registerInterval(async () => {
            await this.loadRecentConversations(true);
        }, 20000);

        // Refresh messages every 10 seconds if chat is open
        this.registerInterval(async () => {
            if (this.selectedConversation) {
                await this.loadMessages(this.selectedConversation.otherPartyId, this.selectedConversation.otherPartyType, true);
            }
        }, 10000);

        this.applyScope();
    }

    private async loadRecentConversations(silent: boolean = false): Promise<void> {
        if (!silent) this.isLoading = true;

        try {
            const conversations = await this.messagingService.getRecentList();

            this.conversations = conversations.map(conversation => ({
                ...conversation,
                lastMessageTime: dayjs(conversation.lastMessageTime),
                otherPartyInitials: conversation.otherPartyInitials || this.generateInitials(conversation.otherPartyName)
            }));

            // Update selected conversation if exists
            if (this.selectedConversation) {
                const updated = this.conversations.find(c =>
                    c.otherPartyId === this.selectedConversation!.otherPartyId &&
                    c.otherPartyType === this.selectedConversation!.otherPartyType
                );
                if (updated) this.selectedConversation = updated;
            }
        } catch (error) {
            console.error('Failed to load conversations:', error);
            if (!silent) this.toastrService.showErrorToast('Failed to load conversations');
        } finally {
            if (!silent) this.isLoading = false;
            this.applyScope();
        }
    }

    private async loadQuickResponses(): Promise<void> {
        try {
            this.isLoadingQuickResponses = true;
            const savedResponses = await this.messagingService.getQuickResponses();

            // Combine saved responses with defaults, with saved responses first
            this.quickResponses = [...savedResponses, ...DEFAULT_QUICK_RESPONSES];

            this.applyScope();

            console.log('Quick responses loaded:', this.quickResponses.length);
        } catch (error) {
            console.error('Failed to load quick responses:', error);
            // Fallback to just defaults if loading fails
            this.quickResponses = [...DEFAULT_QUICK_RESPONSES];
        } finally {
            this.isLoadingQuickResponses = false;
            this.applyScope();
        }
    }

    private async loadMessages(otherPartyId: number, otherPartyType: OtherMessagePartyType, silent: boolean = false): Promise<void> {
        if (!silent) this.isMessagesLoading = true;

        try {
            const messages = await this.messagingService.getMessages(otherPartyId, otherPartyType, this.currentStaffId);

            this.messages = messages
                .map(message => {
                    return {
                        ...message,
                        messageTime: dayjs(message.messageTime),
                        readTime: message.readTime ? dayjs(message.readTime) : undefined,
                    };
                })
                .sort((a, b) => a.messageTime.valueOf() - b.messageTime.valueOf());
        } catch (error) {
            console.error('Failed to load messages:', error);
            if (!silent) this.toastrService.showErrorToast('Failed to load messages');
        } finally {
            if (!silent) this.isMessagesLoading = false;
            if (silent) this.scrollToBottom();

            this.applyScope();
        }
    }

    async selectConversation(conversation: RecentMessageViewModel): Promise<void> {
        if (this.selectedConversation?.otherPartyId === conversation.otherPartyId &&
            this.selectedConversation?.otherPartyType === conversation.otherPartyType) return;

        this.selectedConversation = conversation;
        this.messages = [];

        await this.loadMessages(conversation.otherPartyId, conversation.otherPartyType);

        // Mark messages as read if there are unread messages
        if (conversation.unreadCount > 0) {
            await this.markMessagesAsRead(conversation.otherPartyId, conversation.otherPartyType);
            conversation.unreadCount = 0;
        }
    }

    async sendMessage(): Promise<void> {
        if (!this.newMessage.trim() || !this.selectedConversation || this.isSending) return;

        const messageContent = this.newMessage.trim();
        this.isSending = true;

        try {
            const data: SendMessageRequest = {
                sendToCourierId: this.selectedConversation.otherPartyType === OtherMessagePartyType.Courier
                    ? this.selectedConversation.otherPartyId : undefined,
                sendToStaffId: this.selectedConversation.otherPartyType === OtherMessagePartyType.Staff
                    ? this.selectedConversation.otherPartyId : undefined,
                message: messageContent,
                messageType: this.messageDeliveryType
            };

            await this.messagingService.sendMessage(data);

            // Add an optimistic message to UI
            const optimisticMessage: ChatMessageViewModel = {
                messageId: -Date.now(),
                sendFromStaffId: this.currentStaffId,
                sendToCourierId: this.selectedConversation.otherPartyType === OtherMessagePartyType.Courier
                    ? this.selectedConversation.otherPartyId : undefined,
                sendToStaffId: this.selectedConversation.otherPartyType === OtherMessagePartyType.Staff
                    ? this.selectedConversation.otherPartyId : undefined,
                message: messageContent,
                messageTime: dayjs(),
                read: false,
                sent: true,
                isSender: true
            };

            this.messages.push(optimisticMessage);
            this.newMessage = '';
            this.showSaveAsQuickResponse = false; // Hide the save option after sending

            // Update conversation preview
            this.selectedConversation.lastMessage = messageContent;
            this.selectedConversation.lastMessageTime = dayjs();

            this.scrollToBottom();
            this.toastrService.showSuccessToast('Message sent');
        } catch (error) {
            console.error('Failed to send message:', error);
            this.toastrService.showErrorToast('Failed to send message');
        } finally {
            this.isSending = false;
            this.applyScope();
        }
    }

    async onMessageKeyPress(event: KeyboardEvent): Promise<void> {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            await this.sendMessage();
        }
    }

    // Watch for changes in message input to show/hide a save option
    onMessageInputChange(): void {
        const messageText = this.newMessage;
        const hasText = messageText.trim().length > 0;
        const isNotExistingResponse = !this.quickResponses.some(qr => qr.text === messageText.trim());

        this.showSaveAsQuickResponse = hasText && isNotExistingResponse && messageText.trim().length >= 2;
        this.applyScope();
    }

    async saveCurrentMessageAsQuickResponse(): Promise<void> {
        if (!this.newMessage.trim() || this.isSavingQuickResponse) return;

        this.isSavingQuickResponse = true;

        try {
            const request: SaveQuickResponseRequest = {
                message: this.newMessage.trim()
            };

            const newId = await this.messagingService.addQuickResponse(request);

            // Add to local list
            const newResponse: Suggestion = {
                id: newId,
                text: this.newMessage.trim()
            };

            this.quickResponses.unshift(newResponse); // Add to the beginning
            this.showSaveAsQuickResponse = false;

            this.toastrService.showSuccessToast('Quick response saved!');
        } catch (error) {
            console.error('Failed to save quick response:', error);
            this.toastrService.showErrorToast('Failed to save quick response');
        } finally {
            this.isSavingQuickResponse = false;
            this.applyScope();
        }
    }

    async deleteQuickResponse(response: Suggestion): Promise<void> {
        // Prevent deleting default responses (negative IDs)
        if (response.id < 0) {
            this.toastrService.showWarningToast('Cannot delete default quick responses');
            return;
        }

        try {
            await this.messagingService.deleteQuickResponse(response.id);

            this.quickResponses = this.quickResponses.filter(r => r.id !== response.id);
            this.toastrService.showSuccessToast('Quick response deleted');
        } catch (error) {
            console.error('Failed to delete quick response:', error);
            this.toastrService.showErrorToast('Failed to delete quick response');
        } finally {
            this.applyScope();
        }
    }

    private async markMessagesAsRead(otherPartyId: number, otherPartyType: OtherMessagePartyType): Promise<void> {
        try {
            await this.messagingService.markAsRead(otherPartyId, otherPartyType);

            // Update local messages to show as read - only messages received by current staff
            this.messages.forEach(message => {
                if (message.sendToStaffId === this.currentStaffId && !message.read) {
                    message.read = true;
                    message.readTime = dayjs();
                }
            });

            // Update conversation unread count
            if (this.selectedConversation) {
                this.selectedConversation.unreadCount = 0;
            }

            // Update in a conversation list
            const conversation = this.conversations.find(c =>
                c.otherPartyId === otherPartyId && c.otherPartyType === otherPartyType
            );
            if (conversation) {
                conversation.unreadCount = 0;
            }
        } catch (error) {
            console.error('Failed to mark messages as read:', error);
        } finally {
            this.applyScope();
        }
    }

    // Helper method to determine if a message is from current user
    isMessageFromCurrentUser(message: ChatMessageViewModel): boolean {
        return message.sendFromStaffId === this.currentStaffId;
    }

    // Helper method to get sender name for display
    getSenderName(message: ChatMessageViewModel): string {
        if (this.isMessageFromCurrentUser(message)) {
            return 'You';
        } else if (this.selectedConversation) {
            return this.selectedConversation.otherPartyName;
        }
        return 'Unknown';
    }

    getMessageDirectionIcon(message: ChatMessageViewModel): string {
        return this.isMessageFromCurrentUser(message) ? 'send' : 'reply';
    }

    getLastMessageDirectionText(conversation: RecentMessageViewModel): string {
        return conversation.unreadCount > 0 ? `${conversation.otherPartyName}: ` : 'You: ';
    }

    // === Quick Responses ===
    selectQuickResponse(response: Suggestion): void {
        this.newMessage = response.text;
        this.showQuickResponses = false;
        this.showSaveAsQuickResponse = false; // Hide save option when using existing response

        // Autofocus the textarea
        this.registerTimeout(() => {
            const textarea = document.querySelector('.message-input textarea') as HTMLTextAreaElement;
            if (textarea) {
                textarea.focus();
            }
        }, 50);

        this.applyScope();
    }

    toggleQuickResponses(): void {
        this.showQuickResponses = !this.showQuickResponses;
    }

    hideQuickResponses(): void {
        this.showQuickResponses = false;
    }

    // Filter quick responses based on search
    getFilteredQuickResponses(): Suggestion[] {
        return this.quickResponses;
    }

    // Check if response is deletable (custom responses only)
    canDeleteResponse(response: Suggestion): boolean {
        return response.id > 0; // Positive IDs are custom, negative are defaults
    }

    // === NEW CHAT VIEW ===

    async showNewChat(): Promise<void> {
        this.showNewChatView = true;
        this.contactSearchTerm = '';
        this.contactOptions = [];
        await this.loadRecentForNewChat();

        this.applyScope();
    }

    backToMessaging(): void {
        this.showNewChatView = false;
        this.contactSearchTerm = '';
        this.contactOptions = [];
        this.selectedContacts = [];
        this.isMultiSelectMode = false;
        this.clearSearchTimeout();
        this.applyScope();
    }

    async onSearchKeyup(event: KeyboardEvent): Promise<void> {
        this.clearSearchTimeout();

        if (event.keyCode === 27) {
            this.backToMessaging();
            return;
        }

        if (event.keyCode === 13 && this.contactOptions.length > 0) {
            await this.startConversationWith(this.contactOptions[0]);
            return;
        }

        const searchTerm = this.contactSearchTerm?.trim();
        if (!searchTerm) {
            this.contactOptions = [];
            this.isSearching = false;
            return;
        }

        this.searchTimeout = this.registerTimeout(async () => {
            await this.searchContactOptions(searchTerm);
        }, 300);

        this.applyScope();
    }

    async onSearchFocus(): Promise<void> {
        if (!this.contactSearchTerm && this.recentConversations.length === 0) {
            await this.loadRecentForNewChat();
        }
    }

    clearSearch(): void {
        this.contactSearchTerm = '';
        this.contactOptions = [];
        this.clearSearchTimeout();
    }

    private clearSearchTimeout(): void {
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = null;
        }
    }

    private async searchContactOptions(searchTerm: string): Promise<void> {
        if (!searchTerm?.trim()) return;

        try {
            this.isSearching = true;
            this.contactOptions = await this.messagingService.getMessageContactOptions(searchTerm);

        } catch (error) {
            console.error('Search failed:', error);
            this.contactOptions = [];
        } finally {
            this.isSearching = false;
            this.applyScope();
        }
    }

    private async loadRecentForNewChat(): Promise<void> {
        this.recentConversations = this.conversations
            .filter(c => c.lastMessageTime)
            .sort((a, b) => b.lastMessageTime.valueOf() - a.lastMessageTime.valueOf())
            .slice(0, 5);
    }

    async startConversationWith(contact: MessageContactOption | RecentMessageViewModel): Promise<void> {
        const normalizedContact = this.normalizeContact(contact);

        const otherPartyId = normalizedContact.recordId;
        const otherPartyName = normalizedContact.name || 'Unknown';
        const otherPartyType = normalizedContact.otherMessagePartyType || OtherMessagePartyType.Courier;

        const existing = this.conversations.find(c =>
            c.otherPartyId === otherPartyId && c.otherPartyType === otherPartyType
        );

        if (existing) {
            await this.selectConversation(existing);
        } else {
            const newConversation: RecentMessageViewModel = {
                otherPartyId: otherPartyId,
                otherPartyType: otherPartyType,
                otherPartyName: otherPartyName,
                otherPartyInitials: this.generateInitials(otherPartyName),
                otherPartyStatus: normalizedContact.status || 'offline',
                unreadCount: 0,
                lastMessage: '',
                lastMessageTime: dayjs()
            };

            this.conversations.unshift(newConversation);
            await this.selectConversation(newConversation);
        }

        this.backToMessaging();
        this.applyScope();
    }
    
    highlightSearchTerm(text: string, searchTerm: string): string {
        if (!searchTerm || !text) return text;
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        return text.replace(regex, '<span class="highlight">$1</span>');
    }

    getInitials(name: string): string {
        return this.generateInitials(name);
    }

    async refreshConversations(): Promise<void> {
        await this.loadRecentConversations();
    }

    async refreshMessages(): Promise<void> {
        if (this.selectedConversation) {
            await this.loadMessages(this.selectedConversation.otherPartyId, this.selectedConversation.otherPartyType);
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
        return this.conversations.reduce((total, conversation) => total + conversation.unreadCount, 0);
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

    printContactType(partyType: OtherMessagePartyType): string {
        switch (partyType) {
            case OtherMessagePartyType.Courier:
                return "Courier";
            case OtherMessagePartyType.Staff:
                return "Staff";
            default:
                return "Unknown";
        }
    }
    
    // Multi-Messages
    // Multi-select methods
    toggleMultiSelectMode(): void {
        this.isMultiSelectMode = !this.isMultiSelectMode;
        if (!this.isMultiSelectMode) {
            this.selectedContacts = [];
        }
        this.applyScope();
    }

    toggleContactSelection(contact: MessageContactOption | RecentMessageViewModel): void {
        // Normalize the contact to have consistent structure
        const normalizedContact = this.normalizeContact(contact);

        const index = this.selectedContacts.findIndex(c =>
            c.recordId === normalizedContact.recordId &&
            c.otherMessagePartyType === normalizedContact.otherMessagePartyType
        );

        if (index > -1) {
            this.selectedContacts.splice(index, 1);
        } else {
            this.selectedContacts.push(normalizedContact);
        }
        this.applyScope();
    }

    isContactSelected(contact: MessageContactOption | RecentMessageViewModel): boolean {
        const normalizedContact = this.normalizeContact(contact);
        return this.selectedContacts.some(c =>
            c.recordId === normalizedContact.recordId &&
            c.otherMessagePartyType === normalizedContact.otherMessagePartyType
        );
    }

    private normalizeContact(contact: MessageContactOption | RecentMessageViewModel): MessageContactOption {
        // Check if it's a RecentMessageViewModel (has otherPartyId)
        if ('otherPartyId' in contact) {
            return {
                id: `${contact.otherPartyId}-${contact.otherPartyType}`,
                recordId: contact.otherPartyId,
                name: contact.otherPartyName,
                otherMessagePartyType: contact.otherPartyType,
                status: contact.otherPartyStatus || 'unknown'
            } as MessageContactOption;
        }

        // It's already a MessageContactOption
        return contact as MessageContactOption;
    }

    async sendMessageToMultipleContacts(): Promise<void> {
        if (!this.newMessage.trim() || this.selectedContacts.length === 0 || this.isSending) return;

        const messageContent = this.newMessage.trim();
        this.isSending = true;

        try {
            const courierIds = this.selectedContacts
                .filter(c => c.otherMessagePartyType === OtherMessagePartyType.Courier)
                .map(c => c.recordId);

            const staffIds = this.selectedContacts
                .filter(c => c.otherMessagePartyType === OtherMessagePartyType.Staff)
                .map(c => c.recordId);

            const data: SendMultipleMessageRequest = {
                sendToCourierIds: courierIds.length > 0 ? courierIds : undefined,
                sendToStaffIds: staffIds.length > 0 ? staffIds : undefined,
                message: messageContent,
                messageType: this.messageDeliveryType
            };

            await this.messagingService.sendMultiMessage(data);

            this.newMessage = '';
            this.selectedContacts = [];
            this.isMultiSelectMode = false;

            this.toastrService.showSuccessToast(`Message sent to ${courierIds.length + staffIds.length} contacts`);

            // Go back to the main messaging view
            this.backToMessaging();

        } catch (error) {
            console.error('Failed to send multi message:', error);
            this.toastrService.showErrorToast('Failed to send message to all contacts');
        } finally {
            this.isSending = false;
            this.applyScope();
        }
    }

    clearSelectedContacts(): void {
        this.selectedContacts = [];
        this.applyScope();
    }
}

export default MessagingDialogController;