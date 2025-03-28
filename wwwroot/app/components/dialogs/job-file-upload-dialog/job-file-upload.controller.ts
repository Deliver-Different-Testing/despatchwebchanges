import ToastrService from "../../../services/toastr.service";
import BaseController from "../../base-controller";

class JobFileUploadController extends BaseController {
    static $inject = [
        "$http",
        "$mdDialog",
        "$window",
        "toastrService",
        "Upload",
        "bytesFilter",
        "jobId"
    ];

    files: any[];
    uploadingFiles: any[];

    constructor(
        private $http: angular.IHttpService,
        private $mdDialog: angular.material.IDialogService,
        private $window: angular.IWindowService,
        private toastrService: ToastrService,
        public Upload: any,
        public bytesFilter: (bytes: any) => string,
        public jobId: number
    ) {
        super();

        this.files = [];
        this.uploadingFiles = [];
    }

    $onInit() {
        this.loadFiles();
    }

    loadFiles(): void {
        this.$http.get("/job/getAttachedFiles", {
            params: {
                jobId: this.jobId
            }
        }).then((response: angular.IHttpResponse<any>) => {
            this.files = response.data;
            console.log("Files:", this.files);  // Combined logs for clarity
        }).catch((error: any) => {    // Using catch instead of error callback
            console.error("Error loading files:", error);
            this.toastrService.showErrorToast("Failed to load files. Please try again.");
        });
    }

    uploadFiles(files: File[]): void {
        if (files && files.length) {
            for (let i = 0; i < files.length; i++) {
                this.upload(files[i]);
            }
        }
    }
    upload(file: File): void {
        const formData = new FormData();
        formData.append("jobId", this.jobId.toString());
        formData.append("file", file);

        this.Upload.upload({
            url: "/job/uploadFile",
            data: formData,
            headers: {'Content-Type': undefined, 'enctype': "multipart/form-data"},
            uploadEventHandlers: {
                progress: (event: ProgressEvent) => {
                    const progressPercentage = Math.round((100 * event.loaded) / event.total);
                    console.log(`progress: ${progressPercentage}% ${file.name}`);
                    this.updateFileProgress(file, progressPercentage);
                }
            }
        }).then(
            (response: angular.IHttpResponse<any>) => {
                const message = `Success ${file.name} uploaded`;
                this.toastrService.showSuccessToast(message);
                console.log(message + ". Response: " + JSON.stringify(response.data));
                this.loadFiles();
            },
            (error: any) => {
                console.error(`Error status: ${error.status}`);
                console.error(`Error data: ${JSON.stringify(error.data)}`);
                this.toastrService.showErrorToast(`Failed to upload file: ${file.name}. Please try again.`);
            }
        );
    }

    updateFileProgress(file: File, progress: number): void {
        let index: number = this.uploadingFiles.findIndex((f: any) => f.name === file.name && f.size === file.size);
        if (index === -1) {
            this.uploadingFiles.push({...file, progress: progress});
        } else {
            this.uploadingFiles[index].progress = progress;
        }
    }

    downloadFile(file: { fileName: string; s3Key: string; }): void {
        this.$http.get<Blob>("/job/DownloadFile", {
            params: {
                jobId: this.jobId,
                key: file.s3Key
            },
            responseType: "blob",
            headers: {
                'Accept': "application/octet-stream"
            }
        }).then(
            (response: angular.IHttpResponse<Blob>) => {
                // Log response for debugging
                console.log("Response received:", response);
                console.log("All headers:", response.headers());

                // Get content type - fallback to image/jpeg if not found
                const contentType = response.headers("content-type") || "image/jpeg";

                // Parse content disposition header
                const contentDisposition = response.headers("content-disposition");
                let filename = file.fileName;

                if (contentDisposition) {
                    // Parse the filename from content-disposition
                    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                    const matches = filenameRegex.exec(contentDisposition);
                    if (matches != null && matches[1]) {
                        // Remove quotes if present
                        filename = matches[1].replace(/['"]/g, "");
                    }
                }

                // Create and trigger download
                const blob = new Blob([response.data], {type: contentType});
                const url = this.$window.URL.createObjectURL(blob);

                const link = angular.element("<a></a>")[0] as HTMLAnchorElement;
                link.href = url;
                link.download = filename;
                link.style.display = "none";

                // Use angular.element for DOM manipulation
                document.body.append(link);
                link.click();

                // Cleanup
                this.$window.setTimeout(() => {
                    angular.element(link).remove();
                    this.$window.URL.revokeObjectURL(url);
                }, 100);
            },
            (error: any) => {
                console.error("Download failed:", error);
                // Handle error appropriately
            }
        );
    }

    deleteFile(file: { s3Key: string; }): void {
        this.$http.delete("/job/DeleteFile", {
            params: {
                jobId: this.jobId,
                key: file.s3Key
            }
        }).then(
            (response: angular.IHttpResponse<any>) => {
                console.log("Delete Success:", response.data);
                this.loadFiles();
            },
            (error: any) => {
                console.error("Delete Error:", error);
                this.toastrService.showErrorToast("Failed to delete file. Please try again.");
            }
        );
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}
export default JobFileUploadController;
