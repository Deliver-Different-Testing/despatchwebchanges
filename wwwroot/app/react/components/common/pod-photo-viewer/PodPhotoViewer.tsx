/**
 * React POD Photo Viewer Component
 *
 * A fullscreen photo viewer for POD (Proof of Delivery) photos.
 * Displays photos with navigation controls, indicator dots, and metadata.
 */

import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {alpha} from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {getTimezoneAbbreviation} from '../../../utils/dateUtils';
import {PodPhotoViewerProps, PodPhoto} from "./pod-photo-viewer.types";

export type {PodPhoto};

export const PodPhotoViewer: React.FC<PodPhotoViewerProps> = ({
    photos,
    isOpen,
    initialPhotoIndex = 0,
    timeZone,
    onClose,
}) => {
    const [currentIndex, setCurrentIndex] = useState(initialPhotoIndex);

    // Reset to initial index when dialog opens or initialPhotoIndex changes
    useEffect(() => {
        if (isOpen) {
            setCurrentIndex(initialPhotoIndex);
        }
    }, [isOpen, initialPhotoIndex]);

    // Memoize the formatted timezone string
    const formattedTimeZone = useMemo(() => {
        if (!timeZone) return '';
        return getTimezoneAbbreviation(timeZone);
    }, [timeZone]);

    const currentPhoto = photos[currentIndex];

    const nextPhoto = useCallback(() => {
        setCurrentIndex((prev) => (prev + 1) % photos.length);
    }, [photos.length]);

    const prevPhoto = useCallback(() => {
        setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
    }, [photos.length]);

    const setPhotoIndex = useCallback((index: number) => {
        setCurrentIndex(index);
    }, []);

    // Handle keyboard navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            switch (event.key) {
                case 'ArrowLeft':
                    prevPhoto();
                    break;
                case 'ArrowRight':
                    nextPhoto();
                    break;
                case 'Escape':
                    onClose();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, nextPhoto, prevPhoto, onClose]);

    if (!currentPhoto) return null;

    return (
        <Dialog
            open={isOpen}
            onClose={onClose}
            maxWidth={false}
            fullWidth
            slotProps={{
                paper: {
                    sx: {
                        backgroundColor: 'transparent',
                        boxShadow: 'none',
                        maxWidth: '100vw',
                        maxHeight: '100vh',
                        margin: 0,
                        width: '100%',
                        height: '100%',
                    },
                },
                backdrop: {
                    sx: (theme) => ({
                        backgroundColor: alpha(theme.palette.common.black, 0.8),
                    }),
                },
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    width: '100%',
                    position: 'relative',
                }}
            >
                <Box
                    sx={{
                        position: 'relative',
                        width: '100%',
                        maxWidth: 800,
                        mx: 2,
                    }}
                >
                    {/* Close Button */}
                    <IconButton
                        onClick={onClose}
                        aria-label="Close photo viewer"
                        sx={(theme) => ({
                            position: 'absolute',
                            top: -48,
                            right: 0,
                            color: 'white',
                            backgroundColor: 'transparent',
                            zIndex: 2,
                            '&:hover': {
                                backgroundColor: alpha(theme.palette.common.white, 0.1),
                            },
                        })}
                    >
                        <CloseIcon sx={{fontSize: 24}} />
                    </IconButton>

                    {/* Photo Container */}
                    <Box
                        sx={{
                            position: 'relative',
                            width: '100%',
                        }}
                    >
                        <Box
                            component="img"
                            src={currentPhoto.url}
                            alt={`POD ${currentIndex + 1}`}
                            sx={{
                                width: '100%',
                                height: 'auto',
                                borderRadius: 1,
                                display: 'block',
                            }}
                        />

                        {/* Previous Button */}
                        <IconButton
                            onClick={prevPhoto}
                            aria-label="Previous photo"
                            sx={(theme) => ({
                                position: 'absolute',
                                left: 16,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                backgroundColor: alpha(theme.palette.common.black, 0.5),
                                color: 'white',
                                borderRadius: '50%',
                                width: 40,
                                height: 40,
                                '&:hover': {
                                    backgroundColor: alpha(theme.palette.common.black, 0.75),
                                },
                            })}
                        >
                            <ChevronLeftIcon sx={{fontSize: 24}} />
                        </IconButton>

                        {/* Next Button */}
                        <IconButton
                            onClick={nextPhoto}
                            aria-label="Next photo"
                            sx={(theme) => ({
                                position: 'absolute',
                                right: 16,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                backgroundColor: alpha(theme.palette.common.black, 0.5),
                                color: 'white',
                                borderRadius: '50%',
                                width: 40,
                                height: 40,
                                '&:hover': {
                                    backgroundColor: alpha(theme.palette.common.black, 0.75),
                                },
                            })}
                        >
                            <ChevronRightIcon sx={{fontSize: 24}} />
                        </IconButton>
                    </Box>

                    {/* Indicator Dots */}
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            mt: 2,
                            gap: 1,
                        }}
                    >
                        {photos.map((_, index) => (
                            <Box
                                key={index}
                                component="button"
                                onClick={() => setPhotoIndex(index)}
                                aria-label={`Go to photo ${index + 1}`}
                                sx={(theme) => ({
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    backgroundColor: currentIndex === index
                                        ? 'white'
                                        : alpha(theme.palette.common.white, 0.5),
                                    border: 'none',
                                    padding: 0,
                                    cursor: 'pointer',
                                    transition: 'background-color 0.2s',
                                    '&:hover': {
                                        backgroundColor: currentIndex === index
                                            ? 'white'
                                            : alpha(theme.palette.common.white, 0.7),
                                    },
                                })}
                            />
                        ))}
                    </Box>

                    {/* Photo Info */}
                    <Box
                        sx={{
                            textAlign: 'center',
                            mt: 1,
                            color: 'white',
                        }}
                    >
                        {currentPhoto.timestamp && (
                            <Typography
                                variant="body2"
                                sx={{fontSize: 14, m: 0}}
                            >
                                {currentPhoto.timestamp} {formattedTimeZone}
                            </Typography>
                        )}
                        {currentPhoto.uploadedBy && (
                            <Typography
                                variant="body2"
                                sx={{
                                    fontSize: 12,
                                    color: (theme) => alpha(theme.palette.common.white, 0.7),
                                    mt: 0.5,
                                }}
                            >
                                Delivered by {currentPhoto.uploadedBy}
                            </Typography>
                        )}
                        {currentPhoto.coordinates && (
                            <Typography
                                variant="body2"
                                sx={{
                                    fontSize: 12,
                                    color: (theme) => alpha(theme.palette.common.white, 0.7),
                                    mt: 0.5,
                                }}
                            >
                                Location: {currentPhoto.coordinates.lat}, {currentPhoto.coordinates.lng}
                            </Typography>
                        )}
                    </Box>
                </Box>
            </Box>
        </Dialog>
    );
};

export default PodPhotoViewer;
