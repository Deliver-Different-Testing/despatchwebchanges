import ToastrService from "../../../services/toastr.service";
import {DfrntEvent, IJob, ISuggestion, IJobNote} from "../../../interfaces/job.interface";
import DispatchCoreService from "../../../services/dispatch-core.service";
import BaseController from "../../base-controller";
import NoteService from "../../../services/notes.service";
import {JobNoteType} from "../../../enums/job-note-type.enum";
import {EventType} from "../../../enums/event-type";
import {JobEventData} from "./add-event-dialog.interfaces";
import dayjs from "dayjs";
import VoidJobConfirmationDialogService from "../void-job-confirmation-dialog/void-job-confirmation-dialog.service";
import {formatDateForApiWithTzs} from "../../../functions/formatDates";

class AddEventDialogController extends BaseController {
    static $inject = [
        "$mdDialog",
        "$log",
        "DispatchData",
        "toastrService",
        "noteService",
        "voidJobConfirmationDialogService",
        "job",
        "dispatcherName",
        "contactId",
    ];

    isLoading: boolean;
    eventTypes?: ISuggestion[];
    selectedEventType?: ISuggestion;
    eventForm?: any;
    event?: DfrntEvent;
    browserTimeZone: string;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $log: angular.ILogService,
        private DispatchData: DispatchCoreService,
        private toastrService: ToastrService,
        private noteService: NoteService,
        private voidJobConfirmationDialogService: VoidJobConfirmationDialogService,
        private job: IJob,
        private dispatcherName: string,
        private contactId: number
    ) {
        super();

        this.isLoading = false;
        this.browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        let time = new Date();
        time.setSeconds(0);
        time.setMilliseconds(0);

        this.event = {
            id: job.id,
            jobNumber: job.jobNo,
            clientCode: job.client,
            eventDate: new Date()
        };
    }

    $onInit() {
        this.DispatchData.getEventTypes().then((data: ISuggestion[]) => {
            this.eventTypes = data;

            // Default selects other
            const otherEvent = this.eventTypes.find(
                eventType => eventType.id === EventType.Other
            );

            if (otherEvent) {
                this.selectedEventType = otherEvent;
            }
        });
    }

    async submit($event: MouseEvent, event: DfrntEvent): Promise<void> {
        try {
            if (this.eventForm && !this.eventForm.$valid) {
                this.toastrService.showWarningToast(
                    "Please complete all the required fields."
                );
                return;
            }

            this.isLoading = true;

            if (!this.selectedEventType) {
                this.toastrService.showWarningToast("Please select an event type.");
                this.isLoading = false;
                return;
            }

            const eventId = this.selectedEventType.id;
            const eventName = this.selectedEventType.text;

            // Exsalerate Event
            if (eventId === EventType.Compliment || eventId === EventType.Complaint) {
                await this.DispatchData.exsalerateActivity(
                    eventName,
                    event.notes ?? '',
                    this.job.clientId ?? 0,
                    event.jobNumber,
                    this.dispatcherName
                );
            }

            // Process Event
            if (
                eventId === EventType.Closed ||
                eventId === EventType.AddressIncorrect ||
                eventId === EventType.FlightDetails ||
                eventId === EventType.WaitingForJob ||
                eventId === EventType.CancelJob
            ) {
                const newNote = eventName + ":" + event.notes;

                const jobNote: IJobNote = {
                    jobId: this.job.id,
                    jobNumber: this.job.jobNo,
                    isImportant: false,
                    noteTypeId: JobNoteType.InternalNote,
                    noteText: newNote,
                    createdDate: dayjs().toDate()
                };

                await this.noteService.createNote(jobNote);
            }

            const eventData: JobEventData = {
                staffId: this.contactId,
                jobId: this.job.id,
                despatcherName: this.dispatcherName,
                notes: event.notes ?? '',
                eventTypeId: eventId,
                eventDueDate: formatDateForApiWithTzs(event.eventDate)
            }

            await this.DispatchData.addEvent(eventData);

            if (eventId === EventType.CancelJob) {
                const jobDetail = await this.DispatchData.getDispatchJobDetail(this.job.id);
                await this.voidJobConfirmationDialogService.showVoidConfirmationDialog($event, jobDetail);
            }

            this.$mdDialog.hide();
        } catch (error: any) {
            this.$log.debug(error);
            this.toastrService.showErrorToast(error.message);
            this.isLoading = false;
        }
    }

    cancel() {
        this.$mdDialog.cancel();
    }
}

export default AddEventDialogController;
