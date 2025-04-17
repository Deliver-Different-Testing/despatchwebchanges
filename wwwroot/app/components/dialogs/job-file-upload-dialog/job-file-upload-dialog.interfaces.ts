export interface IJobFile {
    fileName: string;
    s3Key: string;
    contentType: string;
    size: number;
    uploadDate: string;
    lastModified?: string;
}

export interface IUploadProgressFile extends File {
    progress: number;
}
