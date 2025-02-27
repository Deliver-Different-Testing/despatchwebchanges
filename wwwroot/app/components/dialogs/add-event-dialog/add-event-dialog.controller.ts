import ToastrService from "../../../services/toastr.service";
import {DfrntEvent, Job} from "../../../interfaces/job.interface";
import app from "../../../app";

interface AddEventDialogControllerScope extends angular.IScope {
    eventForm: any;
}

class AddEventDialogController implements angular.IController {
    static $inject = ["$scope", "$mdDialog", "NWData", "toastrService", "job", "dispatcherName", "contactId"];

    public isLoading: boolean;
    public eventTypes: Array<any>;
    public selectedEvent: any | null;
    public eventForm: any;
    public event: {
        jobId: any;
        jobNumber: any;
        clientCode: any;
        eventDate: Date;
        eventTime: Date;
        eventType: string;
        notes: string;
    };

    constructor(
        $scope: AddEventDialogControllerScope,
        private $mdDialog: angular.material.IDialogService,
        private NWData: any,
        private toastrService: ToastrService,
        private job: Job,
        private dispatcherName: string,
        private contactId: string
    ) {
        this.isLoading = false;
        this.eventTypes = [];
        this.selectedEvent = null;
        this.eventForm = $scope.eventForm;

        let time = new Date();

        time.setSeconds(0);
        time.setMilliseconds(0);

        this.event = {
            jobId: job.id,
            jobNumber: job.jobNo,
            clientCode: job.client,
            eventDate: new Date(),
            eventTime: time,
            eventType: "",
            notes: ""
        };

    }

    $onInit(): void {
        this.NWData.getEventTypes().then((data: Array<any>) => {
            this.eventTypes = data;

            // Find the event that matches "Other" and set it to this.selectedEvent
            const otherEvent = this.eventTypes.find(eventType => eventType.text === "Other");
            if (otherEvent) {
                this.selectedEvent = otherEvent;
            }
        });
    }

    async submit(event: DfrntEvent): Promise<void> {
        try {
            if (!this.eventForm.$valid) {
                this.toastrService.showWarningToast("Please complete all the required fields.");
                return;
            }

            this.isLoading = true;

            const eventId = this.selectedEvent.id;
            const eventName = this.selectedEvent.text;

            // Exsalerate Event
            if (eventId === "7" || eventId === "92") {
                await this.NWData.exsalerateActivity(eventName, event.notes, this.job.clientId, event.jobNumber, this.dispatcherName);
            }

            //Process Event
            if (eventId === "48" || eventId === "52" || eventId === "54" || eventId === "60" || eventId === "6") {
                //Add Notes
                const newNote = eventName + ":" + event.notes;
                await this.NWData.addNote(event.id, newNote, FirstName, false);
            }

            await this.NWData.addEvent(event.jobNumber, this.job.clientId, this.job.contactName, this.contactId, this.job.courierData.courierId, this.job.id, this.job.jobType, this.dispatcherName, event.notes, eventId);

            if (eventId === "6") {
                this.NWData.voidJob(this.job.id);
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
}

app.controller("AddEventDialogController", AddEventDialogController);
