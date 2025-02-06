/**
 * @class JobFileUploadController
 * @description Controller for handling file uploads related to a specific job.
 */
class JobFileUploadController {

    /**
     * @type {string[]}
     * @static
     * @description List of dependencies to be injected.
     */
    static $inject = [
        "$http",
        "$mdDialog",
        "$document",
        "$window",
        "toastrService",
        "Upload",
        "bytesFilter",
        "jobId"

    ];
    /**
     * @constructor
     * @param {object} $http - Angular's $http service for making HTTP requests.
     * @param {object} $mdDialog - Angular Material's $mdDialog service for creating dialogs.
     * @param {object} $document - Angular's wrapper for the window.document object.
     * @param {object} $window - Angular's wrapper for the window object.
     * @param {object} toastrService - Service for displaying toast notifications.
     * @param {object} Upload - Service for handling file uploads (likely ng-file-upload).
     * @param {function} bytesFilter - Filter function for formatting bytes.
     * @param {number} jobId - The ID of the job associated with the file uploads.
     */
    constructor($http, $mdDialog, $document, $window, toastrService, Upload, bytesFilter, jobId) {
        this._$http = $http;
        this.$mdDialog = $mdDialog;
        this._$document = $document;
        this._$window = $window;
        this.toastrService = toastrService;
        this._jobId = jobId;

        /** @type {Array} List of files already attached to the job */
        this.files = [];
        /** @type {Array} List of files currently being uploaded */
        this.uploadingFiles = [];


        this.loadFiles();
    }

    /**
     * @method loadFiles
     * @description Loads the list of files attached to the job from the server.
     */
    loadFiles() {
        this._$http.get("/job/getAttachedFiles", {
            params: {
                jobId: this._jobId
            }
        }).then((response) => {
            this.files = response.data;
            console.log("Files:", this.files);  // Combined logs for clarity
        }).catch((error) => {    // Using catch instead of error callback
            console.error("Error loading files:", error);
            this.toastrService.showErrorToast("Failed to load files. Please try again.");
        });
    }

    /**
     * @method uploadFiles
     * @description Initiates the upload process for multiple files.
     * @param {File[]} files - Array of File objects to be uploaded.
     */
    uploadFiles(files) {
        if (files && files.length) {
            for (let i = 0; i < files.length; i++) {
                this.upload(files[i]);
            }
        }
    }

    /**
     * @method upload
     * @description Uploads a single file to the server.
     * @param {File} file - The File object to be uploaded.
     */
    upload(file) {
        const formData = new FormData();
        formData.append("jobId", this._jobId.toString());
        formData.append("file", file);

        this._$http.post("/job/uploadFile", formData, {
            transformRequest: angular.identity,
            headers: { 'Content-Type': undefined, 'enctype': "multipart/form-data" },
            uploadEventHandlers: {
                progress: (event) => {
                    const progressPercentage = Math.round((100 * event.loaded) / event.total);
                    console.log(`progress: ${progressPercentage}% ${file.name}`);
                    this.updateFileProgress(file, progressPercentage);
                }
            }
        }).then(
            (response) => {
                const message = `Success ${file.name} uploaded`;
                this.toastrService.showSuccessToast()
                console.log(message + ". Response: " + JSON.stringify(response.data));
                this.loadFiles();
            },
            (error) => {
                console.error(`Error status: ${error.status}`);
                console.error(`Error data: ${JSON.stringify(error.data)}`);
                this.toastrService.showErrorToast(`Failed to upload file: ${file.name}. Please try again.`);
            }
        );
    }

    /**
     * @method updateFileProgress
     * @description Updates the progress of a file being uploaded.
     * @param {File} file - The file being uploaded.
     * @param {number} progress - The current progress percentage.
     */
    updateFileProgress(file, progress) {
        let index = this.uploadingFiles.findIndex((f) => f.name === file.name && f.size === file.size);
        if (index === -1) {
            this.uploadingFiles.push({ ...file, progress: progress });
        } else {
            this.uploadingFiles[index].progress = progress;
        }
    }

    /**
     * @method downloadFile
     * @description Initiates the download of a file.
     * @param {object} file - The file object to be downloaded.
     */
    downloadFile(file) {
        this._$http.get("/job/DownloadFile", {
            params: {
                jobId: this._jobId,
                key: file.s3Key
            },
            responseType: "blob",
            headers: {
                'Accept': "application/octet-stream"
            }
        }).then(
            (response) => {
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
                const blob = new Blob([response.data], { type: contentType });
                const url = this._$window.URL.createObjectURL(blob);

                const link = angular.element("<a></a>")[0];
                link.href = url;
                link.download = filename;
                link.style.display = "none";

                // Use angular.element for DOM manipulation
                angular.element(this._$document[0].body).append(link);
                link.click();

                // Cleanup
                this._$window.setTimeout(() => {
                    angular.element(link).remove();
                    this._$window.URL.revokeObjectURL(url);
                }, 100);
            },
            (error) => {
                console.error("Download failed:", error);
                // Handle error appropriately
            }
        );
    }

    /**
     * @method deleteFile
     * @description Deletes a file from the server.
     * @param {object} file - The file object to be deleted.
     */
    deleteFile(file) {
        this._$http.delete("/job/DeleteFile", {
            params: {
                jobId: this._jobId,
                key: file.s3Key
            }
        }).then(
            (response) => {
                console.log("Delete Success:", response.data);
                this.loadFiles();
            },
            (error) => {
                console.error("Delete Error:", error);
                this.toastrService.showErrorToast("Failed to delete file. Please try again.");
            }
        );
    }

    /**
     * @method cancel
     * @description Cancels the current dialog operation.
     */
    cancel() {
        this.$mdDialog.cancel();
    }
}

angular.module("uDispatch").controller("JobFileUploadController", JobFileUploadController);
