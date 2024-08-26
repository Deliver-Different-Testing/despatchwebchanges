class JobFileUploadController {
    /**
     * @param $http
     * @param $mdDialog
     * @param $document
     * @param $window
     * @param {number} jobId
     */
    constructor($http, $mdDialog, $document, $window, jobId) {
        this._$http = $http;
        this._$mdDialog = $mdDialog;
        this._$document = $document;
        this._$window = $window;
        this._jobId = jobId;

        this.files = [];
        this.filesToUpload = [];

        this.loadFiles().then(() => console.log("Files attached to Job loaded!"));
    }

    async loadFiles() {
        try {
            let response = await this._$http.get('/job/getAttachedFiles/' + this._jobId);
            this.files = response.data;
        } catch (error) {
            console.error('Error loading files:', error);
            this.showErrorDialog('Failed to load files. Please try again.');
        }
    }

    async uploadFiles() {
        if (this.filesToUpload && this.filesToUpload.length) {
            let formData = new FormData();
            formData.append("file", this.filesToUpload[0]);

            try {
                let response = await this._$http.post('/job/uploadFile/' + this._jobId, formData, {
                    transformRequest: angular.identity,
                    headers: {'Content-Type': undefined}
                });

                console.log('Upload Success:', response.data);

                await this.loadFiles();
                this.filesToUpload = null;
            } catch (error) {
                console.error('Upload Error:', error);
                this.showErrorDialog('Failed to upload file. Please try again.');
            }
        }
    }

    async downloadFile(file) {
        try {
            let response = await this._$http.get('/job/downloadFile/' + this._jobId + '/' + file.Name, {responseType: 'blob'});
            const blob = new Blob([response.data], {type: response.headers('Content-Type')});
            let link = this._$document.createElement('a');
            link.href = this._$window.URL.createObjectURL(blob);
            link.download = file.Name;
            link.click();
        } catch (error) {
            console.error('Download Error:', error);
            this.showErrorDialog('Failed to download file. Please try again.');
        }
    }

    async deleteFile(file) {
        try {
            let response = await this._$http.delete('/job/deleteFile/' + this._jobId + '/' + file.Name);
            console.log('Delete Success:', response.data);
            await this.loadFiles();
        } catch (error) {
            console.error('Delete Error:', error);
            this.showErrorDialog('Failed to delete file. Please try again.');
        }
    }

    cancel() {
        this._$mdDialog.cancel();
    };


    /**
     * Display an error dialog with a provided message.
     * @param {string} message
     */
    showErrorDialog(message) {
        this._$mdDialog.show(
            this._$mdDialog.alert()
                .title('Error')
                .textContent(message)
                .ok('OK')
        );
    }
}
