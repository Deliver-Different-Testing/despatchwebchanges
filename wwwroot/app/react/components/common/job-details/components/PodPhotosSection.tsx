/**
 * PodPhotosSection - Photo grid, viewer, upload for delivery and pickup photos
 */

import React, {useState, useCallback, useEffect} from 'react';
import {ActionIcon, Box, Group, Paper, Skeleton, Text, Tooltip} from '@mantine/core';
import {
    Camera, ChevronLeft, ChevronRight, File, FileText, Images, Send, Trash2, Upload,
} from 'lucide-react';
import {Icon} from '../../icon/Icon';
import {isImageFile, isPdfFile} from '../JobDetails.types';
import type {PodPhoto} from '../JobDetails.types';
import {downloadFile, deleteJobDeliveryPhotoOrSignature} from '../../../../services/jobDetailApi';
import {cardContainerProps} from '../JobDetails.styles';
import {SectionHeader} from './SectionHeader';
import {DialogShell, DialogHeader, DialogFooter, dialogContentBg} from '../../../dialogs/shared/mantine';
import classes from './PodPhotosSection.module.css';

interface PodPhotosSectionProps {
    deliveryPhotos: PodPhoto[];
    pickupPhotos: PodPhoto[];
    imageOnlyDeliveryPhotos: PodPhoto[];
    imageOnlyPickupPhotos: PodPhoto[];
    isLoading: boolean;
    showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
    onUploadPhotos?: () => void;
    onSendPod?: () => void;
    /** Job id — required to enable per-photo delete on the delivery grid. */
    jobId?: number;
    /** Called after a photo is soft-deleted so the caller can refresh the photo list. */
    onPhotoDeleted?: () => void;
}

const viewerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    maxHeight: 280,
    overflow: 'hidden',
    display: 'flex',
    justifyContent: 'center',
    backgroundColor: 'var(--mantine-color-gray-2)',
    cursor: 'pointer',
    borderRadius: 'var(--mantine-radius-xs)',
    marginBottom: 8,
};

/**
 * The scrim buttons floating over the photo. ActionIcon takes its fill and its
 * hover from these two CSS variables, so the pair needs no stylesheet — the same
 * idiom as the app-toolbar and dispatch header controls.
 */
const overlayButtonStyle = {
    '--ai-bg': 'rgba(0, 0, 0, 0.45)',
    '--ai-hover': 'rgba(0, 0, 0, 0.65)',
    '--ai-color': 'var(--mantine-color-white)',
    position: 'absolute',
} as React.CSSProperties;

const thumbStyle: React.CSSProperties = {
    width: 52,
    height: 52,
    borderRadius: 'var(--mantine-radius-xs)',
    overflow: 'hidden',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

function PhotoGrid({
    title,
    photos,
    imageOnlyPhotos,
    showToast,
    jobId,
    canDelete = false,
    onPhotoDeleted,
}: {
    title: string;
    photos: PodPhoto[];
    imageOnlyPhotos: PodPhoto[];
    showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
    jobId?: number;
    canDelete?: boolean;
    onPhotoDeleted?: () => void;
}) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    // Index of the photo awaiting delete confirmation (null when the dialog is closed).
    const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const pendingPhoto = pendingDeleteIndex != null ? photos[pendingDeleteIndex] : null;
    const showDelete = canDelete && !!jobId;

    const closeDeleteDialog = useCallback(() => {
        if (isDeleting) return;
        setPendingDeleteIndex(null);
    }, [isDeleting]);

    const confirmDelete = useCallback(async () => {
        if (!jobId || pendingDeleteIndex == null) return;
        const photo = photos[pendingDeleteIndex];
        if (!photo?.s3Key) {
            showToast('Cannot delete this photo — missing file reference.', 'error');
            setPendingDeleteIndex(null);
            return;
        }
        setIsDeleting(true);
        try {
            await deleteJobDeliveryPhotoOrSignature(jobId, photo.s3Key);
            // Keep the carousel index in range now that a photo is gone.
            setSelectedIndex(prev => Math.max(0, Math.min(prev, photos.length - 2)));
            setPendingDeleteIndex(null);
            showToast('Photo deleted', 'success');
            onPhotoDeleted?.();
        } catch {
            showToast('Failed to delete photo', 'error');
        } finally {
            setIsDeleting(false);
        }
    }, [jobId, pendingDeleteIndex, photos, showToast, onPhotoDeleted]);

    // Reset index when photos array changes to avoid stale selection
    useEffect(() => {
        setSelectedIndex(prev => prev >= photos.length ? 0 : prev);
    }, [photos.length]);

    // Keyboard navigation for photo carousel
    useEffect(() => {
        if (photos.length <= 1) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') {
                setSelectedIndex(prev => (prev - 1 + photos.length) % photos.length);
            } else if (e.key === 'ArrowRight') {
                setSelectedIndex(prev => (prev + 1) % photos.length);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [photos.length]);

    const openViewer = useCallback((index: number) => {
        const photo = photos[index];
        if (!photo) return;

        if (isImageFile(photo)) {
            const imageIndex = imageOnlyPhotos.findIndex(p => p.url === photo.url);
            window.ReactPodPhotoViewer?.open(
                imageOnlyPhotos,
                imageIndex >= 0 ? imageIndex : 0,
                undefined,
                () => {}
            );
        } else if (photo.s3Key) {
            downloadFile(photo.s3Key, photo.fileName || 'file')
                .then(() => showToast('File downloaded successfully', 'success'))
                .catch(() => showToast('Failed to download file', 'error'));
        }
    }, [photos, imageOnlyPhotos, showToast]);

    if (!photos.length) {
        return (
            <Box py="lg" ta="center">
                <Icon lucide={Images} size={36} color="var(--mantine-color-dimmed)" style={{marginBottom: 4}} aria-hidden/>
                <Text c="dimmed" style={{fontSize: '0.8125rem'}}>
                    No {title.toLowerCase()} photos
                </Text>
            </Box>
        );
    }

    const selectedPhoto = photos[selectedIndex] || photos[0];

    return (
        <>
            <Box>
                {/* Main photo viewer */}
                {selectedPhoto && isImageFile(selectedPhoto) && (
                    <Box style={viewerStyle} onClick={() => openViewer(selectedIndex)}>
                        <img
                            src={selectedPhoto.url}
                            alt={`${title} photo`}
                            style={{maxWidth: '100%', maxHeight: 280, objectFit: 'contain'}}
                        />
                        {showDelete && (
                            <Tooltip label="Delete photo">
                                <ActionIcon
                                    size="md"
                                    variant="filled"
                                    aria-label="Delete photo"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setPendingDeleteIndex(selectedIndex);
                                    }}
                                    style={{...overlayButtonStyle, right: 8, top: 8}}
                                >
                                    <Icon lucide={Trash2} size={18}/>
                                </ActionIcon>
                            </Tooltip>
                        )}
                        {photos.length > 1 && (
                            <>
                                <ActionIcon
                                    size="md"
                                    variant="filled"
                                    aria-label="Previous photo"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedIndex((selectedIndex - 1 + photos.length) % photos.length);
                                    }}
                                    style={{...overlayButtonStyle, left: 8, top: '50%', transform: 'translateY(-50%)'}}
                                >
                                    <Icon lucide={ChevronLeft} size={18}/>
                                </ActionIcon>
                                <ActionIcon
                                    size="md"
                                    variant="filled"
                                    aria-label="Next photo"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedIndex((selectedIndex + 1) % photos.length);
                                    }}
                                    style={{...overlayButtonStyle, right: 8, top: '50%', transform: 'translateY(-50%)'}}
                                >
                                    <Icon lucide={ChevronRight} size={18}/>
                                </ActionIcon>
                                {/* Photo counter */}
                                <Text
                                    style={{
                                        position: 'absolute', bottom: 8, right: 8,
                                        backgroundColor: 'rgba(0,0,0,0.5)',
                                        color: 'var(--mantine-color-white)',
                                        paddingInline: 8, paddingBlock: 2,
                                        borderRadius: 'var(--mantine-radius-xs)',
                                        fontSize: '0.6875rem', fontWeight: 500,
                                    }}
                                >
                                    {selectedIndex + 1} / {photos.length}
                                </Text>
                            </>
                        )}
                    </Box>
                )}

                {/* Thumbnails */}
                {photos.length > 1 && (
                    <Group gap={4} wrap="wrap">
                        {photos.map((photo, index) => (
                            <Box
                                key={index}
                                className={classes.thumb}
                                data-selected={index === selectedIndex || undefined}
                                style={thumbStyle}
                                onClick={() => {
                                    setSelectedIndex(index);
                                    if (!isImageFile(photo)) openViewer(index);
                                }}
                            >
                                {isImageFile(photo) ? (
                                    <img
                                        src={photo.url}
                                        alt={`Thumbnail ${index}`}
                                        style={{width: '100%', height: '100%', objectFit: 'cover'}}
                                    />
                                ) : (
                                    isPdfFile(photo)
                                        ? <Icon lucide={FileText} size={22} color="var(--mantine-color-red-5)"/>
                                        : <Icon lucide={File} size={22} color="var(--mantine-color-dimmed)"/>
                                )}
                            </Box>
                        ))}
                    </Group>
                )}
            </Box>
            {showDelete && (
                <DialogShell
                    opened={pendingDeleteIndex != null}
                    onClose={closeDeleteDialog}
                    label="Delete photo"
                >
                    <DialogHeader
                        icon={<Icon lucide={Trash2}/>}
                        title="Delete photo"
                        subtitle={pendingPhoto?.fileName}
                        onClose={closeDeleteDialog}
                        variant="error"
                        closeDisabled={isDeleting}
                    />
                    <Box p="lg" bg={dialogContentBg}>
                        <Text size="sm">
                            Remove this {title.toLowerCase()} photo from the job? The image is archived
                            (not permanently deleted) and can be recovered if needed.
                        </Text>
                    </Box>
                    <DialogFooter
                        onCancel={closeDeleteDialog}
                        onConfirm={confirmDelete}
                        confirmLabel="Delete"
                        confirmColor="red"
                        confirmIcon={<Icon lucide={Trash2} size={16}/>}
                        submitting={isDeleting}
                    />
                </DialogShell>
            )}
        </>
    );
}

export function PodPhotosSection({
    deliveryPhotos,
    pickupPhotos,
    imageOnlyDeliveryPhotos,
    imageOnlyPickupPhotos,
    isLoading,
    showToast,
    onUploadPhotos,
    onSendPod,
    jobId,
    onPhotoDeleted,
}: PodPhotosSectionProps) {
    if (isLoading) {
        return (
            <Paper {...cardContainerProps} p="sm" data-testid="pod-photos-loading">
                <Skeleton height={140} radius="xs" mb="xs"/>
                <Group gap={4}>
                    <Skeleton width={52} height={52} radius="xs"/>
                    <Skeleton width={52} height={52} radius="xs"/>
                    <Skeleton width={52} height={52} radius="xs"/>
                </Group>
            </Paper>
        );
    }

    if (!deliveryPhotos.length && !pickupPhotos.length) return null;

    return (
        <>
            {/* Delivery Photos */}
            <Paper {...cardContainerProps}>
                <SectionHeader
                    lucide={Camera}
                    title="Delivery Photos"
                    subtitle={`${deliveryPhotos.length} ${deliveryPhotos.length === 1 ? 'photo' : 'photos'}`}
                    endAction={
                        <>
                            {onUploadPhotos && (
                                <Tooltip label="Upload POD Photos">
                                    <ActionIcon
                                        variant="subtle"
                                        color="gray"
                                        size="sm"
                                        aria-label="Upload POD Photos"
                                        onClick={onUploadPhotos}
                                    >
                                        <Icon lucide={Upload} size={18}/>
                                    </ActionIcon>
                                </Tooltip>
                            )}
                            {onSendPod && (
                                <Tooltip label="Send POD">
                                    <ActionIcon
                                        variant="subtle"
                                        color="gray"
                                        size="sm"
                                        aria-label="Send POD"
                                        onClick={onSendPod}
                                    >
                                        <Icon lucide={Send} size={18}/>
                                    </ActionIcon>
                                </Tooltip>
                            )}
                        </>
                    }
                />
                <Box p="md">
                    <PhotoGrid
                        title="Delivery"
                        photos={deliveryPhotos}
                        imageOnlyPhotos={imageOnlyDeliveryPhotos}
                        showToast={showToast}
                        jobId={jobId}
                        canDelete
                        onPhotoDeleted={onPhotoDeleted}
                    />
                </Box>
            </Paper>

            {/* Pickup Photos */}
            {pickupPhotos.length > 0 && (
                <Paper {...cardContainerProps} mt="xs">
                    <SectionHeader
                        lucide={Camera}
                        title="Pickup Photos"
                        subtitle={`${pickupPhotos.length} ${pickupPhotos.length === 1 ? 'photo' : 'photos'}`}
                    />
                    <Box p="md">
                        <PhotoGrid
                            title="Pickup"
                            photos={pickupPhotos}
                            imageOnlyPhotos={imageOnlyPickupPhotos}
                            showToast={showToast}
                        />
                    </Box>
                </Paper>
            )}
        </>
    );
}
