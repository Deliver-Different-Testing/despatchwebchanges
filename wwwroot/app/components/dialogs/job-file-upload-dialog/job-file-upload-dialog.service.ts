import {IDispatchJob, IJob} from "../../../interfaces/job.interface";
import { FileUploadType } from "../../../enums/file-upload-type.enum";
import ToastrService from "../../../services/toastr.service";
import angular from 'angular';

class JobFileUploadDialogService implements angular.IServiceProvider {
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
        console.debug('JobFileUploadDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    private async loadReactDialog(): Promise<void> {
        if (window.ReactJobFileUploadDialog) return;

        try {
            const manifestResponse = await this.$http.get<Record<string, string>>('dist/manifest.json');
            const manifest = manifestResponse.data;
            const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;

            if (!(window as any).React) {
                await this.$ocLazyLoad.load(getAssetPath('vendor-react.js'));
            }

            await this.$ocLazyLoad.load({
                name: 'uDispatch.jobFileUploadDialogReact',
                files: [getAssetPath('jobFileUploadDialogReact.js')]
            });
        } catch (error) {
            console.error('[JobFileUploadDialogService] Failed to load React dialog:', error);
            throw error;
        }
    }

    async openJobFileUploadDialog(_$event: MouseEvent, job: IJob | IDispatchJob, uploadType: FileUploadType = FileUploadType.NORMAL) {
        try {
            await this.loadReactDialog();

            if (!window.ReactJobFileUploadDialog) {
                throw new Error('React job file upload dialog not loaded');
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

            window.ReactJobFileUploadDialog.setToastService(toastService);
            await window.ReactJobFileUploadDialog.open(job.id!, uploadType);

            console.debug("Job File Upload Dialog Closed");
        } catch (error) {
            if (!error) {
                console.debug("User closed dialog");
            } else {
                console.error("Error in openJobFileUploadDialog", error);
                throw error;
            }
        }
    }
}
export default JobFileUploadDialogService;
