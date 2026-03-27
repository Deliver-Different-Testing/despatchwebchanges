/** @jest-environment jest-environment-jsdom */
/**
 * MetricsGrid Component Tests
 */

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {MetricsGrid} from './MetricsGrid';
import {createMockJob} from '../__testUtils__/mockJob';
import dayjs from 'dayjs';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

function createDefaultProps(overrides?: Record<string, any>) {
    return {
        job: createMockJob({
            puTime: dayjs('2026-03-23T09:30:00'),
            deliverByTime: dayjs('2026-03-23T12:00:00'),
            dispatchTime: dayjs('2026-03-23T09:15:00'),
            completedTime: dayjs('2026-03-23T11:45:00'),
        }),
        showToast: jest.fn(),
        onEditDateAndTime: jest.fn(),
        onEditPodName: jest.fn(),
        onEditCompletedTime: jest.fn(),
        onClientClick: jest.fn(),
        onPricingClick: jest.fn(),
        onInternalStatusClick: jest.fn(),
        ...overrides,
    };
}

describe('MetricsGrid', () => {
    it('renders all 12 metric card labels with values', () => {
        renderWithTheme(<MetricsGrid {...createDefaultProps()} />);

        // Row 1
        expect(screen.getByText('Pricing')).toBeInTheDocument();
        expect(screen.getByText('Created')).toBeInTheDocument();
        expect(screen.getByText('Ready')).toBeInTheDocument();
        expect(screen.getByText('PU Arrival')).toBeInTheDocument();
        expect(screen.getByText('PU Time')).toBeInTheDocument();
        expect(screen.getByText('Deliver By')).toBeInTheDocument();

        // Row 2
        expect(screen.getByText('Dispatched')).toBeInTheDocument();
        expect(screen.getByText('Del Arrival')).toBeInTheDocument();
        expect(screen.getByText('POD Name')).toBeInTheDocument();
        expect(screen.getByText('POD Time')).toBeInTheDocument();
        expect(screen.getByText('Follow Up')).toBeInTheDocument();
        expect(screen.getByText('Client Name')).toBeInTheDocument();

        // Values
        expect(screen.getByText('Bob Smith')).toBeInTheDocument();
        expect(screen.getByText('Test Client Ltd')).toBeInTheDocument();
    });

    it('calls click handlers for editable cards', () => {
        const onPricingClick = jest.fn();
        const onClientClick = jest.fn();
        renderWithTheme(<MetricsGrid {...createDefaultProps({onPricingClick, onClientClick})} />);

        const pricingButton = screen.getByText('Pricing').closest('button');
        if (pricingButton) fireEvent.click(pricingButton);
        expect(onPricingClick).toHaveBeenCalledTimes(1);

        const clientButton = screen.getByText('Client Name').closest('button');
        if (clientButton) fireEvent.click(clientButton);
        expect(onClientClick).toHaveBeenCalledTimes(1);
    });

    it('shows toast for non-editable fields', () => {
        const showToast = jest.fn();
        renderWithTheme(<MetricsGrid {...createDefaultProps({showToast})} />);

        const createdButton = screen.getByText('Created').closest('button');
        if (createdButton) fireEvent.click(createdButton);
        expect(showToast).toHaveBeenCalledWith('Created Date is not editable', 'info');

        const dispatchButton = screen.getByText('Dispatched').closest('button');
        if (dispatchButton) fireEvent.click(dispatchButton);
        expect(showToast).toHaveBeenCalledWith('Dispatch Time is not editable', 'info');
    });

    it('calls onEditPodName when POD Name card is clicked', () => {
        const onEditPodName = jest.fn();
        renderWithTheme(<MetricsGrid {...createDefaultProps({onEditPodName})} />);

        const podButton = screen.getByText('POD Name').closest('button');
        if (podButton) fireEvent.click(podButton);
        expect(onEditPodName).toHaveBeenCalledTimes(1);
    });

    it('calls onEditCompletedTime when POD Time card is clicked', () => {
        const onEditCompletedTime = jest.fn();
        renderWithTheme(<MetricsGrid {...createDefaultProps({onEditCompletedTime})} />);

        const podTimeButton = screen.getByText('POD Time').closest('button');
        if (podTimeButton) fireEvent.click(podTimeButton);
        expect(onEditCompletedTime).toHaveBeenCalledTimes(1);
    });

    it('shows dash for empty optional time fields', () => {
        const job = createMockJob({
            pickupArrivalTime: undefined,
            puTime: undefined,
            deliverByTime: undefined,
            deliveryArrivalTime: undefined,
            completedTime: undefined,
            followupTime: undefined,
        });
        renderWithTheme(<MetricsGrid {...createDefaultProps({job})} />);

        const dashes = screen.getAllByText('-');
        expect(dashes.length).toBeGreaterThanOrEqual(5);
    });

    it('disables metric cards when job is locked', () => {
        const job = createMockJob({locked: true});
        const onPricingClick = jest.fn();
        renderWithTheme(<MetricsGrid {...createDefaultProps({job, onPricingClick})} />);

        const pricingLabel = screen.getByText('Pricing');
        const button = pricingLabel.closest('button');
        expect(button).toBeNull();
    });

    describe('dense mode', () => {
        it('renders all 12 metric cards and click handlers work in dense mode', () => {
            const onPricingClick = jest.fn();
            renderWithTheme(<MetricsGrid {...createDefaultProps({dense: true, onPricingClick})} />);
            expect(screen.getByText('Pricing')).toBeInTheDocument();
            expect(screen.getByText('Created')).toBeInTheDocument();
            expect(screen.getByText('Ready')).toBeInTheDocument();
            expect(screen.getByText('PU Arrival')).toBeInTheDocument();
            expect(screen.getByText('PU Time')).toBeInTheDocument();
            expect(screen.getByText('Deliver By')).toBeInTheDocument();
            expect(screen.getByText('Dispatched')).toBeInTheDocument();
            expect(screen.getByText('Del Arrival')).toBeInTheDocument();
            expect(screen.getByText('POD Name')).toBeInTheDocument();
            expect(screen.getByText('POD Time')).toBeInTheDocument();
            expect(screen.getByText('Follow Up')).toBeInTheDocument();
            expect(screen.getByText('Client Name')).toBeInTheDocument();

            const pricingButton = screen.getByText('Pricing').closest('button');
            if (pricingButton) fireEvent.click(pricingButton);
            expect(onPricingClick).toHaveBeenCalledTimes(1);
        });
    });
});
