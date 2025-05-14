import DispatchCoreService from "./dispatch-core.service";
import ToastrService from "./toastr.service";
import NoteService from "./notes.service";
import {EventGroupDialogService} from "../components/dialogs/event-group-dialog/event-group-dialog.service";
import AddEventDialogService from "../components/dialogs/add-event-dialog/add-event-dialog.service";
import {IDispatchJob, IJobNote, Suggestion} from "../interfaces/job.interface";
import {JobNoteType} from "../enums/job-note-type.enum";
import IContextMenuOption from "../interfaces/context-menu-option.interface"
import NationwideService from "../components/Nationwide/nationwide.service";
import InternalJobStatus from "../enums/job-internal-status.enum";
import JobInternalStatusEnum from "../enums/job-internal-status.enum";
import {JobProperty} from "../enums/job-property.enum";
import JobAddStopService from "./job-add-stop.service";
import {isDeliveryJob} from "../functions/isDeliveryJob";
import {isFlightJob} from "../functions/isFlightJob";
import {bindAllMethods} from "../functions/bindAllMethods";

class JobContextMenuService implements angular.IServiceProvider {
    static $inject = [
        "$mdDialog",
        "$document",
        "DispatchData",
        "toastrService",
        "noteService",
        "eventGroupDialogService",
        "addEventDialogService",
        "NWData",
        "jobAddStopService",
    ];

    private eventGroupsCache: Suggestion[] = [];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
        private DispatchData: DispatchCoreService,
        private toastrService: ToastrService,
        private noteService: NoteService,
        private eventGroupDialogService: EventGroupDialogService,
        private addEventDialogService: AddEventDialogService,
        private nationwideService: NationwideService,
        private jobAddStopService: JobAddStopService,
    ) {
        console.log("JobContextMenuService initialized");
        bindAllMethods(this);
        this.preloadEventGroups();
    }

    $get() {
        return this;
    }

    getMenuOptions(job: IDispatchJob, callbacks: any): IContextMenuOption[] {
        if (!job) return [];

        const menuOptions: IContextMenuOption[] = [];

        menuOptions.push({
            text: job.hasBeenRead ? 'Mark as Unread' : 'Mark as Read',
            icon: job.hasBeenRead ? 'mark_email_unread' : 'mark_email_read',
            click: () => this.markJobReadOrUnread(job, callbacks.onRefresh),
            hasBottomDivider: true
        });

        // Flight
        if (job.assignedFlight && isFlightJob(job)) {
            menuOptions.push({
                text: 'Unassign Flight',
                icon: 'remove_from_queue',
                click: () => this.unassignFlight(job, callbacks.onRefresh),
                hasBottomDivider: true
            });
        }

        // Agent
        if (job.assignedAgent) {
            menuOptions.push({
                text: 'Unassign Agent',
                icon: 'person_remove',
                click: () => this.unassignAgent(job, callbacks.onRefresh),
                hasBottomDivider: true
            });
        }

        // Add Stop
        if (isDeliveryJob(job)) {
            menuOptions.push({
                text: 'Add Stop',
                icon: 'pin_drop',
                click: () => this.addStopToJob(job, callbacks.onRefresh),
                hasBottomDivider: true
            });
        }

        // Reprice Job
        if (job.internalStatusId
            && job.internalStatusId != InternalJobStatus.Reprice
            && job.speedId === 415) {
            menuOptions.push({
                text: 'Reprice Job',
                icon: 'price_check',
                click: () => this.moveJobToReprice(job, callbacks.onRefresh),
                hasBottomDivider: true
            });
        }

        menuOptions.push({
            text: 'Void Job',
            icon: 'cancel',
            click: () => this.voidJobAction(job, callbacks.onRefresh),
            hasBottomDivider: true
        });

        menuOptions.push({
            text: 'Add Task - Other',
            icon: 'add',
            click: (_$itemScope: any, $event: MouseEvent) => this.addEventOtherAction($event, job, callbacks.onRefresh),
            hasBottomDivider: true
        });

        menuOptions.push({
            text: 'Task Groups',
            icon: 'event',
            hasBottomDivider: true,
            children: this.getEventGroupsMenuItems(job.id, callbacks.onRefresh)
        });

        // Split Job option (if allowed)
        if (job.allowSplit) {
            menuOptions.push({
                text: 'Split Job',
                icon: 'call_split',
                click: (_$itemScope: any, $event: MouseEvent) => this.splitJobAction($event, job, callbacks.onSplitJob),
                hasBottomDivider: true
            });
        }

        // Set First Job
        menuOptions.push({
            text: 'Set First Job',
            icon: 'first_page',
            click: () => this.setFirstJobAction(job, callbacks.onRefreshCourierJobs)
        });

        return menuOptions;
    }

    async voidJobAction(job: IDispatchJob, onRefresh: () => void) {
        if (!job) return;

        try {
            const note = await this.$mdDialog.show(
                this.$mdDialog
                    .prompt()
                    .title("Void Job")
                    .textContent("Add Note")
                    .placeholder("Note")
                    .ariaLabel("Void job")
                    .required(true)
                    .ok("Void")
                    .cancel("Cancel")
            );

            const jobNote: IJobNote = {
                jobId: job.id,
                jobNumber: job.jobNo,
                isImportant: false,
                noteTypeId: JobNoteType.InternalNote,
                noteText: note,
                createdBy: ContactID,
                createdDate: new Date(),
            }

            await this.noteService.createNote(jobNote);
            await this.DispatchData.voidJob(job.id);

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
            .then((groups: Suggestion[]) => {
                this.eventGroupsCache = groups || [];
                console.log('Event groups preloaded:', this.eventGroupsCache.length);
            })
            .catch(error => {
                console.error('Error preloading event groups:', error);
                this.eventGroupsCache = [];
            });
    }

    // Return a function that returns a promise for event groups
    private getEventGroupsMenuItems(jobId: number, onRefresh: () => void): Function {
        return () => {
            // If we have cached groups, use them immediately
            if (this.eventGroupsCache.length > 0) {
                return this.eventGroupsCache.map(group => ({
                    text: group.text,
                    click: () => this.selectEventGroup(group.id, jobId, onRefresh)
                }));
            }

            // Otherwise, fetch and return a promise
            return this.DispatchData.getEventGroups()
                .then((groups: Suggestion[]) => {
                    this.eventGroupsCache = groups || [];
                    return this.eventGroupsCache.map(group => ({
                        text: group.text,
                        click: () => this.selectEventGroup(group.id, jobId, onRefresh)
                    }));
                })
                .catch(error => {
                    console.error('Error loading task groups:', error);
                    return [];
                });
        };
    }

    private async markJobReadOrUnread(job: IDispatchJob, onRefresh: () => void) {
        if (!job) return;

        try {
            await this.DispatchData.updateJobReadStatus(job.id, !job.hasBeenRead);
            this.toastrService.showSuccessToast(job.hasBeenRead ? "Job marked as unread" : "Job marked as read");

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
            `Are you sure you wish to unassign flight ${job.flightNumber} from ${job.jobNo} ?`,
            `${job.flightNumber} unassigned successfully`,
            onRefresh
        );
    }

    private async unassignAgent(job: IDispatchJob, onRefresh: () => void) {
        if (!job) return;
        await this.performUnassignment(
            job,
            "Unassign Agent?",
            `Are you sure you wish to unassign agent ${job.agentName} from ${job.jobNo} ?`,
            `${job.flightNumber} unassigned successfully`,
            onRefresh
        );
    }

    private async addStopToJob(job: IDispatchJob, onRefresh: () => void) {
        if(!job)return;

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

            this.toastrService.showSuccessToast(`Job ${job.jobNum} marked as Reprice`);

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
            await this.nationwideService.restoreJob(job.id);
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

    private async addEventOtherAction($event: MouseEvent, job: IDispatchJob, onRefresh: () => void) {
        if (!job) return;

        await this.addEventDialogService.openAddEventDialog($event, job);

        if (onRefresh) {
            onRefresh();
        }
    }

    private async selectEventGroup(eventGroupId: number, jobId: number, onRefresh: () => void) {
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

    private async splitJobAction($event: MouseEvent, job: IDispatchJob, onSplitJob: (params: {
        job: IDispatchJob
    }) => void) {
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

            await this.DispatchData.splitJob(job.id, FirstName);

            if (onSplitJob) {
                onSplitJob({job: job});
            }
        } catch (error) {
            console.error("Splitting job failed:", error);
        }
    }

    private async setFirstJobAction(job: IDispatchJob, onRefreshCourierJobs: (params: { courierId: number }) => void) {
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
                this.toastrService.showSuccessToast("Job set as first job successfully");

                if (onRefreshCourierJobs) {
                    onRefreshCourierJobs({courierId: job.courierData.courierId});
                }
            }
        } catch (error) {
            console.error("Action cancelled or error occurred:", error);
        }
    }
}

export default JobContextMenuService;
