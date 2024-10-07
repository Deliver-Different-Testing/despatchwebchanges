/**
 * @class JobFileUploadController
 * @description Controller for handling file uploads related to a specific job.
 */
class JobFileUploadController {
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
        this._$mdDialog = $mdDialog;
        this._$document = $document;
        this._$window = $window;
        this._toastrService = toastrService;
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
        this._$http.get('/job/getAttachedFiles/' + this._jobId)
            .then(
                (response) => {
                    this.files = response.data;
                },
                (error) => {
                    console.error('Error loading files:', error);
                    this._toastrService.showErrorToast('Failed to load files. Please try again.');
                }
            );
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
        formData.append('jobId', this._jobId.toString());
        formData.append('file', file);

        this._$http.post('/job/uploadFile', formData, {
            transformRequest: angular.identity,
            headers: {'Content-Type': undefined, 'enctype': 'multipart/form-data'},
            uploadEventHandlers: {
                progress: (event) => {
                    const progressPercentage = Math.round((100 * event.loaded) / event.total);
                    console.log('progress: ' + progressPercentage + '% ' + file.name);
                    this.updateFileProgress(file, progressPercentage);
                }
            }
        }).then(
            (response) => {
                const message = 'Success ' + file.name + ' uploaded';
                this._toastrService.showSuccessToast()
                console.log(message + '. Response: ' + JSON.stringify(response.data));
                this.loadFiles();
            },
            (error) => {
                console.error('Error status: ' + error.status);
                console.error('Error data: ' + JSON.stringify(error.data));
                this._toastrService.showErrorToast('Failed to upload file: ' + file.name + '. Please try again.');
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
            this.uploadingFiles.push({...file, progress: progress});
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
        this._$http.get('/job/downloadFile/' + this._jobId + '/' + file.Name, {responseType: 'blob'})
            .then(
                (response) => {
                    const blob = new Blob([response.data], {type: response.headers('Content-Type')});
                    let link = this._$document[0].createElement('a');
                    link.href = this._$window.URL.createObjectURL(blob);
                    link.download = file.Name;
                    link.click();
                },
                (error) => {
                    console.error('Download Error:', error);
                    this._toastrService.showErrorToast('Failed to download file. Please try again.');
                }
            );
    }

    /**
     * @method deleteFile
     * @description Deletes a file from the server.
     * @param {object} file - The file object to be deleted.
     */
    deleteFile(file) {
        this._$http.delete('/job/deleteFile/' + this._jobId + '/' + file.Name)
            .then(
                (response) => {
                    console.log('Delete Success:', response.data);
                    this.loadFiles();
                },
                (error) => {
                    console.error('Delete Error:', error);
                    this._toastrService.showErrorToast('Failed to delete file. Please try again.');
                }
            );
    }

    /**
     * @method cancel
     * @description Cancels the current dialog operation.
     */
    cancel() {
        this._$mdDialog.cancel();
    }
}
