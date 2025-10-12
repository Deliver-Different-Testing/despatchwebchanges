import {IDispatchJob, IJob} from "../../../interfaces/job.interface";
import JobFileUploadController from "./job-file-upload.controller";
import { FileUploadType } from "../../../enums/file-upload-type.enum";

class JobFileUploadDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        '$document',
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
    ) {
        console.debug('JobFileUploadDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    async openJobFileUploadDialog($event: MouseEvent, job: IJob | IDispatchJob, uploadType: FileUploadType = FileUploadType.NORMAL) {
        try {
            await this.$mdDialog.show({
                controller: JobFileUploadController,
                controllerAs: "ctrl",
                parent: this.$document.parent(),
                template: require("./job-file-upload-dialog.template.html"),
                clickOutsideToClose: false,
                fullscreen: true,
                targetEvent: $event,
                locals: {
                    jobId: job.id,
                    initialUploadType: uploadType
                },
                bindToController: true,
            });

            console.debug("Job File Upload Dialog Closed");
        } catch (error) {
            if (!error) {
                console.debug("User closed dialog");
            } else {
                console.error("Error in openJobFileUploadDialog", error);
                throw error;
            }
        }
    }
}
export default JobFileUploadDialogService;
