import ToastrService from "../../../services/toastr.service";
import {DfrntEvent, IJob, Suggestion, IJobNote} from "../../../interfaces/job.interface";
import DispatchCoreService from "../../../services/dispatch-core.service";
import BaseController from "../../base-controller";
import NationwideService from "../../Nationwide/nationwide.service";
import NoteService from "../../../services/notes.service";
import {JobNoteType} from "../../../enums/job-note-type.enum";
import {EventType} from "../../../enums/event-type";
import {JobEventData} from "./add-event-dialog.interfaces";
import moment from "moment";

class AddEventDialogController extends BaseController {
    static $inject = [
        "$mdDialog",
        "DispatchData",
        "toastrService",
        "NWData",
        "noteService",
        "job",
        "dispatcherName",
        "contactId",
    ];

    isLoading: boolean;
    eventTypes?: Suggestion[];
    selectedEventType?: Suggestion;
    eventForm?: any;
    event?: DfrntEvent;
    browserTimeZone: string;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private DispatchData: DispatchCoreService,
        private toastrService: ToastrService,
        private NWData: NationwideService,
        private noteService: NoteService,
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
        this.DispatchData.getEventTypes().then((data: Suggestion[]) => {
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

    async submit(event: DfrntEvent): Promise<void> {
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
                await this.NWData.exsalerateActivity(
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
                    noteText: newNote
                };

                await this.noteService.createNote(jobNote);
            }

            const eventData: JobEventData = {
                staffId: this.contactId,
                jobId: this.job.id,
                despatcherName: this.dispatcherName,
                notes: event.notes ?? '',
                eventTypeId: eventId,
                eventDueDate: moment(event.eventDate).utc().format()
            }

            await this.NWData.addEvent(eventData);

            if (eventId === EventType.CancelJob) {
                await this.DispatchData.voidJob(this.job.id);
            }

            this.$mdDialog.hide();
        } catch (error: any) {
            console.error(error);
            this.toastrService.showErrorToast(error.message);
            this.isLoading = false;
        }
    }

    cancel() {
        this.$mdDialog.cancel();
    }
}

export default AddEventDialogController;
