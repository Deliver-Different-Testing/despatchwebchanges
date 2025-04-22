import DispatchCoreService from "./dispatch-core.service";
import ToastrService from "./toastr.service";
import NoteService from "./notes.service";
import {EventGroupDialogService} from "../components/dialogs/event-group-dialog/event-group-dialog.service";
import AddEventDialogService from "../components/dialogs/add-event-dialog/add-event-dialog.service";
import {IDispatchJob, IJobNote} from "../interfaces/job.interface";
import {JobNoteType} from "../enums/job-note-type.enum";

interface IContextMenuOption {
    text: string | Function;
    html?: string | Function;
    click?: Function;
    enabled?: boolean | Function;
    displayed?: boolean | Function;
    hasTopDivider?: boolean | Function;
    hasBottomDivider?: boolean | Function;
    children?: IContextMenuOption[] | Function | Promise<any>;
    icon?: string;
}

export default class JobContextMenuService implements angular.IServiceProvider {
    static $inject = [
        "$mdDialog",
        "$document",
        "DispatchData",
        "toastrService",
        "noteService",
        "eventGroupDialogService",
        "addEventDialogService"
    ];

    private eventGroupsCache: Suggestion[] = [];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
        private DispatchData: DispatchCoreService,
        private toastrService: ToastrService,
        private noteService: NoteService,
        private eventGroupDialogService: EventGroupDialogService,
        private addEventDialogService: AddEventDialogService
    ) {
        this._preloadEventGroups();
    }

    $get() {
        return this;
    }

    private _preloadEventGroups(): void {
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

    getMenuOptions(job: IDispatchJob, callbacks: any): IContextMenuOption[] {
        if (!job) return [];

        const menuOptions: IContextMenuOption[] = [
            // Read/Unread Job
            {
                text: job.hasBeenRead ? 'Mark as Unread' : 'Mark as Read',
                icon: job.hasBeenRead ? 'mark_email_unread' : 'mark_email_read',
                click: () => this.markJobReadOrUnread(job, callbacks.onRefresh),
                hasBottomDivider: true
            },

            // Void Job
            {
                text: 'Void Job',
                icon: 'cancel',
                click: () => this.voidJobAction(job, callbacks.onRefresh),
                hasBottomDivider: true
            },

            // Add Task - Other
            {
                text: 'Add Task - Other',
                icon: 'add',
                click: (_$itemScope: any, $event: MouseEvent) => this.addEventOtherAction($event, job, callbacks.onRefresh),
                hasBottomDivider: true
            }
        ];

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

    async markJobReadOrUnread(job: IDispatchJob, onRefresh: () => void) {
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

    async addEventOtherAction($event: MouseEvent, job: IDispatchJob, onRefresh: () => void) {
        if (!job) return;

        await this.addEventDialogService.openAddEventDialog($event, job);

        if (onRefresh) {
            onRefresh();
        }
    }

    async selectEventGroup(eventGroupId: number, jobId: number, onRefresh: () => void) {
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

    async splitJobAction($event: MouseEvent, job: IDispatchJob, onSplitJob: (params: { job: IDispatchJob }) => void) {
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

    async setFirstJobAction(job: IDispatchJob, onRefreshCourierJobs: (params: { courierId: number }) => void) {
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
