import ToastrService from "../../../services/toastr.service";
import {DfrntEvent, IJob, Suggestion, TucNoteViewModel} from "../../../interfaces/job.interface";
import DispatchCoreService from "../../../services/dispatch-core.service";
import BaseController from "../../base-controller";
import NationwideService from "../../Nationwide/nationwide.service";
import NoteService from "../../../services/notes.service";
import {JobNoteType} from "../../../enums/job-note-type.enum";
import {material} from "angular";
import {EventType} from "../../../enums/event-type";

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
    eventTypes: Suggestion[];
    selectedEvent: any | null;
    eventForm: any;
    event?: DfrntEvent;

    constructor(
        private $mdDialog: material.IDialogService,
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
        this.eventTypes = [];
        this.selectedEvent = null;
        this.eventForm = null;

        let time = new Date();

        time.setSeconds(0);
        time.setMilliseconds(0);

        this.event = {
            id: job.id,
            jobNumber: job.jobNo,
            clientCode: job.client,
            eventDate: new Date(),
            eventTime: time,
            eventType: "",
            notes: ""
        };
    }

    $onInit() {
        this.DispatchData.getEventTypes().then((data: Suggestion[]) => {
            this.eventTypes = data;

            // Default select other
            const otherEvent = this.eventTypes.find(
                (eventType) => eventType.text === "Other"
            );

            if (otherEvent) {
                this.selectedEvent = otherEvent;
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

            const eventId = this.selectedEvent.id;
            const eventName = this.selectedEvent.text;

            // Exsalerate Event
            if (eventId === EventType.Compliment || eventId === EventType.Complaint) {
                await this.NWData.exsalerateActivity(
                    eventName,
                    event.notes,
                    this.job.clientID ?? 0,
                    event.jobNumber,
                    this.dispatcherName
                );
            }

            //Process Event
            if (
                eventId === EventType.Closed ||
                eventId === EventType.AddressIncorrect ||
                eventId === EventType.FlightDetails ||
                eventId === EventType.WaitingForJob ||
                eventId === EventType.CancelJob
            ) {
                const newNote = eventName + ":" + event.notes;

                const jobNote: TucNoteViewModel = {
                    jobId: this.job.id,
                    jobNumber: this.job.jobNo,
                    isImportant: false,
                    noteTypeId: JobNoteType.InternalNote,
                    noteText: newNote,
                    createdBy: this.contactId,
                    createdDate: new Date(),
                };

                await this.noteService.createNote(this.contactId, jobNote);
            }

            await this.NWData.addEvent(
                this.contactId,
                this.job.id,
                this.dispatcherName,
                event.notes,
                eventId
            );

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
