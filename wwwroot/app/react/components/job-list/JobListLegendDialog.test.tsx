/**
 * JobListLegendDialog Tests
 */
import React from 'react';
import {screen} from '@testing-library/react';
import {renderWithTheme} from '../../__testUtils__';
import {setupUser} from '../../__testUtils__/setupUser';
import {JobListLegendDialog} from './JobListLegendDialog';

describe('JobListLegendDialog', () => {
    it('explains that one marker shows per row and groups markers by precedence', () => {
        renderWithTheme(<JobListLegendDialog open onClose={jest.fn()}/>);

        expect(screen.getByText('Column legend')).toBeInTheDocument();
        expect(screen.getByText(/single marker here — the highest-priority one/i)).toBeInTheDocument();

        // Sections ordered to mirror the column precedence
        expect(screen.getByText('Job type')).toBeInTheDocument();
        expect(screen.getByText('Needs attention')).toBeInTheDocument();
        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('Context')).toBeInTheDocument();

        // Status dots
        expect(screen.getByText('Urgent')).toBeInTheDocument();
        expect(screen.getByText('In Transit')).toBeInTheDocument();
        expect(screen.getByText('Done')).toBeInTheDocument();
        expect(screen.getByText('Active')).toBeInTheDocument();

        // Job-type / attention / context markers
        expect(screen.getByText('Flight')).toBeInTheDocument();
        expect(screen.getByText('Chilled')).toBeInTheDocument();
        expect(screen.getByText('Partner Job')).toBeInTheDocument();
        expect(screen.getByText('Late Delivery')).toBeInTheDocument();
        expect(screen.getByText('Related job')).toBeInTheDocument();
    });

    it('consolidates the flight legs into one row instead of four', () => {
        renderWithTheme(<JobListLegendDialog open onClose={jest.fn()}/>);

        // The single "Flight" row lists the legs...
        expect(screen.getByText('Pickup leg')).toBeInTheDocument();
        expect(screen.getByText('Delivery leg')).toBeInTheDocument();
        // ...rather than four separate "Flight …" labels.
        expect(screen.queryByText('Flight Pickup')).not.toBeInTheDocument();
        expect(screen.queryByText('Unknown Flight')).not.toBeInTheDocument();
    });

    it('calls onClose from the Close button and the header close button', async () => {
        const onClose = jest.fn();
        renderWithTheme(<JobListLegendDialog open onClose={onClose}/>);
        const user = setupUser();

        await user.click(screen.getByRole('button', {name: 'Close'}));
        await user.click(screen.getByRole('button', {name: 'Close dialog'}));

        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('renders nothing when closed', () => {
        renderWithTheme(<JobListLegendDialog open={false} onClose={jest.fn()}/>);
        expect(screen.queryByText('Column legend')).not.toBeInTheDocument();
    });
});
