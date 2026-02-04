/**
 * POD Photo Viewer React Module
 *
 * Entry point for the React-based POD Photo Viewer.
 * Exposes a global function to open the viewer from AngularJS.
 */

import React from 'react';
import {createRoot, Root} from 'react-dom/client';
import {ThemeProvider, CssBaseline} from '@mui/material';
import {PodPhotoViewer, PodPhoto} from './PodPhotoViewer';
import {getTheme} from '../../../theme/muiTheme';
import angular from 'angular';

// State management for the viewer
interface ViewerState {
    isOpen: boolean;
    photos: PodPhoto[];
    initialPhotoIndex: number;
    timeZone?: string;
    onCloseCallback?: () => void;
}

let viewerRoot: Root | null = null;
let viewerContainer: HTMLDivElement | null = null;
let viewerState: ViewerState = {
    isOpen: false,
    photos: [],
    initialPhotoIndex: 0,
};

/**
 * Renders the viewer with current state
 */
function renderViewer(): void {
    if (!viewerRoot) return;

    const handleClose = () => {
        viewerState.isOpen = false;
        viewerState.onCloseCallback?.();
        viewerState.onCloseCallback = undefined;
        renderViewer();
    };

    // Get theme dynamically based on customer region
    const currentTheme = getTheme();

    viewerRoot.render(
        <ThemeProvider theme={currentTheme}>
            <CssBaseline />
            <PodPhotoViewer
                isOpen={viewerState.isOpen}
                photos={viewerState.photos}
                initialPhotoIndex={viewerState.initialPhotoIndex}
                timeZone={viewerState.timeZone}
                onClose={handleClose}
            />
        </ThemeProvider>
    );
}

/**
 * Initialize the viewer root (called once)
 */
function initializeViewerRoot(): void {
    if (viewerRoot) return;

    viewerContainer = document.createElement('div');
    viewerContainer.id = 'react-pod-photo-viewer-root';
    document.body.appendChild(viewerContainer);
    viewerRoot = createRoot(viewerContainer);
}

/**
 * Opens the POD photo viewer
 *
 * @param photos - Array of photos to display
 * @param initialPhotoIndex - Index of the photo to show first (default: 0)
 * @param timeZone - Timezone string for timestamp display
 * @param onClose - Optional callback when the viewer is closed
 */
export function openPodPhotoViewer(
    photos: PodPhoto[],
    initialPhotoIndex: number = 0,
    timeZone?: string,
    onClose?: () => void
): void {
    initializeViewerRoot();

    viewerState = {
        isOpen: true,
        photos: [...photos], // Clone the array
        initialPhotoIndex,
        timeZone,
        onCloseCallback: onClose,
    };
    renderViewer();
}

/**
 * Closes the POD photo viewer
 */
export function closePodPhotoViewer(): void {
    if (viewerState.isOpen) {
        viewerState.isOpen = false;
        viewerState.onCloseCallback?.();
        viewerState.onCloseCallback = undefined;
        renderViewer();
    }
}

// Expose globally for AngularJS access
(window as any).ReactPodPhotoViewer = {
    open: openPodPhotoViewer,
    close: closePodPhotoViewer,
};

// Register as AngularJS module (for ocLazyLoad compatibility)w
const podPhotoViewerReactModule = (window as any).angular.module(
    'uDispatch.podPhotoViewerReact',
    []
);

// Register a service that wraps the React viewer
podPhotoViewerReactModule.service('podPhotoViewerReactService', [
    () => ({
        /**
         * Opens the React POD photo viewer
         * @param photos - Array of photos to display
         * @param initialPhotoIndex - Index of the photo to show first
         * @param timeZone - Timezone string for timestamp display
         * @param onClose - Optional callback when the viewer is closed
         */
        openPodPhotoViewer: (
            photos: PodPhoto[],
            initialPhotoIndex: number = 0,
            timeZone?: string,
            onClose?: () => void
        ) => openPodPhotoViewer(photos, initialPhotoIndex, timeZone, onClose),

        /**
         * Closes the React POD photo viewer
         */
        closePodPhotoViewer: () => closePodPhotoViewer(),
    })
]);

console.log('[PodPhotoViewerReact] Module registered');

export default podPhotoViewerReactModule;
