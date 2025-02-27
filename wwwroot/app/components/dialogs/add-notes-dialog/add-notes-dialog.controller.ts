import ToastrService from "../../../services/toastr.service";
import DispatchService from "../../../services/dispatchService";
import {Job} from "../../../interfaces/job.interface";
import app from "../../../app";

class AddNotesDialogController implements angular.IController {
    static $inject: string[] = ["$mdDialog", "toastrService", "DispatchData", "fieldName", "job"];

    public isLoading: boolean;
    public note?: string;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private toastrService: ToastrService,
        private DispatchData: DispatchService,
        private fieldName: string,
        private job: Job
    ) {
        this.isLoading = false;
    }

    $onInit(): void {
        if (this.fieldName === "Note") {
            this.note = this.job.internalNotes;
        } else if (this.fieldName === "ConNote") {
            this.note = this.job.conNote;
        } else {
            this.note = "";
        }
    }

    async submit(note: string): Promise<void> {
        try {
            this.isLoading = true;
            if (this.fieldName === "Note") {
                await this.addJobNote(this.job.id, note, FirstName, this.job.preBook, this.job.bulkJob);
                this.job.internalNotes = note;
            } else if (this.fieldName === "ConNote") {
                await this.DispatchData.addConNote(this.job.id, note);
                this.job.conNote = note;
            } else {
                // Other type of notes
                const callData = {
                    "call": "updateDetailField",
                    "field": this.fieldName,
                    "value": note,
                    "jobID": this.job.id
                };

                await this.updateJobDetail(this.job.bulkJob, callData.jobID, callData.field, callData.value, this.job.charge, FirstName, ContactID, this.job.preBook);
                if (this.isValidJobField(this.fieldName)) {
                    (this.job as any)[this.fieldName] = note;
                }
            }

            this.toastrService.showSuccessToast("Note saved");
            this.$mdDialog.hide(this.job);
        } catch (error: any) {
            this.toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
        }
    }

    async addJobNote(id: number, note: string, firstName: string, preBook: boolean, bulkJob: boolean): Promise<void> {
        if (bulkJob) {
            await this.DispatchData.addBulkJobNote(id, note, firstName, preBook);
        } else {
            await this.DispatchData.addNote(id, note, firstName, preBook);
        }
    }

    async updateJobDetail(
        bulkJob: boolean,
        jobID: number,
        field: string,
        value: string,
        charge: string,
        firstName: string,
        contactID: number,
        preBook: boolean
    ): Promise<void> {
        if (bulkJob) {
            await this.DispatchData.updateBulkJobDetail(jobID, field, value, charge, firstName, contactID);
        } else {
            await this.DispatchData.updateJobDetail(jobID, field, value, charge, firstName, contactID, preBook);
        }
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }

    private isValidJobField(fieldName: string): fieldName is keyof Job {
        return fieldName in this.job;
    }
}

app.controller("AddNotesDialogController", AddNotesDialogController);
