import {IJob} from "../../../interfaces/job.interface";
import EditParcelDimensionsDialogController from "./edit-parcel-dimensions-dialog.controller";

class EditParcelDimensionsDialogService {
    static $inject = [
        '$mdDialog',
        '$document'
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
    ) {
        console.log('EditParcelDimensionsDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    async showJobDimensionsDialog($event: MouseEvent, job: IJob) {
        await this.$mdDialog.show({
            controller: EditParcelDimensionsDialogController,
            controllerAs: "ctrl",
            parent: this.$document.parent(),
            targetEvent: $event,
            template: require("./edit-parcel-dimensions-dialog.template.html"),
            clickOutsideToClose: false,
            fullscreen: true,
            locals: {
                parcels: job.parcelDimensions,
                jobId: job.isBulkJob ? undefined : job.id,
                bulkJobId: job.isBulkJob ? job.id : undefined,
            },
            bindToController: true,
        });
    }
}

export default EditParcelDimensionsDialogService;
