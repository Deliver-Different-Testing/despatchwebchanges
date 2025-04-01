import {IJob, Suggestion, TucNoteViewModel} from "../../../interfaces/job.interface";
import {ContactID, FirstName} from "../../../contants";
import DispatchCoreService from "../../../services/dispatch-core.service";
import ToastrService from "../../../services/toastr.service";
import {IContextMenuScope, MenuState} from "./job-context-menu.interfaces";
import {EventGroupDialogService} from "../../dialogs/event-group-dialog/event-group-dialog.service";
import "./job-context-menu.styles.less";
import BaseController from "../../base-controller";
import NoteService from "../../../services/notes.service";
import AddEventDialogService from "../../dialogs/add-event-dialog/add-event-dialog.service";
import {JobNoteType} from "../../../enums/job-note-type.enum";

class ContextMenuController extends BaseController {
    static $inject = [
        "$scope",
        "$document",
        "$mdDialog",
        "$mdMenu",
        "toastrService",
        "DispatchData",
        "eventGroupDialogService",
        "$timeout",
        "noteService",
        "addEventDialogService"
    ];

    private menuState: MenuState = {
        visible: false,
        position: {top: 0, left: 0},
        currentJob: null,
        eventGroups: []
    };

    constructor(
        private $scope: IContextMenuScope,
        private $document: angular.IDocumentService,
        private $mdDialog: angular.material.IDialogService,
        public $mdMenu: angular.material.IMenuService,
        private toastrService: ToastrService,
        private DispatchData: DispatchCoreService,
        private eventGroupDialogService: EventGroupDialogService,
        private $timeout: angular.ITimeoutService,
        private noteService: NoteService,
        private addEventDialogService: AddEventDialogService
    ) {
        super();

        this.initEventGroups();
        this.setupDocumentClickHandler();
    }

    $onInit() {
        console.log('Context menu initialized');
    }

    $onDestroy() {
        this.$document.off('click', this.hideMenu);
    }

    private setupDocumentClickHandler() {
        this.$document.on('click', this.hideMenu);
    }

    private initEventGroups() {
        this.DispatchData.getEventGroups()
            .then((groups: Suggestion[]) => {
                this.menuState.eventGroups = groups;
                console.log('Loaded event groups:', groups.length);
            })
            .catch((error: Error) => {
                console.error('Failed to load event groups:', error);
            });
    }

    // Show the context menu at the given position
    showJobContextMenu($event: MouseEvent, job: IJob) {
        $event.preventDefault();
        $event.stopPropagation();

        console.log('Showing context menu for job:', job.id);

        // Store the current job
        this.menuState.currentJob = job;

        // Set position
        this.menuState.position.left = $event.clientX + 'px';
        this.menuState.position.top = $event.clientY + 'px';

        // Show menu
        this.menuState.visible = true;
    }

    hideMenu = (): void => {
        if (this.menuState.visible) {
            this.$timeout(() => {
                this.menuState.visible = false;
                this.$scope.$apply();
            });
        }
    }

    async voidJobAction() {
        if (!this.menuState.currentJob) return;

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

            const job = this.menuState.currentJob;
            if (!job) return;

            const jobNote: TucNoteViewModel = {
                jobId: job.id,
                jobNumber: job.jobNo,
                isImportant: false,
                noteTypeId: JobNoteType.InternalNote,
                noteText: note,
                createdBy: ContactID,
                createdDate: new Date(),
            }

            await this.noteService.createNote(ContactID, jobNote);
            await this.DispatchData.voidJob(job.id);

            this.toastrService.showSuccessToast("Job voided successfully");
            this._onRefresh();
        } catch (error) {
            if (error) {
                console.error("Job void error:", error);
            }
        }

        this.hideMenu();
    }

    async addEventOtherAction($event: MouseEvent) {
        if (!this.menuState.currentJob) return;
        await this.addEventDialogService.openAddEventDialog($event, this.menuState.currentJob)
        this.hideMenu();
    }

    async selectEventGroup(eventGroupId: number) {
        if (!this.menuState.currentJob) return;

        try {
            await this.eventGroupDialogService.openEventGroupDialog(
                eventGroupId,
                this.menuState.currentJob.id
            );
            this._onRefresh();
        } catch (error) {
            if (error) {
                console.error("Error in event group dialog:", error);
            }
        }

        this.hideMenu();
    }

    async splitJobAction($event: MouseEvent) {
        if (!this.menuState.currentJob) return;
        const job = this.menuState.currentJob;

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
            this.hideMenu();
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
            this._onSplitJob({job: this.menuState.currentJob});
        } catch (error) {
            if (error) {
                console.error("Splitting job failed:", error);
            }
        }

        this.hideMenu();
    }

    async setFirstJobAction() {
        if (!this.menuState.currentJob) return;
        const job = this.menuState.currentJob;

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

                this._onRefreshCourierJobs({courierId: job.courierData.courierId});
            }
        } catch (error) {
            if (error) {
                console.error("Action cancelled or error occurred:", error);
            }
        }

        this.hideMenu();
    }

    // Callback functions to parent
    private _onRefresh() {
        if (this.$scope.onRefresh) {
            this.$scope.onRefresh();
        }
    }

    private _onSplitJob(params: { job: IJob | null }) {
        if (this.$scope.onSplitJob && params.job) {
            this.$scope.onSplitJob({job: params.job});
        }
    }

    private _onRefreshCourierJobs(params: { courierId: number }) {
        if (this.$scope.onRefreshCourierJobs) {
            this.$scope.onRefreshCourierJobs({courierId: params.courierId});
        }
    }
}

const ContextMenuComponent: angular.IComponentOptions = {
    controller: ContextMenuController,
    controllerAs: 'ctrl',
    template: require("./job-context-menu.template.html"),
    bindings: {
        onRefresh: '&',
        onSplitJob: '&',
        onRefreshCourierJobs: '&'
    }
};
export default ContextMenuComponent;
