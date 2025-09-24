import {IDispatchJob, IJob} from "../../../interfaces/job.interface";
import JobFileUploadController from "./job-file-upload.controller";
import { FileUploadType } from "../../../enums/file-upload-type.enum";

class JobFileUploadDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        '$document',
        '$log',
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
        private $log: angular.ILogService,
    ) {
        this.$log.debug('JobFileUploadDialogService: Service instantiated');
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

            this.$log.debug("Job File Upload Dialog Closed");
        } catch (error) {
            if (!error) {
                this.$log.debug("User closed dialog");
            } else {
                this.$log.error("Error in openJobFileUploadDialog", error);
                throw error;
            }
        }
    }
}
export default JobFileUploadDialogService;
