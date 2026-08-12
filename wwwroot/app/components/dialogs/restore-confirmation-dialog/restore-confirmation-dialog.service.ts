import {IDispatchJob} from "../../../interfaces/job.interface";
import angular from 'angular';

export type RestoreConfirmDecision =
    | {action: 'restore'; removeCapturedImages: boolean}
    | {action: 'swapPod'};

/**
 * Lazy-loads the React restore confirmation and asks it whether the restore should go ahead.
 * The dialog runs the POD pre-check itself, so a job with nothing to lose resolves straight to
 * a plain restore without ever appearing on screen.
 */
class RestoreConfirmationDialogService implements angular.IServiceProvider {
    static $inject = [
        '$ocLazyLoad',
        '$http',
    ];

    constructor(
        private $ocLazyLoad: oc.ILazyLoad,
        private $http: angular.IHttpService,
    ) {
        console.log('RestoreConfirmationDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    private async loadReactRestoreConfirmDialog(): Promise<void> {
        if (window.ReactRestoreConfirmDialog) {
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
                name: 'uDispatch.restoreConfirmDialogReact',
                files: [getAssetPath('restoreConfirmDialogReact.js')]
            });
        } catch (error) {
            console.error('[RestoreConfirmationDialogService] Failed to load React dialog:', error);
            throw error;
        }
    }

    async confirmRestore(job: IDispatchJob): Promise<RestoreConfirmDecision | null> {
        await this.loadReactRestoreConfirmDialog();

        if (!window.ReactRestoreConfirmDialog) {
            throw new Error('React restore confirmation dialog not loaded');
        }

        return await window.ReactRestoreConfirmDialog.open({jobId: job.id, done: job.done});
    }
}

export default RestoreConfirmationDialogService;
