/**
 * Bulk Price Upload Dialog Service
 *
 * Thin bridge to the React-based Bulk Price Upload Dialog.
 * Handles lazy loading and provides the interface for AngularJS callers.
 */

import ToastrService from "../../../services/toastr.service";
import angular from 'angular';

class BulkPriceUploadDialogService implements angular.IServiceProvider {
    static $inject = ['toastrService', '$ocLazyLoad', '$http'];

    constructor(
        private toastrService: ToastrService,
        private $ocLazyLoad: oc.ILazyLoad,
        private $http: angular.IHttpService,
    ) {}

    $get(): any {
        return this;
    }

    private async loadReactDialog(): Promise<void> {
        if (window.ReactBulkPriceUploadDialog) return;

        const manifestResponse = await this.$http.get<Record<string, string>>('dist/manifest.json');
        const manifest = manifestResponse.data;
        const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;

        if (!(window as any).React) {
            await this.$ocLazyLoad.load(getAssetPath('vendor-react.js'));
        }

        await this.$ocLazyLoad.load({
            name: 'uDispatch.bulkPriceUploadDialogReact',
            files: [getAssetPath('bulkPriceUploadDialogReact.js')]
        });
    }

    async openBulkPriceUploadDialog(_$event: MouseEvent): Promise<boolean> {
        await this.loadReactDialog();

        if (!window.ReactBulkPriceUploadDialog) {
            throw new Error('React bulk price upload dialog not loaded');
        }

        const toastService = {
            showToast: (message: string, type: 'success' | 'warning' | 'error' | 'info') => {
                switch (type) {
                    case 'success': this.toastrService.showSuccessToast(message); break;
                    case 'warning': this.toastrService.showWarningToast(message); break;
                    case 'error': this.toastrService.showErrorToast(message); break;
                }
            },
        };

        return window.ReactBulkPriceUploadDialog.open({ toastService });
    }
}

export default BulkPriceUploadDialogService;
