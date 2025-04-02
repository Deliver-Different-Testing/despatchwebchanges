import {DispatchJob, IJob} from "../../../interfaces/job.interface";
import JobFileUploadController from "./job-file-upload.controller";

class JobFileUploadDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        '$document'
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
    ) {
        console.log('JobFileUploadDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    async openJobFileUploadDialog($event: MouseEvent, job: IJob | DispatchJob) {
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
                },
                bindToController: true,
            });

            console.log("Job File Upload Dialog Closed");
        } catch (error) {
            if (!error) {
                console.log("User closed dialog");
            } else {
                throw error;
            }
        }
    }
}
export default JobFileUploadDialogService;
