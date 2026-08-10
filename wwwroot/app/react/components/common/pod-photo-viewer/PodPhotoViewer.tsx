/**
 * React POD Photo Viewer Component
 *
 * A fullscreen photo viewer for POD (Proof of Delivery) photos.
 * Displays photos with navigation controls, indicator dots, and metadata.
 *
 * This is a lightbox rather than a design-language dialog, so it deliberately
 * does not use `DialogShell`: the modal content is transparent and full-bleed,
 * and the chrome is white-on-black scrim rather than a brand fill.
 */

import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {ActionIcon, Box, Modal, Text, alpha} from '@mantine/core';
import {ChevronLeft, ChevronRight, X} from 'lucide-react';
import {Icon} from '../icon/Icon';
import {getTimezoneAbbreviation} from '../../../utils/dateUtils';
import {PodPhotoViewerProps, PodPhoto} from "./pod-photo-viewer.types";

export type {PodPhoto};

const WHITE = 'var(--mantine-color-white)';
const scrim = (opacity: number) => alpha('var(--mantine-color-black)', opacity);

const navButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    backgroundColor: scrim(0.5),
    color: WHITE,
    borderRadius: '50%',
    width: 40,
    height: 40,
};

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
        <Modal
            opened={isOpen}
            onClose={onClose}
            fullScreen
            withCloseButton={false}
            padding={0}
            /*
             * Escape is owned by the arrow-key handler above. Mantine closes on
             * Escape via a window listener that does not stop propagation, so
             * leaving it on would fire onClose twice for one key press.
             */
            closeOnEscape={false}
            overlayProps={{backgroundOpacity: 0.8, color: 'var(--mantine-color-black)'}}
            styles={{
                content: {backgroundColor: 'transparent', boxShadow: 'none'},
                body: {padding: 0, height: '100%'},
            }}
        >
            <Box
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    width: '100%',
                    position: 'relative',
                }}
            >
                <Box style={{position: 'relative', width: '100%', maxWidth: 800, marginInline: 'var(--mantine-spacing-md)'}}>
                    {/* Close Button */}
                    <ActionIcon
                        variant="transparent"
                        onClick={onClose}
                        aria-label="Close photo viewer"
                        style={{position: 'absolute', top: -48, right: 0, color: WHITE, zIndex: 2}}
                    >
                        <Icon lucide={X} size={24}/>
                    </ActionIcon>

                    {/* Photo Container */}
                    <Box style={{position: 'relative', width: '100%'}}>
                        <img
                            src={currentPhoto.url}
                            alt={`POD ${currentIndex + 1}`}
                            style={{
                                width: '100%',
                                height: 'auto',
                                borderRadius: 'var(--mantine-radius-sm)',
                                display: 'block',
                            }}
                        />

                        {/* Previous Button */}
                        <ActionIcon
                            variant="transparent"
                            onClick={prevPhoto}
                            aria-label="Previous photo"
                            style={{...navButtonStyle, left: 16}}
                        >
                            <Icon lucide={ChevronLeft} size={24}/>
                        </ActionIcon>

                        {/* Next Button */}
                        <ActionIcon
                            variant="transparent"
                            onClick={nextPhoto}
                            aria-label="Next photo"
                            style={{...navButtonStyle, right: 16}}
                        >
                            <Icon lucide={ChevronRight} size={24}/>
                        </ActionIcon>
                    </Box>

                    {/* Indicator Dots */}
                    <Box
                        style={{
                            display: 'flex',
                            justifyContent: 'center',
                            marginTop: 'var(--mantine-spacing-md)',
                            gap: 'var(--mantine-spacing-xs)',
                        }}
                    >
                        {photos.map((_, index) => (
                            <button
                                key={index}
                                type="button"
                                onClick={() => setPhotoIndex(index)}
                                aria-label={`Go to photo ${index + 1}`}
                                aria-current={currentIndex === index || undefined}
                                style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    backgroundColor: currentIndex === index ? WHITE : alpha(WHITE, 0.5),
                                    border: 'none',
                                    padding: 0,
                                    cursor: 'pointer',
                                    transition: 'background-color 0.2s',
                                }}
                            />
                        ))}
                    </Box>

                    {/* Photo Info */}
                    <Box style={{textAlign: 'center', marginTop: 'var(--mantine-spacing-xs)', color: WHITE}}>
                        {currentPhoto.timestamp && (
                            <Text fz={14} m={0} c={WHITE}>
                                {currentPhoto.timestamp} {formattedTimeZone}
                            </Text>
                        )}
                        {currentPhoto.uploadedBy && (
                            <Text fz={12} mt={4} c={alpha(WHITE, 0.7)}>
                                Delivered by {currentPhoto.uploadedBy}
                            </Text>
                        )}
                        {currentPhoto.coordinates && (
                            <Text fz={12} mt={4} c={alpha(WHITE, 0.7)}>
                                Location: {currentPhoto.coordinates.lat}, {currentPhoto.coordinates.lng}
                            </Text>
                        )}
                    </Box>
                </Box>
            </Box>
        </Modal>
    );
};

export default PodPhotoViewer;
