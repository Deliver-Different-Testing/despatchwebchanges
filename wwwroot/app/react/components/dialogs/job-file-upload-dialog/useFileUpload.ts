/**
 * useFileUpload - Custom hook for job file upload logic.
 *
 * Encapsulates file listing, upload with per-file progress,
 * download, delete, drag-and-drop state, and validation.
 * The dialog component consumes this hook and focuses purely on rendering.
 */

import React, {useState, useCallback, useRef} from 'react';
import type {ShowToastFn} from '../../../services/toastService';
import type {JobFile, UploadingFile, FileUploadType} from './types';
import {
    getAttachedFiles,
    getJobDeliveryPhotos,
    uploadJobFile,
    uploadJobDeliveryPhotoOrSignature,
    deleteJobFile,
    deleteJobDeliveryPhotoOrSignature,
    downloadFile,
} from '../../../services/jobDetailApi';
import dayjs from 'dayjs';
import {formatDateForApiWithTzs} from '../../../utils/dateUtils';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_MIME_PATTERN = /^image\/|^application\/pdf$/;

interface UseFileUploadOptions {
    jobId: number;
    initialUploadType: FileUploadType;
    showToast: ShowToastFn;
}

export interface UseFileUploadReturn {
    // File lists
    files: JobFile[];
    podFiles: JobFile[];

    // Upload state
    uploadingFiles: UploadingFile[];
    overallProgress: number;
    completedFiles: number;
    totalFiles: number;
    isUploading: boolean;
    currentUploadingFile: UploadingFile | undefined;

    // Drag-and-drop state
    isDragOver: boolean;

    // POD description
    podDescription: string;
    setPodDescription: (value: string) => void;

    // Actions
    loadFiles: () => Promise<void>;
    uploadFiles: (files: File[], isPOD: boolean, podDesc?: string) => Promise<void>;
    downloadFile: (file: JobFile) => Promise<void>;
    deleteFileEntry: (file: JobFile) => Promise<void>;
    reset: () => void;

    // Drag-and-drop handlers
    handleDragOver: (e: React.DragEvent) => void;
    handleDragLeave: () => void;
    handleDrop: (e: React.DragEvent, isPOD: boolean, podDesc?: string) => void;
}

export function useFileUpload({jobId, initialUploadType, showToast}: UseFileUploadOptions): UseFileUploadReturn {
    const showNormalTab = initialUploadType === 'normal' || initialUploadType === 'both';
    const showPodTab = initialUploadType === 'pod' || initialUploadType === 'both';

    const [files, setFiles] = useState<JobFile[]>([]);
    const [podFiles, setPodFiles] = useState<JobFile[]>([]);
    const [podDescription, setPodDescription] = useState('');
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
    const [overallProgress, setOverallProgress] = useState(0);
    const [completedFiles, setCompletedFiles] = useState(0);
    const [totalFiles, setTotalFiles] = useState(0);
    const [isDragOver, setIsDragOver] = useState(false);
    const isUploadingRef = useRef(false);

    const reset = useCallback(() => {
        setFiles([]);
        setPodFiles([]);
        setUploadingFiles([]);
        setPodDescription('');
        setOverallProgress(0);
        setCompletedFiles(0);
        setTotalFiles(0);
        setIsDragOver(false);
        isUploadingRef.current = false;
    }, []);

    const loadFiles = useCallback(async () => {
        try {
            const allFiles = await getAttachedFiles(jobId);
            if (showNormalTab) setFiles(allFiles.filter(f => !f.isPOD));
            if (showPodTab) setPodFiles(allFiles.filter(f => f.isPOD));
        } catch {
            showToast('Failed to load files. Please try again.', 'error');
        }

        if (showPodTab) {
            try {
                const now = dayjs();
                const podPhotos = await getJobDeliveryPhotos(jobId, now.year(), now.month() + 1);
                if (podPhotos?.length) {
                    setPodFiles(prev => {
                        const existingKeys = new Set(prev.map(f => f.s3Key));
                        const newPhotos: JobFile[] = podPhotos
                            .map((photo: any) => {
                                let fileName = photo.fileName;
                                if (!fileName) {
                                    const ext = photo.contentType
                                        ? photo.contentType.split('/')[1] : 'jpg';
                                    fileName = `POD_${Date.now()}.${ext}`;
                                }
                                return {
                                    fileName,
                                    s3Key: photo.s3Key,
                                    contentType: photo.contentType || 'application/octet-stream',
                                    size: photo.size || 0,
                                    uploadDate: photo.uploadDate || formatDateForApiWithTzs(dayjs()),
                                    isPOD: true,
                                    podDescription: photo.podDescription || '',
                                };
                            })
                            .filter(p => !existingKeys.has(p.s3Key));
                        return [...prev, ...newPhotos];
                    });
                }
            } catch {
                showToast('Failed to load POD photos. Please try again.', 'error');
            }
        }
    }, [jobId, showNormalTab, showPodTab, showToast]);

    const uploadFiles = useCallback(async (selectedFiles: File[], isPOD: boolean, podDesc?: string) => {
        if (!selectedFiles.length || isUploadingRef.current) return;

        const invalidType = selectedFiles.filter(f => f.type && !ACCEPTED_MIME_PATTERN.test(f.type));
        if (invalidType.length) {
            showToast(`Invalid file type: ${invalidType.map(f => f.name).join(', ')}. Only images and PDFs are accepted.`, 'error');
            return;
        }

        const oversized = selectedFiles.filter(f => f.size > MAX_FILE_SIZE);
        if (oversized.length) {
            showToast(`Files exceed 10MB limit: ${oversized.map(f => f.name).join(', ')}`, 'error');
            return;
        }

        isUploadingRef.current = true;
        const total = selectedFiles.length;

        setTotalFiles(total);
        setCompletedFiles(0);
        setOverallProgress(0);
        setUploadingFiles(selectedFiles.map(file => ({
            file,
            progress: 0,
            isPOD,
            podDescription: isPOD ? podDesc : undefined,
        })));

        let completed = 0;

        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            try {
                const onProgress = (percent: number) => {
                    setUploadingFiles(prev => {
                        const updated = [...prev];
                        if (updated[i]) updated[i] = {...updated[i], progress: percent};
                        return updated;
                    });
                    setOverallProgress(Math.round(((completed * 100) + percent) / total));
                };

                if (isPOD) {
                    await uploadJobDeliveryPhotoOrSignature(jobId, file, podDesc, onProgress);
                } else {
                    await uploadJobFile(jobId, file, onProgress);
                }

                completed++;
                setCompletedFiles(completed);
                setOverallProgress(Math.round((completed * 100) / total));

                const fileType = isPOD ? 'POD photo' : 'file';
                showToast(`Success ${file.name} uploaded as ${fileType}`, 'success');
            } catch {
                showToast(`Failed to upload ${isPOD ? 'POD photo' : 'file'}: ${file.name}`, 'error');
            }
        }

        setUploadingFiles([]);
        setTotalFiles(0);
        setCompletedFiles(0);
        setOverallProgress(0);
        isUploadingRef.current = false;
        await loadFiles();
    }, [jobId, showToast, loadFiles]);

    const downloadFileEntry = useCallback(async (file: JobFile) => {
        try {
            await downloadFile(file.s3Key, file.fileName);
            showToast('File downloaded successfully', 'success');
        } catch {
            showToast('Failed to download file. Please try again.', 'error');
        }
    }, [showToast]);

    const deleteFileEntry = useCallback(async (file: JobFile) => {
        const isPodFile = file.isPOD ??
            (file.s3Key.includes('/DeliveryPhotos/') || file.s3Key.includes('/DeliverySignatures/'));

        try {
            if (isPodFile) {
                await deleteJobDeliveryPhotoOrSignature(jobId, file.s3Key);
                showToast('POD photo deleted successfully', 'success');
            } else {
                await deleteJobFile(jobId, file.s3Key);
                showToast('File deleted successfully', 'success');
            }
            await loadFiles();
        } catch {
            showToast(`Failed to delete ${isPodFile ? 'POD photo' : 'file'}. Please try again.`, 'error');
        }
    }, [jobId, showToast, loadFiles]);

    // Drag-and-drop handlers
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent, isPOD: boolean, podDesc?: string) => {
        e.preventDefault();
        setIsDragOver(false);
        const droppedFiles = Array.from(e.dataTransfer.files);
        if (droppedFiles.length) await uploadFiles(droppedFiles, isPOD, podDesc);
    }, [uploadFiles]);

    const isUploading = uploadingFiles.length > 0;
    const currentUploadingFile = uploadingFiles.find(f => f.progress > 0 && f.progress < 100) ?? uploadingFiles[0];

    return {
        files,
        podFiles,
        uploadingFiles,
        overallProgress,
        completedFiles,
        totalFiles,
        isUploading,
        currentUploadingFile,
        isDragOver,
        podDescription,
        setPodDescription,
        loadFiles,
        uploadFiles,
        downloadFile: downloadFileEntry,
        deleteFileEntry,
        reset,
        handleDragOver,
        handleDragLeave,
        handleDrop,
    };
}
