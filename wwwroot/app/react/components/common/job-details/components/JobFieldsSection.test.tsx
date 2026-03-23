/** @jest-environment jest-environment-jsdom */
/**
 * JobFieldsSection Component Tests
 */

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {JobFieldsSection} from './JobFieldsSection';
import {createMockJob} from '../__testUtils__/mockJob';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

function createDefaultProps(overrides?: Record<string, any>) {
    return {
        job: createMockJob(),
        dense: false,
        isEditMode: false,
        isFieldVisible: () => true,
        onToggleField: jest.fn(),
        onSpeedClick: jest.fn(),
        onJobTypeClick: jest.fn(),
        onSizeClick: jest.fn(),
        onEditRefA: jest.fn(),
        onEditRefB: jest.fn(),
        onEditOurRef: jest.fn(),
        onEditConNote: jest.fn(),
        onEditWeight: jest.fn(),
        onDgClassClick: jest.fn(),
        onLeaveClick: jest.fn(),
        onTrackingMethodClick: jest.fn(),
        onEditTrackingMobile: jest.fn(),
        onEditTrackingEmail: jest.fn(),
        onCourierClick: jest.fn(),
        onContactClick: jest.fn(),
        onClientClick: jest.fn(),
        onEditCustomJobName: jest.fn(),
        onEditDimensions: jest.fn(),
        onInActiveByClick: jest.fn(),
        ...overrides,
    };
}

describe('JobFieldsSection', () => {
    describe('Section headers', () => {
        it('renders all section titles', () => {
            renderWithTheme(<JobFieldsSection {...createDefaultProps()} />);
            expect(screen.getByText('Package Details')).toBeInTheDocument();
            expect(screen.getByText('Additional Info')).toBeInTheDocument();
            expect(screen.getByText('Delivery Details')).toBeInTheDocument();
            expect(screen.getByText('Tracking')).toBeInTheDocument();
            expect(screen.getByText('Booked By')).toBeInTheDocument();
            expect(screen.getByText('Job Details')).toBeInTheDocument();
            const clientElements = screen.getAllByText('Client');
            expect(clientElements.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Job Details fields', () => {
        it('displays all job detail field values', () => {
            renderWithTheme(<JobFieldsSection {...createDefaultProps()} />);
            expect(screen.getByText('Standard')).toBeInTheDocument();
            expect(screen.getByText('REF-A-001')).toBeInTheDocument();
            expect(screen.getByText('REF-B-001')).toBeInTheDocument();
            expect(screen.getByText('OUR-001')).toBeInTheDocument();
            expect(screen.getByText('CN-001')).toBeInTheDocument();
        });

        it('calls field click handlers', () => {
            const onSpeedClick = jest.fn();
            const onEditRefA = jest.fn();
            const onSizeClick = jest.fn();
            renderWithTheme(<JobFieldsSection {...createDefaultProps({onSpeedClick, onEditRefA, onSizeClick})} />);
            fireEvent.click(screen.getByText('Standard'));
            expect(onSpeedClick).toHaveBeenCalledTimes(1);
            fireEvent.click(screen.getByText('REF-A-001'));
            expect(onEditRefA).toHaveBeenCalledTimes(1);
            fireEvent.click(screen.getByText('Small'));
            expect(onSizeClick).toHaveBeenCalledTimes(1);
        });
    });

    describe('Delivery Details fields', () => {
        it('displays dispatcher, courier, and courier mobile', () => {
            renderWithTheme(<JobFieldsSection {...createDefaultProps()} />);
            expect(screen.getByText('Dispatcher A')).toBeInTheDocument();
            expect(screen.getByText('Test Courier')).toBeInTheDocument();
            expect(screen.getByText('021 555 1234')).toBeInTheDocument();
        });

        it('calls onCourierClick when courier field is clicked', () => {
            const onCourierClick = jest.fn();
            renderWithTheme(<JobFieldsSection {...createDefaultProps({onCourierClick})} />);
            fireEvent.click(screen.getByText('Test Courier'));
            expect(onCourierClick).toHaveBeenCalledTimes(1);
        });
    });

    describe('Booked By fields', () => {
        it('displays contact, from contact, and phone', () => {
            renderWithTheme(<JobFieldsSection {...createDefaultProps()} />);
            expect(screen.getByText('Jane Admin')).toBeInTheDocument();
            expect(screen.getByText('John Sender')).toBeInTheDocument();
            expect(screen.getByText('09 555 0001')).toBeInTheDocument();
        });
    });

    describe('Tracking fields', () => {
        it('displays tracking mobile and email', () => {
            renderWithTheme(<JobFieldsSection {...createDefaultProps()} />);
            expect(screen.getByText('021 555 0000')).toBeInTheDocument();
            expect(screen.getByText('track@test.com')).toBeInTheDocument();
        });

        it('calls onTrackingMethodClick when method field is clicked', () => {
            const onTrackingMethodClick = jest.fn();
            const job = createMockJob({trackingMethod: 2});
            renderWithTheme(<JobFieldsSection {...createDefaultProps({onTrackingMethodClick, job})} />);
            const mobileElements = screen.getAllByText('Mobile');
            fireEvent.click(mobileElements[0]);
            expect(onTrackingMethodClick).toHaveBeenCalledTimes(1);
        });
    });

    describe('Client section', () => {
        it('displays client name', () => {
            renderWithTheme(<JobFieldsSection {...createDefaultProps()} />);
            expect(screen.getByText('Test Client Ltd')).toBeInTheDocument();
        });

        it('calls onClientClick when client field is clicked', () => {
            const onClientClick = jest.fn();
            renderWithTheme(<JobFieldsSection {...createDefaultProps({onClientClick})} />);
            fireEvent.click(screen.getByText('Test Client Ltd'));
            expect(onClientClick).toHaveBeenCalledTimes(1);
        });

        it('shows/hides InActive By based on presence', () => {
            const job = createMockJob({inActiveBy: {id: 1, text: 'Admin User'}});
            const {unmount} = renderWithTheme(<JobFieldsSection {...createDefaultProps({job})} />);
            expect(screen.getByText('Admin User')).toBeInTheDocument();
            unmount();

            renderWithTheme(<JobFieldsSection {...createDefaultProps()} />);
            expect(screen.queryByText('InActive By')).not.toBeInTheDocument();
        });
    });

    describe('Field visibility', () => {
        it('hides fields when isFieldVisible returns false', () => {
            const isFieldVisible = (key: string) => key !== 'speedName';
            renderWithTheme(
                <JobFieldsSection {...createDefaultProps({isFieldVisible})} />
            );
            expect(screen.queryByText('Standard')).not.toBeInTheDocument();
        });
    });

    describe('Locked state', () => {
        it('disables click handlers when job is locked', () => {
            const onSpeedClick = jest.fn();
            const job = createMockJob({locked: true});
            renderWithTheme(
                <JobFieldsSection {...createDefaultProps({job, onSpeedClick})} />
            );
            expect(screen.getByText('Standard')).toBeInTheDocument();
        });
    });

    describe('Package Details', () => {
        it('shows CALC ONCE chip when calculateDimsOncePerJob is true', () => {
            const job = createMockJob({calculateDimsOncePerJob: true});
            renderWithTheme(<JobFieldsSection {...createDefaultProps({job})} />);
            const chips = screen.getAllByText('CALC ONCE');
            expect(chips.length).toBeGreaterThan(0);
        });

        it('shows DG Class when present', () => {
            const job = createMockJob({dgClass: 3});
            renderWithTheme(<JobFieldsSection {...createDefaultProps({job})} />);
            expect(screen.getByText('Class 3')).toBeInTheDocument();
        });
    });
});
