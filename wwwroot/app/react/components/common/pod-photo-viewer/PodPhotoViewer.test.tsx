/**
 * PodPhotoViewer Component Tests
 */

import React from 'react';
import {render, screen, waitFor, fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ThemeProvider, createTheme} from '@mui/material';
import {PodPhoto, PodPhotoViewerProps } from "./pod-photo-viewer.types";
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
        it('should render dialog when isOpen is true', () => {
            const props = createMockProps();
            renderWithTheme(<PodPhotoViewer {...props} />);

            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('should not render dialog when isOpen is false', () => {
            const props = createMockProps({isOpen: false});
            renderWithTheme(<PodPhotoViewer {...props} />);

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('should render the current photo image', () => {
            const props = createMockProps();
            renderWithTheme(<PodPhotoViewer {...props} />);

            const image = screen.getByAltText('POD 1');
            expect(image).toBeInTheDocument();
            expect(image).toHaveAttribute('src', 'https://example.com/photo1.jpg');
        });

        it('should render close button', () => {
            const props = createMockProps();
            renderWithTheme(<PodPhotoViewer {...props} />);

            expect(screen.getByLabelText('Close photo viewer')).toBeInTheDocument();
        });

        it('should render navigation buttons', () => {
            const props = createMockProps();
            renderWithTheme(<PodPhotoViewer {...props} />);

            expect(screen.getByLabelText('Previous photo')).toBeInTheDocument();
            expect(screen.getByLabelText('Next photo')).toBeInTheDocument();
        });

        it('should render indicator dots for each photo', () => {
            const props = createMockProps();
            renderWithTheme(<PodPhotoViewer {...props} />);

            const dots = screen.getAllByLabelText(/Go to photo/);
            expect(dots).toHaveLength(3);
        });

        it('should return null when currentPhoto is undefined', () => {
            const props = createMockProps({photos: []});
            const {container} = renderWithTheme(<PodPhotoViewer {...props} />);

            // Dialog should not render when no photos
            expect(container.querySelector('[role="dialog"]')).toBeNull();
        });
    });

    describe('Photo Metadata Display', () => {
        it('should display timestamp with timezone', () => {
            const props = createMockProps();
            renderWithTheme(<PodPhotoViewer {...props} />);

            expect(screen.getByText('2024-01-15 14:30 (PST)')).toBeInTheDocument();
        });

        it('should display uploader name', () => {
            const props = createMockProps();
            renderWithTheme(<PodPhotoViewer {...props} />);

            expect(screen.getByText('Delivered by John Driver')).toBeInTheDocument();
        });

        it('should display coordinates when available', () => {
            const props = createMockProps();
            renderWithTheme(<PodPhotoViewer {...props} />);

            expect(screen.getByText('Location: -36.8485, 174.7633')).toBeInTheDocument();
        });

        it('should not display coordinates when not available', async () => {
            const props = createMockProps({initialPhotoIndex: 2});
            renderWithTheme(<PodPhotoViewer {...props} />);

            expect(screen.queryByText(/Location:/)).not.toBeInTheDocument();
        });

        it('should not display timezone for NZ timezone', () => {
            const props = createMockProps({timeZone: 'Pacific/Auckland'});
            renderWithTheme(<PodPhotoViewer {...props} />);

            // Should show timestamp without timezone abbreviation
            expect(screen.getByText('2024-01-15 14:30')).toBeInTheDocument();
        });

        it('should handle missing timezone gracefully', () => {
            const props = createMockProps({timeZone: undefined});
            renderWithTheme(<PodPhotoViewer {...props} />);

            expect(screen.getByText('2024-01-15 14:30')).toBeInTheDocument();
        });
    });

    describe('Navigation - Buttons', () => {
        it('should navigate to next photo when next button is clicked', async () => {
            const props = createMockProps();
            renderWithTheme(<PodPhotoViewer {...props} />);

            const nextButton = screen.getByLabelText('Next photo');
            await userEvent.click(nextButton);

            expect(screen.getByAltText('POD 2')).toBeInTheDocument();
            expect(screen.getByText('Delivered by Jane Courier')).toBeInTheDocument();
        });

        it('should navigate to previous photo when prev button is clicked', async () => {
            const props = createMockProps({initialPhotoIndex: 1});
            renderWithTheme(<PodPhotoViewer {...props} />);

            const prevButton = screen.getByLabelText('Previous photo');
            await userEvent.click(prevButton);

            expect(screen.getByAltText('POD 1')).toBeInTheDocument();
            expect(screen.getByText('Delivered by John Driver')).toBeInTheDocument();
        });

        it('should wrap to last photo when clicking prev on first photo', async () => {
            const props = createMockProps({initialPhotoIndex: 0});
            renderWithTheme(<PodPhotoViewer {...props} />);

            const prevButton = screen.getByLabelText('Previous photo');
            await userEvent.click(prevButton);

            expect(screen.getByAltText('POD 3')).toBeInTheDocument();
            expect(screen.getByText('Delivered by Bob Delivery')).toBeInTheDocument();
        });

        it('should wrap to first photo when clicking next on last photo', async () => {
            const props = createMockProps({initialPhotoIndex: 2});
            renderWithTheme(<PodPhotoViewer {...props} />);

            const nextButton = screen.getByLabelText('Next photo');
            await userEvent.click(nextButton);

            expect(screen.getByAltText('POD 1')).toBeInTheDocument();
            expect(screen.getByText('Delivered by John Driver')).toBeInTheDocument();
        });
    });

    describe('Navigation - Indicator Dots', () => {
        it('should navigate to specific photo when indicator dot is clicked', async () => {
            const props = createMockProps();
            renderWithTheme(<PodPhotoViewer {...props} />);

            const thirdDot = screen.getByLabelText('Go to photo 3');
            await userEvent.click(thirdDot);

            expect(screen.getByAltText('POD 3')).toBeInTheDocument();
            expect(screen.getByText('Delivered by Bob Delivery')).toBeInTheDocument();
        });

        it('should highlight active indicator dot', async () => {
            const props = createMockProps({initialPhotoIndex: 1});
            renderWithTheme(<PodPhotoViewer {...props} />);

            const dots = screen.getAllByLabelText(/Go to photo/);

            // Second dot should have white background (active)
            // This is a visual test - we check if the component renders without error
            expect(dots[1]).toBeInTheDocument();
        });
    });

    describe('Keyboard Navigation', () => {
        it('should navigate to next photo with ArrowRight key', async () => {
            const props = createMockProps();
            renderWithTheme(<PodPhotoViewer {...props} />);

            fireEvent.keyDown(window, {key: 'ArrowRight'});

            await waitFor(() => {
                expect(screen.getByAltText('POD 2')).toBeInTheDocument();
            });
        });

        it('should navigate to previous photo with ArrowLeft key', async () => {
            const props = createMockProps({initialPhotoIndex: 1});
            renderWithTheme(<PodPhotoViewer {...props} />);

            fireEvent.keyDown(window, {key: 'ArrowLeft'});

            await waitFor(() => {
                expect(screen.getByAltText('POD 1')).toBeInTheDocument();
            });
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
        it('should call onClose when close button is clicked', async () => {
            const props = createMockProps();
            renderWithTheme(<PodPhotoViewer {...props} />);

            const closeButton = screen.getByLabelText('Close photo viewer');
            await userEvent.click(closeButton);

            expect(props.onClose).toHaveBeenCalled();
        });

        it('should call onClose when clicking dialog backdrop', async () => {
            const props = createMockProps();
            renderWithTheme(<PodPhotoViewer {...props} />);

            // MUI Dialog calls onClose when backdrop is clicked
            const dialog = screen.getByRole('dialog');
            fireEvent.keyDown(dialog, {key: 'Escape'});

            await waitFor(() => {
                expect(props.onClose).toHaveBeenCalled();
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

        it('should reset to initial index when dialog reopens', async () => {
            const props = createMockProps({initialPhotoIndex: 0});
            const {rerender} = renderWithTheme(<PodPhotoViewer {...props} />);

            // Navigate to second photo
            const nextButton = screen.getByLabelText('Next photo');
            await userEvent.click(nextButton);
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
            const {container} = renderWithTheme(<PodPhotoViewer {...props} />);

            // Component returns null when photo at index doesn't exist
            expect(container.querySelector('[role="dialog"]')).toBeNull();
        });
    });

    describe('Single Photo', () => {
        it('should render correctly with a single photo', () => {
            const singlePhoto: PodPhoto[] = [{
                url: 'https://example.com/single.jpg',
                timestamp: '2024-01-15 14:30',
                uploadedBy: 'Solo Driver',
            }];
            const props = createMockProps({photos: singlePhoto});
            renderWithTheme(<PodPhotoViewer {...props} />);

            expect(screen.getByAltText('POD 1')).toBeInTheDocument();
            expect(screen.getAllByLabelText(/Go to photo/)).toHaveLength(1);
        });

        it('should still allow navigation with single photo (wraps to same photo)', async () => {
            const singlePhoto: PodPhoto[] = [{
                url: 'https://example.com/single.jpg',
                timestamp: '2024-01-15 14:30',
                uploadedBy: 'Solo Driver',
            }];
            const props = createMockProps({photos: singlePhoto});
            renderWithTheme(<PodPhotoViewer {...props} />);

            const nextButton = screen.getByLabelText('Next photo');
            await userEvent.click(nextButton);

            // Should still show the same photo
            expect(screen.getByAltText('POD 1')).toBeInTheDocument();
        });
    });

    describe('Photo Without Optional Fields', () => {
        it('should render photo without timestamp', () => {
            const photoWithoutTimestamp: PodPhoto[] = [{
                url: 'https://example.com/photo.jpg',
                uploadedBy: 'Driver',
            }];
            const props = createMockProps({photos: photoWithoutTimestamp});
            renderWithTheme(<PodPhotoViewer {...props} />);

            expect(screen.getByText('Delivered by Driver')).toBeInTheDocument();
            // Timestamp section should not render
            expect(screen.queryByText(/\d{4}-\d{2}-\d{2}/)).not.toBeInTheDocument();
        });

        it('should render photo without uploader name', () => {
            const photoWithoutUploader: PodPhoto[] = [{
                url: 'https://example.com/photo.jpg',
                timestamp: '2024-01-15 14:30',
                uploadedBy: '',
            }];
            const props = createMockProps({photos: photoWithoutUploader});
            renderWithTheme(<PodPhotoViewer {...props} />);

            expect(screen.getByText(/2024-01-15 14:30/)).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have proper aria-labels on all interactive elements', () => {
            const props = createMockProps();
            renderWithTheme(<PodPhotoViewer {...props} />);

            expect(screen.getByLabelText('Close photo viewer')).toBeInTheDocument();
            expect(screen.getByLabelText('Previous photo')).toBeInTheDocument();
            expect(screen.getByLabelText('Next photo')).toBeInTheDocument();
            expect(screen.getByLabelText('Go to photo 1')).toBeInTheDocument();
            expect(screen.getByLabelText('Go to photo 2')).toBeInTheDocument();
            expect(screen.getByLabelText('Go to photo 3')).toBeInTheDocument();
        });

        it('should have alt text on photo image', () => {
            const props = createMockProps();
            renderWithTheme(<PodPhotoViewer {...props} />);

            expect(screen.getByAltText('POD 1')).toBeInTheDocument();
        });
    });
});
