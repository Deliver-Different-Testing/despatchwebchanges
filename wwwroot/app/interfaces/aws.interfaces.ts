export interface Is3PhotoInfo {
    s3Key: string;
    fileName: string;
    contentType: string;
    data?: string
    lastModified?: Date;
    size?: number;
    isImage?: boolean;
}