import DispatchCoreService from "./dispatch-core.service";
import ToastrService from "./toastr.service";
import {openAddEventDialog} from "../react/components/dialogs/add-event-dialog";
import {openEventGroupDialog} from "../react/components/dialogs/event-group-dialog";
import {IDispatchJob, ILateCallRequest, ISuggestion,} from "../interfaces/job.interface";
import IContextMenuOption from "../interfaces/context-menu-option.interface";
import InternalJobStatus from "../enums/job-internal-status.enum";
import JobInternalStatusEnum from "../enums/job-internal-status.enum";
import {JobProperty} from "../enums/job-property.enum";
import JobAddStopService from "./job-add-stop.service";
import {AppPage} from "../enums/app-pages.enum";
import {LateEventType} from "../enums/late-event-type.enum";
import VoidJobConfirmationDialogService
    from "../components/dialogs/void-job-confirmation-dialog/void-job-confirmation-dialog.service";
import SwapPodsDialogService
    from "../components/dialogs/swap-pods-dialog/swap-pods-dialog.service";
import {EditAddressDialogService} from "../components/dialogs/edit-address-dialog/edit-address-dialog.service";
import PriceBreakdownDialogService from "../components/dialogs/price-breakdown-dialog/price-breakdown-dialog.service";
import {JobStatus} from "../enums/job-status.enum";
import {markdownToSafeHtml} from "../functions/markdownToHtml";
import {isAiEnabled} from "../functions/aiSettings";
import angular from 'angular';

class JobContextMenuService implements angular.IServiceProvider {
    static $inject = [
        "$mdDialog",
        "$document",
        "$http",
        "$ocLazyLoad",
        "DispatchData",
        "toastrService",
        "jobAddStopService",
        "voidJobConfirmationDialogService",
        "editAddressDialogService",
        "priceBreakdownDialogService",
        "swapPodsDialogService",
    ];

    private eventGroupsCache: ISuggestion[] = [];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
        private $http: angular.IHttpService,
        private $ocLazyLoad: oc.ILazyLoad,
        private DispatchData: DispatchCoreService,
        private toastrService: ToastrService,
        private jobAddStopService: JobAddStopService,
        private voidJobConfirmationDialogService: VoidJobConfirmationDialogService,
        private editAddressDialogService: EditAddressDialogService,
        private priceBreakdownDialogService: PriceBreakdownDialogService,
        private swapPodsDialogService: SwapPodsDialogService,
    ) {
        console.log("JobContextMenuService initialized");
        this.preloadEventGroups();
    }

    $get() {
        return this;
    }

    /**
     * Public method to split a job - can be called directly from controllers
     */
    async splitJob($event: MouseEvent, job: IDispatchJob, onRefresh?: () => void | Promise<void>): Promise<void> {
        await this.splitJobAction($event, job, onRefresh || (() => {}));
    }

    getMenuOptions(job: IDispatchJob, callbacks: any, appPage: AppPage): IContextMenuOption[] {
        if (!job) return [];

        const menuOptions: IContextMenuOption[] = [];

        menuOptions.push({
            text: job.hasBeenRead ? "Mark as Unread" : "Mark as Read",
            icon: job.hasBeenRead ? "mark_email_unread" : "mark_email_read",
            click: () => this.markJobReadOrUnread(job, callbacks.onRefresh),
            hasBottomDivider: true,
        });

        if (appPage === AppPage.Domestic) {
            // Flight
            if (job.assignedFlight && job.isFlightJob) {
                menuOptions.push({
                    text: "Unassign Flight",
                    icon: "remove_from_queue",
                    click: () => this.unassignFlight(job, callbacks.onRefresh),
                    hasBottomDivider: true,
                });
            }

            // Agent
            if (job.assignedAgent) {
                menuOptions.push({
                    text: "Unassign Agent",
                    icon: "person_remove",
                    click: () => this.unassignAgent(job, callbacks.onRefresh),
                    hasBottomDivider: true,
                });
            }
        }

        // Add Stop
        if (job.isAgentJob) {
            menuOptions.push({
                text: job.toAirportId && !job.fromAirportId ? "Add Pickup Stop" : "Add Delivery Stop",
                icon: "pin_drop",
                click: () => this.addStopToJob(job, callbacks.onRefresh),
                hasBottomDivider: true,
            });
        }

        if (appPage === AppPage.Dispatch || appPage === AppPage.JobSearch) {
            menuOptions.push({
                text: "Late Pickup",
                icon: "schedule",
                click: (_$itemScope: any, $event: MouseEvent) =>
                    this.latePickup($event, job, callbacks.onRefresh),
                hasBottomDivider: true,
            });

            menuOptions.push({
                text: "Late Delivery",
                icon: "local_shipping",
                click: (_$itemScope: any, $event: MouseEvent) =>
                    this.latePickup($event, job, callbacks.onRefresh),
                hasBottomDivider: false,
            });

            if (isAiEnabled()) {
                menuOptions.push({
                    text: "AI Late Alert Analysis (Beta)",
                    icon: "auto_awesome",
                    click: () => this.showAiLateAlertAnalysis(job),
                    hasBottomDivider: true,
                });
            }
        }

        // Reprice Job / Price Breakdown
        if (
            job.internalStatusId &&
            job.internalStatusId != InternalJobStatus.Reprice &&
            job.speedId === 415
        ) {
            if (job.preBook) {
                // Schedule orders get Price Breakdown
                menuOptions.push({
                    text: "Price Breakdown",
                    icon: "price_check",
                    click: (_$itemScope: any, $event: MouseEvent) =>
                        this.openPriceBreakdown($event, job, callbacks.onRefresh),
                    hasBottomDivider: true,
                });
            } else {
                // Regular jobs get Reprice Job
                menuOptions.push({
                    text: "Reprice Job",
                    icon: "price_check",
                    click: () => this.moveJobToReprice(job, callbacks.onRefresh),
                    hasBottomDivider: true,
                });
            }
        }

        menuOptions.push({
            text: "Add Task - Other",
            icon: "add",
            click: (_$itemScope: any, _$event: MouseEvent) =>
                this.addEventOtherAction(job, callbacks.onRefresh),
            hasBottomDivider: true,
        });

        menuOptions.push({
            text: "Task Groups",
            icon: "event",
            hasBottomDivider: true,
            children: this.getEventGroupsMenuItems(job.id, callbacks.onRefresh),
        });

        // Send to Live - for all bulk jobs that are not done (including child jobs)
        if (job.isBulkJob && !job.done) {
            menuOptions.push({
                text: "Send to Live",
                icon: "send",
                click: (_$itemScope: any, $event: MouseEvent) =>
                    this.sendBulkJobToLive($event, job, callbacks.onRefresh),
                hasBottomDivider: true,
            });
        }

        menuOptions.push({
            text: "Void Job",
            icon: "cancel",
            click: (_$itemScope: any, $event: MouseEvent) => this.voidJobAction($event, job, callbacks.onRefresh),
            hasBottomDivider: true,
        });

        // Swap PODs — only for completed non-bulk, non-prebook jobs
        if (job.done && !job.isBulkJob && !job.preBook) {
            menuOptions.push({
                text: "Swap PODs",
                icon: "swap_horiz",
                click: (_$itemScope: any, $event: MouseEvent) => this.swapPodsAction($event, job, callbacks.onRefresh),
                hasBottomDivider: true,
            });
        }

        // Split Job option (if allowed and job has no children)
        const hasChildren = job._groupChildren && job._groupChildren.length > 0;
        if (job.allowSplit && !hasChildren) {
            menuOptions.push({
                text: "Split Job",
                icon: "arrow_split",
                click: (_$itemScope: any, $event: MouseEvent) =>
                    this.splitJobAction($event, job, callbacks.onRefresh),
                hasBottomDivider: true,
            });
        }

        // Set First Job
        menuOptions.push({
            text: "Set First Job",
            icon: "first_page",
            click: () => this.setFirstJobAction(job, callbacks.onRefreshCourierJobs),
            hasBottomDivider: true,
        });

        // If a job is assigned to a courier, allow re-dispatching
        if(job.assignedCourier) {
            menuOptions.push({
                text: "Re-Dispatch",
                icon: "redo",
                click: (_$itemScope: any) =>
                    this.redispatchJobAction(job, callbacks.onRefresh),
                hasBottomDivider: true,
            });
        }

        // Restore
        menuOptions.push({
            text: "Restore",
            icon: "redo",
            click: () => this.restoreJob(job, callbacks.onRefresh),
        }); 
        
        // Missing
        menuOptions.push({
            text: "Mark Missing",
            icon: "checked_bag_question",
            click: () => this.markJobMissing(job, callbacks.onRefresh),
        });

        return menuOptions;
    }

    async voidJobAction($event: MouseEvent, job: IDispatchJob, onRefresh: () => void) {
        if (!job) return;

        try {
            const result = await this.voidJobConfirmationDialogService.showVoidConfirmationDialog($event, job);

            // Only refresh if the void operation was successful (not canceled)
            if (result?.success && onRefresh) {
                onRefresh();
            }
        } catch (error) {
            if (error) {
                console.error("Job void error:", error);
            }
        }
    }

    async swapPodsAction(_$event: MouseEvent, job: IDispatchJob, onRefresh: () => void) {
        if (!job) return;

        try {
            const result = await this.swapPodsDialogService.showSwapPodsDialog(job);
            if (result && onRefresh) {
                onRefresh();
            }
        } catch (error) {
            if (error) {
                console.error("Swap PODs error:", error);
            }
        }
    }

    private preloadEventGroups(): void {
        this.DispatchData.getEventGroups()
            .then((groups: ISuggestion[]) => {
                this.eventGroupsCache = groups || [];
                console.log("Event groups preloaded:", this.eventGroupsCache.length);
            })
            .catch((error) => {
                console.error("Error preloading event groups:", error);
                this.eventGroupsCache = [];
            });
    }

    private getEventGroupsMenuItems(
        jobId: number,
        onRefresh: () => void
    ): Function {
        return () => {
            if (this.eventGroupsCache.length > 0) {
                return this.eventGroupsCache.map((group) => ({
                    text: group.text,
                    click: () => this.selectEventGroup(group.id, jobId, onRefresh),
                }));
            }

            return this.DispatchData.getEventGroups()
                .then((groups: ISuggestion[]) => {
                    this.eventGroupsCache = groups || [];
                    return this.eventGroupsCache.map((group) => ({
                        text: group.text,
                        click: () => this.selectEventGroup(group.id, jobId, onRefresh),
                    }));
                })
                .catch((error) => {
                    console.error("Error loading task groups:", error);
                    return [];
                });
        };
    }

    private async markJobReadOrUnread(job: IDispatchJob, onRefresh: () => void) {
        if (!job) return;

        try {
            await this.DispatchData.updateJobReadStatus(job.id, !job.hasBeenRead);
            this.toastrService.showSuccessToast(
                job.hasBeenRead ? "Job marked as unread" : "Job marked as read"
            );

            if (onRefresh) {
                onRefresh();
            }
        } catch (error) {
            console.error("Job void error:", error);
            this.toastrService.showErrorToast("Error marking job as read/unread");
        }
    }

    private async unassignFlight(job: IDispatchJob, onRefresh: () => void) {
        if (!job) return;
        await this.performUnassignment(
            job,
            "Unassign Flight?",
            `Are you sure you wish to unassign flight ${job.assignedFlight?.flightNumber} from ${job.jobNo} ?`,
            `${job.assignedFlight?.flightNumber} unassigned successfully`,
            onRefresh
        );
    }

    private async unassignAgent(job: IDispatchJob, onRefresh: () => void) {
        if (!job) return;
        await this.performUnassignment(
            job,
            "Unassign Agent?",
            `Are you sure you wish to unassign agent ${job.assignedAgent?.agentName} from ${job.jobNo} ?`,
            `${job.assignedAgent?.agentName} unassigned successfully`,
            onRefresh
        );
    }

    private async addStopToJob(job: IDispatchJob, onRefresh: () => void) {
        if (!job) return;

        await this.jobAddStopService.addNewStop(job);

        if (onRefresh) {
            onRefresh();
        }
    }
    
    private async moveJobToReprice(job: IDispatchJob, onRefresh: () => void) {
        if (!job) return;

        try {
            await this.DispatchData.updateJobDetail(
                job.id,
                JobProperty.InternalStatusID,
                JobInternalStatusEnum.Reprice,
                false
            );

            this.toastrService.showSuccessToast(
                `Job ${job.jobNo} marked as Reprice`
            );

            if (onRefresh) {
                onRefresh();
            }
        } catch (error) {
            console.error("Error updating internal status:", error);
        }
    }

    private async openPriceBreakdown(
        $event: MouseEvent,
        job: IDispatchJob,
        onRefresh: () => void
    ): Promise<void> {
        try {
            // Adapt IDispatchJob to IJob interface for the dialog
            const jobForDialog = {
                id: job.id,
                preBook: job.preBook ?? false,
                isArchived: job.isArchived,
                isBulkJob: job.isBulkJob,
                charge: 0,
            } as any;

            await this.priceBreakdownDialogService.openPriceBreakdownDialog($event, jobForDialog);

            if (onRefresh) {
                onRefresh();
            }
        } catch (error) {
            if (error) {
                console.error("Error opening price breakdown:", error);
                this.toastrService.showErrorToast("Failed to open price breakdown");
            }
        }
    }

    private async performUnassignment(
        job: IDispatchJob,
        dialogTitle: string,
        dialogText: string,
        successMessage: string,
        onRefresh?: () => void
    ): Promise<void> {
        try {
            await this.$mdDialog.show(
                this.$mdDialog
                    .confirm()
                    .title(dialogTitle)
                    .textContent(dialogText)
                    .ok("Unassign")
                    .cancel("Cancel")
            );
            await this.DispatchData.restoreNationwideJob(job.id);
            this.toastrService.showSuccessToast(successMessage);
            if (onRefresh) {
                onRefresh();
            }
        } catch (error) {
            if (error) {
                console.error("Job void error:", error);
            }
        }
    }

    private async redispatchJobAction(
        job: IDispatchJob,
        onRefresh: () => void
    ) {
        if (!job || !job.assignedCourier?.id) return;

        try {
            await this.DispatchData.reAllocateJobs(job.assignedCourier?.id, [job.id]);
            this.toastrService.showSuccessToast(
                `Job ${job.jobNo} re-dispatched successfully`)

            if (onRefresh) {
                onRefresh();
            }
        } catch (error) {
            console.error("Error re-dispatching job:", error);
            this.toastrService.showErrorToast("Error re-dispatching job");
        }
    }

    private async addEventOtherAction(
        job: IDispatchJob,
        onRefresh: () => void
    ) {
        if (!job) return;

        await openAddEventDialog({
            job: {
                id: job.id,
                jobNo: job.jobNo,
                client: job.client ?? '',
                clientId: job.clientId,
            },
            toastService: {
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
            },
        });

        if (onRefresh) {
            onRefresh();
        }
    }

    private async selectEventGroup(
        eventGroupId: number,
        jobId: number,
        onRefresh: () => void
    ) {
        if (!jobId) return;

        try {
            const saved = await openEventGroupDialog({
                eventGroupId,
                jobId,
                toastService: {
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
                },
            });

            if (saved && onRefresh) {
                onRefresh();
            }
        } catch (error) {
            console.error("Error in event group dialog:", error);
        }
    }

    private async splitJobAction(
        $event: MouseEvent,
        job: IDispatchJob,
        onRefresh: () => void | Promise<void>
    ) {
        if (!job) return;

        if (job.isArchived) {
            await this.$mdDialog.show(
                this.$mdDialog
                    .alert()
                    .parent(this.$document.parent())
                    .clickOutsideToClose(true)
                    .title("Unable to split job")
                    .textContent("Splitting archived jobs is not currently supported.")
                    .ariaLabel("Alert")
                    .ok("OK")
            );
            return;
        }

        const hasChildren = job._groupChildren && job._groupChildren.length > 0;
        if (!job.allowSplit || hasChildren) {
            const reason = hasChildren
                ? `Job ${job.jobNo} has child jobs and cannot be split.`
                : `Can not split ${job.jobNo}.`;
            await this.$mdDialog.show(
                this.$mdDialog
                    .alert()
                    .parent(this.$document.parent())
                    .clickOutsideToClose(true)
                    .title("Unable to split job")
                    .textContent(reason)
                    .ariaLabel("Alert")
                    .ok("OK")
            );
            return;
        }

        try {
            // Show confirmation dialog
            await this.$mdDialog.show(
                this.$mdDialog
                    .confirm()
                    .title("Split Job?")
                    .textContent("Are you sure you wish to split this job?")
                    .ariaLabel("Confirm")
                    .targetEvent($event)
                    .ok("Yes")
                    .cancel("No")
            );

            // Show address dialog to get meeting point BEFORE splitting
            if (!job.deliveryAddress) {
                this.toastrService.showErrorToast("No delivery address found");
                return;
            }

            const meetingPointAddress = await this.editAddressDialogService.openEditAddressDialog(
                job.deliveryAddress,
                $event,
                'Set Meeting Point',
                'Split Job'
            );

            if (!meetingPointAddress) {
                console.log("Split job cancelled - no meeting point selected");
                return;
            }

            if (!meetingPointAddress.fullAddress) {
                this.toastrService.showErrorToast("Invalid meeting point address");
                return;
            }

            // Fire API call and get taskId back immediately
            const { taskId } = await this.DispatchData.splitJob(
                job.id,
                meetingPointAddress
            );

            // Show loading dialog during the polling phase (after all prior
            // dialogs are closed). try/finally ensures it's always dismissed.
            this.showSplitLoadingDialog(job.jobNo);
            try {
                await this.pollSplitJobStatus(taskId, job.jobNo, onRefresh);
            } finally {
                this.hideSplitLoadingDialog();
            }
        } catch (error) {
            if (error) {
                console.error("Splitting job failed:", error);
                this.toastrService.showErrorToast("Error splitting job");
            }
        }
    }

    private showSplitLoadingDialog(jobNo: string): void {
        this.$mdDialog.show({
            template: `
                <md-dialog aria-label="Splitting job" style="max-width: 320px;">
                    <md-dialog-content style="padding: 24px;">
                        <div layout="column" layout-align="center center">
                            <md-progress-linear md-mode="indeterminate" style="width: 100%; margin-bottom: 16px;"></md-progress-linear>
                            <span>Splitting job ${jobNo}...</span>
                        </div>
                    </md-dialog-content>
                </md-dialog>
            `,
            clickOutsideToClose: false,
            escapeToClose: false,
        });
    }

    private hideSplitLoadingDialog(): void {
        this.$mdDialog.hide();
    }

    private pollSplitJobStatus(
        taskId: string,
        jobNo: string,
        onRefresh: () => void | Promise<void>,
        attempt: number = 0
    ): Promise<void> {
        const maxAttempts = 30;

        if (attempt >= maxAttempts) {
            this.toastrService.showWarningToast(
                `Split job ${jobNo} is taking longer than expected. Please refresh manually.`
            );
            return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
            setTimeout(async () => {
                try {
                    const result = await this.DispatchData.getSplitJobStatus(taskId);

                    if (result.status === "Completed") {
                        this.toastrService.showSuccessToast(`Job ${jobNo} successfully split`);
                        if (onRefresh) {
                            await onRefresh();
                        }
                        resolve();
                    } else if (result.status === "Failed") {
                        this.toastrService.showErrorToast(
                            result.errorMessage || "Error splitting job"
                        );
                        resolve();
                    } else {
                        // Still running — poll again
                        resolve(this.pollSplitJobStatus(taskId, jobNo, onRefresh, attempt + 1));
                    }
                } catch (error) {
                    console.error("Error polling split job status:", error);
                    // Retry on transient errors instead of giving up immediately
                    if (attempt < maxAttempts - 1) {
                        resolve(this.pollSplitJobStatus(taskId, jobNo, onRefresh, attempt + 1));
                    } else {
                        this.toastrService.showErrorToast("Error checking split job status");
                        resolve();
                    }
                }
            }, 1000);
        });
    }

    private async setFirstJobAction(
        job: IDispatchJob,
        onRefreshCourierJobs: (params: { courierId: number }) => void
    ) {
        if (!job) return;

        try {
            await this.$mdDialog.show(
                this.$mdDialog
                    .confirm()
                    .title("Set First Job?")
                    .textContent("Are you sure you wish to set this as the First Job?")
                    .ok("Yes")
                    .cancel("No")
            );

            if (job.courierData && job.courierData.courierId) {
                await this.DispatchData.setFirstJob(job.id, job.courierData.courierId);
                this.toastrService.showSuccessToast(
                    "Job set as first job successfully"
                );

                if (onRefreshCourierJobs) {
                    onRefreshCourierJobs({courierId: job.courierData.courierId});
                }
            }
        } catch (error) {
            console.error("Action cancelled or error occurred:", error);
            this.toastrService.showErrorToast("Error setting first job");
        }
    }

    private async restoreJob(
        job: IDispatchJob,
        onRefresh?: () => void) {
        try {
            await this.DispatchData.restoreJobs([job.id]);

            if (onRefresh) {
                onRefresh();
            }
        } catch(error) {
            console.error("Error restoring job:", error);
            this.toastrService.showErrorToast("Error restoring job");
        }
    }   
    
    private async markJobMissing(
        job: IDispatchJob,
        onRefresh?: () => void) {
        try {
            await this.DispatchData.updateJobDetail(job.id, JobProperty.Status, JobStatus.Missing, false);
            this.toastrService.showSuccessToast("Job successfully marked as missing.");
            
            if (onRefresh) {
                onRefresh();
            }
        } catch(error) {
            console.error("Error updating job status to missing:", error);
            this.toastrService.showErrorToast("An unexpected error occured marking this job as missing.");
        }
    }

    private async latePickup($event: MouseEvent, job: IDispatchJob, onRefresh: () => void): Promise<void> {
        try {
            const confirm = this.$mdDialog.prompt()
                .title('Late Pickup')
                .textContent('Enter the number of minutes the courier is running late for pickup:')
                .ariaLabel('late pickup')
                .targetEvent($event)
                .required(true)
                .ok('Save')
                .cancel('Cancel');

            const minsAway: number = await this.$mdDialog.show(confirm);
            await this.handleLateOperation(minsAway, job, LateEventType.Pickup);

            if (onRefresh) {
                onRefresh();
            }
        } catch (error) {
            if (!error) return;
            console.error('Error in late pickup:', error);
            this.toastrService.showErrorToast("Error applying late pickup");
        }
    }
    
    private async handleLateOperation(minsAway: number, job: IDispatchJob, lateType: LateEventType): Promise<void> {
        const isPickup = lateType === LateEventType.Pickup;
        const operationType = isPickup ? "pickup" : "delivery";
        const currentValue = isPickup ? job.lp : job.ld;

        console.log(`Current ${operationType} = ${currentValue}`);
        console.log(`Param minsAway = ${minsAway}`);

        try {
            const lateCallRequest: ILateCallRequest = {
                jobId: job.id,
                lateType,
                lateTime: minsAway,
                calculationRequired: true,
            };

            await this.DispatchData.lateCall(lateCallRequest);

            this.toastrService.showSuccessToast("Late call applied successfully");

            console.log(`Late ${operationType} call completed successfully`);
        } catch (error) {
            console.error(`Error in late ${operationType} call:`, error);
        }
    }

    private async sendBulkJobToLive($event: MouseEvent, job: IDispatchJob, onRefresh: () => void): Promise<void> {
        if (!job || !job.isBulkJob) return;

        try {
            await this.$mdDialog.show(
                this.$mdDialog
                    .confirm()
                    .title("Send to Live?")
                    .textContent(`Are you sure you want to send bulk job ${job.jobNo} to the live dispatch screen?`)
                    .ariaLabel("Confirm")
                    .targetEvent($event)
                    .ok("Yes")
                    .cancel("No")
            );

            await this.DispatchData.releaseBulkJob(job.id);
            this.toastrService.showSuccessToast(`Bulk job ${job.jobNo} sent to live successfully`);

            if (onRefresh) {
                onRefresh();
            }
        } catch (error) {
            if (!error) return; // User cancelled
            console.error("Error sending bulk job to live:", error);
            this.toastrService.showErrorToast("Failed to send bulk job to live");
        }
    }

    private async ensureAiAssistantLoaded(): Promise<void> {
        if ((window as any).ReactAiAssistant) return;

        const manifestResponse = await this.$http.get<Record<string, string>>('dist/manifest.json');
        const manifest = manifestResponse.data;
        const getAssetPath = (filename: string) => `dist/${manifest[filename] || filename}`;

        if (!(window as any).React) {
            await this.$ocLazyLoad.load(getAssetPath('vendor-react.js'));
        }

        await this.$ocLazyLoad.load({
            name: 'uDispatch.aiAssistantDialogReact',
            files: [getAssetPath('aiAssistantDialogReact.js')]
        });
    }

    private async showAiLateAlertAnalysis(job: IDispatchJob): Promise<void> {
        if (!job?.id) return;
        try {
            this.toastrService.showInfoToast("Analyzing late alert...");
            await this.ensureAiAssistantLoaded();
            const response = await (window as any).ReactAiAssistant.analyzeLateAlert(job.id);
            if (response?.summary) {
                await this.$mdDialog.show(
                    this.$mdDialog.alert()
                        .title(`AI Late Alert Analysis (Beta) - ${job.jobNo}`)
                        .htmlContent(`<div style="line-height: 1.6;">${markdownToSafeHtml(response.summary)}</div>`)
                        .ok('Close')
                );
            } else {
                this.toastrService.showWarningToast("No analysis data returned");
            }
        } catch (error: any) {
            console.error("AI late alert analysis error:", error);
            this.toastrService.showErrorToast(error?.message || "Failed to analyze late alert");
        }
    }

}

export default JobContextMenuService;
