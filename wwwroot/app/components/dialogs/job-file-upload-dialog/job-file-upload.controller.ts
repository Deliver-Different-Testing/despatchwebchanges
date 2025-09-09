import {FileUploadType} from "../../../enums/file-upload-type.enum";
import ToastrService from "../../../services/toastr.service";
import BaseController from "../../base-controller";
import {IJobFile, IUploadProgressFile} from "./job-file-upload-dialog.interfaces";

class JobFileUploadController extends BaseController {
    static $inject = [
        "$http",
        "$log",
        "$mdDialog",
        "$window",
        "toastrService",
        "Upload",
        "bytesFilter",
        "jobId",
        "initialUploadType"
    ];

    files: IJobFile[] = [];
    podFiles: IJobFile[] = [];
    uploadingFiles: IUploadProgressFile[] = [];
    currentUploadType: FileUploadType;
    podDescription: string = '';
    selectedTabIndex: number = 0;
    showNormalTab: boolean = true;
    showPodTab: boolean = true;

    constructor(
        private $http: angular.IHttpService,
        private $log: angular.ILogService,
        private $mdDialog: angular.material.IDialogService,
        private $window: angular.IWindowService,
        private toastrService: ToastrService,
        public Upload: angular.angularFileUpload.IUploadService,
        public bytesFilter: (bytes: number) => string,
        public jobId: number,
        public initialUploadType: FileUploadType = FileUploadType.NORMAL
    ) {
        super();
        this.currentUploadType = initialUploadType;

        // Determine which tabs to show based on the initialUploadType
        if (initialUploadType === FileUploadType.NORMAL) {
            this.showPodTab = false;
            this.selectedTabIndex = 0;
        } else if (initialUploadType === FileUploadType.POD) {
            this.showNormalTab = false;
            this.selectedTabIndex = 0; // Will be the first tab since the normal tab is hidden
        }
    }

    $onInit() {
        this.loadFiles();
    }

    loadFiles(): void {
        // Load all files (both regular and POD)
        this.$http.get("/job/getAttachedFiles", {
            params: {
                jobId: this.jobId
            }
        }).then((response: angular.IHttpResponse<any>) => {
            const allFiles = response.data || [];

            if (this.showNormalTab) {
                this.files = allFiles.filter((file: IJobFile) => !file.isPOD);
                this.$log.debug("Regular Files:", this.files);
            }

            if (this.showPodTab) {
                this.podFiles = allFiles.filter((file: IJobFile) => file.isPOD);
                this.$log.debug("POD Files:", this.podFiles);
            }
        }).catch((error: any) => {
            this.$log.error("Error loading files:", error);
            this.toastrService.showErrorToast("Failed to load files. Please try again.");
        });

        // If the POD tab is visible, also load additional POD photos from the specialized endpoint
        if (this.showPodTab) {
            // Get the current month and year for the POD photo search
            const now = new Date();
            const month = now.getMonth() + 1;
            const year = now.getFullYear();

            this.$http.get("/job/GetJobDeliveryPhotosAndSignature", {
                params: {
                    jobId: this.jobId,
                    year: year,
                    month: month
                }
            }).then((response: angular.IHttpResponse<any>) => {
                if (response.data && response.data.length) {
                    // Transform the POD photos to match the IJobFile interface
                    const podPhotos = response.data.map((photo: any) => {
                        return {
                            fileName: photo.fileName || `POD_${new Date().getTime()}.jpg`,
                            s3Key: photo.s3Key,
                            contentType: photo.contentType || 'image/jpeg',
                            size: photo.size || 0,
                            uploadDate: photo.uploadDate || new Date().toISOString(),
                            isPOD: true,
                            podDescription: photo.podDescription || ''
                        };
                    });

                    // Merge with existing POD files, avoiding duplicates by s3Key
                    const existingKeys = this.podFiles.map(f => f.s3Key);
                    const newPodFiles = podPhotos.filter((p: { s3Key: string; }) => !existingKeys.includes(p.s3Key));

                    this.podFiles = [...this.podFiles, ...newPodFiles];
                    this.$log.debug("All POD Files:", this.podFiles);
                }
            }).catch((error: any) => {
                this.$log.error("Error loading POD files:", error);
                this.toastrService.showErrorToast("Failed to load POD photos. Please try again.");
            });
        }
    }

    setUploadType(type: FileUploadType): void {
        this.currentUploadType = type;
    }

    isPODUpload(): boolean {
        return this.currentUploadType === FileUploadType.POD;
    }

    async uploadFiles(files: File[]): Promise<void> {
        if (files && files.length) {
            for (let i = 0; i < files.length; i++) {
                await this.upload(files[i]);
            }
        }
    }

    async upload(file: File): Promise<void> {
        try {
            const formData: any = {
                jobId: this.jobId.toString(),
                file: file,
                isPOD: this.isPODUpload()
            };

            // Add POD description if this is a POD upload
            if (this.isPODUpload() && this.podDescription) {
                formData.podDescription = this.podDescription;
            }

            const endpoint = this.isPODUpload()
                ? "/job/uploadJobDeliveryPhotoOrSignature"
                : "/job/uploadFile";

            const response = await this.Upload.upload({
                url: endpoint,
                method: 'POST',
                data: formData,
                headers: {'Content-Type': undefined},
                uploadEventHandlers: {
                    progress: (event: Event) => {
                        const progressEvent = event as ProgressEvent;
                        const progressPercentage = Math.round((100 * progressEvent.loaded) / progressEvent.total);
                        this.$log.debug(`progress: ${progressPercentage}% ${file.name}`);
                        this.updateFileProgress(file, progressPercentage);
                    }
                }
            });

            const fileType = this.isPODUpload() ? 'POD photo' : 'file';
            const message = `Success ${file.name} uploaded as ${fileType}`;
            this.toastrService.showSuccessToast(message);
            this.$log.debug(message + ". Response: " + JSON.stringify(response.data));
            this.loadFiles();
        } catch (error: any) {
            this.$log.error(`Error status: ${error.status}`);
            this.$log.error(`Error data: ${JSON.stringify(error.data)}`);
            this.toastrService.showErrorToast(`Failed to upload ${this.isPODUpload() ? 'POD photo' : 'file'}: ${file.name}. Please try again.`);
        }
    }

    updateFileProgress(file: File, progress: number): void {
        let index: number = this.uploadingFiles.findIndex((f: any) => f.name === file.name && f.size === file.size);
        if (index === -1) {
            this.uploadingFiles.push({
                ...file,
                progress: progress,
                isPOD: this.isPODUpload(),
                podDescription: this.isPODUpload() ? this.podDescription : undefined
            });
        } else {
            this.uploadingFiles[index].progress = progress;
        }
    }

    async downloadFile(file: { fileName: string; s3Key: string; isPOD?: boolean }): Promise<void> {
        try {
            // Determine the endpoint based on whether this is a POD file
            const isPodFile = file.isPOD !== undefined
                ? file.isPOD
                : (file.s3Key.includes('/DeliveryPhotos/') || file.s3Key.includes('/DeliverySignatures/'));

            const endpoint = isPodFile ? "/job/DownloadDeliveryFile" : "/job/DownloadFile";

            const response: angular.IHttpResponse<Blob> = await this.$http.get<Blob>(endpoint, {
                params: {
                    jobId: this.jobId,
                    key: file.s3Key
                },
                responseType: "blob",
                headers: {
                    'Accept': "application/octet-stream"
                }
            });

            // Log response for debugging
            this.$log.debug("Response received:", response);
            this.$log.debug("All headers:", response.headers());

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
        } catch (error) {
            this.$log.error("Download failed:", error);
            this.toastrService.showErrorToast("Failed to download file. Please try again.");
        }
    }

    deleteFile(file: { s3Key: string; isPOD?: boolean }): void {
        // If isPOD isn't explicitly set, determine it from the file path
        const isPodFile = file.isPOD !== undefined
            ? file.isPOD
            : (file.s3Key.includes('/DeliveryPhotos/') || file.s3Key.includes('/DeliverySignatures/'));

        if (isPodFile) {
            // Use the POD photo delete function
            this.$http.delete("/job/DeleteJobDeliveryPhotoOrSignature", {
                params: {
                    jobId: this.jobId,
                    key: file.s3Key
                }
            }).then(
                (response: angular.IHttpResponse<any>) => {
                    this.$log.debug("Delete Success:", response.data);
                    this.loadFiles();
                    this.toastrService.showSuccessToast("POD photo deleted successfully");
                },
                (error: any) => {
                    this.$log.error("Delete Error:", error);
                    this.toastrService.showErrorToast("Failed to delete POD photo. Please try again.");
                }
            );
        } else {
            // Use the regular file delete for non-POD files
            this.$http.delete("/job/DeleteFile", {
                params: {
                    jobId: this.jobId,
                    key: file.s3Key
                }
            }).then(
                (response: angular.IHttpResponse<any>) => {
                    this.$log.debug("Delete Success:", response.data);
                    this.loadFiles();
                    this.toastrService.showSuccessToast("File deleted successfully");
                },
                (error: any) => {
                    this.$log.error("Delete Error:", error);
                    this.toastrService.showErrorToast("Failed to delete file. Please try again.");
                }
            );
        }
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}

export default JobFileUploadController;
