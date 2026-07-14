import {IJob} from "../../../interfaces/job.interface";
import {IAppConfig} from "../../../interfaces/app-config.interface";
import angular from 'angular';

class EditParcelDimensionsDialogService {
    static $inject = [
        '$ocLazyLoad',
        '$http',
        'APP_CONFIG',
    ];

    constructor(
        private $ocLazyLoad: oc.ILazyLoad,
        private $http: angular.IHttpService,
        private appConfig: IAppConfig,
    ) {
        console.log('EditParcelDimensionsDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    /**
     * Load the React dialog module on demand
     */
    private async loadReactDialog(): Promise<void> {
        if (window.ReactEditParcelDimensionsDialog) {
            return;
        }

        try {
            const manifestResponse = await this.$http.get<Record<string, string>>('dist/manifest.json');
            const manifest = manifestResponse.data;

            const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;

            // Load vendor-react first (if not already loaded)
            if (!(window as any).React) {
                await this.$ocLazyLoad.load(getAssetPath('vendor-react.js'));
            }

            // Load the edit parcel dimensions dialog React module
            await this.$ocLazyLoad.load({
                name: 'uDispatch.editParcelDimensionsDialogReact',
                files: [getAssetPath('editParcelDimensionsDialogReact.js')]
            });
        } catch (error) {
            console.error('[EditParcelDimensionsDialogService] Failed to load React dialog:', error);
            throw error;
        }
    }

    async showJobDimensionsDialog($event: MouseEvent, job: IJob) {
        console.debug('EditParcelDimensionsDialogService: showJobDimensionsDialog called');

        await this.loadReactDialog();

        if (!window.ReactEditParcelDimensionsDialog) {
            throw new Error('React edit parcel dimensions dialog not loaded');
        }

        try {
            await window.ReactEditParcelDimensionsDialog.showEditParcelDimensionsDialog({
                parcels: job.parcelDimensions,
                jobId: job.isBulkJob ? undefined : job.id,
                bulkJobId: job.isBulkJob ? job.id : undefined,
                isUsCustomer: this.appConfig.US_Customer,
                jobWeight: job.weight,
                calculateDimsOncePerJob: job.calculateDimsOncePerJob,
            });
        } catch (error) {
            console.error('EditParcelDimensionsDialogService: Error in showJobDimensionsDialog', error);
            throw error;
        }
    }
}

export default EditParcelDimensionsDialogService;
