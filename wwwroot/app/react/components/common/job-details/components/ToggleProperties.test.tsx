/** @jest-environment jest-environment-jsdom */
/**
 * ToggleProperties Component Tests
 */

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {ToggleProperties} from './ToggleProperties';
import {createMockJob} from '../__testUtils__/mockJob';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

function createDefaultProps(overrides?: Record<string, any>) {
    return {
        job: createMockJob(),
        isRecurringJob: false,
        dense: false,
        isEditMode: false,
        isFieldVisible: () => true,
        onToggleField: jest.fn(),
        onToggleProperty: jest.fn(),
        onVoidClick: jest.fn(),
        onActiveClick: jest.fn(),
        onTailLiftPickupClick: jest.fn(),
        onTailLiftDropOffClick: jest.fn(),
        onDeliverToPrivateResChanged: jest.fn(),
        onDoneClick: jest.fn(),
        ...overrides,
    };
}

describe('ToggleProperties', () => {
    it('renders standard checkboxes for a normal job', () => {
        renderWithTheme(<ToggleProperties {...createDefaultProps()} />);

        expect(screen.getByText('Truck')).toBeInTheDocument();
        expect(screen.getByText('Direct')).toBeInTheDocument();
        expect(screen.getByText('Van')).toBeInTheDocument();
        expect(screen.getByText('Reprice')).toBeInTheDocument();
        expect(screen.getByText('Done')).toBeInTheDocument();
        expect(screen.getByText('Void')).toBeInTheDocument();
    });

    it('hides Done and Void for recurring jobs and shows Active', () => {
        renderWithTheme(
            <ToggleProperties {...createDefaultProps({isRecurringJob: true})} />
        );

        expect(screen.queryByText('Done')).not.toBeInTheDocument();
        expect(screen.queryByText('Void')).not.toBeInTheDocument();
        expect(screen.getByText('Active')).toBeInTheDocument();
    });

    it('hides content when checkboxes are not visible', () => {
        renderWithTheme(
            <ToggleProperties {...createDefaultProps({isFieldVisible: () => false})} />
        );
        expect(screen.queryByText('Truck')).not.toBeInTheDocument();
        expect(screen.queryByText('Direct')).not.toBeInTheDocument();
    });

    it('hides truck options when truckOptions is not visible', () => {
        const job = createMockJob({truck: true});
        const isFieldVisible = (key: string) => key !== 'truckOptions';
        renderWithTheme(
            <ToggleProperties {...createDefaultProps({job, isFieldVisible})} />
        );
        expect(screen.queryByText('Truck Options')).not.toBeInTheDocument();
        expect(screen.queryByText('Tail Lift PU')).not.toBeInTheDocument();
    });

    it('calls onToggleProperty when a checkbox is clicked', () => {
        const onToggleProperty = jest.fn();
        renderWithTheme(
            <ToggleProperties {...createDefaultProps({onToggleProperty})} />
        );

        fireEvent.click(screen.getByText('Truck'));
        expect(onToggleProperty).toHaveBeenCalled();
    });

    it('calls onVoidClick when Void checkbox is clicked', () => {
        const onVoidClick = jest.fn();
        renderWithTheme(
            <ToggleProperties {...createDefaultProps({onVoidClick})} />
        );

        fireEvent.click(screen.getByText('Void'));
        expect(onVoidClick).toHaveBeenCalledTimes(1);
    });

    it('disables checkboxes when job is locked', () => {
        const job = createMockJob({locked: true});
        renderWithTheme(
            <ToggleProperties {...createDefaultProps({job})} />
        );

        const checkboxes = screen.getAllByRole('checkbox');
        // Truck, Direct, Van, Reprice, Done, Void should all be disabled
        checkboxes.forEach(cb => {
            expect(cb).toBeDisabled();
        });
    });

    it('shows truck options when truck is checked', () => {
        const job = createMockJob({truck: true});
        renderWithTheme(
            <ToggleProperties {...createDefaultProps({job})} />
        );

        expect(screen.getByText('Truck Options')).toBeInTheDocument();
        expect(screen.getByText('Tail Lift PU')).toBeInTheDocument();
        expect(screen.getByText('Tail Lift DO')).toBeInTheDocument();
        expect(screen.getByText('Residential')).toBeInTheDocument();
    });

    it('hides truck options when truck is not checked', () => {
        renderWithTheme(<ToggleProperties {...createDefaultProps()} />);
        expect(screen.queryByText('Truck Options')).not.toBeInTheDocument();
    });

    it('renders edit mode view with visibility toggle', () => {
        renderWithTheme(
            <ToggleProperties {...createDefaultProps({isEditMode: true})} />
        );

        expect(screen.getByText('Properties')).toBeInTheDocument();
    });

    describe('dense mode', () => {
        it('renders all checkboxes and click handlers work in dense mode', () => {
            const onToggleProperty = jest.fn();
            const onVoidClick = jest.fn();
            renderWithTheme(
                <ToggleProperties {...createDefaultProps({dense: true, onToggleProperty, onVoidClick})} />
            );
            expect(screen.getByText('Truck')).toBeInTheDocument();
            expect(screen.getByText('Direct')).toBeInTheDocument();
            expect(screen.getByText('Van')).toBeInTheDocument();
            expect(screen.getByText('Reprice')).toBeInTheDocument();
            expect(screen.getByText('Done')).toBeInTheDocument();
            expect(screen.getByText('Void')).toBeInTheDocument();

            fireEvent.click(screen.getByText('Truck'));
            expect(onToggleProperty).toHaveBeenCalled();
            fireEvent.click(screen.getByText('Void'));
            expect(onVoidClick).toHaveBeenCalledTimes(1);
        });

        it('shows truck options in dense mode when truck is checked', () => {
            const job = createMockJob({truck: true});
            renderWithTheme(
                <ToggleProperties {...createDefaultProps({dense: true, job})} />
            );
            expect(screen.getByText('Truck Options')).toBeInTheDocument();
            expect(screen.getByText('Tail Lift PU')).toBeInTheDocument();
            expect(screen.getByText('Residential')).toBeInTheDocument();
        });

        it('hides content when checkboxes not visible in dense mode', () => {
            renderWithTheme(
                <ToggleProperties {...createDefaultProps({dense: true, isFieldVisible: () => false})} />
            );
            expect(screen.queryByText('Truck')).not.toBeInTheDocument();
        });
    });
});
