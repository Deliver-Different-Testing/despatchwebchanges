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
import {ActionIcon, Box, Button, Group, Progress, Stack, Table, Tabs, Text, TextInput, Tooltip} from '@mantine/core';
import {Camera, ChevronsRight, CloudDownload, CloudUpload, FileUp, Trash2} from 'lucide-react';
import dayjs from 'dayjs';
import type {JobFileUploadDialogProps, JobFile} from './types';
import {useFileUpload} from './useFileUpload';
import {Icon} from '../../common/icon/Icon';
import {
    DialogShell,
    DialogHeader,
    DialogFooter,
    dialogContentBg,
    dialogSize,
} from '../shared/mantine';

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

/** The dashed drop target. `dragOver` and `pod` only change its tint. */
function dropBoxStyle(isPodMode: boolean, isDragOver: boolean): React.CSSProperties {
    const borderColor = isDragOver
        ? 'var(--mantine-color-green-6)'
        : isPodMode
            ? 'var(--mantine-color-brand-6)'
            : 'var(--mantine-color-gray-4)';
    const background = isDragOver
        ? 'var(--mantine-color-green-0)'
        : isPodMode
            ? 'var(--mantine-color-brand-0)'
            : 'var(--mantine-color-gray-0)';
    return {
        padding: 'var(--mantine-spacing-lg)',
        border: `2px dashed ${borderColor}`,
        borderRadius: 'var(--mantine-radius-sm)',
        textAlign: 'center',
        backgroundColor: background,
        cursor: 'pointer',
        transition: 'border-color 0.2s, background-color 0.2s',
    };
}

export const JobFileUploadDialog: React.FC<JobFileUploadDialogProps> = ({
    open,
    jobId,
    initialUploadType,
    onClose,
    showToast,
}) => {
    const isBothMode = initialUploadType === 'both';
    const isPODOnly = initialUploadType === 'pod';

    const [activeTab, setActiveTab] = useState<string>('normal');

    const upload = useFileUpload({jobId, initialUploadType, showToast});
    const fileInputRef = useRef<HTMLInputElement>(null);

    // In multi-tab mode, the active tab determines whether the current upload is POD
    const currentIsPOD = isBothMode ? activeTab === 'pod' : isPODOnly;

    // Reset and load when dialog opens
    useEffect(() => {
        if (open) {
            upload.reset();
            void upload.loadFiles();
            setActiveTab('normal');
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
            style={dropBoxStyle(isPodMode, upload.isDragOver)}
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
            <Box mb="xs" c={isPodMode ? 'brand.6' : 'gray.6'} style={{display: 'flex', justifyContent: 'center'}}>
                <Icon lucide={isPodMode ? Camera : CloudUpload} size={48}/>
            </Box>
            <Text>
                {isPodMode ? 'Drag and drop POD photo here or click to upload' : 'Drag and drop files here or click to upload'}
            </Text>
            <Text size="xs" c="dimmed">
                Accepted file types: Images, PDF. Max size: 10MB
            </Text>
        </Box>
    );

    const renderFileTable = (fileList: JobFile[], isPodMode: boolean) => (
        <Table mt="md" verticalSpacing="xs" horizontalSpacing="xs">
            <Table.Thead>
                <Table.Tr>
                    <Table.Th>{isPodMode ? 'Photo Name' : 'File Name'}</Table.Th>
                    {isPodMode && <Table.Th>Description</Table.Th>}
                    <Table.Th>Size</Table.Th>
                    <Table.Th>{isPodMode ? 'Upload Date' : 'Last Modified'}</Table.Th>
                    <Table.Th>Actions</Table.Th>
                </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
                {fileList.length === 0 && (
                    <Table.Tr>
                        <Table.Td colSpan={isPodMode ? 5 : 4} ta="center">
                            <Text size="sm" c="dimmed" py="md">No files uploaded yet</Text>
                        </Table.Td>
                    </Table.Tr>
                )}
                {fileList.map((file, idx) => (
                    <Table.Tr key={file.s3Key || idx}>
                        <Table.Td>{file.fileName}</Table.Td>
                        {isPodMode && <Table.Td>{file.podDescription || 'No description'}</Table.Td>}
                        <Table.Td>{formatBytes(file.size)}</Table.Td>
                        <Table.Td>{formatDate(isPodMode ? file.uploadDate : file.lastModified)}</Table.Td>
                        <Table.Td>
                            <Group gap={4} wrap="nowrap">
                                <Tooltip label="Download">
                                    <ActionIcon variant="subtle" color="gray" aria-label="Download" onClick={() => upload.downloadFile(file)}>
                                        <Icon lucide={CloudDownload} size={18}/>
                                    </ActionIcon>
                                </Tooltip>
                                <Tooltip label="Delete">
                                    <ActionIcon variant="subtle" color="gray" aria-label="Delete" onClick={() => upload.deleteFileEntry(file)}>
                                        <Icon lucide={Trash2} size={18}/>
                                    </ActionIcon>
                                </Tooltip>
                            </Group>
                        </Table.Td>
                    </Table.Tr>
                ))}
            </Table.Tbody>
        </Table>
    );

    const renderUploadProgress = () => {
        if (!upload.isUploading) return null;
        return (
            <Box
                mt="md"
                p="md"
                style={{
                    backgroundColor: 'var(--mantine-color-gray-0)',
                    borderRadius: 'var(--mantine-radius-sm)',
                }}
            >
                <Text size="sm" fw={500} mb="xs">
                    Uploading Files ({upload.completedFiles}/{upload.totalFiles})
                </Text>
                {/* Overall progress */}
                <Group justify="space-between" mb={4}>
                    <Text size="sm">Overall Progress</Text>
                    <Text size="sm">{upload.overallProgress}%</Text>
                </Group>
                <Progress value={upload.overallProgress} mb="xs"/>
                {/* Per-file progress */}
                {upload.uploadingFiles.map((uf, i) => (
                    <Box key={i} mt="xs">
                        <Group justify="space-between" mb={2} wrap="nowrap">
                            <Text size="xs" c="dimmed" truncate style={{maxWidth: '70%'}}>
                                {uf.file.name}
                                {uf.isPOD && uf.podDescription ? ` - ${uf.podDescription}` : ''}
                            </Text>
                            <Text size="xs" c="dimmed">{uf.progress}%</Text>
                        </Group>
                        <Progress value={uf.progress} size="xs" radius="xl"/>
                    </Box>
                ))}
                {upload.uploadingFiles.length > 1 && (
                    <Text size="xs" c="dimmed" mt="xs" display="block">
                        Files in queue: {upload.uploadingFiles.filter(f => f.progress === 0).length}
                    </Text>
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
            <TextInput
                label="POD Photo Description"
                placeholder="Enter description for POD photo"
                value={upload.podDescription}
                onChange={e => upload.setPodDescription(e.currentTarget.value)}
                mb="md"
            />
            {renderDropBox(true)}
            {renderFileTable(upload.podFiles, true)}
        </>
    );

    const handleDialogClose = useCallback(() => {
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
        <DialogShell
            opened={open}
            /* Blocks backdrop and escape closes — matches AngularJS clickOutsideToClose: false */
            onClose={handleDialogClose}
            closeOnClickOutside={false}
            closeOnEscape={false}
            size={dialogSize.md}
            label={headerTitle}
        >
            <DialogHeader
                icon={<Icon lucide={isPODOnly ? Camera : FileUp}/>}
                title={headerTitle}
                subtitle={headerSubtitle}
                onClose={onClose}
                closeDisabled={upload.isUploading}
            />
            {/* Content */}
            <Box p="lg" style={{backgroundColor: dialogContentBg}}>
                <Stack gap={0}>
                    {isBothMode ? (
                        // `keepMounted={false}` is load-bearing: both panels render a
                        // drop box sharing one `fileInputRef`, so leaving the inactive
                        // panel mounted would leave the ref pointing at the hidden
                        // tab's input.
                        <Tabs
                            value={activeTab}
                            onChange={(value) => setActiveTab(value ?? 'normal')}
                            keepMounted={false}
                            mb="md"
                        >
                            <Tabs.List mb="md">
                                <Tabs.Tab value="normal">Regular Files</Tabs.Tab>
                                <Tabs.Tab value="pod">POD Photos</Tabs.Tab>
                            </Tabs.List>
                            <Tabs.Panel value="normal">{renderNormalContent()}</Tabs.Panel>
                            <Tabs.Panel value="pod">{renderPodContent()}</Tabs.Panel>
                        </Tabs>
                    ) : isPODOnly ? (
                        renderPodContent()
                    ) : (
                        renderNormalContent()
                    )}

                    {renderUploadProgress()}
                </Stack>
            </Box>
            {/*
              * Actions. The MUI original put a "Skip File Upload" button in the
              * header in place of the close icon; under the shared header that
              * slot is always the close button, so Skip moves to the footer.
              */}
            <DialogFooter
                hideCancel
                onConfirm={onClose}
                confirmLabel="Complete"
                confirmDisabled={upload.isUploading}
                secondaryAction={isPODOnly ? (
                    <Button
                        variant="default"
                        onClick={onClose}
                        disabled={upload.isUploading}
                        leftSection={<Icon lucide={ChevronsRight}/>}
                        miw={100}
                    >
                        Skip
                    </Button>
                ) : undefined}
            />
        </DialogShell>
    );
};

export default JobFileUploadDialog;
