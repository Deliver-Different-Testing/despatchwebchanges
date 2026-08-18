/**
 * Opens the universal React DispatchDialog (Courier / Agent / NP / DFRNT Partner)
 * from AngularJS.
 *
 * Nationwide is still an AngularJS page. Its agent-row assign action used to open
 * the agent-only confirmation dialog, which led with the inbound-agent email and so
 * presented as "send the app email" rather than an assignment. This routes it onto
 * the same modal every React surface uses.
 *
 * The dialog performs the assignment itself, so the resolved outcome is a report of
 * what happened — the caller only has to refresh and surface `message`.
 */

import {IDispatchJob, ISuggestion} from '../../../interfaces/job.interface';
import countSubJobs from '../../../functions/countSubJobs';
import type {DispatchDialogOutcome} from '../../../react/components/dialogs/dispatch-dialog/dispatch-dialog-react.module';
import type {DispatchType} from '../../../react/components/dialogs/dispatch-dialog/types';
import angular from "angular";

class DispatchDialogService {
    static $inject = ['$http', '$ocLazyLoad'];

    constructor(
        private $http: angular.IHttpService,
        private $ocLazyLoad: oc.ILazyLoad,
    ) {
    }

    private async loadReactDialog(): Promise<void> {
        if (window.ReactDispatchDialog) {
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
                name: 'uDispatch.dispatchDialogReact',
                files: [getAssetPath('dispatchDialogReact.js')],
            });
        } catch (error) {
            console.error('[DispatchDialogService] Failed to load React dialog:', error);
            throw error;
        }
    }

    /**
     * Opens the dialog for a job. Resolves with the assignment outcome, or null if
     * the operator cancelled or the module failed to load.
     */
    async openDispatchDialog(
        job: IDispatchJob,
        initialType: DispatchType = 'Courier',
        preselectedAgent?: ISuggestion,
    ): Promise<DispatchDialogOutcome | null> {
        try {
            await this.loadReactDialog();

            return await window.ReactDispatchDialog!.open({
                jobId: job.id,
                jobNo: job.jobNo,
                initialType,
                existingCourier: preselectedAgent ?? job.assignedCourier,
                existingConNote: job.conNote,
                stopJobCount: job.relatedJobs ? countSubJobs(job.jobNo, job.relatedJobs) : 0,
                flags: {
                    isArchived: Boolean(job.isArchived),
                    isBulkJob: Boolean(job.isBulkJob),
                    preBook: Boolean(job.preBook),
                },
            });
        } catch (error) {
            console.error('[DispatchDialogService] Error opening dispatch dialog', error);
            return null;
        }
    }
}

export default DispatchDialogService;
