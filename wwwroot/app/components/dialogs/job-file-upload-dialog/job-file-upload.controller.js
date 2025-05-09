"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("../../../app"));
class JobFileUploadController {
    constructor($http, $mdDialog, $window, toastrService, Upload, bytesFilter, jobId) {
        this.$http = $http;
        this.$mdDialog = $mdDialog;
        this.$window = $window;
        this.toastrService = toastrService;
        this.Upload = Upload;
        this.bytesFilter = bytesFilter;
        this.jobId = jobId;
        this.files = [];
        this.uploadingFiles = [];
    }
    $onInit() {
        this.loadFiles();
    }
    loadFiles() {
        this.$http.get("/job/getAttachedFiles", {
            params: {
                jobId: this.jobId
            }
        }).then((response) => {
            this.files = response.data;
            console.log("Files:", this.files); // Combined logs for clarity
        }).catch((error) => {
            console.error("Error loading files:", error);
            this.toastrService.showErrorToast("Failed to load files. Please try again.");
        });
    }
    uploadFiles(files) {
        if (files && files.length) {
            for (let i = 0; i < files.length; i++) {
                this.upload(files[i]);
            }
        }
    }
    upload(file) {
        const formData = new FormData();
        formData.append("jobId", this.jobId.toString());
        formData.append("file", file);
        this.Upload.upload({
            url: "/job/uploadFile",
            data: formData,
            headers: { 'Content-Type': undefined, 'enctype': "multipart/form-data" },
            uploadEventHandlers: {
                progress: (event) => {
                    const progressPercentage = Math.round((100 * event.loaded) / event.total);
                    console.log(`progress: ${progressPercentage}% ${file.name}`);
                    this.updateFileProgress(file, progressPercentage);
                }
            }
        }).then((response) => {
            const message = `Success ${file.name} uploaded`;
            this.toastrService.showSuccessToast(message);
            console.log(message + ". Response: " + JSON.stringify(response.data));
            this.loadFiles();
        }, (error) => {
            console.error(`Error status: ${error.status}`);
            console.error(`Error data: ${JSON.stringify(error.data)}`);
            this.toastrService.showErrorToast(`Failed to upload file: ${file.name}. Please try again.`);
        });
    }
    updateFileProgress(file, progress) {
        let index = this.uploadingFiles.findIndex((f) => f.name === file.name && f.size === file.size);
        if (index === -1) {
            this.uploadingFiles.push(Object.assign(Object.assign({}, file), { progress: progress }));
        }
        else {
            this.uploadingFiles[index].progress = progress;
        }
    }
    downloadFile(file) {
        this.$http.get("/job/DownloadFile", {
            params: {
                jobId: this.jobId,
                key: file.s3Key
            },
            responseType: "blob",
            headers: {
                'Accept': "application/octet-stream"
            }
        }).then((response) => {
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
            const url = this.$window.URL.createObjectURL(blob);
            const link = angular.element("<a></a>")[0];
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
        }, (error) => {
            console.error("Download failed:", error);
            // Handle error appropriately
        });
    }
    deleteFile(file) {
        this.$http.delete("/job/DeleteFile", {
            params: {
                jobId: this.jobId,
                key: file.s3Key
            }
        }).then((response) => {
            console.log("Delete Success:", response.data);
            this.loadFiles();
        }, (error) => {
            console.error("Delete Error:", error);
            this.toastrService.showErrorToast("Failed to delete file. Please try again.");
        });
    }
    cancel() {
        this.$mdDialog.cancel();
    }
}
JobFileUploadController.$inject = [
    "$http",
    "$mdDialog",
    "$window",
    "toastrService",
    "Upload",
    "bytesFilter",
    "jobId"
];
app_1.default.controller("JobFileUploadController", JobFileUploadController);
