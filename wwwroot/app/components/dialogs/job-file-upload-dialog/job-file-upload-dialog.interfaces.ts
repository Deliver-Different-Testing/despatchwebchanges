export interface IJobFile {
    fileName: string;
    s3Key: string;
    contentType: string;
    size: number;
    uploadDate: string;
    lastModified?: string;
    isPOD?: boolean;
    podDescription?: string;
}

export interface IUploadProgressFile extends File {
    progress: number;
    isPOD?: boolean;
    podDescription?: string;
}
