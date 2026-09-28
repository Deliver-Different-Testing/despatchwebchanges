/**
 * PodPhotosSection - Photo grid, viewer, upload for delivery and pickup photos
 */

import React, {useState, useCallback, useEffect} from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import UploadIcon from '@mui/icons-material/Upload';
import SendIcon from '@mui/icons-material/Send';
import Tooltip from '@mui/material/Tooltip';
import {isImageFile, isPdfFile} from '../JobDetails.types';
import type {PodPhoto} from '../JobDetails.types';
import {downloadFile} from '../../../../services/jobDetailApi';
import {
    cardContainerSx,
    sectionToolbarSx,
    sectionToolbarTitleSx,
    sectionToolbarIconSx,
} from '../JobDetails.styles';

const cardContainerLoadingSx = {...cardContainerSx as object, p: 1.5};
const cardContainerPickupSx = {...cardContainerSx as object, mt: 1};

interface PodPhotosSectionProps {
    deliveryPhotos: PodPhoto[];
    pickupPhotos: PodPhoto[];
    imageOnlyDeliveryPhotos: PodPhoto[];
    imageOnlyPickupPhotos: PodPhoto[];
    isLoading: boolean;
    showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
    onUploadPhotos?: () => void;
    onSendPod?: () => void;
}

function PhotoGrid({
    title,
    photos,
    imageOnlyPhotos,
    showToast,
}: {
    title: string;
    photos: PodPhoto[];
    imageOnlyPhotos: PodPhoto[];
    showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}) {
    const [selectedIndex, setSelectedIndex] = useState(0);

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
            <Box sx={{py: 3, textAlign: 'center'}}>
                <PhotoLibraryIcon sx={{fontSize: 36, color: 'text.disabled', mb: 0.5}} />
                <Typography variant="body2" color="text.secondary" sx={{fontSize: '0.8125rem'}}>
                    No {title.toLowerCase()} photos
                </Typography>
            </Box>
        );
    }

    const selectedPhoto = photos[selectedIndex] || photos[0];

    return (
        <Box>
            {/* Main photo viewer */}
            {selectedPhoto && isImageFile(selectedPhoto) && (
                <Box
                    sx={{
                        position: 'relative',
                        width: '100%',
                        maxHeight: 280,
                        overflow: 'hidden',
                        display: 'flex',
                        justifyContent: 'center',
                        bgcolor: 'grey.100',
                        cursor: 'pointer',
                        borderRadius: 1,
                        mb: 1,
                    }}
                    onClick={() => openViewer(selectedIndex)}
                >
                    <img
                        src={selectedPhoto.url}
                        alt={`${title} photo`}
                        style={{maxWidth: '100%', maxHeight: 280, objectFit: 'contain'}}
                    />
                    {photos.length > 1 && (
                        <>
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedIndex((selectedIndex - 1 + photos.length) % photos.length);
                                }}
                                sx={{
                                    position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                                    bgcolor: 'rgba(0,0,0,0.45)', color: 'white',
                                    '&:hover': {bgcolor: 'rgba(0,0,0,0.65)'},
                                }}
                            >
                                <ChevronLeftIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedIndex((selectedIndex + 1) % photos.length);
                                }}
                                sx={{
                                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                                    bgcolor: 'rgba(0,0,0,0.45)', color: 'white',
                                    '&:hover': {bgcolor: 'rgba(0,0,0,0.65)'},
                                }}
                            >
                                <ChevronRightIcon fontSize="small" />
                            </IconButton>
                            {/* Photo counter */}
                            <Typography
                                variant="caption"
                                sx={{
                                    position: 'absolute', bottom: 8, right: 8,
                                    bgcolor: 'rgba(0,0,0,0.5)', color: 'white',
                                    px: 1, py: 0.25, borderRadius: 1,
                                    fontSize: '0.6875rem', fontWeight: 500,
                                }}
                            >
                                {selectedIndex + 1} / {photos.length}
                            </Typography>
                        </>
                    )}
                </Box>
            )}

            {/* Thumbnails */}
            {photos.length > 1 && (
                <Box sx={{display: 'flex', gap: 0.5, flexWrap: 'wrap'}}>
                    {photos.map((photo, index) => (
                        <Box
                            key={index}
                            onClick={() => {
                                setSelectedIndex(index);
                                if (!isImageFile(photo)) openViewer(index);
                            }}
                            sx={{
                                width: 52,
                                height: 52,
                                borderRadius: 1,
                                overflow: 'hidden',
                                cursor: 'pointer',
                                border: 2,
                                borderColor: index === selectedIndex ? 'primary.main' : 'divider',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: 'grey.100',
                                transition: (theme) => `border-color ${theme.transitions.duration.short}ms ease`,
                                '&:hover': {
                                    borderColor: index === selectedIndex ? 'primary.main' : 'grey.400',
                                },
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
                                    ? <PictureAsPdfIcon sx={{fontSize: 22, color: 'error.main'}} />
                                    : <InsertDriveFileIcon sx={{fontSize: 22, color: 'text.secondary'}} />
                            )}
                        </Box>
                    ))}
                </Box>
            )}
        </Box>
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
}: PodPhotosSectionProps) {
    if (isLoading) {
        return (
            <Box sx={cardContainerLoadingSx}>
                <Skeleton variant="rectangular" height={140} sx={{borderRadius: 1, mb: 1}} />
                <Box sx={{display: 'flex', gap: 0.5}}>
                    <Skeleton variant="rectangular" width={52} height={52} sx={{borderRadius: 1}} />
                    <Skeleton variant="rectangular" width={52} height={52} sx={{borderRadius: 1}} />
                    <Skeleton variant="rectangular" width={52} height={52} sx={{borderRadius: 1}} />
                </Box>
            </Box>
        );
    }

    if (!deliveryPhotos.length && !pickupPhotos.length) return null;

    return (
        <>
            {/* Delivery Photos */}
            <Box sx={cardContainerSx}>
                <Box sx={sectionToolbarSx}>
                    <PhotoCameraIcon sx={sectionToolbarIconSx} />
                    <Typography variant="subtitle2" sx={sectionToolbarTitleSx}>
                        Delivery Photos
                    </Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ml: 0.5}}>
                        ({deliveryPhotos.length})
                    </Typography>
                    <Box sx={{flex: 1}} />
                    {onUploadPhotos && (
                        <Tooltip title="Upload POD Photos">
                            <IconButton size="small" onClick={onUploadPhotos}>
                                <UploadIcon sx={{fontSize: 18}} />
                            </IconButton>
                        </Tooltip>
                    )}
                    {onSendPod && (
                        <Tooltip title="Send POD">
                            <IconButton size="small" onClick={onSendPod}>
                                <SendIcon sx={{fontSize: 18}} />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>
                <Box sx={{p: 1.5}}>
                    <PhotoGrid
                        title="Delivery"
                        photos={deliveryPhotos}
                        imageOnlyPhotos={imageOnlyDeliveryPhotos}
                        showToast={showToast}
                    />
                </Box>
            </Box>

            {/* Pickup Photos */}
            {pickupPhotos.length > 0 && (
                <Box sx={cardContainerPickupSx}>
                    <Box sx={sectionToolbarSx}>
                        <PhotoCameraIcon sx={sectionToolbarIconSx} />
                        <Typography variant="subtitle2" sx={sectionToolbarTitleSx}>
                            Pickup Photos
                        </Typography>
                        <Typography variant="caption" color="text.disabled" sx={{ml: 0.5}}>
                            ({pickupPhotos.length})
                        </Typography>
                    </Box>
                    <Box sx={{p: 1.5}}>
                        <PhotoGrid
                            title="Pickup"
                            photos={pickupPhotos}
                            imageOnlyPhotos={imageOnlyPickupPhotos}
                            showToast={showToast}
                        />
                    </Box>
                </Box>
            )}
        </>
    );
}
