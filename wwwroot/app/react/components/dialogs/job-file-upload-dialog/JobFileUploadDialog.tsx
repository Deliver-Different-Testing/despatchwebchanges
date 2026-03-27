/**
 * JobFileUploadDialog Component
 *
 * React replacement for the AngularJS job-file-upload-dialog.
 * Supports regular file uploads and POD (Proof of Delivery) photo uploads
 * with drag-and-drop, progress tracking, and file management.
 *
 * All upload/download/delete logic lives in the useFileUpload hook;
 * this component is purely presentational.
 */

import React, {useEffect, useCallback, useRef, useState} from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import LinearProgress from '@mui/material/LinearProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import DoubleArrowIcon from '@mui/icons-material/DoubleArrow';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import type {SxProps, Theme} from '@mui/material';
import dayjs from 'dayjs';

import type {JobFileUploadDialogProps, JobFile} from './types';
import {useFileUpload} from './useFileUpload';

const ACCEPTED_TYPES = 'image/*,application/pdf';

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    const d = dayjs(dateStr);
    return d.isValid() ? d.format('MMM D, YYYY HH:mm:ss') : '';
}

const styles: Record<string, SxProps<Theme>> = {
    dropBox: {
        p: 3,
        border: '2px dashed',
        borderColor: 'grey.400',
        borderRadius: 1,
        textAlign: 'center',
        bgcolor: 'grey.50',
        cursor: 'pointer',
        transition: 'border-color 0.2s, background-color 0.2s',
        '&:hover': {
            borderColor: 'primary.main',
            bgcolor: 'grey.100',
        },
    },
    dropBoxDragover: {
        borderColor: 'success.main',
        bgcolor: 'success.50',
    },
    podDropBox: {
        bgcolor: '#f0f7ff',
        borderColor: 'primary.main',
        '&:hover': {
            borderColor: 'primary.dark',
            bgcolor: '#e3f0ff',
        },
    },
};

export const JobFileUploadDialog: React.FC<JobFileUploadDialogProps> = ({
    open,
    jobId,
    initialUploadType,
    onClose,
    showToast,
}) => {
    const isBothMode = initialUploadType === 'both';
    const isPODOnly = initialUploadType === 'pod';

    const [activeTab, setActiveTab] = useState(0);

    const upload = useFileUpload({jobId, initialUploadType, showToast});
    const fileInputRef = useRef<HTMLInputElement>(null);

    // In multi-tab mode, the active tab determines whether the current upload is POD
    const currentIsPOD = isBothMode ? activeTab === 1 : isPODOnly;

    // Reset and load when dialog opens
    useEffect(() => {
        if (open) {
            upload.reset();
            void upload.loadFiles();
            setActiveTab(0);
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files ? Array.from(e.target.files) : [];
        if (selected.length) await upload.uploadFiles(selected, currentIsPOD, upload.podDescription);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, [upload, currentIsPOD]);

    const handleDropBoxClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const onDrop = useCallback((e: React.DragEvent) => {
        upload.handleDrop(e, currentIsPOD, upload.podDescription);
    }, [upload, currentIsPOD]);

    // ── Render helpers ──────────────────────────────────────────────

    const renderDropBox = (isPodMode: boolean) => (
        <Box
            sx={[
                styles.dropBox as any,
                isPodMode && (styles.podDropBox as any),
                upload.isDragOver && (styles.dropBoxDragover as any),
            ]}
            onDrop={onDrop}
            onDragOver={upload.handleDragOver}
            onDragLeave={upload.handleDragLeave}
            onClick={handleDropBoxClick}
        >
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPTED_TYPES}
                onChange={handleFileInputChange}
                style={{display: 'none'}}
            />
            {isPodMode
                ? <CameraAltIcon sx={{fontSize: 48, color: 'primary.main', mb: 1}} />
                : <CloudUploadIcon sx={{fontSize: 48, color: 'grey.500', mb: 1}} />
            }
            <Typography>
                {isPodMode ? 'Drag and drop POD photo here or click to upload' : 'Drag and drop files here or click to upload'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
                Accepted file types: Images, PDF. Max size: 10MB
            </Typography>
        </Box>
    );

    const renderFileTable = (fileList: JobFile[], isPodMode: boolean) => (
        <TableContainer sx={{mt: 2}}>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>{isPodMode ? 'Photo Name' : 'File Name'}</TableCell>
                        {isPodMode && <TableCell>Description</TableCell>}
                        <TableCell>Size</TableCell>
                        <TableCell>{isPodMode ? 'Upload Date' : 'Last Modified'}</TableCell>
                        <TableCell>Actions</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {fileList.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={isPodMode ? 5 : 4} align="center">
                                <Typography variant="body2" color="text.secondary" sx={{py: 2}}>
                                    No files uploaded yet
                                </Typography>
                            </TableCell>
                        </TableRow>
                    )}
                    {fileList.map((file, idx) => (
                        <TableRow key={file.s3Key || idx}>
                            <TableCell>{file.fileName}</TableCell>
                            {isPodMode && <TableCell>{file.podDescription || 'No description'}</TableCell>}
                            <TableCell>{formatBytes(file.size)}</TableCell>
                            <TableCell>{formatDate(isPodMode ? file.uploadDate : file.lastModified)}</TableCell>
                            <TableCell>
                                <Tooltip title="Download">
                                    <IconButton size="small" onClick={() => upload.downloadFile(file)}>
                                        <CloudDownloadIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete">
                                    <IconButton size="small" onClick={() => upload.deleteFileEntry(file)}>
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );

    const renderUploadProgress = () => {
        if (!upload.isUploading) return null;
        return (
            <Box sx={{mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1}}>
                <Typography variant="subtitle2" gutterBottom>
                    Uploading Files ({upload.completedFiles}/{upload.totalFiles})
                </Typography>

                {/* Overall progress */}
                <Box sx={{display: 'flex', justifyContent: 'space-between', mb: 0.5}}>
                    <Typography variant="body2">Overall Progress</Typography>
                    <Typography variant="body2">{upload.overallProgress}%</Typography>
                </Box>
                <LinearProgress variant="determinate" value={upload.overallProgress} sx={{mb: 1}} />

                {/* Per-file progress */}
                {upload.uploadingFiles.map((uf, i) => (
                    <Box key={i} sx={{mt: 1}}>
                        <Box sx={{display: 'flex', justifyContent: 'space-between', mb: 0.25}}>
                            <Typography variant="caption" color="text.secondary" noWrap sx={{maxWidth: '70%'}}>
                                {uf.file.name}
                                {uf.isPOD && uf.podDescription ? ` - ${uf.podDescription}` : ''}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {uf.progress}%
                            </Typography>
                        </Box>
                        <LinearProgress
                            variant="determinate"
                            value={uf.progress}
                            sx={{height: 4, borderRadius: 2}}
                        />
                    </Box>
                ))}

                {upload.uploadingFiles.length > 1 && (
                    <Typography variant="caption" display="block" color="text.secondary" sx={{mt: 1}}>
                        Files in queue: {upload.uploadingFiles.filter(f => f.progress === 0).length}
                    </Typography>
                )}
            </Box>
        );
    };

    const renderNormalContent = () => (
        <>
            {renderDropBox(false)}
            {renderFileTable(upload.files, false)}
        </>
    );

    const renderPodContent = () => (
        <>
            <TextField
                label="POD Photo Description"
                placeholder="Enter description for POD photo"
                value={upload.podDescription}
                onChange={e => upload.setPodDescription(e.target.value)}
                fullWidth
                size="small"
                sx={{mb: 2, bgcolor: 'white'}}
            />
            {renderDropBox(true)}
            {renderFileTable(upload.podFiles, true)}
        </>
    );

    const handleDialogClose = useCallback((_event: unknown, reason: string) => {
        // Block backdrop clicks and escape key — matches AngularJS clickOutsideToClose: false
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
        if (!upload.isUploading) onClose();
    }, [upload.isUploading, onClose]);

    // Determine header icon and title
    const headerTitle = isPODOnly ? 'POD Photos' : isBothMode ? 'File Upload' : 'Attached Files';
    const headerSubtitle = isPODOnly
        ? 'Upload proof of delivery photos'
        : isBothMode
            ? 'Manage regular files and POD photos for this job'
            : 'Manage attached files for this job';

    return (
        <Dialog
            open={open}
            onClose={handleDialogClose}
            maxWidth="md"
            fullWidth
            disableEscapeKeyDown
            disableEnforceFocus
            slotProps={{
                paper: {
                    elevation: 24,
                    sx: {borderRadius: 2, overflow: 'hidden'},
                },
            }}
        >
            {/* Header */}
            <Box
                sx={(theme) => ({
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                    color: 'white',
                    px: 3,
                    py: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                })}
            >
                <Box
                    sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 1.5,
                        bgcolor: 'rgba(255,255,255,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    {isPODOnly ? <CameraAltIcon sx={{fontSize: 24}} /> : <UploadFileIcon sx={{fontSize: 24}} />}
                </Box>
                <Box sx={{flex: 1}}>
                    <Typography variant="h6" fontWeight={600}>
                        {headerTitle}
                    </Typography>
                    <Typography variant="body2" sx={{opacity: 0.85, mt: 0.25}}>
                        {headerSubtitle}
                    </Typography>
                </Box>
                {isPODOnly ? (
                    <Tooltip title="Skip File Upload">
                        <Button
                            onClick={onClose}
                            disabled={upload.isUploading}
                            startIcon={<DoubleArrowIcon />}
                            sx={{color: 'white', '&:hover': {bgcolor: 'rgba(255,255,255,0.1)'}}}
                        >
                            Skip
                        </Button>
                    </Tooltip>
                ) : (
                    <Tooltip title="Close">
                        <IconButton
                            onClick={onClose}
                            disabled={upload.isUploading}
                            sx={{color: 'white', '&:hover': {bgcolor: 'rgba(255,255,255,0.1)'}}}
                        >
                            <CloseIcon />
                        </IconButton>
                    </Tooltip>
                )}
            </Box>

            {/* Content */}
            <DialogContent sx={{p: 0, bgcolor: 'background.default'}}>
                <Box sx={{p: 3, display: 'flex', flexDirection: 'column'}}>
                    {isBothMode ? (
                        <>
                            <Tabs
                                value={activeTab}
                                onChange={(_, newValue) => setActiveTab(newValue)}
                                sx={{mb: 2, borderBottom: 1, borderColor: 'divider'}}
                            >
                                <Tab label="Regular Files" />
                                <Tab label="POD Photos" />
                            </Tabs>
                            {activeTab === 0 && renderNormalContent()}
                            {activeTab === 1 && renderPodContent()}
                        </>
                    ) : isPODOnly ? (
                        renderPodContent()
                    ) : (
                        renderNormalContent()
                    )}

                    {renderUploadProgress()}
                </Box>
            </DialogContent>

            {/* Actions */}
            <DialogActions
                sx={(theme) => ({
                    px: 3,
                    py: 2,
                    bgcolor: 'white',
                    borderTop: `1px solid ${theme.palette.divider}`,
                })}
            >
                <Button
                    onClick={onClose}
                    variant="contained"
                    color="primary"
                    disabled={upload.isUploading}
                    sx={{minWidth: 100}}
                >
                    Complete
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default JobFileUploadDialog;
