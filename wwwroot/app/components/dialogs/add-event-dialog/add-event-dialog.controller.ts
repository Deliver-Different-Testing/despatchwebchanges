import ToastrService from "../../../services/toastr.service";
import {DfrntEvent, IJob, Suggestion, TucNoteViewModel} from "../../../interfaces/job.interface";
import DispatchCoreService from "../../../services/dispatch-core.service";
import BaseController from "../../base-controller";
import NationwideService from "../../Nationwide/nationwide.service";
import NoteService from "../../../services/notes.service";
import {JobNoteType} from "../../../enums/job-note-type.enum";
import { material } from "angular";

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

  public isLoading: boolean;
  public eventTypes: Suggestion[];
  public selectedEvent: any | null;
  public eventForm: any;
  public event?: DfrntEvent;

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
      eventTime: new Date(),
      eventType: "",
      notes: ""
    };
  }

  $onInit(): void {
    this.DispatchData.getEventTypes().then((data: Suggestion[]) => {
      this.eventTypes = data;

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
      if (eventId === "7" || eventId === "92") {
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
          eventId === "48" ||
          eventId === "52" ||
          eventId === "54" ||
          eventId === "60" ||
          eventId === "6"
      ) {
        const newNote = eventName + ":" + event.notes;

        const jobNote: TucNoteViewModel = {
          jobId: this.job.id,
          jobNumber: this.job.jobNo,
          isImportant: false,
          noteTypeId: JobNoteType.InternalNote,
          noteText: newNote,
          createdBy: ContactID,
          createdDate: new Date(),
        };

        await this.noteService.createNote(ContactID, jobNote);
      }

      await this.NWData.addEvent(
          this.contactId,
          this.job.id,
          this.dispatcherName,
          event.notes,
          eventId
      );

      if (eventId === "6") {
        await this.DispatchData.voidJob(this.job.id);
      }
    } catch (error: any) {
      this.toastrService.showErrorToast(error.message);
    } finally {
      this.isLoading = false;
    }

    this.$mdDialog.hide();
  }

  cancel(): void {
    this.$mdDialog.cancel();
  }

  setEventForm(form: any): void {
    this.eventForm = form;
  }
}

export default AddEventDialogController;
