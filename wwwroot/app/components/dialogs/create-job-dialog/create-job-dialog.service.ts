import ToastrService from "../../../services/toastr.service";
import {IAppConfig} from "../../../interfaces/app-config.interface";
import angular from 'angular';

// Window.ReactCreateJobDialog type is declared in wwwroot/types/global.d.ts

class CreateJobDialogService implements angular.IServiceProvider {
    static $inject = [
        'toastrService',
        '$ocLazyLoad',
        '$http',
        'APP_CONFIG',
    ];

    private readonly isUsTenant: boolean;

    constructor(
        private toastrService: ToastrService,
        private $ocLazyLoad: oc.ILazyLoad,
        private $http: angular.IHttpService,
        appConfig: IAppConfig,
    ) {
        console.debug('CreateJobDialogService: Service instantiated');
        this.isUsTenant = appConfig.US_Customer;
    }

    $get() {
        return this;
    }

    /**
     * Load the React create job dialog module on demand
     */
    private async loadReactCreateJobDialog(): Promise<void> {
        if (window.ReactCreateJobDialog) {
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
                name: 'uDispatch.createJobDialogReact',
                files: [getAssetPath('createJobDialogReact.js')]
            });
        } catch (error) {
            console.error('[CreateJobDialogService] Failed to load React dialog:', error);
            throw error;
        }
    }

    async showCreateJobDialog(_$event?: MouseEvent): Promise<number | undefined> {
        try {
            await this.loadReactCreateJobDialog();

            if (!window.ReactCreateJobDialog) {
                throw new Error('React create job dialog not loaded');
            }

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

            const result = await window.ReactCreateJobDialog.open(
                this.isUsTenant,
                toastService
            );

            console.debug('CreateJobDialogService: Dialog resolved with:', result);

            return result ?? undefined;
        } catch (error) {
            console.error('CreateJobDialogService: Error in showCreateJobDialog', error);
            throw error;
        }
    }
}

export default CreateJobDialogService;
