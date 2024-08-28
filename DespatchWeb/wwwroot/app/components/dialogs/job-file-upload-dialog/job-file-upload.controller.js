/**
 * @class
 */
class JobFileUploadController {
    /**
     * @param $http
     * @param $mdDialog
     * @param $document
     * @param $window
     * @param toastrService
     * @param Upload
     * @param bytesFilter
     * @param {number} jobId
     */
    constructor($http, $mdDialog, $document, $window, toastrService, Upload, bytesFilter, jobId) {
        this._$http = $http;
        this._$mdDialog = $mdDialog;
        this._$document = $document;
        this._$window = $window;
        this._toastrService = toastrService;
        this._jobId = jobId;

        this.files = [];
        this.uploadingFiles = [];

        this.loadFiles();
    }

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

    uploadFiles(files) {
        if (files && files.length) {
            for (let i = 0; i < files.length; i++) {
                this.upload(files[i]);
            }
        }
    }

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

    updateFileProgress(file, progress) {
        let index = this.uploadingFiles.findIndex((f) => f.name === file.name && f.size === file.size);
        if (index === -1) {
            this.uploadingFiles.push({...file, progress: progress});
        } else {
            this.uploadingFiles[index].progress = progress;
        }
    }

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

    cancel() {
        this._$mdDialog.cancel();
    }
}
