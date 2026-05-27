/**
 * PodPhotosSection Component Tests
 */

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {PodPhotosSection} from './PodPhotosSection';
import type {PodPhoto} from '../JobDetails.types';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

function createMockPhoto(overrides?: Partial<PodPhoto>): PodPhoto {
    return {
        url: 'https://example.com/photo.jpg',
        uploadedBy: 'Test User',
        timestamp: '2026-03-23T12:00:00',
        contentType: 'image/jpeg',
        fileName: 'photo.jpg',
        ...overrides,
    };
}

function createDefaultProps(overrides?: Record<string, any>) {
    return {
        deliveryPhotos: [] as PodPhoto[],
        pickupPhotos: [] as PodPhoto[],
        imageOnlyDeliveryPhotos: [] as PodPhoto[],
        imageOnlyPickupPhotos: [] as PodPhoto[],
        isLoading: false,
        showToast: jest.fn(),
        onUploadPhotos: jest.fn(),
        onSendPod: jest.fn(),
        ...overrides,
    };
}

describe('PodPhotosSection', () => {
    it('renders nothing when no photos and not loading', () => {
        const {container} = renderWithTheme(
            <PodPhotosSection {...createDefaultProps()} />
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders loading skeleton when isLoading', () => {
        renderWithTheme(
            <PodPhotosSection {...createDefaultProps({isLoading: true})} />
        );
        expect(document.querySelector('.MuiSkeleton-root')).toBeInTheDocument();
    });

    it('renders delivery and pickup photo sections when both exist', () => {
        const deliveryPhotos = [createMockPhoto(), createMockPhoto({url: 'https://example.com/photo2.jpg'})];
        const pickupPhotos = [createMockPhoto()];
        renderWithTheme(
            <PodPhotosSection {...createDefaultProps({
                deliveryPhotos,
                pickupPhotos,
                imageOnlyDeliveryPhotos: deliveryPhotos,
                imageOnlyPickupPhotos: pickupPhotos,
            })} />
        );

        expect(screen.getByText('Delivery Photos')).toBeInTheDocument();
        expect(screen.getByText('(2)')).toBeInTheDocument();
        expect(screen.getByText('Pickup Photos')).toBeInTheDocument();
    });

    it('hides pickup section when no pickup photos', () => {
        const deliveryPhotos = [createMockPhoto()];
        renderWithTheme(
            <PodPhotosSection {...createDefaultProps({deliveryPhotos, imageOnlyDeliveryPhotos: deliveryPhotos})} />
        );

        expect(screen.getByText('Delivery Photos')).toBeInTheDocument();
        expect(screen.queryByText('Pickup Photos')).not.toBeInTheDocument();
    });

    it('renders action buttons and handles clicks', () => {
        const onUploadPhotos = jest.fn();
        const onSendPod = jest.fn();
        const deliveryPhotos = [createMockPhoto()];
        renderWithTheme(
            <PodPhotosSection {...createDefaultProps({
                deliveryPhotos,
                imageOnlyDeliveryPhotos: deliveryPhotos,
                onUploadPhotos,
                onSendPod,
            })} />
        );

        const uploadButton = screen.getByLabelText('Upload POD Photos');
        expect(uploadButton).toBeInTheDocument();
        fireEvent.click(uploadButton);
        expect(onUploadPhotos).toHaveBeenCalledTimes(1);

        const sendButton = screen.getByLabelText('Send POD');
        expect(sendButton).toBeInTheDocument();
        fireEvent.click(sendButton);
        expect(onSendPod).toHaveBeenCalledTimes(1);
    });

    it('renders photo image for image files', () => {
        const deliveryPhotos = [createMockPhoto()];
        renderWithTheme(
            <PodPhotosSection {...createDefaultProps({deliveryPhotos, imageOnlyDeliveryPhotos: deliveryPhotos})} />
        );

        const img = screen.getByAltText('Delivery photo');
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
    });

    it('shows photo counter for multiple photos', () => {
        const deliveryPhotos = [
            createMockPhoto({url: 'https://example.com/1.jpg'}),
            createMockPhoto({url: 'https://example.com/2.jpg'}),
            createMockPhoto({url: 'https://example.com/3.jpg'}),
        ];
        renderWithTheme(
            <PodPhotosSection {...createDefaultProps({deliveryPhotos, imageOnlyDeliveryPhotos: deliveryPhotos})} />
        );

        expect(screen.getByText('1 / 3')).toBeInTheDocument();
    });

    it('renders "no photos" message when delivery photos are empty but section shows', () => {
        const pickupPhotos = [createMockPhoto()];
        renderWithTheme(
            <PodPhotosSection {...createDefaultProps({
                deliveryPhotos: [],
                pickupPhotos,
                imageOnlyPickupPhotos: pickupPhotos,
            })} />
        );

        expect(screen.getByText('No delivery photos')).toBeInTheDocument();
    });
});
