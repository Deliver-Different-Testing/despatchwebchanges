/**
 * Job File Upload Dialog Types
 */

import type {ShowToastFn} from '../../../services/toastService';

export type FileUploadType = 'normal' | 'pod' | 'both';

export interface JobFile {
    fileName: string;
    s3Key: string;
    contentType: string;
    size: number;
    uploadDate?: string;
    lastModified?: string;
    isPOD?: boolean;
    podDescription?: string;
}

export interface UploadingFile {
    file: File;
    progress: number;
    isPOD: boolean;
    podDescription?: string;
}

export interface JobFileUploadDialogProps {
    open: boolean;
    jobId: number;
    initialUploadType: FileUploadType;
    onClose: () => void;
    showToast: ShowToastFn;
}
