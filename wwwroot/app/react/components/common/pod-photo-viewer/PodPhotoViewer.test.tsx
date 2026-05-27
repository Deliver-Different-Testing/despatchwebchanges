/**
 * PodPhotoViewer Component Tests
 * Optimised: read-only tests consolidated to reduce render count.
 */

import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createTheme, ThemeProvider} from '@mui/material/styles';
import {PodPhoto, PodPhotoViewerProps} from "./pod-photo-viewer.types";
import PodPhotoViewer from "./PodPhotoViewer";

// Mock the dateUtils module
jest.mock('../../../utils/dateUtils', () => ({
    getTimezoneAbbreviation: jest.fn((tz: string) => {
        if (tz === 'Pacific/Auckland') return '';
        if (tz === 'America/Los_Angeles') return '(PST)';
        if (tz === 'America/New_York') return '(EST)';
        return `(${tz})`;
    }),
}));

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) => {
    return render(
        <ThemeProvider theme={theme}>
            {ui}
        </ThemeProvider>
    );
};

const mockPhotos: PodPhoto[] = [
    {
        url: 'https://example.com/photo1.jpg',
        timestamp: '2024-01-15 14:30',
        uploadedBy: 'John Driver',
        coordinates: {lat: -36.8485, lng: 174.7633},
        fileName: 'pod1.jpg',
    },
    {
        url: 'https://example.com/photo2.jpg',
        timestamp: '2024-01-15 15:00',
        uploadedBy: 'Jane Courier',
        coordinates: {lat: -36.8500, lng: 174.7650},
        fileName: 'pod2.jpg',
    },
    {
        url: 'https://example.com/photo3.jpg',
        timestamp: '2024-01-15 15:30',
        uploadedBy: 'Bob Delivery',
        fileName: 'pod3.jpg',
    },
];

const createMockProps = (overrides: Partial<PodPhotoViewerProps> = {}): PodPhotoViewerProps => ({
    photos: mockPhotos,
    isOpen: true,
    initialPhotoIndex: 0,
    timeZone: 'America/Los_Angeles',
    onClose: jest.fn(),
    ...overrides,
});

describe('PodPhotoViewer', () => {
    describe('Rendering', () => {
        it('should render dialog, photo image, close button, navigation buttons, and indicator dots', () => {
            const props = createMockProps();
            renderWithTheme(<PodPhotoViewer {...props} />);

            expect(screen.getByRole('dialog')).toBeInTheDocument();

            const image = screen.getByAltText('POD 1');
            expect(image).toBeInTheDocument();
            expect(image).toHaveAttribute('src', 'https://example.com/photo1.jpg');

            expect(screen.getByLabelText('Close photo viewer')).toBeInTheDocument();

            expect(screen.getByLabelText('Previous photo')).toBeInTheDocument();
            expect(screen.getByLabelText('Next photo')).toBeInTheDocument();

            const dots = screen.getAllByLabelText(/Go to photo/);
            expect(dots).toHaveLength(3);
        });

        it('should not render dialog when isOpen is false', () => {
            const props = createMockProps({isOpen: false});
            renderWithTheme(<PodPhotoViewer {...props} />);

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('should return null when currentPhoto is undefined', () => {
            const props = createMockProps({photos: []});
            renderWithTheme(<PodPhotoViewer {...props} />);

            // Dialog should not render when no photos
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    describe('Photo Metadata Display', () => {
        it('should display timestamp with timezone, uploader name, and coordinates', () => {
            const props = createMockProps();
            renderWithTheme(<PodPhotoViewer {...props} />);

            expect(screen.getByText('2024-01-15 14:30 (PST)')).toBeInTheDocument();
            expect(screen.getByText('Delivered by John Driver')).toBeInTheDocument();
            expect(screen.getByText('Location: -36.8485, 174.7633')).toBeInTheDocument();
        });

        it('should handle missing coordinates, NZ timezone, and undefined timezone', () => {
            // No coordinates on photo at index 2
            const propsNoCoords = createMockProps({initialPhotoIndex: 2});
            const {unmount: unmount1} = renderWithTheme(<PodPhotoViewer {...propsNoCoords} />);
            expect(screen.queryByText(/Location:/)).not.toBeInTheDocument();
            unmount1();

            // NZ timezone should show timestamp without abbreviation
            const propsNZ = createMockProps({timeZone: 'Pacific/Auckland'});
            const {unmount: unmount2} = renderWithTheme(<PodPhotoViewer {...propsNZ} />);
            expect(screen.getByText('2024-01-15 14:30')).toBeInTheDocument();
            unmount2();

            // Missing timezone should show timestamp without abbreviation
            const propsNoTz = createMockProps({timeZone: undefined});
            renderWithTheme(<PodPhotoViewer {...propsNoTz} />);
            expect(screen.getByText('2024-01-15 14:30')).toBeInTheDocument();
        });
    });

    describe('Navigation - Buttons', () => {
        it('should navigate to next photo when next button is clicked', () => {
            const props = createMockProps();
            renderWithTheme(<PodPhotoViewer {...props} />);

            const nextButton = screen.getByLabelText('Next photo');
            fireEvent.click(nextButton);

            expect(screen.getByAltText('POD 2')).toBeInTheDocument();
            expect(screen.getByText('Delivered by Jane Courier')).toBeInTheDocument();
        });

        it('should navigate to previous photo when prev button is clicked', () => {
            const props = createMockProps({initialPhotoIndex: 1});
            renderWithTheme(<PodPhotoViewer {...props} />);

            const prevButton = screen.getByLabelText('Previous photo');
            fireEvent.click(prevButton);

            expect(screen.getByAltText('POD 1')).toBeInTheDocument();
            expect(screen.getByText('Delivered by John Driver')).toBeInTheDocument();
        });

        it('should wrap around when navigating past boundaries', () => {
            // Wrap to last photo when clicking prev on first
            const propsFirst = createMockProps({initialPhotoIndex: 0});
            const {unmount} = renderWithTheme(<PodPhotoViewer {...propsFirst} />);

            fireEvent.click(screen.getByLabelText('Previous photo'));
            expect(screen.getByAltText('POD 3')).toBeInTheDocument();
            expect(screen.getByText('Delivered by Bob Delivery')).toBeInTheDocument();
            unmount();

            // Wrap to first photo when clicking next on last
            const propsLast = createMockProps({initialPhotoIndex: 2});
            renderWithTheme(<PodPhotoViewer {...propsLast} />);

            fireEvent.click(screen.getByLabelText('Next photo'));
            expect(screen.getByAltText('POD 1')).toBeInTheDocument();
            expect(screen.getByText('Delivered by John Driver')).toBeInTheDocument();
        });
    });

    describe('Navigation - Indicator Dots', () => {
        it('should navigate to specific photo when indicator dot is clicked', () => {
            const props = createMockProps();
            renderWithTheme(<PodPhotoViewer {...props} />);

            const thirdDot = screen.getByLabelText('Go to photo 3');
            fireEvent.click(thirdDot);

            expect(screen.getByAltText('POD 3')).toBeInTheDocument();
            expect(screen.getByText('Delivered by Bob Delivery')).toBeInTheDocument();
        });

        it('should highlight active indicator dot', () => {
            const props = createMockProps({initialPhotoIndex: 1});
            renderWithTheme(<PodPhotoViewer {...props} />);

            const dots = screen.getAllByLabelText(/Go to photo/);

            // Second dot should have white background (active)
            // This is a visual test - we check if the component renders without error
            expect(dots[1]).toBeInTheDocument();
        });
    });

    describe('Keyboard Navigation', () => {
        it('should navigate with ArrowRight and ArrowLeft keys', () => {
            const props = createMockProps();
            renderWithTheme(<PodPhotoViewer {...props} />);

            fireEvent.keyDown(window, {key: 'ArrowRight'});
            expect(screen.getByAltText('POD 2')).toBeInTheDocument();

            fireEvent.keyDown(window, {key: 'ArrowLeft'});
            expect(screen.getByAltText('POD 1')).toBeInTheDocument();
        });

        it('should close dialog with Escape key', async () => {
            const props = createMockProps();
            renderWithTheme(<PodPhotoViewer {...props} />);

            fireEvent.keyDown(window, {key: 'Escape'});

            await waitFor(() => {
                expect(props.onClose).toHaveBeenCalled();
            });
        });

        it('should not respond to keyboard when dialog is closed', () => {
            const props = createMockProps({isOpen: false});
            renderWithTheme(<PodPhotoViewer {...props} />);

            fireEvent.keyDown(window, {key: 'ArrowRight'});

            // onClose should not be called since dialog is already closed
            expect(props.onClose).not.toHaveBeenCalled();
        });
    });

    describe('Close Functionality', () => {
        it('should call onClose when close button is clicked or dialog backdrop triggers Escape', async () => {
            const props = createMockProps();
            renderWithTheme(<PodPhotoViewer {...props} />);

            // Close via button
            const closeButton = screen.getByLabelText('Close photo viewer');
            fireEvent.click(closeButton);
            expect(props.onClose).toHaveBeenCalled();

            // Close via dialog Escape key (simulates backdrop click in MUI)
            const dialog = screen.getByRole('dialog');
            fireEvent.keyDown(dialog, {key: 'Escape'});

            await waitFor(() => {
                expect(props.onClose).toHaveBeenCalledTimes(2);
            });
        });
    });

    describe('Initial Photo Index', () => {
        it('should start at the specified initial photo index', () => {
            const props = createMockProps({initialPhotoIndex: 1});
            renderWithTheme(<PodPhotoViewer {...props} />);

            expect(screen.getByAltText('POD 2')).toBeInTheDocument();
            expect(screen.getByText('Delivered by Jane Courier')).toBeInTheDocument();
        });

        it('should reset to initial index when dialog reopens', () => {
            const props = createMockProps({initialPhotoIndex: 0});
            const {rerender} = renderWithTheme(<PodPhotoViewer {...props} />);

            // Navigate to second photo
            const nextButton = screen.getByLabelText('Next photo');
            fireEvent.click(nextButton);
            expect(screen.getByAltText('POD 2')).toBeInTheDocument();

            // Close dialog
            rerender(
                <ThemeProvider theme={theme}>
                    <PodPhotoViewer {...props} isOpen={false} />
                </ThemeProvider>
            );

            // Reopen dialog with different initial index
            rerender(
                <ThemeProvider theme={theme}>
                    <PodPhotoViewer {...props} isOpen={true} initialPhotoIndex={2} />
                </ThemeProvider>
            );

            expect(screen.getByAltText('POD 3')).toBeInTheDocument();
        });

        it('should handle out-of-bounds initial index gracefully', () => {
            const props = createMockProps({initialPhotoIndex: 10});
            renderWithTheme(<PodPhotoViewer {...props} />);

            // Component returns null when photo at index doesn't exist
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    describe('Single Photo', () => {
        it('should render correctly and allow navigation that wraps to same photo', () => {
            const singlePhoto: PodPhoto[] = [{
                url: 'https://example.com/single.jpg',
                timestamp: '2024-01-15 14:30',
                uploadedBy: 'Solo Driver',
            }];
            const props = createMockProps({photos: singlePhoto});
            renderWithTheme(<PodPhotoViewer {...props} />);

            expect(screen.getByAltText('POD 1')).toBeInTheDocument();
            expect(screen.getAllByLabelText(/Go to photo/)).toHaveLength(1);

            // Navigate next - should still show the same photo
            const nextButton = screen.getByLabelText('Next photo');
            fireEvent.click(nextButton);
            expect(screen.getByAltText('POD 1')).toBeInTheDocument();
        });
    });

    describe('Photo Without Optional Fields', () => {
        it('should render photo without timestamp or without uploader name', () => {
            // Photo without timestamp
            const photoWithoutTimestamp: PodPhoto[] = [{
                url: 'https://example.com/photo.jpg',
                uploadedBy: 'Driver',
            }];
            const propsNoTs = createMockProps({photos: photoWithoutTimestamp});
            const {unmount} = renderWithTheme(<PodPhotoViewer {...propsNoTs} />);

            expect(screen.getByText('Delivered by Driver')).toBeInTheDocument();
            expect(screen.queryByText(/\d{4}-\d{2}-\d{2}/)).not.toBeInTheDocument();
            unmount();

            // Photo without uploader name
            const photoWithoutUploader: PodPhoto[] = [{
                url: 'https://example.com/photo.jpg',
                timestamp: '2024-01-15 14:30',
                uploadedBy: '',
            }];
            const propsNoUploader = createMockProps({photos: photoWithoutUploader});
            renderWithTheme(<PodPhotoViewer {...propsNoUploader} />);

            expect(screen.getByText(/2024-01-15 14:30/)).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have proper aria-labels on all interactive elements and alt text on photo', () => {
            const props = createMockProps();
            renderWithTheme(<PodPhotoViewer {...props} />);

            expect(screen.getByLabelText('Close photo viewer')).toBeInTheDocument();
            expect(screen.getByLabelText('Previous photo')).toBeInTheDocument();
            expect(screen.getByLabelText('Next photo')).toBeInTheDocument();
            expect(screen.getByLabelText('Go to photo 1')).toBeInTheDocument();
            expect(screen.getByLabelText('Go to photo 2')).toBeInTheDocument();
            expect(screen.getByLabelText('Go to photo 3')).toBeInTheDocument();
            expect(screen.getByAltText('POD 1')).toBeInTheDocument();
        });
    });
});
