import ToastrService from "../../../services/toastr.service";
import angular from 'angular';

// Type declaration for the React dialog on window
declare global {
    interface Window {
        ReactMessagingDialog?: {
            open: (options?: {
                toastService?: {
                    showToast: (message: string, type: 'success' | 'warning' | 'error') => void;
                };
            }) => Promise<void>;
        };
    }
}

class MessagingDialogService implements angular.IServiceProvider {
    static $inject = [
        '$log',
        'toastrService',
        '$ocLazyLoad',
        '$http',
    ];

    constructor(
        private $log: angular.ILogService,
        private toastrService: ToastrService,
        private $ocLazyLoad: oc.ILazyLoad,
        private $http: angular.IHttpService,
    ) {
        this.$log.debug('MessagingDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    /**
     * Load the React messaging dialog module on demand
     */
    private async loadReactDialog(): Promise<void> {
        // Check if already loaded
        if (window.ReactMessagingDialog) {
            return;
        }

        try {
            // Load the manifest to get hashed filenames
            const manifestResponse = await this.$http.get<Record<string, string>>('dist/manifest.json');
            const manifest = manifestResponse.data;

            const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;

            // Load vendor-react first (if not already loaded)
            if (!(window as any).React) {
                await this.$ocLazyLoad.load(getAssetPath('vendor-react.js'));
            }

            // Load the messaging dialog React module
            await this.$ocLazyLoad.load({
                name: 'uDispatch.messagingDialogReact',
                files: [getAssetPath('messagingDialogReact.js')]
            });
        } catch (error) {
            this.$log.error('[MessagingDialogService] Failed to load React dialog:', error);
            throw error;
        }
    }

    /**
     * Get the count of unread messages for the current user
     */
    async getUnreadMessageCount(): Promise<number> {
        const response = await this.$http.get<number>('messages/GetUnreadMessageCount');
        return response.data;
    }

    async openMessagingDialog(_$event?: MouseEvent) {
        try {
            this.$log.debug("MessagingDialogService: Dialog opened!");

            // Load the React dialog module
            await this.loadReactDialog();

            if (!window.ReactMessagingDialog) {
                throw new Error('React messaging dialog not loaded');
            }

            // Create toast service wrapper for UI notifications
            const toastService = {
                showToast: (message: string, type: 'success' | 'warning' | 'error') => {
                    switch (type) {
                        case 'success':
                            this.toastrService.showSuccessToast(message);
                            break;
                        case 'warning':
                            this.toastrService.showWarningToast(message);
                            break;
                        case 'error':
                            this.toastrService.showErrorToast(message);
                            break;
                    }
                },
            };

            // Open the React dialog
            await window.ReactMessagingDialog.open({
                toastService,
            });

            this.$log.debug('MessagingDialogService: Dialog closed!');
        } catch (error: any) {
            if (error === undefined) {
                this.$log.debug('User closed messaging dialog');
                return;
            }

            // Error occurred
            this.$log.error('MessagingDialogService: Error in openMessagingDialog', error);
            throw error;
        }
    }
}

export default MessagingDialogService;
