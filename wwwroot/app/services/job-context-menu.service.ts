import DispatchCoreService from "./dispatch-core.service";
import ToastrService from "./toastr.service";
import {EventGroupDialogService} from "../components/dialogs/event-group-dialog/event-group-dialog.service";
import AddEventDialogService from "../components/dialogs/add-event-dialog/add-event-dialog.service";
import {IDispatchJob, ILateCallRequest, ISuggestion,} from "../interfaces/job.interface";
import IContextMenuOption from "../interfaces/context-menu-option.interface";
import InternalJobStatus from "../enums/job-internal-status.enum";
import JobInternalStatusEnum from "../enums/job-internal-status.enum";
import {JobProperty} from "../enums/job-property.enum";
import JobAddStopService from "./job-add-stop.service";
import {AppPage} from "../enums/app-pages.enum";
import {IPrebookListModel} from "../components/recurringJobs/recurringJobs.interface";
import {LateEventType} from "../enums/late-event-type.enum";
import VoidJobConfirmationDialogService
    from "../components/dialogs/void-job-confirmation-dialog/void-job-confirmation-dialog.service";

class JobContextMenuService implements angular.IServiceProvider {
    static $inject = [
        "$mdDialog",
        "$document",
        "DispatchData",
        "toastrService",
        "eventGroupDialogService",
        "addEventDialogService",
        "jobAddStopService",
        "voidJobConfirmationDialogService",
    ];

    private eventGroupsCache: ISuggestion[] = [];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
        private DispatchData: DispatchCoreService,
        private toastrService: ToastrService,
        private eventGroupDialogService: EventGroupDialogService,
        private addEventDialogService: AddEventDialogService,
        private jobAddStopService: JobAddStopService,
        private voidJobConfirmationDialogService: VoidJobConfirmationDialogService,
    ) {
        console.log("JobContextMenuService initialized");
        this.preloadEventGroups();
    }

    $get() {
        return this;
    }

    getRecurringJobMenuOptions(job: IPrebookListModel, callbacks: any): IContextMenuOption[] {
        if (!job) return [];

        const menuOptions: IContextMenuOption[] = [];

        menuOptions.push({
            text: "Add Pickup Stop",
            icon: "pin_drop",
            click: () => this.addStopToRecurringJob(job, true, callbacks.onRefresh),
            hasBottomDivider: true,
        });

        menuOptions.push({
            text: "Add Delivery Stop",
            icon: "pin_drop",
            click: () => this.addStopToRecurringJob(job, false, callbacks.onRefresh),
            hasBottomDivider: false,
        });

        return menuOptions;
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
                hasBottomDivider: true,
            });
        }

        // Reprice Job
        if (
            job.internalStatusId &&
            job.internalStatusId != InternalJobStatus.Reprice &&
            job.speedId === 415
        ) {
            menuOptions.push({
                text: "Reprice Job",
                icon: "price_check",
                click: () => this.moveJobToReprice(job, callbacks.onRefresh),
                hasBottomDivider: true,
            });
        }

        // If job is assigned to a courier, allow re-dispatching
        if(job.assignedCourier) {
            menuOptions.push({
                text: "Re-Dispatch",
                icon: "redo",
                click: (_$itemScope: any, $event: MouseEvent) =>
                    this.addEventOtherAction($event, job, callbacks.onRefresh),
                hasBottomDivider: true,
            });
        }

        menuOptions.push({
            text: "Add Task - Other",
            icon: "add",
            click: (_$itemScope: any, $event: MouseEvent) =>
                this.addEventOtherAction($event, job, callbacks.onRefresh),
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

        // Split Job option (if allowed)
        if (job.allowSplit) {
            menuOptions.push({
                text: "Split Job",
                icon: "arrow_split",
                click: (_$itemScope: any, $event: MouseEvent) =>
                    this.splitJobAction($event, job, callbacks.onSplitJob),
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

        // Restore
        menuOptions.push({
            text: "Restore",
            icon: "redo",
            click: () => this.restoreJob(job, callbacks.onRefresh),
        });

        return menuOptions;
    }

    async voidJobAction($event: MouseEvent, job: IDispatchJob, onRefresh: () => void) {
        if (!job) return;
        
        if(job.isArchived) {
            this.toastrService.showWarningToast("Archived jobs cannot be voided.");
            return;
        }

        try {
            await this.voidJobConfirmationDialogService.showVoidConfirmationDialog($event, job);
            this.toastrService.showSuccessToast("Job voided successfully");

            if (onRefresh) {
                onRefresh();
            }
        } catch (error) {
            if (error) {
                console.error("Job void error:", error);
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

    private async addStopToRecurringJob(job: IPrebookListModel, isPickup: boolean, onRefresh: () => void) {
        if (!job) return;

        await this.jobAddStopService.addRecurringJobStop(job, isPickup)

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
        $event: MouseEvent,
        job: IDispatchJob,
        onRefresh: () => void
    ) {
        if (!job || !job.assignedCourier?.id) return;

        await this.DispatchData.reAllocateJobs(job.assignedCourier?.id, [job.id]);
        this.toastrService.showSuccessToast(
            `Job ${job.jobNo} re-dispatched successfully`)

        if (onRefresh) {
            onRefresh();
        }
    }

    private async addEventOtherAction(
        $event: MouseEvent,
        job: IDispatchJob,
        onRefresh: () => void
    ) {
        if (!job) return;

        await this.addEventDialogService.openAddEventDialog($event, job);

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
            await this.eventGroupDialogService.openEventGroupDialog(
                eventGroupId,
                jobId
            );

            if (onRefresh) {
                onRefresh();
            }
        } catch (error) {
            console.error("Error in event group dialog:", error);
        }
    }

    private async splitJobAction(
        $event: MouseEvent,
        job: IDispatchJob,
        onSplitJob: (params: { job: IDispatchJob }) => void
    ) {
        if (!job) return;

        if (!job.allowSplit) {
            await this.$mdDialog.show(
                this.$mdDialog
                    .alert()
                    .parent(this.$document.parent())
                    .clickOutsideToClose(true)
                    .title("Unable to split job")
                    .textContent(`Can not split ${job.jobNo}.`)
                    .ariaLabel("Alert")
                    .ok("OK")
            );
            return;
        }

        try {
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

            await this.DispatchData.splitJob(job.id);

            if (onSplitJob) {
                onSplitJob({job: job});
            }
        } catch (error) {
            console.error("Splitting job failed:", error);
        }
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
        }
    }

    private async restoreJob(
        job: IDispatchJob,
        onRefresh?: () => void) {
        await this.DispatchData.restoreJobs([job.id]);

        if (onRefresh) {
            onRefresh();
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
        }
    }

    async lateDelivery($event: MouseEvent, job: IDispatchJob, onRefresh: () => void): Promise<void> {
        try {
            const confirm = this.$mdDialog.prompt()
                .title('Late Delivery')
                .textContent('Enter the number of minutes the courier is running late for delivery:')
                .ariaLabel('late delivery')
                .targetEvent($event)
                .required(true)
                .ok('Save')
                .cancel('Cancel');

            const minsAway: number = await this.$mdDialog.show(confirm);
            await this.handleLateOperation(minsAway, job, LateEventType.Delivery);

            if (onRefresh) {
                onRefresh();
            }
        } catch (error) {
            if (!error) return;
            console.error('Error in late pickup:', error);
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

            await this.DispatchData.releaseBulkJob(job.jobNo, job.booked);
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
}

export default JobContextMenuService;
