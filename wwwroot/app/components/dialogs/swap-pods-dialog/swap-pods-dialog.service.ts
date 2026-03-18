import {IDispatchJob} from "../../../interfaces/job.interface";
import ToastrService from "../../../services/toastr.service";
import angular from 'angular';

class SwapPodsDialogService implements angular.IServiceProvider {
    static $inject = [
        'toastrService',
        '$ocLazyLoad',
        '$http',
    ];

    constructor(
        private toastrService: ToastrService,
        private $ocLazyLoad: oc.ILazyLoad,
        private $http: angular.IHttpService,
    ) {
        console.log('SwapPodsDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    private async loadReactSwapPodsDialog(): Promise<void> {
        if (window.ReactSwapPodsDialog) {
            return;
        }

        try {
            const manifestResponse = await this.$http.get<Record<string, string>>('dist/manifest.json');
            const manifest = manifestResponse.data;

            const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;

            if (!(window as any).React) {
                await this.$ocLazyLoad.load(getAssetPath('vendor-react.js'));
            }

            await this.$ocLazyLoad.load({
                name: 'uDispatch.swapPodsDialogReact',
                files: [getAssetPath('swapPodsDialogReact.js')]
            });
        } catch (error) {
            console.error('[SwapPodsDialogService] Failed to load React dialog:', error);
            throw error;
        }
    }

    async showSwapPodsDialog(job: IDispatchJob): Promise<boolean | null> {
        try {
            await this.loadReactSwapPodsDialog();

            if (!window.ReactSwapPodsDialog) {
                throw new Error('React swap PODs dialog not loaded');
            }

            const toastService = {
                showToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => {
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

            const result = await window.ReactSwapPodsDialog.open(job.jobNo, toastService);

            console.debug('SwapPodsDialogService: Dialog closed with result:', result);

            return result;
        } catch (error) {
            if (!error) {
                console.debug('User closed dialog');
                return null;
            }

            console.error('SwapPodsDialogService: Error in showSwapPodsDialog', error);
            throw error;
        }
    }
}

export default SwapPodsDialogService;
